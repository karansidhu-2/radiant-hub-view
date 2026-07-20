# Security Audit Report — Radiant Hub (HVAC Pro)

Date: 2026-07-20  
Scope: full repository (`src/**`, `supabase/migrations/**`, `src/lib/mcp/**`, `src/routes/**`)  
Method: static analysis, live database policy inspection, Supabase linter, threat modelling.

## Executive summary

The application is in a **strong baseline security posture**: RLS is enabled on every
`public` table, service-role is server-only, admin functions verify the caller's role
before touching `supabaseAdmin`, prices/totals are recomputed server-side, rate-limits
and audit logs are in place, and secrets are not present in the client bundle. The audit
identified **6 remaining risks** (0 Critical, 2 High, 3 Medium, 1 Low). All are patched
in this turn.

---

## Risk register

### R1 — Confirmation lookup by reference returns full row (PII over-exposure)
- **OWASP:** A01:2021 Broken Access Control (BOLA / IDOR-adjacent)
- **Severity:** **High**
- **Location:** `src/lib/hvac.functions.ts` — `getBookingByRef`, `getOrderByRef`
- **Detail:** Both server functions are unauthenticated (reference acts as a capability
  token) and return `select("*")`, exposing every column of `bookings` / `orders` /
  `order_items` — including internal fields (`user_id`, admin notes, `service_charge`)
  and full PII. References are 8 hex chars (~4×10⁹ space). Without rate-limiting an
  attacker can enumerate references and harvest customer PII in bulk.
- **Exploit:** `POST /_serverFn/getBookingByRef` with brute-forced `BK-XXXXXXXX` values.
- **Fix:** Apply a per-IP rate limit (30/min) and narrow the `select()` to a
  confirmation-safe column set (no `user_id`, no admin notes, no `service_charge`).

### R2 — MCP `book_service` had no rate limit
- **OWASP:** A04:2021 Insecure Design
- **Severity:** **High**
- **Location:** `src/lib/mcp/tools/book-service.ts`
- **Detail:** Authenticated MCP callers could create bookings unbounded, exhausting
  crew capacity or spamming the calendar. The web `createBooking` server-fn is
  rate-limited (5/min); the MCP twin was not.
- **Exploit:** A compromised OAuth-client token calling `book_service` in a loop.
- **Fix:** Reuse `rateLimit("mcp.book_service", …)` and pass the caller's `userId`
  so the bucket keys on user + IP.

### R3 — Missing HTTP security response headers (CSP, XFO, HSTS, Referrer-Policy, Permissions-Policy)
- **OWASP:** A05:2021 Security Misconfiguration
- **Severity:** **Medium**
- **Location:** app-wide (`src/start.ts` had no header middleware)
- **Detail:** No CSP, `X-Frame-Options`, `X-Content-Type-Options`, HSTS, or
  `Referrer-Policy` shipped. A cross-origin frame or reflected asset could increase
  the impact of any future front-end bug. The Lovable preview must keep frame
  embedding enabled, so a strict `frame-ancestors` uses production-only enforcement.
- **Fix:** Add a `requestMiddleware` in `src/start.ts` that sets a strict, allow-listed
  CSP (Supabase + Google Fonts + Lovable telemetry), plus `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: SAMEORIGIN`
  (skipped in preview), `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`,
  and HSTS on HTTPS.

### R4 — MFA enrollment rendered `enroll.qr` via `dangerouslySetInnerHTML`
- **OWASP:** A03:2021 Injection (XSS)
- **Severity:** **Medium**
- **Location:** `src/routes/_authenticated.admin.security.tsx:94`
- **Detail:** Supabase's `mfa.enroll()` currently returns a `data:image/svg+xml`
  URL, but the field is documented as opaque and the app dumped it as raw HTML.
  A future Supabase change or a compromised session-restore payload could inject
  script into an admin's session.
- **Fix:** Render as `<img src={enroll.qr}>` (data URL is safe for `src`; the
  browser will refuse anything that isn't a valid image and cannot execute script).

### R5 — Confirmation & MCP flows did not audit-log denials for enumeration attempts
- **OWASP:** A09:2021 Security Logging & Monitoring Failures
- **Severity:** **Medium**
- **Location:** `getBookingByRef`, `getOrderByRef`, `book_service` MCP tool
- **Detail:** A miss (invalid reference) or an MCP booking rejection produced no
  audit trail, so an enumeration attempt is invisible.
- **Fix:** Log `lookup.denied` (with truncated ref prefix only) on missed lookups
  and `mcp.book_service.*` events into `rpc_audit_log`.

### R6 — Security-definer helpers callable by `anon`/`authenticated`
- **OWASP:** A05:2021 Security Misconfiguration
- **Severity:** **Low (accepted)**
- **Location:** `has_role`, `get_site_settings_public`, `get_product_auto_ratings`
- **Detail:** Supabase linter flags any `SECURITY DEFINER` function exposed to
  `anon`/`authenticated`. All three are **intentionally** callable:
  - `has_role` — the only safe way to check roles inside RLS without recursion.
  - `get_site_settings_public` — whitelisted contact-info fields for the public site.
  - `get_product_auto_ratings` — aggregated ratings for the public storefront.
- **Fix:** Documented in `security/memory` (this file + security-memory) as accepted risks
  with reasoning. Findings marked `ignore` with justification.

---

## Verified controls (no change required)

| Control | Evidence |
|---|---|
| RLS enabled on every `public` table | live pg_class query — 19/19 tables `relrowsecurity = true` |
| No policy allows `USING (true)` on user data | live pg_policies query — every non-public-catalog table scopes to `auth.uid()` or `has_role(...,'admin')` |
| No service-role key in client bundle | `rg SERVICE_ROLE src/` limited to `client.server.ts` (`.server.ts` files are stripped from client graph) |
| Prices recomputed server-side in checkout | `src/lib/hvac.functions.ts:211-246` — client `items` supply slug/qty only |
| Admin server-fns re-verify role | `assertAdmin()` at every admin handler entry (`hvac.functions.ts:352`) |
| Rate limits on booking/checkout/zip | `rate-limit.server.ts` + `check_and_hit_rate_limit` DB-backed sliding window |
| RPC audit log has admin-only SELECT | `rpc_audit_log` policy — `has_role(auth.uid(),'admin')` only |
| OAuth issuer pinned to direct Supabase host | `src/lib/mcp/index.ts` — `import.meta.env.VITE_SUPABASE_PROJECT_ID` |
| No `dangerouslySetInnerHTML` on user data | audit-report R4 is the only occurrence; also `chart.tsx` (shadcn, no user data) |
| Auth stored in Supabase-managed localStorage (not cookies) → CSRF-immune | `src/integrations/supabase/client.ts` (auto-gen) |

---

## Patches applied in this turn

1. `src/lib/hvac.functions.ts` — narrowed `getBookingByRef`/`getOrderByRef` columns,
   added `rateLimit("lookupBooking"|"lookupOrder", …)` and audit logging for misses.
2. `src/lib/mcp/tools/book-service.ts` — added `rateLimit("mcp.book_service", …)`
   keyed on `userId` and safer error surface.
3. `src/routes/_authenticated.admin.security.tsx` — replaced `dangerouslySetInnerHTML`
   with `<img>` for the TOTP QR.
4. `src/start.ts` — new `securityHeadersMiddleware` sets CSP, HSTS, XFO, XCTO,
   Referrer-Policy, Permissions-Policy on every HTML response.
5. Security memory updated with accepted-risk rationale for R6.
