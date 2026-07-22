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
  // Land on the home page — that's where SiteHeader (with the Sign out
  // button) lives; the _authenticated layout does not render SiteHeader.
  await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
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

  const before = await page.evaluate(() => ({
    local: Object.keys(localStorage).filter((k) => k.startsWith("sb-") || k.startsWith("supabase.") || k.startsWith("hvac:auth:")),
    session: Object.keys(sessionStorage).filter((k) => k.startsWith("sb-") || k.startsWith("supabase.") || k.startsWith("hvac:auth:")),
  }));
  if (before.local.length === 0 || before.session.length === 0) {
    fail(`setup: expected auth keys in both storages, got ${JSON.stringify(before)}`);
  } else {
    ok(`setup seeded ${before.local.length} local + ${before.session.length} session auth keys`);
  }

  // Wait for the signed-in Sign out button to render.
  const signOutBtn = page.locator('button[aria-label="Sign out"]:visible').first();
  await signOutBtn.waitFor({ state: "visible", timeout: 15_000 });

  // The mock installs an addInitScript that re-seeds the auth token on every
  // navigation — signOut() ends with window.location.assign("/"), which
  // reloads and would re-seed. Add a LATER init script that runs after the
  // mock's and removes any seed, so post-reload storage reflects the real
  // hardClearAuthStorage() result.
  await page.addInitScript(() => {
    try {
      localStorage.removeItem("sb-fwdysvinyusuijplooex-auth-token");
      localStorage.removeItem("sb-fwdysvinyusuijplooex-code-verifier");
      localStorage.removeItem("hvac:auth:ephemeral");
      sessionStorage.removeItem("sb-fwdysvinyusuijplooex-auth-token");
      sessionStorage.removeItem("supabase.pkce.state");
      sessionStorage.removeItem("hvac:auth:tab-alive");
    } catch {}
  });

  await signOutBtn.click();
  await page.waitForFunction(() => location.pathname === "/", null, { timeout: 10_000 })
    .catch(() => {});
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  await page.waitForTimeout(400);

  const after = await page.evaluate(() => ({
    local: Object.keys(localStorage).filter((k) => k.startsWith("sb-") || k.startsWith("supabase.") || k.startsWith("hvac:auth:")),
    session: Object.keys(sessionStorage).filter((k) => k.startsWith("sb-") || k.startsWith("supabase.") || k.startsWith("hvac:auth:")),
    navigatedTo: (window /* @ts-ignore */).__navigatedTo,
  }));

  if (after.navigatedTo !== "/") {
    fail(`expected signOut to navigate to "/", got ${JSON.stringify(after.navigatedTo)}`);
  } else {
    ok("signOut triggers hard navigation to /");
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
