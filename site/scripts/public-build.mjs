// The public build's Astro integration (ADR-0005; SEAM-1, SEAM-5; Wave 1).
//
// The public twin of scripts/private-build.mjs, and deliberately a smaller one.
// Its single job happens AFTER Astro has rendered the frames:
//
//   STAGE THE PAYLOADS. A `format: html` or `format: bundle` item is a folder
//   served verbatim in a thin frame. The frame is a page Astro emits at
//   /<section>/<source>/<slug>/ (src/pages/[section]/[source]/[slug].astro); the
//   payload is the item's own files, copied byte-for-byte under /_payload/<source>/
//   so the page's relative links and stylesheets resolve exactly as they do in
//   the satellite. Without this step the frame renders and its iframe 404s.
//
// It does NOT write a receipt: dist-public is deployed directly, and there is no
// destructive sync on this side (ADR-0010 decision 3 is about the private
// bucket). The staging plan itself is the single declaration shared with the
// private build (src/lib/frame-content.mjs), so the two cannot drift.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SOURCES_DIR } from "../src/lib/hub-content.mjs";
import { stagingPlanFor } from "../src/lib/frame-content.mjs";

const SITE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** The formats whose bytes are served as a framed folder. */
const FRAMED_FORMATS = new Set(["html", "bundle"]);

/**
 * The error message when a source mixes private items with a public framed item
 * whose path sits at the prefix root, or null when it is safe to stage.
 *
 * Exported so the fail-closed rule is testable without an Astro build.
 *
 * @param {{visibility?: string, format?: string, path?: string}[]} items
 * @param {string} name
 * @returns {string | null}
 */
export function mixedSourceError(items, name) {
  const hasPrivate = items.some((i) => i?.visibility === "private");
  const hasRootFramed = items.some(
    (i) =>
      i?.visibility === "public" &&
      FRAMED_FORMATS.has(i.format) &&
      typeof i.path === "string" &&
      !i.path.includes("/"),
  );
  if (!(hasPrivate && hasRootFramed)) return null;
  return (
    `source "${name}" mixes visibility: it has a private item AND a public ` +
    `html/bundle item whose path sits at the prefix root (e.g. "index.html"), ` +
    `which stages the WHOLE source prefix into the public build. The hub cannot ` +
    `tell which bytes are private from the manifest. Fail closed: give the ` +
    `framed item a declared asset set, give it a named subdirectory, or split ` +
    `the source (ADR candidate: html declares its asset set).`
  );
}

/**
 * @param {{sourcesDir?: string}} [options]
 * @returns {import('astro').AstroIntegration}
 */
export function publicBuild(options = {}) {
  const sourcesDir = path.resolve(options.sourcesDir ?? path.join(SITE_ROOT, SOURCES_DIR));

  return {
    name: "hub-public-build",
    hooks: {
      "astro:build:done": async ({ dir, logger }) => {
        const outDir = fileURLToPath(dir);

        const items = [];
        if (fs.existsSync(sourcesDir)) {
          for (const source of fs.readdirSync(sourcesDir).sort()) {
            const manifestPath = path.join(sourcesDir, source, "manifest.json");
            if (!fs.existsSync(manifestPath)) continue;
            let manifest;
            try {
              manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
            } catch {
              // A malformed manifest is the validator's to report, with a useful
              // message, during the build. Staging must not pre-empt it.
              continue;
            }
            const all = manifest?.items ?? [];
            const name = manifest.source ?? source;

            // FAIL CLOSED ON A MIXED SOURCE WITH A PREFIX-ROOT FOLDER. See
            // mixedSourceError: the hub cannot tell which bytes of a built-site
            // folder are private, so it refuses rather than guesses. The leak check
            // is a backstop, not a licence to stage private bytes.
            const mixed = mixedSourceError(all, name);
            if (mixed) throw new Error(mixed);

            for (const item of all) {
              if (item?.visibility !== "public") continue;
              if (!FRAMED_FORMATS.has(item.format)) continue;
              items.push({ ...item, source: name });
            }
          }
        }

        const plan = stagingPlanFor(sourcesDir, items);
        for (const { from, to } of plan) {
          const dest = path.join(outDir, to);
          fs.mkdirSync(path.dirname(dest), { recursive: true });
          fs.copyFileSync(from, dest);
        }
        logger.info(
          `staged ${plan.length} payload file(s) for ${items.length} public framed item(s)`,
        );
      },
    },
  };
}
