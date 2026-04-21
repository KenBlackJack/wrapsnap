"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ReestimateButton({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    setLoading(true);
    try {
      await fetch(`/api/sessions/${sessionId}/reestimate`, { method: "POST" });
      router.refresh();
    } finally {
      setLoading(false);
      setConfirming(false);
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-600">
          Re-run AI estimation using existing photos? This will replace the current estimate.
        </span>
        <button
          onClick={handleConfirm}
          disabled={loading}
          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-white transition disabled:opacity-60"
          style={{ backgroundColor: "#007BBA" }}
        >
          {loading ? (
            <>
              <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Running…
            </>
          ) : (
            "Re-estimate"
          )}
        </button>
        <button
          onClick={() => setConfirming(false)}
          disabled={loading}
          className="inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-medium text-gray-500 border border-gray-200 hover:bg-gray-50 transition disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-500 transition hover:bg-gray-50 hover:text-gray-700"
    >
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
      </svg>
      Re-estimate
    </button>
  );
}
