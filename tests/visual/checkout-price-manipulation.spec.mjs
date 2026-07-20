/**
 * E2E: Client-supplied prices must NEVER be trusted.
 *
 * Even if a malicious client injects `unit_price`, `installation_fee`,
 * `subtotal`, `total` (or other price fields) into the createOrder RPC
 * payload, the server must recompute totals from the catalog and reject /
 * ignore the manipulated values. The persisted order + confirmation UI must
 * reflect the catalog price × quantity, never the attacker's number.
 *
 * Approach:
 *   1. Seed the cart via localStorage (matches CartContext shape).
 *   2. Open /checkout, fill the guest form, verify ZIP.
 *   3. Intercept the createOrder server-fn RPC request; splice attacker-
 *      controlled price fields into every cart item + top-level payload.
 *   4. Submit. Land on /confirmation/order/<ref>.
 *   5. Assert the displayed total matches the AUTHORITATIVE catalog total
 *      (catalog unit_price × qty + installation_fee if selected), NOT the
 *      $0.01 the client tried to smuggle through.
 *
 * Run: node tests/visual/checkout-price-manipulation.spec.mjs
 */
import { chromium } from "playwright";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:8080";

// Must stay in sync with the seed data / catalog. If prices change in
// migrations, update these constants — the test asserts against them.
const PRODUCT_SLUG = "aprilaire-413-filter";
const CATALOG_UNIT_PRICE = 89.0;
const CATALOG_INSTALL_FEE = 49.0;
const QUANTITY = 2;
const INCLUDE_INSTALL = true;
const EXPECTED_TOTAL =
  CATALOG_UNIT_PRICE * QUANTITY +
  (INCLUDE_INSTALL ? CATALOG_INSTALL_FEE * QUANTITY : 0);
const ATTACKER_PRICE = 0.01; // what we try (and fail) to inject

const SERVICEABLE_ZIP = "10001";

const failures = [];
const fail = (m) => { console.error("✗", m); failures.push(m); };

