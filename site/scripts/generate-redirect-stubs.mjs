#!/usr/bin/env node
// THE PAGES RETIREMENT STUBS (SEAM-P5; ADR-0020).
//
//   node scripts/generate-redirect-stubs.mjs
//   npm run redirects:stubs
//
// Reads the committed redirect map (redirects/github-pages.json, one {from,to}
// per route the old GitHub Pages site served) and writes a stubs-only artifact:
//
//   - one static meta-refresh stub per HTML-NAVIGABLE entry (a directory route
//     or an `.html` file) into site/dist-redirects/, at the artifact-relative
//     path the old URL maps to, forwarding to https://jason.cusati.us/<to>;
//   - a 404.html into site/dist-redirects/, which forwards an unknown
//     /website/** path to its canonical equivalent AND every FILE-SHAPED map
//     entry (`.pdf`, `.json`, `.xml`, `.png`, `.svg`, `.ico`, `robots.txt`, ...),
//     which Pages would otherwise serve with the extension's MIME type so the
//     meta-refresh could never fire (Dissenter Wave 5 D2);
//   - a 404.html into site/dist-public/ (the same logic, WITHOUT the Pages
//     file-route list, which is inert on the canonical host and must not put
//     legacy paths into the scanned public build), so Firebase Hosting serves it
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
// `from: "/website/cv/"` therefore lands at `cv/index.html` in the artifact; a
// file-shaped entry such as `from: "/website/build-info.json"` is listed in the
// 404.html mapping, because a file at that exact path would be served as JSON.
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
 * FAILS CLOSED ON TRAVERSAL (Red Team Wave 5 B5; same class as the Wave 4
 * sync-content.sh escape). The old shape only asserted the `/website/` prefix
 * and then `path.join`ed the remainder, so `from: "/website/../pwned.html"`
 * escaped `outDir` and could overwrite the deploy artifact between the Astro
 * build and the upload. A `from` is now rejected outright when it contains a
 * backslash or any `.` / `..` / empty path segment; nothing is written for the
 * whole artifact until every entry has been validated.
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
  if (raw.includes("\\")) {
    throw new Error(
      `redirect map entry ${JSON.stringify(raw)} contains a backslash; refusing to write a stub ` +
        `whose path could be read as an escape from the artifact directory.`,
    );
  }
  const rest = raw.slice(base.length).replace(/^\/+/, "");
  const segments = rest.split("/");
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    // A single trailing slash is the directory marker ("/website/cv/"); any
    // other empty segment (`//`), or a `.` / `..` segment, is a traversal shape.
    const trailingSlash = index === segments.length - 1 && segment === "";
    if (trailingSlash) continue;
    if (segment === "" || segment === "." || segment === "..") {
      throw new Error(
        `redirect map entry ${JSON.stringify(raw)} contains the forbidden path segment ` +
          `${JSON.stringify(segment)}; refusing to write a stub that could escape the artifact ` +
          `directory.`,
      );
    }
  }
  if (rest === "" || rest.endsWith("/")) return `${rest}index.html`;
  return rest;
}

/** True for an artifact-relative path Pages can serve as an HTML document. */
export function isHtmlNavigable(rel) {
  const ext = path.extname(rel).toLowerCase();
  return ext === "" || ext === ".html" || ext === ".htm";
}

/** HTML escaping for values placed in element text and attribute contexts. */
export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * A JS string literal for a value injected into an inline `<script>`, safe in
 * both the JS-string and HTML-script contexts (`</script>`, `<`, `>` and the
 * JS line terminators are escaped).
 */
