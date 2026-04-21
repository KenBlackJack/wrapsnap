import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";

// Claude only accepts these image types
const CLAUDE_MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

function toClaudeMediaType(raw: string): "image/jpeg" | "image/png" | "image/gif" | "image/webp" {
  const t = raw.toLowerCase().split(";")[0].trim();
  if (CLAUDE_MEDIA_TYPES.has(t)) return t as "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  return "image/jpeg";
}

const VALIDATION_PROMPT = `\
You are a photo validator for a vehicle vinyl graphics estimation tool. Analyze this image and respond ONLY with valid JSON in this exact format (no markdown fences, no explanation):

{
  "valid": true or false,
  "vehicle_detected": true or false,
  "fiducial_count": 0,
  "rejection_reason": "only present if valid is false — one of: NO_FIDUCIAL, ONE_FIDUCIAL, NO_VEHICLE, TOO_CLOSE, BAD_ANGLE",
  "rejection_message": "only present if valid is false — a friendly 1-2 sentence message telling the user exactly what to fix and retake"
}

Evaluate in this exact priority order — stop at the first failure:

CHECK 1 — FIDUCIAL MARKERS (most important check):
  Count the 12-inch diameter circular reference cards visible in the image.
  - 0 cards visible → valid: false, rejection_reason: "NO_FIDUCIAL",
    rejection_message: "Fiducial markers not clearly visible. Try repositioning the markers so they face the camera more directly."
  - 1 card visible → valid: false, rejection_reason: "ONE_FIDUCIAL",
    rejection_message: "Only one marker found — two are required. Place one near the front of the panel and one near the rear, then retake."
  - 2+ cards visible → pass, continue to CHECK 2

CHECK 2 — FULL PANEL IN FRAME:
  Is the full vehicle panel visible without being cut off at the edges?
  - Panel is cut off or camera is too close → valid: false, rejection_reason: "TOO_CLOSE",
    rejection_message: "Please step back so the full panel fits in the frame, then retake."
  - Full panel is visible → pass, continue to CHECK 3

CHECK 3 — CAMERA ANGLE:
  Is the shooting angle reasonable (not extreme overhead or worm's-eye)?
  - Extreme angle that would make measurement unreliable → valid: false, rejection_reason: "BAD_ANGLE",
    rejection_message: "Please photograph the panel more straight-on, then retake."
  - Reasonable angle → pass, continue to CHECK 4

CHECK 4 — VEHICLE PRESENT:
  - No vehicle visible at all → valid: false, rejection_reason: "NO_VEHICLE",
    rejection_message: "No vehicle detected. Point the camera at the vehicle panel."
  - Vehicle is present → valid: true

Additional rules:
- valid may be true even if the panel has no vinyl graphics — a plain panel with both cards visible is a valid measurement.
- Do NOT reject for blur or darkness unless the image is completely unusable (cards invisible, panel invisible). These are handled upstream.
- fiducial_count must be the integer count of circular reference cards you can see (0, 1, or 2+).`;

// Map display panel names from the client to snake_case storage keys
const PANEL_SLUG: Record<string, string> = {
  "Driver Side":    "driver_side",
  "Passenger Side": "passenger_side",
  "Front":          "front",
  "Rear":           "rear",
};

export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const token  = (formData.get("token")  as string | null)?.trim();
  const panel  = (formData.get("panel")  as string | null)?.trim();
  const file   =  formData.get("file") as File | null;

  if (!token || !panel || !file) {
    return NextResponse.json({ error: "token, panel, and file are required" }, { status: 400 });
  }

  const panelSlug = PANEL_SLUG[panel];
  if (!panelSlug) {
    return NextResponse.json({ error: `Unknown panel: ${panel}` }, { status: 400 });
  }

  const supabase = getSupabaseClient();

  // Verify session is active
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("id, status, expires_at")
    .eq("token", token)
    .single();

  if (sessionError || !session) {
    console.error("Upload: session lookup failed", { token, sessionError });
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  if (session.status === "expired" || session.status === "complete" || session.status === "processing") {
    console.error("Upload: session closed", { token, status: session.status });
    return NextResponse.json({ error: `Session is ${session.status}` }, { status: 403 });
  }
  if (new Date(session.expires_at) < new Date()) {
    console.error("Upload: session expired", { token, expires_at: session.expires_at });
    return NextResponse.json({ error: "Session has expired" }, { status: 410 });
  }

  // Upload to Supabase Storage
  const storagePath = `${session.id}/${panelSlug}.jpg`;
  const contentType = file.type || "image/jpeg";
  const arrayBuffer = await file.arrayBuffer();
  const fileBuffer  = Buffer.from(arrayBuffer);

  console.log("Upload: storing", { storagePath, contentType, bytes: fileBuffer.length });

  const { error: uploadError } = await supabase.storage
    .from("vehicle-photos")
    .upload(storagePath, fileBuffer, {
      contentType,
      upsert: true,       // allow re-upload (retake)
    });

  if (uploadError) {
    console.error("Upload: storage error", { storagePath, message: uploadError.message, uploadError });
    return NextResponse.json({ error: "Failed to upload image", detail: uploadError.message }, { status: 500 });
  }

  // Upsert uploads row (idempotent on retake)
  const { error: dbError } = await supabase
    .from("uploads")
    .upsert(
      { session_id: session.id, panel: panelSlug, storage_path: storagePath },
      { onConflict: "session_id,panel" },
    );

  if (dbError) {
    console.error("Upload: db upsert error", { storagePath, message: dbError.message, dbError });
    return NextResponse.json({ error: "Failed to record upload", detail: dbError.message }, { status: 500 });
  }

  // ── Claude photo validation ───────────────────────────────────────────────
  try {
    const base64 = fileBuffer.toString("base64");
    const mediaType = toClaudeMediaType(contentType);

    const anthropic = new Anthropic();
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 256,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
            { type: "text", text: VALIDATION_PROMPT },
          ],
        },
      ],
    });

    const textBlock = msg.content.find((b) => b.type === "text");
    const rawText = textBlock?.type === "text" ? textBlock.text : "";
    const cleaned = rawText
      .replace(/^```(?:json)?\s*/im, "")
      .replace(/\s*```\s*$/im, "")
      .trim();

    let validation: {
      valid: boolean;
      rejection_reason?: string;
      rejection_message?: string;
    };
    try {
      validation = JSON.parse(cleaned);
    } catch {
      // Unparseable response — allow upload through rather than block the user
      console.warn("Upload: Claude validation parse failed, allowing through", { rawText: rawText.slice(0, 200) });
      return NextResponse.json({ success: true, path: storagePath });
    }

    console.log("Upload: validation result", { storagePath, valid: validation.valid, rejection_reason: validation.rejection_reason });

    if (!validation.valid) {
      return NextResponse.json(
        {
          error: "Photo rejected",
          rejection_reason: validation.rejection_reason ?? "INVALID",
          rejection_message: validation.rejection_message ?? "This photo couldn't be used. Please retake it.",
        },
        { status: 422 },
      );
    }
  } catch (validationError) {
    // Validation call failed (e.g. API key missing, network error) — allow upload through
    console.error("Upload: Claude validation error, allowing through", {
      error: validationError instanceof Error ? validationError.message : String(validationError),
    });
  }

  console.log("Upload: success", { storagePath });
  return NextResponse.json({ success: true, path: storagePath });
}
