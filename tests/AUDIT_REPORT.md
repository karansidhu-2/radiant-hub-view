# Radiant Hub — E2E Audit & Bug Report

_Principal-QA audit run: mocked-backend Playwright suite in `tests/e2e/` +
static review of hot paths (`CartContext`, `AuthContext`,
`useRealtimeInvalidate`, checkout, RLS, MCP)._

All tests are hermetic: every Supabase REST / RPC / Auth call and every
TanStack `_serverFn` POST is intercepted by `tests/mocks/supabase.mjs`. No
live credentials, no staging environment required.

## Suites shipped

| File | Coverage |
|---|---|
| `tests/e2e/storefront-checkout.spec.mjs` | Shop grid, PDP, cart hydration, checkout render |
| `tests/e2e/booking-flow.spec.mjs`        | Services list, `?service=slug` deep-link, booking form |
| `tests/e2e/account-auth-gate.spec.mjs`   | `/account` auth wall, admin-only nav gating, `/admin` access |
| `tests/e2e/mcp-invoke-tool.spec.mjs`     | Unknown tool 4xx, malformed body, list-tools reachability |
| `tests/visual/checkout-price-manipulation.spec.mjs` (existing) | Server ignores client-supplied prices |
| `tests/visual/services-booking-flow.spec.mjs` (existing) | "Book this service" across every category |

Run individually: `node tests/e2e/<file>` (dev server on `:8080`).

---

## Bugs identified & fixed this pass

### 1. Public Shop & Services returned HTTP 401
- **Severity:** Critical (site-breaking regression, visible in live network logs)
- **Location:** RLS policies `Anyone views published products` / `services`
- **Cause:** Policies used `published = true OR has_role(auth.uid(),'admin')`.
  After we revoked `EXECUTE` on `has_role` from `anon` (security hardening),
  PostgREST returned `permission denied for function has_role` for every
  anonymous read, even for published rows.
- **Fix:** Split each into two permissive policies — `Public reads
  published <table>` (TO anon, authenticated: `published = true`) and
  `Admins read all <table>` (TO authenticated: `has_role(...)`). Anonymous
  reads no longer traverse the security-definer helper. Applied via migration
  in this turn.

### 2. Client-controlled Supabase auth-storage key was implicit
- **Severity:** Low (tests only)
- **Location:** `tests/mocks/supabase.mjs`
- **Cause:** Tests need to pre-seed a session; the browser client's
  `sb-<ref>-auth-token` key is undocumented in test scaffolding.
- **Fix:** `mockSession()` + `installSupabaseMocks({session})` inject the
  correct key via `addInitScript`.

## Bugs identified — remaining risk items

### 3. `AuthContext` self-heals admin role on every sign-in
- **Severity:** Medium
- **Location:** `src/context/AuthContext.tsx` lines 34–63
- **Explanation:** When `has_role('admin')` returns false, the client queries
  `admin_allowlist` for the user's email and, if matched, `INSERT`s a row into
  `user_roles`. Two issues:
  1. Any authenticated user can query `admin_allowlist` to enumerate admin
     emails unless RLS restricts it (verify policy).
  2. The `INSERT` into `user_roles` from the client relies on RLS to prevent
     escalation. If the `user_roles` insert policy ever loosens, a user could
     promote themselves.
- **Recommended fix:** Move the allowlist-driven grant into the
  `handle_new_user` trigger (already exists) and remove the client-side
  insert. `AuthContext` should read admin status via `has_role` only.

### 4. `CartContext` silently drops items whose product isn't in DB or seed
- **Severity:** Medium
- **Location:** `src/context/CartContext.tsx` lines 81–86
- **Explanation:** `detailed` filters out any cart item whose slug is
  unresolvable. If a product is unpublished mid-session, the item vanishes
  from the cart with no user notification, and the persisted `items` state
  still contains it (mismatch: badge count vs. checkout total).
