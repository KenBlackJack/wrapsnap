"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Invisible client component — polls /api/sessions/[id] every 10 s.
 * When status flips to "complete" it calls router.refresh() so the
 * server-rendered page re-fetches and shows the full estimate results.
 */
export default function ProcessingPoller({ sessionId }: { sessionId: string }) {
  const router  = useRouter();
  const stopped = useRef(false);

  useEffect(() => {
    stopped.current = false;

    const id = setInterval(async () => {
      if (stopped.current) return;
      try {
        const res = await fetch(`/api/sessions/${sessionId}`, { cache: "no-store" });
        if (!res.ok) return;
        const data: { status: string } = await res.json();
        if (data.status === "complete") {
          stopped.current = true;
          clearInterval(id);
          router.refresh();
        }
      } catch {
        // network hiccup — try again next tick
      }
    }, 10_000);

    return () => {
      stopped.current = true;
      clearInterval(id);
    };
  }, [sessionId, router]);

  // Renders nothing — the parent page handles the visible UI
  return null;
}
