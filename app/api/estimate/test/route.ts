import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";

/**
 * GET /api/estimate/test
 *
 * Diagnostic endpoint — confirms env vars, Supabase connectivity, and
 * Anthropic API auth are all working in the current deployment.
 * Returns a JSON report; never returns cached output.
 *
 * Remove or gate behind auth before going to production at scale.
 */
export async function GET() {
  const report: Record<string, unknown> = {};

  // ── 1. Environment variables ──────────────────────────────────────────────
  const anthropicKey = process.env.ANTHROPIC_API_KEY ?? "";
  const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceKey   = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  report.env = {
    ANTHROPIC_API_KEY:        anthropicKey  ? anthropicKey.slice(0, 14) + "…"  : "MISSING",
    NEXT_PUBLIC_SUPABASE_URL: supabaseUrl   ? supabaseUrl.slice(0, 32)  + "…"  : "MISSING",
    SUPABASE_SERVICE_ROLE_KEY: serviceKey   ? serviceKey.slice(0, 12)   + "…"  : "MISSING",
    NODE_ENV: process.env.NODE_ENV ?? "unknown",
  };

  // ── 2. Supabase connectivity ──────────────────────────────────────────────
  try {
    const supabase = getSupabaseClient();

    // Count sessions
    const { count: sessionCount, error: sessionErr } = await supabase
      .from("sessions")
      .select("*", { count: "exact", head: true });

    // Most recent 3 sessions (id + status)
    const { data: recentSessions, error: recentErr } = await supabase
      .from("sessions")
      .select("id, status, created_at")
      .order("created_at", { ascending: false })
      .limit(3);

    // Upload count
    const { count: uploadCount, error: uploadErr } = await supabase
      .from("uploads")
      .select("*", { count: "exact", head: true });

    report.supabase = {
      ok: !sessionErr && !recentErr && !uploadErr,
      session_count: sessionErr ? `ERROR: ${sessionErr.message}` : sessionCount,
      upload_count:  uploadErr  ? `ERROR: ${uploadErr.message}`  : uploadCount,
      recent_sessions: recentErr ? `ERROR: ${recentErr.message}` : recentSessions,
    };
  } catch (e) {
    report.supabase = { ok: false, error: String(e) };
  }

  // ── 3. Anthropic API auth test ────────────────────────────────────────────
  try {
    const anthropic = new Anthropic();
    // Cheapest possible call — 1 token in, 1 token out
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 5,
      messages: [{ role: "user", content: "Reply with only the word OK." }],
    });
    const text = msg.content.find((b) => b.type === "text");
    report.anthropic = {
      ok: true,
      model: "claude-haiku-4-5",
      response: text?.type === "text" ? text.text.slice(0, 20) : "(no text block)",
      usage: msg.usage,
    };
  } catch (e) {
    const err = e as Record<string, unknown>;
    report.anthropic = {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      status: err?.status,
      error_body: err?.error,
    };
  }

  // ── 4. Storage download test (most recent upload) ─────────────────────────
  try {
    const supabase = getSupabaseClient();
    const { data: uploads } = await supabase
      .from("uploads")
      .select("storage_path")
      .order("uploaded_at", { ascending: false })
      .limit(1);

    if (uploads?.[0]) {
      const path = uploads[0].storage_path;
      const { data: fileData, error: dlErr } = await supabase.storage
        .from("vehicle-photos")
        .download(path);

      if (dlErr || !fileData) {
        report.storage = { ok: false, path, error: dlErr?.message ?? "no data" };
      } else {
        const ab = await fileData.arrayBuffer();
        report.storage = {
          ok: true,
          path,
          bytes: ab.byteLength,
          mime: fileData.type,
        };
      }
    } else {
      report.storage = { ok: true, note: "no uploads found to test" };
    }
  } catch (e) {
    report.storage = { ok: false, error: String(e) };
  }

  return NextResponse.json(report, {
    headers: { "Cache-Control": "no-store" },
  });
}
