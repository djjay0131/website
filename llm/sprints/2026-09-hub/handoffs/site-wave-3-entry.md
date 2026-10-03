# Handoff — `site`, Wave 3 follow-up 2 (the `entry` fix for non-HTML items)

Status: Delivered (not committed)
Date: 2026-10-03
Stream: `site` (`site/**`)
Issue: `hub-004`
Branch: `feat/sharing`
Contract: `llm/sprints/2026-09-hub/contracts/site-wave-3.md`, Addendum (requirements 8, 8b)
Seams: `llm/sprints/2026-09-hub/contracts/phase-4-seams.md` SEAM-S1
("Amended again 2026-10-03", the row now carries `entry`)

## Summary

The item-scoped share copy no longer renames its entry to `index.html`. The
private build stages the item's document **under its own basename**, and the
share row carries that basename as `entry` so the gate serves it with the
content type its extension names. The Shares page now supplies the island the
list of effectively-private items (`{section, source, slug, entry, title}`), the
mint form selects a real item instead of a free-text triple, and `POST /share`
carries `{section, source, slug, entry, expires_in_days}`.

This removes the live defect the D1 handoff recorded as a risk: a private PDF
(`cv/anthropic-fellow`, effectively private in the fixture) was staged as
`_doc/index.html` and would have been served as `text/html` over PDF bytes.

For the phd fixture the built share tree is now:

```
dist-private/phd/phd-milestones/committee-dossier/_doc/committee.html       # from site/committee.html
dist-private/phd/phd-milestones/committee-dossier/_doc/assets/style.css     # the shared asset
dist-private/phd/phd-milestones/milestones/_doc/index.html                  # from site/index.html (basename is index.html)
dist-private/phd/phd-milestones/milestones/_doc/assets/style.css
dist-private/projects/phd-milestones/internal-notes/_doc/internal.html      # from site/internal.html
dist-private/projects/phd-milestones/internal-notes/_doc/assets/style.css
dist-private/cv/cv/anthropic-fellow/_doc/anthropic-fellow.pdf               # from anthropic-fellow.pdf
```

`committee-dossier` has **no** `_doc/index.html`; `anthropic-fellow` has **no**
`_doc/index.html`. The member frame
(`phd/phd-milestones/committee-dossier/index.html`) and `_payload/…` staging are
unchanged.

## What changed

All changes are under `site/**`; `gate/**`, `infra/**`, `firebase.json` and the
contracts were not touched. The gate side of SEAM-S1 was already in the working
tree: `POST /share` reads `entry` (`_share_entry`, defaulting absent to
`index.html`, refusing a present-but-unsafe value) and `GET /s/{token}/` serves
`share.entry`; this stream makes the client send it.

- **`site/src/lib/frame-content.mjs`** — `docStagingPlanFor` now copies the
  item's own document to `<treeRoot>/<basename(rel)>` instead of
  `<treeRoot>/index.html`. Assets/non-document handling is byte-for-byte
  unchanged. The `SHARE_DOC_ROOT` and `docStagingPlanFor` comments were
  corrected to state the basename and why (content-type mangling).
- **`site/src-private/pages/shares.astro`** — builds `shareableItems` =
  effectively-private, non-`data` collection entries mapped to
  `{section, source, slug, entry: path.posix.basename(item.path), title}`, and
  passes it as `<SharesIsland items={shareableItems} client:load />`. The lede
  now says "choose an item"; the CSS styles `select` beside `input`.
- **`site/src-private/lib/shares.mjs`** — `validateMintInput` takes a required
  `entry` validated by a new `isSafeEntry` (non-empty, no leading slash, no
  backslash, no empty/`.`/`..` segment, every segment matching the gate's
  `[A-Za-z0-9._-]` allowlist; multi-segment allowed). `shareMintRequestInit`
  emits `{section, source, slug, entry, expires_in_days}`. The local
  `ENTRY_SEGMENT_PATTERN` deliberately mirrors `gate/app/serve.py`'s `_SEGMENT`
  instead of importing `GATE_SEGMENT_PATTERN` from `frame-content.mjs`, because
  that module reaches `node:fs` and this one is bundled into the browser island.
- **`site/src-private/components/SharesIsland.tsx`** — the free-text
  section/source/slug inputs are replaced by a `<select>` of the passed items; on
  submit it sends the selected item's triple **plus `entry`**. Empty item list
  renders a note instead of a form. The 403 non-owner branch, the retained-token
  revoke and the paste-a-link revoke are untouched.
- **Tests** —
  - `site/src-private/lib/private-content.test.ts`: the `docStagingPlanFor`
    assertions now expect `committee.html`, `a.html` and `academic.pdf`; a new
    case pins that no `_doc/index.html` is produced for the dossier.
  - `site/scripts/private-build.test.ts`: asserts the built tree contains
    `committee-dossier/_doc/committee.html` with `assets/style.css` beside it and
    **not** `_doc/index.html`, and `cv/cv/anthropic-fellow/_doc/anthropic-fellow.pdf`
    (not `index.html`, not a sibling CV); the receipt assertion follows.
  - `site/src-private/lib/shares.test.ts`: the exact-body test now asserts the
    five keys `{section, source, slug, entry, expires_in_days}` (both the
    serialised object and the parsed `Object.keys`), a new validator block
    covers required/unsafe/multi-segment `entry`, and every `mintShare` /
    `validateMintInput` input carries an `entry`. The page-binding test asserts
    the page computes `path.posix.basename(item.path)` and passes
    `items={shareableItems}`.

