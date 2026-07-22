/**
 * E2E: expired persisted session → redirect to /auth?expired=1 without a
 * flash of protected content.
 *
 * Simulates a user returning to /account with a Supabase token whose
 * `expires_at` is in the past. The `_authenticated` gate + AuthContext boot
 * guard should:
 *   1. Wipe the token from BOTH storages before Supabase reads it.
 *   2. Redirect to /auth?expired=1.
 *   3. Never render /account content (no flash).
 *
 * Run: node tests/e2e/expired-session.spec.mjs
 */
import { chromium } from "playwright";
import { installSupabaseMocks, mockSession } from "../mocks/supabase.mjs";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:8080";
const AUTH_TOKEN_KEY = "sb-fwdysvinyusuijplooex-auth-token";

const failures = [];
const fail = (m) => { console.error("✗", m); failures.push(m); };
const ok = (m) => console.log("✓", m);

function expiredSession() {
  const s = mockSession();
  s.expires_at = Math.floor(Date.now() / 1000) - 60; // 1 min ago
  s.expires_in = -60;
  return s;
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1600 } });
  const page = await ctx.newPage();

  // No live session — Supabase auth calls should return "no session".
  await installSupabaseMocks(page, { session: null });

  // Track every DOM snapshot as URLs change. If /account ever renders its
  // signature UI while the URL is /account, that's a flash.
  const flashObserved = { hit: false, where: "" };
  page.on("framenavigated", async (frame) => {
    if (frame !== page.mainFrame()) return;
    try {
      const url = new URL(frame.url());
      if (url.pathname === "/account") {
        const text = await page.evaluate(() => document.body?.innerText ?? "").catch(() => "");
        // Any of these substrings would indicate the tabs actually mounted.
        if (/My bookings|My orders|Saved addresses/i.test(text)) {
          flashObserved.hit = true;
          flashObserved.where = url.href;
        }
      }
    } catch { /* ignore */ }
  });

  // Land on the homepage first so we have a live origin, then seed the
  // expired token into localStorage before navigating to the protected route.
  await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ({ key, session }) => {
      localStorage.setItem(key, JSON.stringify(session));
      sessionStorage.setItem(key, JSON.stringify(session));
      // Simulate that the tab was previously alive (guard should still boot).
      sessionStorage.setItem("hvac:auth:tab-alive", "1");
    },
    { key: AUTH_TOKEN_KEY, session: expiredSession() },
  );

  // Now navigate to a protected route. The gate should intercept.
  await page.goto(`${BASE_URL}/account`, { waitUntil: "domcontentloaded" });
  await page.waitForURL(/\/auth(\?|$)/, { timeout: 10_000 }).catch(() => {});
  await page.waitForLoadState("networkidle").catch(() => {});

  const finalUrl = page.url();
  const storage = await page.evaluate((key) => ({
    local: localStorage.getItem(key),
    session: sessionStorage.getItem(key),
    expiredFlag: sessionStorage.getItem("hvac:auth:expired"),
  }), AUTH_TOKEN_KEY);

  if (!/\/auth/.test(finalUrl)) {
    fail(`expected redirect to /auth, got ${finalUrl}`);
  } else {
    ok("expired session redirects to /auth");
  }
  // The app has two "expired" signals:
  //   - beforeLoad gate: /auth?expired=1 when Supabase still returns the
  //     stale session before the boot guard wipes it.
  //   - AuthContext boot guard: wipes storage first, so gate falls through
  //     to /auth?redirect=... AND sets sessionStorage["hvac:auth:expired"].
  // Either path should trigger the "session expired" toast on /auth.
  const expiredSignaled = /expired=1/.test(finalUrl) || storage.expiredFlag === "1";
  if (!expiredSignaled) {
    fail(`no expired signal for /auth toast (url=${finalUrl}, flag=${storage.expiredFlag})`);
  } else {
    ok("expired signal reached /auth (via URL param or sessionStorage flag)");
  }
  if (storage.local) {
    fail(`localStorage still has expired token: ${storage.local.slice(0, 60)}…`);
  } else {
    ok("expired token wiped from localStorage");
  }
  if (storage.session) {
    fail(`sessionStorage still has expired token: ${storage.session.slice(0, 60)}…`);
  } else {
    ok("expired token wiped from sessionStorage");
  }
  if (flashObserved.hit) {
    fail(`protected /account content rendered before redirect (flash) at ${flashObserved.where}`);
  } else {
    ok("no flash of /account content before redirect");
  }

  // Bonus: the /auth page should show a form input, not a spinner forever.
  const emailInput = await page.locator("input[type='email']").first().count();
  if (emailInput === 0) {
    fail("/auth did not render an email input after redirect");
  } else {
    ok("/auth rendered the sign-in form");
  }

  await browser.close();
}

run()
  .then(() => {
    if (failures.length) {
      console.error(`\n✗ ${failures.length} failure(s)`);
      process.exit(1);
    }
    console.log("\n✓ Expired-session E2E passed");
  })
  .catch((e) => { console.error("Runner crashed:", e); process.exit(1); });
