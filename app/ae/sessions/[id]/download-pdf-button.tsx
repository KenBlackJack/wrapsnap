"use client";

import { useState } from "react";
import { pdf } from "@react-pdf/renderer";
import EstimatePDFDocument, { type PanelPDF } from "@/components/EstimatePDF";
import type { VinylZone } from "./annotated-photo";

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
  photosByPanel?: Record<string, string> | null;
  zonesByPanel?: Record<string, VinylZone[]> | null;
}

const ZONE_STYLE_PDF = {
  printed_wrap: { fill: "rgba(59, 130, 246, 0.20)", stroke: "#3b82f6", label: "Printed Wrap" },
  cut_vinyl:    { fill: "rgba(239, 68, 68, 0.20)",  stroke: "#ef4444", label: "Cut Vinyl" },
  review:       { fill: "rgba(234, 179, 8, 0.20)",  stroke: "#eab308", label: "Review" },
} as const;

function drawZoneLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  fontSize: number,
) {
  ctx.font = `bold ${fontSize}px sans-serif`;
  const tw = ctx.measureText(text).width;
  const pad = 4;
  const bh = fontSize + 7;
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(x - pad, y - fontSize, tw + pad * 2, bh);
  ctx.strokeStyle = "rgba(0,0,0,0.8)";
  ctx.lineWidth = 3;
  ctx.lineJoin = "round";
  ctx.strokeText(text, x, y);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(text, x, y);
}

async function buildAnnotatedDataUrls(
  photosByPanel: Record<string, string>,
  zonesByPanel: Record<string, VinylZone[]>,
): Promise<Record<string, string>> {
  const result: Record<string, string> = {};

  await Promise.all(
    Object.entries(photosByPanel).map(async ([slug, url]) => {
      try {
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const i = new Image();
          i.crossOrigin = "anonymous";
          i.onload = () => resolve(i);
          i.onerror = reject;
          i.src = url;
        });

        const canvas = document.createElement("canvas");
        canvas.width  = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) { result[slug] = url; return; }

        ctx.drawImage(img, 0, 0);

        const zones = (zonesByPanel[slug] ?? []).filter((z) => z.bbox);
        const sw = img.naturalWidth;
        const sh = img.naturalHeight;

        for (const zone of zones) {
          const style = ZONE_STYLE_PDF[zone.type] ?? ZONE_STYLE_PDF.review;
          const { x_pct, y_pct, width_pct, height_pct } = zone.bbox!;
          const x  = x_pct * sw;
          const y  = y_pct * sh;
          const bw = width_pct * sw;
          const bh = height_pct * sh;

          ctx.fillStyle = style.fill;
          ctx.fillRect(x, y, bw, bh);
          ctx.strokeStyle = style.stroke;
          ctx.lineWidth = Math.max(2, sw / 500);
          ctx.strokeRect(x, y, bw, bh);

          const labelText = `${zone.name ?? style.label} · ${zone.sqft.toFixed(1)} sq ft`;
          drawZoneLabel(ctx, labelText, x + 6, y + Math.round(sw / 50), Math.round(sw / 60));
        }

        result[slug] = canvas.toDataURL("image/jpeg", 0.92);
      } catch {
        result[slug] = url; // fall back to raw URL on CORS failure
      }
    }),
  );

  return result;
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
  photosByPanel,
  zonesByPanel,
}: DownloadPDFButtonProps) {
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    if (busy) return;
    setBusy(true);
    try {
      const logoUrl  = `${window.location.origin}/images/WrapSnap_Logo_Horizontal_LG.jpg`;
      const fileName = `WrapSnap-Estimate-${clientName.replace(/[^a-zA-Z0-9]+/g, "-")}.pdf`;

      // Render annotated images onto offscreen canvases before building the PDF
      let resolvedPhotos: Record<string, string> | null = photosByPanel ?? null;
      if (photosByPanel && Object.keys(photosByPanel).length > 0) {
        resolvedPhotos = await buildAnnotatedDataUrls(photosByPanel, zonesByPanel ?? {});
      }

      const blob = await pdf(
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
          photosByPanel={resolvedPhotos}
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
