import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";

/**
 * Enable iOS-style edge-swipe-to-go-back on mobile.
 * - Swipe must start within the left ~24px of the viewport.
 * - Must travel > 80px horizontally with mostly-horizontal motion.
 * - Only active on touch (coarse pointer) devices.
 * - Respects a fallback path if there is no prior SPA entry.
 */
export function useSwipeBack(fallback: string = "/") {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Only enable on touch/coarse devices.
    if (!window.matchMedia?.("(pointer: coarse)").matches) return;

    let startX = 0;
    let startY = 0;
    let tracking = false;
    let startTime = 0;

    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      if (t.clientX > 24) return; // must begin at left edge
      startX = t.clientX;
      startY = t.clientY;
      startTime = Date.now();
      tracking = true;
    };

    const onMove = (e: TouchEvent) => {
      if (!tracking) return;
      const t = e.touches[0];
      if (!t) return;
      const dx = t.clientX - startX;
      const dy = Math.abs(t.clientY - startY);
      // Cancel if the gesture becomes vertical (user is scrolling).
      if (dy > 40 && dy > dx) tracking = false;
    };

    const onEnd = (e: TouchEvent) => {
      if (!tracking) return;
      tracking = false;
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - startX;
      const dy = Math.abs(t.clientY - startY);
      const dt = Date.now() - startTime;
      const velocity = dx / Math.max(dt, 1); // px/ms
      const isSwipe = dx > 80 && dy < 60 && (dx > 140 || velocity > 0.4);
      if (!isSwipe) return;
      if (window.location.pathname === "/") return;

      try { navigator.vibrate?.(10); } catch { /* noop */ }
      const state: any = window.history.state;
      const idx = state?.__TSR_index ?? state?.index;
      if (typeof idx === "number" && idx > 0) {
        router.history.back();
      } else {
        router.navigate({ to: fallback });
      }
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
    };
  }, [router, fallback]);
}
