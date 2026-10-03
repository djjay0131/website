// THE FRAMED-ITEM MODEL, SHARED BY BOTH OUTPUTS (ADR-0005; ADR-0010; SEAM-1, SEAM-5).
//
// A `format: html` or `format: bundle` item is a folder of files served verbatim
// in a thin frame with a back link. This module declares, once, the three facts
// both builds need and must agree on:
//
//   1. what route the item's FRAME lives at     -> routeFor()
//   2. where the item's PAYLOAD bytes are served -> PAYLOAD_ROOT + payloadUrlFor()
//   3. which files travel with the item          -> stagingPlanFor()
//
// It is public-safe by construction: nothing here knows what "private" means, so
// it can be imported by src/pages/** without violating the structural guarantee
// (scripts/private-structure.test.ts). The private build's module,
// src-private/lib/private-content.mjs, is a thin re-export of this one, so the
// frame URL and the staging plan cannot drift between the two outputs.
//
// Nothing under src-private/ may be imported from here or from anything the
// public build compiles. The dependency arrow points one way.

import fs from "node:fs";
import path from "node:path";
import { effectiveVisibility, readPublishAllowlist } from "./hub-content.mjs";

/** Where an item's payload bytes are served from, in both outputs. */
export const PAYLOAD_ROOT = "_payload";

/**
 * THE SHARE-SERVABLE DOCUMENT NAMESPACE (SEAM-S1, amended 2026-10-03).
 *
 * A share token reaches `<section>/<source>/<slug>/_doc/`, NOT the member frame
 * at `<section>/<source>/<slug>/`. The frame carries the members' navigation
 * (every private item's title) and absolute `/p/` links, so a signed-out share
 * holder saw an empty page that leaked the private catalogue (Dissenter Wave 3
 * D1). This namespace holds a self-contained, item-scoped copy of the item's
 * document under its own basename (e.g. `committee.html`,
 * `anthropic-fellow.pdf`), plus its non-document assets. Renaming the entry to
 * `index.html` mangled a non-HTML item: the gate infers the content type from
 * the object name, so `_doc/index.html` over PDF bytes would be served as
 * `text/html`. The stored share row carries `entry` so `GET /s/{token}/` can
 * name the real file (SEAM-S1, amended again 2026-10-03).
 *
 * `_doc` is a hub-owned namespace: a satellite source or slug may not be `_doc`.
 */
export const SHARE_DOC_ROOT = "_doc";

/**
 * THE GATE'S PATH ALLOWLIST (gate stream finding SD-7).
 *
 * The gate validates `GET /p/{path}` with an ALLOWLIST: every path segment must
 * match this character set, and anything else is refused with a 404 before the
 * bucket is touched. That is the right choice -- a blocklist of traversal
 * spellings is the kind of thing an attacker eventually out-spells.
 *
 * The consequence lands here. A file written into dist-private whose name
 * contains anything outside this set syncs to the private bucket perfectly and
 * then returns 404 to a signed-in member, with NOTHING failing anywhere. The
 * private build calls findUnservablePaths() before writing its receipt so that
 * becomes a caught build error instead. The public build does not need it (there
 * is no gate in front of dist-public), but the pattern lives here because it is
 * a property of the shared filename shapes.
 */
export const GATE_SEGMENT_PATTERN = /^[A-Za-z0-9._-]+$/;

/**
 * Output-relative paths the gate could never serve.
 *
 * @param {readonly string[]} relPaths output-relative file paths
 * @returns {{path: string, segment: string}[]}
 */
export function findUnservablePaths(relPaths) {
  const bad = [];
  for (const rel of relPaths) {
    for (const segment of String(rel).split("/")) {
      if (segment === "") continue;
      if (!GATE_SEGMENT_PATTERN.test(segment)) bad.push({ path: rel, segment });
    }
  }
  return bad;
}

