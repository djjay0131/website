// RABBIT HOLES — the public JSON index (D21 decision 4). A stable list of
// {slug,title,date,tags,summary,url} that the owner's weekly topic suggester
// reads to avoid repeats and link to prior posts. Public build only.
import { getPublishedPosts } from "../../lib/rabbit-holes-collection";
import { CANONICAL_ORIGIN } from "../../lib/canonical-url.mjs";
import { renderIndexJson } from "../../lib/rabbit-holes.mjs";

export async function GET() {
  const posts = await getPublishedPosts();
  return new Response(renderIndexJson(posts, { origin: CANONICAL_ORIGIN }), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
