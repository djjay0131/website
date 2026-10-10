# Contract — site-wave-8: Rabbit Holes (D21)

- **Wave:** 8 · **Scenario:** `hub-008` · **Level:** L2
- **Design authority:** owner decision **D21** (2026-10-10); **ADR-0023**
- **Branch:** `feat/rabbit-holes`
- **Stream:** site only. No `infra/`, `gate/` or `contract/` change.

## Scope

Build the public blog **Rabbit Holes** exactly as D21 specifies:

1. Markdown content collection `site/src/content/rabbit-holes/<yyyy-mm-dd>-<slug>.md`
   with a strict Zod schema; `draft` defaults **true**; free-form tags.
2. Pages: index (paginated at 20), post page (Astro markdown, prev/next, share,
   subscribe, annotation mount), tag pages, archive by month.
3. Feeds: `/rabbit-holes/rss.xml`, `/rabbit-holes/atom.xml`,
   `/rabbit-holes/feed.json` (full content) and the public
   `/rabbit-holes/index.json`; the site-wide `/rss.xml` also carries the posts.
4. Per-post OG image (reuse the Wave 5 generator); Pagefind; sitemap;
   `fediverse:creator` meta.
5. Buttondown subscribe form gated on `PUBLIC_BUTTONDOWN_USERNAME`, RSS fallback
   when unset.
6. Nav "Writing" → "Rabbit Holes" (`/writing/` redirects); footer feed icon; home
   "Latest rabbit hole" card.
7. Leak check gains each draft's needles; tests for the schema, the three feeds
   and draft absence.
8. Seed post "Why a blog called Rabbit Holes" committed as a **draft**.

## Security targets (Security Tester)

1. **Draft leakage** — a `draft: true` post reaches no page, feed, sitemap,
   search index or OG image; the leak check is non-vacuous on a normal build.
2. **HTML injection via Markdown / frontmatter** — a post body or frontmatter
   value cannot inject script into the public output (Astro escapes body text;
   `title`/`summary`/`tags` are escaped in HTML and XML).
3. **One external endpoint** — the Buttondown form's action URL is the only
   off-origin endpoint in the subscribe block; no JS SDK, no tracking pixel.
4. **Feed and OG paths** — no private item and no draft appears in any feed or
   OG image; the OG generator writes into the output only (never committed).
5. **Boundary unchanged** — the private build emits no Rabbit Holes route, no
   feed and no OG; `dist-public` cleanliness holds.

## Out of scope

Comments (recorded as an open question); `hero` optimisation via `astro:image`;
any `rabbit-holes` branch/GitHub-App publishing (waits on D19's App).