/**
 * THE BASE IS NOT OPTIONAL IN PRACTICE (issue #27).
 *
 * The gate serves the private area under /p/**, stripping /p/ to form the object
 * name. Astro's `base` rewrites the URLs IT generates, but these functions build
 * raw strings, so `base` never reaches them. Callers pass
 * `import.meta.env.BASE_URL`, which Astro sets from the same `base` that
 * produced the asset URLs, so the two can never drift apart. The default of "/"
 * keeps these usable from plain node and keeps the unprefixed behaviour
 * explicit.
 */
function withBase(base, rest) {
  const prefix = String(base ?? "/").replace(/\/+$/, "");
  return `${prefix}/${rest}`;
}

/** The frame's route for an item: <base><section>/<source>/<slug>/ */
export function routeFor(item, base = "/") {
  return withBase(base, `${item.section}/${item.source}/${item.slug}/`);
}

/** Where an item's payload entry point is served: <base>_payload/<source>/<path> */
export function payloadUrlFor(item, base = "/") {
  return withBase(base, `${PAYLOAD_ROOT}/${item.source}/${item.path}`);
}

/**
 * Page extensions. A file with one of these is a DOCUMENT, and a document is
 * staged only when the manifest still declares it (see stagingPlanFor).
 */
const PAGE_EXTENSIONS = new Set([".html", ".htm"]);

/**
 * THE STAGING PLAN: which files under a source's synced prefix travel into an
 * output, and where each one lands.
 *
 * WHY A DIRECTORY AND NOT A FILE. Staging one file per item is correct for
 * `pdf` -- a PDF is the whole document -- and wrong for `html`, which is NOT
 * self-contained in practice: a page loads a sibling stylesheet, images and
 * pages it links to. Copying only the file named in `path` stages a page whose
 * assets are missing, and NOTHING FAILS -- no error, no log line. It simply
 * renders broken. So the unit of staging for an html/bundle item is its
 * CONTAINING DIRECTORY.
 *
 * WHY DOCUMENTS ARE FILTERED, EXCEPT AT THE PREFIX ROOT. A satellite cannot
 * prune (ADR-0007), so a WITHDRAWN page's bytes are still sitting in the
 * directory. Inside a named subdirectory, a plain directory copy would
 * re-publish exactly the document someone withdrew, so every .html/.htm file no
 * surviving item declares is skipped. At the PREFIX ROOT the item's `path`
 * names the folder's entry point and the rest of the folder is a built site
 * (e.g. a MkDocs `index.html` with sibling pages and assets), so the whole
 * subtree travels -- withdrawal there is removing the item, which removes the
 * subtree. The distinction is stated in docs/satellites.md.
 *
 * DIRECTORIES ARE DEDUPED. Two items of one source usually share one directory;
 * the subtree is walked once and each file emitted once.
 *
 * KNOWN RESIDUAL, stated rather than hidden: a withdrawn item's non-document
 * assets (an image only it used) are not distinguishable from live shared assets
 * and are still staged. They carry no item prose. ADR candidate: have `format:
 * html` declare its asset set.
 *
 * @param {string} sourcesDir the synced tree (site/src/content/sources)
 * @param {{source: string, slug: string, path: string, format: string}[]} items
 *        the items to stage -- ONLY those the manifest still declares
 * @returns {{from: string, to: string, source: string}[]} absolute `from`,
 *        output-relative `to`
 */
