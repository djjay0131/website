#!/usr/bin/env node
// THE DELIBERATE FAILING RUN (site-phase-3 contract D3; roadmap Phase 3
// acceptance criterion: "a deliberate test run shows it failing the build when a
// private slug appears in any path or file content under site/dist-public").
//
//   npm run demo:leak-check
//   node scripts/demo-leak-check.mjs [--dist DIR] [--sources DIR]
//
// A guard never seen to fail is not known to work. This phase has already had
// two guards that only proved themselves when deliberately tripped, so the
// failing run is a first-class, repeatable artefact rather than a paragraph in a
// handoff saying "it would fail".
//
// WHAT IT DOES. It copies the real public build to a scratch directory, injects
// a private item's trace into EVERY derived output (Wave 5, SEAM-P6), and runs
// the real check against the copy:
//
//   1. CONTENTS -- the private title and route rendered into index.html.
//   2. PATH -- a page emitted at the private item's own route.
//   3. rss.xml -- the private title appended to the feed.
//   4. sitemap-0.xml -- the private route appended.
//   5. pagefind/pagefind-entry.json -- the private title appended (the Pagefind
//      TEXT file the byte grep reads directly).
//   5b. pagefind/fragment/*.pf_fragment, pagefind/*.pf_meta and
//      pagefind/index/*.pf_index -- the private title planted inside gzip
//      payloads, which the check now gunzips and contents-scans (SEAM-P6). A
//      valid fragment URL keeps the structural scope check green so this run
//      proves the CONTENTS scan, not an unrelated index problem.
//   6. the OG card -- a copy of og-card.png at a path naming the private slug,
//      which the path-only rule for binaries must catch.
//   7. a redirect stub -- the private TITLE appended to a generated stub, which
//      `findRedirectStubLeaks` must catch (the legacy PATH is ADR-0020-accepted
//      and is deliberately not a needle).
//
// It NEVER modifies the real dist-public or dist-redirects: everything happens
// in a temporary copy which is removed on exit. It exits 0 when the check FAILED
// as intended AND named every injected derived output, and non-zero otherwise --
// because a leak check that does not fail on an injected leak is the actual
// emergency.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { SOURCES_DIR } from "../src/lib/hub-content.mjs";
import { OUTPUT_DIRS } from "./site-output.mjs";
import { collectPrivateItems } from "./check-no-private-in-public.mjs";
import { MAP_PATH, generateRedirectStubs } from "./generate-redirect-stubs.mjs";

const SITE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHECK = path.join(SITE_ROOT, "scripts", "check-no-private-in-public.mjs");

function parseArgs(argv) {
  const args = { dist: null, sources: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--dist") args.dist = argv[++i];
    else if (argv[i] === "--sources") args.sources = argv[++i];
    else throw new Error(`unknown argument: ${argv[i]}`);
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const distDir = args.dist ? path.resolve(args.dist) : path.join(SITE_ROOT, OUTPUT_DIRS.public);
const sourcesDir = args.sources ? path.resolve(args.sources) : path.join(SITE_ROOT, SOURCES_DIR);

if (!fs.existsSync(path.join(distDir, "index.html"))) {
  console.error(
    `demo:leak-check: no public build at ${distDir}. Run the public build first ` +
      `(npm run build), and sync content so a private item exists ` +
      `(npm run content:fixture).`,
  );
  process.exit(2);
}

const privateItems = collectPrivateItems(sourcesDir);
if (privateItems.length === 0) {
  console.error(
    `demo:leak-check: no private items are published under ${sourcesDir}, so there is no private ` +
      `slug to inject. Run npm run content:fixture first -- the committed fixture publishes two ` +
      `private items for exactly this purpose.`,
  );
  process.exit(2);
}

const victim = privateItems[0];
const section = victim.section ?? "phd";
const route = `/${section}/${victim.source}/${victim.slug}/`;
const needle = victim.title ?? victim.slug;
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "hub-leak-demo-"));
let failedAsIntended = false;

/** Relative paths of every derived output we plant into, for the assertion. */
const planted = [];

function writeAppend(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const before = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  fs.writeFileSync(file, `${before}${text}\n`);
}

/** A structurally valid gzip Pagefind payload carrying `json` as its text. */
function writeGzipFile(file, json) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, zlib.gzipSync(Buffer.from(`pagefind_dcd${JSON.stringify(json)}`)));
}

