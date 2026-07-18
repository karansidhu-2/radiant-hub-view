import { useEffect, useRef, useState } from "react";

/**
 * Lightweight pull-to-refresh for mobile.
 * Only activates when the page is scrolled to the top and the user pulls down
 * past `threshold` px. Calls onRefresh() and shows the indicator until the
 * returned promise resolves.
 */
export function usePullToRefresh(onRefresh: () => Promise<unknown> | void, threshold = 70) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);

  useEffect(() => {
    const isTouch = typeof window !== "undefined" && "ontouchstart" in window;
    if (!isTouch) return;

    const onStart = (e: TouchEvent) => {
      if (window.scrollY > 0 || refreshing) return;
      startY.current = e.touches[0].clientY;
    };
    const onMove = (e: TouchEvent) => {
      if (startY.current == null) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy > 0) {
        setPull(Math.min(dy * 0.5, threshold * 1.4));
      }
    };
    const onEnd = async () => {
      if (startY.current == null) return;
      startY.current = null;
      if (pull >= threshold) {
        setRefreshing(true);
        try { await onRefresh(); } finally { setRefreshing(false); setPull(0); }
      } else {
        setPull(0);
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
  }, [pull, refreshing, threshold, onRefresh]);

  return { pull, refreshing, threshold };
}
