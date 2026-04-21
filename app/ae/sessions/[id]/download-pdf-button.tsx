"use client";

import { useState } from "react";
import { pdf } from "@react-pdf/renderer";
import EstimatePDFDocument, {
  type Artboard1Data,
  type Artboard2Data,
  type Artboard3Data,
} from "@/components/EstimatePDF";

interface DownloadPDFButtonProps {
  clientName: string;
  vehicleDescription?: string | null;
  vehicleType?: string | null;
  sessionDate: string;
  totalSqft?: number | null;
  confidence?: string | null;
  confidenceNote?: string | null;
  artboard1?: Artboard1Data | null;
  artboard2?: Artboard2Data | null;
  artboard3?: Artboard3Data | null;
  photosByPanel?: Record<string, string> | null;
}

export default function DownloadPDFButton({
  clientName,
  vehicleDescription,
  vehicleType,
  sessionDate,
  totalSqft,
  confidence,
  confidenceNote,
  artboard1,
  artboard2,
  artboard3,
  photosByPanel,
}: DownloadPDFButtonProps) {
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    if (busy) return;
    setBusy(true);
    try {
      const logoUrl  = `${window.location.origin}/images/WrapSnap_Logo_Horizontal_LG.jpg`;
      const fileName = `WrapSnap-Estimate-${clientName.replace(/[^a-zA-Z0-9]+/g, "-")}.pdf`;

      const blob = await pdf(
        <EstimatePDFDocument
          logoUrl={logoUrl}
          clientName={clientName}
          vehicleDescription={vehicleDescription}
          vehicleType={vehicleType}
          sessionDate={sessionDate}
          totalSqft={totalSqft}
          confidence={confidence}
          confidenceNote={confidenceNote}
          artboard1={artboard1}
          artboard2={artboard2}
          artboard3={artboard3}
          photosByPanel={photosByPanel}
        />,
      ).toBlob();

      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href     = objectUrl;
      a.download = fileName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
    } catch (err) {
      console.error("PDF generation error", err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={busy}
      className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-white shadow-sm transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-60 disabled:cursor-wait"
      style={{ backgroundColor: "#007BBA" }}
    >
      {busy ? (
        <>
          <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Preparing PDF…
        </>
      ) : (
        <>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          Download PDF
        </>
      )}
    </button>
  );
}
