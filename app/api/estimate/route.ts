import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";

const ESTIMATION_PROMPT = `\
You are an expert vinyl wrap estimator for Advertising Vehicles, a fleet graphics company.

You are analyzing vehicle panel photos. Each photo contains a 12-inch diameter circular fiducial reference card placed flat on the vehicle surface. Use this card as your precise scale reference to calculate accurate square footage.

For each panel photo, you must:
1. Locate the 12-inch fiducial card and use it to calibrate your measurements
2. Identify all vinyl graphic areas and classify each as:
   - "printed_wrap" — large-format printed vinyl (full-color graphics, wraps)
   - "cut_vinyl"    — individually cut vinyl letters, logos, or shapes
   - "review"       — ambiguous areas that need human confirmation
3. Calculate square footage per graphic zone with bleed allowances:
   - Printed wrap:  add 1.5 inches on every edge before calculating sq ft
   - Cut vinyl:     add 0.5 inches on every edge before calculating sq ft
4. Detect the vehicle's base paint color
5. Flag any cut vinyl whose color closely matches the detected paint color (visibility risk)

Return ONLY a valid JSON object — no markdown fences, no explanation, just the raw JSON:

{
  "vehicle_type": "cargo_van | box_truck | pickup_truck | sedan | suv | sprinter | other",
  "panels": [
    {
      "name": "the panel name as labeled in the image context",
      "sqft": <number: best single estimate>,
      "sqft_low": <number: conservative estimate>,
      "sqft_high": <number: generous estimate>,
      "graphics": [
        {
          "type": "printed_wrap | cut_vinyl | review",
          "sqft": <number>,
          "bbox": {
            "x": <0.0–1.0: left edge fraction of image width>,
            "y": <0.0–1.0: top edge fraction of image height>,
            "w": <0.0–1.0: width fraction>,
            "h": <0.0–1.0: height fraction>
          },
          "color_description": "<string or null>"
        }
      ]
    }
  ],
  "total_sqft": <number>,
  "sqft_low": <number>,
  "sqft_high": <number>,
  "paint_color": "<description of vehicle base paint color>",
  "paint_warnings": ["<string>" ],
  "confidence": "high | medium | low",
  "confidence_note": "<explanation of confidence level and any caveats>"
}`;

export async function POST(req: NextRequest) {
  let body: { token?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { token } = body;
  if (!token?.trim()) {
    return NextResponse.json({ error: "token is required" }, { status: 400 });
  }

  const supabase = getSupabaseClient();

  // Verify session is active
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("id, status, expires_at")
    .eq("token", token.trim())
    .single();

  if (sessionError || !session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  if (session.status !== "active") {
    return NextResponse.json({ error: "Session is not active" }, { status: 403 });
  }
  if (new Date(session.expires_at) < new Date()) {
    return NextResponse.json({ error: "Session has expired" }, { status: 410 });
  }

  // Fetch upload records
  const { data: uploads, error: uploadsError } = await supabase
    .from("uploads")
    .select("panel, storage_path")
    .eq("session_id", session.id)
    .order("uploaded_at", { ascending: true });

  if (uploadsError || !uploads?.length) {
    return NextResponse.json({ error: "No uploads found for this session" }, { status: 422 });
  }

  // Download each image from Supabase Storage and encode as base64
  const imageBlocks: Anthropic.ImageBlockParam[] = [];
  const panelLabels: string[] = [];

  for (const upload of uploads) {
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("vehicle-photos")
      .download(upload.storage_path);

    if (downloadError || !fileData) {
      console.error(`Failed to download ${upload.storage_path}:`, downloadError);
      return NextResponse.json(
        { error: `Failed to retrieve image for panel: ${upload.panel}` },
        { status: 500 },
      );
    }

    const arrayBuffer = await fileData.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    panelLabels.push(upload.panel);

    imageBlocks.push({
      type: "image",
      source: {
        type: "base64",
        media_type: "image/jpeg",
        data: base64,
      },
    });
  }

  // Build panel context so Claude knows which image is which
  const panelContext = panelLabels
    .map((p, i) => `Image ${i + 1}: ${p.replace(/_/g, " ")}`)
    .join("\n");

  // Call Claude
  const anthropic = new Anthropic();
  let rawResponse: string;
  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            ...imageBlocks,
            {
              type: "text",
              text: `Panel order:\n${panelContext}\n\n${ESTIMATION_PROMPT}`,
            },
          ],
        },
      ],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    rawResponse = textBlock?.type === "text" ? textBlock.text : "";
  } catch (aiError) {
    console.error("Claude API error:", aiError);
    return NextResponse.json({ error: "AI estimation failed" }, { status: 502 });
  }

  // Parse Claude's JSON response
  let estimate: Record<string, unknown>;
  try {
    // Strip accidental markdown fences if Claude added them
    const cleaned = rawResponse.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    estimate = JSON.parse(cleaned);
  } catch (parseError) {
    console.error("Failed to parse Claude response:", rawResponse, parseError);
    return NextResponse.json({ error: "Failed to parse AI response" }, { status: 502 });
  }

  // Insert into estimates table
  const { data: estimateRow, error: estimateError } = await supabase
    .from("estimates")
    .insert({
      session_id:      session.id,
      vehicle_type:    estimate.vehicle_type as string ?? null,
      panels:          estimate.panels ?? null,
      total_sqft:      estimate.total_sqft as number ?? null,
      sqft_low:        estimate.sqft_low as number ?? null,
      sqft_high:       estimate.sqft_high as number ?? null,
      confidence:      estimate.confidence as string ?? null,
      confidence_note: estimate.confidence_note as string ?? null,
      raw_response:    rawResponse,
    })
    .select("id")
    .single();

  if (estimateError) {
    console.error("Estimate insert error:", estimateError);
    // Don't fail the request — return the estimate even if DB write fails
  }

  // Mark session complete
  await supabase
    .from("sessions")
    .update({ status: "complete" })
    .eq("id", session.id);

  return NextResponse.json({
    estimateId: estimateRow?.id ?? null,
    ...estimate,
  });
}
