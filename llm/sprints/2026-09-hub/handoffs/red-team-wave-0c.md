# Handoff — Red Team, Wave 0c (branding)

Stream: Red Team (adversary; authored no source, fixed nothing)
Wave: 0c — branding chrome and its derived outputs
Branch: `feat/branding` (PR #91)
Date: 2026-10-03
Contract: `llm/sprints/2026-09-hub/contracts/red-team-wave-0c.md`
Spec: `llm/specs/2026-10-01-branding-design.md`
ADR: `llm/governance/adr/0015-branding-no-portrait-band-and-mark-rule.md`

## Summary

Ran the 7 contract targets as **7 attacks / 11 cases** against fresh builds:
`npm run build:public` → `site/dist-public` (26 pages) and
`npm run build:private` → `site/dist-private` (5 pages, 4 private items),
both from a clean tree at `ec0dcb1`.

**Result: 0 BYPASS, 7 REFUSED, 1 sub-claim NOT VERIFIABLE.** No private
title or slug reached any public artifact; the portrait is absent from
`dist-public` by path and by byte; no sub-resource leaves the origin; the
Recent block and the research index are allowlist-driven; the footer's
Elsewhere accounts are the owner's; `/signin/` and the private output keep
their noindex.

One caveat, not a leak: the **"CV PDFs still embed the portrait"** half of
target 2 cannot be proven in this tree, because the synced `cv` payload is a
fixture whose PDFs are 607–620-byte text placeholders with no image at all.
The code change stops *staging* the photo into `public/` and does not touch PDF
bytes, so the property is preserved by construction, but it is **not
demonstrated here**.

All greps are against the built output. Working tree was clean before and
after; `git status --short` is empty. No file other than this handoff was
written.

## Results table

| # | Target | Attack | Verdict | Evidence |
|---|--------|--------|---------|----------|
| 1 | `og:image` / OG card | Force a private title into every `og:*`/`twitter:*` and into the card | **REFUSED** | all 26 pages `og:image=https://jason.cusati.us/og-card.png`; card is name+fixed title+affiliation; no private string in any HTML |
| 2 | Portrait | Find `photo_jason_1.jpeg` in `dist-public` paths/bytes or `build-info.json` | **REFUSED** (CV-embed sub-claim NOT VERIFIABLE) | no `.jpeg/.jpg/*photo*` in `dist-public`; no `photo_jason_1` byte match; CI `build-info.json` has no photo field; fixture PDFs embed no image |
| 3 | Self-hosting | Off-origin font/icon/image/CSS/script request | **REFUSED** | zero third-party hosts; all sub-resources root-relative; all `@font-face` under `/_astro/` |
| 4 | Recent block | Surface `anthropic-fellow` (manifest-public, not allowlisted) or a private item | **REFUSED** | Recent lists only kgis-docs + 3 allowlisted CVs; no `anthropic` anywhere in `dist-public` |
| 5 | Footer Elsewhere | Inject off-origin or wrong account; Bluesky/Mastodon confusion | **REFUSED** | X `djay0131`, Bluesky `djjay0131.bsky.social`, Mastodon `@djjay0131`, Scholar `nIp5xC0AAAAJ`, ORCID `0009-0001-7283-4050`; distinct hosts |
| 6 | `research/index.astro` | Surface a non-public project or an invented href | **REFUSED** | only `/research/soa-agentic-se/` (allowlisted) is a link; all others text; `project.public` filter in code |
| 7 | Print / noindex | Drop signin/private noindex or print hiding | **REFUSED** | `/signin/` `content="noindex"`; all 5 private pages `noindex, nofollow, noarchive`; print hides band/footer in both outputs |

## Transcripts

### A1 — Private title into the OG card / `og:*` · REFUSED

`og-card.mjs` reads only the owner name from `meta.yaml` and takes fixed
`title: "Research hub"` / `affiliation: "Virginia Tech"`; it never reads a
content item (`site/scripts/og-card.mjs:36-48,69-77`). `Base.astro` always
points `og:image` at `og-card.png` unless a page passes one, and no page does
(`site/src/layouts/Base.astro:48`). `ogCard()` is registered only in the public
output (`site/astro.config.mjs` integrations).

```
$ grep -rho 'og:image" content="[^"]*"' dist-public --include=*.html | sort -u
og:image" content="https://jason.cusati.us/og-card.png"
$ grep -rho 'twitter:image" content="[^"]*"' dist-public --include=*.html | sort -u
twitter:image" content="https://jason.cusati.us/og-card.png"

$ for p in "Programme Milestone Tracker" "Committee Dossier" "Internal Project Notes" \
           "committee-dossier" "internal-notes" "anthropic-fellow" "Fellowship CV"; do
    grep -rlF "$p" dist-public --include=*.html || echo "  NONE"; done
  NONE (all seven)
```

The card bytes carry no portrait: the SVG has no `<image>`, and the PNG has no
JPEG/EXIF signature.

```
$ cat public/og-card.svg
<svg ...><rect width="1200" height="630" fill="#861f41"/> ... <text ...>Fixture Person</text>
  <text ...>Research hub</text><text ...>Virginia Tech</text></svg>
$ python3 -c "d=open('dist-public/og-card.png','rb').read(); print('jpeg',b'\xff\xd8\xff' in d,'exif',b'Exif' in d)"
jpeg False exif False
```

False positive checked and cleared: `grep -l milestones dist-public` hits
`/research/soa-agentic-se/agentic-memory/sources/index.html`, where the word is
part of a public source-record title — `"tech-tree milestones up to 15.3x
faster than prior SOTA"` — not the private slug.

### A2 — Portrait in `dist-public` / `build-info.json` · REFUSED

Staging deletes any stale copy and stages nothing back
(`site/scripts/stage-public-assets.mjs:57,85-91`); the public build deletes a
stale portrait again at config setup (`site/scripts/public-build.mjs:77-83`);
`PUBLIC_PHOTO_PATH` is documented as delete-only (`site/src/lib/hub-content.mjs:92`).

```
$ find dist-public -iname '*photo*' -o -iname '*.jpeg' -o -iname '*.jpg'   # (no node_modules)
NONE
$ grep -rlF "photo_jason_1" dist-public
NONE
$ find . -name photo_jason_1.jpeg -not -path './node_modules/*'
./fixtures/content/sources/cv/cv-data/photo_jason_1.jpeg
./src/content/sources/cv/cv-data/photo_jason_1.jpeg      # synced payload, never public/
```

`build-info.json` is absent locally (CI writes it). The workflow writes exactly
five fields from `jq` — no photo path or bytes
(`.github/workflows/build.yml:1054-1061`): `content_fingerprint`,
`cv_fingerprint`, `content_source`, `built_from_sha`, `run_id`.

CV-embed sub-claim, **NOT VERIFIABLE**: the fixture PDFs are text placeholders
with no XObject/Image and no `/DCTDecode`:

```
$ ls -l dist-public/pdfs/
academic.pdf 607   research-professional.pdf 620   sde-long.pdf 607
$ grep -aoE '/Subtype ?/Image|/Filter ?/DCTDecode' dist-public/pdfs/*.pdf
(no output)
$ strings dist-public/pdfs/academic.pdf
%PDF-1.4 ... (Fixture CV placeholder: academic) ...
```

The real CVs are satellite payload the hub copies byte-for-byte, so the
embedding is unaffected by this change — but it cannot be shown in this repo.

### A3 — Off-origin sub-resource · REFUSED

Fonts come from `@fontsource` imports bundled under `/_astro/`
(`site/src/layouts/Base.astro:4-13`); icons are inline SVG in-repo
(`site/src/components/SiteIcon.astro`); `/signin/` bundles `firebase` from npm,
not a CDN (`site/src/pages/signin/index.astro:87-92`). The framed KGIS payload
references only a relative stylesheet.

```
$ grep -rIoE 'fonts\.googleapis|gstatic|cdnjs|jsdelivr|unpkg|googletagmanager|google-analytics' dist-public
(empty)
$ grep -rhoE '<(script|link|img|iframe|source|object|embed)[^>]*(src|href)="https?://[^"]*"' dist-public --include=*.html \
  | grep -v 'rel="canonical"'
(empty — every non-canonical sub-resource is root-relative: /_astro/, /favicon.svg)
$ grep -rhoE 'url\([^)]*https?://[^)]*\)' dist-public --include=*.css
(empty — all @font-face src are /_astro/*.woff2|woff)
$ grep -rhoE '(href|src)="[^"]*"' dist-public/_payload
href="assets/style.css"
$ grep -rIoE 'fonts\.googleapis|gstatic|cdnjs|jsdelivr|unpkg' dist-private
(empty)
```

The only `https://` references in the public output are outbound `<a href>`
anchors (Consensus, GitHub, Scholar, ORCID, X, Bluesky, Mastodon, LinkedIn) and
`rel="canonical"` to the site's own origin — none is a fetch.

### A4 — Recent block effective visibility · REFUSED

The loader stores only effectively-public items in the public build
(`site/src/content.config.ts:424-436`), and the home page filters on
`effective_visibility === "public"` (`site/src/pages/index.astro:25-32`).

```
$ python3 - (extract #recent from dist-public/index.html)
2026-10-01  KGIS Documentation (fixture)            -> /projects/kgis/kgis-docs/
2026-09-16  Academic CV (fixture)                   -> /cv/academic
2026-09-16  Research Professional CV (fixture)      -> /cv/research-professional
2026-09-16  Software Engineering CV (fixture)       -> /cv/sde-long
$ grep -rlF anthropic dist-public ; echo $?
(no match, exit 1)
$ grep -oE 'href="/cv/[^"]*"' dist-public/cv/index.html | sort -u
/cv/  /cv/academic  /cv/research-professional  /cv/sde-long
```

`cv/anthropic-fellow` is `visibility: public` in its manifest but is **not**
named in `site/publish-allowlist.json`, so `effectiveVisibility` returns
`private` (`site/src/lib/hub-content.mjs:479-482`); it is absent from Recent,
`/cv/`, the sitemap and every public byte, and present only in `dist-private`
(receipt: `cv/anthropic-fellow`). The tenet cards are portfolio-driven, not
manifest-driven, and their only href is the allowlisted hub route
`/research/soa-agentic-se/`; project names with no href render as text.

### A5 — Footer Elsewhere · REFUSED

`resolveElsewhere` maps handles from `meta.contact` and drops a template whose
handle is absent (`site/src/lib/footer.mjs:47-56`); fixed entries are used
verbatim from `site/src/data/footer.json`.

```
$ (extract <footer> hrefs from dist-public/index.html)
GitHub         https://github.com/fixture-person          # from cv-data meta.contact (fixture value)
LinkedIn       https://www.linkedin.com/in/fixture-person # from cv-data meta.contact (fixture value)
Google Scholar https://scholar.google.com/citations?user=nIp5xC0AAAAJ
ORCID          https://orcid.org/0009-0001-7283-4050
X              https://x.com/djay0131
Bluesky        https://bsky.app/profile/djjay0131.bsky.social
Mastodon       https://mastodon.social/@djjay0131
```

No off-origin or wrong account could be injected: the handles are not literals
in the component. X is `djay0131` (one `j`), matching the contract; Bluesky is
host `bsky.app` / handle `djjay0131.bsky.social`; Mastodon (D15, added after
this contract) is host `mastodon.social` / handle `@djjay0131` — a distinct
account and host, so there is no Bluesky/Mastodon confusion. GitHub/LinkedIn
read as fixture values because the synced CV is a fixture; in production they
come from the same `meta.contact` path.

### A6 — `research/index.astro` public-only · REFUSED

`site/src/pages/research/index.astro:12-21` flat-maps only
`project.public` and emits an href only when the project has one.

```
$ (extract links from dist-public/research/index.html)
/research/soa-agentic-se/ => State of the Art in Agentic Software Engineering
# all other projects appear as text; only one project in the file has a non-null href
$ grep -c 'anthropic\|milestone\|dossier\|internal' dist-public/research/index.html
0
```

Every portfolio project is `public: true` in the current file, so no real
non-public row exists to surface; the filter is present and positive in code.
`href: null` projects (Research.AI, Baseball.AI, …) render as plain text, so no
404 href can be invented.

### A7 — Print / noindex · REFUSED

```
$ grep -oE '<meta name="robots"[^>]*>' dist-public/signin/index.html
<meta name="robots" content="noindex">
$ grep -rhoE '<meta name="robots"[^>]*>' dist-private --include=*.html | sort | uniq -c
      5 <meta name="robots" content="noindex, nofollow, noarchive">
$ grep -rc 'og:image\|og:title' dist-private --include=*.html | grep -v ':0'
NONE
$ grep -o '@media print{...site-band,.site-footer,.skip-link{display:none}...}' dist-public/_astro/Base.*.css
@media print{.site-band,.site-footer,.skip-link{display:none}...}
$ (dist-private/_astro/private-content.*.css)  site-band,.site-footer,.skip-link{display:none}
```

`noindex` is passed at `site/src/pages/signin/index.astro:49`; the private
layout hard-codes its triple directive at
`site/src-private/layouts/PrivateBase.astro:75`; print hiding is in
`Base.astro:238-243` and `PrivateBase.astro:242-246`. `/signin/` and `/phd/`
are excluded from the sitemap; no private title appears in `sitemap-*.xml` or
`robots.txt`.

## Observations (not bypasses)

- **Six public pages carry `noindex`**, not one: `/signin/` plus `/phd/` and the
  four legacy `/research/agentic-harnesses/**` routes. None is in the sitemap.
  This is broader than the contract's "`/signin/` keeps noindex" but is not a
  spec violation — worth a one-line confirmation by the reviewer that `/phd/`
  and the legacy research routes are meant to be unindexed.
- `dist-private` also contains `og-card.png`/`og-card.svg`, copied verbatim
  from `site/public/` by both builds. Same-origin, no portrait, no private
  title, and no private page references it — harmless.

## Not attempted / scope notes

- **Proving the real CV PDFs embed the portrait** (target 2): not possible from
  the fixture tree; recorded above as NOT VERIFIABLE.
- **Live/hosted behaviour** (gate, bucket, Firebase Hosting): out of scope for
  this contract, which is build-output only.
- **Contrast, a11y, token tests**: other Wave 0c streams.

## Exit

All 7 targets attacked, **0 BYPASS**. One sub-claim (CV PDF embed) is not
provable with the fixture payload; flagged for the reviewer. No *Fix now*
item.
