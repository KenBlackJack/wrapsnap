"use client";

import { useEffect, useRef, useCallback } from "react";

interface BBox {
  x_pct: number;
  y_pct: number;
  width_pct: number;
  height_pct: number;
}

export interface VinylZone {
  type: "printed_wrap" | "cut_vinyl" | "review";
  name?: string;
  sqft: number;
  bbox?: BBox;
}

interface Props {
  imageUrl: string;
  zones: VinylZone[];
  panelLabel: string;
}

const ZONE_STYLE = {
  printed_wrap: { fill: "rgba(59, 130, 246, 0.20)", stroke: "#3b82f6", label: "Printed Wrap" },
  cut_vinyl:    { fill: "rgba(239, 68, 68, 0.20)",  stroke: "#ef4444", label: "Cut Vinyl" },
  review:       { fill: "rgba(234, 179, 8, 0.20)",  stroke: "#eab308", label: "Review" },
} as const;

export default function AnnotatedPhoto({ imageUrl, zones, panelLabel }: Props) {
  const imgRef    = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const annotatedZones = zones.filter((z) => z.bbox);

  const draw = useCallback(() => {
    const img    = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas || !img.naturalWidth) return;

    const w = img.offsetWidth;
    const h = img.offsetHeight;
    canvas.width  = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);

    for (const zone of annotatedZones) {
      const style = ZONE_STYLE[zone.type] ?? ZONE_STYLE.review;
      const { x_pct, y_pct, width_pct, height_pct } = zone.bbox!;
      const x  = x_pct * w;
      const y  = y_pct * h;
      const bw = width_pct * w;
      const bh = height_pct * h;

      ctx.fillStyle = style.fill;
      ctx.fillRect(x, y, bw, bh);

      ctx.strokeStyle = style.stroke;
      ctx.lineWidth   = 2;
      ctx.strokeRect(x, y, bw, bh);

      ctx.fillStyle = style.stroke;
      ctx.font      = "bold 11px sans-serif";
      const zoneLabel = zone.name ?? style.label;
      ctx.fillText(`${zoneLabel} · ${zone.sqft.toFixed(1)} sq ft`, x + 4, y + 14);
    }
  }, [annotatedZones]);

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;

    if (img.complete && img.naturalWidth) draw();
    img.addEventListener("load", draw);
    window.addEventListener("resize", draw);
    return () => {
      img.removeEventListener("load", draw);
      window.removeEventListener("resize", draw);
    };
  }, [draw]);

  function handleDownload() {
    const img    = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;

    const off = document.createElement("canvas");
    off.width  = img.naturalWidth;
    off.height = img.naturalHeight;
    const ctx = off.getContext("2d");
    if (!ctx) return;

    try {
      ctx.drawImage(img, 0, 0);
    } catch {
      // CORS-tainted canvas — open image directly instead
      window.open(imageUrl, "_blank");
      return;
    }

    const sw = img.naturalWidth;
    const sh = img.naturalHeight;

    for (const zone of annotatedZones) {
      const style = ZONE_STYLE[zone.type] ?? ZONE_STYLE.review;
      const { x_pct, y_pct, width_pct, height_pct } = zone.bbox!;
      const x  = x_pct * sw;
      const y  = y_pct * sh;
      const bw = width_pct * sw;
      const bh = height_pct * sh;

      ctx.fillStyle = style.fill;
      ctx.fillRect(x, y, bw, bh);

      ctx.strokeStyle = style.stroke;
      ctx.lineWidth   = Math.max(2, sw / 500);
      ctx.strokeRect(x, y, bw, bh);

      ctx.fillStyle = style.stroke;
      ctx.font      = `bold ${Math.round(sw / 60)}px sans-serif`;
      const dlLabel = zone.name ?? style.label;
      ctx.fillText(`${dlLabel} · ${zone.sqft.toFixed(1)} sq ft`, x + 6, y + Math.round(sw / 50));
    }

    let dataUrl: string;
    try {
      dataUrl = off.toDataURL("image/jpeg", 0.92);
    } catch {
      window.open(imageUrl, "_blank");
      return;
    }

    const a    = document.createElement("a");
    a.href     = dataUrl;
    a.download = `wrapsnap-${panelLabel.toLowerCase().replace(/\s+/g, "-")}.jpg`;
    a.click();
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-gray-100 border border-gray-200">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={imageUrl}
          alt={panelLabel}
          className="w-full h-full object-cover"
          crossOrigin="anonymous"
        />
        {annotatedZones.length > 0 && (
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none"
          />
        )}
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent px-3 py-2 flex items-end justify-between">
          <p className="text-white text-xs font-medium">{panelLabel}</p>
          {annotatedZones.length > 0 && (
            <button
              onClick={handleDownload}
              className="flex items-center gap-1 text-white/80 hover:text-white text-[10px] transition"
              title="Download annotated photo"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Save
            </button>
          )}
        </div>
      </div>

      {/* Zone legend */}
      {annotatedZones.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {(["printed_wrap", "cut_vinyl", "review"] as const)
            .filter((t) => annotatedZones.some((z) => z.type === t))
            .map((t) => {
              const style = ZONE_STYLE[t];
              return (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium"
                  style={{ background: style.fill, color: style.stroke, border: `1px solid ${style.stroke}` }}
                >
                  <span className="h-2 w-2 rounded-sm inline-block" style={{ background: style.stroke }} />
                  {style.label}
                </span>
              );
            })}
        </div>
      )}
    </div>
  );
}
