import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { decideSwipe, resolveAxisLock } from "./lightbox-swipe";

describe("resolveAxisLock", () => {
  it("locks horizontal only when dx dominates and clears threshold", () => {
    expect(resolveAxisLock(9, 2)).toBe("h");
    expect(resolveAxisLock(7, 2)).toBe(null); // below H threshold
    expect(resolveAxisLock(20, 25)).toBe("v"); // dy dominates
  });
  it("locks vertical when dy passes threshold without dx dominance", () => {
    expect(resolveAxisLock(0, 12)).toBe("v");
    expect(resolveAxisLock(2, 20)).toBe("v");
  });
  it("returns null before any threshold is met", () => {
    expect(resolveAxisLock(3, 3)).toBe(null);
  });
});

describe("decideSwipe thresholding", () => {
  it("ignores vertical-locked gestures", () => {
    expect(decideSwipe({ dx: -400, elapsedMs: 200, width: 800, lockedAxis: "v" })).toBe(0);
  });

  it("does not navigate below distance and velocity thresholds", () => {
    // 50px < max(60, 800*0.18=144); velocity 50/500=0.1 px/ms -> both miss
    expect(decideSwipe({ dx: -50, elapsedMs: 500, width: 800 })).toBe(0);
  });

  it("navigates next (left swipe) when distance threshold is met", () => {
    expect(decideSwipe({ dx: -200, elapsedMs: 500, width: 800 })).toBe(1);
  });

  it("navigates previous (right swipe) when distance threshold is met", () => {
    expect(decideSwipe({ dx: 200, elapsedMs: 500, width: 800 })).toBe(-1);
  });

  it("uses the 60px floor on narrow containers", () => {
    // width*0.18 = 36, floor kicks in at 60
    expect(decideSwipe({ dx: -50, elapsedMs: 400, width: 200 })).toBe(0);
    expect(decideSwipe({ dx: -61, elapsedMs: 400, width: 200 })).toBe(1);
  });

  it("navigates on a quick flick that misses the distance threshold", () => {
    // 40px in 50ms => 0.8 px/ms, still > 30px so velocity gate applies
    expect(decideSwipe({ dx: -40, elapsedMs: 50, width: 800 })).toBe(1);
    expect(decideSwipe({ dx: 40, elapsedMs: 50, width: 800 })).toBe(-1);
  });

  it("ignores flicks below 30px even when fast", () => {
    expect(decideSwipe({ dx: -20, elapsedMs: 10, width: 800 })).toBe(0);
  });

  it("guards against zero elapsed time and zero width", () => {
    expect(() => decideSwipe({ dx: -200, elapsedMs: 0, width: 0 })).not.toThrow();
    expect(decideSwipe({ dx: -200, elapsedMs: 0, width: 0 })).toBe(1);
  });
});

// ---------- Integration: swipe area listeners prevent page scroll ----------
//
// We attach the same listener wiring used by the Lightbox to a plain DOM node
// and dispatch synthetic TouchEvents. jsdom doesn't implement TouchEvent, so
// we synthesize one via CustomEvent and inject a `touches` list.

function makeTouch(x: number, y: number) {
  return { clientX: x, clientY: y } as Touch;
}

function fireTouch(el: Element, type: string, touches: Touch[]) {
  const ev = new Event(type, { bubbles: true, cancelable: true }) as TouchEvent;
  Object.defineProperty(ev, "touches", { value: touches, configurable: true });
  Object.defineProperty(ev, "changedTouches", { value: touches, configurable: true });
  el.dispatchEvent(ev);
  return ev;
}