function escapeScriptString(value) {
  return JSON.stringify(String(value))
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
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
 * FILE-SHAPED LEGACY URLS FORWARD HERE (Dissenter Wave 5 D2). GitHub Pages sets
 * a file's MIME type from its extension, so an HTML meta-refresh written at
 * `pdfs/academic.pdf` is served as `application/pdf` and never executes. The
 * generator therefore writes per-path stubs only for HTML-navigable routes and
 * routes everything else through this page: Pages serves `404.html` as
 * `text/html` for an unmatched path, and the script below forwards it.
 *
 * It also forwards any legacy /website/** path generically, and lists every
 * non-HTML map entry explicitly. On Firebase (base "/") an unknown path has no
 * /website prefix and is not in the list, so the page simply reports 404 and
 * links home — it must not redirect a canonical path to itself, which would be
 * an infinite loop. `fileRoutes` carries only legacy `from` / canonical `to`
 * paths, never private content, and every injected value is escaped so a map
 * entry cannot break out of the inline script.
 *
 * @param {{from: string, to: string}[]} [fileRoutes] non-HTML-navigable entries
 */
export function render404(fileRoutes = []) {
  const origin = escapeScriptString(CANONICAL_ORIGIN);
  const originHtml = escapeHtml(CANONICAL_ORIGIN);
  const routes = fileRoutes
    .map((entry) => `[${escapeScriptString(entry.from)}, ${escapeScriptString(entry.to)}]`)
    .join(", ");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Page not found</title>
<script>
  (function () {
    var origin = ${origin};
    var legacy = "/website";
    var fileRoutes = [${routes}];
    var p = window.location.pathname;
    var target = null;
    for (var i = 0; i < fileRoutes.length; i += 1) {
      if (fileRoutes[i][0] === p) { target = fileRoutes[i][1]; break; }
    }
    if (target === null && (p === legacy || p.indexOf(legacy + "/") === 0)) {
      target = p.slice(legacy.length) || "/";
    }
    if (target !== null) {
      window.location.replace(origin + target + window.location.search + window.location.hash);
    }
  })();
</script>
</head>
<body>
<h1>Page not found</h1>
<p>This page has moved or does not exist. Continue to
<a href="${originHtml}/">${originHtml}/</a>.</p>
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
 * Every entry's path is validated BEFORE the artifact directory is touched, so a
 * single hostile `from` refuses the whole write rather than leaving a partial
 * artifact or a file outside `outDir` (Red Team Wave 5 B5).
 *
 * HTML-navigable entries (directory routes, `.html`) get a per-path meta-refresh
 * stub. File-shaped entries (`.pdf`, `.json`, `.xml`, `.png`, `.svg`, `.ico`,
 * `robots.txt`, ...) are listed in `404.html` instead, because Pages serves a
 * file at the extension's MIME type and would never execute the refresh
 * (Dissenter Wave 5 D2).
 *
 * @param {{map: {from: string, to: string}[], outDir: string, publicDir?: string | null}} options
 * @returns {{count: number, stubs: string[], fileRoutes: {from: string, to: string}[], notFoundPath: string, publicNotFound: string | null}}
 */
export function generateRedirectStubs({ map, outDir, publicDir = null }) {
  const entries = normalizeMap(map);

  // Validate and classify up front; a throw here means nothing is written.
  const planned = entries.map((entry) => {
    const rel = stubRelativePath(entry.from);
    return { entry, rel, navigable: isHtmlNavigable(rel) };
  });

  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const stubs = [];
  const fileRoutes = [];
  for (const { entry, rel, navigable } of planned) {
    if (!navigable) {
      fileRoutes.push({ from: entry.from, to: entry.to });
      continue;
    }
    const file = path.join(outDir, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, renderStub(entry));
    stubs.push(rel);
  }

  const notFound = render404(fileRoutes);
  const notFoundPath = path.join(outDir, "404.html");
  fs.writeFileSync(notFoundPath, notFound);

  let publicNotFound = null;
  if (publicDir && fs.existsSync(publicDir) && fs.statSync(publicDir).isDirectory()) {
    publicNotFound = path.join(publicDir, "404.html");
    // The Firebase mirror carries NO file-route list: on the canonical host the
    // legacy /website/ prefix never occurs, so the list is inert — and keeping
    // the legacy paths out of dist-public/404.html matters, because that file is
    // part of the PUBLIC build the leak check scans with full path needles. The
    // private fellowship PDF path is a map entry and belongs only in the Pages
    // stubs artifact, where ADR-0020 accepts a path.
    fs.writeFileSync(publicNotFound, render404());
  }
  return { count: entries.length, stubs, fileRoutes, notFoundPath, publicNotFound };
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
    `redirects:stubs: wrote ${result.stubs.length} meta-refresh stub(s) + 404.html for ` +
      `${result.fileRoutes.length} file-shaped route(s) to ` +
      `${path.relative(SITE_ROOT, STUBS_DIR_PATH)}/ (${result.count} map entries)`,
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
