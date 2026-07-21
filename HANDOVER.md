# Client Handover Checklist

Everything below is self-serve in the running app — no SQL required.

## 1. Claim admin access (first user wins)

The `admin_allowlist` is empty and no admin exists. The **very first person
to sign up** at `/auth` will be granted the `admin` role automatically by
the `handle_new_user` database trigger. Have the client (or their engineer)
sign up first, before opening the site to anyone else.

After the first admin exists, additional admins are added from
**`/admin/admins`** by adding their email to the allowlist — they then sign
up and are auto-granted.

## 2. Set company branding & contact info

Sign in as admin → **`/admin/settings`** → fill in:
- Company name & tagline
- Support phone, support email, emergency phone
- Address, business hours

These flow through the whole site (header, footer, contact page, invoices,
JSON-LD SEO, email templates).

## 3. Publish & connect the client's domain

1. Click **Publish** (top-right) to get the `<slug>.lovable.app` URL.
2. In **Project settings → Domains**, connect the client's domain
   (A record `185.158.133.1` for `@` and `www`, plus the TXT record shown
   in the dialog). SSL auto-provisions within ~72 hours.

## 4. Branded confirmation emails (recommended)

Emails currently send from the default Lovable sender. To send from
`notify@clientdomain.com`:

1. **Cloud → Emails → Set up email domain** — enter the client's domain.
2. Add the NS records shown in the dialog at the client's DNS provider.
3. Once verified, all booking/order confirmation emails (which flow through
   the outbox with retry/backoff) will send from the branded sender.

## 5. Seed catalog

Populate services and products in **`/admin/services`** and
**`/admin/products`**. Set stock thresholds so the admin dashboard warns
before running out. Upload product images (stored in the `product-images`
bucket, served through the CDN with AVIF/WebP responsive srcsets).

## 6. Set service area

**`/admin/zips`** — add every ZIP the client services. The public booking
form blocks bookings for uncovered ZIPs.

## 7. Crew capacity

**`/admin/settings`** → Crew capacity → toggle on and set the number of
technicians. **`/admin/technicians`** → add each technician with their
skills. Bookings are auto-load-balanced against this capacity; overflow
attempts show alternative slots to customers.

## 8. Optional but nice-to-have

- **Notification templates** — `/admin/notifications` — customize
  status-change emails.
- **Payments** — currently confirmation-only (no online payment). Enable
  Stripe if the client wants online prepay.
- **Custom domain email — MX/DMARC** — configure at the domain registrar
  or through the DNS manager if the domain was bought through Lovable.

---

## Security & QA status at handover

- **88/88 unit tests passing** (RLS, pricing, capacity, guards, error pages).
- **Security scan:** 0 critical / 0 high. The 5 remaining warnings are
  intentional `SECURITY DEFINER` helpers — documented as accepted risks in
  `security/AUDIT_REPORT.md` (R6).
- **RLS enabled** on all 20 public tables with owner-scoped policies.
- **Server-side price recomputation** — cart totals cannot be tampered with
  from the client.
- **DB-backed rate limiting** on booking, checkout, ZIP lookup, and MCP.
- **Email outbox with retry/backoff** — confirmations keep sending across
  provider blips.
- **Audit trail** — `admin_actions`, `rpc_audit_log`, `review_audit_log`,
  `capacity_conflicts`.
- **Security headers** — CSP, HSTS, X-Frame-Options, Referrer-Policy,
  Permissions-Policy set globally.
- **Observability** — first-party telemetry dashboard at
  `/admin/observability` (errors, Web Vitals, funnels).

## Known scale ceiling (disclose to client)

Comfortable up to ~few hundred concurrent users / hundreds of bookings/day
on the default single-region instance. For a nationwide rollout you'd want:
read replicas, Cloudflare Images (currently wsrv.nl free tier), and
Turnstile/CAPTCHA on the public forms.
