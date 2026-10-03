#!/usr/bin/env node
// THE LEAK CHECK (ADR-0005 decision 2; SEAM-4; site-phase-3 contract D2).
//
//   node scripts/check-no-private-in-public.mjs [--dist DIR] [--sources DIR] [--json]
//   npm run check:no-private-in-public
//
// Loads every synced manifest, collects every `visibility: private` item, and
// fails if any trace of one appears under dist-public -- IN A FILE'S PATH OR IN
// ITS CONTENTS.
//
// WHY CONTENTS AND NOT ONLY PATHS. The orchestration brief's §4 form of this
// check ("fail if any path under dist-public matches") is insufficient, and
// ADR-0005 settled it the other way in favour of design doc §5. A private item's
// title rendered into a public index page, a private slug in the sitemap, a
// private route in a navigation menu or a search index -- every one of those is a
// leak that lives in file CONTENTS and has no matching path at all. The
// path-only check would pass a build that publishes the name of every private
// document on the front page. This is K11 in STATE.md, and it is why this file
// greps bytes.
//
// Exit codes: 0 no leak; 1 a leak; 2 nothing to check (no build output).
//
// ---------------------------------------------------------------------------
// THE MATCHING RULES, WHICH ADR-0005 REQUIRES THIS PHASE TO DEFINE
// ---------------------------------------------------------------------------
//
// ADR-0005's Risks section says plainly that the check is "necessary, not
// sufficient", and asks for the exact matching rules and the derived outputs
// they cover to be written down when the check is built. They are:
//
// NEEDLES -- what counts as a trace of a private item:
//
//   qualified-id   "<source>/<slug>"                       e.g. phd-milestones/milestones
//   route          "/<section>/<source>/<slug>/"           the URL the hub would serve it at
//   payload-path   the item's declared `path`, QUALIFIED by source, e.g.
//                  phd-milestones/site/index.html           (a bare `index.html`
//                  is not a needle: every static site has one — see needlesFor)
//   slug           the bare slug                            e.g. milestones
//   title          the item's title, raw and HTML-escaped
//   summary        the item's summary, raw and HTML-escaped
//
// A SOURCE NAME IS NOT A BARE NEEDLE (Wave 4 FP-2). The Wave 4 satellite
// publishes under source key `construction-ai`, which is also the id of the
// owner's own public CV project, rendered first-party at /projects/construction-ai/.
// A bare `source` needle matched that legitimate page in both PATH and CONTENTS
// and failed a CLEAN build. This is the same over-broad-needle class as Wave 2's
// FP-1 (a bare `index.html` payload-path needle). A source name is carried by
// its qualified-id, route, payload-path and title/summary needles, all of which
// are distinctive; on its own it is only as safe as the most generic public word
// it could equal.
//
// BOUNDED vs EXACT. A bare slug is matched only when it is DELIMITER-BOUNDED on
// BOTH sides -- that is, it sits in markup, in a URL, or in a quoted string
// rather than in prose. This is not fastidiousness, it is the difference between
// a guard that works and a guard that gets deleted:
//
//   *** The public research page /research/soa-agentic-se/agentic-memory/sources/
//   *** already contains the sentence "...tech-tree milestones up to 15.3x faster
//   *** than prior SOTA". The private slug is `milestones`. A naive substring
//   *** search fails a CLEAN build on that sentence.
//
// A guard that cries wolf on a correct build is switched off within a week, and
// then it is not protecting anything. So prose occurrences are not matches, and
// `check-no-private-in-public.test.ts` pins that exact sentence as a regression
// test. Every real leak shape IS bounded: href="/phd/phd-milestones/milestones/",
// <li>milestones</li>, "slug":"milestones", <loc>...</loc>, milestones.html.
//
// Titles and summaries are matched EXACTLY and unbounded, because they are long
// and distinctive; a title shorter than TITLE_MIN_LENGTH is skipped as a needle
// and reported as a warning rather than silently trusted.
//
// DERIVED OUTPUTS COVERED (Wave 5, SEAM-P6). Every file under dist-public is
// walked, so the derived outputs are covered by construction. Wave 5 names them
// explicitly, because "walked" is not "understood", and a reader deserves to
// know which files a future build could add without anyone noticing:
//
//   - the sitemap (sitemap.xml / sitemap-index.xml / sitemap-N.xml)
//   - the RSS feed (rss.xml) and any other XML
//   - the Pagefind index TEXT files: pagefind-entry.json and the JSON/JS/CSS
//     bundles under pagefind/
//   - the OG card (og-card.png bytes, og-card.svg text)
//   - the redirect stubs (dist-redirects/**), scanned separately below
//
// THE SEARCH INDEX GETS A STRUCTURAL CHECK AS WELL (SEAM-P6). Pagefind's
// `.pf_index` / `.pf_fragment` / `.pf_meta` files are gzip binaries, so the
// contents scan cannot read them (see LIMITS). `checkSearchIndexScope` instead
// decompresses every fragment and asserts each indexed URL is public-rooted,
// is not under the private base `/p/`, and resolves to a file that exists in
// dist-public. That is how "the index was built from dist-public only" is
// checked rather than assumed.
//
// THE REDIRECT STUBS ARE SCANNED FOR TITLES AND SUMMARIES ONLY. A stub must
// forward the LEGACY PATH (ADR-0020), and the committed map already names the
// private fellowship paths — repeating a path that was public on the old site is
// accepted, and the path slug is not a leak of the item's content. What must
// never appear is the item's TITLE or SUMMARY, and `findRedirectStubLeaks`
// asserts exactly that.
//
// LIMITS, STATED SO NO ONE MISTAKES THIS FOR A PROOF (ADR-0005 Risks):
//   - Binary files are matched by PATH ONLY. A private title baked into an OG
//     image's pixels, a renamed PDF's interior, or the gzip `.pf_*` Pagefind
//     fragments would pass a contents scan. The OG card and the fragments are
//     named here so the limit is explicit; the structural URL check above is the
//     search index's second half, and it is not a contents scan.
//   - Private text quoted into a public page WITHOUT its slug, title or summary
//     would pass. Nothing mechanical can catch that.
//   - A slug occurring in prose is deliberately not a match (above).
//   - A private source name that equals public first-party content is not a
//     needle by itself (Wave 4 FP-2, above). A leak that preserves only the
//     source name and none of the qualified-id/route/payload-path/title/summary
//     needles would pass; those needles are what bind the item.
//   - A redirect stub's legacy path (which names the private slug) is not
//     flagged; only its title/summary is. ADR-0020 accepts the path.
// The bucket IAM test (§12.1, infra D8) is the other half of the guarantee, and
// neither half is sufficient alone.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { SOURCES_DIR, effectiveVisibility, readPublishAllowlist } from "../src/lib/hub-content.mjs";
import { CANONICAL_ORIGIN } from "../src/lib/canonical-url.mjs";
import { OUTPUT_DIRS } from "./site-output.mjs";

