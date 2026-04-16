import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";

export const runtime = "nodejs";

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
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  if (session.status !== "active") {
    return NextResponse.json({ error: "Session is not active" }, { status: 403 });
  }
  if (new Date(session.expires_at) < new Date()) {
    return NextResponse.json({ error: "Session has expired" }, { status: 410 });
  }

  // Upload to Supabase Storage
  const storagePath = `${session.id}/${panelSlug}.jpg`;
  const arrayBuffer = await file.arrayBuffer();
  const fileBuffer  = Buffer.from(arrayBuffer);

  const { error: uploadError } = await supabase.storage
    .from("vehicle-photos")
    .upload(storagePath, fileBuffer, {
      contentType: "image/jpeg",
      upsert: true,       // allow re-upload (retake)
    });

  if (uploadError) {
    console.error("Storage upload error:", uploadError);
    return NextResponse.json({ error: "Failed to upload image" }, { status: 500 });
  }

  // Upsert uploads row (idempotent on retake)
  const { error: dbError } = await supabase
    .from("uploads")
    .upsert(
      { session_id: session.id, panel: panelSlug, storage_path: storagePath },
      { onConflict: "session_id,panel" },
    );

  if (dbError) {
    console.error("Uploads insert error:", dbError);
    return NextResponse.json({ error: "Failed to record upload" }, { status: 500 });
  }

  return NextResponse.json({ success: true, path: storagePath });
}
