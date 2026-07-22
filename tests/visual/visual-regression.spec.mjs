/**
 * Visual regression baseline for landing, account, and admin screens.
 *
 * Strategy: Playwright pixel-diff screenshots (self-hosted, zero-cost).
 * Baselines live in `tests/visual/__snapshots__/`. First run creates them;
 * subsequent runs diff against baselines and fail on drift > threshold.
 *
 * Chromatic/Percy upgrade path: swap `page.screenshot` for `percySnapshot`
 * or point Chromatic at the same URLs. Baselines and CI hooks stay identical.
 *
 * Run:      node tests/visual/visual-regression.spec.mjs
 * Update:   UPDATE_SNAPSHOTS=1 node tests/visual/visual-regression.spec.mjs
 */
import { chromium } from "playwright";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { installSupabaseMocks, mockSession } from "../mocks/supabase.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE_URL = process.env.BASE_URL ?? "http://localhost:8080";
const UPDATE = process.env.UPDATE_SNAPSHOTS === "1";
const SNAP_DIR = join(__dirname, "__snapshots__");
const DIFF_DIR = join(__dirname, "__diffs__");
const THRESHOLD = 0.1;           // per-pixel color threshold
const MAX_DIFF_RATIO = 0.005;    // allow <0.5% of pixels to differ

if (!existsSync(SNAP_DIR)) mkdirSync(SNAP_DIR, { recursive: true });
if (!existsSync(DIFF_DIR)) mkdirSync(DIFF_DIR, { recursive: true });

const failures = [];
const fail = (m) => { console.error("✗", m); failures.push(m); };
const ok = (m) => console.log("✓", m);

/**
 * Freeze animations, fonts, and time-dependent UI so screenshots are stable.
 */
async function stabilize(page) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        transition-duration: 0s !important;
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        caret-color: transparent !important;
      }
      html { scroll-behavior: auto !important; }
    `,
  });
  await page.evaluate(() => document.fonts?.ready);
  await page.waitForTimeout(150);
}

async function snap(page, name) {
  const buf = await page.screenshot({ fullPage: false });
  const file = join(SNAP_DIR, `${name}.png`);

  if (!existsSync(file) || UPDATE) {
    writeFileSync(file, buf);
    ok(`baseline written: ${name}`);
    return;
  }

  const baseline = PNG.sync.read(readFileSync(file));
  const actual = PNG.sync.read(buf);
  if (baseline.width !== actual.width || baseline.height !== actual.height) {
    writeFileSync(join(DIFF_DIR, `${name}.actual.png`), buf);
    fail(`${name}: dimension drift ${actual.width}x${actual.height} vs baseline ${baseline.width}x${baseline.height}`);
    return;
  }
  const { width, height } = baseline;
  const diff = new PNG({ width, height });
  const mismatched = pixelmatch(baseline.data, actual.data, diff.data, width, height, { threshold: THRESHOLD });
  const ratio = mismatched / (width * height);
  if (ratio > MAX_DIFF_RATIO) {
    writeFileSync(join(DIFF_DIR, `${name}.diff.png`), PNG.sync.write(diff));
    writeFileSync(join(DIFF_DIR, `${name}.actual.png`), buf);
    fail(`${name}: ${(ratio * 100).toFixed(3)}% pixels drifted (allowed ${(MAX_DIFF_RATIO * 100).toFixed(2)}%). Diff in tests/visual/__diffs__/`);
  } else {
    ok(`${name}: match (${(ratio * 100).toFixed(3)}% drift)`);
  }
}

async function withPage(fn, viewport = { width: 1280, height: 900 }) {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  try { await fn(page); } finally { await browser.close(); }
}

async function run() {
  // 1. Landing (unauthenticated, desktop)
  await withPage(async (page) => {
    await installSupabaseMocks(page, { session: null });
    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
    await stabilize(page);
    await snap(page, "landing-desktop");
  });

  // 2. Landing (mobile)
  await withPage(async (page) => {
    await installSupabaseMocks(page, { session: null });
    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
    await stabilize(page);
    await snap(page, "landing-mobile");
  }, { width: 390, height: 844 });

  // 3. Account (authenticated customer)
  await withPage(async (page) => {
    await installSupabaseMocks(page, { session: mockSession(), isAdmin: false });
    await page.goto(`${BASE_URL}/account`, { waitUntil: "networkidle" });
    await stabilize(page);
    await snap(page, "account-desktop");
  });

  // 4. Admin dashboard
  await withPage(async (page) => {
    await installSupabaseMocks(page, { session: mockSession(), isAdmin: true });
    await page.goto(`${BASE_URL}/admin`, { waitUntil: "networkidle" });
    await stabilize(page);
    await snap(page, "admin-dashboard");
  });

  // 5. Admin settings
  await withPage(async (page) => {
    await installSupabaseMocks(page, { session: mockSession(), isAdmin: true });
    await page.goto(`${BASE_URL}/admin/settings`, { waitUntil: "networkidle" });
    await stabilize(page);
    await snap(page, "admin-settings");
  });

  if (failures.length) {
    console.error(`\n${failures.length} visual regression(s) detected. Review tests/visual/__diffs__/ and re-run with UPDATE_SNAPSHOTS=1 to accept.`);
    process.exit(1);
  }
  console.log(`\n✓ Visual regression passed${UPDATE ? " (baselines updated)" : ""}`);
}

run().catch((e) => { console.error(e); process.exit(1); });
