import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupabaseClient } from "@/lib/supabase";
import CopyLink from "./copy-link";
import PinReveal from "./pin-reveal";
import AnnotatedPhoto, { type VinylZone } from "./annotated-photo";

export const dynamic = "force-dynamic";

type SessionStatus = "pending" | "active" | "complete" | "expired";

const STATUS_STYLES: Record<SessionStatus, string> = {
  pending:  "bg-gray-100 text-gray-600",
  active:   "bg-blue-100 text-blue-700",
  complete: "bg-green-100 text-green-700",
  expired:  "bg-red-100 text-red-700",
};

const PANELS = [
  { slug: "driver_side",    label: "Driver Side" },
  { slug: "passenger_side", label: "Passenger Side" },
  { slug: "front",          label: "Front" },
  { slug: "rear",           label: "Rear" },
];

function formatPhone(phone: string) {
  const d = phone.replace(/\D/g, "");
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 11 && d[0] === "1") return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  return phone;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

interface PanelEstimate {
  panel: string;
  name?: string;
  sqft: number;
  sqft_low: number;
  sqft_high: number;
  vinyl_zones?: VinylZone[];
}

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const authSession = await getServerSession(authOptions);
  if (!authSession?.user?.email) redirect("/login");
  const userEmail = authSession.user.email;

  const supabase = getSupabaseClient();

  // Fetch session — must be owned by this AE
  const { data: session, error } = await supabase
    .from("sessions")
    .select("id, token, client_name, client_phone, status, created_at, expires_at, created_by")
    .eq("id", id)
    .single();

  if (error || !session || session.created_by !== userEmail) notFound();

  // Fetch uploads
  const { data: uploads, error: uploadsError } = await supabase
    .from("uploads")
    .select("panel, storage_path")
    .eq("session_id", id);

  if (uploadsError) {
    console.error("Session detail: uploads query error", { id, message: uploadsError.message, uploadsError });
  }

  // Build signed URLs (1-hour expiry) for uploaded panels
  const uploadsBySlug: Record<string, string> = {};
  for (const upload of uploads ?? []) {
    const { data: signed, error: signedError } = await supabase.storage
      .from("vehicle-photos")
      .createSignedUrl(upload.storage_path, 3600);
    if (signedError) {
      console.error("Session detail: signed URL error", { storage_path: upload.storage_path, message: signedError.message, signedError });
    }
    if (signed?.signedUrl) {
      uploadsBySlug[upload.panel] = signed.signedUrl;
    }
  }

  console.log("Session detail: uploads found", { id, panels: Object.keys(uploadsBySlug) });

  // Fetch most recent estimate
  const { data: estimates } = await supabase
    .from("estimates")
    .select("vehicle_type, panels, total_sqft, sqft_low, sqft_high, confidence, confidence_note, created_at")
    .eq("session_id", id)
    .order("created_at", { ascending: false })
    .limit(1);

  const estimate = estimates?.[0] ?? null;

  // Build a map of panel slug → vinyl zones for annotation overlay
  const zonesByPanel: Record<string, VinylZone[]> = {};
  if (estimate && Array.isArray(estimate.panels)) {
    for (const p of estimate.panels as PanelEstimate[]) {
      const slug = p.panel ?? p.name;
      if (slug && Array.isArray(p.vinyl_zones)) {
        zonesByPanel[slug] = p.vinyl_zones;
      }
    }
  }

  const scanUrl = `https://wrapsnap.advertisingvehicles.com/scan/${session.token}`;
  const status = session.status as SessionStatus;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header style={{ backgroundColor: "#004876" }}>
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center gap-4">
            <Link
              href="/ae/dashboard"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white/70 transition hover:bg-white/10"
              aria-label="Back to dashboard"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
            </Link>
            <div className="flex flex-col justify-center">
              <Image
                src="/wrapsnap-logo.jpg"
                alt="WrapSnap"
                width={140}
                height={36}
                style={{ height: 36, width: "auto" }}
                priority
              />
              <p className="text-[11px] text-white/60 mt-0.5">Powered by Advertising Vehicles</p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">

        {/* Client info card */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">{session.client_name}</h1>
              <p className="mt-0.5 text-sm text-gray-500">{formatPhone(session.client_phone)}</p>
            </div>
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium capitalize ${STATUS_STYLES[status]}`}>
              {status}
            </span>
          </div>

          <dl className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 text-sm">
            <div>
              <dt className="font-medium text-gray-500">Created</dt>
              <dd className="mt-0.5 text-gray-900">{formatDateTime(session.created_at)}</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-500">Expires</dt>
              <dd className="mt-0.5 text-gray-900">{formatDateTime(session.expires_at)}</dd>
            </div>
          </dl>
        </div>

        {/* Scan link + PIN */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-5">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-1.5">Client scan link</p>
            <CopyLink url={scanUrl} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700 mb-1.5">PIN</p>
            <PinReveal />
          </div>
          <div className="pt-1 border-t border-gray-100">
            <p className="text-xs text-gray-400 mb-3">Scan the vehicle yourself without a PIN.</p>
            <Link
              href={`/scan/${session.token}?ae=1`}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2"
              style={{ backgroundColor: "#007BBA" }}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
              </svg>
              Scan this vehicle
            </Link>
          </div>
        </div>

        {/* Panel photos */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Panel Photos</h2>
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {PANELS.map(({ slug, label }) => {
              const signedUrl = uploadsBySlug[slug];
              return (
                <div key={slug}>
                  {signedUrl ? (
                    <AnnotatedPhoto
                      imageUrl={signedUrl}
                      zones={zonesByPanel[slug] ?? []}
                      panelLabel={label}
                    />
                  ) : (
                    <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-gray-100 border border-gray-200 flex flex-col items-center justify-center gap-2 p-4 text-center">
                      <svg className="h-7 w-7 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 3h18M3 3v18M3 3l18 18" />
                      </svg>
                      <p className="text-xs font-medium text-gray-400">{label}</p>
                      <p className="text-[10px] text-gray-300">Not yet uploaded</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Estimate */}
        {estimate ? (
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-gray-900">Estimate Results</h2>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                  estimate.confidence === "high"
                    ? "bg-green-100 text-green-700"
                    : estimate.confidence === "medium"
                    ? "bg-yellow-100 text-yellow-700"
                    : "bg-red-100 text-red-700"
                }`}
              >
                {estimate.confidence} confidence
              </span>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 text-sm">
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-gray-500 text-xs mb-0.5">Vehicle type</p>
                <p className="font-semibold text-gray-900 capitalize">
                  {estimate.vehicle_type?.replace(/_/g, " ") ?? "—"}
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-gray-500 text-xs mb-0.5">Total sq ft</p>
                <p className="font-semibold text-gray-900">
                  {estimate.total_sqft != null ? estimate.total_sqft.toFixed(1) : "—"}
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-gray-500 text-xs mb-0.5">Range</p>
                <p className="font-semibold text-gray-900">
                  {estimate.sqft_low != null && estimate.sqft_high != null
                    ? `${estimate.sqft_low.toFixed(1)} – ${estimate.sqft_high.toFixed(1)}`
                    : "—"}
                </p>
              </div>
            </div>

            {/* Per-panel breakdown */}
            {Array.isArray(estimate.panels) && estimate.panels.length > 0 && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Panel breakdown</p>
                <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 overflow-hidden text-sm">
                  {(estimate.panels as PanelEstimate[]).map((panel) => (
                    <div key={panel.panel ?? panel.name} className="flex items-center justify-between px-4 py-2.5 bg-white">
                      <span className="capitalize text-gray-700">{(panel.panel ?? panel.name)?.replace(/_/g, " ")}</span>
                      <span className="font-medium text-gray-900">
                        {panel.sqft != null ? `${panel.sqft.toFixed(1)} sq ft` : "—"}
                        {panel.sqft_low != null && panel.sqft_high != null && (
                          <span className="ml-1.5 text-xs text-gray-400">
                            ({panel.sqft_low.toFixed(1)}–{panel.sqft_high.toFixed(1)})
                          </span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Confidence note */}
            {estimate.confidence_note && (
              <p className="text-xs text-gray-500 leading-relaxed">{estimate.confidence_note}</p>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center">
            <svg className="h-8 w-8 text-gray-300 mx-auto mb-2" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm font-medium text-gray-500">Estimate pending</p>
            <p className="text-xs text-gray-400 mt-0.5">Waiting for client to complete photo upload</p>
          </div>
        )}
      </main>
    </div>
  );
}
