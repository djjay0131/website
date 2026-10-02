#!/usr/bin/env node
// THE ALLOWLIST GUARD (D8; SEAM-B5).
//
//   node scripts/check-publish-allowlist.mjs [--mode pr|deploy] [--sources DIR] [--allowlist FILE]
//   npm run check:publish-allowlist
//
// Two conditions, deliberately different in how they treat a stale entry:
//
//   CONDITION A -- an allowlist entry names an item whose manifest says
//   `visibility: private`. ALWAYS a hard failure. The allowlist decides what
//   BECOMES public; it can never override a satellite's own request for privacy.
//
//   CONDITION B -- an allowlist entry names a (source, slug) that no manifest
//   carries. This is context-dependent, and the reason is in SEAM-B5's
//   amendment: a satellite may rename a slug as ordinary content editing, and a
//   satellite is untrusted. If a stale entry failed the DEPLOY build, a
//   satellite's rename would be a kill switch on the hub's deploy -- and because
//   private-sync `needs: build-firebase`, on the WITHDRAWAL path too. So:
//
//     --mode pr      (the hub's own pull requests)  -> hard failure
//     --mode deploy  (the deploy build on main)     -> warn loudly, continue
//
//   The warning names the entry and is not suppressible, so "warn" cannot decay
//   into "ignore".
//
// Hub entries (`source: "hub"`) are exempt from condition B: they name
// first-party routes, not manifest items.
//
// Exit: 0 clear (or a warned deploy), 1 a condition failed, 2 bad invocation.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  SOURCES_DIR,
  findAllowlistConflicts,
  findStaleAllowlistEntries,
  readPublishAllowlist,
} from "../src/lib/hub-content.mjs";

const SITE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const MODES = new Set(["pr", "deploy"]);

/**
 * Read every source's manifest WITHOUT the build's expected-source enforcement:
 * this guard is about the allowlist, and must run even when a required prefix is
 * absent (it will then legitimately warn, or fail, about stale entries).
 *
 * @param {string} sourcesDir
 * @returns {{source: string, manifest: {items?: unknown[]}}[]}
 */
export function readRawSources(sourcesDir) {
  if (!fs.existsSync(sourcesDir)) return [];
  const sources = [];
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
      continue; // the validating loader owns malformed manifests.
    }
    sources.push({
      source: typeof manifest?.source === "string" ? manifest.source : source,
      manifest: manifest ?? {},
    });
  }
  return sources;
}

/**
 * Evaluate the allowlist against the synced tree. Pure, so it is testable.
 *
 * @param {{source: string, manifest: {items?: unknown[]}}[]} sources
 * @param {ReturnType<typeof readPublishAllowlist>} allowlist
 * @param {{mode?: "pr" | "deploy"}} [options]
 * @returns {{conflicts: string[], stale: {source: string, slug: string}[], fails: boolean}}
 */
export function evaluateAllowlist(sources, allowlist, options = {}) {
  const mode = options.mode ?? "pr";
  const conflicts = findAllowlistConflicts(sources, allowlist);
  const stale = findStaleAllowlistEntries(sources, allowlist);
  return { conflicts, stale, fails: conflicts.length > 0 || (mode === "pr" && stale.length > 0) };
}

function parseArgs(argv) {
  const args = { mode: "pr", sources: null, allowlist: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--mode") args.mode = argv[++i];
    else if (argv[i] === "--sources") args.sources = argv[++i];
    else if (argv[i] === "--allowlist") args.allowlist = argv[++i];
    else throw new Error(`unknown argument: ${argv[i]}`);
  }
  if (!MODES.has(args.mode)) throw new Error(`--mode must be one of ${[...MODES].join(", ")}`);
  return args;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`check:publish-allowlist: ${error.message}`);
    process.exit(2);
  }

  const sourcesDir = args.sources ? path.resolve(args.sources) : path.join(SITE_ROOT, SOURCES_DIR);
  let allowlist;
  try {
    allowlist = readPublishAllowlist(
      args.allowlist ? path.resolve(args.allowlist) : undefined,
    );
  } catch (error) {
    console.error(`check:publish-allowlist: ${error.message}`);
    process.exit(1);
  }

  const sources = readRawSources(sourcesDir);
  const { conflicts, stale, fails } = evaluateAllowlist(sources, allowlist, { mode: args.mode });

  for (const problem of conflicts) console.error(`check:publish-allowlist: CONFLICT ${problem}`);

  if (stale.length > 0) {
    const header =
      `check:publish-allowlist: ${stale.length} STALE entr${stale.length === 1 ? "y" : "ies"} ` +
      `in site/publish-allowlist.json (mode ${args.mode}):`;
    if (args.mode === "pr") {
      console.error(header);
      for (const entry of stale) {
        console.error(
          `  ${entry.source}/${entry.slug} names no item in any manifest. On a pull request a ` +
            `stale entry is the hub's own bookkeeping error and fails the build; fix it before ` +
            `merging (SEAM-B5 condition B).`,
        );
      }
    } else {
      console.warn(header);
      for (const entry of stale) {
        console.warn(
          `  ${entry.source}/${entry.slug} names no item in any manifest. A satellite rename is ` +
            `ordinary content editing and must NOT stop the hub deploying or withdrawing, so the ` +
            `deploy build continues -- but this entry is now doing nothing.`,
        );
      }
    }
  }

  if (fails) {
    console.error(
      `\ncheck:publish-allowlist: FAIL. The allowlist is the hub's sole authority on what is ` +
        `public (D8, SEAM-B1); a conflict or a PR-stale entry is a defect in it.\n`,
    );
    if (process.env.GITHUB_ACTIONS === "true") {
      console.log(`::error title=Publish allowlist failed::see check-publish-allowlist output`);
    }
    process.exit(1);
  }

  console.log(
    `check:publish-allowlist: PASS (mode ${args.mode}) — ${allowlist.entries.length} entries, ` +
      `0 conflicts, ${stale.length} stale.`,
  );
}