const SITE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Titles/summaries shorter than this are too generic to be safe needles. */
export const TITLE_MIN_LENGTH = 8;

/** Extensions read as text. Anything else is matched by path only. */
export const TEXT_EXTENSIONS = new Set([
  ".html", ".htm", ".xml", ".xhtml", ".txt", ".json", ".jsonld", ".webmanifest",
  ".js", ".mjs", ".cjs", ".css", ".map", ".svg", ".rss", ".atom", ".csv", ".md",
]);

/**
 * Extensions that are ALWAYS binary, whatever the NUL sniff would say (SEAM-P6).
 *
 * Pagefind's `.pf_index`, `.pf_fragment` and `.pf_meta` files are gzip streams.
 * A small one might carry no NUL byte in its first 4 KiB and be misread as
 * UTF-8, so the sniff alone is not a declaration. Naming them here pins the
 * documented binary limit and keeps the contents scan from reading compressed
 * noise as text.
 */
export const BINARY_EXTENSIONS = new Set([".pf_index", ".pf_fragment", ".pf_meta"]);

// A needle counts as present only when both neighbours are delimiters -- markup,
// URL or quoting punctuation. A space or a letter on either side means prose.
const LEFT_DELIMITERS = new Set(['/', '"', "'", '=', '>', '(', '[', '{', ',', ':', ';', '|', '\\', '`']);
const RIGHT_DELIMITERS = new Set(['/', '"', "'", '<', ')', ']', '}', ',', ':', ';', '|', '.', '?', '#', '&', '`']);

