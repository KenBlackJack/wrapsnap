import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: { token?: string; pin?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { token, pin } = body;

  if (!token?.trim() || !pin?.trim()) {
    return NextResponse.json({ error: "token and pin are required" }, { status: 400 });
  }

  const supabase = getSupabaseClient();

  const { data: session, error } = await supabase
    .from("sessions")
    .select("id, pin, client_name, expires_at, status")
    .eq("token", token.trim())
    .single();

  if (error || !session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  if (new Date(session.expires_at) < new Date()) {
    return NextResponse.json({ error: "Session has expired" }, { status: 410 });
  }

  const pinMatch = await bcrypt.compare(pin.trim(), session.pin);
  if (!pinMatch) {
    return NextResponse.json({ error: "Incorrect PIN" }, { status: 401 });
  }

  // Mark active on first successful verification; allow re-entry if already active
  if (session.status === "pending") {
    await supabase
      .from("sessions")
      .update({ status: "active", used_at: new Date().toISOString() })
      .eq("id", session.id);
  }

  return NextResponse.json({
    valid: true,
    sessionId: session.id,
    clientName: session.client_name,
  });
}
