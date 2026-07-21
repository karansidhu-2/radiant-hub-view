/**
 * Image CDN helpers.
 *
 * We proxy Supabase Storage (or any absolute URL) through wsrv.nl — a free,
 * Cloudflare-backed image proxy — to get:
 *   - on-the-fly resizing (`w`, `h`, `fit=cover`)
 *   - format conversion (`output=avif|webp|jpg`)
 *   - long-lived edge caching (immutable per URL)
 *
 * We build one URL per (width × format) and let `<picture>` pick the best
 * one the browser accepts. Non-http inputs (blob:, data:, empty) are
 * returned untouched so uploads/previews still work.
 */
export type CdnFormat = "avif" | "webp" | "origin";

const WSRV = "https://wsrv.nl/";

/** True when `src` is something the CDN can proxy (absolute http[s]). */
function isProxyable(src: string): boolean {
  return /^https?:\/\//i.test(src);
}

/** Single CDN URL for one width + format. */
export function cdnUrl(
  src: string | null | undefined,
  opts: { w?: number; h?: number; q?: number; fmt?: CdnFormat; fit?: "cover" | "contain" | "inside" } = {},
): string {
  if (!src) return "";
  if (!isProxyable(src)) return src;
  const { w, h, q = 78, fmt = "origin", fit = "cover" } = opts;
  const params = new URLSearchParams();
  params.set("url", src);
  if (w) params.set("w", String(w));
  if (h) params.set("h", String(h));
  params.set("fit", fit);
  params.set("q", String(q));
  if (fmt !== "origin") params.set("output", fmt);
  // Slightly cheaper bytes at retina without visible loss.
  params.set("il", "");
  return `${WSRV}?${params.toString()}`;
}

/** `srcset` string for one format across a set of widths. */
export function cdnSrcSet(
  src: string | null | undefined,
  widths: number[],
  fmt: CdnFormat = "origin",
  opts: { q?: number; fit?: "cover" | "contain" | "inside" } = {},
): string {
  if (!src || !isProxyable(src)) return "";
  return widths
    .map((w) => `${cdnUrl(src, { w, fmt, ...opts })} ${w}w`)
    .join(", ");
}

/** Sensible default width ladder for product/content images. */
export const DEFAULT_WIDTHS = [320, 480, 640, 800, 1024, 1280, 1600];