/** Minimal HTML escaping, matching what a renderer emits into a text node. */
export function htmlEscape(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Every EFFECTIVELY private item across every synced manifest (D8; SEAM-B6).
 *
 * An item is private unless BOTH its manifest says `visibility: public` AND the
 * committed publish allowlist names its (source, slug). This is the widened,
 * correct private set: it catches `cv/anthropic-fellow`, whose manifest says
 * public but which the allowlist deliberately omits -- the one content-only leak
 * with no matching path that the old manifest-only filter could not see.
 *
 * Deliberately does NOT use src/content.config.ts's validating loader: this
 * check must still run, and still find private items, when a manifest is
 * malformed enough to fail the build. Its job is to answer "is anything private
 * in the public output", and a broken manifest is not a reason to skip that.
 *
 * @param {string} sourcesDir
 * @param {ReturnType<typeof readPublishAllowlist>} [allowlist]
 * @returns {{source: string, slug: string, title?: string, summary?: string, path?: string, section?: string}[]}
 */
export function collectPrivateItems(sourcesDir, allowlist = readPublishAllowlist()) {
  if (!fs.existsSync(sourcesDir)) return [];
  const items = [];
  for (const source of fs.readdirSync(sourcesDir).sort()) {
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
      if (effectiveVisibility(item, name, allowlist) !== "private") continue;
      items.push({
        source: typeof manifest.source === "string" ? manifest.source : source,
        slug: String(item.slug ?? ""),
        title: typeof item.title === "string" ? item.title : undefined,
        summary: typeof item.summary === "string" ? item.summary : undefined,
        path: typeof item.path === "string" ? item.path : undefined,
        section: typeof item.section === "string" ? item.section : undefined,
      });
    }
  }
  return items;
}

/**
 * The needles for one private item.
 *
 * @returns {{kind: string, value: string, bounded: boolean}[]}
 */
export function needlesFor(item) {
  const needles = [];
  const add = (kind, value, bounded) => {
    if (typeof value === "string" && value.length > 0) needles.push({ kind, value, bounded });
  };

  if (item.slug) {
    add("qualified-id", `${item.source}/${item.slug}`, false);
    add("slug", item.slug, true);
    if (item.section) add("route", `/${item.section}/${item.source}/${item.slug}/`, false);
  }
  // NO `source` NEEDLE. A source name can equal public first-party content (the
  // Wave 4 key `construction-ai` is also a public CV project id), so it is not a
  // safe needle on its own; the qualified-id, route, payload-path and
  // title/summary needles carry it. See the header, Wave 4 FP-2.
  //
  // The payload path is a needle only when QUALIFIED by its source. A bare
  // filename such as `index.html` is not a trace of any particular private item —
  // every static site has one — and matching it made a CLEAN public build fail:
  // the KGIS payload's own navigation links to `index.html` were reported as a
  // leak of agentic-kg-research's item on the first multi-source run (CI,
  // 2026-10-01). The qualified form `source/path` names the file's home, which is
  // what a leak of the payload would preserve. Content (title/summary/route)
  // remains the primary guard.
  if (item.path) add("payload-path", `${item.source}/${item.path}`, false);

  for (const [kind, value] of [["title", item.title], ["summary", item.summary]]) {
    if (typeof value !== "string" || value.length < TITLE_MIN_LENGTH) continue;
    add(kind, value, false);
    const escaped = htmlEscape(value);
    if (escaped !== value) add(`${kind}-escaped`, escaped, false);
  }

  return needles;
}

/** Item fields too short to be safe needles, as human-readable warnings. */
export function weakNeedleWarnings(items) {
  const warnings = [];
  for (const item of items) {
    for (const [field, value] of [["title", item.title], ["summary", item.summary]]) {
      if (typeof value === "string" && value.length > 0 && value.length < TITLE_MIN_LENGTH) {
        warnings.push(
          `${item.source}/${item.slug}: ${field} ${JSON.stringify(value)} is shorter than ` +
            `${TITLE_MIN_LENGTH} characters, so it is NOT used as a needle -- it would match ` +
            `ordinary prose. That field is not covered by this check.`,
        );
      }
    }
  }
  return warnings;
}

