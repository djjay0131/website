// THE PUBLIC RSS FEED (SEAM-P3).
//
// This endpoint lives under src/pages/, so the PRIVATE build — whose srcDir is
// src-private — never resolves it and cannot emit a feed. That is the structural
// half of "no RSS in the private build"; the build-output test asserts the
// absence rather than trusting the routing rule.
//
// The item set and the canonical-link rules live in src/lib/public-feed.mjs so
// they can be tested without an Astro build; this file only adapts them to
// @astrojs/rss.
import rss from "@astrojs/rss";
import path from "node:path";
import { SOURCES_DIR } from "../lib/hub-content.mjs";
import { CANONICAL_ORIGIN } from "../lib/canonical-url.mjs";
import { RSS_DESCRIPTION, RSS_TITLE, collectFeedItems } from "../lib/public-feed.mjs";

export function GET() {
  const { items, warnings } = collectFeedItems(path.resolve(SOURCES_DIR));
  for (const warning of warnings) console.warn(`[rss] ${warning}`);

  return rss({
    title: RSS_TITLE,
    description: RSS_DESCRIPTION,
    // The canonical origin, never the Pages variant's SITE_URL (SEAM-P7).
    site: CANONICAL_ORIGIN,
    items,
    customData: "<language>en-us</language>",
  });
}
