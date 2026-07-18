/**
 * Visual regression + accessibility tests for the site header and mobile bottom nav
 * at mobile, tablet, and desktop breakpoints.
 *
 * Runs against the running dev server on http://localhost:8080.
 *
 *   node tests/visual/header-nav.spec.mjs            # verify against baseline
 *   node tests/visual/header-nav.spec.mjs --update   # (re)generate baselines
 *
 * Baselines are stored in tests/visual/__baseline__/*.png.
 * Diffs on failure are written to tests/visual/__diff__/*.png.
 */
import { chromium } from "playwright";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASELINE = path.join(__dirname, "__baseline__");
const ACTUAL = path.join(__dirname, "__actual__");
const DIFF = path.join(__dirname, "__diff__");
for (const d of [BASELINE, ACTUAL, DIFF]) fs.mkdirSync(d, { recursive: true });

const BASE_URL = process.env.BASE_URL ?? "http://localhost:8080";
const UPDATE = process.argv.includes("--update");
const THRESHOLD = 0.15;               // per-pixel color threshold (pixelmatch)
const MAX_DIFF_RATIO = 0.02;          // fail if > 2% pixels differ

// Breakpoint note: bottom nav is hidden at Tailwind `md` (>= 768px).
// hasBottom flags the expected presence of the mobile bottom nav.
const SIZES = [
  { name: "mobile-375", w: 375, h: 812, hasBottom: true },   // iPhone SE / small mobile
  { name: "mobile-390", w: 390, h: 844, hasBottom: true },   // iPhone 12/13/14
  { name: "mobile-600", w: 600, h: 900, hasBottom: true },   // large phone / small tablet portrait
  { name: "tablet-767", w: 767, h: 1024, hasBottom: true },  // just BELOW md breakpoint edge
  { name: "tablet-768", w: 768, h: 1024, hasBottom: false }, // exactly AT md breakpoint edge
  { name: "tablet-820", w: 820, h: 1180, hasBottom: false }, // iPad Air
  { name: "desktop-1024", w: 1024, h: 768, hasBottom: false }, // lg breakpoint
  { name: "desktop-1440", w: 1440, h: 900, hasBottom: false }, // standard desktop
];

function loadPng(file) {
  return PNG.sync.read(fs.readFileSync(file));
}

function compare(actualFile, baselineFile, diffFile) {
  const a = loadPng(actualFile);
  const b = loadPng(baselineFile);
  if (a.width !== b.width || a.height !== b.height) {
    return { ok: false, reason: `size mismatch: ${a.width}x${a.height} vs ${b.width}x${b.height}` };
  }
  const diff = new PNG({ width: a.width, height: a.height });
  const bad = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: THRESHOLD });
  const ratio = bad / (a.width * a.height);
  if (ratio > MAX_DIFF_RATIO) {
    fs.writeFileSync(diffFile, PNG.sync.write(diff));
    return { ok: false, reason: `${bad} pixels differ (${(ratio * 100).toFixed(2)}%)` };
  }
  return { ok: true, ratio };
}

async function captureRegion(page, selector, out) {
  const el = await page.locator(selector).first();
  await el.waitFor({ state: "visible", timeout: 5000 });
  await el.screenshot({ path: out });
}

async function verifyA11y(page, size) {
  // Every interactive element in the header + bottom nav must have an
  // accessible name and be reachable/activatable via keyboard.
  const info = await page.evaluate(() => {
    function name(el) {
      return (
        el.getAttribute("aria-label") ||
        el.getAttribute("title") ||
        (el.textContent || "").trim() ||
        ""
      );
    }
    function collect(root) {
      if (!root) return [];
      return Array.from(root.querySelectorAll("a, button")).filter((el) => {
        const s = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none";
      }).map((el) => ({
        tag: el.tagName,
        name: name(el),
        tabIndex: el.tabIndex,
        hasFocusStyles: /focus-visible|focus:/.test(el.className) || el.tagName === "A" || el.tagName === "BUTTON",
      }));
    }
    const header = collect(document.querySelector("header"));
    const bottom = collect(document.querySelector('nav[aria-label="Primary mobile"]'));
    return { header, bottom };
  });

  const missing = [...info.header, ...info.bottom].filter((x) => !x.name);
  if (missing.length) {
    throw new Error(`[${size.name}] ${missing.length} interactive elements without accessible name: ${JSON.stringify(missing)}`);
  }
  const untabbable = [...info.header, ...info.bottom].filter((x) => x.tabIndex < 0);
  if (untabbable.length) {
    throw new Error(`[${size.name}] elements are removed from tab order: ${JSON.stringify(untabbable)}`);
  }

  // Prove keyboard navigation reaches the header nav (first Tab lands on something focusable).
  await page.evaluate(() => (document.activeElement instanceof HTMLElement) && document.activeElement.blur());
  await page.keyboard.press("Tab");
  const active = await page.evaluate(() => {
    const el = document.activeElement;
    return el ? { tag: el.tagName, name: el.getAttribute("aria-label") || el.textContent?.trim() } : null;
  });
  if (!active || (active.tag !== "A" && active.tag !== "BUTTON")) {
    throw new Error(`[${size.name}] Tab did not land on a focusable element (got ${JSON.stringify(active)})`);
  }
  return { headerCount: info.header.length, bottomCount: info.bottom.length, firstFocus: active };
}

const results = [];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/chromium-1194/chrome-linux/chrome" });
try {
  for (const size of SIZES) {
    const ctx = await browser.newContext({ viewport: { width: size.w, height: size.h }, reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await page.goto(BASE_URL + "/", { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);

    // Header
    const headerOut = path.join(ACTUAL, `${size.name}_header.png`);
    await captureRegion(page, "header", headerOut);

    // Bottom nav (mobile only)
    let bottomOut = null;
    if (size.name === "mobile") {
      bottomOut = path.join(ACTUAL, `${size.name}_bottom.png`);
      await captureRegion(page, 'nav[aria-label="Primary mobile"]', bottomOut);
    } else {
      const exists = await page.locator('nav[aria-label="Primary mobile"]').count();
      const visible = exists ? await page.locator('nav[aria-label="Primary mobile"]').first().isVisible() : false;
      if (visible) throw new Error(`[${size.name}] bottom nav must be hidden at tablet+desktop widths`);
    }

    const a11y = await verifyA11y(page, size);

    const captures = [headerOut, bottomOut].filter(Boolean);
    for (const file of captures) {
      const base = path.join(BASELINE, path.basename(file));
      if (UPDATE || !fs.existsSync(base)) {
        fs.copyFileSync(file, base);
        results.push({ size: size.name, file: path.basename(file), status: "baseline-updated", a11y });
      } else {
        const diffFile = path.join(DIFF, path.basename(file));
        const r = compare(file, base, diffFile);
        results.push({ size: size.name, file: path.basename(file), status: r.ok ? "pass" : "fail", reason: r.reason, a11y });
      }
    }
    await ctx.close();
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify(results, null, 2));
const failed = results.filter((r) => r.status === "fail");
if (failed.length) { console.error(`\n${failed.length} visual diff failure(s)`); process.exit(1); }
console.log(`\nAll ${results.length} checks passed.`);
