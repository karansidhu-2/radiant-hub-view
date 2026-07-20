import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";

export type SwipeBackPhase = "start" | "move" | "end" | "cancel";

export interface UseSwipeBackOptions {
  fallback?: string;
  /** Called during the gesture. progress is 0..1 (1 = threshold reached). */
  onProgress?: (progress: number, phase: SwipeBackPhase) => void;
}

/**
 * Enable iOS-style edge-swipe-to-go-back on mobile.
 * - Swipe must start within the left ~24px of the viewport.
 * - Must travel > 140px OR have enough velocity with > 80px horizontal motion.
 * - Only active on touch (coarse pointer) devices.
 * - Emits progress updates so callers can render a visual indicator.
 */
export function useSwipeBack(
  fallbackOrOptions: string | UseSwipeBackOptions = "/",
  maybeOptions?: UseSwipeBackOptions,
) {
  const router = useRouter();
  const opts: UseSwipeBackOptions =
    typeof fallbackOrOptions === "string"
      ? { fallback: fallbackOrOptions, ...(maybeOptions || {}) }
      : fallbackOrOptions;
  const fallback = opts.fallback ?? "/";
  const onProgress = opts.onProgress;

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.matchMedia?.("(pointer: coarse)").matches) return;

    const THRESHOLD_PX = 140;
    let startX = 0;
    let startY = 0;
    let tracking = false;
    let startTime = 0;

    const emit = (progress: number, phase: SwipeBackPhase) => {
      try { onProgress?.(Math.max(0, Math.min(1, progress)), phase); } catch { /* noop */ }
    };

    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      if (t.clientX > 24) return;
      startX = t.clientX;
      startY = t.clientY;
      startTime = Date.now();
      tracking = true;
      emit(0, "start");
    };

    const onMove = (e: TouchEvent) => {
      if (!tracking) return;
      const t = e.touches[0];
      if (!t) return;
      const dx = t.clientX - startX;
      const dy = Math.abs(t.clientY - startY);
      if (dy > 40 && dy > dx) {
        tracking = false;
        emit(0, "cancel");
        return;
      }
      emit(dx / THRESHOLD_PX, "move");
    };

    const onEnd = (e: TouchEvent) => {
      if (!tracking) return;
      tracking = false;
      const t = e.changedTouches[0];
      if (!t) { emit(0, "cancel"); return; }
      const dx = t.clientX - startX;
      const dy = Math.abs(t.clientY - startY);
      const dt = Date.now() - startTime;
      const velocity = dx / Math.max(dt, 1);
      const isSwipe = dx > 80 && dy < 60 && (dx > THRESHOLD_PX || velocity > 0.4);
      emit(isSwipe ? 1 : 0, "end");
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
    window.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, [router, fallback, onProgress]);
}