export function stagingPlanFor(sourcesDir, items) {
  const staged = new Map(); // to -> {from, source}

  // Every document path still declared, per source. Anything else with a page
  // extension inside a named directory is a withdrawn document (ADR-0010
  // decision 1). At the prefix root the filter does not apply (see above).
  const declaredPages = new Map();
  for (const item of items) {
    if (!declaredPages.has(item.source)) declaredPages.set(item.source, new Set());
    declaredPages.get(item.source).add(normalizeRel(item.path));
  }

  // Dedupe the directories to walk.
  const dirs = new Map(); // `${source}\0${dir}` -> {source, dir, root}
  for (const item of items) {
    const rel = normalizeRel(item.path);
    const isFolderFormat = item.format === "html" || item.format === "bundle";
    if (!isFolderFormat) {
      // pdf/data/md: stage the named file alone.
      addFile(staged, sourcesDir, item.source, rel);
      continue;
    }
    const dir = rel.endsWith("/") ? rel.replace(/\/+$/, "") : path.posix.dirname(rel);
    if (dir === "." || dir === "") {
      // The item's folder IS the source prefix root (a built site whose entry
      // point sits at the root). Stage the whole subtree.
      dirs.set(`${item.source} ${""}`, { source: item.source, dir: "", root: true });
      continue;
    }
    dirs.set(`${item.source} ${dir}`, { source: item.source, dir, root: false });
  }

  for (const { source, dir, root } of dirs.values()) {
    const abs = path.join(sourcesDir, source, dir);
    for (const rel of walk(abs)) {
      const relFromPrefix = dir === "" ? rel : path.posix.join(dir, rel);
      const ext = path.posix.extname(rel).toLowerCase();
      if (!root && PAGE_EXTENSIONS.has(ext) && !declaredPages.get(source)?.has(relFromPrefix)) {
        continue; // a withdrawn document's leftover bytes
      }
      addFile(staged, sourcesDir, source, relFromPrefix);
    }
  }

  return [...staged.entries()]
    .map(([to, { from, source }]) => ({ from, to, source }))
    .sort((a, b) => (a.to < b.to ? -1 : a.to > b.to ? 1 : 0));
}

/**
 * THE ITEM-SCOPED SHARE DOCUMENT PLAN (SEAM-S1, amended 2026-10-03).
 *
 * A share is one item, served from `<section>/<source>/<slug>/_doc/` by a
 * signed-out holder, so the copy must be SELF-CONTAINED: it cannot reference the
 * member frame, `_payload/…` or `_astro/…`, none of which the token can reach.
 * For each effectively-private item this returns the files to copy:
 *
 *   - the item's own document (`path`), copied to the tree root under its own
 *     basename (the value the share row stores as `entry`), so the gate serves
 *     it with the content type its extension names;
 *   - every non-document file from the document's containing directory,
 *     preserving its relative structure (a page that loads `assets/style.css`
 *     renders only when the stylesheet travels with it).
 *
 * DOCUMENTS ARE NOT ASSETS, and how they travel depends on where the item lives
 * (the same named-directory/prefix-root distinction `stagingPlanFor` draws):
 *
 *   - inside a NAMED directory the item is one page in a directory shared with
 *     sibling items (both phd fixture pages live in `site/`), so only the
 *     entry travels. A sibling's page and a WITHDRAWN page's leftover
 *     bytes both stay behind -- the same protection `stagingPlanFor` gives the
 *     member payload;
 *   - at the PREFIX ROOT the item's `path` names a built site's entry point, so
 *     the whole subtree travels except documents ANOTHER item declares. The
 *     undeclared pages are that site's own pages, not another item's.
 *
 * It does NOT change `stagingPlanFor`, which the public and member builds still
 * use unchanged. The two plans are additive: `_doc/` is a second, item-scoped
 * copy, not a replacement for `_payload/…`. The residual is the same one
 * `stagingPlanFor` records (C28): a withdrawn sibling's non-document asset is
 * indistinguishable from a shared asset and still travels.
 *
 * `_doc` is reserved. The manifest schema already rejects a `source`/`slug` of
 * `_doc`, and this fails closed a second time by skipping one if it arrives
 * unvalidated (defence in depth, as `addFile` does for `source`).
 *
 * @param {string} sourcesDir the synced tree (site/src/content/sources)
 * @param {{section: string, source: string, slug: string, path: string, format: string}[]} items
 *        the effectively-private items to stage
 * @returns {{from: string, to: string, source: string}[]} absolute `from`,
 *        output-relative `to`
 */