/** True when `value` occurs in `haystack` delimiter-bounded on both sides. */
export function containsBounded(haystack, value) {
  let at = haystack.indexOf(value);
  while (at !== -1) {
    const before = at === 0 ? "" : haystack[at - 1];
    const afterAt = at + value.length;
    const after = afterAt >= haystack.length ? "" : haystack[afterAt];
    const leftOk = before === "" || LEFT_DELIMITERS.has(before);
    const rightOk = after === "" || RIGHT_DELIMITERS.has(after);
    if (leftOk && rightOk) return true;
    at = haystack.indexOf(value, at + 1);
  }
  return false;
}

function occurs(haystack, needle) {
  return needle.bounded ? containsBounded(haystack, needle.value) : haystack.includes(needle.value);
}

function walkFiles(dir, rel = "") {
  const out = [];
  let entries;
  try {
    entries = fs.readdirSync(path.join(dir, rel), { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const child = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...walkFiles(dir, child));
    else out.push(child);
  }
  return out;
}

function isTextFile(relFile, absFile) {
  const ext = path.extname(relFile).toLowerCase();
  if (BINARY_EXTENSIONS.has(ext)) return false;
  if (TEXT_EXTENSIONS.has(ext)) return true;
  // Extensionless or unknown: sniff for a NUL byte in the first 4 KiB.
  try {
    const fd = fs.openSync(absFile, "r");
    try {
      const buf = Buffer.alloc(4096);
      const read = fs.readSync(fd, buf, 0, 4096, 0);
      return !buf.subarray(0, read).includes(0);
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return false;
  }
}

function snippet(haystack, value) {
  const at = haystack.indexOf(value);
  if (at === -1) return "";
  const from = Math.max(0, at - 40);
  const to = Math.min(haystack.length, at + value.length + 40);
  return haystack.slice(from, to).replace(/\s+/g, " ").trim();
}

/**
 * Every leak of a private item into the built output.
 *
 * @param {string} distDir
 * @param {ReturnType<typeof collectPrivateItems>} items
 * @returns {{file: string, where: "path"|"contents", item: string, kind: string, needle: string, context: string}[]}
 */
export function findLeaks(distDir, items) {
  const leaks = [];
  if (items.length === 0) return leaks;

  const byItem = items.map((item) => ({ item, needles: needlesFor(item) }));
  const files = walkFiles(distDir);

  for (const relFile of files) {
    const absFile = path.join(distDir, relFile);

    // 1. PATHS. A private SLUG appearing as a path segment. A source name is
    // deliberately NOT a path needle: it can equal public first-party content
    // (Wave 4 FP-2). The qualified-id, route and payload-path needles still bind
    // the item in CONTENTS.
    const segments = relFile.split("/");
    for (const { item, needles } of byItem) {
      for (const needle of needles) {
        if (needle.kind !== "slug") continue;
        const hit = segments.some((s) => s === needle.value || s.startsWith(`${needle.value}.`));
        if (hit) {
          leaks.push({
            file: relFile,
            where: "path",
            item: `${item.source}/${item.slug}`,
            kind: needle.kind,
            needle: needle.value,
            context: relFile,
          });
        }
      }
    }

    // 2. CONTENTS. The half the brief's path-only form would have missed.
    if (!isTextFile(relFile, absFile)) continue;
    let text;
    try {
      text = fs.readFileSync(absFile, "utf8");
    } catch {
      continue;
    }
    for (const { item, needles } of byItem) {
      for (const needle of needles) {
        if (!occurs(text, needle)) continue;
        leaks.push({
          file: relFile,
          where: "contents",
          item: `${item.source}/${item.slug}`,
          kind: needle.kind,
          needle: needle.value,
          context: snippet(text, needle.value),
        });
      }
    }
  }
  return leaks;
}

// ---------------------------------------------------------------------------
// THE DERIVED OUTPUTS, NAMED (Wave 5, SEAM-P6)
// ---------------------------------------------------------------------------

/**
 * Every derived output a public build can emit, by kind, for the ones present.
 *
 * This does not add coverage — `findLeaks` already walks every file — it makes
 * the coverage legible. A missing kind (e.g. no RSS in a stripped build) is
 * simply absent, not a fault.
 *
 * @param {string} distDir
 * @returns {{kind: string, file: string}[]}
 */
export function listDerivedOutputs(distDir) {
  const out = [];
  const add = (kind, rel) => {
    if (fs.existsSync(path.join(distDir, rel))) out.push({ kind, file: rel });
  };
  for (const rel of walkFiles(distDir)) {
    if (/^sitemap[^/]*\.xml$/i.test(rel)) out.push({ kind: "sitemap", file: rel });
    if (rel === "rss.xml" || rel === "feed.xml") out.push({ kind: "rss", file: rel });
    if (rel === "og-card.png" || rel === "og-card.svg") out.push({ kind: "og-card", file: rel });
    if (rel.startsWith("pagefind/") && /\.(json|js|mjs|cjs|css)$/i.test(rel)) {
      out.push({ kind: "search-text", file: rel });
    }
  }
  // `walkFiles` returns sorted order for directories but not guaranteed overall;
  // sort so the report is stable across filesystems.
  return out.sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0));
}

