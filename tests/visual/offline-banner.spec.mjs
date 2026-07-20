/**
 * Playwright test: verifies OfflineDetector behavior.
 *
 *   node tests/visual/offline-banner.spec.mjs
 *
 * Covers:
 *  - Banner does NOT appear on load when the browser is online.
 *  - Banner appears when an `offline` event fires.
 *  - "Back online" state after an `online` event.
 *  - Cooldown suppresses a second offline banner during quick reconnect flapping.
 *  - Manual dismiss hides the banner and persists in sessionStorage for the tab.
 */
import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs";

function findChromium() {
  if (process.env.PLAYWRIGHT_CHROMIUM_PATH) return process.env.PLAYWRIGHT_CHROMIUM_PATH;
  for (const p of ["/chromium-1194/chrome-linux/chrome", "/chromium-1187/chrome-linux/chrome"]) {
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

const BASE_URL = process.env.BASE_URL ?? "http://localhost:8080";

function fireOffline(page) {
  return page.evaluate(() => {
    Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
    window.dispatchEvent(new Event("offline"));
  });
}
function fireOnline(page) {
  return page.evaluate(() => {
    Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
    window.dispatchEvent(new Event("online"));
  });
}

async function bannerVisible(page) {
  return await page.locator('[data-testid="offline-banner"]').count() > 0;
}
async function bannerState(page) {
  const el = page.locator('[data-testid="offline-banner"]');
  if ((await el.count()) === 0) return null;
  return await el.getAttribute("data-state");
}

async function run() {
  const browser = await chromium.launch({ headless: true, executablePath: findChromium() });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  // 1. Online on load → no banner.
  assert.equal(await bannerVisible(page), false, "banner must NOT show on initial online load");

  // 2. Offline event → banner appears in offline state.
  await fireOffline(page);
  await page.waitForSelector('[data-testid="offline-banner"]', { timeout: 3000, state: 'attached' });
  assert.equal(await bannerState(page), "offline", "banner should be in offline state");

  // 3. Online event → banner switches to restored, then hides.
  await fireOnline(page);
  await page.waitForFunction(() => {
    const el = document.querySelector('[data-testid="offline-banner"]');
    return el && el.getAttribute("data-state") === "restored";
  }, null, { timeout: 2000 });

  // 4. Cooldown: an offline event immediately after should NOT re-show the banner.
  await page.waitForTimeout(2800); // let restored -> idle
  assert.equal(await bannerVisible(page), false, "banner should be idle after restored");
  await fireOffline(page);
  await page.waitForTimeout(300);
  assert.equal(await bannerVisible(page), false, "cooldown must suppress banner during quick reconnect");

  // 5. Manual dismiss: force cooldown to expire (reload w/ preserved sessionStorage disabled first),
  //    trigger offline, click dismiss, confirm it hides and persists across reload.
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" }); // resets in-memory cooldown ref
  await page.waitForTimeout(400);
  await fireOffline(page);
  await page.waitForSelector('[data-testid="offline-banner"]', { timeout: 3000, state: 'attached' });
  await page.click('[data-testid="offline-banner-dismiss"]');
  await page.waitForTimeout(200);
  assert.equal(await bannerVisible(page), false, "dismiss button should hide banner");

  const stored = await page.evaluate(() => sessionStorage.getItem("offline-banner-dismissed"));
  assert.equal(stored, "1", "dismissal should be stored in sessionStorage");

  // Reload same tab → sessionStorage persists → offline event should NOT re-show.
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  await fireOffline(page);
  await page.waitForTimeout(400);
  assert.equal(await bannerVisible(page), false, "session-dismissal must persist across reload");

  // 6. Route changes: banner (root-mounted) persists across SPA navigation.
  //    Fresh context clears sessionStorage dismissal + in-memory cooldown.
  await context.close();
  const context2 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page2 = await context2.newPage();
  await page2.goto(BASE_URL, { waitUntil: "networkidle" });
  await page2.waitForTimeout(800);

  await fireOffline(page2);
  await page2.waitForSelector('[data-testid="offline-banner"]', { timeout: 3000, state: "attached" });
  assert.equal(await bannerState(page2), "offline", "banner should be offline on home route");

  // SPA-navigate via in-app link to /shop — root remains mounted, banner should persist.
  await page2.evaluate(() => {
    const a = Array.from(document.querySelectorAll("a")).find(
      (el) => (el.getAttribute("href") || "").replace(/\/$/, "") === "/shop",
    );
    if (a) a.click();
  });
  await page2.waitForURL(/\/shop/, { timeout: 5000 });
  await page2.waitForTimeout(400);
  assert.equal(
    await bannerState(page2),
    "offline",
    "banner should persist across SPA route change (root-mounted)",
  );

  // Online while on new route → restored → idle.
  await fireOnline(page2);
  await page2.waitForFunction(() => {
    const el = document.querySelector('[data-testid="offline-banner"]');
    return el && el.getAttribute("data-state") === "restored";
  }, null, { timeout: 2000 });
  await page2.waitForTimeout(2800);
  assert.equal(
    await bannerVisible(page2),
    false,
    "banner should return to idle on the new route after online event",
  );

  // Hard navigation to a fresh route while online → no banner.
  await page2.goto(`${BASE_URL}/services`, { waitUntil: "domcontentloaded" });
  await page2.waitForTimeout(600);
  assert.equal(
    await bannerVisible(page2),
    false,
    "banner must not appear on fresh route load while online",
  );

  // 7. Rapid online/offline flapping: only ONE banner within cooldown window.
  await context2.close();
  const context3 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page3 = await context3.newPage();
  await page3.goto(BASE_URL, { waitUntil: "networkidle" });
  await page3.waitForTimeout(800);

  await page3.evaluate(() => {
    window._offlineShowCount = 0;
    window._lastShown = 0;
    const observer = new MutationObserver(() => {
      const el = document.querySelector('[data-testid="offline-banner"]');
      if (el && el.getAttribute("data-state") === "offline") {
        const now = performance.now();
        if (now - window._lastShown > 50) {
          window._offlineShowCount += 1;
          window._lastShown = now;
        }
      }
    });
    observer.observe(document.body, { subtree: true, childList: true, attributes: true });
    window._offlineObserver = observer;
  });

  // Flap offline/online 6x quickly (well within 15s cooldown).
  for (let i = 0; i < 6; i++) {
    await fireOffline(page3);
    await page3.waitForTimeout(80);
    await fireOnline(page3);
    await page3.waitForTimeout(80);
  }
  await page3.waitForTimeout(500);

  const showCount = await page3.evaluate(() => window._offlineShowCount);
  assert.equal(
    showCount,
    1,
    `rapid flapping must show offline banner exactly once within cooldown (got ${showCount})`,
  );

  await browser.close();
  console.log("OK offline-banner: all 7 checks passed");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
