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
//   payload-path   the item's declared `path`               e.g. site/index.html (see note)
//   source         the source name                          e.g. phd-milestones
//   slug           the bare slug                            e.g. milestones
//   title          the item's title, raw and HTML-escaped
//   summary        the item's summary, raw and HTML-escaped
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
// DERIVED OUTPUTS COVERED. Every file under dist-public is walked, so this
// covers the sitemap, robots.txt, the Astro redirect pages, the JSON payloads
// the source explorers inline, every rendered page, and any future RSS or search
// index -- provided they are text. See LIMITS below for what it does NOT cover.
//
// LIMITS, STATED SO NOBODY MISTAKES THIS FOR A PROOF (ADR-0005 Risks):
//   - Binary files are matched by PATH ONLY. A private title baked into an OG
//     image, a renamed PDF's interior, or a compressed payload would pass.
//   - Private text quoted into a public page WITHOUT its slug, title or summary
//     would pass. Nothing mechanical can catch that.
//   - A slug occurring in prose is deliberately not a match (above).
// The bucket IAM test (§12.1, infra D8) is the other half of the guarantee, and
// neither half is sufficient alone.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SOURCES_DIR } from "../src/lib/hub-content.mjs";
import { OUTPUT_DIRS } from "./site-output.mjs";

const SITE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Titles/summaries shorter than this are too generic to be safe needles. */
export const TITLE_MIN_LENGTH = 8;

/** Extensions read as text. Anything else is matched by path only. */
export const TEXT_EXTENSIONS = new Set([
  ".html", ".htm", ".xml", ".xhtml", ".txt", ".json", ".jsonld", ".webmanifest",
  ".js", ".mjs", ".cjs", ".css", ".map", ".svg", ".rss", ".atom", ".csv", ".md",
]);

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
 * Every `visibility: private` item across every synced manifest.
 *
 * Deliberately does NOT use src/content.config.ts's validating loader: this
 * check must still run, and still find private items, when a manifest is
 * malformed enough to fail the build. Its job is to answer "is anything private
 * in the public output", and a broken manifest is not a reason to skip that.
 *
 * @param {string} sourcesDir
 * @returns {{source: string, slug: string, title?: string, summary?: string, path?: string, section?: string}[]}
 */
export function collectPrivateItems(sourcesDir) {
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
    for (const item of manifest?.items ?? []) {
      if (item?.visibility !== "private") continue;
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
  add("source", item.source, true);
  if (item.path) add("payload-path", item.path, false);

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
  if (TEXT_EXTENSIONS.has(path.extname(relFile).toLowerCase())) return true;
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

    // 1. PATHS. A private slug or source appearing as a path segment.
    const segments = relFile.split("/");
    for (const { item, needles } of byItem) {
      for (const needle of needles) {
        if (needle.kind !== "slug" && needle.kind !== "source") continue;
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
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { dist: null, sources: null, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--json") args.json = true;
    else if (argv[i] === "--dist") args.dist = argv[++i];
    else if (argv[i] === "--sources") args.sources = argv[++i];
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
  const shownDist = path.relative(process.cwd(), distDir) || ".";

  if (!fs.existsSync(distDir) || !fs.statSync(distDir).isDirectory()) {
    console.error(
      `check:no-private-in-public: no build output at ${shownDist}; run the public build first`,
    );
    process.exit(2);
  }

  const items = collectPrivateItems(sourcesDir);
  const leaks = findLeaks(distDir, items);
  const warnings = weakNeedleWarnings(items);

  if (args.json) {
    console.log(JSON.stringify({ dist: distDir, privateItems: items, leaks, warnings }, null, 2));
  }

  for (const w of warnings) console.warn(`check:no-private-in-public: WARNING ${w}`);

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

  if (leaks.length > 0) {
    console.error(
      `\ncheck:no-private-in-public: ${leaks.length} LEAK(S) of private content into ${shownDist}:\n`,
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
    console.error(
      `\nThe public output must not contain, name or link any private item (ADR-0005, design doc ` +
        `§12.1). Nothing has been deployed.\n`,
    );
    process.exit(1);
  }

  console.log(
    `\ncheck:no-private-in-public: PASS — no private slug, source, route, payload path, title or ` +
      `summary appears in any path or any file's contents under ${shownDist} ` +
      `(${walkFiles(distDir).length} files scanned).`,
  );
}
