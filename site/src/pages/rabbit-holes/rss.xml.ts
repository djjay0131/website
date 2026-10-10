// RABBIT HOLES — RSS 2.0, full content (D21). Public build only: the private
// build's srcDir has no such endpoint, so no feed can be emitted from dist-private.
import { getPublishedPosts } from "../../lib/rabbit-holes-collection";
import { CANONICAL_ORIGIN } from "../../lib/canonical-url.mjs";
import { renderRss } from "../../lib/rabbit-holes.mjs";

export async function GET() {
  const posts = await getPublishedPosts();
  return new Response(renderRss(posts, { origin: CANONICAL_ORIGIN }), {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
