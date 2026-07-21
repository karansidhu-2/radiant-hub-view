import { forwardRef, type ImgHTMLAttributes } from "react";
import { cdnSrcSet, cdnUrl, DEFAULT_WIDTHS } from "@/lib/cdn-image";

/**
 * Responsive, format-negotiating image.
 *
 * Renders a <picture> with AVIF + WebP + original srcsets pointing at the
 * image CDN. Browsers pick the smallest source they can decode; the CDN
 * caches each (width × format) URL at the edge.
 *
 * Non-http `src` values (blob:, data:, empty) bypass the CDN and render
 * as a plain <img> so uploads/previews still work.
 */
export interface SmartImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "srcSet"> {
  src: string;
  alt: string;
  /** Width ladder for srcset. Defaults to DEFAULT_WIDTHS. */
  widths?: number[];
  /** `sizes` attribute controlling which srcset entry the browser picks. */
  sizes?: string;
  /** Fallback `src` width (used when srcset isn't picked). Default 800. */
  fallbackWidth?: number;
  /** CDN quality 1-100. Default 78. */
  quality?: number;
  /** How the image should fill its box. Default "cover". */
  fit?: "cover" | "contain" | "inside";
  /** LCP hero? true = eager + high priority. Default false (lazy). */
  eager?: boolean;
}

export const SmartImage = forwardRef<HTMLImageElement, SmartImageProps>(function SmartImage(
  {
    src,
    alt,
    widths = DEFAULT_WIDTHS,
    sizes = "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw",
    fallbackWidth = 800,
    quality = 78,
    fit = "cover",
    eager = false,
    className,
    ...rest
  },
  ref,
) {
  const proxyable = /^https?:\/\//i.test(src);

  if (!proxyable) {
    return (
      <img
        ref={ref}
        src={src}
        alt={alt}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        className={className}
        {...rest}
      />
    );
  }

  const opts = { q: quality, fit };
  return (
    <picture>
      <source type="image/avif" srcSet={cdnSrcSet(src, widths, "avif", opts)} sizes={sizes} />
      <source type="image/webp" srcSet={cdnSrcSet(src, widths, "webp", opts)} sizes={sizes} />
      <img
        ref={ref}
        src={cdnUrl(src, { w: fallbackWidth, fmt: "origin", ...opts })}
        srcSet={cdnSrcSet(src, widths, "origin", opts)}
        sizes={sizes}
        alt={alt}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        // Hint LCP images to the browser scheduler.
        {...(eager ? { fetchPriority: "high" as const } : { fetchPriority: "low" as const })}
        className={className}
        {...rest}
      />
    </picture>
  );
});

export default SmartImage;
