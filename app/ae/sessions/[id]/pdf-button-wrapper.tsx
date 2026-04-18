"use client";

import dynamic from "next/dynamic";
import type { PanelPDF } from "@/components/EstimatePDF";

const DownloadPDFButton = dynamic(() => import("./download-pdf-button"), {
  ssr: false,
  loading: () => (
    <button
      disabled
      className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-white opacity-60 cursor-wait"
      style={{ backgroundColor: "#007BBA" }}
    >
      <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
      </svg>
      Download PDF
    </button>
  ),
});

interface PdfButtonWrapperProps {
  clientName: string;
  vehicleDescription?: string | null;
  vehicleType?: string | null;
  sessionDate: string;
  totalSqft?: number | null;
  sqftLow?: number | null;
  sqftHigh?: number | null;
  confidence?: string | null;
  confidenceNote?: string | null;
  panels: PanelPDF[];
  photosByPanel?: Record<string, string> | null;
}

export default function PdfButtonWrapper(props: PdfButtonWrapperProps) {
  return <DownloadPDFButton {...props} />;
}
