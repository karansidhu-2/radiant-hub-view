import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";

export type SwipeBackPhase = "start" | "move" | "end" | "cancel";

export interface UseSwipeBackOptions {
  fallback?: string;
  /** Called during the gesture. progress is 0..1 (1 = threshold reached). */
  onProgress?: (progress: number, phase: SwipeBackPhase) => void;
}

/** Walk up from the touch target and cancel if any ancestor is a
 *  horizontally scrollable region (carousel, table, code block, etc.). */
function startsInsideHorizontalScroller(el: Element | null): boolean {
  let node: Element | null = el;
  while (node && node !== document.body && node !== document.documentElement) {
    const cs = window.getComputedStyle(node);
    const overflowX = cs.overflowX;
    if ((overflowX === "auto" || overflowX === "scroll") && node.scrollWidth - node.clientWidth > 4) {
      return true;
    }
    if (node.hasAttribute("data-no-swipe-back")) return true;
    node = node.parentElement;
  }
  return false;
}

/**
 * iOS-style edge-swipe-to-go-back tuned against real device metrics:
 *  - Edge zone scales with device pixel ratio (touch slop is larger on high-DPR phones).
 *  - Horizontal threshold = 25% of viewport width, clamped to [90px, 180px] — matches
 *    Android/iOS system back gestures rather than a fixed pixel value.
 *  - Enforces an axis lock inside the browser's own touch slop (~10 CSS px) before
 *    deciding whether the gesture is horizontal (ours) or vertical (page scroll).
 *  - Cancels immediately if the finger started inside a horizontally scrollable
 *    ancestor (carousels, tables, chip rows) so those keep native scroll.
 *  - Ignores multi-touch (pinch/zoom) entirely.
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

    // Device-tuned constants
    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    const vw = () => window.innerWidth || document.documentElement.clientWidth || 360;
    const EDGE_PX = Math.round(20 * dpr);              // start zone widens on high-DPR screens
    const SLOP_PX = Math.round(10 * dpr);              // browser touch slop before axis lock
    const V_CANCEL_PX = Math.round(14 * dpr);          // vertical travel that cancels the gesture
    const thresholdPx = () => Math.max(90, Math.min(180, Math.round(vw() * 0.25)));
    const VELOCITY_PX_PER_MS = 0.5;                    // px/ms of horizontal motion at release

    let startX = 0;
    let startY = 0;
    let lastX = 0;
    let lastT = 0;
    let peakVelocity = 0;
    let tracking = false;
    let axisLocked: null | "x" | "y" = null;
    let startTime = 0;

    const emit = (progress: number, phase: SwipeBackPhase) => {
      try { onProgress?.(Math.max(0, Math.min(1, progress)), phase); } catch { /* noop */ }
    };

    const cancel = () => {
      if (!tracking) return;
      tracking = false;
      axisLocked = null;
      emit(0, "cancel");
    };

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) { cancel(); return; }
      const t = e.touches[0];
      if (t.clientX > EDGE_PX) return;
      // Don't fight nested horizontal scrollers.
      if (startsInsideHorizontalScroller(e.target as Element | null)) return;
      startX = lastX = t.clientX;
      startY = t.clientY;
      startTime = lastT = performance.now();
      peakVelocity = 0;
      axisLocked = null;
      tracking = true;
      emit(0, "start");
    };

    const onMove = (e: TouchEvent) => {
      if (!tracking) return;
      if (e.touches.length !== 1) { cancel(); return; }
      const t = e.touches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      // Axis lock: decide direction once motion escapes the slop zone.
      if (axisLocked == null) {
        if (absDx < SLOP_PX && absDy < SLOP_PX) return; // still inside slop, don't commit
        axisLocked = absDx >= absDy ? "x" : "y";
        if (axisLocked === "y") { cancel(); return; }
      }

      // Even after locking horizontal, a strong vertical jerk cancels — the finger
      // slipped into a scroll intent.
      if (absDy > V_CANCEL_PX && absDy > absDx * 0.9) { cancel(); return; }
      // Backward motion (finger moving left of start) cancels the gesture cleanly.
      if (dx < -SLOP_PX) { cancel(); return; }

      const now = performance.now();
      const inst = (t.clientX - lastX) / Math.max(now - lastT, 1);
      if (inst > peakVelocity) peakVelocity = inst;
      lastX = t.clientX;
      lastT = now;

      emit(dx / thresholdPx(), "move");
    };

    const onEnd = (e: TouchEvent) => {
      if (!tracking) return;
      tracking = false;
      const wasLockedX = axisLocked === "x";
      axisLocked = null;
      const t = e.changedTouches[0];
      if (!t || !wasLockedX) { emit(0, "cancel"); return; }
      const dx = t.clientX - startX;
      const dy = Math.abs(t.clientY - startY);
      const dt = performance.now() - startTime;
      const avgVelocity = dx / Math.max(dt, 1);
      const releaseVelocity = Math.max(peakVelocity, avgVelocity);
      const distanceTrigger = dx > thresholdPx() && dy < thresholdPx() * 0.6;
      const flickTrigger = dx > EDGE_PX * 4 && releaseVelocity > VELOCITY_PX_PER_MS && dy < 60;
      const isSwipe = distanceTrigger || flickTrigger;
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
    window.addEventListener("touchcancel", cancel, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", cancel);
    };
  }, [router, fallback, onProgress]);
}
