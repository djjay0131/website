// THE PUBLIC RSS ITEM SET (SEAM-P1, SEAM-P3; ADR-0005, SEAM-P7).
//
// The feed is built from `collectPublicItems`, which reads EFFECTIVE visibility
// (manifest request AND the committed publish allowlist, D8 / SEAM-B2). There is
// no second visibility check here and there must not be: a private item cannot
// reach `collectPublicItems` at all, so the feed is public-only by construction.
//
// WHERE EACH ITEM LINKS. An item only belongs in a feed if a HUMAN can open it.
// `collectPublicItems` returns every effectively-public manifest item, including
// payload-like ones with no page of their own:
//
//   - `html` / `bundle` -> the thin frame at /<section>/<source>/<slug>/
//     (src/pages/[section]/[source]/[slug].astro).
//   - a `cv` PDF -> /cv/<slug>/ (the first-party variant page), NOT the frame
//     route, because `cv` is rendered by /cv/ and /resumes/ and has no frame.
//   - anything else (`data`, e.g. the cv-data payload) -> no page, so it is
//     SKIPPED. A feed entry that 404s is worse than an absent one.
//
// MISSING DATE — SKIPPED, NOT FABRICATED. The manifest schema makes `date`
// required, so a valid manifest always carries one. `collectPublicItems`
// degrades on a MALFORMED manifest (it lists what it can rather than taking the
// build down), which is the only way an item arrives here without a date. Such an
// item is skipped and reported in `warnings`: a feed's whole value is its
// chronology, and stamping an invented `pubDate` would make the feed lie. The
// malformed manifest still fails the build later, with a useful message.
import { collectPublicItems } from "./frame-content.mjs";
import { canonicalUrl } from "./canonical-url.mjs";

/** The framed formats that get a route under /<section>/<source>/<slug>/. */
const FRAMED_FORMATS = new Set(["html", "bundle"]);

export const RSS_TITLE = "Jason Cusati — Research hub";
export const RSS_DESCRIPTION =
  "Research, projects, writing and CV updates published on jason.cusati.us.";

/**
 * The site-relative path an item is readable at, or null when it has no page.
 *
 * @param {{section?: string, source?: string, slug?: string, format?: string}} item
 * @returns {string | null}
 */
export function feedPathFor(item) {
  if (!item) return null;
  if (item.section === "cv" && item.source === "cv" && item.format === "pdf") {
    return `/cv/${item.slug}/`;
  }
  if (FRAMED_FORMATS.has(item.format)) {
    return `/${item.section}/${item.source}/${item.slug}/`;
  }
  return null;
}

/**
 * The feed's items, newest first, with absolute canonical links.
 *
 * @param {string} sourcesDir the synced tree (site/src/content/sources)
 * @param {{section?: string, excludeSources?: readonly string[], allowlist?: unknown}} [options]
 * @returns {{items: {title: string, description?: string, link: string, pubDate: string}[], warnings: string[]}}
 */
export function collectFeedItems(sourcesDir, options = {}) {
  const items = [];
  const warnings = [];
  for (const item of collectPublicItems(sourcesDir, options)) {
    const path = feedPathFor(item);
    if (!path) continue;
    if (!item.date) {
      warnings.push(
        `${item.source}/${item.slug} has no date, so it is NOT in the feed. The manifest schema ` +
          `makes date required; a manifest that omits it fails the build. An undated item cannot ` +
          `be placed in a feed without inventing a pubDate, so it is skipped instead.`,
      );
      continue;
    }
    items.push({
      title: item.title,
      description: item.summary,
      link: canonicalUrl(path),
      pubDate: item.date,
    });
  }
  // Newest first. A feed reader presents reverse-chronological order; two items
  // sharing a date fall back to title so the order is stable across builds.
  items.sort((a, b) => (a.pubDate === b.pubDate ? a.title.localeCompare(b.title) : a.pubDate < b.pubDate ? 1 : -1));
  return { items, warnings };
}
