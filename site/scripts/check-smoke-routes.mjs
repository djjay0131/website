#!/usr/bin/env node
// Smoke-route presence check (SEAM-7; Chief Reviewer finding F8).
//
//   node scripts/check-smoke-routes.mjs [output-dir]    (default: dist-public)
//   npm run check:smoke-routes [-- output-dir]
//
// Fails when a route the post-deploy smoke test requests has no file in the
// built output, so a cv release that drops a variant fails before deploy
// instead of after. The routes come from SMOKE_ROUTES in site-routes.mjs, their
// one source. A page route ("/cv/academic" or "/cv/academic/") needs
// cv/academic/index.html; a file route ("/pdfs/academic.pdf") needs the file.
// Output paths never include SITE_BASE, so the check is the same after the
// GitHub Pages build. No network, no credentials.
//
// Exit codes: 0 every route present; 1 a route missing; 2 no output directory.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeRoute } from "./route-inventory.mjs";
import { SMOKE_ROUTES } from "./site-routes.mjs";

/**
 * The file a route needs in the build output, relative to it.
 * @param {string} route
 * @returns {string}
 */
export function smokeRouteFile(route) {
  const rel = normalizeRoute(route).slice(1);
  return rel === "" || rel.endsWith("/") ? `${rel}index.html` : rel;
}

/**
 * Smoke routes with no file in distDir, in list order.
 * @param {string} distDir
 * @param {readonly string[]} [routes]
 * @returns {{ route: string, file: string }[]}
 */
export function findMissingSmokeRoutes(distDir, routes = SMOKE_ROUTES) {
  return routes
    .map((route) => ({ route, file: smokeRouteFile(route) }))
    .filter(({ file }) => {
      try {
        return !fs.statSync(path.join(distDir, file)).isFile();
      } catch {
        return true;
      }
    });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const distDir = process.argv[2] ? path.resolve(process.argv[2]) : path.join(siteRoot, "dist-public");
  const shown = path.relative(process.cwd(), distDir) || ".";
  if (!fs.existsSync(distDir) || !fs.statSync(distDir).isDirectory()) {
    console.error(`check:smoke-routes: no build output at ${shown}; run npm run build first`);
    process.exit(2);
  }
  const missing = findMissingSmokeRoutes(distDir);
  const missingRoutes = new Set(missing.map((m) => m.route));
  for (const route of SMOKE_ROUTES) {
    const file = smokeRouteFile(route);
    console.log(`${missingRoutes.has(route) ? "MISSING" : "OK     "} ${route} → ${file}`);
  }
  if (missing.length > 0) {
    console.error(
      `check:smoke-routes: ${missing.length} of ${SMOKE_ROUTES.length} smoke routes missing from ${shown}: ${missing.map((m) => m.route).join(", ")}`,
    );
    process.exit(1);
  }
  console.log(`check:smoke-routes: all ${SMOKE_ROUTES.length} smoke routes present in ${shown}`);
}
