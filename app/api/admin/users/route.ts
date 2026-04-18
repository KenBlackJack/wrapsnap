import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupabaseClient } from "@/lib/supabase";

const OWNER_EMAIL = "ken@est03.com";

async function requireAdmin(email: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from("admin_users")
    .select("email")
    .eq("email", email)
    .maybeSingle();
  return !!data;
}

// GET /api/admin/users — list all users with their admin status
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await requireAdmin(session.user.email))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = getSupabaseClient();
  const [usersRes, adminsRes] = await Promise.all([
    supabase
      .from("users")
      .select("email, name, last_login")
      .order("last_login", { ascending: false }),
    supabase.from("admin_users").select("email, granted_by, granted_at"),
  ]);

  const adminMap = new Map(
    (adminsRes.data ?? []).map((a) => [a.email, a]),
  );

  const users = (usersRes.data ?? []).map((u) => ({
    email: u.email,
    name: u.name ?? null,
    last_login: u.last_login ?? null,
    is_admin: adminMap.has(u.email),
    granted_by: adminMap.get(u.email)?.granted_by ?? null,
    granted_at: adminMap.get(u.email)?.granted_at ?? null,
  }));

  return NextResponse.json(users);
}

// PATCH /api/admin/users — grant admin to a user
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await requireAdmin(session.user.email))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const targetEmail: string | undefined = body?.email;
  if (!targetEmail) {
    return NextResponse.json({ error: "Missing email" }, { status: 400 });
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase.from("admin_users").upsert(
    {
      email: targetEmail,
      granted_by: session.user.email,
      granted_at: new Date().toISOString(),
    },
    { onConflict: "email" },
  );
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

// DELETE /api/admin/users — revoke admin from a user
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await requireAdmin(session.user.email))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const targetEmail: string | undefined = body?.email;
  if (!targetEmail) {
    return NextResponse.json({ error: "Missing email" }, { status: 400 });
  }
  if (targetEmail === OWNER_EMAIL) {
    return NextResponse.json(
      { error: "Cannot remove admin access from the owner account." },
      { status: 400 },
    );
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("admin_users")
    .delete()
    .eq("email", targetEmail);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
