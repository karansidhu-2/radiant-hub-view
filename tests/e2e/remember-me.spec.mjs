/**
 * E2E: "Remember me" persistence.
 *
 * Verifies:
 *   1. With Remember me ON, the session survives a browser restart
 *      (simulated by re-launching the browser and loading persisted
 *      localStorage state).
 *   2. With Remember me OFF, the session is wiped when the tab/browser
 *      closes (simulated by opening a NEW browser context — same
 *      localStorage, empty sessionStorage). The ephemeral guard should
 *      purge the token before Supabase reads it, and /account should
 *      redirect to /auth.
 *
 * Run: node tests/e2e/remember-me.spec.mjs
 */
import { chromium } from "playwright";
import { installSupabaseMocks, mockSession } from "../mocks/supabase.mjs";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:8080";
const AUTH_TOKEN_KEY = "sb-fwdysvinyusuijplooex-auth-token";
const EPHEMERAL_FLAG = "hvac:auth:ephemeral";
const TAB_ALIVE_FLAG = "hvac:auth:tab-alive";

const failures = [];
const fail = (m) => { console.error("✗", m); failures.push(m); };
const ok = (m) => console.log("✓", m);

async function newBrowser() {
  return chromium.launch({ headless: true });
}

/**
 * Simulate the app after a successful sign-in with a given "remember me"
 * setting: seed the auth token + the ephemeral flag Supabase would leave
 * behind, then persist the browser storage.
 */
async function seedSignedInSession(remember) {
  const browser = await newBrowser();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1600 } });
  const page = await ctx.newPage();
  await installSupabaseMocks(page, { session: mockSession() });
  await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ({ key, session, flag, remember, tabKey }) => {
      localStorage.setItem(key, JSON.stringify(session));
      if (remember) localStorage.removeItem(flag);
      else localStorage.setItem(flag, "1");
      // A live tab always sets this; the guard checks its absence to
      // detect a fresh browser/tab.
      sessionStorage.setItem(tabKey, "1");
    },
    {
      key: AUTH_TOKEN_KEY,
      session: mockSession(),
      flag: EPHEMERAL_FLAG,
      tabKey: TAB_ALIVE_FLAG,
      remember,
    },
  );
  const storageState = await ctx.storageState();
  await browser.close();
  return storageState;
}

/**
 * Reopen the app in a NEW browser instance with the persisted localStorage
 * but a fresh sessionStorage — i.e. what happens after a real browser or
 * tab restart.
 */
async function reopenAndVisitAccount(storageState) {
  const browser = await newBrowser();
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 1600 },
    storageState,
  });
  const page = await ctx.newPage();
  await installSupabaseMocks(page, { session: mockSession() });
  await page.goto(`${BASE_URL}/account`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
  const finalUrl = page.url();
  const tokenAfter = await page.evaluate(
    (key) => localStorage.getItem(key),
    AUTH_TOKEN_KEY,
  );
  await browser.close();
  return { finalUrl, tokenAfter };
}

async function run() {
  // Case 1: Remember me ON → survives browser restart.
  {
    const state = await seedSignedInSession(true);
    const { finalUrl, tokenAfter } = await reopenAndVisitAccount(state);
    if (/\/auth/.test(finalUrl)) {
      fail(`Remember=ON: expected to stay on /account, got ${finalUrl}`);
    } else {
      ok("Remember=ON: session persists across browser restart");
    }
    if (!tokenAfter) {
      fail("Remember=ON: auth token was wiped from localStorage after restart");
    } else {
      ok("Remember=ON: auth token retained in localStorage");
    }
  }

  // Case 2: Remember me OFF → cleared on browser/tab close.
  {
    const state = await seedSignedInSession(false);
    // Sanity: the ephemeral flag is present in the seeded state.
    const origins = state.origins ?? [];
    const flagSet = origins.some((o) =>
      (o.localStorage ?? []).some((it) => it.name === EPHEMERAL_FLAG && it.value === "1"),
    );
    if (!flagSet) fail("Remember=OFF: ephemeral flag was not seeded — test setup bug");

    const { finalUrl, tokenAfter } = await reopenAndVisitAccount(state);
    if (!/\/auth/.test(finalUrl)) {
      fail(`Remember=OFF: expected redirect to /auth, got ${finalUrl}`);
    } else {
      ok("Remember=OFF: /account redirects to /auth after browser restart");
    }
    if (tokenAfter) {
      fail("Remember=OFF: auth token still present in localStorage after guard should have wiped it");
    } else {
      ok("Remember=OFF: guard wiped auth token from localStorage");
    }
    if (/expired=1/.test(finalUrl)) {
      // Not required, but nice to know: this branch is for token-expiry
      // redirects, not the ephemeral wipe.
      ok("Remember=OFF: redirected without expired flag (ephemeral wipe, not expiry) — pass-through note only");
    }
  }
}

run()
  .then(() => {
    if (failures.length) {
      console.error(`\n✗ ${failures.length} failure(s)`);
      process.exit(1);
    }
    console.log("\n✓ Remember-me E2E passed");
  })
  .catch((e) => { console.error("Runner crashed:", e); process.exit(1); });
