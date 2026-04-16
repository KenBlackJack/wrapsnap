"use client";

import { useState } from "react";

export default function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for browsers that block clipboard without https
    }
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
      <span className="flex-1 truncate text-sm text-gray-700 font-mono">{url}</span>
      <button
        type="button"
        onClick={handleCopy}
        className="shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-offset-1"
        style={{
          backgroundColor: copied ? "#dcfce7" : "#EBF5FB",
          color: copied ? "#15803d" : "#007BBA",
        }}
      >
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}
