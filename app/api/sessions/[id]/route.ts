import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupabaseClient } from "@/lib/supabase";

export const runtime = "nodejs";

const ADMIN_DOMAINS = ["@advertisingvehicles.com", "@est03.com"];

/** Fetch session and verify the caller is allowed to mutate it. */
async function resolveSession(id: string, userEmail: string) {
  const supabase = getSupabaseClient();
  const { data: session, error } = await supabase
    .from("sessions")
    .select("id, created_by, token")
    .eq("id", id)
    .single();

  if (error || !session) return { session: null, allowed: false, supabase };

  const isAdmin = ADMIN_DOMAINS.some((d) => userEmail.endsWith(d));
  const isOwner = session.created_by === userEmail;
  return { session, allowed: isAdmin || isOwner, supabase };
}

// ── PATCH /api/sessions/[id] — archive ────────────────────────────────────────

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authSession = await getServerSession(authOptions);
  if (!authSession?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { session, allowed, supabase } = await resolveSession(id, authSession.user.email);

  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { error } = await supabase
    .from("sessions")
    .update({ status: "archived" })
    .eq("id", id);

  if (error) {
    console.error("PATCH session: archive failed", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  console.log("PATCH session: archived", { id });
  return NextResponse.json({ ok: true });
}

// ── DELETE /api/sessions/[id] — permanently delete ───────────────────────────

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authSession = await getServerSession(authOptions);
  if (!authSession?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { session, allowed, supabase } = await resolveSession(id, authSession.user.email);

  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // 1 — Fetch upload storage paths
  const { data: uploads } = await supabase
    .from("uploads")
    .select("storage_path")
    .eq("session_id", id);

  // 2 — Remove photos from Supabase Storage
  if (uploads?.length) {
    const paths = uploads.map((u) => u.storage_path as string);
    const { error: storageError } = await supabase.storage
      .from("vehicle-photos")
      .remove(paths);
    if (storageError) {
      // Log but continue — don't block deletion over orphaned storage files
      console.error("DELETE session: storage removal partial failure", storageError.message);
    }
  }

  // 3 — Delete uploads rows
  await supabase.from("uploads").delete().eq("session_id", id);

  // 4 — Delete estimates rows
  await supabase.from("estimates").delete().eq("session_id", id);

  // 5 — Delete session row
  const { error: deleteError } = await supabase.from("sessions").delete().eq("id", id);

  if (deleteError) {
    console.error("DELETE session: session row deletion failed", deleteError.message);
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  console.log("DELETE session: permanently deleted", { id, uploadCount: uploads?.length ?? 0 });
  return NextResponse.json({ ok: true });
}