/** The `.pf_fragment` files of a Pagefind index, or [] when there is none. */
export function searchIndexFragments(distDir) {
  const dir = path.join(distDir, "pagefind", "fragment");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".pf_fragment"))
    .map((name) => path.join(dir, name));
}

/** The URLs recorded in one gzip Pagefind fragment. */
export function fragmentUrls(file) {
  const raw = zlib.gunzipSync(fs.readFileSync(file)).toString("utf8");
  const json = JSON.parse(raw.replace(/^pagefind_dcd/, ""));
  return typeof json?.url === "string" ? [json.url] : [];
}

/**
 * The STRUCTURAL half of "the search index was built from dist-public only"
 * (SEAM-P6).
 *
 * A `.pf_*` fragment is gzip, so a private title inside it is invisible to the
 * byte grep (the documented binary limit). This decompresses each fragment and
 * asserts what the index CANNOT safely contain even then:
 *
 *   - no URL under the private base `/p/`;
 *   - no off-origin URL (Pagefind emits root-relative URLs);
 *   - every URL resolves to a file that exists in THIS dist-public.
 *
 * The last clause is the one that binds the index to this output: an index built
 * by mistake from dist-private would name `/p/**` (caught) or paths absent from
 * dist-public (caught).
 *
 * @param {string} distDir
 * @returns {string[]} problems, empty when the index is absent or public-only
 */
export function checkSearchIndexScope(distDir) {
  const problems = [];
  const entry = path.join(distDir, "pagefind", "pagefind-entry.json");
  if (!fs.existsSync(entry)) return problems; // no index in this build; not applicable

  const fragments = searchIndexFragments(distDir);
  if (fragments.length === 0) {
    problems.push(
      `pagefind/pagefind-entry.json exists but there are no .pf_fragment files under ` +
        `pagefind/fragment/, so the index is incomplete and this check proves nothing.`,
    );
    return problems;
  }

  for (const file of fragments) {
    const rel = path.relative(distDir, file).split(path.sep).join("/");
    let urls;
    try {
      urls = fragmentUrls(file);
    } catch (error) {
      problems.push(`${rel} could not be read as a Pagefind fragment: ${error.message}`);
      continue;
    }
    for (const url of urls) {
      if (/^https?:\/\//i.test(url)) {
        const parsed = new URL(url);
        if (`${parsed.protocol}//${parsed.host}` !== CANONICAL_ORIGIN) {
          problems.push(`${rel} indexes the off-origin URL ${url}`);
          continue;
        }
      }
      if (url === "/p/" || url.startsWith("/p/")) {
        problems.push(
          `${rel} indexes ${url}, which is under the private gate base /p/ — the index was ` +
            `built from the private output, not dist-public (SEAM-P1).`,
        );
        continue;
      }
      const clean = url.split("#")[0].split("?")[0];
      const relTarget = clean.replace(/^\/+/, "");
      if (relTarget === "") continue; // the root page
      const target = /^https?:\/\//i.test(clean) ? new URL(clean).pathname.replace(/^\/+/, "") : relTarget;
      const absTarget = path.join(distDir, target);
      const exists =
        fs.existsSync(absTarget) &&
        (fs.statSync(absTarget).isDirectory()
          ? fs.existsSync(path.join(absTarget, "index.html"))
          : true);
      if (!exists) {
        problems.push(
          `${rel} indexes ${url}, which resolves to no file under dist-public — the index names ` +
            `a page this build did not emit.`,
        );
      }
    }
  }
  return problems;
}