try {
  const injected = path.join(scratch, OUTPUT_DIRS.public);
  fs.cpSync(distDir, injected, { recursive: true });

  // 1 + 2. CONTENTS and PATH — the two original injections.
  const home = path.join(injected, "index.html");
  const before = fs.readFileSync(home, "utf8");
  const leakHtml = `<a href="${route}">${needle}</a>`;
  fs.writeFileSync(home, before.replace("</body>", `${leakHtml}</body>`));
  planted.push("index.html");

  const leakDir = path.join(injected, section, victim.source, victim.slug);
  fs.mkdirSync(leakDir, { recursive: true });
  fs.writeFileSync(path.join(leakDir, "index.html"), "<!doctype html><title>leaked</title>\n");
  planted.push(path.posix.join(section, victim.source, victim.slug, "index.html"));

  // 3. rss.xml — a feed that names the private item.
  writeAppend(path.join(injected, "rss.xml"), `<item><title>${needle}</title><link>${route}</link></item>`);
  planted.push("rss.xml");

  // 4. sitemap — a sitemap that lists the private route.
  writeAppend(path.join(injected, "sitemap-0.xml"), `<url><loc>${route}</loc></url>`);
  planted.push("sitemap-0.xml");

  // 5. the Pagefind TEXT file the byte grep reads directly.
  writeAppend(
    path.join(injected, "pagefind", "pagefind-entry.json"),
    JSON.stringify({ leak: needle }),
  );
  planted.push("pagefind/pagefind-entry.json");

  // 5b. the gzip Pagefind payloads. The byte grep gunzips these now, so the
  // title planted inside `content` is caught. A valid fragment URL keeps the
  // scope check green so this run proves the CONTENTS scan.
  writeGzipFile(path.join(injected, "pagefind", "fragment", "en_demo_plant.pf_fragment"), {
    url: "/index.html",
    content: `demo fragment ${needle}`,
  });
  planted.push("pagefind/fragment/en_demo_plant.pf_fragment");
  for (const rel of ["pagefind/pagefind.en_demo.pf_meta", "pagefind/index/en_demo.pf_index"]) {
    const file = path.join(injected, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, zlib.gzipSync(Buffer.from(`pagefind_dcd${needle}`, "utf8")));
    planted.push(rel);
  }

  // 6. the OG card, BINARY: the private slug in the PATH is the only signal.
  const ogSource = path.join(injected, "og-card.png");
  const ogLeakPath = path.join(injected, "og-cards", `${victim.slug}.png`);
  fs.mkdirSync(path.dirname(ogLeakPath), { recursive: true });
  if (fs.existsSync(ogSource)) fs.copyFileSync(ogSource, ogLeakPath);
  else fs.writeFileSync(ogLeakPath, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00]));
  planted.push(path.posix.join("og-cards", `${victim.slug}.png`));

  // 7. a redirect stub, with the private TITLE injected (not its path).
  const stubsDir = path.join(scratch, "dist-redirects");
  const map = JSON.parse(fs.readFileSync(MAP_PATH, "utf8"));
  generateRedirectStubs({ map, outDir: stubsDir });
  const stubRel = "cv/index.html";
  const stubFile = path.join(stubsDir, stubRel);
  writeAppend(stubFile, `<p>${needle}</p>`);
  planted.push(stubRel);

  console.log("demo:leak-check: injected deliberate leaks into a COPY of the public build");
  console.log(`  copy:        ${injected}`);
  console.log(`  stubs copy:  ${stubsDir}`);
  console.log(`  item:        ${victim.source}/${victim.slug}`);
  console.log(`  contents:    index.html  +=  ${leakHtml}`);
  console.log(`  path:        ${path.posix.join(section, victim.source, victim.slug, "index.html")}  (created)`);
  console.log("  derived:     " + planted.slice(2).join(", "));
  console.log("\ndemo:leak-check: running the real check against the injected copy…\n");

  const run = spawnSync(
    process.execPath,
    [CHECK, "--dist", injected, "--sources", sourcesDir, "--stubs", stubsDir],
    { encoding: "utf8" },
  );
  process.stdout.write(run.stdout ?? "");
  process.stderr.write(run.stderr ?? "");

  // The check must have gone red AND named every derived output we planted. A
  // check that fails for one reason while silently ignoring the other six is
  // exactly the coverage gap SEAM-P6 exists to close.
  const output = `${run.stdout ?? ""}\n${run.stderr ?? ""}`;
  const unflagged = planted.filter((rel) => !output.includes(rel));
  failedAsIntended = run.status === 1 && unflagged.length === 0;

  console.log(`\ndemo:leak-check: the check exited ${run.status} (1 means it caught the leak).`);
  if (run.status === 1 && unflagged.length > 0) {
    console.error(
      `demo:leak-check: the check failed, but did NOT name these planted derived output(s): ` +
        `${unflagged.join(", ")}. A derived output the guard cannot see is an uncovered leak.`,
    );
  }
  if (failedAsIntended) {
    console.log(
      `demo:leak-check: PASS — the guard failed on the injected leak in all ${planted.length} ` +
        `output(s), which is what it is for. The real dist-public and dist-redirects were never ` +
        `modified.`,
    );
  } else if (run.status === 1) {
    // Message already printed above.
  } else {
    console.error(
      "demo:leak-check: FAIL — the check did NOT fail on an injected leak. The guard is not " +
        "working, and that is more serious than a failing build.",
    );
  }
} finally {
  fs.rmSync(scratch, { recursive: true, force: true });
}

process.exit(failedAsIntended ? 0 : 1);
