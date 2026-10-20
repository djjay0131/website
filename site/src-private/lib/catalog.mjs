// THE PRIVATE BUILD'S ITEM CATALOG (ADR-0025, D24-B).
//
// The private build knows which items exist and which bucket objects belong to
// each one. It does NOT decide who may read them: that policy lives in
// Firestore (`access_policy/current`), so the owner can change it with no PR,
// rebuild or redeploy. The catalog therefore carries item metadata and an
// object -> item-key map only. It carries no groups, roles or member names.
//
// `_hub/**` is never served. The gate reads `_hub/catalog.json` from the
// private bucket, joins it with the Firestore policy, and fails closed on an
// unmapped object or a missing/malformed input.
//
// This module lives under src-private/ on purpose: the public build's srcDir is
// ./src and cannot reach it (ADR-0011). Nothing here may enter dist-public.
import fs from "node:fs";
import path from "node:path";
import {
  SOURCES_DIR,
  effectiveVisibility,
  readPublishAllowlist,
} from "../../src/lib/hub-content.mjs";
import { routeFor } from "./private-content.mjs";

/** The only catalog schema this hub understands. */
export const CATALOG_VERSION = 2;

/** The object the gate reads. `_hub/**` is never served to a caller. */
export const CATALOG_OBJECT = "_hub/catalog.json";

/** The item key the catalog and the gate share. */
export function itemKey(section, source, slug) {
  return `${section}/${source}/${slug}`;
}

/**
 * Every source manifest under the synced tree.
 *
 * Deliberately a plain read: the Astro collection has already run the schema
 * mirror and the contract rules by the time this build hook runs, and this
 * module must stay importable from a node script (it cannot import the Astro
 * content config). A malformed manifest simply contributes no items here; the
 * build has already failed on it.
 */
function readManifests(sourcesDir) {
  if (!fs.existsSync(sourcesDir)) return [];
  const sources = [];
  for (const name of fs.readdirSync(sourcesDir).sort()) {
    const dir = path.join(sourcesDir, name);
    if (!fs.statSync(dir).isDirectory()) continue;
    try {
      const manifest = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8"));
      if (Array.isArray(manifest?.items)) sources.push({ source: manifest.source ?? name, manifest });
    } catch {
      continue;
    }
  }
  return sources;
}

/** Sections whose sources are document collections, not projects (D25). */
export const NON_PROJECT_SECTIONS = new Set(["cv"]);

/** True when an item belongs to a project section (D25). */
export function isProjectItem(item) {
  return !NON_PROJECT_SECTIONS.has(item.section);
}

/** The member route for an item inside its project section (D25). */
export function projectRouteFor(item, base = "/p/") {
  return `${base}projects/${item.source}/${item.slug}/`;
}

/** The pre-D25 item route, kept working (D25). */
export function legacyItemRouteFor(item, base = "/p/") {
  return routeFor(item, base);
}

/** The public URL a member is linked to for an effectively-public item. */
export function publicHrefFor(item, siteOrigin) {
  let rel = null;
  if (item.format === "pdf" && item.section === "cv") rel = `cv/${item.slug}/`;
  else if (item.format === "html" || item.format === "bundle") {
    rel = `${item.section}/${item.source}/${item.slug}/`;
  }
  if (!rel) return null;
  return `${String(siteOrigin ?? "").replace(/\/+$/, "")}/${rel}`;
}

/**
 * Build the catalog the gate reads.
 *
 * Every non-data item is listed, public or private, because the landing page
 * asks the gate for what its viewer may open. The `objects` map is filled by
 * the private build from its staging plans; only private items are staged.
 *
 * @param {{
 *   sourcesDir?: string,
 *   allowlist?: ReturnType<typeof readPublishAllowlist>,
 *   siteOrigin?: string,
 *   base?: string
 * }} [options]
 */
export function buildItemCatalog(options = {}) {
  const sourcesDir = path.resolve(options.sourcesDir ?? SOURCES_DIR);
  const allowlist = options.allowlist ?? readPublishAllowlist();
  const siteOrigin = options.siteOrigin ?? "https://jason.cusati.us";
  const base = options.base ?? "/p/";

  const items = {};
  for (const { source, manifest } of readManifests(sourcesDir)) {
    for (const [order, item] of manifest.items.entries()) {
      if (item.format === "data") continue;
      const visibility = effectiveVisibility(item, source, allowlist);
      const key = itemKey(item.section, source, item.slug);
      items[key] = {
        section: item.section,
        source,
        slug: item.slug,
        title: item.title,
        format: item.format,
        visibility,
        // The file the owner UI names when minting a share token. Derived from
        // the manifest's path, never from a request.
        entry: path.posix.basename(String(item.path ?? "")),
        href:
          visibility === "private"
            ? isProjectItem({ ...item, source })
              ? projectRouteFor({ ...item, source }, base)
              : routeFor({ ...item, source }, base)
            : publicHrefFor({ ...item, source }, siteOrigin),
        summary: item.summary,
        date: item.date,
        order,
      };
    }
  }

  return {
    version: CATALOG_VERSION,
    items,
    // Filled by the private build: `<_payload/... or item _doc/...> -> [item keys]`.
    objects: {},
  };
}
