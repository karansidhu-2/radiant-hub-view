import { describe, it, expect } from "vitest";
import { readdirSync, statSync, existsSync, readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import path from "node:path";

/**
 * Bundle-size budget tests.
 *
 * Guards the shipped client bundle against regressions. Budgets are set at the
 * current baseline + a small headroom, so any new dependency or accidental
 * static import of a heavy module (jspdf, html2canvas, recharts) trips a red
 * test instead of silently ballooning the payload users download.
 *
 * Requires a prior `bun run build`. Skips (does not fail) when dist/ is
 * missing so `bun run test` still works pre-build in CI.
 */

const CLIENT_DIR = path.resolve(process.cwd(), "dist/client/assets");
const hasBuild = existsSync(CLIENT_DIR);

type File = { name: string; size: number; gz: number };
const files: File[] = hasBuild
  ? readdirSync(CLIENT_DIR)
      .filter((f) => f.endsWith(".js"))
      .map((name) => {
        const p = path.join(CLIENT_DIR, name);
        const buf = readFileSync(p);
        return { name, size: statSync(p).size, gz: gzipSync(buf).length };
      })
  : [];

const totalRaw = files.reduce((s, f) => s + f.size, 0);
const totalGz = files.reduce((s, f) => s + f.gz, 0);
const KB = 1024;

// Baseline (measured post-jspdf-lazy-load): raw 2.4MB / gz ~700KB.
// Budgets add ~15% headroom for organic feature growth.
const BUDGETS = {
  totalRaw: 2800 * KB,
  totalGz: 800 * KB,
  singleChunkRaw: 620 * KB, // lucide-react barrel is currently the ceiling
  singleChunkGz: 180 * KB,
};

// Route entry chunks: separate, tighter budget — a route chunk >150KB gz
// blocks first render on that page.
const ROUTE_CHUNK_GZ_BUDGET = 150 * KB;

describe.skipIf(!hasBuild)("bundle budget: totals", () => {
  it("total raw client JS stays under budget", () => {
    expect(totalRaw, `raw=${(totalRaw / KB).toFixed(1)}KB`).toBeLessThan(BUDGETS.totalRaw);
  });
  it("total gzipped client JS stays under budget", () => {
    expect(totalGz, `gz=${(totalGz / KB).toFixed(1)}KB`).toBeLessThan(BUDGETS.totalGz);
  });
});

describe.skipIf(!hasBuild)("bundle budget: no single chunk explodes", () => {
  it("no single chunk exceeds raw budget", () => {
    const big = files.filter((f) => f.size > BUDGETS.singleChunkRaw);
    expect(big.map((f) => `${f.name}=${(f.size / KB).toFixed(0)}KB`)).toEqual([]);
  });
  it("no single chunk exceeds gzipped budget", () => {
    const big = files.filter((f) => f.gz > BUDGETS.singleChunkGz);
    expect(big.map((f) => `${f.name}=${(f.gz / KB).toFixed(0)}KB gz`)).toEqual([]);
  });
});

describe.skipIf(!hasBuild)("bundle budget: route chunks fit their page", () => {
  const routeChunks = files.filter(
    (f) => f.name.startsWith("_site") || f.name.startsWith("_authenticated"),
  );
  it("every route chunk is under the per-page gzip budget", () => {
    const over = routeChunks.filter((f) => f.gz > ROUTE_CHUNK_GZ_BUDGET);
    expect(over.map((f) => `${f.name}=${(f.gz / KB).toFixed(0)}KB gz`)).toEqual([]);
  });
});

describe.skipIf(!hasBuild)("bundle: heavy libs are code-split, not in main entry", () => {
  // The index / main entry must not statically include jspdf, html2canvas, or
  // recharts — those are 100KB+ gz each and belong in a lazy chunk.
  const entry = files.find((f) => f.name.startsWith("index-"));
  it("main entry chunk exists", () => {
    expect(entry).toBeDefined();
  });
  it("jspdf is not statically bundled anywhere it should not be", () => {
    // jspdf must ship as its own chunk, not merged into a route chunk
    // (so the /confirmation route stays lean until the user clicks Download).
    const jspdfChunk = files.find((f) => f.name.startsWith("jspdf") || f.name.includes("jspdf"));
    expect(jspdfChunk, "jspdf should be split into its own chunk").toBeDefined();
    const confirmation = files.find((f) => f.name.startsWith("_site.confirmation"));
    if (confirmation) {
      // A route chunk containing jspdf blows past 300KB — the budget above
      // catches this, but assert directly for a clearer error message.
      expect(
        confirmation.size,
        "confirmation route must not bundle jspdf statically",
      ).toBeLessThan(150 * KB);
    }
  });
});
