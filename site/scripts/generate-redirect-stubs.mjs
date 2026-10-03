#!/usr/bin/env node
// THE PAGES RETIREMENT STUBS (SEAM-P5; ADR-0020).
//
//   node scripts/generate-redirect-stubs.mjs
//   npm run redirects:stubs
//
// Reads the committed redirect map (redirects/github-pages.json, one {from,to}
// per route the old GitHub Pages site served) and writes a stubs-only artifact:
//
//   - one static meta-refresh stub per entry into site/dist-redirects/, at the
//     artifact-relative path the old URL maps to, forwarding to
//     https://jason.cusati.us/<to>;
//   - a 404.html into site/dist-redirects/, which forwards an unknown
//     /website/** path to its canonical equivalent;
//   - the same 404.html into site/dist-public/, so Firebase Hosting serves it
//     for unknown canonical paths (ADR-0020 decision 3).
//
// WHY A STUBS-ONLY ARTIFACT. GitHub Pages can only serve static files; it cannot
// issue a 301. Retiring the full-site upload while keeping old inbound links
// alive therefore means publishing stubs in place of the site. The `deploy` job
// (infra stream) uploads ONLY dist-redirects to Pages.
//
// NO PRIVATE CONTENT. A stub carries only the legacy path it replaces and the
// canonical target it forwards to — never an item title, summary or payload. The
// map itself already names the private fellowship paths (they were public on the
// old site), and ADR-0020 decision 5 / its Risks section accept that the stub
// text repeats those paths; the leak check's redirect-stub scan asserts that no
// private TITLE or SUMMARY ever reaches a stub.
//
// PATHS. A Pages project site is served from https://<owner>.github.io/website/,
// so the uploaded artifact's root corresponds to /website/. A map entry with
// `from: "/website/cv/"` therefore lands at `cv/index.html` in the artifact, and
// `from: "/website/build-info.json"` at `build-info.json`.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PAGES_SITE_BASE, normalizeBase } from "./site-env.mjs";
import { CANONICAL_ORIGIN } from "../src/lib/canonical-url.mjs";

const SITE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Where the stubs-only artifact is written, relative to site/. Gitignored. */
export const STUBS_DIR = "dist-redirects";
export const STUBS_DIR_PATH = path.join(SITE_ROOT, STUBS_DIR);
export const MAP_PATH = path.join(SITE_ROOT, "redirects", "github-pages.json");
export const PUBLIC_DIR_PATH = path.join(SITE_ROOT, "dist-public");

/** The absolute canonical target a `to` path forwards to. */
export function canonicalTarget(to) {
  const rel = String(to ?? "/").trim();
  const pathname = rel.startsWith("/") ? rel : `/${rel}`;
  return `${CANONICAL_ORIGIN}${pathname}`;
}

/**
 * The artifact-relative file that serves a map entry's `from` URL.
 *
 * @param {string} from a map `from`, e.g. "/website/cv/"
 * @param {string} [oldBase] the retired Pages base, default "/website/"
 * @returns {string} e.g. "cv/index.html"
 */
