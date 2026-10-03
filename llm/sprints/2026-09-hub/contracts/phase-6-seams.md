# Wave 5 seams — Phase 6 (search, feed, OG, redirects, Pages retirement)

Status: Active
Issued: 2026-10-03
Owner: Lead Architect
Issue: `hub-006`
Branch: `feat/phase-6`

Design authority: design doc §11 Phase 6; ADR-0005 (derived outputs are public-only);
ADR-0020 (Pages retirement with redirect stubs); roadmap `phase-6-polish`;
completion brief §4 Wave 5.

## SEAM-P1 — Everything derived is built from `dist-public` only

Pagefind indexes `site/dist-public` after `npm run build`; the RSS feed and any OG
card enumerate only effectively-public items; the sitemap already filters. No
derived artifact may read `dist-private` or the full collection in a private
build. A private build must not emit Pagefind/RSS at all.

## SEAM-P2 — Search (Pagefind)

`pagefind` runs over `dist-public` in **both** the `build` (Pages variant) and
`build-firebase` variants, after the Astro build and **before** the leak check and
artifact upload. Output lands at `site/dist-public/pagefind/`. A small search UI
(a search input + results host) is added as a public page; it must be a public
route and must not be emitted in the private build. The `pagefind` npm package is
added as a dev dependency; its install is a supply-chain decision recorded with
the version and a lockfile entry.

## SEAM-P3 — RSS

`@astrojs/rss` is added; `site/src/pages/rss.xml.ts` emits a feed of the
effectively-public manifest items (from `collectPublicItems`) with absolute
canonical URLs and a `pubDate` (an item with no `date` is skipped or dated from
the feed build; record which). The footer's null `RSS` link (public layout only)
points at `/rss.xml`. The feed is public-only by construction.

## SEAM-P4 — OG images

The existing single `og-card.png` (ADR-0015: no portrait, no private title) is the
site `og:image`; private pages carry no OG tags (`PrivateBase.astro`). Phase 6
adds no per-item OG image unless it can be generated public-only; the acceptance
is "no OG image exists for a private item and none shows a private title", which
the current structure already satisfies. Record it as satisfied by construction
plus a test, not by a new binary pipeline.

## SEAM-P5 — Redirect stubs and `404.html` (ADR-0020)

A generator produces, from `site/redirects/github-pages.json`, one meta-refresh
stub per entry and a `404.html`, into a dedicated stubs directory (e.g.
`site/dist-redirects/`). The `deploy` job uploads **only** that directory to
GitHub Pages; the `build` job stops uploading `dist-public` to Pages. `404.html`
is also emitted into `dist-public` so Firebase Hosting serves it. Every stub
forwards to `https://jason.cusati.us/<to>`.

## SEAM-P6 — Leak check covers the derived outputs

`check-no-private-in-public` already walks every file under `dist-public`; Wave 5
extends it so the sitemap, `rss.xml`, the Pagefind text files (`pagefind-entry.json`
and any JSON/JS) and the OG card are explicitly named and covered, and documents
the binary limit for `.pf_*` fragments and PNG OG bytes. `demo:leak-check` is
extended to plant a private needle into each derived output and show the check
red. `redirects:check` is wired into CI.

## SEAM-P7 — URLs

Pagefind's derived URLs, the RSS item links, and the redirect targets all use the
canonical `https://jason.cusati.us/` with trailing slashes (`firebase.json`
`trailingSlash: true`). The Pages variant builds stubs only, so its `SITE_BASE`
no longer affects site URLs.
