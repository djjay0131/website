// Route inventory and redirect map (SEAM-6).
//
// A route is a URL path relative to the base, with a leading slash: a page is
// its directory form ("/cv/academic/"), a file is its exact path
// ("/pdfs/academic.pdf"). The redirect map has one { from, to } entry per route,
// from "/website/<path>" to "/<path>".
import fs from "node:fs";
import path from "node:path";
import { CI_PUBLIC_FILES, LEGACY_REDIRECTS, SMOKE_ROUTES } from "./site-routes.mjs";
import { PAGES_SITE_BASE, normalizeBase } from "./site-env.mjs";

// Content-hashed build assets (CSS, fonts). Only pages reference them, their
// names change on every dependency bump, and no inbound link targets them.
export const EXCLUDED_BUILD_PREFIXES = ["_astro/"];

/** Leading slash, no repeated slashes, and a trailing slash on anything without a file extension. */
export function normalizeRoute(route) {
  let r = `/${String(route).trim().replace(/^\/+/, "")}`.replace(/\/{2,}/g, "/");
  if (r === "/" || r.endsWith("/")) return r;
  const last = r.slice(r.lastIndexOf("/") + 1);
  return last.includes(".") ? r : `${r}/`;
}

function walkFiles(dir, rel = "") {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
    const child = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...walkFiles(dir, child));
    else out.push(child);
  }
  return out;
}

function fileToRoute(relFile) {
  if (relFile === "index.html") return "/";
  if (relFile.endsWith("/index.html")) return `/${relFile.slice(0, -"index.html".length)}`;
  return `/${relFile}`;
}

/** Every route a built output directory serves. */
export function routesFromBuild(distDir, { excludePrefixes = EXCLUDED_BUILD_PREFIXES } = {}) {
  return walkFiles(distDir)
    .filter((f) => !excludePrefixes.some((p) => f.startsWith(p)))
    .map(fileToRoute)
    .map(normalizeRoute);
}

/** Routes of the non-dynamic pages under src/pages, read from file names alone (no build). */
export function routesFromPagesDir(pagesDir) {
  return walkFiles(pagesDir)
    .filter((f) => !f.includes("[") && !/\.test\.[jt]s$/.test(f))
    .map((f) => {
      if (/\.(astro|md|mdx|html)$/.test(f)) {
        const stem = f.replace(/\.(astro|md|mdx|html)$/, "");
        if (stem === "index") return "/";
        return stem.endsWith("/index") ? `/${stem.slice(0, -"index".length)}` : `/${stem}/`;
      }
      if (/\.[jt]s$/.test(f)) return `/${f.replace(/\.[jt]s$/, "")}`; // endpoint, e.g. robots.txt.ts
      return null;
    })
    .filter(Boolean)
    .map(normalizeRoute);
}

/** Routes of committed files in public/. CI-provided files are listed separately. */
export function routesFromPublicDir(publicDir) {
  return walkFiles(publicDir)
    .filter((f) => !f.startsWith("pdfs/") && !CI_PUBLIC_FILES.includes(f))
    .map((f) => normalizeRoute(`/${f}`));
}

/** The CV PDFs CI serves: one per CV variant page. */
export function cvPdfRoutes(routes) {
  return routes
    .map((r) => /^\/cv\/([^/]+)\/$/.exec(r))
    .filter(Boolean)
    .map((m) => `/pdfs/${m[1]}.pdf`);
}

/**
 * Every route the GitHub Pages build serves: each file in the build output,
 * each Astro `redirects` source, the smoke-test routes, and the files CI adds
 * to public/ (build-info.json, the photo, one PDF per CV variant).
 */
export function inventoryRoutes({
  distDir,
  redirects = LEGACY_REDIRECTS,
  smokeRoutes = SMOKE_ROUTES,
  ciPublicFiles = CI_PUBLIC_FILES,
}) {
  const built = routesFromBuild(distDir);
  const all = [
    ...built,
    ...cvPdfRoutes(built),
    ...redirects.map((r) => r.from),
    ...smokeRoutes,
    ...ciPublicFiles,
  ].map(normalizeRoute);
  return [...new Set(all)].sort();
}

function oldPath(route, oldBase) {
  return normalizeBase(oldBase).replace(/\/$/, "") + normalizeRoute(route);
}

/** One { from: "/website/<path>", to: "/<path>" } entry per route, sorted. */
export function buildRedirectMap(routes, oldBase = PAGES_SITE_BASE) {
  return [...new Set(routes.map(normalizeRoute))].sort().map((to) => ({ from: oldPath(to, oldBase), to }));
}

/** Routes the map does not redirect correctly (missing, or pointing elsewhere). */
export function findUncovered(map, routes, oldBase = PAGES_SITE_BASE) {
  const byFrom = new Map(map.map((e) => [e.from, e.to]));
  return [...new Set(routes.map(normalizeRoute))]
    .sort()
    .filter((route) => byFrom.get(oldPath(route, oldBase)) !== route);
}
