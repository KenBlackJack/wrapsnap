import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import EstimatePDFDocument, {
  type Artboard1Data,
  type Artboard2Data,
  type Artboard3Data,
} from "@/components/EstimatePDF";

const LOGO_URL =
  "https://wrapsnap.advertisingvehicles.com/images/WrapSnap_Logo_Horizontal_SM.jpg";

export interface GeneratePDFOptions {
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

export async function generatePDF(opts: GeneratePDFOptions): Promise<Buffer> {
  const doc = (
    <EstimatePDFDocument
      logoUrl={LOGO_URL}
      clientName={opts.clientName}
      vehicleDescription={opts.vehicleDescription}
      vehicleType={opts.vehicleType}
      sessionDate={opts.sessionDate}
      totalSqft={opts.totalSqft}
      confidence={opts.confidence}
      confidenceNote={opts.confidenceNote}
      artboard1={opts.artboard1}
      artboard2={opts.artboard2}
      artboard3={opts.artboard3}
      photosByPanel={opts.photosByPanel}
    />
  );
  return renderToBuffer(doc);
}
