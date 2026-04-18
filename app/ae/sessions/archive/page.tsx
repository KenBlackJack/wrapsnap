import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupabaseClient } from "@/lib/supabase";
import ArchiveList from "./archive-list";

export const dynamic = "force-dynamic";

export default async function ArchivePage() {
  const authSession = await getServerSession(authOptions);
  if (!authSession?.user?.email) redirect("/login");
  const userEmail = authSession.user.email;

  const { data: sessions } = await getSupabaseClient()
    .from("sessions")
    .select("id, client_name, vehicle_description, status, created_at")
    .eq("created_by", userEmail)
    .eq("status", "archived")
    .order("created_at", { ascending: false });

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
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Archived Sessions</h1>
          <p className="mt-1 text-sm text-gray-500">
            Sessions are automatically archived after 30 days.
          </p>
        </div>

        <ArchiveList sessions={sessions ?? []} />
      </main>
    </div>
  );
}
