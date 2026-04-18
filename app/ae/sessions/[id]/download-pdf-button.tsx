"use client";

import { PDFDownloadLink } from "@react-pdf/renderer";
import EstimatePDFDocument, { type PanelPDF } from "@/components/EstimatePDF";

interface DownloadPDFButtonProps {
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
}

export default function DownloadPDFButton({
  clientName,
  vehicleDescription,
  vehicleType,
  sessionDate,
  totalSqft,
  sqftLow,
  sqftHigh,
  confidence,
  confidenceNote,
  panels,
}: DownloadPDFButtonProps) {
  const logoUrl = `${window.location.origin}/images/WrapSnap_Logo_Horizontal_LG.jpg`;
  const fileName = `WrapSnap-Estimate-${clientName.replace(/[^a-zA-Z0-9]+/g, "-")}.pdf`;

  return (
    <PDFDownloadLink
      document={
        <EstimatePDFDocument
          logoUrl={logoUrl}
          clientName={clientName}
          vehicleDescription={vehicleDescription}
          vehicleType={vehicleType}
          sessionDate={sessionDate}
          totalSqft={totalSqft}
          sqftLow={sqftLow}
          sqftHigh={sqftHigh}
          confidence={confidence}
          confidenceNote={confidenceNote}
          panels={panels}
        />
      }
      fileName={fileName}
    >
      {({ loading, error }) => (
        <button
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-white shadow-sm transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-60 disabled:cursor-wait"
          style={{ backgroundColor: "#007BBA" }}
          title={error ? "Error generating PDF" : undefined}
        >
          {loading ? (
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
      )}
    </PDFDownloadLink>
  );
}
