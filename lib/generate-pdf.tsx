import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import EstimatePDFDocument, { type PanelPDF } from "@/components/EstimatePDF";

// Use the absolute production URL so react-pdf can fetch the image from the network.
// renderToBuffer runs server-side and needs a full URL, not a relative path.
const LOGO_URL =
  "https://wrapsnap.advertisingvehicles.com/images/WrapSnap_Logo_Horizontal_SM.jpg";

export interface GeneratePDFOptions {
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
  /** Map of panel slug → URL (signed Supabase URL). react-pdf fetches these at render time. */
  photosByPanel?: Record<string, string> | null;
}

/**
 * Renders the WrapSnap estimate as a PDF and returns the raw bytes.
 * Intended for server-side use only (API routes, server actions).
 * Uses renderToBuffer from @react-pdf/renderer — NOT PDFDownloadLink.
 */
export async function generatePDF(opts: GeneratePDFOptions): Promise<Buffer> {
  const doc = (
    <EstimatePDFDocument
      logoUrl={LOGO_URL}
      clientName={opts.clientName}
      vehicleDescription={opts.vehicleDescription}
      vehicleType={opts.vehicleType}
      sessionDate={opts.sessionDate}
      totalSqft={opts.totalSqft}
      sqftLow={opts.sqftLow}
      sqftHigh={opts.sqftHigh}
      confidence={opts.confidence}
      confidenceNote={opts.confidenceNote}
      panels={opts.panels}
      photosByPanel={opts.photosByPanel}
    />
  );
  return renderToBuffer(doc);
}
