/**
 * E2E: secure sign-out wipes BOTH localStorage and sessionStorage.
 *
 * Simulates a logged-in user whose Supabase client happens to have written
 * bits into both storages (real deployments can leave verifier keys, PKCE
 * state, etc. in sessionStorage), then triggers the app's signOut() and
 * asserts every `sb-*` / `supabase.*` / `hvac:auth:*` key is gone from
 * both storages after the redirect.
 *
 * Run: node tests/e2e/secure-signout.spec.mjs
 */
import { chromium } from "playwright";
import { installSupabaseMocks, mockSession } from "../mocks/supabase.mjs";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:8080";
const AUTH_TOKEN_KEY = "sb-fwdysvinyusuijplooex-auth-token";

const failures = [];
const fail = (m) => { console.error("✗", m); failures.push(m); };
const ok = (m) => console.log("✓", m);

async function run() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1600 } });
  const page = await ctx.newPage();

  await installSupabaseMocks(page, { session: mockSession() });
  await page.goto(`${BASE_URL}/account`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});

  // Seed extra Supabase-flavoured leftovers in BOTH storages so we can prove
  // the sweep catches them, not just the primary token.
  await page.evaluate((key) => {
    localStorage.setItem(key, localStorage.getItem(key) ?? "seed");
    localStorage.setItem("sb-fwdysvinyusuijplooex-code-verifier", "verifier-abc");
    localStorage.setItem("hvac:auth:ephemeral", "1");
    sessionStorage.setItem(key, "seed-session");
    sessionStorage.setItem("supabase.pkce.state", "pkce-xyz");
    sessionStorage.setItem("hvac:auth:tab-alive", "1");
  }, AUTH_TOKEN_KEY);

  // Sanity: we actually seeded stuff on both sides.
  const before = await page.evaluate(() => ({
    local: Object.keys(localStorage).filter((k) => k.startsWith("sb-") || k.startsWith("supabase.") || k.startsWith("hvac:auth:")),
    session: Object.keys(sessionStorage).filter((k) => k.startsWith("sb-") || k.startsWith("supabase.") || k.startsWith("hvac:auth:")),
  }));
  if (before.local.length === 0 || before.session.length === 0) {
    fail(`setup: expected auth keys in both storages, got ${JSON.stringify(before)}`);
  } else {
    ok(`setup seeded ${before.local.length} local + ${before.session.length} session auth keys`);
  }

  // Click Sign out in the header. AuthContext.signOut() ends with
  // window.location.assign("/"), so wait for that navigation.
  // AuthContext.signOut() ends with window.location.assign("/"), which is a
  // full navigation. Use waitForFunction on the pathname — waitForURL with a
  // predicate can miss same-origin hard nav races.
  await page.getByRole("button", { name: "Sign out" }).first().click();
  await page.waitForFunction(() => location.pathname === "/", null, { timeout: 10_000 })
    .catch(() => {});
  await page.waitForLoadState("domcontentloaded").catch(() => {});

  const after = await page.evaluate(() => ({
    local: Object.keys(localStorage).filter((k) => k.startsWith("sb-") || k.startsWith("supabase.") || k.startsWith("hvac:auth:")),
    session: Object.keys(sessionStorage).filter((k) => k.startsWith("sb-") || k.startsWith("supabase.") || k.startsWith("hvac:auth:")),
    pathname: location.pathname,
  }));

  if (after.pathname !== "/") {
    fail(`expected to land on "/", got "${after.pathname}"`);
  } else {
    ok("signOut lands on /");
  }
  if (after.local.length !== 0) {
    fail(`localStorage still has auth keys after sign-out: ${JSON.stringify(after.local)}`);
  } else {
    ok("localStorage fully wiped of sb-/supabase./hvac:auth:* keys");
  }
  if (after.session.length !== 0) {
    fail(`sessionStorage still has auth keys after sign-out: ${JSON.stringify(after.session)}`);
  } else {
    ok("sessionStorage fully wiped of sb-/supabase./hvac:auth:* keys");
  }

  await browser.close();
}

run()
  .then(() => {
    if (failures.length) {
      console.error(`\n✗ ${failures.length} failure(s)`);
      process.exit(1);
    }
    console.log("\n✓ Secure sign-out E2E passed");
  })
  .catch((e) => { console.error("Runner crashed:", e); process.exit(1); });
