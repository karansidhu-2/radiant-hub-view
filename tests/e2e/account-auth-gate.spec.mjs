/**
 * E2E: authenticated /account gate with a mocked Supabase session.
 * Also asserts the sign-in redirect path when session is absent.
 * Run: node tests/e2e/account-auth-gate.spec.mjs
 */
import { chromium } from "playwright";
import { installSupabaseMocks, mockSession } from "../mocks/supabase.mjs";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:8080";
const failures = [];
const fail = (m) => { console.error("✗", m); failures.push(m); };
const ok = (m) => console.log("✓", m);

async function withPage(fn) {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1600 } });
  const page = await ctx.newPage();
  try { await fn(page); } finally { await browser.close(); }
}

async function run() {
  // Unauthenticated → protected route bounces to /auth
  await withPage(async (page) => {
    await installSupabaseMocks(page, { session: null });
    await page.goto(`${BASE_URL}/account`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});
    if (!/\/auth/.test(page.url())) fail(`Expected redirect to /auth, got ${page.url()}`);
    else ok("Unauthenticated /account redirects to /auth");
  });

  // Authenticated → renders account UI, admin nav HIDDEN for non-admin
  await withPage(async (page) => {
    await installSupabaseMocks(page, { session: mockSession(), isAdmin: false });
    await page.goto(`${BASE_URL}/account`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});
    if (/\/auth/.test(page.url())) fail(`Authenticated user was bounced to /auth: ${page.url()}`);
    else ok("Authenticated /account renders");

    const body = await page.locator("body").innerText();
    if (/Admin Panel/i.test(body)) fail("Non-admin user sees Admin Panel entry");
    else ok("Admin Panel entry hidden for non-admin");
  });

  // Admin session → Admin Panel visible, /admin renders
  await withPage(async (page) => {
    await installSupabaseMocks(page, { session: mockSession(), isAdmin: true });
    await page.goto(`${BASE_URL}/admin`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});
    if (/\/auth/.test(page.url())) fail(`Admin bounced to /auth: ${page.url()}`);
    else ok("Admin session reaches /admin");
  });
}

run()
  .then(() => {
    if (failures.length) { console.error(`\n✗ ${failures.length} failure(s)`); process.exit(1); }
    console.log("\n✓ Auth gate mocked E2E passed");
  })
  .catch((e) => { console.error("Runner crashed:", e); process.exit(1); });
