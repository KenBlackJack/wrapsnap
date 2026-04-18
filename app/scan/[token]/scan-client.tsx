"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────

type AppState = "pin-entry" | "instructions" | "capture" | "submission" | "complete";

const PANELS = ["Driver Side", "Passenger Side", "Front", "Rear"] as const;
type PanelName = (typeof PANELS)[number];

interface CapturedPhoto {
  panel: PanelName;
  preview: string;
  file: File;
}

// ─── Shared logo ─────────────────────────────────────────────────────────────

function Logo({ size = "large" }: { size?: "large" | "small" | "capture" }) {
  if (size === "large") {
    return (
      <div className="flex flex-col items-center mb-6">
        <img src="/images/WrapSnap_Logo_Horizontal_SM.jpg" alt="WrapSnap" className="h-12 w-auto object-contain" />
        <p className="mt-1.5 text-xs text-gray-400">by Advertising Vehicles</p>
      </div>
    );
  }
  return (
    <img
      src="/images/WrapSnap_Logo_Horizontal_SM.jpg"
      alt="WrapSnap"
      className={size === "small" ? "h-8 w-auto object-contain" : "h-10 w-auto object-contain"}
    />
  );
}

// ─── AVI blue button ──────────────────────────────────────────────────────────

function PrimaryButton({
  children,
  onClick,
  disabled,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-xl py-3.5 text-base font-semibold text-white transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50"
      style={{ backgroundColor: "#007BBA" }}
    >
      {children}
    </button>
  );
}

// ─── STATE 1: PIN entry ───────────────────────────────────────────────────────

function PinEntry({
  token,
  onSuccess,
}: {
  token: string;
  onSuccess: () => void;
}) {
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  function handleChange(i: number, e: React.ChangeEvent<HTMLInputElement>) {
    const char = e.target.value.replace(/\D/g, "").slice(-1);
    const next = pin.slice(0, i) + char + pin.slice(i + 1);
    setPin(next);
    setError(null);
    if (char && i < 5) inputs.current[i + 1]?.focus();
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !pin[i] && i > 0) {
      setPin(pin.slice(0, i - 1) + pin.slice(i));
      inputs.current[i - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted) {
      setPin(pasted);
      inputs.current[Math.min(pasted.length - 1, 5)]?.focus();
      e.preventDefault();
    }
  }

  async function handleSubmit() {
    if (pin.length < 6) {
      setError("Please enter all 6 digits.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, pin }),
      });
      if (res.status === 401) {
        setError("Incorrect PIN. Please try again.");
        return;
      }
      if (res.status === 410) {
        setError("This session has expired. Please contact your representative.");
        return;
      }
      if (!res.ok) {
        setError("Incorrect PIN or expired session.");
        return;
      }
      onSuccess();
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <Logo />
        <h1 className="text-2xl font-semibold text-gray-900 text-center mb-2">
          Enter your PIN
        </h1>
        <p className="text-sm text-gray-500 text-center mb-8">
          Your Account Executive sent this link with a 6-digit PIN.
        </p>

        <div className="flex gap-2.5 justify-center mb-6" onPaste={handlePaste}>
          {Array.from({ length: 6 }).map((_, i) => (
            <input
              key={i}
              ref={(el) => { inputs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={2}
              value={pin[i] ?? ""}
              onChange={(e) => handleChange(i, e)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              autoComplete={i === 0 ? "one-time-code" : "off"}
              className="w-11 h-14 rounded-xl border-2 border-gray-200 text-center text-2xl font-bold text-gray-900 focus:outline-none transition-colors"
              style={{
                caretColor: "transparent",
                borderColor: pin[i] ? "#007BBA" : undefined,
              }}
            />
          ))}
        </div>

        {error && (
          <p className="text-sm text-red-600 text-center mb-4">{error}</p>
        )}

        <PrimaryButton onClick={handleSubmit} disabled={loading}>
          {loading ? "Checking…" : "Continue"}
        </PrimaryButton>
      </div>
    </div>
  );
}

// ─── STATE 2: Instructions ────────────────────────────────────────────────────

const INSTRUCTIONS = [
  {
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
      </svg>
    ),
    title: "Place TWO reference cards",
    body: "Place one magnetic WrapSnap card near the front of the panel and one near the rear — both flat on the vehicle surface.",
  },
  {
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
      </svg>
    ),
    title: "Step back",
    body: "Capture the entire vehicle panel from the most straight-on angle possible. Do not zoom in. Do not crop the vehicle. Both reference cards must be fully visible in the frame.",
  },
  {
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
      </svg>
    ),
    title: "Take the photo",
    body: "Tap the camera button to photograph each side of the vehicle. We'll guide you panel by panel.",
  },
];