/**
 * Every redirect stub that names a private item's TITLE or SUMMARY (SEAM-P6).
 *
 * DELIBERATELY NOT A FULL NEEDLE SCAN. A stub forwards the legacy path, and the
 * committed map already names the private fellowship paths (ADR-0020 decision 5
 * and its Risks). A path slug is therefore expected in the ARTIFACT that
 * reproduces the old URLs; the guard's job is the one thing that must never
 * appear there: the item's title or summary.
 *
 * @param {string} stubsDir
 * @param {ReturnType<typeof collectPrivateItems>} items
 * @returns {{file: string, kind: string, needle: string, item: string, context: string}[]}
 */
export function findRedirectStubLeaks(stubsDir, items) {
  const leaks = [];
  if (!fs.existsSync(stubsDir) || items.length === 0) return leaks;
  const contentNeedles = items.map((item) => ({
    item,
    needles: needlesFor(item).filter((n) => n.kind.startsWith("title") || n.kind.startsWith("summary")),
  }));

  for (const relFile of walkFiles(stubsDir)) {
    const absFile = path.join(stubsDir, relFile);
    if (!isTextFile(relFile, absFile)) continue;
    let text;
    try {
      text = fs.readFileSync(absFile, "utf8");
    } catch {
      continue;
    }
    for (const { item, needles } of contentNeedles) {
      for (const needle of needles) {
        if (!occurs(text, needle)) continue;
        leaks.push({
          file: relFile,
          kind: needle.kind,
          needle: needle.value,
          item: `${item.source}/${item.slug}`,
          context: snippet(text, needle.value),
        });
      }
    }
  }
  return leaks;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { dist: null, sources: null, stubs: null, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--json") args.json = true;
    else if (argv[i] === "--dist") args.dist = argv[++i];
    else if (argv[i] === "--sources") args.sources = argv[++i];
    else if (argv[i] === "--stubs") args.stubs = argv[++i];
    else throw new Error(`unknown argument: ${argv[i]}`);
  }
  return args;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`check:no-private-in-public: ${error.message}`);
    process.exit(2);
  }

  const distDir = args.dist ? path.resolve(args.dist) : path.join(SITE_ROOT, OUTPUT_DIRS.public);
  const sourcesDir = args.sources ? path.resolve(args.sources) : path.join(SITE_ROOT, SOURCES_DIR);
  let stubsDir = args.stubs ? path.resolve(args.stubs) : null;
  if (stubsDir && !fs.existsSync(stubsDir)) {
    console.warn(
      `check:no-private-in-public: --stubs ${stubsDir} does not exist, so no redirect stubs were ` +
        `scanned; run npm run redirects:stubs first to cover them.`,
    );
    stubsDir = null;
  }
  const shownDist = path.relative(process.cwd(), distDir) || ".";
  const shownStubs = stubsDir ? path.relative(process.cwd(), stubsDir) || "." : null;

  if (!fs.existsSync(distDir) || !fs.statSync(distDir).isDirectory()) {
    console.error(
      `check:no-private-in-public: no build output at ${shownDist}; run the public build first`,
    );
    process.exit(2);
  }

  const items = collectPrivateItems(sourcesDir);
  const leaks = findLeaks(distDir, items);
  const warnings = weakNeedleWarnings(items);
  const derived = listDerivedOutputs(distDir);
  const scopeProblems = checkSearchIndexScope(distDir);
  const stubLeaks = stubsDir ? findRedirectStubLeaks(stubsDir, items) : [];

  if (args.json) {
    console.log(
      JSON.stringify(
        { dist: distDir, stubs: stubsDir, privateItems: items, leaks, stubLeaks, scopeProblems, derived, warnings },
        null,
        2,
      ),
    );
  }

  for (const w of warnings) console.warn(`check:no-private-in-public: WARNING ${w}`);

  // The derived outputs the run is aware of (SEAM-P6), named rather than implied.
  if (derived.length > 0) {
    const byKind = new Map();
    for (const { kind, file } of derived) {
      if (!byKind.has(kind)) byKind.set(kind, []);
      byKind.get(kind).push(file);
    }
    console.log(
      `check:no-private-in-public: derived outputs scanned in ${shownDist}: ` +
        `${[...byKind].map(([kind, files]) => `${kind} (${files.length})`).join(", ")}`,
    );
  }
  if (shownStubs) {
    console.log(
      `check:no-private-in-public: redirect stubs scanned in ${shownStubs} ` +
        `(title/summary needles only; paths are ADR-0020 legacy URLs)`,
    );
  }

  // REPORT ALL PROBLEM CLASSES, THEN EXIT. An early exit on the first class
  // hides the rest, and the demo plants into every derived output precisely so a
  // single run proves the whole guard. The structural search-index assertion
  // (SEAM-P6) is reported alongside the byte leaks.
  const leakCount = leaks.length + stubLeaks.length;

  if (leakCount > 0) {
    console.error(
      `\ncheck:no-private-in-public: ${leakCount} LEAK(S) of private content into the public ` +
        `outputs:\n`,
    );
    for (const leak of leaks) {
      console.error(`  ${leak.file}`);
      console.error(`    ${leak.where}: ${leak.kind} of ${leak.item} — ${JSON.stringify(leak.needle)}`);
      if (leak.where === "contents") console.error(`    …${leak.context}…`);
      if (process.env.GITHUB_ACTIONS === "true") {
        console.log(
          `::error file=${leak.file}::private ${leak.kind} ${JSON.stringify(leak.needle)} ` +
            `(${leak.item}) appears in the ${leak.where} of ${leak.file} under the PUBLIC output`,
        );
      }
    }
    for (const leak of stubLeaks) {
      console.error(`  ${shownStubs}/${leak.file}  (redirect stub)`);
      console.error(`    contents: ${leak.kind} of ${leak.item} — ${JSON.stringify(leak.needle)}`);
      console.error(`    …${leak.context}…`);
      if (process.env.GITHUB_ACTIONS === "true") {
        console.log(
          `::error file=${leak.file}::private ${leak.kind} ${JSON.stringify(leak.needle)} ` +
            `(${leak.item}) appears in the redirect stub ${leak.file}`,
        );
      }
    }
    console.error(
      `\nThe public output must not contain, name or link any private item (ADR-0005, design doc ` +
        `§12.1). Nothing has been deployed.\n`,
    );
  }

  if (scopeProblems.length > 0) {
    console.error(
      `\ncheck:no-private-in-public: ${scopeProblems.length} SEARCH-INDEX PROBLEM(S):\n`,
    );
    for (const problem of scopeProblems) console.error(`  ${problem}`);
    console.error(
      `\nThe Pagefind index must contain public, existing pages only, and be built from ` +
        `dist-public (SEAM-P1). Nothing has been deployed.\n`,
    );
  }

  if (leakCount > 0 || scopeProblems.length > 0) process.exit(1);

  // An empty private set is a real and expected state today -- phd-milestones
  // cannot publish until Checkpoint 4 -- but it means this run proved nothing.
  // Say so loudly rather than printing a reassuring "passed".
  if (items.length === 0) {
    console.log(
      `check:no-private-in-public: NO PRIVATE ITEMS are published, so there was nothing to look ` +
        `for and this run proves nothing about ${shownDist}. This is expected until ` +
        `phd-milestones first publishes (Checkpoint 4). Run npm run demo:leak-check to see the ` +
        `check actually fail.`,
    );
    process.exit(0);
  }

  console.log(
    `check:no-private-in-public: ${items.length} private item(s) to look for in ${shownDist}:`,
  );
  for (const item of items) {
    const kinds = needlesFor(item).map((n) => n.kind).join(", ");
    console.log(`  ${item.source}/${item.slug} — needles: ${kinds}`);
  }

  console.log(
    `\ncheck:no-private-in-public: PASS — no private slug, route, payload path, title or summary ` +
      `appears in any path or any file's contents under ${shownDist}` +
      `${shownStubs ? ` and no private title or summary appears in any stub under ${shownStubs}` : ""}` +
      ` (${walkFiles(distDir).length} file(s) scanned in ${shownDist}` +
      `${shownStubs ? `, ${walkFiles(stubsDir).length} in ${shownStubs}` : ""}).`,
  );
}
