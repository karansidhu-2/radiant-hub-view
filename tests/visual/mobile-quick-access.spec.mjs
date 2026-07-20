/**
 * Layout tests for the MobileQuickAccess rail on the home page.
 *
 * Verifies at every mobile/tablet breakpoint that:
 *   - the rail is visible below md (< 768px) and hidden at/above md
 *   - the first tile's left edge lines up with the last tile's right edge
 *     relative to the shared inner container (edge-to-edge alignment,
 *     matching the max-w-7xl px-4 gutter)
 *   - tiles do not overflow the viewport horizontally
 *   - the persisted "last tapped" tile is restored after a reload
 *
 * Run:
 *   node tests/visual/mobile-quick-access.spec.mjs
 */
import { chromium } from "playwright";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:8080";

const SIZES = [
  { name: "mobile-320", w: 320, h: 720, visible: true },
  { name: "mobile-360", w: 360, h: 800, visible: true },
  { name: "mobile-390", w: 390, h: 844, visible: true },
  { name: "mobile-414", w: 414, h: 896, visible: true },
  { name: "phablet-600", w: 600, h: 960, visible: true },
  { name: "tablet-767", w: 767, h: 1024, visible: true },
  { name: "tablet-768", w: 768, h: 1024, visible: false },
  { name: "tablet-820", w: 820, h: 1180, visible: false },
  { name: "desktop-1024", w: 1024, h: 768, visible: false },
];

// Expected horizontal gutter from `.px-4` on the inner container.
const EXPECTED_GUTTER = 16;
// Allow 1px sub-pixel rounding.
const TOLERANCE = 1;

const failures = [];
function check(cond, msg) {
  if (!cond) failures.push(msg);
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const size of SIZES) {
      const context = await browser.newContext({
        viewport: { width: size.w, height: size.h },
      });
      const page = await context.new_page ? await context.new_page() : await context.newPage();

      await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
      // MobileQuickAccess mounts on the home page (`<section aria-label="Quick access">`).
      const section = page.locator('section[aria-label="Quick access"]');

      if (!size.visible) {
        // md:hidden should hide the rail at >= 768px.
        const visible = await section.isVisible().catch(() => false);
        check(!visible, `[${size.name}] rail should be hidden at ${size.w}px`);
        await context.close();
        continue;
      }

      await section.waitFor({ state: "visible", timeout: 5000 });
      const tiles = section.locator('[data-mqa-tile]');
      const count = await tiles.count();
      check(count >= 3, `[${size.name}] expected >= 3 tiles, got ${count}`);

      // Inner container (max-w-7xl px-4 mx-auto)
      const container = section.locator("> div").first();
      const cBox = await container.boundingBox();
      const firstBox = await tiles.first().boundingBox();
      const lastBox = await tiles.nth(count - 1).boundingBox();

      if (!cBox || !firstBox || !lastBox) {
        check(false, `[${size.name}] missing bounding box`);
        await context.close();
        continue;
      }

      const leftGap = firstBox.x - cBox.x;
      const rightGap = cBox.x + cBox.width - (lastBox.x + lastBox.width);

      check(
        Math.abs(leftGap - EXPECTED_GUTTER) <= TOLERANCE,
        `[${size.name}] left gutter ${leftGap.toFixed(1)}px != ${EXPECTED_GUTTER}px`,
      );
      // Grid layout has both edges symmetric; scroll rail uses `-mx-4 px-4`
      // so the first snap item also sits at the 16px gutter and the last
      // trailing edge (when few items) matches within tolerance. When the
      // rail is truly scrollable the last tile can extend beyond viewport
      // — accept that case by only checking left alignment strictly.
      const scrollable = await section.evaluate((el) => {
        const inner = el.querySelector("div");
        if (!inner) return false;
        return inner.scrollWidth > inner.clientWidth + 1;
      });
      if (!scrollable) {
        check(
          Math.abs(rightGap - EXPECTED_GUTTER) <= TOLERANCE,
          `[${size.name}] right gutter ${rightGap.toFixed(1)}px != ${EXPECTED_GUTTER}px`,
        );
      }

      // No tile should render off the right viewport edge in the grid layout.
      if (!scrollable) {
        check(
          lastBox.x + lastBox.width <= size.w + TOLERANCE,
          `[${size.name}] tile overflows viewport (${(lastBox.x + lastBox.width).toFixed(1)} > ${size.w})`,
        );
      }

      // Persistence: tap first tile, reload, verify aria-current restored.
      const firstKey = await tiles.first().getAttribute("data-mqa-tile");
      // Prevent navigation on click for anchor/link tiles by intercepting.
      await page.evaluate(() => {
        document.addEventListener(
          "click",
          (e) => {
            const t = e.target;
            if (t && t.closest && t.closest("[data-mqa-tile]")) {
              e.preventDefault();
            }
          },
          true,
        );
      });
      await tiles.first().click();
      await page.reload({ waitUntil: "domcontentloaded" });
      await section.waitFor({ state: "visible", timeout: 5000 });
      const restored = await page
        .locator(`[data-mqa-tile="${firstKey}"][data-selected="true"]`)
        .count();
      check(
        restored === 1,
        `[${size.name}] selected tile "${firstKey}" not restored after reload`,
      );

      await context.close();
    }
  } finally {
    await browser.close();
  }

  if (failures.length) {
    console.error("FAIL:\n" + failures.map((f) => "  - " + f).join("\n"));
    process.exit(1);
  }
  console.log(`OK — MobileQuickAccess layout verified across ${SIZES.length} breakpoints`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
