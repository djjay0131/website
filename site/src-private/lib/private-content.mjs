// THE PRIVATE SIDE OF THE TWO-OUTPUT BUILD (ADR-0005; ADR-0010; SEAM-1, SEAM-5).
//
// The frame URL, the payload URL and the staging plan are IDENTICAL in both
// outputs: a public html item and a private html item are staged the same way
// and framed at the same route shape. Those three facts now live once, in
// src/lib/frame-content.mjs, which is public-safe by construction. This module
// is the private build's name for them.
//
// It stays under src-private/ on purpose, and the reason is the STRUCTURAL
// guarantee scripts/private-structure.test.ts pins: nothing the public build
// compiles may reach anything under src-private/, and no module that knows what
// "private" means may live inside src/. This file used to hold the
// implementation; it holds none now, but keeping the private build's import at
// this path preserves the one-way arrow the test asserts.
//
// Nothing in src/pages/** may import this file.
import { routeFor } from "../../src/lib/frame-content.mjs";

export {
  GATE_SEGMENT_PATTERN,
  PAYLOAD_ROOT,
  SHARE_DOC_ROOT,
  docStagingPlanFor,
  findUnservablePaths,
  payloadUrlFor,
  routeFor,
  stagingPlanFor,
} from "../../src/lib/frame-content.mjs";

/**
 * Where a member reaches an item from the members' area.
 *
 * SEAM-B4: a member sees every item in one place. A **private** item is framed
 * under the gate's base (`/p/<section>/<source>/<slug>/`), as before. A **public**
 * item is not duplicated into the private bucket — staging public bytes too
 * exported a public satellite's off-origin links under `/p/` and failed
 * `check:private-links` on the real deploy — so it is linked to its public URL on
 * the canonical origin instead. That absolute URL is an outbound navigation
 * anchor, which `check:private-links` allows by design (NAVIGATIONAL_TAGS).
 *
 * @param {{section: string, source: string, slug: string, format: string, effective_visibility: string}} item
 * @param {{base: string, site: string}} ctx `base` is the private base (`/p/`);
 *   `site` is the canonical origin (`Astro.site`).
 * @returns {string | null} null when the item has no public route to link to.
 */
export function memberHref(item, { base, site }) {
  if (item.effective_visibility === "private") return routeFor(item, base);
  let rel = null;
  if (item.format === "pdf" && item.section === "cv") rel = `cv/${item.slug}/`;
  else if (item.format === "html" || item.format === "bundle") {
    rel = `${item.section}/${item.source}/${item.slug}/`;
  }
  if (!rel) return null;
  const origin = String(site ?? "").replace(/\/+$/, "");
  return `${origin}/${rel}`;
}
