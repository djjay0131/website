#!/usr/bin/env node
// Stage the published assets the hub serves straight out of public/ (D4).
//
//   node scripts/stage-public-assets.mjs [--sources DIR]
//
// Phase 1 served /pdfs/<variant>.pdf and /photo_jason_1.jpeg out of site/public/,
// where scripts/fetch-data.sh put them. Phase 2 changes where the bytes come
// from, not where they are served: this step copies them from the synced
// payload into the same two places, so every Phase 1 URL keeps resolving with
// no redirect (ADR-0008 decision 4; SEAM-5 "PDFs land at /pdfs/<variant>.pdf,
// the path Phase 1 serves").
//
// It is driven by each source's manifest, never by globbing the tree: the
// manifest is the authority on what exists (an item dropped from `items` is
// withdrawn whether or not its bytes remain in the bucket). The mapping from a
// published item to its public path is the single declaration in
// src/lib/hub-content.mjs.
//
// It does NOT validate the manifest. That is src/content.config.ts's job, and
// it happens during the build; this step runs before it and stays deliberately
// dumb, skipping anything it does not recognise.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CV_PHOTO_REL,
  CV_SOURCE,
  PUBLIC_PDF_DIR,
  PUBLIC_PHOTO_PATH,
  SOURCES_DIR,
  publicAssetPathFor,
} from "../src/lib/hub-content.mjs";

const SITE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Copy the public assets of every synced source into public/.
 * @param {string} sourcesDir absolute path to the synced sources tree
 * @param {string} siteRoot absolute path to site/
 * @returns {{staged: string[], removed: string[]}}
 */
export function stagePublicAssets(sourcesDir, siteRoot = SITE_ROOT) {
  const staged = [];
  const removed = [];

  // Rebuilt every run: a PDF whose item was withdrawn must stop being served.
  const pdfDir = path.join(siteRoot, PUBLIC_PDF_DIR);
  if (fs.existsSync(pdfDir)) {
    for (const f of fs.readdirSync(pdfDir)) removed.push(`${PUBLIC_PDF_DIR}/${f}`);
    fs.rmSync(pdfDir, { recursive: true, force: true });
  }
  fs.mkdirSync(pdfDir, { recursive: true });
  fs.rmSync(path.join(siteRoot, PUBLIC_PHOTO_PATH), { force: true });

  if (!fs.existsSync(sourcesDir)) return { staged, removed };

  for (const source of fs.readdirSync(sourcesDir).sort()) {
    const manifestPath = path.join(sourcesDir, source, "manifest.json");
    if (!fs.existsSync(manifestPath)) continue;
    let manifest;
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    } catch {
      // A malformed manifest is a build failure, raised with a useful message
      // by src/content.config.ts. Staging must not pre-empt it with a worse one.
      continue;
    }
    for (const item of manifest?.items ?? []) {
      const target = publicAssetPathFor(item, source);
      if (!target || typeof item.path !== "string") continue;
      const from = path.join(sourcesDir, source, item.path);
      if (!fs.existsSync(from)) continue;
      const to = path.join(siteRoot, target);
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.copyFileSync(from, to);
      staged.push(target);
    }
  }

  // The photo is part of the claimed cv-data payload rather than an item of its
  // own, so it is named directly (SEAM-5). Resolved against the SYNCED TREE,
  // not against site/: the two coincide in a normal build but not when
  // --dest points elsewhere, and only one of them is right.
  const photo = path.join(sourcesDir, CV_SOURCE, CV_PHOTO_REL);
  if (fs.existsSync(photo)) {
    fs.copyFileSync(photo, path.join(siteRoot, PUBLIC_PHOTO_PATH));
    staged.push(PUBLIC_PHOTO_PATH);
  }

  return { staged, removed };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const flagIndex = process.argv.indexOf("--sources");
  const sourcesDir = path.resolve(
    SITE_ROOT,
    flagIndex === -1 ? SOURCES_DIR : (process.argv[flagIndex + 1] ?? SOURCES_DIR),
  );
  const { staged } = stagePublicAssets(sourcesDir);
  if (staged.length === 0) {
    console.log("stage-public-assets: nothing to stage (no published assets under the synced sources).");
  } else {
    for (const f of staged) console.log(`stage-public-assets: ${f}`);
  }
}
