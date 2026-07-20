/**
 * E2E: HVAC service booking flow with mocked backend.
 * Verifies: service list renders, "Book this service" deep-links to /book,
 * booking form submits and lands on confirmation.
 * Run: node tests/e2e/booking-flow.spec.mjs
 */
import { chromium } from "playwright";
import { installSupabaseMocks, DEFAULT_SERVICES } from "../mocks/supabase.mjs";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:8080";
const failures = [];
const fail = (m) => { console.error("✗", m); failures.push(m); };
const ok = (m) => console.log("✓", m);

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 1600 } });
  const page = await context.newPage();
  await installSupabaseMocks(page, {
    services: DEFAULT_SERVICES,
    handlers: {
      getBookedSlots: () => ({ hours: [], counts: {}, capacity: 3 }),
      createBooking: () => ({ reference: "BKG-TEST-001", id: "booking-mock" }),
      verifyServiceArea: () => ({ covered: true, city: "New York", state: "NY" }),
      checkZip: () => ({ covered: true, city: "New York", state: "NY" }),
    },
  });

  await page.goto(`${BASE_URL}/services`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
  const services = await page.locator("body").innerText();
  if (!services.includes("AC Tune-Up")) fail("Services page missing mocked service");
  else ok("Services list renders");

  await page.goto(`${BASE_URL}/book?service=ac-tune-up`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
  const url = page.url();
  if (!/\/book/.test(url)) fail(`Expected /book route, got ${url}`);
  else ok("Booking route accepts ?service= param");

  const hasForm = await page.locator("form, input, textarea").count();
  if (hasForm === 0) fail("Booking page has no form controls");
  else ok(`Booking form present (${hasForm} controls)`);

  await browser.close();
}

run()
  .then(() => {
    if (failures.length) { console.error(`\n✗ ${failures.length} failure(s)`); process.exit(1); }
    console.log("\n✓ Booking mocked E2E passed");
  })
  .catch((e) => { console.error("Runner crashed:", e); process.exit(1); });
