// Fails the private build when any link in dist-private resolves OUTSIDE the base
// the gate serves from.
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
// It checks two things, and the second is the one that matters:
//   1. every root-absolute link starts with the base;
//   2. the file it points at EXISTS in the output.
// (1) alone would pass a build whose links were uniformly prefixed but wrong.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(HERE, "..", "dist-private");
const BASE = (process.env.SITE_BASE || "/p/").replace(/\/+$/, "") + "/";
const LINK = /(?:href|src)="(\/[^"]*)"/g;

function htmlFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return htmlFiles(full);
    return e.isFile() && full.endsWith(".html") ? [full] : [];
  });
}

// A link resolves to a file when the path (minus the base) exists, either as a
// file or as a directory holding index.html.
function resolves(link) {
  const rel = link.slice(BASE.length).split(/[?#]/)[0];
  const target = path.join(DIST, rel);
  if (fs.existsSync(target)) {
    return fs.statSync(target).isDirectory() ? fs.existsSync(path.join(target, "index.html")) : true;
  }
  return false;
}

const files = htmlFiles(DIST);
if (files.length === 0) {
  console.error(
    `check:private-links: no private build at ${DIST}. Run npm run build:private first.`,
  );
  process.exit(2);
}

const bad = [];
for (const file of files) {
  const html = fs.readFileSync(file, "utf8");
  for (const m of html.matchAll(LINK)) {
    const link = m[1];
    if (!link.startsWith(BASE)) {
      bad.push({ file, link, why: `does not start with ${BASE}` });
    } else if (!resolves(link)) {
      bad.push({ file, link, why: "starts with the base but points at nothing" });
    }
  }
}

const rel = (f) => path.relative(DIST, f);
if (bad.length > 0) {
  console.error(`\ncheck:private-links: ${bad.length} BROKEN LINK(S) in ${DIST}:\n`);
  for (const b of bad) console.error(`  ${rel(b.file)}\n    ${b.link}\n      ${b.why}`);
  console.error(
    `\nThe gate serves this output under ${BASE} and strips it to form the object name,` +
      `\nso a link outside ${BASE} reaches the PUBLIC origin and 404s for a signed-in` +
      `\nmember. Nothing else in the build will catch this (issue #27).\n`,
  );
  process.exit(1);
}

console.log(
  `check:private-links: PASS — every link in ${files.length} page(s) starts with ${BASE} ` +
    `and resolves to a file that exists.`,
);
