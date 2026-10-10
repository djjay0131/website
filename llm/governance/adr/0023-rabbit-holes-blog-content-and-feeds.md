# ADR-0023: Rabbit Holes — the blog content model, feeds and subscription

Status: Accepted
Date: 2026-10-10

## Context

Owner decision **D21** (2026-10-10) adds a public blog, **Rabbit Holes**, at
`/rabbit-holes/`. It is the first content on the hub that is authored **in this
repository** rather than published by a satellite, and the first that is public
with no gate involvement at all. The design has to settle three things the
existing system does not:

1. **Where the content lives and how it is validated.** Every other public item
   arrives through the manifest contract from an untrusted satellite (ADR-0007,
   ADR-0016). A blog post is the owner's own Markdown in `website`; it needs a
   schema, a draft state, and a rule that a draft reaches nothing public.
2. **How people subscribe.** The owner wants RSS **and** email. The owner is not
   yet ready to create a newsletter account, so the build must be green before
   that account exists.
3. **A stable index for an operator tool.** The owner's assistant emails topic
   suggestions weekly; the site must expose a machine-readable post index so it
   can avoid repeats and link to prior posts.

D21 fixes the decisions; this ADR records them durably, as the sprint requires
for an owner decision of this size.

## Decision

### 1. Content model — a Zod-validated Astro content collection, drafts by default

Posts are committed Markdown at
`site/src/content/rabbit-holes/<yyyy-mm-dd>-<slug>.md`. The file's `id`/slug is
the filename with its `YYYY-MM-DD-` prefix removed
(`2026-10-10-why-a-blog-called-rabbit-holes.md` →
`/rabbit-holes/why-a-blog-called-rabbit-holes/`). The frontmatter schema
(`rabbitHolesSchema` in `site/src/content.config.ts`) is:

| Field | Rule |
|---|---|
| `title` | required, 1–200 chars |
| `date` | required; coerced to a Date; an unparseable value fails the build |
| `summary` | required, 1–280 chars (feed and OG) |
| `tags` | `string[]`, default `[]`; **free-form** — no pattern, no taxonomy |
| `draft` | boolean, **default `true`** |
| `hero` | optional image path |
| `canonical` | optional absolute URL (overrides the post's canonical link) |
| `sources` | optional `{title,url}[]` |

The schema is **strict**: an unknown field fails the build, exactly as the
manifest mirror does (ADR-0009). **`draft` defaults to true**, so a new file is
invisible until a reviewed pull request flips it — the same "publishing is a
small visible diff" discipline as the publish allowlist (ADR-0016) and the
`notes` branch (D18).

**Topics are random by design.** There is no category enum, no `primary_topic`,
and no tag whitelist. A tag earns a URL by slugifying its spelling; two spellings
that slugify the same share one page. This is deliberate and is not to be
"fixed" into a taxonomy.

### 2. Public by construction; drafts are a leak-check needle

A post with `draft: false` is public. There is no gate, no allowlist and no
`visibility` field. Every page, feed, the sitemap, Pagefind, the OG generator and
the home-page card filter on `draft`. The leak check
(`scripts/check-no-private-in-public.mjs`) is given each **draft's** route, slug,
title and summary as needles (`collectDraftRabbitHoles`), so a draft that reaches
`dist-public` — in a page, a feed, the sitemap, the search index or an OG image —
fails the build. This makes the leak check **non-vacuous on a normal build**,
where the satellite private set may be empty.

### 3. Feeds — three public formats with full content

`/rabbit-holes/rss.xml` (RSS 2.0, full content in `<content:encoded>`),
`/rabbit-holes/atom.xml` (Atom 1.0, `<content type="html">`) and
`/rabbit-holes/feed.json` (JSON Feed 1.1, `content_html`), all rendered by
`src/lib/rabbit-holes.mjs` and linked with `<link rel="alternate">` discovery
tags in the base layout. The site-wide `/rss.xml` **also** carries the posts,
with full content. Feeds are public-build only: the endpoints live under
`src/pages/`, so the private build (srcDir `src-private`) cannot emit one.

### 4. Subscription — Buttondown by RSS-to-email, config-gated

Email subscription is Buttondown's RSS-to-email, rendered from a single
build-time value, `PUBLIC_BUTTONDOWN_USERNAME`. The site ships a **static HTML
form** that POSTs to
`https://buttondown.email/api/emails/embed-subscribe/<username>` — **no
JavaScript SDK and no tracking pixel**, and that action URL is the only external
endpoint in the block. When the value is unset, the block renders a plain
"Subscribe by RSS" line instead, so the build is green before the owner creates
the account. The owner sets the value as a repository **variable** (never a
hand-edited file, the D19 pattern).

### 5. The public JSON index

`/rabbit-holes/index.json` is a stable, public list of
`{slug,title,date,tags,summary,url}` for every published post. It exists for the
owner's weekly topic suggester, which reads it to avoid repeats and link to prior
posts. The weekly suggestion itself is an operator task, **not** a site feature.

### 6. Presentation and interaction

- Pages: index (newest first, summary/date/tags/reading time, pagination at 20
  under `/rabbit-holes/page/<n>/`), one post page (Markdown via Astro's pipeline
  — Shiki code blocks and GFM footnotes — typography matched to the research
  pages, prev/next, Subscribe block, share links to Bluesky/Mastodon/X and a
  first-party Copy-link button), tag pages (`/rabbit-holes/tags/<tag>/`), a tag
  list, and a month archive (`/rabbit-holes/archive/`).
- Per-post OG image, reusing the Wave 5 generator (`scripts/og-card.mjs`,
  `renderRabbitHoleOgSvg`), written at build time into the output only — never
  into a committed tree, so a draft slug can never name an OG file.
- Pagefind indexes the post pages (built over `dist-public`, as for every public
  page); the sitemap includes them by construction (ADR-0020's exclusion list is
  unchanged).
- `<meta name="fediverse:creator" content="@djjay0131@mastodon.social">`.
- The D20 annotation island mounts on post pages like any public item, with
  `source=hub` and slug `rabbit-holes/<slug>` — derived from the route by
  `hubItemIdentity`, the same pseudo-source the publish allowlist uses for
  first-party pages (ADR-0016).
- The old **Writing** navigation slot becomes Rabbit Holes; `/writing/` is kept
  as a redirect to `/rabbit-holes/`.

### 7. Comments

None. Recorded as an open question (Mastodon-thread comments vs. none), not
built.

## Rationale

The manifest contract exists to make an **untrusted** satellite's content safe
(ADR-0016, design doc §12.3). The owner's own Markdown is not that: it is
reviewed in the same pull request that merges it, so the allowlist machinery
would add ceremony without adding trust. What the blog does need from the
existing system is the part that generalises: a schema that fails the build, a
**draft** that is private by default, and the leak check — which is why drafts
are given needles rather than left to a convention. Reusing the leak check the
satellites use, and the OG generator Wave 5 built, keeps one guard and one
generator rather than two of each.

Making the subscription config-gated is what lets the change merge and deploy
before the owner has a Buttondown account, and keeps a single external endpoint
that a reviewer can see.

## Alternatives Considered

### Publish posts through the satellite manifest contract

Rejected. It would require a new satellite repository for the owner's own notes,
reintroduce the trust direction D8 removed, and make "publish a post" a
bucket-and-manifest operation for content that lives in this repo.

### Gate Rabbit Holes behind the private area

Rejected by D21: the blog is public, with no sign-in. The research/private
material stays behind the gate; the blog does not.

### Summaries-only feeds

Rejected by D21: feeds carry **full content**, so a reader can read a post
without visiting the site.

### A JavaScript subscribe widget (Buttondown SDK or an embedded iframe)

Rejected. A static form is fewer moving parts, works without JavaScript, ships no
third-party script and no tracking pixel, and leaves exactly one external URL to
review.

### A category/`primary_topic` field

Rejected by D21: the topics wander by design. Tags are free-form and a tag's URL
is derived, not declared.

## Consequences

### Positive

- A published post reaches the index, feeds, sitemap, search and OG images with
  no per-item allowlist step and no satellite.
- A draft reaches nothing, and the leak check proves it rather than trusting a
  filter — on every build, even with no private satellite item.
- The build is green with no Buttondown account; enabling email is one repository
  variable.
- The weekly topic suggester has a stable public index to read.

### Negative / Tradeoffs

- A second content collection and a second, blog-specific schema beside the
  manifest mirror. They are separate on purpose (different trust and lifecycle),
  but both must be maintained.
- Feeds carry full content, so a reader's feed client holds a copy of every post.
  This is D21's explicit choice.
- The unrelated `/writing/` route now redirects; the legacy redirect map keeps a
  `/website/writing/` entry that two-hops through it (harmless).

### Risks

- **A draft leaking into a derived output.** Mitigated by the leak-check draft
  needles; a future derived output must be added to the leak check's walk (it
  walks all of `dist-public`, so derived outputs are covered by construction).
- **The Buttondown username is a build-time value.** A typo silently renders a
  broken form; there is no runtime check. Acceptable — the value is the owner's,
  set once, and the security-relevant property (one external endpoint) holds
  regardless of the username.
- **`og:image` for a post uses the Pages-variant `SITE_URL`.** As with every
  existing page, the Pages mirror is retired (ADR-0020), so only the canonical
  origin's URL is served.

## Impacted Areas

- [x] Product
- [ ] Domain model
- [ ] Data architecture
- [ ] AI architecture
- [ ] Domain-specific systems (see governance delta)
- [x] Integrations
- [x] UX
- [x] Security/privacy
- [x] Implementation
- [x] Documentation

## Related Documents

- `llm/sprints/2026-09-hub/STATE.md` — §D21 and §Wave 8
- `site/src/content.config.ts` — `rabbitHolesSchema`, the collection
- `site/src/lib/rabbit-holes.mjs` — the one declaration of rules, feeds and index
- `site/scripts/check-no-private-in-public.mjs` — `collectDraftRabbitHoles`
- `site/scripts/og-card.mjs` — `renderRabbitHoleOgSvg`, `rabbitHolesOg`
- ADR-0005 (two-output build with leak check), ADR-0016 (private by default),
  ADR-0020 (Pages retirement), ADR-0021 (annotations), ADR-0022 (export transport)

## Related Issues / PRs

- D21 — the owner decision this ADR records
- The Wave 8 pull request

## Supersedes

None. It adds a content model beside the manifest contract; it amends no existing
ADR.

## Superseded By

None.
