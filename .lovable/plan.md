# HVAC Pro — US HVAC Service & Installation Site

Transform the current Xero landing into **HVAC Pro**, a US-based heating, ventilation, and air conditioning service company site. Customers can browse services, shop HVAC equipment, add products to a cart, and book installation or service appointments.

## Pages / Routes

```text
/                → Home (hero, services overview, featured products, trust badges, CTA)
/services        → All services (AC repair, furnace install, duct cleaning, tune-ups, IAQ, emergency)
/services/$slug  → Service detail + "Book this service" CTA
/shop            → Product catalog (AC units, furnaces, heat pumps, thermostats, filters, mini-splits)
/shop/$slug      → Product detail + "Add to cart (with installation)"
/cart            → Cart with product lines, optional installation add-on per item, totals
/book            → Booking form (service type, address, date/time, contact, notes) → confirmation
/about           → Company story, licensing (EPA/NATE), service area, team
/contact         → Phone, email, address, 24/7 emergency line, contact form
```

Each route gets its own `head()` metadata (title, description, og). Cart persists in `localStorage` via a small React context.

## Home Sections

- **Hero** — headline "Reliable HVAC service across the US", subhead, primary CTA "Book Service", secondary "Shop Systems". Trust strip: Licensed & Insured · EPA Certified · NATE-Certified Techs · 24/7 Emergency.
- **Services grid** — 6 cards: AC Repair, Furnace Repair, New System Install, Duct Cleaning, Maintenance Plans, Indoor Air Quality.
- **Featured products** — 4 cards linking to `/shop`.
- **How it works** — 3 steps: Choose service/product → Book a time → We install & service.
- **Service area** — states/regions covered, ZIP lookup (client-side stub).
- **Testimonials** — 3 short quotes.
- **Financing & warranty** banner.
- **Footer** — nav, emergency phone, address, socials.

## Shop / Cart / Booking Details

- Product model: `{ slug, name, category, brand, price, seerRating?, capacityBTU?, image, description, features[] }`. ~12 seed products across categories.
- Product card: image, name, brand, price, "Add to cart" (default with installation add-on toggle).
- Cart line: product + qty + `includeInstallation` boolean (installation fee shown separately, e.g. flat $499 for AC units, $399 furnaces, $99 thermostats).
- Cart totals: subtotal, installation total, estimated tax note, grand total. "Proceed to booking" → `/book?fromCart=1` pre-fills service = "Installation".
- Booking form fields: full name, phone, email, service address (street/city/state/ZIP), service type (dropdown incl. Installation, Repair, Maintenance, Emergency), preferred date, time window (Morning/Afternoon/Evening), notes. Zod validation client-side; submit shows a confirmation screen with a reference number (generated client-side).
- No backend/Cloud in this pass — booking + cart live in local state / localStorage. If persistence or real emails are needed later, we enable Lovable Cloud then.

## Design System

- Reset current pink/purple hero styling. New palette in `src/styles.css`:
  - Primary: deep HVAC blue (cool trust) — e.g. oklch around `0.45 0.15 250`.
  - Accent: warm ember orange for heating/CTA highlights — e.g. oklch around `0.72 0.17 55`.
  - Neutrals: near-white background, dark slate text (light theme; readable, professional).
- Typography: keep Inter (already loaded). Bold, large headings; comfortable body sizing.
- Components via shadcn primitives (Button, Card, Input, Select, Sheet for mobile cart, Badge, Separator).
- Icons via `lucide-react` (Wind, Flame, Snowflake, Wrench, ShieldCheck, PhoneCall, ShoppingCart, MapPin, Star, etc.).
- Keep animations subtle: fade/scale-in on scroll for section reveals.

## Technical Section

- Cart state: `src/context/CartContext.tsx` with `useCart()` hook, `localStorage` sync.
- Seed data: `src/data/services.ts`, `src/data/products.ts` (pure TS arrays, no fetch).
- Route files under `src/routes/` per TanStack file-based routing; each route defines `head()`.
- Shared `<SiteHeader />` and `<SiteFooter />` used in a pathless layout `src/routes/_site.tsx` wrapping all pages so index/about/shop share nav.
- Remove `XeroHero` component, `xero-hero.css`, and Xero-specific brand markup. Update `__root.tsx` title/description to HVAC Pro.
- Add `sitemap.xml` route listing all static pages, and `public/robots.txt`.
- Images: use generated hero image (technician working on outdoor AC unit) + a few product/service illustrations via `imagegen`. All hosted in `src/assets/` and imported.
- Forms validated with `zod` + `react-hook-form` (already available via shadcn form).

## Out of Scope (this pass)

- Real payment processing / checkout (cart ends at "Book installation").
- Real backend persistence for bookings (would need Lovable Cloud).
- Live tech dispatch / calendar sync.
- Multi-language / currency.

Approve to build, or tell me what to adjust (fewer pages, different palette, add Cloud for real bookings, etc.).