// The private build's Astro integration (ADR-0005; ADR-0010 decisions 3 and 5).
//
// Two jobs, both of which must happen AFTER Astro has rendered the private
// pages, and both of which exist only in the private build:
//
//   1. STAGE THE PAYLOADS. Copy each private item's bytes into the output, by
//      containing directory, per src/lib/private-content.mjs's staging plan. An
//      `html` item without its sibling stylesheet renders broken silently, and
//      only for the members the private area exists for.
//
//   2. WRITE THE BUILD RECEIPT. scripts/sync-private.mjs refuses to delete
//      anything at the destination unless this file is present and matches the
//      output on disk. It is written LAST, deliberately: it is the signal that
//      the build got all the way to the end, which is ADR-0010 decision 3's
//      "the build succeeded and the manifests validated" made checkable rather
//      than assumed. A build that throws leaves no receipt, and a sync that
//      finds no receipt deletes nothing.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SOURCES_DIR, effectiveVisibility, readPublishAllowlist } from "../src/lib/hub-content.mjs";
import {
  docStagingPlanFor,
  findUnservablePaths,
  stagingPlanFor,
} from "../src-private/lib/private-content.mjs";
import { RECEIPT_NAME } from "./sync-private.mjs";

const SITE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function countFiles(dir, rel = "") {
  let n = 0;
  let entries;
  try {
    entries = fs.readdirSync(path.join(dir, rel), { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const entry of entries) {
    const child = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) n += countFiles(dir, child);
    else n += 1;
  }
  return n;
}

/**
 * @param {{sourcesDir?: string}} [options]
 * @returns {import('astro').AstroIntegration}
 */
export function privateBuild(options = {}) {
  const sourcesDir = path.resolve(options.sourcesDir ?? path.join(SITE_ROOT, SOURCES_DIR));

  return {
    name: "hub-private-build",
    hooks: {
      "astro:build:done": async ({ dir, pages, logger }) => {
        const outDir = fileURLToPath(dir);

        // The private items this build actually rendered. Read back from the
        // manifests rather than from `pages`, so the staging plan and the pages
        // agree by construction.
        //
        // ONLY effectively-private items are staged. Staging public items too
        // (the first cut of SEAM-B4) duplicated a public satellite's payload
        // into the private bucket and failed `check:private-links` on the KGIS
        // docs' off-origin and absolute links on the real deploy. Public items
        // stay on the public site; the private area carries the private set.
        const allowlist = readPublishAllowlist();
        const items = [];
        if (fs.existsSync(sourcesDir)) {
          for (const source of fs.readdirSync(sourcesDir).sort()) {
            const manifestPath = path.join(sourcesDir, source, "manifest.json");
            if (!fs.existsSync(manifestPath)) continue;
            let manifest;
            try {
              manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
            } catch {
              continue;
            }
            const name = manifest.source ?? source;
            for (const item of manifest?.items ?? []) {
              if (effectiveVisibility(item, name, allowlist) !== "private") continue;
              // `format: data` items are build inputs, not framed documents, so
              // they are not staged.
              if (item?.format === "data") continue;
              items.push({ ...item, source: name });
            }
          }
        }

        const plan = stagingPlanFor(sourcesDir, items);

        // THE SHARE-SERVABLE COPY (SEAM-S1, amended 2026-10-03). ADDITIVE: the
        // member payloads above stay byte-for-byte. Each effectively-private
        // item also gets a self-contained, item-scoped `_doc/` tree for a
        // signed-out share holder, because the member frame leaks the private
        // catalogue and links its payload through `/p/` (Dissenter Wave 3 D1).
        const docPlan = docStagingPlanFor(sourcesDir, items);

        // `_payload/<source>/…` and `<section>/<source>/<slug>/_doc/…` are
        // disjoint by construction, but a malformed manifest must not silently
        // have one plan overwrite a file the other staged. Fail closed instead.
        const byTo = new Map();
        for (const entry of [...plan, ...docPlan]) {
          const previous = byTo.get(entry.to);
          if (previous && previous.from !== entry.from) {
            throw new Error(
              `staging conflict: ${entry.to} would be copied from both ` +
                `${previous.from} and ${entry.from}. Refusing to guess which one ` +
                `the gate should serve.`,
            );
          }
          byTo.set(entry.to, entry);
        }
        for (const { from, to } of byTo.values()) {
          const dest = path.join(outDir, to);
          fs.mkdirSync(path.dirname(dest), { recursive: true });
          fs.copyFileSync(from, dest);
        }
        logger.info(
          `staged ${plan.length} payload file(s) for ${items.length} private item(s) ` +
            `from ${plan.length === 0 ? "(nothing)" : "their containing directories"}`,
        );
        logger.info(
          `staged ${docPlan.length} item-scoped _doc file(s) for ` +
            `${items.length} private item(s) (the share-servable copy)`,
        );

        // SD-7. Every emitted path must be one the gate can actually serve,
        // checked BEFORE the receipt is written so an unservable build cannot
        // sync. Failing here turns "the member gets a 404 and nothing in the
        // pipeline noticed" into a caught build error, which costs nothing.
        const emitted = [];
        (function collect(rel) {
          for (const entry of fs.readdirSync(path.join(outDir, rel), { withFileTypes: true })) {
            const child = rel ? `${rel}/${entry.name}` : entry.name;
            if (entry.isDirectory()) collect(child);
            else emitted.push(child);
          }
        })("");

        const unservable = findUnservablePaths(emitted);
        if (unservable.length > 0) {
          const shown = unservable
            .slice(0, 20)
            .map((u) => `  ${u.path}\n      offending segment: ${JSON.stringify(u.segment)}`)
            .join("\n");
          throw new Error(
            `the private build emitted ${unservable.length} path(s) the gate cannot serve.\n\n${shown}\n\n` +
              `The gate validates /p/{path} with an ALLOWLIST -- every segment must match ` +
              `[A-Za-z0-9._-] -- and refuses anything else with a 404 before the bucket is read ` +
              `(gate finding SD-7). Such a file would sync to the private bucket perfectly and ` +
              `then be permanently unreachable, with nothing failing anywhere. Most often this ` +
              `comes from a character in a satellite's item "path", or from a slug or title that ` +
              `reaches a filename. Failing the build instead.`,
          );
        }
        logger.info(`checked ${emitted.length} emitted path(s) against the gate's allowlist (SD-7)`);

        // Written last. See the header: this is the sync's gate.
        const receipt = {
          output: "private",
          builtAt: new Date().toISOString(),
          commit: process.env.GITHUB_SHA ?? null,
          runId: process.env.GITHUB_RUN_ID ?? null,
          privateItemCount: items.length,
          items: items.map((i) => `${i.source}/${i.slug}`).sort(),
          pageCount: pages?.length ?? 0,
          payloadFileCount: plan.length,
          docFileCount: docPlan.length,
          fileCount: countFiles(outDir),
        };
        fs.writeFileSync(
          path.join(outDir, RECEIPT_NAME),
          `${JSON.stringify(receipt, null, 2)}\n`,
        );
        logger.info(
          `wrote ${RECEIPT_NAME}: ${receipt.privateItemCount} private item(s), ` +
            `${receipt.fileCount} file(s). scripts/sync-private.mjs will refuse to run without it.`,
        );
      },
    },
  };
}