export function docStagingPlanFor(sourcesDir, items) {
  const staged = new Map(); // to -> {from, source}

  // Every document path declared per source. A document in this set, other than
  // the current item's own entry, belongs to a sibling item and is excluded.
  const declaredPages = new Map();
  for (const item of items) {
    if (!declaredPages.has(item.source)) declaredPages.set(item.source, new Set());
    declaredPages.get(item.source).add(normalizeRel(item.path));
  }

  for (const item of items) {
    const source = String(item.source ?? "");
    const slug = String(item.slug ?? "");
    // `_doc` is a hub-owned namespace (SEAM-S1). A source or slug of `_doc`
    // would let one item's tree collide with another's; the schema rejects both,
    // and this is the fail-closed second check.
    if (source === SHARE_DOC_ROOT || slug === SHARE_DOC_ROOT) continue;

    const treeRoot = shareDocRootFor(item);
    if (treeRoot === null) continue; // a section/source/slug that is not a safe path

    const rel = normalizeRel(item.path);
    if (rel === "" || rel.endsWith("/")) continue; // no document to stage

    // The item's own document, copied under its own basename. DO NOT rename it
    // to `index.html`: the gate infers the content type from the object name,
    // so a PDF served as `index.html` would arrive as `text/html`. The basename
    // is the share row's `entry`, and `GET /s/{token}/` requests it by name.
    const entry = path.posix.basename(rel);
    addDocFile(staged, sourcesDir, source, rel, `${treeRoot}/${entry}`);

    // Only a framed item is a folder of files. A pdf/data item is one file:
    // walking its containing directory would sweep unrelated siblings (the cv
    // prefix root holds every CV) into the document tree, so it stages only its
    // entry.
    const isFolderFormat = item.format === "html" || item.format === "bundle";
    if (!isFolderFormat) continue;

    const dir = path.posix.dirname(rel);
    const relDir = dir === "." ? "" : dir;
    const isPrefixRoot = relDir === "";
    const absDir = path.join(sourcesDir, source, relDir);

    for (const relInDir of walk(absDir)) {
      const relFromPrefix = relDir === "" ? relInDir : path.posix.join(relDir, relInDir);
      if (relFromPrefix === rel) continue; // the entry, already staged under its basename
      const ext = path.posix.extname(relInDir).toLowerCase();
      if (PAGE_EXTENSIONS.has(ext)) {
        // A DOCUMENT IS NOT AN ASSET. Inside a named directory the item is one
        // page, so only its renamed entry travels: a sibling's page and a
        // WITHDRAWN page's leftover bytes both stay behind (the same protection
        // stagingPlanFor gives the member payload). At the prefix root the
        // item's `path` names a built site's entry point, so every page travels
        // except those a sibling item declares.
        if (!isPrefixRoot) continue;
        if (declaredPages.get(source)?.has(relFromPrefix)) continue; // a sibling item's page
      }
      addDocFile(staged, sourcesDir, source, relFromPrefix, `${treeRoot}/${relInDir}`);
    }
  }

  return [...staged.entries()]
    .map(([to, { from, source }]) => ({ from, to, source }))
    .sort((a, b) => (a.to < b.to ? -1 : a.to > b.to ? 1 : 0));
}

/** The `_doc` tree root for an item, or null when a segment is not a safe path. */
function shareDocRootFor(item) {
  for (const part of [item.section, item.source, item.slug]) {
    if (typeof part !== "string" || part === "") return null;
    for (const segment of part.split("/")) {
      // `..` matches the gate's segment allowlist, so reject it explicitly.
      if (segment === "." || segment === "..") return null;
      if (!GATE_SEGMENT_PATTERN.test(segment)) return null;
    }
  }
  return path.posix.join(item.section, item.source, item.slug, SHARE_DOC_ROOT);
}

function addDocFile(staged, sourcesDir, source, relFromPrefix, to) {
  // A source name is one safe path segment. Fail closed, as addFile does, so a
  // `source: "../cv"` cannot place a share tree outside `sourcesDir`.
  if (!/^[A-Za-z0-9._-]+$/.test(String(source)) || source === "." || source === "..") return;
  const prefixRoot = path.resolve(sourcesDir, source);
  const from = path.resolve(prefixRoot, relFromPrefix);
  if (from !== prefixRoot && !from.startsWith(prefixRoot + path.sep)) return;
  if (!fs.existsSync(from)) return;
  const normalizedTo = String(to).split(path.sep).join("/");
  if (!staged.has(normalizedTo)) staged.set(normalizedTo, { from, source });
}

