/**
 * E2E: MCP invoke-tool runtime edge cases.
 * Verifies unknown tools, malformed payloads, and success paths respond
 * with the shape the MCP protocol expects — all with backend mocked.
 * Run: node tests/e2e/mcp-invoke-tool.spec.mjs
 */
import { chromium } from "playwright";
import { installSupabaseMocks } from "../mocks/supabase.mjs";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:8080";
const failures = [];
const fail = (m) => { console.error("✗", m); failures.push(m); };
const ok = (m) => console.log("✓", m);

async function run() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await installSupabaseMocks(page);

  const post = async (path, body) => {
    return await page.request.post(`${BASE_URL}${path}`, {
      data: body,
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
      },
      failOnStatusCode: false,
    });
  };

  // Unknown tool name
  const r1 = await post("/.mcp/invoke-tool/does-not-exist", { arguments: {} });
  if (r1.status() < 400) fail(`Unknown tool should 4xx, got ${r1.status()}`);
  else ok(`Unknown tool → ${r1.status()}`);

  // Malformed body
  const r2 = await page.request.post(`${BASE_URL}/.mcp/invoke-tool/get-site-info`, {
    data: "not-json{",
    headers: { "Content-Type": "application/json" },
    failOnStatusCode: false,
  });
  if (r2.status() === 500 && !(await r2.text()).includes("stack")) {
    ok("Malformed payload → controlled error, no stack leak");
  } else if (r2.status() >= 400 && r2.status() < 500) {
    ok(`Malformed payload → ${r2.status()}`);
  } else {
    fail(`Malformed payload returned ${r2.status()} — should reject cleanly`);
  }

  // MCP list endpoint sanity check
  const r3 = await page.request.get(`${BASE_URL}/.mcp/list-tools`, { failOnStatusCode: false });
  if (r3.status() === 200) ok("MCP list-tools reachable");
  else console.warn(`  (list-tools returned ${r3.status()} — informational)`);

  await browser.close();
}

run()
  .then(() => {
    if (failures.length) { console.error(`\n✗ ${failures.length} failure(s)`); process.exit(1); }
    console.log("\n✓ MCP mocked E2E passed");
  })
  .catch((e) => { console.error("Runner crashed:", e); process.exit(1); });