/** Mirror of the Lightbox swipe wiring, kept in sync with ProductGallery. */
function attachSwipe(
  el: HTMLElement,
  onNavigate: (dir: -1 | 1) => void,
  now: () => number = () => performance.now(),
) {
  let start: { x: number; y: number; t: number } | null = null;
  let delta = { x: 0, y: 0 };
  let locked: "h" | "v" | null = null;
  const onStart = (e: TouchEvent) => {
    const t = e.touches[0];
    start = { x: t.clientX, y: t.clientY, t: now() };
    delta = { x: 0, y: 0 };
    locked = null;
  };
  const onMove = (e: TouchEvent) => {
    if (!start) return;
    const t = e.touches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    delta = { x: dx, y: dy };
    if (!locked) locked = resolveAxisLock(dx, dy);
    if (locked === "h") e.preventDefault();
  };
  const onEnd = () => {
    if (!start) return;
    const decision = decideSwipe({
      dx: delta.x,
      elapsedMs: now() - start.t,
      width: el.clientWidth || 1,
      lockedAxis: locked,
    });
    start = null;
    locked = null;
    if (decision !== 0) onNavigate(decision);
  };
  el.addEventListener("touchstart", onStart as EventListener, { passive: true });
  el.addEventListener("touchmove", onMove as EventListener, { passive: false });
  el.addEventListener("touchend", onEnd as EventListener, { passive: true });
  el.addEventListener("touchcancel", onEnd as EventListener, { passive: true });
  return () => {
    el.removeEventListener("touchstart", onStart as EventListener);
    el.removeEventListener("touchmove", onMove as EventListener);
    el.removeEventListener("touchend", onEnd as EventListener);
    el.removeEventListener("touchcancel", onEnd as EventListener);
  };
}

describe("swipe listener integration", () => {
  let el: HTMLDivElement;
  let cleanup: () => void;
  let nav: ReturnType<typeof vi.fn<(dir: -1 | 1) => void>>;
  let clock: number;



  beforeEach(() => {
    clock = 1000;
    el = document.createElement("div");
    Object.defineProperty(el, "clientWidth", { value: 800, configurable: true });
    document.body.appendChild(el);
    nav = vi.fn();
    cleanup = attachSwipe(el, nav, () => clock);
  });
  afterEach(() => {
    cleanup();
    el.remove();
  });

  it("preventDefault() fires on horizontal move (page scroll blocked)", () => {
    fireTouch(el, "touchstart", [makeTouch(400, 300)]);
    const move = fireTouch(el, "touchmove", [makeTouch(370, 302)]); // dx=-30, dy=2 -> h lock
    expect(move.defaultPrevented).toBe(true);
  });

  it("does NOT preventDefault on vertical move (page scroll allowed)", () => {
    fireTouch(el, "touchstart", [makeTouch(400, 300)]);
    const move = fireTouch(el, "touchmove", [makeTouch(402, 340)]); // dy=40, dx=2 -> v lock
    expect(move.defaultPrevented).toBe(false);
  });

  it("advances to next media on a long horizontal swipe", () => {
    fireTouch(el, "touchstart", [makeTouch(600, 300)]);
    clock += 300;
    fireTouch(el, "touchmove", [makeTouch(400, 305)]); // dx=-200
    clock += 50;
    fireTouch(el, "touchend", []);
    expect(nav).toHaveBeenCalledWith(1);
  });

  it("advances on a fast flick even under distance threshold", () => {
    fireTouch(el, "touchstart", [makeTouch(600, 300)]);
    clock += 40; // fast
    fireTouch(el, "touchmove", [makeTouch(560, 302)]); // dx=-40
    fireTouch(el, "touchend", []);
    expect(nav).toHaveBeenCalledWith(1);
  });

  it("ignores a slow small drag", () => {
    fireTouch(el, "touchstart", [makeTouch(600, 300)]);
    clock += 800;
    fireTouch(el, "touchmove", [makeTouch(560, 302)]); // dx=-40, slow, below 60/144
    fireTouch(el, "touchend", []);
    expect(nav).not.toHaveBeenCalled();
  });

  it("does not navigate when locked vertical, regardless of dx at end", () => {
    fireTouch(el, "touchstart", [makeTouch(400, 300)]);
    clock += 30;
    fireTouch(el, "touchmove", [makeTouch(402, 340)]); // v-lock first
    clock += 200;
    fireTouch(el, "touchmove", [makeTouch(200, 345)]); // large dx after lock
    fireTouch(el, "touchend", []);
    expect(nav).not.toHaveBeenCalled();
  });
});
