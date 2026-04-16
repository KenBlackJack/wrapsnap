import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupabaseClient } from "@/lib/supabase";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import twilio from "twilio";

export const runtime = "nodejs";

// No ambiguous chars: 0/O, 1/l/I removed
const TOKEN_CHARS = "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz";

function generateToken(length = 6): string {
  const bytes = crypto.randomBytes(length * 2);
  let token = "";
  for (let i = 0; i < bytes.length && token.length < length; i++) {
    const idx = bytes[i] % TOKEN_CHARS.length;
    // Reject indices that would bias toward lower values (modulo bias mitigation)
    if (bytes[i] < Math.floor(256 / TOKEN_CHARS.length) * TOKEN_CHARS.length) {
      token += TOKEN_CHARS[idx];
    }
  }
  // Fallback: if we didn't collect enough unbiased bytes, fill remainder simply
  while (token.length < length) {
    const b = crypto.randomBytes(1)[0];
    if (b < Math.floor(256 / TOKEN_CHARS.length) * TOKEN_CHARS.length) {
      token += TOKEN_CHARS[b % TOKEN_CHARS.length];
    }
  }
  return token;
}

function generatePin(): string {
  const n = crypto.randomInt(0, 1_000_000);
  return n.toString().padStart(6, "0");
}

export async function POST(req: NextRequest) {
  // Auth check
  const authSession = await getServerSession(authOptions);
  if (!authSession?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const createdBy = authSession.user.email;

  // Parse + validate body
  let body: { client_name?: string; client_phone?: string; expires_in_hours?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { client_name, client_phone, expires_in_hours } = body;

  if (!client_name?.trim()) {
    return NextResponse.json({ error: "client_name is required" }, { status: 400 });
  }
  if (!client_phone?.trim()) {
    return NextResponse.json({ error: "client_phone is required" }, { status: 400 });
  }
  if (![24, 48, 72].includes(expires_in_hours!)) {
    return NextResponse.json({ error: "expires_in_hours must be 24, 48, or 72" }, { status: 400 });
  }

  // Generate token + PIN
  const token = generateToken(6);
  const plainPin = generatePin();
  const hashedPin = await bcrypt.hash(plainPin, 10);

  const expiresAt = new Date(Date.now() + expires_in_hours! * 60 * 60 * 1000).toISOString();

  // Insert into Supabase
  const supabase = getSupabaseClient();
  const { data: row, error: dbError } = await supabase
    .from("sessions")
    .insert({
      token,
      pin: hashedPin,
      client_name: client_name.trim(),
      client_phone: client_phone.trim(),
      created_by: createdBy,
      expires_at: expiresAt,
      status: "pending",
    })
    .select("id, token")
    .single();

  if (dbError) {
    console.error("Supabase insert error:", dbError);
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
  }

  // Normalize phone to E.164 (+1XXXXXXXXXX)
  function toE164(phone: string): string {
    const digits = phone.replace(/\D/g, "");
    if (digits.startsWith("1") && digits.length === 11) return `+${digits}`;
    if (digits.length === 10) return `+1${digits}`;
    return `+${digits}`; // pass through international numbers as-is
  }
  const toPhone = toE164(client_phone.trim());

  // Send SMS via Twilio
  const sessionUrl = `https://wrapsnap.advertisingvehicles.com/scan/${token}`;
  const smsBody =
    `Your WrapSnap estimate session is ready. ` +
    `Visit: ${sessionUrl} and enter PIN: ${plainPin}. ` +
    `This link expires in ${expires_in_hours} hours.`;

  try {
    const twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN,
    );
    await twilioClient.messages.create({
      body: smsBody,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: toPhone,
    });
  } catch (smsError) {
    const errMsg = smsError instanceof Error ? smsError.message : String(smsError);
    const errCode = (smsError as Record<string, unknown>)?.code ?? null;
    const errStatus = (smsError as Record<string, unknown>)?.status ?? null;
    console.error("Twilio SMS error:", { errMsg, errCode, errStatus, toPhone });
    // Session was created — don't roll back. Return full Twilio error so caller can diagnose.
    return NextResponse.json(
      {
        id: row.id,
        token: row.token,
        warning: "Session created but SMS failed to send.",
        twilioError: { message: errMsg, code: errCode, status: errStatus, to: toPhone },
      },
      { status: 207 },
    );
  }

  return NextResponse.json({ id: row.id, token: row.token }, { status: 201 });
}
