import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupabaseClient } from "@/lib/supabase";
import SignOutButton from "./sign-out-button";
import ScanButton from "./scan-button";

export const dynamic = "force-dynamic";

type SessionStatus = "pending" | "active" | "complete" | "expired";

interface WrapSession {
  id: string;
  client_name: string;
  client_phone: string;
  status: SessionStatus;
  created_at: string;
}

const STATUS_STYLES: Record<SessionStatus, string> = {
  pending:  "bg-gray-100 text-gray-600",
  active:   "bg-blue-100 text-blue-700",
  complete: "bg-green-100 text-green-700",
  expired:  "bg-red-100 text-red-700",
};

function StatusPill({ status }: { status: SessionStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[status]}`}>
      {status}
    </span>
  );
}

function formatPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  const userEmail = session.user.email ?? "";
  const userName = session.user.name ?? (userEmail || "AE");

  const { data: wrapSessions } = await getSupabaseClient()
    .from("sessions")
    .select("id, client_name, client_phone, status, created_at")
    .eq("created_by", userEmail)
    .order("created_at", { ascending: false });

  const sessions: WrapSession[] = wrapSessions ?? [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: "#007BBA" }}>
                <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8.25V18a2.25 2.25 0 002.25 2.25h13.5A2.25 2.25 0 0021 18V8.25m-18 0V6a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 6v2.25m-18 0h18M12 12.75h.008v.008H12v-.008z" />
                </svg>
              </div>
              <div className="leading-tight">
                <p className="text-lg font-bold tracking-tight text-gray-900">WrapSnap</p>
                <p className="text-[11px] font-medium" style={{ color: "#007BBA" }}>by Advertising Vehicles</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="hidden text-sm text-gray-600 sm:block">{userName}</span>
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
            className="flex flex-col items-start gap-3 rounded-xl p-5 text-left transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2"
            style={{ backgroundColor: "#28A745" }}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/20">
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-white">Invite a Client</p>
              <p className="mt-0.5 text-sm text-white/70">Send a scan link — client does it themselves</p>
            </div>
          </Link>
        </div>

        {/* Recent sessions */}
        <h2 className="mb-4 text-base font-semibold text-gray-900">Recent Sessions</h2>

        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white py-20 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
              <svg className="h-7 w-7 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-900">No sessions yet</p>
            <p className="mt-1 text-sm text-gray-500">Create your first session to get started.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {sessions.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-medium text-gray-900">{s.client_name}</p>
                    <StatusPill status={s.status} />
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-gray-500">
                    <span>{formatPhone(s.client_phone)}</span>
                    <span>{formatDate(s.created_at)}</span>
                  </div>
                </div>
                <Link
                  href={`/ae/sessions/${s.id}`}
                  className="shrink-0 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-1"
                >
                  View
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
