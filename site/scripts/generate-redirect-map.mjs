#!/usr/bin/env node
// Generate redirects/github-pages.json (SEAM-6) from a route inventory of the
// GitHub Pages build. Recorded in Phase 1; served in Phase 6.
//
//   node scripts/generate-redirect-map.mjs            build the Pages variant into a
//                                                     temporary directory, inventory it,
//                                                     write the map
//   node scripts/generate-redirect-map.mjs --dist D   inventory an existing Pages-variant
//                                                     build in D instead of building
//   node scripts/generate-redirect-map.mjs --check    compare with the committed map;
//                                                     exit 1 if any route is missing
//
// The build reads the local CV data (SEAM-2), so run it with that data present.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildRedirectMap, findUncovered, inventoryRoutes } from "./route-inventory.mjs";
import { PAGES_SITE_BASE, PAGES_SITE_URL } from "./site-env.mjs";

const SITE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const MAP_PATH = path.join(SITE_ROOT, "redirects", "github-pages.json");

function parseArgs(argv) {
  const args = { check: false, dist: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--check") args.check = true;
    else if (argv[i] === "--dist") args.dist = path.resolve(argv[++i] ?? "");
    else throw new Error(`unknown argument: ${argv[i]}`);
  }
  return args;
}

async function buildPagesVariant() {
  // Under node_modules/.cache (gitignored), not the OS temp dir: Astro moves files
  // from site/.astro into outDir with rename(), which fails across filesystems.
  const cacheDir = path.join(SITE_ROOT, "node_modules", ".cache");
  fs.mkdirSync(cacheDir, { recursive: true });
  const outDir = fs.mkdtempSync(path.join(cacheDir, "site-pages-variant-"));
  process.env.SITE_URL = PAGES_SITE_URL;
  process.env.SITE_BASE = PAGES_SITE_BASE;
  const { build } = await import("astro");
  await build({ root: SITE_ROOT, outDir, logLevel: "warn" });
  return outDir;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const distDir = args.dist ?? (await buildPagesVariant());
  try {
    if (!fs.existsSync(path.join(distDir, "index.html"))) {
      throw new Error(`${distDir} does not look like a site build (no index.html)`);
    }
    const routes = inventoryRoutes({ distDir });
    if (args.check) {
      const committed = JSON.parse(fs.readFileSync(MAP_PATH, "utf8"));
      const missing = findUncovered(committed, routes);
      const expected = new Set(buildRedirectMap(routes).map((e) => e.from));
      const extra = committed.filter((e) => !expected.has(e.from)).map((e) => e.from);
      console.log(`inventory: ${routes.length} routes; committed map: ${committed.length} entries`);
      if (extra.length) console.log(`entries with no route in this build (not an error):\n  ${extra.join("\n  ")}`);
      if (missing.length) {
        console.error(`routes missing from ${path.relative(SITE_ROOT, MAP_PATH)}:\n  ${missing.join("\n  ")}`);
        process.exitCode = 1;
      } else {
        console.log("every inventoried route is covered");
      }
      return;
    }
    const map = buildRedirectMap(routes);
    fs.mkdirSync(path.dirname(MAP_PATH), { recursive: true });
    fs.writeFileSync(MAP_PATH, `${JSON.stringify(map, null, 2)}\n`);
    console.log(`wrote ${map.length} entries to ${path.relative(SITE_ROOT, MAP_PATH)}`);
  } finally {
    if (!args.dist) fs.rmSync(distDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
