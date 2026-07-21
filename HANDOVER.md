# Radiant Hub — Handover Documentation

Enterprise-ready HVAC service booking + e-commerce platform. This document
covers architecture, deployment, and the sanitization sweep performed prior
to handover.

---

## 1. Architectural Overview

**Stack**
- **Frontend:** React 19 + TypeScript, TanStack Start v1 (SSR) on Vite 7
- **Styling:** Tailwind CSS v4 (design tokens in `src/styles.css`) + shadcn/ui
- **Data:** TanStack Query 5 with router-integrated loaders
- **Backend:** Lovable Cloud (managed Supabase) — Postgres + Auth + Storage + Edge
- **Server logic:** `createServerFn` (typed RPC) + `src/routes/api/**` for webhooks
- **Payments/Email:** Lovable AI Gateway (`LOVABLE_API_KEY`) with a durable
  `email_outbox` table + `pg_cron` retry drainer
- **Observability:** In-app dashboard (`/admin/observability`) backed by the
  `observability_events` table (pageviews, errors, Web Vitals, funnels)
- **Agent access:** MCP server at `/mcp` with Supabase OAuth consent

**Directory Layout**
```
src/
  routes/            file-based routing (TanStack)
    _site.*          public site (marketing, shop, book, account)
    _authenticated/  gated subtree (SSR off, client auth gate)
    admin.*          admin console (analytics, calendar, inbox, audit)
    api/public/*     unauthenticated HTTP endpoints (webhooks, cron)
  components/        UI + feature components
    ui/              shadcn primitives
  lib/               *.functions.ts (server RPC) + *.server.ts (server-only)
  integrations/
    supabase/        auto-generated clients — DO NOT EDIT
  hooks/  context/  styles.css
supabase/migrations/  SQL migrations (source of truth for schema + RLS)
tests/                Vitest suite (unit + mocked e2e)
```

**Key entry points**
- `src/router.tsx` — router bootstrap, QueryClient
- `src/routes/__root.tsx` — root layout, providers, global head metadata
- `src/start.ts` — TanStack Start server entry with auth middleware
- `src/routes/_authenticated/route.tsx` — Supabase auth gate (integration-managed)
- `supabase/migrations/` — 21 tables, all with RLS enabled and explicit GRANTs

---

## 2. Production Deployment Guide

### Step 1 — Publish via Lovable
Click **Publish** in Lovable to deploy. Preview and production URLs are
provisioned automatically. Custom domains attach through Project → Settings.

### Step 2 — Claim admin (self-serve, zero SQL)
On a fresh deployment the FIRST user who signs up is auto-granted the `admin`
role (via the `handle_new_user` trigger while `admin_allowlist` is empty and
no admin exists yet). Sign up immediately after deploy to secure the role.

To add more admins later: **Admin → Allowlist** — enter their email BEFORE
they sign up.

### Step 3 — Brand the site
**Admin → Settings** to set company name, tagline, support phone/email,
address, business hours, and emergency line. Values render across the
header, footer, contact page, and outbound emails.

### Step 4 — Populate the catalog
- **Admin → Services** to create service offerings, base price, and duration
- **Admin → Products** to upload images (product-images bucket) and stock
- **Admin → Service Areas** to add ZIP codes eligible for booking

### Step 5 — Configure email sender (optional but recommended)
In Lovable → Email Domains, verify your sender domain so confirmation
emails come from `service@yourdomain.com` instead of the default sender.

### Step 6 — Configure cron drainer
`pg_cron` is already scheduled to run `/api/public/hooks/process-email-outbox`
every minute. No action required — verify by checking `email_outbox` rows
transition from `pending` → `sent` after signup or booking.

### Environment Variables
See `.env.example` in the repo root. Only `VITE_*` and `SUPABASE_*` public
values live in `.env`. Secrets (`SUPABASE_SERVICE_ROLE_KEY`, `LOVABLE_API_KEY`)
are managed via the Lovable Secrets UI — never committed.

---

## 3. Sanitization Sweep — Summary of Fixes

### Phase 1: Security Hardening
- **Zero hardcoded secrets** — audited entire `src/`; all Supabase and API
  access resolves through `import.meta.env.VITE_*` (client) or
  `process.env.*` (server-only, inside `.handler()` bodies)
- **`.env.example`** written with documented, non-sensitive placeholders
- **RLS verified on all 21 public tables** — `admin_actions`,
  `admin_allowlist`, `bookings`, `capacity_conflicts`, `email_outbox`,
  `observability_events`, `order_items`, `orders`, `products`, `profiles`,
  `rate_limits`, `revenue_checkpoints`, `review_audit_log`, `reviews`,
  `rpc_audit_log`, `saved_addresses`, `service_areas`, `services`,
  `site_settings`, `technicians`, `user_roles`
- **No service-role usage in client bundles** — `client.server.ts` is only
  imported inside server-function handlers via dynamic `await import()`,
  keeping the service key out of every browser chunk
- **Input validation** — every mutating server fn uses Zod
  `.inputValidator()`; server-side price recomputation prevents client
  price tampering on checkout
- **Rate limiting** — DB-backed limiter (`check_and_hit_rate_limit`) guards
  booking and contact submissions
- **Admin gating** — role checked server-side via `has_role()` SECURITY
  DEFINER function; no client-only admin bypasses

### Phase 2: Codebase Hygiene
- No `console.log` / `console.debug` statements in client code
- Remaining `console.error` calls (3 total) live inside server-fn
  `.handler()` catch blocks for fire-and-forget email/audit logging —
  correct, stripped from client bundles
- Dependencies pruned during earlier passes; lockfile regenerated after
  latest TanStack version alignment

### Phase 3: Compilation & Runtime
- Strict TypeScript build passes with **zero errors**
- **88 Vitest tests passing** covering pricing, capacity, booking flows,
  RLS behavior, error boundaries, swipe gestures, lightbox thresholds
- Global error/not-found boundaries at root + branded `ErrorPages.tsx`
  for 401/403/permission/network states
- Global `unhandledrejection` listener + QueryClient retry policy

### Phase 4: Performance
- Admin, Account, and Confirmation routes lazy-loaded (~20 KB vs 397 KB)
- Product images via `SmartImage` → wsrv.nl CDN (AVIF/WebP srcset)
- LCP hero preloaded with `fetchpriority="high"` + responsive `sizes`
- 17 targeted DB indexes for admin queries and revenue rollups
- Skeleton shimmer components prevent CLS during data loads
- Visibility-aware polling (paused when tab hidden)

### Phase 5: Handover Artifacts
- `.env.example` — clean, no secrets
- `HANDOVER.md` — this document
- `tests/AUDIT_REPORT.md` — earlier architectural risk log
- CI workflow at `.github/workflows/test.yml` runs `bun run test` on PRs

---

## 4. Verification Commands

```bash
bun install
bun run test         # 88 tests
bun run build        # production build
```

Backend health: **Admin → Observability** (errors, Web Vitals, funnels).

Handover complete. The platform is enterprise-ready for a mid-market US
HVAC operator.
