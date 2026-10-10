// THE PUBLIC RSS FEED (SEAM-P3; D21 extension).
//
// This endpoint lives under src/pages/, so the PRIVATE build — whose srcDir is
// src-private — never resolves it and cannot emit a feed. That is the structural
// half of "no RSS in the private build"; the build-output test asserts the
// absence rather than trusting the routing rule.
//
// The item set and the canonical-link rules live in src/lib/public-feed.mjs so
// they can be tested without an Astro build; this file only adapts them to
// @astrojs/rss. D21 adds the Rabbit Holes posts to the SAME site-wide feed: the
// manifest items keep a summary, the posts carry FULL CONTENT (`content` becomes
// <content:encoded> in RSS 2.0). The combined list is sorted newest first.
import rss from "@astrojs/rss";
import path from "node:path";
import { SOURCES_DIR } from "../lib/hub-content.mjs";
import { CANONICAL_ORIGIN } from "../lib/canonical-url.mjs";
import { RSS_DESCRIPTION, RSS_TITLE, collectFeedItems } from "../lib/public-feed.mjs";
import { getPublishedPosts } from "../lib/rabbit-holes-collection";
import { postUrl } from "../lib/rabbit-holes.mjs";

/** A comparable timestamp for a pubDate that may be a string or a Date. */
function timeOf(value: unknown): number {
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

export async function GET() {
  const { items, warnings } = collectFeedItems(path.resolve(SOURCES_DIR));
  for (const warning of warnings) console.warn(`[rss] ${warning}`);

  const posts = await getPublishedPosts();
  const postItems = posts.map((post) => ({
    title: post.title,
    description: post.summary,
    link: postUrl(post, CANONICAL_ORIGIN),
    pubDate: post.date,
    content: post.html,
  }));

  const combined = [...items, ...postItems].sort((a, b) => timeOf(b.pubDate) - timeOf(a.pubDate));

  return rss({
    title: RSS_TITLE,
    description: RSS_DESCRIPTION,
    // The canonical origin, never the Pages variant's SITE_URL (SEAM-P7).
    site: CANONICAL_ORIGIN,
    items: combined,
    customData: "<language>en-us</language>",
  });
}
