// RABBIT HOLES — JSON Feed 1.1, full content (D21). Public build only.
import { getPublishedPosts } from "../../lib/rabbit-holes-collection";
import { CANONICAL_ORIGIN } from "../../lib/canonical-url.mjs";
import { renderJsonFeed } from "../../lib/rabbit-holes.mjs";

export async function GET() {
  const posts = await getPublishedPosts();
  return new Response(renderJsonFeed(posts, { origin: CANONICAL_ORIGIN }), {
    headers: { "Content-Type": "application/feed+json; charset=utf-8" },
  });
}
