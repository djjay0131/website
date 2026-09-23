#!/usr/bin/env node
// Fails the private build when any link in dist-private resolves OUTSIDE the base
// the gate serves from -- including a link that leaves the ORIGIN entirely.
//
//   node scripts/check-private-links.mjs [--dist DIR] [--base BASE]
//   npm run check:private-links
//
// Exit codes: 0 every link resolves under the base; 1 at least one does not;
// 2 there is no private build to inspect.
//
// WHY THIS EXISTS (issue #27). The gate serves the private area under /p/**,
// stripping /p/ to form the object name. Astro's `base` rewrites the URLs it
// generates, but routeFor()/payloadUrlFor() build raw strings it never sees. The
// first private build emitted /phd/<source>/<slug>/ and /_payload/... with no
// prefix, so a signed-in member got an unstyled page on which every asset and
// every link 404'd -- while the build, the sync and the gate were each correct in
// isolation. Nothing in the repository caught it, and the test suite asserted the
// broken values, so the suite defended the defect.
//
// ---------------------------------------------------------------------------
// WHAT F-1 FOUND, AND WHY THE REGEX CHANGED
// ---------------------------------------------------------------------------
// The original pattern was /(?:href|src)="(\/[^"]*)"/g -- it matched ONLY links
// beginning with "/". The Skeptic Verifier tested three shapes one at a time
// against a real private build of five pages:
//
//   <img src="//evil.invalid/y.png">    -> RED   (starts with "/", caught)
//   <a href="https://evil.invalid/x">   -> GREEN (INVISIBLE)
//   <a href="../../elsewhere/">         -> GREEN (INVISIBLE)
//
// This file's own error text says "a link outside /p/ reaches the PUBLIC origin".
// An absolute off-origin URL is the STRONGEST form of that, and it passed. The
// guard did catch its real subject -- #27's uniformly unprefixed root-absolute
// links -- so this was a coverage gap rather than a vacuous guard. But the timing
// decided it: the private pages are authored in ANOTHER repository, and the
// satellite stream spent this same wave removing an off-origin font <link> from
// exactly these pages. The guard that would have caught that regressing did not
// look at that shape. The satellite now enforces it itself; the hub's guard is no
// longer the weaker of the two.
//
// ---------------------------------------------------------------------------
// WHY A RELATIVE LINK IS NOT SIMPLY BANNED
// ---------------------------------------------------------------------------
// The staged pages under _payload/** are a satellite's own bytes, served
// verbatim, and they legitimately carry href="assets/style.css". Rejecting every
// relative link would fail the REAL build on a correct page -- and a guard that
// cries wolf on a correct build is switched off within a week, after which it
// protects nothing. So every link is RESOLVED against the page that carries it
// and judged on where it lands:
//
//   off-origin    another scheme://host  -- never acceptable here
//   outside-base  resolves outside the base (#27's shape, and ../../ escapes)
//   inert         #fragment, mailto:, tel:, data: -- fetches nothing off-origin
//   ok            lands under the base; must then point at a file that EXISTS
//
// The existence check is the half that matters most: uniformly prefixed but
// wrong is just as broken as unprefixed.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DIST = path.resolve(HERE, "..", "dist-private");

/**
 * Every link, not only the root-absolute ones. This widening IS the F-1 fix.
 */
export const LINK = /(?:href|src)="([^"]*)"/g;

/**
 * One HTML tag and its attribute text, so a link can be judged by WHAT CARRIES IT.
 * `[^>]` matches newlines, so attributes spread over several lines still match.
 */
export const TAG = /<([a-zA-Z][a-zA-Z0-9-]*)\b([^>]*)>/g;

/**
 * Tags whose off-origin link is NAVIGATION, not a fetch.
 *
 * THE DISTINCTION THIS GUARD WAS MISSING, found when it turned `main` red on
 * 2026-09-23. It failed the build on these, in a private milestone tracker:
 *
 *   <link href="https://fonts.googleapis.com/css2?...">   a real leak
 *   <a href="https://graduateschool.vt.edu/...">          an ordinary citation
 *
 * Those are not the same fault. A stylesheet, script, image or frame is fetched
 * by the browser WITHOUT the member doing anything, so an off-origin one tells a
 * third party that a member opened a private page. That stays a build failure.
 *
 * An anchor is followed only if the member clicks it. A private document whose
 * PURPOSE is citing university policy cannot be written at all if every outbound
 * citation fails the build. Banning them does not protect the member; it just
 * makes the private area unable to hold a normal document.
 *
 * This NARROWS the guard's scope, it does not weaken its strength: every
 * sub-resource shape it caught before, it still catches. The tests assert that
 * directly, and classifyLink with no tag is treated as a sub-resource, so the
 * strict answer is the default and the exemption has to be asked for.
 *
 * The residual risk on an anchor is the Referer header revealing the private URL
 * when a member clicks through. That is answered by a referrer policy on the
 * private layout, not by forbidding outbound links; tracked separately.
 */
