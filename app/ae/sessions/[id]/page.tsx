import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupabaseClient } from "@/lib/supabase";
import CopyLink from "./copy-link";
import PinReveal from "./pin-reveal";
import PdfButtonWrapper from "./pdf-button-wrapper";
import PhotoGrid from "./photo-grid";
import type { PhotoPanel } from "./photo-grid";
import ProcessingPoller from "./processing-poller";
import type {
  Artboard1Data,
  Artboard2Data,
  Artboard3Data,
} from "@/components/EstimatePDF";
import type { GroupBBox } from "./annotated-photo";

export const dynamic = "force-dynamic";

type SessionStatus = "pending" | "active" | "complete" | "expired" | "archived" | "processing";

const STATUS_STYLES: Record<SessionStatus, string> = {
  pending:    "bg-gray-100 text-gray-600",
  active:     "bg-blue-100 text-blue-700",
  complete:   "bg-green-100 text-green-700",
  expired:    "bg-red-100 text-red-700",
  archived:   "bg-gray-100 text-gray-500",
  processing: "bg-purple-100 text-purple-700",
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

interface EstimateArtboards {
  artboard1?: Artboard1Data | null;
  artboard2?: Artboard2Data | null;
  artboard3?: Artboard3Data | null;
  groups_bbox?: GroupBBox[] | null;
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

  const { data: session, error } = await supabase
    .from("sessions")
    .select("id, token, client_name, client_phone, vehicle_description, status, created_at, created_by")
    .eq("id", id)
    .single();

  if (error || !session || session.created_by !== userEmail) notFound();

  const { data: uploads, error: uploadsError } = await supabase
    .from("uploads")
    .select("panel, storage_path")
    .eq("session_id", id);

  if (uploadsError) {
    console.error("Session detail: uploads query error", { id, message: uploadsError.message, uploadsError });
  }

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

  const { data: estimates } = await supabase
    .from("estimates")
    .select("vehicle_type, panels, total_sqft, sqft_low, sqft_high, confidence, confidence_note, created_at")
    .eq("session_id", id)
    .order("created_at", { ascending: false })
    .limit(1);

  const estimate = estimates?.[0] ?? null;

  // Extract artboard data — new estimates store {artboard1, artboard2, artboard3}
  let artboards: EstimateArtboards | null = null;
  if (estimate?.panels && !Array.isArray(estimate.panels)) {
    artboards = estimate.panels as EstimateArtboards;
  }

  const scanUrl = `https://wrapsnap.advertisingvehicles.com/scan/${session.token}`;
  const status = session.status as SessionStatus;

  const phone = (session.client_phone ?? "").trim();
  const isSelfScan = !phone || phone === "0000000000";

  const canArchive = status !== "archived";

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
              <Link href="/ae/dashboard">
                <img src="/images/WrapSnap_Logo_Horizontal_SM.jpg" alt="WrapSnap" className="h-10 w-auto object-contain cursor-pointer" />
              </Link>
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
              {!isSelfScan && (
                <p className="mt-0.5 text-sm text-gray-400">{formatPhone(session.client_phone)}</p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              {isSelfScan && status === "pending" ? (
                <span className="inline-flex items-center rounded-full px-3 py-1 text-sm font-medium bg-yellow-100 text-yellow-700">
                  In Progress
                </span>
              ) : (
                <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium capitalize ${STATUS_STYLES[status]}`}>
                  {status}
                </span>
              )}
              {canArchive && (
                <form action={archiveSession}>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1 text-sm text-gray-500 transition hover:bg-gray-50 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-200"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                    </svg>
                    Archive
                  </button>
                </form>
              )}
            </div>
          </div>

          <dl className="mt-5 text-sm">
            <div>
              <dt className="font-medium text-gray-500">Created</dt>
              <dd className="mt-0.5 text-gray-900">{formatDateTime(session.created_at)}</dd>
            </div>
          </dl>
        </div>

        {/* Resume Scan — for interrupted self-scan sessions */}
        {isSelfScan && status === "pending" && (
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-gray-500 mb-4">
              This scan was started but not finished. Jump back in to complete it.
            </p>
            <Link
              href={`/scan/${session.token}?ae=1`}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2"
              style={{ backgroundColor: "#007BBA" }}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
              </svg>
              Resume Scan
            </Link>
          </div>
        )}

        {/* Scan link + PIN */}
        {status === "pending" && !isSelfScan && (
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
        )}

        {/* Panel photos */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Panel Photos</h2>
          <PhotoGrid
            panels={PANELS.map(({ slug, label }): PhotoPanel => ({
              slug,
              label,
              imageUrl: uploadsBySlug[slug] ?? null,
              groupsBbox: (artboards?.groups_bbox ?? []).filter((g) => g.panel === slug),
            }))}
          />
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
                  confidence={estimate.confidence}
                  confidenceNote={estimate.confidence_note}
                  artboard1={artboards?.artboard1 ?? null}
                  artboard2={artboards?.artboard2 ?? null}
                  artboard3={artboards?.artboard3 ?? null}
                  photosByPanel={Object.keys(uploadsBySlug).length > 0 ? uploadsBySlug : null}
                />
              </div>
            </div>

            {/* Summary bar — vehicle type + three artboard numbers + total */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-sm">
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-gray-500 text-xs mb-0.5">Vehicle type</p>
                <p className="font-semibold text-gray-900 capitalize">
                  {estimate.vehicle_type?.replace(/_/g, " ") ?? "—"}
                </p>
              </div>
              <div className="rounded-lg p-3" style={{ backgroundColor: "#EFF6FF" }}>
                <p className="text-xs mb-0.5" style={{ color: "#3B82F6" }}>Cut Vinyl</p>
                <p className="font-semibold" style={{ color: "#1D4ED8" }}>
                  {artboards?.artboard1?.sqft != null
                    ? `${artboards.artboard1.sqft.toFixed(1)} sq ft`
                    : "—"}
                </p>
              </div>
              <div className="rounded-lg p-3" style={{ backgroundColor: "#FFF7ED" }}>
                <p className="text-xs mb-0.5" style={{ color: "#EA580C" }}>Printed Vinyl</p>
                <p className="font-semibold" style={{ color: "#C2410C" }}>
                  {artboards?.artboard3?.total_sqft != null
                    ? `${artboards.artboard3.total_sqft.toFixed(1)} sq ft`
                    : "—"}
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-gray-500 text-xs mb-0.5">Total sq ft</p>
                <p className="font-semibold" style={{ color: "#007BBA" }}>
                  {estimate.total_sqft != null ? estimate.total_sqft.toFixed(1) : "—"}
                </p>
              </div>
            </div>

            {/* Artboard 1 — Cut Vinyl with Premask */}
            {artboards?.artboard1 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-gray-700">
                    Artboard 1 — Cut Vinyl with Premask
                  </p>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: "#EFF6FF", color: "#1D4ED8" }}>
                    {artboards.artboard1.sqft != null ? `${artboards.artboard1.sqft.toFixed(1)} sq ft` : "—"}
                  </span>
                </div>
                <div className="rounded-lg border border-gray-200 overflow-hidden text-sm divide-y divide-gray-100">
                  {/* Artboard dimension header */}
                  <div className="flex items-center justify-between px-4 py-2 bg-blue-50">
                    <span className="text-xs font-medium text-blue-700">
                      3M 180CV3 — 52" × {artboards.artboard1.artboard_height_in ?? "?"}″ artboard
                    </span>
                    <span className="text-xs text-blue-500">premask holds all groups</span>
                  </div>
                  {(artboards.artboard1.groups ?? []).map((group, gi) => (
                    <div key={gi} className="bg-white">
                      <div className="flex items-start justify-between px-4 py-2.5">
                        <div className="min-w-0 flex-1 pr-3">
                          <p className="font-medium text-gray-900 text-sm">{group.name}</p>
                          {group.items && group.items.length > 0 && (
                            <p className="text-xs text-gray-400 mt-0.5">{group.items.join(", ")}</p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          {group.width_in != null && group.height_in != null && (
                            <p className="text-xs font-medium text-gray-700">
                              {group.width_in}" × {group.height_in}"
                            </p>
                          )}
                          {group.can_rotate && (
                            <p className="text-[10px] text-gray-400">can rotate 90°</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {(artboards.artboard1.groups ?? []).length === 0 && (
                    <div className="px-4 py-3 text-sm text-gray-400">No cut vinyl groups</div>
                  )}
                </div>
              </div>
            )}

            {/* Artboard 2 — Large Cut Panels */}
            {artboards?.artboard2 && (artboards.artboard2.panels ?? []).length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-gray-700">
                    Artboard 2 — Large Cut Panels
                  </p>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: "#F0FDF4", color: "#15803D" }}>
                    {artboards.artboard2.total_sqft != null ? `${artboards.artboard2.total_sqft.toFixed(1)} sq ft` : "—"}
                  </span>
                </div>
                <div className="rounded-lg border border-gray-200 overflow-hidden text-sm divide-y divide-gray-100">
                  <div className="flex items-center px-4 py-2 bg-green-50">
                    <span className="text-xs font-medium text-green-700">Single-color solid shapes — no gradients</span>
                  </div>
                  {(artboards.artboard2.panels ?? []).map((panel, pi) => (
                    <div key={pi} className="flex items-center justify-between px-4 py-2.5 bg-white">
                      <p className="font-medium text-gray-900 text-sm">{panel.name}</p>
                      <div className="text-right shrink-0 ml-3">
                        {panel.width_in != null && panel.height_in != null && (
                          <p className="text-xs font-medium text-gray-700">
                            {panel.width_in}" × {panel.height_in}"
                            {(panel.quantity ?? 1) > 1 && ` × ${panel.quantity}`}
                          </p>
                        )}
                        {panel.sqft != null && (
                          <p className="text-xs text-green-700 font-semibold">{panel.sqft.toFixed(1)} sq ft</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Artboard 3 — Printed Vinyl */}
            {artboards?.artboard3 && (artboards.artboard3.panels ?? []).length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-gray-700">
                    Artboard 3 — Printed Vinyl
                  </p>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: "#FFF7ED", color: "#C2410C" }}>
                    {artboards.artboard3.total_sqft != null ? `${artboards.artboard3.total_sqft.toFixed(1)} sq ft` : "—"}
                  </span>
                </div>
                <div className="rounded-lg border border-gray-200 overflow-hidden text-sm divide-y divide-gray-100">
                  <div className="flex items-center px-4 py-2 bg-orange-50">
                    <span className="text-xs font-medium text-orange-700">52"-wide strips · full panel rectangles · includes area under cut vinyl</span>
                  </div>
                  {(artboards.artboard3.panels ?? []).map((panel, pi) => {
                    const graphicSqft = panel.panel_sqft ?? panel.total_sqft;
                    return (
                      <div key={pi} className="flex items-center justify-between px-4 py-2.5 bg-white">
                        <div className="min-w-0 flex-1 pr-3">
                          <p className="font-medium text-gray-900 text-sm">{panel.name}</p>
                          {panel.panel_width_in != null && panel.panel_height_in != null && (
                            <p className="text-xs text-gray-400 mt-0.5">
                              {panel.panel_width_in}" × {panel.panel_height_in}"
                              {panel.strips_needed != null && ` · ${panel.strips_needed} strip${panel.strips_needed !== 1 ? "s" : ""}`}
                            </p>
                          )}
                          {panel.material_sqft != null && (
                            <p className="text-xs text-gray-400">
                              material: {panel.material_sqft.toFixed(1)} sq ft
                            </p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          {graphicSqft != null && (
                            <p className="text-xs font-semibold" style={{ color: "#C2410C" }}>{graphicSqft.toFixed(1)} sq ft</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Confidence note */}
            <div className="rounded-lg bg-gray-50 border border-gray-100 px-4 py-3">
              <p className="text-xs font-medium text-gray-500 mb-0.5">Notes</p>
              <p className="text-xs text-gray-600 leading-relaxed">
                {estimate.confidence_note ?? "No additional notes."}
              </p>
            </div>
          </div>
        ) : status === "processing" ? (
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                   style={{ backgroundColor: "#EBF5FB" }}>
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24"
                     style={{ color: "#007BBA" }}>
                  <circle className="opacity-25" cx="12" cy="12" r="10"
                          stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor"
                        d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Estimate in progress…</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Claude is measuring the vehicle. This page will update automatically when ready.
                </p>
              </div>
            </div>
            <div className="flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-1.5 flex-1 rounded-full animate-pulse"
                  style={{
                    backgroundColor: "#007BBA",
                    opacity: 0.3 + i * 0.3,
                    animationDelay: `${i * 0.2}s`,
                  }}
                />
              ))}
            </div>
            <ProcessingPoller sessionId={session.id} />
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
