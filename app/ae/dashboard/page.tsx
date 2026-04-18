import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupabaseClient } from "@/lib/supabase";
import SignOutButton from "./sign-out-button";
import ScanButton from "./scan-button";
import SessionList from "./session-list";
import type { DashboardSession } from "./session-list";

export const dynamic = "force-dynamic";

const ADMIN_DOMAINS = ["@advertisingvehicles.com", "@est03.com"];

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  const userEmail = session.user.email ?? "";
  const userName = session.user.name ?? (userEmail || "AE");

  // Issue 1 — confirmed: sessions are already filtered by created_by
  console.log("Dashboard: loading sessions for", userEmail);

  const supabase = getSupabaseClient();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Issue 3 — auto-archive: mark sessions older than 30 days as archived
  const { error: archiveError } = await supabase
    .from("sessions")
    .update({ status: "archived" })
    .eq("created_by", userEmail)
    .neq("status", "archived")
    .lt("created_at", thirtyDaysAgo);

  if (archiveError) {
    console.error("Dashboard: auto-archive error", archiveError.message);
  }

  // Issue 3 — query: show sessions within the last 30 days OR not archived
  const { data: wrapSessions } = await supabase
    .from("sessions")
    .select("id, client_name, vehicle_description, created_by, status, created_at")
    .eq("created_by", userEmail)
    .or(`created_at.gte.${thirtyDaysAgo},status.neq.archived`)
    .order("created_at", { ascending: false });

  const sessions: DashboardSession[] = wrapSessions ?? [];
  const isAdmin = ADMIN_DOMAINS.some((d) => userEmail.endsWith(d));

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b-2" style={{ borderColor: "#007BBA" }}>
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex flex-col justify-center">
              <Link href="/ae/dashboard">
                <img src="/images/WrapSnap_Logo_Horizontal_SM.jpg" alt="WrapSnap" className="h-10 w-auto object-contain cursor-pointer" />
              </Link>
              <p className="text-[11px] mt-0.5" style={{ color: "#004876" }}>Powered by Advertising Vehicles</p>
            </div>

            <div className="flex items-center gap-3">
              {isAdmin && (
                <Link
                  href="/ae/admin"
                  className="hidden text-sm font-medium sm:block transition hover:opacity-80"
                  style={{ color: "#007BBA" }}
                >
                  Admin
                </Link>
              )}
              <span className="hidden text-sm sm:block" style={{ color: "#004876" }}>{userName}</span>
              <SignOutButton />
            </div>
          </div>
        </div>
      </header>

      {/* Page body */}
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">

        {/* Action cards */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ScanButton aeName={userName} />

          <Link
            href="/ae/sessions/new"
            className="flex flex-col items-start gap-3 rounded-xl border-2 bg-white p-5 text-left transition hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2"
            style={{ borderColor: "#007BBA" }}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: "#EBF5FB" }}>
              <svg className="h-5 w-5" style={{ color: "#007BBA" }} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
              </svg>
            </div>
            <div>
              <p className="font-semibold" style={{ color: "#007BBA" }}>Invite a Client</p>
              <p className="mt-0.5 text-sm text-gray-500">Send a scan link — client does it themselves</p>
            </div>
          </Link>
        </div>

        {/* Recent sessions */}
        <h2 className="mb-4 text-base font-semibold text-gray-900">Recent Sessions</h2>

        <SessionList initialSessions={sessions} />

        {/* Issue 3 — archive link */}
        <div className="mt-6 text-center">
          <Link
            href="/ae/sessions/archive"
            className="text-sm text-gray-400 hover:text-gray-600 transition"
          >
            View archived sessions →
          </Link>
        </div>
      </main>
    </div>
  );
}