- **Recommended fix:** Surface a toast/banner ("An item was removed because
  it's no longer available") when `items.length !== detailed.length`, and
  prune the offending slugs from persisted storage.

### 5. `CartContext` cart-lookup query never surfaces network errors
- **Severity:** Low
- **Location:** `src/context/CartContext.tsx` line 49
- **Explanation:** The `["cart","product-lookup"]` query has no `onError`
  handler and the component ignores `error` state. A failing query silently
  falls back to seed data — hiding a real outage from the user.
- **Recommended fix:** Add a `useEffect` that toasts on query error via the
  existing `error-toast.ts` helper.

### 6. `useRealtimeInvalidate` — subscribe race on rapid visibility flips
- **Severity:** Low
- **Location:** `src/hooks/useRealtimeInvalidate.ts` lines 70–82
- **Explanation:** `onVisibility` calls `unsubscribe()` immediately when the
  tab hides, but `supabase.removeChannel` is async. Toggling visibility
  faster than the removal completes can leave two overlapping subscriptions
  briefly — small extra websocket traffic; not a correctness bug.
- **Recommended fix:** Track a `pendingRemoval` promise and `await` it in
  `subscribe()` before creating the new channel.

### 7. Guest checkout + service booking cannot share a single order
- **Severity:** Medium (product design)
- **Location:** `src/routes/_site.checkout.tsx` + `src/lib/hvac.functions.ts`
- **Explanation:** Physical products are placed via `createOrder`; field
  service is placed via `createBooking`. There is no atomic path for a
  customer who wants "buy a thermostat + book installation" as one
  transaction — a partial failure leaves the user with an order but no
  scheduled booking (or vice versa).
- **Recommended fix:** Add a `createOrderWithBooking` server function that
  wraps both writes in a single Postgres transaction (via an RPC), or make
  the failure branch idempotent so the second step can be retried without
  duplicating the first.

### 8. MCP `/invoke-tool/$tool` handler is 19 lines and lacks input validation
- **Severity:** Medium (external attack surface)
- **Location:** `src/routes/[.mcp]/invoke-tool/$tool.ts`
- **Explanation:** As a public MCP endpoint, it accepts arbitrary tool
  arguments. Without per-tool Zod validation, a malformed argument can reach
  downstream Supabase writes.
- **Recommended fix:** Wire each MCP tool through its own Zod schema and
  reject early with an MCP protocol error object.

### 9. `_authenticated` gate only checks presence of user, not admin
- **Severity:** Info (by design)
- **Location:** `src/routes/_authenticated/route.tsx`
- **Explanation:** Every `/admin/*` route lives under `_authenticated`, but a
  non-admin authenticated user can hit `/admin` and only server-side RLS
  stops them from mutating data. The UI already hides the button (fixed
  earlier), but the URL is reachable.
- **Recommended fix:** Add a second guard component in `admin.tsx` that
  calls `useAuthContext()` and redirects non-admins to `/account`.

---

## Static-audit clean bill-of-health items

- `AuthContext` correctly uses `onAuthStateChange` + `getSession` combo (no
  duplicate listeners, cleanup on unmount).
- `CartContext` `useEffect` write-back is properly guarded by `hydrated` —
  no initial-render wipe of persisted cart.
- `useRealtimeInvalidate` debounces (400ms), coalesces (`refetchType:
  "active"` only), and pauses on hidden tab — the reported "infinite
  re-render risk" is not present.
- Vite + TanStack Start `defaultPreloadStaleTime: 0` is set in `getRouter`
  (verified when adding the analytics prefetch loader).

---

## Patches applied this turn

1. **RLS split for products & services** — resolves item 1 (see migration).
2. **Shared test mock harness** (`tests/mocks/supabase.mjs`) — provides
   `installSupabaseMocks`, `mockSession`, defaults for products / services /
   ZIPs / site settings, per-server-fn override hooks.
3. **Four new mocked E2E suites** — see table above.

Items 3–9 above are documented for a follow-up patch pass; they do not block
today's builds and each has an explicit fix path.
