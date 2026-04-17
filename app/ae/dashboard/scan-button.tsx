"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

type Step = "idle" | "form" | "loading";

const CameraIcon = ({ className }: { className: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
  </svg>
);

export default function ScanButton({ aeName }: { aeName: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("idle");
  const [vehicleDesc, setVehicleDesc] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleStart() {
    setStep("loading");
    setError(null);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_name: aeName,
          client_phone: "0000000000",
          expires_in_hours: 24,
          vehicle_description: vehicleDesc.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!data.token) {
        throw new Error(data.error ?? "Failed to create session");
      }

      router.push(`/scan/${data.token}?ae=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStep("form");
    }
  }

  if (step === "loading") {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm" style={{ minHeight: "140px" }}>
        <svg className="h-6 w-6 animate-spin" style={{ color: "#007BBA" }} fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
        <p className="text-sm font-medium text-gray-600">Starting scan…</p>
      </div>
    );
  }

  if (step === "form") {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        {/* Logo + title */}
        <div className="flex items-center gap-3 mb-1">
          <Image
            src="/images/WrapSnap_Logo_Horizontal_SM.jpg"
            alt="WrapSnap"
            width={110}
            height={32}
            style={{ height: 32, width: "auto" }}
            priority
          />
        </div>
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <span style={{ color: "#007BBA" }}>
            <CameraIcon className="h-4 w-4 shrink-0" />
          </span>
          <span>Scan a Vehicle</span>
        </div>
        <input
          type="text"
          value={vehicleDesc}
          onChange={(e) => setVehicleDesc(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleStart(); }}
          placeholder='Vehicle description, e.g. "Route Van #3"'
          autoFocus
          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2"
          style={{ "--tw-ring-color": "#007BBA" } as React.CSSProperties}
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => { setStep("idle"); setVehicleDesc(""); setError(null); }}
            className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleStart}
            className="flex-1 rounded-lg py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
            style={{ backgroundColor: "#007BBA" }}
          >
            Start Scan
          </button>
        </div>
      </div>
    );
  }

  // idle
  return (
    <button
      type="button"
      onClick={() => setStep("form")}
      className="flex flex-col items-start gap-3 rounded-xl p-5 text-left transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2"
      style={{ backgroundColor: "#007BBA" }}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/20">
        <CameraIcon className="h-5 w-5 text-white" />
      </div>
      <div>
        <p className="font-semibold text-white">Scan a Vehicle</p>
        <p className="mt-0.5 text-sm text-white/70">I&apos;m on site — take measurements myself</p>
      </div>
    </button>
  );
}
