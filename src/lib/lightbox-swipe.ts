// Pure helpers for the ProductGallery lightbox swipe gesture.
// Kept framework-free so unit tests can validate thresholding and velocity
// behavior without a DOM or React.

export type SwipeDecision = -1 | 0 | 1;

export type SwipeParams = {
  /** Horizontal delta (px), positive = finger moved right */
  dx: number;
  /** Vertical delta (px) captured at the same moment */
  dy?: number;
  /** Elapsed time from touchstart to touchend in ms (>= 1) */
  elapsedMs: number;
  /** Width of the swipe area in px (>= 1) */
  width: number;
  /** Which axis the gesture was locked to, if any */
  lockedAxis?: "h" | "v" | null;
};

/**
 * Decide whether a horizontal touch swipe should navigate media.
 * Returns  1 when the user swiped LEFT (next), -1 when swiped RIGHT (previous),
 * and 0 when neither the distance nor the velocity threshold was met.
 *
 * Rules:
 *  - Only horizontal-locked gestures count.
 *  - Distance hit: |dx| > max(60px, 18% of container width).
 *  - Velocity hit: > 0.5 px/ms with at least 30px of travel.
 */
export function decideSwipe({
  dx,
  elapsedMs,
  width,
  lockedAxis = "h",
}: SwipeParams): SwipeDecision {
  if (lockedAxis !== "h") return 0;
  const w = Math.max(1, width);
  const t = Math.max(1, elapsedMs);
  const absDx = Math.abs(dx);
  const distanceHit = absDx > Math.max(60, w * 0.18);
  const velocity = absDx / t;
  const velocityHit = velocity > 0.5 && absDx > 30;
  if (!distanceHit && !velocityHit) return 0;
  return dx < 0 ? 1 : -1;
}

/**
 * While a touch is in progress, decide which axis to lock the gesture to.
 * Horizontal locks require a small dominance so vertical page scrolls stay
 * unblocked when the user genuinely wants to scroll the page.
 */
export function resolveAxisLock(
  dx: number,
  dy: number,
  opts: { horizontal?: number; vertical?: number } = {},
): "h" | "v" | null {
  const H = opts.horizontal ?? 8;
  const V = opts.vertical ?? 10;
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);
  if (adx > H && adx > ady) return "h";
  if (ady > V) return "v";
  return null;
}
