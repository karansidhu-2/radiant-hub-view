/**
 * Shared Supabase / server-fn mock helper for mocked E2E tests.
 *
 * Usage:
 *   import { installSupabaseMocks, mockSession } from "./mocks/supabase.mjs";
 *   await installSupabaseMocks(page, { products, services, session });
 *
 * The goal: keep tests hermetic. Every Supabase REST/RPC/Auth call and every
 * TanStack server-function POST is intercepted; no real network egress and no
 * dependency on live credentials.
 */

export const DEFAULT_PRODUCTS = [
  {
    slug: "aprilaire-413-filter",
    name: "Aprilaire 413 Filter",
    brand: "Aprilaire",
    category: "filter",
    price: 89,
    installation_fee: 49,
    description: "High-efficiency media filter.",
    features: ["MERV 13", "Long life"],
    tag: null,
    seer: null,
    capacity_btu: null,
    hspf: null,
    published: true,
    available: true,
    stock: 42,
    low_stock_threshold: 5,
    media: [],
    image_url: null,
  },
  {
    slug: "nest-thermostat",
    name: "Nest Learning Thermostat",
    brand: "Google",
    category: "thermostat",
    price: 249,
    installation_fee: 99,
    description: "Smart thermostat.",
    features: ["Wi-Fi", "Auto-schedule"],
    tag: "popular",
    seer: null,
    capacity_btu: null,
    hspf: null,
    published: true,
    available: true,
    stock: 12,
    low_stock_threshold: 3,
    media: [],
    image_url: null,
  },
];

export const DEFAULT_SERVICES = [
  {
    slug: "ac-tune-up",
    name: "AC Tune-Up",
    category: "maintenance",
    description: "Seasonal tune-up.",
    price: 129,
    duration_minutes: 60,
    features: ["Refrigerant check"],
    published: true,
  },
  {
    slug: "emergency-repair",
    name: "Emergency Repair",
    category: "emergency",
    description: "24/7 repair.",
    price: 189,
    duration_minutes: 90,
    features: ["24/7"],
    published: true,
  },
];

export const DEFAULT_SITE_SETTINGS = {
  company_name: "HVAC Pro",
  tagline: "Trusted heating & cooling experts",
  support_phone: "(800) 555-0199",
  support_email: "support@hvacpro.com",
  address: "123 Main St, Dallas, TX 75201",
  business_hours: "Mon–Sat 7am–8pm",
  emergency_phone: "(800) 555-0911",
};

export const DEFAULT_ZIPS = [
  { zip: "10001", city: "New York", state: "NY", covered: true },
  { zip: "94105", city: "San Francisco", state: "CA", covered: true },
];

export function mockSession(overrides = {}) {
  return {
    access_token: "mock-access-token",
    refresh_token: "mock-refresh-token",
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    expires_in: 3600,
    token_type: "bearer",
    user: {
      id: "00000000-0000-0000-0000-00000000abcd",
      email: "customer@example.com",
      aud: "authenticated",
      role: "authenticated",
      app_metadata: { provider: "email" },
      user_metadata: { full_name: "Test Customer" },
      created_at: new Date().toISOString(),
      ...overrides.user,
    },
    ...overrides,
  };
}

