import { chromium } from "playwright";
import fs from "node:fs";
const exec = fs.existsSync("/chromium-1194/chrome-linux/chrome") ? "/chromium-1194/chrome-linux/chrome" : undefined;
const browser = await chromium.launch({ headless: true, executablePath: exec });
const page = await browser.newPage();
page.on("console", m => console.log("PAGE:", m.type(), m.text()));
page.on("pageerror", e => console.log("PAGEERR:", e.message));
await page.goto("http://localhost:8080/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3000);
console.log("body has offline-banner?", await page.locator('[data-testid="offline-banner"]').count());
const r = await page.evaluate(() => {
  try { window.dispatchEvent(new Event("offline")); } catch(e){ return "err:"+e.message; }
  return "dispatched";
});
console.log("dispatch:", r);
await page.waitForTimeout(500);
console.log("after dispatch count:", await page.locator('[data-testid="offline-banner"]').count());
console.log("HTML snippet:", (await page.content()).length);
await browser.close();
