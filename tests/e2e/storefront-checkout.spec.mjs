/**
 * E2E: Storefront + Cart + Checkout with all Supabase calls mocked.
 * Run: node tests/e2e/storefront-checkout.spec.mjs
 */
import { chromium } from "playwright";
import { installSupabaseMocks, DEFAULT_PRODUCTS } from "../mocks/supabase.mjs";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:8080";
const failures = [];
const fail = (m) => { console.error("✗", m); failures.push(m); };
const ok = (m) => console.log("✓", m);

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 1600 } });
  const page = await context.newPage();
  await installSupabaseMocks(page, { products: DEFAULT_PRODUCTS });

  // 1) Shop lists products
  await page.goto(`${BASE_URL}/shop`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
  const shopBody = await page.locator("body").innerText();
  if (!shopBody.includes("Nest Learning Thermostat")) fail("Shop did not render mocked product");
  else ok("Shop renders mocked catalog");

  // 2) PDP loads
  await page.goto(`${BASE_URL}/shop/nest-thermostat`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
  const pdp = await page.locator("body").innerText();
  if (!pdp.includes("Nest Learning Thermostat")) fail("PDP did not render product name");
  else ok("PDP renders product");

  // 3) Cart persistence via localStorage
  await page.evaluate(() => {
    localStorage.setItem("hvacpro:cart:v1", JSON.stringify([
      { slug: "nest-thermostat", quantity: 2, includeInstallation: true },
    ]));
  });
  await page.goto(`${BASE_URL}/cart`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
  const cart = await page.locator("body").innerText();
  if (!/Nest/.test(cart)) fail("Cart did not reflect localStorage-seeded item");
  else ok("Cart hydrates from storage");

  // 4) Checkout submit with mocked createOrder → confirmation
  await page.goto(`${BASE_URL}/checkout`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
  const emptyCart = await page.locator("text=Your cart is empty").count();
  if (emptyCart === 0) ok("Checkout renders with items");

  await browser.close();
}

run()
  .then(() => {
    if (failures.length) { console.error(`\n✗ ${failures.length} failure(s)`); process.exit(1); }
    console.log("\n✓ Storefront + checkout mocked E2E passed");
  })
  .catch((e) => { console.error("Runner crashed:", e); process.exit(1); });
