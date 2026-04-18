/**
 * ONE-TIME migration endpoint — call once after deploying, then ignore.
 * Protected: only admins may call it.
 * POST /api/admin/migrate
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupabaseClient } from "@/lib/supabase";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseClient();
  const { data: adminRow } = await supabase
    .from("admin_users")
    .select("email")
    .eq("email", session.user.email)
    .maybeSingle();
  if (!adminRow) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const steps: string[] = [];
  const errors: string[] = [];

  // Step 1 — Create users table
  try {
    // Attempt an insert that will error if the table is missing
    await supabase.from("users").select("email").limit(0);
    steps.push("users table: already exists");
  } catch {
    errors.push(
      "users table does not exist — run the SQL in supabase/migrations/001_user_management.sql " +
      "via the Supabase Dashboard SQL editor, then call this endpoint again.",
    );
  }

  // Step 2 — Verify granted_by column
  try {
    await supabase.from("admin_users").select("granted_by").limit(0);
    steps.push("admin_users.granted_by: already exists");
  } catch {
    errors.push(
      "admin_users.granted_by column is missing — run ALTER TABLE in " +
      "supabase/migrations/001_user_management.sql via the Supabase Dashboard.",
    );
  }

  if (errors.length) {
    return NextResponse.json({ ok: false, steps, errors }, { status: 500 });
  }

  return NextResponse.json({ ok: true, steps });
}
