import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupabaseClient } from "@/lib/supabase";
import AdminList from "./admin-list";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const authSession = await getServerSession(authOptions);
  if (!authSession?.user?.email) redirect("/login");

  const userEmail = authSession.user.email;
  const supabaseCheck = getSupabaseClient();
  const { data: adminRow } = await supabaseCheck
    .from("admin_users")
    .select("email")
    .eq("email", userEmail)
    .maybeSingle();
  if (!adminRow) redirect("/ae/dashboard");

  const supabase = supabaseCheck;

  // Fetch ALL sessions across all AEs, sorted by AE then most-recent first
  const { data: sessions, error } = await supabase
    .from("sessions")
    .select("id, token, client_name, client_phone, vehicle_description, created_by, status, created_at")
    .order("created_by", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Admin: session fetch error", error.message);
  }

  const totalCount = sessions?.length ?? 0;
  const aeCount = new Set(sessions?.map((s) => s.created_by) ?? []).size;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b-2" style={{ borderColor: "#007BBA" }}>
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center gap-4">
            <Link
              href="/ae/dashboard"
              className="flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-gray-100"
              style={{ color: "#004876" }}
              aria-label="Back to dashboard"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
            </Link>
            <div className="flex flex-col justify-center">
              <Link href="/ae/dashboard">
                <img src="/images/WrapSnap_Logo_Horizontal_SM.jpg" alt="WrapSnap" className="h-10 w-auto object-contain cursor-pointer" />
              </Link>
              <p className="text-[11px] mt-0.5" style={{ color: "#004876" }}>Powered by Advertising Vehicles</p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Page header */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Admin — All Sessions</h1>
            <p className="mt-1 text-sm text-gray-500">
              {totalCount} session{totalCount !== 1 ? "s" : ""} across {aeCount} AE{aeCount !== 1 ? "s" : ""}
            </p>
          </div>
          <Link
            href="/ae/admin/users"
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200"
          >
            <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
            Manage Users
          </Link>
        </div>

        <AdminList sessions={sessions ?? []} />
      </main>
    </div>
  );
}
