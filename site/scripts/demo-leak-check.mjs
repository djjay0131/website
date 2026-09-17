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
// a private item's slug into a page there in each of the two ways a leak can
// happen, and runs the real check against the copy:
//
//   1. CONTENTS -- a private slug rendered into an existing public index page,
//      as a navigation link. This is the case a PATH-ONLY check cannot see, and
//      the reason ADR-0005 overruled the brief (K11).
//   2. PATH -- a page emitted at the private item's own route.
//
// It NEVER modifies the real dist-public: everything happens in a temporary copy
// which is removed on exit. It exits 0 when the check FAILED as intended, and
// non-zero if the check passed -- because a leak check that does not fail on an
// injected leak is the actual emergency.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SOURCES_DIR } from "../src/lib/hub-content.mjs";
import { OUTPUT_DIRS } from "./site-output.mjs";
import { collectPrivateItems } from "./check-no-private-in-public.mjs";

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
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "hub-leak-demo-"));
let failedAsIntended = false;

try {
  const injected = path.join(scratch, "dist-public");
  fs.cpSync(distDir, injected, { recursive: true });

  // INJECTION 1 -- contents. A private title and slug rendered into the public
  // home page as a link, exactly as a navigation or index regression would.
  const home = path.join(injected, "index.html");
  const before = fs.readFileSync(home, "utf8");
  const leakHtml =
    `<a href="/${victim.section ?? "phd"}/${victim.source}/${victim.slug}/">` +
    `${victim.title ?? victim.slug}</a>`;
  fs.writeFileSync(home, before.replace("</body>", `${leakHtml}</body>`));

  // INJECTION 2 -- path. A page emitted at the private item's own route.
  const leakDir = path.join(injected, victim.section ?? "phd", victim.source, victim.slug);
  fs.mkdirSync(leakDir, { recursive: true });
  fs.writeFileSync(path.join(leakDir, "index.html"), "<!doctype html><title>leaked</title>\n");

  console.log("demo:leak-check: injected two deliberate leaks into a COPY of the public build");
  console.log(`  copy:      ${injected}`);
  console.log(`  item:      ${victim.source}/${victim.slug}`);
  console.log(`  contents:  index.html  +=  ${leakHtml}`);
  console.log(
    `  path:      ${path.relative(injected, path.join(leakDir, "index.html"))}  (created)`,
  );
  console.log("\ndemo:leak-check: running the real check against the injected copy…\n");

  const run = spawnSync(process.execPath, [CHECK, "--dist", injected, "--sources", sourcesDir], {
    encoding: "utf8",
  });
  process.stdout.write(run.stdout ?? "");
  process.stderr.write(run.stderr ?? "");

  failedAsIntended = run.status === 1;

  console.log(`\ndemo:leak-check: the check exited ${run.status} (1 means it caught the leak).`);
  if (failedAsIntended) {
    console.log(
      "demo:leak-check: PASS — the guard failed on the injected leak, which is what it is for. " +
        "The real dist-public was never modified.",
    );
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
