import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

/**
 * Attach hardening HTTP response headers to every SSR response.
 *
 * CSP allow-list is deliberately narrow:
 *  - Supabase REST/Realtime + Storage
 *  - Fonts are self-hosted (Inter, same-origin) so no font CDN is allow-listed
 *  - Lovable telemetry/preview surfaces
 *  - `'unsafe-inline'` on styles because Tailwind ships inline critical CSS
 *  - `'wasm-unsafe-eval'` because TanStack Start needs it for SSR hydration in some paths
 *
 * `frame-ancestors` intentionally stays permissive (`*`) so the Lovable preview
 * iframe keeps working; `X-Frame-Options` is set to `SAMEORIGIN` only in
 * production (checked via `process.env.NODE_ENV`).
 */
const securityHeadersMiddleware = createMiddleware().server(async ({ next }) => {
  const result = await next();
  const response: Response | undefined = (result as any)?.response;
  if (!response || typeof response.headers?.set !== "function") return result;

  const ctype = response.headers.get("content-type") || "";

  // ---- Caching / compression negotiation -------------------------------
  // Hashed build assets are immutable: cache them for a year in the browser
  // and at the edge so repeat visits and client-side navigations cost 0 RTT.
  const url = (() => {
    try {
      return new URL((result as any)?.request?.url ?? "http://local/");
    } catch {
      return new URL("http://local/");
    }
  })();
  const isImmutableAsset =
    /^\/(assets|_build|_server)\//.test(url.pathname) ||
    /\.(js|mjs|css|woff2?|avif|webp|png|jpe?g|svg|ico)$/i.test(url.pathname);

  if (isImmutableAsset) {
    if (!response.headers.has("Cache-Control")) {
      response.headers.set("Cache-Control", "public, max-age=31536000, immutable");
    }
    // Let the CDN vary compressed variants correctly (br/gzip are applied by
    // the edge; we only need the negotiation header to be honoured).
    response.headers.append("Vary", "Accept-Encoding");
    return result;
  }

  // Only decorate HTML responses (skip JSON / RPC / static assets).
  if (!ctype.includes("text/html")) return result;

  // SSR HTML: serve instantly from the edge, revalidate in the background.
  if (!response.headers.has("Cache-Control")) {
    response.headers.set(
      "Cache-Control",
      "public, max-age=0, s-maxage=60, stale-while-revalidate=600",
    );
  }
  response.headers.append("Vary", "Accept-Encoding");


  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "form-action 'self'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://*.lovable.app https://*.lovable.dev https://*.lovableproject.com",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.lovable.app https://*.lovable.dev https://*.lovableproject.com",
    "frame-ancestors *",
    "upgrade-insecure-requests",
  ].join("; ");

  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=()",
  );
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  response.headers.set("X-DNS-Prefetch-Control", "off");
  if (process.env.NODE_ENV === "production") {
    response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
    // Do NOT set XFO in preview: the Lovable editor iframe would break.
    response.headers.set("X-Frame-Options", "SAMEORIGIN");
  }
  return result;
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [securityHeadersMiddleware, errorMiddleware],
}));