function Instructions({ onReady, onBack }: { onReady: () => void; onBack?: () => void }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="w-full max-w-sm mx-auto flex flex-col flex-1 px-5 pt-5 pb-24">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-4">
          <Logo size="small" />
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-700 transition"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
              Back
            </button>
          )}
        </div>

        <h1 className="text-xl font-semibold text-gray-900 text-center mb-0.5">
          Before you start
        </h1>
        <p className="text-xs text-gray-500 text-center mb-4">
          Follow these steps for the most accurate estimate.
        </p>

        <div className="space-y-2">
          {INSTRUCTIONS.map((step, i) => (
            <div key={i} className="flex gap-3 rounded-xl bg-white border border-gray-200 p-3 shadow-sm">
              <div
                className="shrink-0 flex h-9 w-9 items-center justify-center rounded-lg"
                style={{ backgroundColor: "#EBF5FB", color: "#007BBA" }}
              >
                {/* Smaller icon: clone with h-5 w-5 */}
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                  {i === 0 && <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />}
                  {i === 1 && <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />}
                  {i === 2 && <>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                  </>}
                </svg>
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 text-sm leading-tight">{step.title}</p>
                <p className="text-xs text-gray-500 mt-0.5 leading-snug">{step.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Fixed CTA — always above the fold */}
      <div className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 px-5 py-4 safe-area-pb">
        <div className="w-full max-w-sm mx-auto">
          <PrimaryButton onClick={onReady}>I&apos;m ready</PrimaryButton>
        </div>
      </div>
    </div>
  );
}

// ─── Vehicle diagram SVGs — one per panel ────────────────────────────────────

const HI      = "#007BBA";
const HI_FILL = "#dbeafe";
const BODY_C  = "#374151";
const DIM     = "#9ca3af";

// Side profile (driver side faces right; passenger side is mirrored)
function VehicleDiagramSide({ mirrored }: { mirrored: boolean }) {
  const cabPath   = "M 12 122 L 12 90 L 20 78 L 56 78 L 72 22 L 92 22 L 92 122 Z";
  const glassPath = "M 22 76 L 58 76 L 72 26 L 90 26 L 90 60 L 36 76 Z";
  const label     = mirrored ? "PASSENGER SIDE" : "DRIVER SIDE";
  return (
    <svg
      viewBox="0 0 310 175"
      className="w-full max-w-[280px] mx-auto"
      style={mirrored ? { transform: "scaleX(-1)" } : undefined}
      aria-hidden="true"
    >
      {/* Wheels */}
      <circle cx="50"  cy="142" r="17" fill="#1f2937" />
      <circle cx="50"  cy="142" r="10" fill="#374151" />
      <circle cx="50"  cy="142" r="3.5" fill={DIM} />
      <circle cx="228" cy="142" r="17" fill="#1f2937" />
      <circle cx="228" cy="142" r="10" fill="#374151" />
      <circle cx="228" cy="142" r="3.5" fill={DIM} />
      {/* Cargo highlight */}
      <rect x="92" y="22" width="156" height="100" fill={HI_FILL} />
      {/* Cargo body */}
      <rect x="92" y="22" width="186" height="100" rx="2" fill="white" stroke={HI} strokeWidth="2.5" />
      {/* Rear door split */}
      <line x1="248" y1="22" x2="248" y2="122" stroke={DIM} strokeWidth="1" strokeDasharray="4 3" />
      <circle cx="254" cy="72" r="2" fill={DIM} />
      {/* Cargo centre line */}
      <line x1="92" y1="72" x2="248" y2="72" stroke="#e5e7eb" strokeWidth="1" strokeDasharray="5 4" />
      {/* Cab */}
      <path d={cabPath} fill="white" stroke={BODY_C} strokeWidth="1.5" strokeLinejoin="round" />
      <path d={glassPath} fill="#bfdbfe" opacity="0.55" stroke="#93c5fd" strokeWidth="0.8" />
      <rect x="13" y="44" width="13" height="20" rx="2" fill="#bfdbfe" opacity="0.55" stroke="#93c5fd" strokeWidth="0.8" />
      <rect x="14" y="82" width="7" height="2.5" rx="1.5" fill={DIM} />
      {/* Wheel wells */}
      <path d="M 26 122 Q 26 104 50 104 Q 74 104 74 122" fill="white" stroke={BODY_C} strokeWidth="1.5" />
      <path d="M 204 122 Q 204 104 228 104 Q 252 104 252 122" fill="white" stroke={BODY_C} strokeWidth="1.5" />
      {/* Ground */}
      <line x1="4" y1="159" x2="306" y2="159" stroke="#e5e7eb" strokeWidth="1.5" />
      {/* Label (un-mirror it so text reads correctly) */}
      <text
        x="185" y="13"
        textAnchor="middle" fontSize="7.5" fontWeight="700" letterSpacing="0.6"
        fill={HI} fontFamily="system-ui,sans-serif"
        style={mirrored ? { transform: "scaleX(-1)", transformOrigin: "185px 13px" } : undefined}
      >{label}</text>
    </svg>
  );
}

// Front-facing view
function VehicleDiagramFront() {
  return (
    <svg viewBox="0 0 220 175" className="w-full max-w-[220px] mx-auto" aria-hidden="true">
      {/* Ground */}
      <line x1="4" y1="165" x2="216" y2="165" stroke="#e5e7eb" strokeWidth="1.5" />
      {/* Wheels (ellipses, front view) */}
      <ellipse cx="42" cy="155" rx="28" ry="11" fill="#1f2937" />
      <ellipse cx="42" cy="155" rx="17" ry="6.5" fill="#374151" />
      <ellipse cx="178" cy="155" rx="28" ry="11" fill="#1f2937" />
      <ellipse cx="178" cy="155" rx="17" ry="6.5" fill="#374151" />
      {/* Front face highlight */}
      <rect x="58" y="22" width="104" height="122" rx="5" fill={HI_FILL} stroke={HI} strokeWidth="2.5" />
      {/* Windshield */}
      <rect x="67" y="28" width="86" height="56" rx="3" fill="#bfdbfe" opacity="0.75" stroke="#93c5fd" strokeWidth="1" />
      {/* A-pillars */}
      <rect x="58" y="28" width="10" height="56" rx="2" fill="white" stroke={HI} strokeWidth="1.5" />
      <rect x="152" y="28" width="10" height="56" rx="2" fill="white" stroke={HI} strokeWidth="1.5" />
      {/* Headlights */}
      <rect x="60" y="106" width="26" height="14" rx="2" fill="#fef3c7" stroke="#d97706" strokeWidth="1" />
      <rect x="134" y="106" width="26" height="14" rx="2" fill="#fef3c7" stroke="#d97706" strokeWidth="1" />
      {/* Grille */}
      <rect x="88" y="103" width="44" height="28" rx="3" fill="#111827" />
      <line x1="88" y1="112" x2="132" y2="112" stroke="#374151" strokeWidth="1" />
      <line x1="88" y1="121" x2="132" y2="121" stroke="#374151" strokeWidth="1" />
      {/* Bumper */}
      <rect x="54" y="138" width="112" height="8" rx="3" fill={DIM} />
      {/* Label */}
      <text x="110" y="14" textAnchor="middle" fontSize="8" fontWeight="700" letterSpacing="0.6" fill={HI} fontFamily="system-ui,sans-serif">FRONT</text>
    </svg>
  );
}

// Rear-facing view
function VehicleDiagramRear() {
  return (
    <svg viewBox="0 0 220 175" className="w-full max-w-[220px] mx-auto" aria-hidden="true">
      {/* Ground */}
      <line x1="4" y1="165" x2="216" y2="165" stroke="#e5e7eb" strokeWidth="1.5" />
      {/* Wheels */}
      <ellipse cx="42" cy="155" rx="28" ry="11" fill="#1f2937" />
      <ellipse cx="42" cy="155" rx="17" ry="6.5" fill="#374151" />
      <ellipse cx="178" cy="155" rx="28" ry="11" fill="#1f2937" />
      <ellipse cx="178" cy="155" rx="17" ry="6.5" fill="#374151" />
      {/* Rear doors highlight */}
      <rect x="46" y="18" width="128" height="126" rx="5" fill={HI_FILL} stroke={HI} strokeWidth="2.5" />
      {/* Center split */}
      <line x1="110" y1="18" x2="110" y2="144" stroke={HI} strokeWidth="2" strokeDasharray="6 3" />
      {/* Taillights */}
      <rect x="48" y="26" width="22" height="36" rx="2" fill="#fca5a5" opacity="0.85" stroke="#ef4444" strokeWidth="1" />
      <rect x="150" y="26" width="22" height="36" rx="2" fill="#fca5a5" opacity="0.85" stroke="#ef4444" strokeWidth="1" />
      {/* Door handles */}
      <rect x="84" y="76" width="20" height="5" rx="2.5" fill={DIM} />
      <rect x="116" y="76" width="20" height="5" rx="2.5" fill={DIM} />
      {/* Hinges */}
      <circle cx="48" cy="42" r="3" fill={DIM} />
      <circle cx="48" cy="116" r="3" fill={DIM} />
      <circle cx="172" cy="42" r="3" fill={DIM} />
      <circle cx="172" cy="116" r="3" fill={DIM} />
      {/* Bumper */}
      <rect x="40" y="140" width="140" height="9" rx="3" fill={DIM} />
      {/* Label */}
      <text x="110" y="11" textAnchor="middle" fontSize="8" fontWeight="700" letterSpacing="0.6" fill={HI} fontFamily="system-ui,sans-serif">REAR</text>
    </svg>
  );
}

function VehicleDiagram({ activePanel }: { activePanel: number }) {
  if (activePanel === 2) return <VehicleDiagramFront />;
  if (activePanel === 3) return <VehicleDiagramRear />;
  return <VehicleDiagramSide mirrored={activePanel === 1} />;
}

// ─── STATE 3: Photo capture ───────────────────────────────────────────────────

function PhotoCapture({
  token,
  onComplete,
}: {
  token: string;
  onComplete: (photos: CapturedPhoto[]) => void;
}) {
  const [panelIndex, setPanelIndex] = useState(0);
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [preview, setPreview] = useState<{ file: File; url: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  // rejection holds the friendly Claude rejection message (422); distinct from a generic upload error
  const [rejection, setRejection] = useState<string | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Refs mirror state so closures always read the current value even if the
  // iOS tab was suspended/unfrozen while the native camera was open.
  const panelIndexRef = useRef(0);
  const photosRef = useRef<CapturedPhoto[]>([]);

  const panel = PANELS[panelIndexRef.current];

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview({ file, url: URL.createObjectURL(file) });
    setUploadError(null);
    setRejection(null);
  }

  function handleRetake() {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
    setUploadError(null);
    setRejection(null);
    setFileInputKey((k) => k + 1);
  }

  /** Advance to the next panel (or finish) using the ref so the value is
   *  never stale regardless of when the closure was created. */
  function advance(updated: CapturedPhoto[]) {
    const current = panelIndexRef.current;
    console.log(`[WrapSnap] advance: current=${current}/${PANELS.length - 1} panel="${PANELS[current]}"`);
    if (current < PANELS.length - 1) {
      const next = current + 1;
      panelIndexRef.current = next;
      setPanelIndex(next);
      console.log(`[WrapSnap] → moved to panel ${next} = "${PANELS[next]}"`);
    } else {
      console.log(`[WrapSnap] → all panels complete`);
      onComplete(updated);
    }
  }

  async function handleLooksGood() {
    if (!preview) return;
    const currentPanel = PANELS[panelIndexRef.current];
    console.log(`[WrapSnap] handleLooksGood: ref=${panelIndexRef.current} panel="${currentPanel}"`);
    setUploading(true);
    setUploadError(null);
    setRejection(null);
    try {
      const formData = new FormData();
      formData.append("token", token);
      formData.append("panel", currentPanel);
      formData.append("file", preview.file);

      const res = await fetch("/api/upload", { method: "POST", body: formData });

      if (res.status === 422) {
        // Claude rejected the photo — show the friendly message, do NOT advance
        const data = await res.json().catch(() => ({}));
        const msg = (data.rejection_message as string | undefined) ?? "This photo couldn't be used. Please retake it.";
        console.warn(`[WrapSnap] photo rejected: ${data.rejection_reason} — ${msg}`);
        setRejection(msg);
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Upload failed (HTTP ${res.status})`);
      }

      const newPhoto: CapturedPhoto = { panel: currentPanel, file: preview.file, preview: preview.url };
      const updated = [...photosRef.current, newPhoto];
      photosRef.current = updated;
      setPhotos(updated);
      setPreview(null);
      setFileInputKey((k) => k + 1);
      advance(updated);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed. Please try again.";
      console.error(`[WrapSnap] upload error: ${msg}`);
      setUploadError(msg);
    } finally {
      setUploading(false);
    }
  }

  /** Skip uploading this panel and move on. The photo won't be in Supabase
   *  so the estimate may be less accurate, but the flow stays unblocked. */
  function handleSkipAndContinue() {
    console.log(`[WrapSnap] skipping upload for "${PANELS[panelIndexRef.current]}"`);
    setUploadError(null);
    setRejection(null);
    setPreview(null);
    setFileInputKey((k) => k + 1);
    // Don't add to photos — estimate will work with whatever panels are present
    advance(photosRef.current);
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col p-6">
      <div className="w-full max-w-sm mx-auto flex flex-col flex-1">
        {/* Logo */}
        <div className="flex justify-center mb-4 pt-1">
          <Logo size="capture" />
        </div>

        {/* Progress */}
        <div className="flex gap-2 justify-center mb-6 pt-2">
          {PANELS.map((_, i) => (
            <div
              key={i}
              className="h-2 rounded-full flex-1 max-w-[48px] transition-colors"
              style={{
                backgroundColor:
                  i < panelIndex ? "#22c55e" : i === panelIndex ? "#007BBA" : "#e5e7eb",
              }}
            />
          ))}
        </div>

        <div className="text-center mb-4">
          <p className="text-xs font-medium uppercase tracking-widest text-gray-400 mb-0.5">
            Panel {panelIndex + 1} of {PANELS.length}
          </p>
          <h2 className="text-2xl font-semibold text-gray-900">{panel}</h2>
        </div>

        <VehicleDiagram activePanel={panelIndex} />

        <div className="mt-5 flex-1 flex flex-col">
          {preview ? (
            /* Preview mode */
            <div className="flex flex-col gap-4">
              <div className="relative rounded-2xl overflow-hidden bg-gray-900 aspect-[4/3] w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={preview.url}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Claude rejection — friendly message above the Retake button, no skip option */}
              {rejection && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-3 text-sm text-red-700">
                  <p className="font-semibold mb-0.5">Photo couldn&apos;t be used</p>
                  <p className="text-xs leading-snug">{rejection}</p>
                </div>
              )}

              {/* Landscape note — reassures the user if the preview appears portrait */}
              {!rejection && !uploadError && (
                <p className="text-xs text-gray-400 text-center">
                  If the photo looks sideways, that&apos;s fine — landscape orientation is preserved in the estimate.
                </p>
              )}

              {/* Generic upload error with full detail + skip option */}
              {uploadError && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-3 text-sm text-red-700">
                  <p className="font-semibold">Upload failed</p>
                  <p className="mt-0.5 text-xs break-all">{uploadError}</p>
                  <button
                    type="button"
                    onClick={handleSkipAndContinue}
                    className="mt-2 text-xs font-semibold underline underline-offset-2"
                  >
                    Skip this photo and continue →
                  </button>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleRetake}
                  disabled={uploading}
                  className="flex-1 rounded-xl border border-gray-300 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                >
                  Retake
                </button>
                <button
                  type="button"
                  onClick={handleLooksGood}
                  disabled={uploading}
                  className="flex-1 rounded-xl py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: "#007BBA" }}
                >
                  {uploading ? "Uploading…" : "Looks good"}
                </button>
              </div>
            </div>
          ) : (
            /* Camera prompt */
            <div className="flex flex-col items-center gap-5 flex-1 justify-center">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex h-36 w-36 flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-gray-300 bg-white transition hover:border-[#007BBA] hover:bg-blue-50 focus:outline-none"
              >
                <svg className="h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                </svg>
                <span className="text-sm font-medium text-gray-500">Tap to photograph</span>
              </button>
              <input
                key={fileInputKey}
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={handleFileChange}
              />
              <p className="text-xs text-gray-400 text-center px-4">
                Make sure the reference card and the full {panel.toLowerCase()} are visible.
              </p>
              <button
                type="button"
                onClick={handleSkipAndContinue}
                className="text-xs text-gray-400 underline underline-offset-2 hover:text-gray-600 transition mt-1"
              >
                Skip — no graphics on this side
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── STATE 4: Submission ──────────────────────────────────────────────────────

function Submission({
  token,
  photos,
  onComplete,
}: {
  token: string;
  photos: CapturedPhoto[];
  onComplete: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Estimate failed (${res.status})`);
      }
      onComplete();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setSubmitError(msg);
      setSubmitting(false);
    }
  }

  if (submitting) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-5 p-6">
        <div
          className="h-14 w-14 rounded-full border-4 border-t-transparent animate-spin"
          style={{ borderColor: "#007BBA", borderTopColor: "transparent" }}
        />
        <p className="text-lg font-medium text-gray-700">Measuring your vehicle…</p>
        <p className="text-sm text-gray-400">This takes about 30 seconds.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col p-6">
      <div className="w-full max-w-sm mx-auto flex flex-col flex-1">
        <Logo />
        <h1 className="text-2xl font-semibold text-gray-900 text-center mb-1">
          Ready to submit
        </h1>
        <p className="text-sm text-gray-500 text-center mb-6">
          Review your photos, then send for an AI estimate.
        </p>

        <div className="grid grid-cols-2 gap-3 mb-8">
          {photos.map((photo) => (
            <div key={photo.panel} className="relative rounded-2xl overflow-hidden bg-gray-200 aspect-[4/3]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.preview} alt={photo.panel} className="w-full h-full object-cover" />
              {/* Green checkmark overlay */}
              <div className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-green-500 shadow">
                <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1.5">
                <p className="text-white text-xs font-medium">{photo.panel}</p>
              </div>
            </div>
          ))}
        </div>

        {submitError && (
          <p className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 mb-4">
            {submitError}
          </p>
        )}
        <PrimaryButton onClick={handleSubmit}>Send for estimate</PrimaryButton>
      </div>
    </div>
  );
}

