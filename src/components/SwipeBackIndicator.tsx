import { useCallback, useEffect, useRef } from "react";
import { ChevronLeft } from "lucide-react";
import { useSwipeBack, type SwipeBackPhase } from "@/hooks/useSwipeBack";

/**
 * Renders an iOS-style progress arc pinned to the left edge that follows the
 * user's finger during an edge-swipe-back gesture. Uses direct DOM mutations
 * inside rAF to stay at 60fps without re-rendering the surrounding layout.
 */
export function SwipeBackIndicator({ fallback = "/" }: { fallback?: string }) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const fillRef = useRef<HTMLDivElement | null>(null);
  const iconRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const targetRef = useRef({ progress: 0, active: false, ready: false });

  const apply = useCallback(() => {
    rafRef.current = null;
    const w = wrapRef.current, f = fillRef.current, i = iconRef.current;
    if (!w || !f || !i) return;
    const { progress, active, ready } = targetRef.current;
    const p = Math.max(0, Math.min(1, progress));
    w.style.opacity = active ? String(0.15 + p * 0.85) : "0";
    w.style.transform = `translateX(${active ? Math.min(p * 8, 8) : -12}px)`;
    // Height of the visible arc segment grows with progress.
    f.style.height = `${40 + p * 90}px`;
    f.style.width = `${6 + p * 6}px`;
    f.style.background = ready
      ? "linear-gradient(180deg, hsl(var(--primary)) 0%, hsl(var(--primary)) 100%)"
      : "linear-gradient(180deg, hsl(var(--primary) / 0.9) 0%, hsl(var(--primary) / 0.55) 100%)";
    i.style.opacity = String(Math.min(1, p * 1.4));
    i.style.transform = `translateX(${p * 6}px) scale(${0.85 + p * 0.25})`;
    i.style.color = ready ? "hsl(var(--primary-foreground))" : "hsl(var(--primary))";
    i.style.background = ready ? "hsl(var(--primary))" : "transparent";
  }, []);

  const schedule = useCallback(() => {
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(apply);
  }, [apply]);

  const handleProgress = useCallback((progress: number, phase: SwipeBackPhase) => {
    const t = targetRef.current;
    if (phase === "start") {
      t.active = true;
      t.progress = 0;
      t.ready = false;
    } else if (phase === "move") {
      t.active = true;
      t.progress = progress;
      t.ready = progress >= 1;
    } else {
      // end or cancel — animate out.
      t.active = false;
      t.progress = 0;
      t.ready = false;
    }
    schedule();
  }, [schedule]);

  useSwipeBack({ fallback, onProgress: handleProgress });

  useEffect(() => () => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <div
      ref={wrapRef}
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-[60] hidden h-full items-center pl-1 [@media(pointer:coarse)]:flex"
      style={{ opacity: 0, transform: "translateX(-12px)", transition: "opacity 180ms ease, transform 220ms ease" }}
    >
      <div className="relative flex items-center gap-2">
        <div
          ref={fillRef}
          className="rounded-r-full shadow-[0_0_16px_hsl(var(--primary)/0.45)]"
          style={{ height: 40, width: 6, transition: "height 90ms ease-out, width 120ms ease-out, background 160ms ease" }}
        />
        <div
          ref={iconRef}
          className="grid h-9 w-9 place-items-center rounded-full ring-1 ring-primary/40 backdrop-blur-md"
          style={{ opacity: 0, transform: "translateX(0) scale(0.85)", transition: "opacity 120ms ease, transform 160ms ease, background 160ms ease, color 160ms ease" }}
        >
          <ChevronLeft className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
