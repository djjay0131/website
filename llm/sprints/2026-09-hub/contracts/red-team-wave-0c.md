# Contract — Red Team, Wave 0c (branding)

Status: Issued
Date: 2026-10-02
Stream: Red Team (adversary; authors no source, fixes nothing)
Branch: `feat/branding` (PR #91)
Handoff: `llm/sprints/2026-09-hub/handoffs/red-team-wave-0c.md`

## Purpose

Attack the new chrome and its derived outputs. Wave 0c must not (a) put a
private title or the portrait anywhere public, or (b) introduce an off-origin
request. The Wave 0b allowlist is a hard constraint this wave must not weaken.

## Targets

1. **`og:image` / OG card.** Build the public output and prove the OG card and
   every `og:*`/`twitter:*` tag carry no private title or slug, and no portrait.
   Try to make a private item's title reach the card.
2. **Portrait.** Prove `photo_jason_1.jpeg` is absent from `dist-public` (paths
   and bytes) and from `build-info.json`; prove the CV PDFs still embed it.
3. **Self-hosting / network.** Prove no request leaves the origin: fonts, icons,
   images, CSS all under the origin. Grep the built output for `http(s)://`
   sub-resource references to third parties (fonts.googleapis, gstatic, CDNs).
4. **Recent block.** The home page's Recent must consume effective (allowlisted)
   visibility; try to surface a non-allowlisted item in it or in a tenet link.
5. **Footer Elsewhere.** The profile links must be the owner's (X `djay0131`,
   Bluesky `djjay0131.bsky.social`, Scholar id, ORCID); try to inject an
   off-origin or wrong account. No Bluesky/Mastodon confusion.
6. **`research/index.astro`** must list only `public` projects; try to surface a
   non-public project or an invented href.
7. **Print / noindex.** `/signin/` keeps noindex; the private output keeps its
   `noindex, nofollow`.

## Rules

- Read-only; your only write is your handoff. No git/cloud mutation. You may
  build public/private and grep the output.
- ≥5 attacks with transcripts; REFUSED (cite code/artifact) or BYPASS.

## Exit

≥5 attacks; a BYPASS is *Fix now*. Name anything not attempted and why.