// ─── STATE 5: Complete ────────────────────────────────────────────────────────

function Complete() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
      <div
        className="mb-6 flex h-20 w-20 items-center justify-center rounded-full"
        style={{ backgroundColor: "#EBF5FB" }}
      >
        <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="#007BBA">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      </div>
      <h1 className="text-3xl font-bold text-gray-900 mb-3">All done!</h1>
      <p className="text-gray-500 max-w-xs leading-relaxed">
        Your Advertising Vehicles representative will have your estimate shortly.
      </p>
    </div>
  );
}

// ─── Root client component ────────────────────────────────────────────────────

export default function ScanClient({ token, isAE }: { token: string; isAE: boolean }) {
  const router = useRouter();
  const [appState, setAppState] = useState<AppState>(isAE ? "instructions" : "pin-entry");
  const [capturedPhotos, setCapturedPhotos] = useState<CapturedPhoto[]>([]);

  if (appState === "pin-entry") {
    return <PinEntry token={token} onSuccess={() => setAppState("instructions")} />;
  }

  if (appState === "instructions") {
    return (
      <Instructions
        onReady={() => setAppState("capture")}
        onBack={isAE ? () => router.back() : undefined}
      />
    );
  }

  if (appState === "capture") {
    return (
      <PhotoCapture
        token={token}
        onComplete={(photos) => {
          setCapturedPhotos(photos);
          setAppState("submission");
        }}
      />
    );
  }

  if (appState === "submission") {
    return (
      <Submission
        token={token}
        photos={capturedPhotos}
        onComplete={() => setAppState("complete")}
      />
    );
  }

  return <Complete />;
}