/** Recursively splice price-like fields into any object the client sent. */
function poisonPayload(obj) {
  if (!obj || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(poisonPayload);
  const out = { ...obj };
  // Whenever we see a cart-item-shaped object, inject price fields.
  if ("product_slug" in out && "quantity" in out) {
    out.unit_price = ATTACKER_PRICE;
    out.installation_fee = ATTACKER_PRICE;
    out.price = ATTACKER_PRICE;
  }
  // Top-level totals attempt.
  if ("items" in out) {
    out.subtotal = ATTACKER_PRICE;
    out.installation_total = ATTACKER_PRICE;
    out.total = ATTACKER_PRICE;
  }
  for (const k of Object.keys(out)) out[k] = poisonPayload(out[k]);
  return out;
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 1800 } });
  const page = await context.newPage();

  let interceptedCount = 0;
  let mutatedBody = null;

  await page.route("**/*", async (route) => {
    const req = route.request();
    if (req.method() !== "POST") return route.continue();
    const postData = req.postData();
    if (!postData || !postData.includes(PRODUCT_SLUG)) return route.continue();

    try {
      const parsed = JSON.parse(postData);
      const poisoned = poisonPayload(parsed);
      mutatedBody = poisoned;
      interceptedCount++;
      const headers = { ...req.headers() };
      await route.continue({ postData: JSON.stringify(poisoned), headers });
    } catch {
      return route.continue();
    }
  });

  // 1) Seed cart via localStorage BEFORE hydration.
  await page.goto(`${BASE_URL}/shop`, { waitUntil: "domcontentloaded" });
  await page.evaluate(({ slug, qty, install }) => {
    const cart = [{ productSlug: slug, quantity: qty, includeInstallation: install }];
    localStorage.setItem("hvac.cart.v1", JSON.stringify(cart));
  }, { slug: PRODUCT_SLUG, qty: QUANTITY, install: INCLUDE_INSTALL });

  // 2) Load checkout with the seeded cart.
  await page.goto(`${BASE_URL}/checkout`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});

  const emptyCart = await page.locator("text=Your cart is empty").count();
  if (emptyCart > 0) {
    await browser.close();
    return fail(
      `Cart seed key 'hvac.cart.v1' does not match CartContext. Update the ` +
      `key or import the seeding helper.`,
    );
  }

  // 3) Fill guest form.
  const uniq = Date.now().toString().slice(-6);
  const fields = {
    'input[value=""]': null, // ignored
  };
  const set = async (label, value) => {
    // Find the input by nearest Label text.
    const input = page.locator(`label:has-text("${label}") + input, label:has-text("${label}") ~ input`).first();
    if (await input.count()) { await input.fill(value); return; }
  };
  await set("Full name", "Price Manipulation Test");
  await set("Phone", "5551234567");
  await set("Email", `pm-test-${uniq}@example.com`);
  await page.locator('input[placeholder="Street"]').fill("1 Test Ave");
  await page.locator('input[placeholder="City"]').fill("New York");
  await page.locator('input[placeholder="State"]').fill("NY");
  await page.locator('input[placeholder="ZIP"]').fill(SERVICEABLE_ZIP);
  // Trigger ZIP verification (onBlur).
  await page.locator('input[placeholder="ZIP"]').blur();
  await page.waitForSelector("text=We serve", { timeout: 10000 });

  // 4) Submit — the route interceptor will poison the outgoing payload.
  const submitBtn = page.locator('button[type="submit"]', { hasText: /place|order|checkout|pay/i }).first();
  await (await submitBtn.count() ? submitBtn : page.locator('button:has-text("Place")').first()).click();

  // 5) Wait for confirmation navigation.
  try {
    await page.waitForURL(/\/confirmation\/order\//, { timeout: 20000 });
  } catch {
    const err = await page.locator('[role="status"], .sonner-toast, [data-sonner-toast]').first().innerText().catch(() => "");
    await browser.close();
    return fail(`Did not reach order confirmation. Toast: ${err || "(none)"}`);
  }

  if (interceptedCount === 0) {
    await browser.close();
    return fail("Never intercepted the createOrder request — check RPC path.");
  }
  console.log(`→ Intercepted & poisoned createOrder payload (attempts: ${interceptedCount})`);
  console.log(`  Mutated sample:`, JSON.stringify(mutatedBody).slice(0, 240), "…");

  await page.waitForLoadState("networkidle").catch(() => {});

  // Grab the displayed total.
  const bodyText = await page.locator("body").innerText();
  const money = /\$([0-9]+(?:,[0-9]{3})*(?:\.[0-9]{2})?)/g;
  const amounts = [...bodyText.matchAll(money)].map((m) => Number(m[1].replace(/,/g, "")));
  if (amounts.length === 0) {
    await browser.close();
    return fail("Confirmation page has no visible currency amounts.");
  }

  const maxAmount = Math.max(...amounts);
  console.log(`  Confirmation amounts: ${amounts.map((a) => "$" + a.toFixed(2)).join(", ")}`);
  console.log(`  Expected authoritative total: $${EXPECTED_TOTAL.toFixed(2)}`);

  // Attacker success criteria: total dropped to ~$0.01–$1.
  if (maxAmount < CATALOG_UNIT_PRICE) {
    await browser.close();
    return fail(
      `Server appears to have TRUSTED the manipulated prices! ` +
      `Max amount $${maxAmount.toFixed(2)} < catalog unit $${CATALOG_UNIT_PRICE.toFixed(2)}.`,
    );
  }

  // Strong assertion: expected total present verbatim.
  const target = EXPECTED_TOTAL.toFixed(2);
  const matched = amounts.some((a) => Math.abs(a - EXPECTED_TOTAL) < 0.01);
  if (!matched) {
    await browser.close();
    return fail(
      `Confirmation total mismatch. Expected exactly $${target}, ` +
      `saw [${amounts.map((a) => "$" + a.toFixed(2)).join(", ")}].`,
    );
  }

  console.log(`✓ Server recomputed from catalog. Manipulated $${ATTACKER_PRICE} was ignored.`);
  await browser.close();
}

run()
  .then(() => {
    if (failures.length) {
      console.error(`\n✗ ${failures.length} failure(s)`);
      process.exit(1);
    }
    console.log("\n✓ Price manipulation E2E passed");
  })
  .catch((err) => {
    console.error("Test runner crashed:", err);
    process.exit(1);
  });
