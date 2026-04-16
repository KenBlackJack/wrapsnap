"use client";

import { useState } from "react";

export default function PinReveal() {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="flex items-center gap-3">
      <span className="text-lg font-mono tracking-widest text-gray-800">
        {revealed ? "PIN was sent via SMS to client" : "••••••"}
      </span>
      <button
        type="button"
        onClick={() => setRevealed((r) => !r)}
        className="text-xs font-medium transition focus:outline-none focus:underline"
        style={{ color: "#007BBA" }}
      >
        {revealed ? "Hide" : "Show PIN"}
      </button>
    </div>
  );
}