export const NAVIGATIONAL_TAGS = new Set(["a", "area"]);

/**
 * Schemes that fetch nothing from another origin, so they are not this guard's
 * business. `javascript:` is included because it is inert as a *network* matter;
 * it is a content-security question and belongs to a different check.
 */
const INERT_SCHEME = /^(?:data|mailto|tel|sms|blob|about|javascript):/i;

/**
 * A stand-in for the origin the gate serves this output from.
 *
 * Resolution only needs SOME origin to resolve against -- what matters is
 * whether a link stays on it. `.invalid` is reserved by RFC 2606 and can never
 * be a real host, so nothing here can accidentally agree with a real domain.
 */
const SELF = "https://private.invalid";

/** The base, however it was spelled, as a leading-and-trailing-slashed prefix. */
export function normalizeBase(raw) {
  const trimmed = String(raw ?? "").trim();
  if (trimmed === "") return "/p/";
  return `${trimmed.replace(/\/+$/, "")}/`;
}

/**
 * The URL path a page is served at, from its output-relative file path.
 *
 * Relative links resolve against the page's DIRECTORY, so "/p/a/b/index.html"
 * and "/p/a/b/" give the same answer -- which is why keeping the index.html on
 * the end is harmless and saves guessing how the gate spells the directory.
 *
 * @param {string} relFile output-relative path, in OS or posix separators
 * @param {string} base
 */
export function pageUrlFor(relFile, base) {
  return `${normalizeBase(base)}${String(relFile).split(path.sep).join("/").replace(/^\/+/, "")}`;
}

/**
 * Judge one link as seen from the page that carries it.
 *
 * @param {string} link the raw attribute value
 * @param {string} pageUrl the carrying page's URL path (see pageUrlFor)
 * @param {string} base
 * @param {string} [tag] the tag carrying the link. Omitted means "treat as a
 *   sub-resource", which is the STRICT reading -- the exemption must be asked for.
 * @returns {{kind: "ok"|"inert"|"off-origin"|"outbound"|"outside-base"|"unparseable", path?: string, why?: string}}
 */
export function classifyLink(link, pageUrl, base, tag) {
  const normalizedBase = normalizeBase(base);
  const raw = String(link).trim();

  if (raw === "") return { kind: "inert", why: "empty" };
  if (raw.startsWith("#")) return { kind: "inert", why: "same-page fragment" };
  if (INERT_SCHEME.test(raw)) return { kind: "inert", why: "fetches nothing off-origin" };

  let resolved;
  try {
    resolved = new URL(raw, `${SELF}${pageUrl}`);
  } catch {
    return { kind: "unparseable", why: `is not a usable URL: ${JSON.stringify(raw)}` };
  }

  if (resolved.origin !== SELF) {
    // The F-1 shape. Covers https://, http:// and protocol-relative //host.
    if (tag && NAVIGATIONAL_TAGS.has(String(tag).toLowerCase())) {
      // A link the member must CLICK. Not a fetch, so not this guard's fault to
      // report -- see NAVIGATIONAL_TAGS for why banning these protects nobody.
      return {
        kind: "outbound",
        why: `navigates to ${resolved.protocol}//${resolved.host} only if the member clicks it`,
      };
    }
    return {
      kind: "off-origin",
      why: `points at another origin (${resolved.protocol}//${resolved.host})`,
    };
  }

  if (!resolved.pathname.startsWith(normalizedBase)) {
    // #27's shape (a missing base) and F-1's relative escape both land here.
    return {
      kind: "outside-base",
      why: `resolves to ${resolved.pathname}, which is outside ${normalizedBase}`,
    };
  }

  return { kind: "ok", path: resolved.pathname };
}

/** Every .html file under a directory. */
export function htmlFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return htmlFiles(full);
    return e.isFile() && full.endsWith(".html") ? [full] : [];
  });
}

/**
 * Does a based URL path point at something that exists, either as a file or as a
 * directory holding index.html?
 */
function resolvesToAFile(dist, urlPath, base) {
  const rel = urlPath.slice(normalizeBase(base).length);
  const target = path.join(dist, rel);
  if (!fs.existsSync(target)) return false;
  return fs.statSync(target).isDirectory() ? fs.existsSync(path.join(target, "index.html")) : true;
}