export function stubRelativePath(from, oldBase = PAGES_SITE_BASE) {
  const base = normalizeBase(oldBase); // always "/website/"
  const raw = String(from ?? "");
  if (!raw.startsWith(base)) {
    throw new Error(
      `redirect map entry ${JSON.stringify(raw)} is not under the retired Pages base ` +
        `${JSON.stringify(base)}; refusing to write a stub at the wrong path.`,
    );
  }
  const rest = raw.slice(base.length).replace(/^\/+/, "");
  if (rest === "" || rest.endsWith("/")) return `${rest}index.html`;
  return rest;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** The meta-refresh stub for one map entry. Contains only the target path. */
export function renderStub({ to }) {
  const target = escapeHtml(canonicalTarget(to));
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="robots" content="noindex">
<meta http-equiv="refresh" content="0; url=${target}">
<link rel="canonical" href="${target}">
<title>Redirecting</title>
</head>
<body>
<p>This page has moved to <a href="${target}">${target}</a>.</p>
</body>
</html>
`;
}

/**
 * The canonical 404 mapping page.
 *
 * It forwards ONLY a legacy /website/** path to its canonical equivalent. On
 * Firebase (base "/") an unknown path has no /website prefix, so the page simply
 * reports 404 and links home — it must not redirect a canonical path to itself,
 * which would be an infinite loop.
 */
export function render404() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Page not found</title>
<script>
  (function () {
    var legacy = "/website";
    var p = window.location.pathname;
    if (p === legacy || p.indexOf(legacy + "/") === 0) {
      var rest = p.slice(legacy.length) || "/";
      window.location.replace("${CANONICAL_ORIGIN}" + rest + window.location.search + window.location.hash);
    }
  })();
</script>
</head>
<body>
<h1>Page not found</h1>
<p>This page has moved or does not exist. Continue to
<a href="${CANONICAL_ORIGIN}/">${CANONICAL_ORIGIN}/</a>.</p>
</body>
</html>
`;
}

/**
 * Parse and validate the redirect map.
 * @param {unknown} raw
 * @returns {{from: string, to: string}[]}
 */
export function normalizeMap(raw) {
  if (!Array.isArray(raw)) throw new Error("the redirect map must be a JSON array of {from,to}");
  return raw.map((entry, index) => {
    const from = entry && typeof entry.from === "string" ? entry.from : null;
    const to = entry && typeof entry.to === "string" ? entry.to : null;
    if (!from || !to) {
      throw new Error(`redirect map entry ${index} must have string "from" and "to"`);
    }
    return { from, to };
  });
}

/**
 * Write the stubs artifact (and, when it exists, the public 404.html).
 *
 * @param {{map: {from: string, to: string}[], outDir: string, publicDir?: string | null}} options
 * @returns {{count: number, stubs: string[], notFoundPath: string, publicNotFound: string | null}}
 */
export function generateRedirectStubs({ map, outDir, publicDir = null }) {
  const entries = normalizeMap(map);
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const stubs = [];
  for (const entry of entries) {
    const rel = stubRelativePath(entry.from);
    const file = path.join(outDir, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, renderStub(entry));
    stubs.push(rel);
  }

  const notFound = render404();
  const notFoundPath = path.join(outDir, "404.html");
  fs.writeFileSync(notFoundPath, notFound);

  let publicNotFound = null;
  if (publicDir && fs.existsSync(publicDir) && fs.statSync(publicDir).isDirectory()) {
    publicNotFound = path.join(publicDir, "404.html");
    fs.writeFileSync(publicNotFound, notFound);
  }
  return { count: entries.length, stubs, notFoundPath, publicNotFound };
}

function main() {
  if (!fs.existsSync(MAP_PATH)) {
    console.error(`redirects:stubs: no redirect map at ${MAP_PATH}; run npm run redirects:generate first`);
    process.exit(2);
  }
  const map = JSON.parse(fs.readFileSync(MAP_PATH, "utf8"));
  const result = generateRedirectStubs({
    map,
    outDir: STUBS_DIR_PATH,
    publicDir: PUBLIC_DIR_PATH,
  });
  console.log(
    `redirects:stubs: wrote ${result.count} stub(s) + 404.html to ` +
      `${path.relative(SITE_ROOT, STUBS_DIR_PATH)}/`,
  );
  if (result.publicNotFound) {
    console.log(
      `redirects:stubs: also wrote 404.html into ` +
        `${path.relative(SITE_ROOT, PUBLIC_DIR_PATH)}/ (Firebase serves it)`,
    );
  } else {
    console.warn(
      `redirects:stubs: ${path.relative(SITE_ROOT, PUBLIC_DIR_PATH)}/ does not exist, so no 404.html ` +
        `was placed for Firebase; run npm run build:public first if this is a deploy`,
    );
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
