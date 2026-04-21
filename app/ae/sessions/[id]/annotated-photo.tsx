"use client";

import { useEffect, useRef, useCallback } from "react";

export interface GroupBBox {
  label: string;
  artboard: number;
  bbox: { x: number; y: number; w: number; h: number };
  panel: string;
}

// Keep for backward compatibility
export interface VinylZone {
  type: "printed_wrap" | "cut_vinyl" | "review";
  name?: string;
  sqft: number;
  bbox?: { x_pct: number; y_pct: number; width_pct: number; height_pct: number };
}

interface Props {
  imageUrl: string;
  groupsBbox: GroupBBox[];
  panelLabel: string;
  onOpen?: () => void;
}

const ARTBOARD_STYLE = {
  1: { fill: "rgba(59, 130, 246, 0.18)",  stroke: "#3b82f6", tag: "A1" },
  2: { fill: "rgba(234, 88, 12, 0.18)",   stroke: "#ea580c", tag: "A2" },
  3: { fill: "rgba(22, 163, 74, 0.18)",   stroke: "#16a34a", tag: "A3" },
} as const;

function drawGroupLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  fontSize: number,
  bgColor: string,
) {
  ctx.font = `bold ${fontSize}px sans-serif`;
  const tw = ctx.measureText(text).width;
  const pad = 4;
  const bh = fontSize + 7;
  ctx.fillStyle = bgColor;
  ctx.fillRect(x - pad, y - fontSize, tw + pad * 2, bh);
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.strokeText(text, x, y);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(text, x, y);
}

export default function AnnotatedPhoto({ imageUrl, groupsBbox, panelLabel, onOpen }: Props) {
  const imgRef    = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

    for (const group of groupsBbox) {
      const style = ARTBOARD_STYLE[group.artboard as 1 | 2 | 3] ?? ARTBOARD_STYLE[1];
      const { x, y, w: bwPct, h: bhPct } = group.bbox;
      const px  = x * w;
      const py  = y * h;
      const bw  = bwPct * w;
      const bh  = bhPct * h;

      ctx.fillStyle = style.fill;
      ctx.fillRect(px, py, bw, bh);

      ctx.strokeStyle = style.stroke;
      ctx.lineWidth   = 2;
      ctx.strokeRect(px, py, bw, bh);

      const fontSize = Math.round(w / 55);
      drawGroupLabel(ctx, group.label, px + 4, py + fontSize + 4, fontSize, style.stroke + "CC");
    }
  }, [groupsBbox]);

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
      window.open(imageUrl, "_blank");
      return;
    }

    const sw = img.naturalWidth;
    const sh = img.naturalHeight;

    for (const group of groupsBbox) {
      const style = ARTBOARD_STYLE[group.artboard as 1 | 2 | 3] ?? ARTBOARD_STYLE[1];
      const { x, y, w: bwPct, h: bhPct } = group.bbox;
      const px  = x * sw;
      const py  = y * sh;
      const bw  = bwPct * sw;
      const bh  = bhPct * sh;

      ctx.fillStyle = style.fill;
      ctx.fillRect(px, py, bw, bh);

      ctx.strokeStyle = style.stroke;
      ctx.lineWidth   = Math.max(2, sw / 500);
      ctx.strokeRect(px, py, bw, bh);

      const fontSize = Math.round(sw / 55);
      drawGroupLabel(ctx, group.label, px + 4, py + fontSize + 4, fontSize, style.stroke + "CC");
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
      <div
        className={`relative aspect-[4/3] rounded-xl overflow-hidden bg-gray-100 border border-gray-200${onOpen ? " cursor-zoom-in" : ""}`}
        onClick={onOpen}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={imageUrl}
          alt={panelLabel}
          className="w-full h-full object-cover"
          crossOrigin="anonymous"
        />
        {groupsBbox.length > 0 && (
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none"
          />
        )}
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent px-3 py-2 flex items-end justify-between">
          <p className="text-white text-xs font-medium">{panelLabel}</p>
          {groupsBbox.length > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); handleDownload(); }}
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

      {/* Legend */}
      {groupsBbox.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {([1, 2, 3] as const)
            .filter((a) => groupsBbox.some((g) => g.artboard === a))
            .map((a) => {
              const style = ARTBOARD_STYLE[a];
              const labels = ["Cut Vinyl (A1)", "Large Cut (A2)", "Printed (A3)"];
              return (
                <span
                  key={a}
                  className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium"
                  style={{ background: style.fill, color: style.stroke, border: `1px solid ${style.stroke}` }}
                >
                  <span className="h-2 w-2 rounded-sm inline-block" style={{ background: style.stroke }} />
                  {labels[a - 1]}
                </span>
              );
            })}
        </div>
      )}
    </div>
  );
}