## Evidence (exact commands / counts)

All from `site/` on `feat/sharing`, working tree:

```
$ npm test
 Test Files  26 passed (26)
      Tests  352 passed | 1 skipped (353)      # was 348 passed | 1 skipped (349) after D1

$ npm run build:private
[hub-private-build] staged 5 payload file(s) for 4 private item(s) from their containing directories
[hub-private-build] staged 7 item-scoped _doc file(s) for 4 private item(s) (the share-servable copy)
[hub-private-build] checked 100 emitted path(s) against the gate's allowlist (SD-7)
[hub-private-build] wrote .hub-private-build.json: 4 private item(s), 100 file(s).
[build] 6 page(s) built in 1.18s
# receipt: privateItemCount 4, payloadFileCount 5, docFileCount 7, fileCount 100

$ find dist-private -path '*_doc*' -type f | sort
dist-private/cv/cv/anthropic-fellow/_doc/anthropic-fellow.pdf
dist-private/phd/phd-milestones/committee-dossier/_doc/assets/style.css
dist-private/phd/phd-milestones/committee-dossier/_doc/committee.html
dist-private/phd/phd-milestones/milestones/_doc/assets/style.css
dist-private/phd/phd-milestones/milestones/_doc/index.html
dist-private/projects/phd-milestones/internal-notes/_doc/assets/style.css
dist-private/projects/phd-milestones/internal-notes/_doc/internal.html

$ npm run check:private-links
check:private-links: PASS — every link in 12 page(s) resolves under /p/: no off-origin
SUB-RESOURCE, none escaping the base, and each points at a file that exists.
130 outbound anchor(s) allowed (navigation, not a fetch).
# was 13 pages; the cv item is now anthropic-fellow.pdf, not a scanned .html

$ npm run check:no-private-in-public
check:no-private-in-public: PASS — no private slug, source, route, payload path, title
or summary appears in any path or any file's contents under dist-public (162 files scanned).

$ npm run check:publish-allowlist
check:publish-allowlist: PASS (mode pr) — 14 entries, 0 conflicts, 0 stale.

$ npm run build:public
[hub-public-build] staged 3 payload file(s) for 1 public framed item(s)
[build] 26 page(s) built in 1.85s      # unchanged

$ node ~/code/agentic-governance/plugin/scripts/governance-checks.mjs --layout
PASS governance-links / adr-index / adr-status / layout
4 of 4 checks passed, 0 failed.
```

Extra: `find dist-public -path '*_doc*'` and `find dist-public -path '*shares*'`
both return 0; `dist-public/_payload` still holds the same 3 kgis member files;
the built `dist-private/shares/index.html` `astro-island` prop carries `entry`
values (`committee.html`, `internal.html`, `index.html`, `anthropic-fellow.pdf`).

## Assumptions

- `entry` is `basename(item.path)` because the staging plan copies the entry to
  the tree root under that basename. `item.path` is a manifest path (posix `/`),
  so `path.posix.basename` is used rather than `path.basename`.
- The page's item filter and `docStagingPlanFor`'s item set are the same by
  construction: both are "effectively private and not `format: data`", read from
  the same collection / the same manifests.
- `isSafeEntry` mirrors the gate's `safe_prefix` (`gate/app/serve.py`). It may be
  slightly stricter only in ways the schema already guarantees; the server stays
  the authority.
- The private build was run against the local synced tree (which carries
  `phd-milestones`); the fixture tree is byte-identical for it, and the
  build-level test drives the fixture so it does not depend on the synced tree.

## Risks

- **Bundle items with a trailing-slash `path`.** `docStagingPlanFor` skips a
  `path` ending in `/` (no document to stage), but the page would compute
  `basename("dir/") === "dir"` and offer it. No such item exists today (a bundle
  is a built app folder whose entry is an `index.html` file; only the `data`
  format uses a trailing slash, and the page excludes `data`). Recorded, not
  fixed: the contract defines `entry` as `basename(path)`.
- **Client/server validator drift.** The entry pattern is duplicated in
  `shares.mjs` to keep `node:fs` out of the browser bundle. If the gate's
  allowlist changes, both must move; the server refuses an unsafe `entry`
  regardless, so the failure closed.
- **Remove of free-text.** The island can no longer mint for an item absent from
  the passed list. That is intended (the contract says the owner selects a real
  item); if the list were ever empty the form is not drawn.

## Open questions / doubts

- **Contract addendum requirement 11 is stale.** It still says "entry renamed"
  and asserts the build contains `_doc/index.html`; requirement 8 and 8b and the
  SEAM-S1 "Amended again" paragraph say the opposite (basename + `entry`). The
  code and tests follow 8/8b/SEAM-S1. The contract text should be corrected by
  its owner.
- `isSafeEntry` is exported but only used inside `validateMintInput`; kept under
  the same public surface as the other validators for direct testing if wanted.
- The `GET /share` row now stores `entry`, but the Shares table does not display
  it (the contract's list columns are `section, source, slug, created_by,
  expires_at`). No change made.
