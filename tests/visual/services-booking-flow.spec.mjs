/**
 * End-to-end: from the /services grid, for every visible category tab,
 * click "Book this service" on each service card and verify the booking
 * page loads without console errors or error-page markers.
 *
 * Run: node tests/visual/services-booking-flow.spec.mjs
 */
import { chromium } from "playwright";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:8080";
const VIEWPORT = { width: 1280, height: 900 };

/** Non-fatal noise we ignore in console. */
const IGNORE_CONSOLE = [
  /favicon/i,
  /Download the React DevTools/i,
  /source-?map/i,
  /vite/i,
];

/** Substrings that indicate an on-page error was rendered. */
const ERROR_MARKERS = [
  "Something went wrong",
  "Our servers are having a moment",
  "We couldn't find that page",
  "Error 404",
  "Error 500",
];

const failures = [];
const record = (m) => {
  console.error("✗", m);
  failures.push(m);
};

async function bookingLoadedOk(page) {
  // Wait for either the booking form heading or a well-known field to render.
  try {
    await page.waitForURL(/\/book(\?|$)/, { timeout: 8000 });
  } catch {
    return `Did not navigate to /book (final URL: ${page.url()})`;
  }
  // Give the route a moment to hydrate.
  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});

  const html = await page.content();
  for (const marker of ERROR_MARKERS) {
    if (html.includes(marker)) return `Booking page shows error marker: "${marker}"`;
  }

  // Expect a booking-y control to exist. Be lenient — any of these is fine.
  const hasBookingUi = await page.evaluate(() => {
    const t = document.body.innerText.toLowerCase();
    return (
      t.includes("book") &&
      (t.includes("date") || t.includes("time") || t.includes("address") || t.includes("service"))
    );
  });
  if (!hasBookingUi) return "Booking page rendered without booking form content";
  return null;
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (IGNORE_CONSOLE.some((r) => r.test(text))) return;
    consoleErrors.push(text);
  });
  page.on("pageerror", (err) => consoleErrors.push(`pageerror: ${err.message}`));

  await page.goto(`${BASE_URL}/services`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[role="tab"]', { timeout: 10000 });

  const tabKeys = await page.$$eval('[role="tab"]', (els) =>
    els.map((el) => el.id.replace(/^svc-tab-/, "")).filter(Boolean),
  );
  console.log(`→ Discovered ${tabKeys.length} category tabs: ${tabKeys.join(", ")}`);
  if (tabKeys.length === 0) return record("No category tabs found on /services");

  for (const key of tabKeys) {
    await page.goto(`${BASE_URL}/services`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[role="tab"]', { timeout: 10000 });
    await page.click(`#svc-tab-${key}`);
    // Wait a tick for the grid to filter.
    await page.waitForTimeout(200);

    const bookButtons = await page.$$('button:has-text("Book this service")');
    console.log(`  [${key}] ${bookButtons.length} bookable service(s)`);
    if (bookButtons.length === 0) continue; // empty category is fine

    for (let i = 0; i < bookButtons.length; i++) {
      // Re-query after each nav since the DOM was replaced.
      await page.goto(`${BASE_URL}/services`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector('[role="tab"]', { timeout: 10000 });
      await page.click(`#svc-tab-${key}`);
      await page.waitForTimeout(150);
      const buttons = await page.$$('button:has-text("Book this service")');
      if (!buttons[i]) continue;

      const preErrors = consoleErrors.length;
      await buttons[i].click();
      const problem = await bookingLoadedOk(page);
      if (problem) record(`[${key}] service #${i + 1}: ${problem}`);

      const newErrors = consoleErrors.slice(preErrors);
      if (newErrors.length) {
        record(`[${key}] service #${i + 1}: console errors:\n    ${newErrors.join("\n    ")}`);
      } else {
        console.log(`  ✓ [${key}] service #${i + 1} → ${page.url()}`);
      }
    }
  }

  await browser.close();

  if (failures.length) {
    console.error(`\n✗ ${failures.length} failure(s)`);
    process.exit(1);
  }
  console.log("\n✓ All service categories reached the booking page without errors");
}

run().catch((err) => {
  console.error("Test runner crashed:", err);
  process.exit(1);
});
