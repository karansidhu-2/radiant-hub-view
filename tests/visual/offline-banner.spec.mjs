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

  await browser.close();
  console.log("OK offline-banner: all 5 checks passed");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
