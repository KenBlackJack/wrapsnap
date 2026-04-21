"use client";

import { useState, useEffect, useCallback } from "react";
import AnnotatedPhoto from "./annotated-photo";
import type { GroupBBox } from "./annotated-photo";

export interface PhotoPanel {
  slug: string;
  label: string;
  imageUrl: string | null;
  groupsBbox: GroupBBox[];
}

export default function PhotoGrid({ panels }: { panels: PhotoPanel[] }) {
  const [lightboxSlug, setLightboxSlug] = useState<string | null>(null);

  const photoPanels = panels.filter((p) => p.imageUrl);
  const lightboxIdx = photoPanels.findIndex((p) => p.slug === lightboxSlug);
  const lightboxPanel = lightboxIdx >= 0 ? photoPanels[lightboxIdx] : null;

  const closeLightbox = useCallback(() => setLightboxSlug(null), []);

  const prevPanel = useCallback(() => {
    if (lightboxIdx > 0) setLightboxSlug(photoPanels[lightboxIdx - 1].slug);
  }, [lightboxIdx, photoPanels]);

  const nextPanel = useCallback(() => {
    if (lightboxIdx < photoPanels.length - 1) setLightboxSlug(photoPanels[lightboxIdx + 1].slug);
  }, [lightboxIdx, photoPanels]);

  useEffect(() => {
    if (!lightboxPanel) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape")      { e.preventDefault(); closeLightbox(); }
      else if (e.key === "ArrowLeft")  { e.preventDefault(); prevPanel(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); nextPanel(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxPanel, closeLightbox, prevPanel, nextPanel]);

  // Prevent body scroll when lightbox is open
  useEffect(() => {
    document.body.style.overflow = lightboxPanel ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [lightboxPanel]);

  return (
    <>
      {/* Thumbnail grid */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {panels.map(({ slug, label, imageUrl, groupsBbox }) =>
          imageUrl ? (
            <div key={slug}>
              <AnnotatedPhoto
                imageUrl={imageUrl}
                groupsBbox={groupsBbox}
                panelLabel={label}
                onOpen={() => setLightboxSlug(slug)}
              />
            </div>
          ) : (
            <div
              key={slug}
              className="relative aspect-[4/3] rounded-xl overflow-hidden bg-gray-100 border border-gray-200 flex flex-col items-center justify-center gap-2 p-4 text-center"
            >
              <svg className="h-7 w-7 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 3h18M3 3v18M3 3l18 18" />
              </svg>
              <p className="text-xs font-medium text-gray-400">{label}</p>
              <p className="text-[10px] text-gray-300">Not yet uploaded</p>
            </div>
          )
        )}
      </div>

      {/* Lightbox overlay */}
      {lightboxPanel && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-4"
          onClick={closeLightbox}
          role="dialog"
          aria-modal="true"
          aria-label={`Photo: ${lightboxPanel.label}`}
        >
          {/* Top bar */}
          <div
            className="flex w-full max-w-4xl items-center justify-between mb-3 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <p className="text-white font-semibold text-sm">{lightboxPanel.label}</p>
              {photoPanels.length > 1 && (
                <p className="text-white/50 text-xs">
                  {lightboxIdx + 1} / {photoPanels.length}
                </p>
              )}
            </div>
            <button
              onClick={closeLightbox}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition"
              aria-label="Close"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Image */}
          <div
            className="w-full max-w-4xl"
            onClick={(e) => e.stopPropagation()}
          >
            <AnnotatedPhoto
              imageUrl={lightboxPanel.imageUrl!}
              groupsBbox={lightboxPanel.groupsBbox}
              panelLabel={lightboxPanel.label}
            />
          </div>

          {/* Arrow navigation */}
          {lightboxIdx > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); prevPanel(); }}
              className="fixed left-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 transition"
              aria-label="Previous photo"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
          )}
          {lightboxIdx < photoPanels.length - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); nextPanel(); }}
              className="fixed right-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 transition"
              aria-label="Next photo"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          )}

          {/* Keyboard hint */}
          <p className="mt-3 text-white/30 text-xs shrink-0" onClick={(e) => e.stopPropagation()}>
            ← → to navigate · Esc to close · click outside to close
          </p>
        </div>
      )}
    </>
  );
}