function json(body, status = 200, extraHeaders = {}) {
  return {
    status,
    contentType: "application/json",
    headers: {
      "access-control-allow-origin": "*",
      "access-control-expose-headers": "content-range",
      ...extraHeaders,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  };
}

/**
 * Install a Playwright route interceptor for Supabase + server-fn calls.
 *
 * @param {import('playwright').Page} page
 * @param {object} [opts]
 * @param {any[]} [opts.products]        Rows returned for products.select
 * @param {any[]} [opts.services]        Rows returned for services.select
 * @param {any}   [opts.siteSettings]    Row for get_site_settings_public RPC
 * @param {any[]} [opts.zips]            service_areas rows
 * @param {any}   [opts.session]         Pre-authenticate user (null = signed out)
 * @param {boolean} [opts.isAdmin=false] has_role('admin') result
 * @param {object} [opts.handlers]       Override per-server-fn behaviour, keyed
 *                                       by export name (e.g. createOrder, createBooking)
 */
export async function installSupabaseMocks(page, opts = {}) {
  const state = {
    products: opts.products ?? DEFAULT_PRODUCTS,
    services: opts.services ?? DEFAULT_SERVICES,
    siteSettings: opts.siteSettings ?? DEFAULT_SITE_SETTINGS,
    zips: opts.zips ?? DEFAULT_ZIPS,
    session: opts.session ?? null,
    isAdmin: Boolean(opts.isAdmin),
    handlers: opts.handlers ?? {},
    orders: [],
    bookings: [],
    reviews: [],
    calls: [],
  };
  page.__mockState = state;

  // Inject the session into localStorage under the Supabase auth key BEFORE
  // React mounts — matches how supabase-js hydrates.
  if (state.session) {
    await page.addInitScript((session) => {
      const KEY = "sb-fwdysvinyusuijplooex-auth-token";
      try { localStorage.setItem(KEY, JSON.stringify(session)); } catch {}
    }, state.session);
  }

  await page.route("**/*", async (route) => {
    const req = route.request();
    const url = req.url();
    const method = req.method();

    // Only intercept Supabase + server-fn traffic; everything else (assets,
    // HTML, fonts) passes through to the dev server / origin.
    const isSupabase = /\.supabase\.co\//.test(url);
    const isServerFn = /\/_serverFn\//.test(url);
    if (!isSupabase && !isServerFn) return route.continue();

    state.calls.push({ url, method });

    // -------- Supabase Auth --------
    if (/\/auth\/v1\/token/.test(url) && method === "POST") {
      if (state.session) return route.fulfill(json(state.session));
      return route.fulfill(json({ error: "invalid_grant" }, 400));
    }
    if (/\/auth\/v1\/user/.test(url)) {
      if (state.session) return route.fulfill(json(state.session.user));
      return route.fulfill(json({ msg: "no session" }, 401));
    }
    if (/\/auth\/v1\/logout/.test(url)) return route.fulfill(json({}, 204));

    // -------- Supabase RPC --------
    const rpcMatch = url.match(/\/rest\/v1\/rpc\/([^?]+)/);
    if (rpcMatch) {
      const fn = rpcMatch[1];
      if (fn === "get_site_settings_public") return route.fulfill(json([state.siteSettings]));
      if (fn === "has_role") return route.fulfill(json(state.isAdmin));
      if (fn === "check_and_hit_rate_limit") return route.fulfill(json(true));
      if (fn === "get_product_auto_ratings") return route.fulfill(json([]));
      return route.fulfill(json(null));
    }

    // -------- Supabase REST (PostgREST) --------
    const restMatch = url.match(/\/rest\/v1\/([^?]+)/);
    if (restMatch) {
      const table = restMatch[1];
      if (method === "GET") {
        if (table === "products") return route.fulfill(json(state.products));
        if (table === "services") return route.fulfill(json(state.services));
        if (table === "service_areas") return route.fulfill(json(state.zips));
        if (table === "site_settings") return route.fulfill(json([state.siteSettings]));
        if (table === "user_roles") return route.fulfill(json(state.isAdmin ? [{ role: "admin" }] : []));
        if (table === "admin_allowlist") return route.fulfill(json([]));
        if (table === "bookings") return route.fulfill(json(state.bookings));
        if (table === "orders") return route.fulfill(json(state.orders));
        if (table === "reviews") return route.fulfill(json(state.reviews));
        if (table === "capacity_conflicts") return route.fulfill(json([]));
        if (table === "saved_addresses") return route.fulfill(json([]));
        if (table === "technicians") return route.fulfill(json([]));
        return route.fulfill(json([]));
      }
      if (method === "POST" || method === "PATCH") {
        const body = safeJson(req.postData());
        if (table === "bookings" && Array.isArray(body)) state.bookings.push(...body);
        if (table === "orders" && Array.isArray(body)) state.orders.push(...body);
        if (table === "reviews" && Array.isArray(body)) state.reviews.push(...body);
        return route.fulfill(json(Array.isArray(body) ? body : [body], 201));
      }
      if (method === "DELETE") return route.fulfill(json([], 204));
    }

    // -------- Supabase realtime (WebSocket upgrade requests) --------
    if (/\/realtime\/v1/.test(url)) return route.fulfill(json({}, 200));

    // -------- TanStack server-function RPC --------
    if (isServerFn) {
      // Server fn hash lives in the path; decode to get the export name.
      const hash = url.split("/_serverFn/")[1].split("?")[0];
      let exportName = "";
      try {
        const decoded = JSON.parse(atob(hash));
        exportName = String(decoded.export ?? "");
      } catch {}
      const key = exportName.replace(/_createServerFn_handler$/, "");
      const custom = state.handlers[key];
      const result = typeof custom === "function"
        ? await custom({ req, state })
        : defaultServerFnResult(key, req, state);
      // Server fns respond with x-tss-framed; a plain JSON envelope is
      // accepted by the router when Content-Type is application/json.
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ result }),
      });
    }

    return route.continue();
  });
}

function safeJson(s) { try { return JSON.parse(s ?? "null"); } catch { return null; } }

function defaultServerFnResult(name, req, state) {
  const body = safeJson(req.postData());
  const data = body?.data ?? body?.t ?? null;
  switch (name) {
    case "createOrder":
      return { reference: `ORD-MOCK-${Date.now()}`, id: "order-mock", total: 0 };
    case "createBooking":
      return { reference: `BKG-MOCK-${Date.now()}`, id: "booking-mock" };
    case "getBookedSlots":
      return { hours: [], counts: {}, capacity: 1 };
    case "checkZip":
    case "verifyServiceArea":
      return { covered: true, city: "New York", state: "NY" };
    case "listProductsPublic":
      return state.products;
    case "listServicesPublic":
      return state.services;
    default:
      return { ok: true, mocked: name, echoed: data };
  }
}