/**
 * Every link in the output that does not resolve under the base.
 *
 * @param {string} dist the private output directory
 * @param {string} base
 * @returns {{file: string, link: string, kind: string, why: string}[]}
 */
export function findBadLinks(dist, base) {
  const normalizedBase = normalizeBase(base);
  const bad = [];
  const outbound = [];

  for (const file of htmlFiles(dist)) {
    const pageUrl = pageUrlFor(path.relative(dist, file), normalizedBase);
    const html = fs.readFileSync(file, "utf8");

    // Scan TAG-first so every link is judged by what carries it. Scanning
    // attributes alone cannot tell a stylesheet from a citation, which is the
    // distinction that turned `main` red on 2026-09-23.
    for (const tagMatch of html.matchAll(TAG)) {
      const tag = tagMatch[1];
      const attrs = tagMatch[2] ?? "";

      for (const match of attrs.matchAll(LINK)) {
      const link = match[1];
      const verdict = classifyLink(link, pageUrl, normalizedBase, tag);

      if (verdict.kind === "inert") continue;
      if (verdict.kind === "outbound") {
        outbound.push({ file, link, tag, why: verdict.why });
        continue;
      }
      if (verdict.kind === "ok") {
        if (!resolvesToAFile(dist, verdict.path, normalizedBase)) {
          bad.push({
            file,
            link,
            kind: "missing",
            why: `resolves to ${verdict.path} under the base, but points at nothing`,
          });
        }
        continue;
      }
      bad.push({ file, link, kind: verdict.kind, why: verdict.why });
      }
    }
  }

  // Non-enumerable so `bad` still reads as a plain array in assertions and
  // serialisation, while main() can still report what was allowed.
  Object.defineProperty(bad, "outbound", { value: outbound, enumerable: false });
  return bad;
}

function parseArgs(argv) {
  const args = { dist: null, base: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--dist") args.dist = argv[++i];
    else if (argv[i] === "--base") args.base = argv[++i];
    else throw new Error(`unknown argument: ${argv[i]}`);
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const dist = args.dist ? path.resolve(args.dist) : DEFAULT_DIST;
  const base = normalizeBase(args.base ?? process.env.SITE_BASE ?? "/p/");

  const files = htmlFiles(dist);
  if (files.length === 0) {
    console.error(`check:private-links: no private build at ${dist}. Run npm run build:private first.`);
    process.exit(2);
  }

  const bad = findBadLinks(dist, base);
  const rel = (f) => path.relative(dist, f);

  if (bad.length > 0) {
    console.error(`\ncheck:private-links: ${bad.length} BROKEN LINK(S) in ${dist}:\n`);
    for (const b of bad) {
      console.error(`  ${rel(b.file)}\n    ${b.link}\n      ${b.kind}: ${b.why}`);
      if (process.env.GITHUB_ACTIONS === "true") {
        console.log(`::error file=${rel(b.file)}::${b.kind} link ${JSON.stringify(b.link)} — ${b.why}`);
      }
    }
    console.error(
      `\nThe gate serves this output under ${base} and strips it to form the object name,` +
        `\nso a link outside ${base} reaches the PUBLIC origin and 404s for a signed-in` +
        `\nmember (issue #27). An OFF-ORIGIN link is the strongest form of the same fault:` +
        `\nit takes the member -- or their browser -- to another party's server from a page` +
        `\nthat exists to be private (finding F-1). Nothing else in the build catches either.\n`,
    );
    process.exit(1);
  }

  // Outbound anchors are ALLOWED but never silent: a reader of a green run must
  // be able to see what the page links out to. A guard that quietly permits a
  // class is indistinguishable from one that cannot see it.
  const out = bad.outbound ?? [];
  if (out.length > 0) {
    console.log(`check:private-links: ${out.length} outbound link(s), allowed (navigation, not a fetch):`);
    const byHost = new Map();
    for (const o of out) {
      const host = (() => { try { return new URL(o.link, "https://x.invalid").host; } catch { return o.link; } })();
      byHost.set(host, (byHost.get(host) ?? 0) + 1);
    }
    for (const [host, n] of [...byHost].sort()) console.log(`  <a> -> ${host}  x${n}`);
  }

  console.log(
    `check:private-links: PASS — every link in ${files.length} page(s) resolves under ${base}: ` +
      `no off-origin SUB-RESOURCE, none escaping the base, and each points at a file that exists. ` +
      `${out.length} outbound anchor(s) allowed (see NAVIGATIONAL_TAGS).`,
  );
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