function addFile(staged, sourcesDir, source, relFromPrefix) {
  // A source name is one safe path segment. The schema pattern already enforces
  // this, but the staging step must not depend on it: `source: "../cv"` would
  // otherwise place `to` outside `_payload/<source>/`. Fail closed. (Wave 1 Red
  // Team, defence in depth.)
  if (!/^[A-Za-z0-9._-]+$/.test(String(source)) || source === "." || source === "..") return;
  const prefixRoot = path.resolve(sourcesDir, source);
  const from = path.resolve(prefixRoot, relFromPrefix);
  // DEFENCE IN DEPTH. The Zod mirror in src/content.config.ts already rejects a
  // `path` containing `..` before any manifest reaches this function, and that is
  // the real gate. This containment check means the staging step does not silently
  // rely on it: a value that somehow arrives unvalidated cannot walk out of the
  // source prefix and stage an arbitrary file. It FAILS CLOSED by skipping.
  if (from !== prefixRoot && !from.startsWith(prefixRoot + path.sep)) return;
  if (!fs.existsSync(from)) return;
  const to = path.posix.join(PAYLOAD_ROOT, source, relFromPrefix);
  if (!staged.has(to)) staged.set(to, { from, source });
}

function normalizeRel(p) {
  return String(p).replace(/^\/+/, "");
}

function walk(dir, rel = "") {
  const out = [];
  let entries;
  try {
    entries = fs.readdirSync(path.join(dir, rel), { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const child = rel ? path.posix.join(rel, entry.name) : entry.name;
    if (entry.isDirectory()) out.push(...walk(dir, child));
    else out.push(child);
  }
  return out;
}

// --- The public item listing (the /projects/ index; D7) ---------------------

/**
 * Every PUBLIC item across every synced manifest, for a section index.
 *
 * Deliberately does NOT use src/content.config.ts's validating loader: an index
 * that reads a malformed manifest should degrade to "this item is not listed"
 * rather than take the whole build down before the validator can report the
 * malformed manifest with a useful message. The validator still runs later and
 * still fails the build.
 *
 * VISIBILITY IS EFFECTIVE, NOT DECLARED (D8; SEAM-B2). A manifest's
 * `visibility: public` is only a request; this lists an item only when the
 * committed publish allowlist agrees. Reading the raw field here was Wave 1's
 * Dissenter finding D5 and this is the fix.
 *
 * @param {string} sourcesDir
 * @param {{section?: string, excludeSources?: readonly string[], allowlist?: unknown}} [options]
 * @returns {{source: string, slug: string, title: string, section: string,
 *   format: string, path: string, date?: string, summary?: string}[]}
 */
export function collectPublicItems(sourcesDir, options = {}) {
  if (!fs.existsSync(sourcesDir)) return [];
  const allowlist = options.allowlist ?? readPublishAllowlist();
  const exclude = new Set(options.excludeSources ?? []);
  const items = [];
  for (const source of fs.readdirSync(sourcesDir).sort()) {
    if (exclude.has(source)) continue;
    const dir = path.join(sourcesDir, source);
    let stat;
    try {
      stat = fs.statSync(dir);
    } catch {
      continue;
    }
    if (!stat.isDirectory()) continue;
    const manifestPath = path.join(dir, "manifest.json");
    if (!fs.existsSync(manifestPath)) continue;
    let manifest;
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    } catch {
      continue;
    }
    const name = typeof manifest.source === "string" ? manifest.source : source;
    for (const item of manifest?.items ?? []) {
      if (effectiveVisibility(item, name, allowlist) !== "public") continue;
      if (options.section && item.section !== options.section) continue;
      items.push({
        source: typeof manifest.source === "string" ? manifest.source : source,
        slug: String(item.slug ?? ""),
        title: typeof item.title === "string" ? item.title : String(item.slug ?? ""),
        section: typeof item.section === "string" ? item.section : "",
        format: typeof item.format === "string" ? item.format : "",
        path: typeof item.path === "string" ? item.path : "",
        date: typeof item.date === "string" ? item.date : undefined,
        summary: typeof item.summary === "string" ? item.summary : undefined,
      });
    }
  }
  return items;
}
