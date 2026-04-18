import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupabaseClient } from "@/lib/supabase";
import CopyLink from "./copy-link";
import PinReveal from "./pin-reveal";
import AnnotatedPhoto, { type VinylZone } from "./annotated-photo";
import PdfButtonWrapper from "./pdf-button-wrapper";

export const dynamic = "force-dynamic";

type SessionStatus = "pending" | "active" | "complete" | "expired" | "archived";

const STATUS_STYLES: Record<SessionStatus, string> = {
  pending:  "bg-gray-100 text-gray-600",
  active:   "bg-blue-100 text-blue-700",
  complete: "bg-green-100 text-green-700",
  expired:  "bg-red-100 text-red-700",
  archived: "bg-gray-100 text-gray-500",
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

interface VinylZoneEstimate {
  type: "printed_wrap" | "cut_vinyl" | "review";
  name?: string;
  sqft: number;
  sqft_low: number;
  sqft_high: number;
}

interface PanelEstimate {
  panel: string;
  name?: string;
  coverage_type?: string;
  panel_sqft?: number;
  panel_sqft_low?: number;
  panel_sqft_high?: number;
  // legacy field names (kept for backwards compat with old estimates)
  sqft?: number;
  sqft_low?: number;
  sqft_high?: number;
  vinyl_zones?: VinylZoneEstimate[];
  // annotated photo zones (separate type used by canvas overlay)
  _vinyl_zones_raw?: VinylZone[];
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
    .select("id, token, client_name, client_phone, vehicle_description, status, created_at, expires_at, created_by")
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

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const isOldSession = new Date(session.created_at) < thirtyDaysAgo;
  const canArchive = isOldSession && status !== "archived";

  async function archiveSession() {
    "use server";
    const supabaseServer = getSupabaseClient();
    await supabaseServer
      .from("sessions")
      .update({ status: "archived" })
      .eq("id", id);
    redirect("/ae/dashboard");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b-2" style={{ borderColor: "#007BBA" }}>
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
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
              <Image
                src="/images/WrapSnap_Logo_Horizontal_SM.jpg"
                alt="WrapSnap"
                width={108}
                height={36}
                style={{ height: 36, width: "auto", mixBlendMode: "multiply" }}
                priority
              />
              <p className="text-[11px] mt-0.5" style={{ color: "#004876" }}>Powered by Advertising Vehicles</p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">

        {/* Client info card */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{session.client_name}</h1>
              {session.vehicle_description && (
                <p className="mt-0.5 text-sm text-gray-500">{session.vehicle_description}</p>
              )}
              <p className="mt-0.5 text-sm text-gray-400">{formatPhone(session.client_phone)}</p>
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

          {/* Archive button — only for sessions older than 30 days */}
          {canArchive && (
            <div className="mt-5 pt-5 border-t border-gray-100">
              <form action={archiveSession}>
                <button
                  type="submit"
                  className="text-sm text-gray-400 hover:text-gray-600 transition underline underline-offset-2"
                >
                  Archive this session
                </button>
              </form>
            </div>
          )}
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
              <div className="flex items-center gap-2 flex-wrap">
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
                <PdfButtonWrapper
                  clientName={session.client_name}
                  vehicleDescription={session.vehicle_description}
                  vehicleType={estimate.vehicle_type}
                  sessionDate={session.created_at}
                  totalSqft={estimate.total_sqft}
                  sqftLow={estimate.sqft_low}
                  sqftHigh={estimate.sqft_high}
                  confidence={estimate.confidence}
                  confidenceNote={estimate.confidence_note}
                  panels={(estimate.panels as import("@/components/EstimatePDF").PanelPDF[]) ?? []}
                />
              </div>
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
                <div className="rounded-lg border border-gray-200 overflow-hidden text-sm divide-y divide-gray-100">
                  {(estimate.panels as PanelEstimate[]).map((panel) => {
                    const slug = panel.panel ?? panel.name ?? "unknown";
                    const label = slug.replace(/_/g, " ");
                    // Support both new (panel_sqft) and old (sqft) field names
                    const totalSqft = panel.panel_sqft ?? panel.sqft;
                    const lowSqft   = panel.panel_sqft_low  ?? panel.sqft_low;
                    const highSqft  = panel.panel_sqft_high ?? panel.sqft_high;
                    const zones     = panel.vinyl_zones ?? [];

                    return (
                      <div key={slug} className="bg-white">
                        {/* Panel header row */}
                        <div className="flex items-center justify-between px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="capitalize font-medium text-gray-900">{label}</span>
                            {panel.coverage_type && panel.coverage_type !== "none" && (
                              <span className="rounded-full px-2 py-0.5 text-[10px] font-medium bg-blue-50 text-blue-700 capitalize">
                                {panel.coverage_type.replace(/_/g, " ")}
                              </span>
                            )}
                          </div>
                          <span className="font-semibold text-gray-900 shrink-0">
                            {totalSqft != null ? `${totalSqft.toFixed(1)} sq ft` : "—"}
                            {lowSqft != null && highSqft != null && (
                              <span className="ml-1.5 text-xs font-normal text-gray-400">
                                ({lowSqft.toFixed(1)}–{highSqft.toFixed(1)})
                              </span>
                            )}
                          </span>
                        </div>

                        {/* Zone rows */}
                        {zones.length > 0 && (
                          <div className="border-t border-gray-50 bg-gray-50 divide-y divide-gray-100">
                            {zones.map((zone, zi) => (
                              <div key={zi} className="flex items-center justify-between px-4 py-1.5 pl-7">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span
                                    className="shrink-0 h-2 w-2 rounded-sm"
                                    style={{
                                      background:
                                        zone.type === "printed_wrap" ? "#3b82f6"
                                        : zone.type === "cut_vinyl"  ? "#ef4444"
                                        : "#eab308",
                                    }}
                                  />
                                  <span className="text-gray-600 text-xs truncate">
                                    {zone.name ?? zone.type.replace(/_/g, " ")}
                                  </span>
                                </div>
                                <span className="text-gray-700 text-xs shrink-0 ml-3">
                                  {zone.sqft != null ? `${zone.sqft.toFixed(1)} sq ft` : "—"}
                                  {zone.sqft_low != null && zone.sqft_high != null && (
                                    <span className="ml-1 text-gray-400">
                                      ({zone.sqft_low.toFixed(1)}–{zone.sqft_high.toFixed(1)})
                                    </span>
                                  )}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Confidence note — always visible in gray box */}
            <div className="rounded-lg bg-gray-50 border border-gray-100 px-4 py-3">
              <p className="text-xs font-medium text-gray-500 mb-0.5">Notes</p>
              <p className="text-xs text-gray-600 leading-relaxed">
                {estimate.confidence_note ?? "No additional notes."}
              </p>
            </div>
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
