# HVAC Pro — Complete SEO Plan

A phased plan to make HVAC Pro discoverable, crawlable, and rank-worthy for US HVAC service and product queries. Focus: local intent ("hvac repair near me", "ac installation [city]") + product/service transactional queries.

---

## Phase 1 — Technical Foundations

**Goal:** ensure Google can crawl, index, and understand every public page.

1. **Head metadata per route** (`src/routes/*.tsx` via `head()`):
   - Unique `<title>` (≤60 chars) and `meta description` (≤160 chars) for every public route: `/`, `/shop`, `/services`, `/services/$slug`, `/shop/$slug`, `/book`, `/contact`, `/about`, auth pages (noindex).
   - `og:title`, `og:description`, `og:type`, `og:url` per route.
   - `og:image` only on leaf routes (product/service detail) using the product/service image; omit elsewhere.
   - `<link rel="canonical">` on every leaf route, self-referencing.
2. **robots.txt** (`public/robots.txt`): allow all, disallow `/admin`, `/account`, `/auth`, `/checkout`; add `Sitemap:` line.
3. **Dynamic sitemap** (`src/routes/sitemap[.]xml.ts`): server route that lists `/`, `/shop`, `/services`, `/contact`, `/about`, plus all published services and products fetched from Supabase, plus service-area landing pages.
4. **Noindex protected areas**: `/admin/*`, `/account/*`, `/checkout`, `/auth` — add `{ name: "robots", content: "noindex, nofollow" }` in their `head()`.
5. **Performance signals (Core Web Vitals)**: verify LCP image on `/` is preloaded, defer non-critical scripts, keep the recent bundle wins (recharts lazy, jspdf lazy).

## Phase 2 — Structured Data (JSON-LD)

Injected via each route's `head().scripts`.

- **Root**: `LocalBusiness` / `HVACBusiness` with NAP (name, address, phone), `openingHours`, `areaServed`, `aggregateRating`.
- **`/services/$slug`**: `Service` schema with `provider`, `areaServed`, `offers`.
- **`/shop/$slug`**: `Product` schema with `offers`, `aggregateRating` (from `get_product_auto_ratings`), `review`.
- **`/about`, `/contact`**: `Organization` + `ContactPoint`.
- **All deep routes**: `BreadcrumbList`.
- **FAQ sections**: `FAQPage` on service pages.

## Phase 3 — Content & Information Architecture

1. **Service-area landing pages**: `/service-area/$zip` or `/hvac-[city]` for each ZIP the business covers — unique H1, local copy, embedded map, testimonials. Highest local-SEO leverage.
2. **Service pages rewrite**: each service page targets one primary keyword (e.g. "AC installation", "furnace repair") + long-tails. Include price ranges, process steps, FAQs, and a booking CTA.
3. **Blog / resource hub** (`/blog`): monthly posts on seasonal HVAC topics (winter furnace prep, SEER ratings, tax credits). Use `Article` JSON-LD.
4. **Internal linking**: services ↔ related products, blog posts → service pages, breadcrumb links.
5. **Copy audit**: single `<h1>` per page, semantic `<section>` / `<article>`, descriptive `alt` on every image (product images from Storage need `alt` from product name).

## Phase 4 — Local SEO

- Google Business Profile setup + Search Console verification via meta tag on `__root.tsx`.
- Bing Webmaster Tools verification.
- NAP consistency across site footer, contact page, and JSON-LD.
- Encourage post-service reviews (already in place) — surface `aggregateRating` in `Product`/`LocalBusiness` schema.
- Add embedded Google Map on `/contact`.

## Phase 5 — Monitoring & Iteration

- Wire Google Search Console (via connector) — track impressions, CTR, position per page.
- Weekly SEO scan via the built-in SEO tool.
- Semrush checks: `domain_analysis`, `keyword_research` for target terms, `serp_analysis` for local queries.
- 404 monitoring via the existing error boundary + analytics.

---

## Technical section (files touched)

- `src/routes/__root.tsx` — sitewide defaults, GSC verification meta, `LocalBusiness` JSON-LD.
- Every `src/routes/_site.*.tsx` — `head()` with title/description/og/canonical.
- `src/routes/_site.services.$slug.tsx`, `src/routes/_site.shop.$slug.tsx` — dynamic head + `Service`/`Product` JSON-LD from loader data.
- `src/routes/_authenticated.*`, `src/routes/auth.tsx`, `src/routes/_site.checkout.tsx` — `noindex`.
- `src/routes/sitemap[.]xml.ts` — new server route, queries Supabase for published rows.
- `public/robots.txt` — update with disallows + Sitemap directive.
- New: `src/routes/_site.service-area.$zip.tsx`, `src/routes/_site.blog.tsx`, `src/routes/_site.blog.$slug.tsx`.

## Suggested build order

1. Foundations: robots.txt, sitemap route, per-route metadata, noindex on protected routes.
2. Structured data: `LocalBusiness` root, `Product` + `Service` on detail pages, `BreadcrumbList`.
3. Search Console verification + submit sitemap.
4. Service-area landing pages (biggest local-SEO win).
5. Blog scaffold + first 3 posts.
6. Ongoing: monthly SEO scan, keyword tracking, content cadence.

Approve and I'll start with Phase 1 (foundations + per-route metadata + sitemap) in one pass.
