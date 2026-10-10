// RABBIT HOLES — Atom 1.0, full content (D21). Public build only.
import { getPublishedPosts } from "../../lib/rabbit-holes-collection";
import { CANONICAL_ORIGIN } from "../../lib/canonical-url.mjs";
import { renderAtom } from "../../lib/rabbit-holes.mjs";

export async function GET() {
  const posts = await getPublishedPosts();
  return new Response(renderAtom(posts, { origin: CANONICAL_ORIGIN }), {
    headers: { "Content-Type": "application/atom+xml; charset=utf-8" },
  });
}
