import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupabaseClient } from "@/lib/supabase";
import AdminList from "./admin-list";

export const dynamic = "force-dynamic";

const ADMIN_DOMAINS = ["@advertisingvehicles.com", "@est03.com"];

export default async function AdminPage() {
  const authSession = await getServerSession(authOptions);
  if (!authSession?.user?.email) redirect("/login");

  const userEmail = authSession.user.email;
  const isAdmin = ADMIN_DOMAINS.some((d) => userEmail.endsWith(d));
  if (!isAdmin) redirect("/ae/dashboard");

  const supabase = getSupabaseClient();

  // Fetch ALL sessions across all AEs, sorted by AE then most-recent first
  const { data: sessions, error } = await supabase
    .from("sessions")
    .select("id, client_name, vehicle_description, created_by, status, created_at")
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
              <img src="/images/WrapSnap_Logo_Print_SM.jpg" alt="WrapSnap" className="h-10 w-auto object-contain" />
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
        </div>

        <AdminList sessions={sessions ?? []} />
      </main>
    </div>
  );
}
