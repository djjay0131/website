// The Rabbit Holes collection, normalised for pages and feeds (D21, Wave 8).
//
// The content collection (`src/content.config.ts`) validates every post and
// renders its Markdown; this module is the single place the PUBLISHED set is
// computed and shaped. It lives in a `.ts` that imports `astro:content`, so it is
// used by pages and endpoints only — the plain `.mjs` modules and the leak check
// read the files directly through `readRabbitHoles` for the same rules.
import { getCollection } from "astro:content";
import { sortPostsNewestFirst } from "./rabbit-holes.mjs";

/**
 * Every published (non-draft) post, newest first.
 *
 * `draft: true` posts are filtered out HERE, and only here, so no page, feed or
 * index can forget the rule. A draft that is also filtered out of getStaticPaths
 * is therefore unreachable at every level: no route, no list, no feed entry.
 */
export async function getPublishedPosts() {
  const entries = await getCollection("rabbit-holes", ({ data }) => data.draft !== true);
  return sortPostsNewestFirst(
    entries.map((entry) => ({
      id: entry.id,
      slug: entry.id,
      title: entry.data.title,
      date: entry.data.date,
      summary: entry.data.summary,
      tags: entry.data.tags ?? [],
      draft: false,
      hero: entry.data.hero,
      canonical: entry.data.canonical,
      sources: entry.data.sources,
      body: entry.body ?? "",
      // Astro's content layer keeps the rendered HTML on the entry; the
      // full-content feeds use it so a feed item and the page carry the same
      // bytes. No image-import rewriting is needed (posts use public paths).
      html: entry.rendered?.html ?? "",
      entry,
    })),
  );
}

/** A single published post by slug, or undefined. */
export async function getPublishedPost(slug) {
  const posts = await getPublishedPosts();
  return posts.find((post) => post.slug === slug);
}
