import { NextRequest, NextResponse, after } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupabaseClient } from "@/lib/supabase";
import Anthropic from "@anthropic-ai/sdk";
import { ESTIMATION_PROMPT } from "@/lib/estimation-prompt";
import type { Artboard1Data, Artboard2Data, Artboard3Data } from "@/components/EstimatePDF";

export const runtime = "nodejs";

const CLAUDE_MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

function toClaudeMediaType(raw: string): "image/jpeg" | "image/png" | "image/gif" | "image/webp" {
  const t = raw.toLowerCase().split(";")[0].trim();
  if (CLAUDE_MEDIA_TYPES.has(t)) return t as "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  return "image/jpeg";
}

interface GroupBBox {
  label: string;
  artboard: number;
  bbox: { x: number; y: number; w: number; h: number };
  panel: string;
}

async function runReestimation(
  sessionId: string,
  uploads: { panel: string; storage_path: string }[],
) {
  const supabase = getSupabaseClient();
  console.log("Reestimate[bg]: starting for session", sessionId);

  const imageBlocks: Anthropic.ImageBlockParam[] = [];
  const panelLabels: string[] = [];

  for (const upload of uploads) {
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("vehicle-photos")
      .download(upload.storage_path);

    if (downloadError || !fileData) {
      console.error("Reestimate[bg]: download failed", {
        path: upload.storage_path,
        error: downloadError?.message,
      });
      await supabase.from("sessions").update({ status: "complete" }).eq("id", sessionId);
      return;
    }

    const arrayBuffer = await fileData.arrayBuffer();
    const mediaType = toClaudeMediaType(fileData.type || "image/jpeg");
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    panelLabels.push(upload.panel);
    imageBlocks.push({
      type: "image",
      source: { type: "base64", media_type: mediaType, data: base64 },
    });
  }

  const panelContext = panelLabels
    .map((p, i) => `Image ${i + 1}: ${p.replace(/_/g, " ")}`)
    .join("\n");

  const anthropic = new Anthropic();
  let rawResponse: string;
  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            ...imageBlocks,
            { type: "text", text: `Panel order:\n${panelContext}\n\n${ESTIMATION_PROMPT}` },
          ],
        },
      ],
    });

    console.log("Reestimate[bg]: Claude responded", {
      stop_reason: message.stop_reason,
      usage: message.usage,
    });

    const textBlock = message.content.find((b) => b.type === "text");
    rawResponse = textBlock?.type === "text" ? textBlock.text : "";

    if (!rawResponse) {
      console.error("Reestimate[bg]: Claude returned no text block");
      await supabase.from("sessions").update({ status: "complete" }).eq("id", sessionId);
      return;
    }
  } catch (aiError) {
    console.error("Reestimate[bg]: Claude API error", {
      message: aiError instanceof Error ? aiError.message : String(aiError),
    });
    await supabase.from("sessions").update({ status: "complete" }).eq("id", sessionId);
    return;
  }

  let estimate: Record<string, unknown>;
  try {
    const cleaned = rawResponse
      .replace(/^```(?:json)?\s*/im, "")
      .replace(/\s*```\s*$/im, "")
      .trim();
    estimate = JSON.parse(cleaned);
  } catch (parseError) {
    console.error("Reestimate[bg]: JSON parse failed", {
      message: parseError instanceof Error ? parseError.message : String(parseError),
    });
    await supabase.from("sessions").update({ status: "complete" }).eq("id", sessionId);
    return;
  }

  const grandTotal = (estimate.grand_total_sqft as number) ?? null;
  const artboardData = {
    artboard1:   (estimate.artboard1   as Artboard1Data) ?? null,
    artboard2:   (estimate.artboard2   as Artboard2Data) ?? null,
    artboard3:   (estimate.artboard3   as Artboard3Data) ?? null,
    groups_bbox: (estimate.groups_bbox as GroupBBox[])   ?? null,
  };

  const { error: insertError } = await supabase.from("estimates").insert({
    session_id:      sessionId,
    vehicle_type:    (estimate.vehicle_type as string) ?? null,
    panels:          artboardData,
    total_sqft:      grandTotal,
    sqft_low:        null,
    sqft_high:       null,
    confidence:      (estimate.confidence as string) ?? null,
    confidence_note: (estimate.confidence_note as string) ?? null,
    raw_response:    rawResponse,
  });

  if (insertError) {
    console.error("Reestimate[bg]: DB insert error", insertError.message);
    await supabase.from("sessions").update({ status: "complete" }).eq("id", sessionId);
    return;
  }

  await supabase.from("sessions").update({ status: "complete" }).eq("id", sessionId);
  console.log("Reestimate[bg]: done", { sessionId, grandTotal });
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const authSession = await getServerSession(authOptions);
  if (!authSession?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userEmail = authSession.user.email;

  const supabase = getSupabaseClient();

  const { data: adminRow } = await supabase
    .from("admin_users")
    .select("email")
    .eq("email", userEmail)
    .maybeSingle();

  if (!adminRow) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("id, status")
    .eq("id", id)
    .single();

  if (sessionError || !session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  if (session.status === "processing") {
    return NextResponse.json({ status: "processing" }, { status: 202 });
  }

  const { data: uploads, error: uploadsError } = await supabase
    .from("uploads")
    .select("panel, storage_path")
    .eq("session_id", id)
    .order("uploaded_at", { ascending: true });

  if (uploadsError || !uploads?.length) {
    return NextResponse.json({ error: "No uploads found for this session" }, { status: 422 });
  }

  await supabase.from("sessions").update({ status: "processing" }).eq("id", id);

  after(async () => {
    await runReestimation(id, uploads);
  });

  return NextResponse.json({ status: "processing" }, { status: 202 });
}
