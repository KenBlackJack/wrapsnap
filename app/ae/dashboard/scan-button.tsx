"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ScanButton({ aeName }: { aeName: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      // Create a self-scan session using the AE's name.
      // Phone is a placeholder — AE is on-site so no SMS is needed.
      // The route returns 207 when SMS fails but still includes id + token.
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_name: aeName,
          client_phone: "0000000000",
          expires_in_hours: 24,
        }),
      });

      const data = await res.json();

      if (!data.token) {
        throw new Error(data.error ?? "Failed to create session");
      }

      router.push(`/scan/${data.token}?ae=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="flex flex-1 flex-col items-start gap-3 rounded-xl p-5 text-left transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-60"
        style={{ backgroundColor: "#007BBA" }}
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/20">
          {loading ? (
            <svg className="h-5 w-5 animate-spin text-white" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          ) : (
            <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
            </svg>
          )}
        </div>
        <div>
          <p className="font-semibold text-white">{loading ? "Starting…" : "Scan a Vehicle"}</p>
          <p className="mt-0.5 text-sm text-white/70">I&apos;m on site — take measurements myself</p>
        </div>
      </button>
      {error && (
        <p className="mt-2 text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}
