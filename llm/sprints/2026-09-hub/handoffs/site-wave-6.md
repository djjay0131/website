# Handoff — `site`, Wave 6 (annotations)

Status: Delivered
Date: 2026-10-07
Stream: `site` (`site/**`, root `firebase.json`)
Branch: `feat/annotations`
Contract: `llm/sprints/2026-09-hub/contracts/site-wave-6.md`
Seams: `llm/sprints/2026-09-hub/contracts/wave-6-annotations-seams.md` (AN-CAP, AN-STORE, AN-USE, AN-EXPORT, AN-LEAK, AN-REWRITES)
Design: ADR-0021; ADR-0003 (React islands); ADR-0022 (Proposed — credential hard stop)
Issue: #107

## Summary

Shipped the annotation capture island, the My notes page, the owner-editable
routing file + validator, the export renderer, the hosting rewrites and the
leak-check needles — all private-build-only except `firebase.json` and
`notes-routing.json`.

- **Capture** (`AnnotationsIsland.tsx`, mounted on `[...itemPath].astro` for
  `format === "html" | "bundle"` only): attaches to the same-origin payload
  `<iframe>` after load, reads the selection into a W3C `TextQuoteSelector` +
  `TextPositionSelector`, shows a Highlight/Comment toolbar with an intent chip,
  saves via `POST /annotations`, lists the item's notes, badges orphans, deletes
  own notes, Ctrl/Cmd+Shift+L highlights, ≥44px touch targets, and degrades to
  read-only on 403. All decision logic is in `annotations.mjs`.
- **My notes** (`notes.astro` at `/p/notes/` + `NotesIsland.tsx`): lists
  `GET /annotations` grouped by item, filterable by intent and date, orphan
  badge, links to item frames; "My notes" nav added beside Shares in
  `PrivateBase.astro`.
- **Routing** (`notes-routing.json`) with a strict parser/validator shared by
  the browser and the Node renderer.
- **Export** (`scripts/export-notes.mjs`): reads a notes JSON (`--notes`) or
  prints the ADR-0022 stop, applies the routing, writes one escaped Markdown
  file per note grouped by item, skips `question`. No remote, no credential.
- **Rewrites**: `/annotations` and `/annotations/**` → `hub-gate` (bare path
  required).
- **Leak check**: annotation needles added (with one documented narrowing, below)
  plus tests that plant one (red) and a clean build (green).

Nothing under `gate/**` or `infra/**` was touched; no `llm/**` file was touched
except this handoff. No git or `gh` command was run.

## Files

Added:

- `site/notes-routing.json` — the owner-editable intent→repo/dir map.
- `site/src-private/lib/annotations.mjs` — pure, DOM-free logic: endpoints,
  same-origin request inits, field bounds matching the gate, selector
  construction/indexing, quote fallback resolution, intent list, status→UI
  branch, grouping/filtering and routing parse/validate.
- `site/src-private/lib/annotations.test.ts` — 36 tests.
- `site/src-private/components/AnnotationsIsland.tsx` — the capture island.
- `site/src-private/components/NotesIsland.tsx` — the My notes island.
- `site/src-private/pages/notes.astro` — `/p/notes/`.
- `site/scripts/export-notes.mjs` — the credential-free export renderer.
- `site/scripts/export-notes.test.ts` — 13 tests.
- `site/scripts/wave-6-structure.test.ts` — 11 tests (private-only proof +
  AN-LEAK build assertions).

Modified:

- `site/src-private/pages/[...itemPath].astro` — mounts the capture island for
  `html`/`bundle`, adds `data-annotation-frame`, island/toolbar styles.
- `site/src-private/layouts/PrivateBase.astro` — "My notes" nav beside Shares.
- `site/scripts/check-no-private-in-public.mjs` — `ANNOTATION_NEEDLES`,
  `containsAnnotationNeedle`, `findAnnotationLeaks`, CLI wiring, header comment.
- `site/scripts/check-no-private-in-public.test.ts` — +6 tests for AN-LEAK.
- `site/scripts/private-structure.test.ts` — expected rewrite list extended with
  the two annotation rewrites.
- `firebase.json` (repo root) — `/annotations` and `/annotations/**` rewrites.

## Exact check results

Run from `site/` unless noted. Node v22.23.2, npm 10.9.8.

```
### npm test
Test Files  34 passed (34)
     Tests  488 passed | 2 skipped (490)
# baseline before this wave: 31 passed (31), 421 passed | 2 skipped (423)
# delta: +3 files, +67 tests (annotations 36, export 13, wave-6 11, AN-LEAK +6,
#        plus one new-test-count in an existing file)

### npm run build:public
[build] 33 page(s) built in 1.81s
[hub-public-build] staged 3 payload file(s) for 1 public framed item(s)
[build] Complete!
# dist-public has NO `notes/`, NO `/annotations`, NO `/p/notes`,
#   NO `hub:annotation:`, NO `data-annotation-` (verified by the leak check and
#   wave-6-structure.test.ts)

### npm run build:private
[build] 7 page(s) built in 1.29s
[hub-private-build] staged 5 payload file(s) for 4 private item(s)
[hub-private-build] staged 7 item-scoped _doc file(s) for 4 private item(s)
[hub-private-build] checked 107 emitted path(s) against the gate's allowlist (SD-7)
[build] Complete!
# emits /notes/index.html; _astro/AnnotationsIsland.<hash>.js,
#   _astro/NotesIsland.<hash>.js and _astro/annotations.<hash>.js

### npm run check:no-private-in-public
check:no-private-in-public: PASS — no private slug, route, payload path, title or
summary appears in any path or any file's contents under dist-public and no private
title or summary appears in any stub under dist-redirects, and none of the
annotation needles (/annotations, /p/notes, hub:annotation:, data-annotation-)
appears (172 file(s) scanned in dist-public, 42 in dist-redirects).
# derived outputs reported: og-card (2), rss (1), sitemap (2)

### npm run check:private-links
check:private-links: PASS — every link in 13 page(s) resolves under /p/ ... 
(151 outbound anchor(s) allowed).

### npm run check:publish-allowlist
check:publish-allowlist: PASS (mode pr) — 20 entries, 0 conflicts, 0 stale.

### npm run check:smoke-routes
check:smoke-routes: all 7 smoke routes present in dist-public

### npm run contrast
56 pairs, 0 below AA

### npm run demo:leak-check
demo:leak-check: the check exited 1 (1 means it caught the leak).
demo:leak-check: PASS — the guard failed on the injected leak in all 10 output(s).
```

The annotation tests non-vacuously fail: planting `/annotations` in a public
file makes `check:no-private-in-public` exit 1 (CLI test), and a clean build is
green; a `<script>` in a quote or comment is asserted to stay escaped text in
both the Markdown renderer and the React islands (which contain no
`dangerouslySetInnerHTML`).

## Assumptions

1. **`firebase.json` is the repo-root file, not `site/firebase.json`.** The
   contract Scope says `site/firebase.json`, but no such file exists; the deploy
   config is `/firebase.json` (`public: site/dist-public`, per `infra/firebase.tf`
   "firebase.json names no site"), and `private-structure.test.ts` already read
   `path.resolve("..", "firebase.json")`. I edited the root file. See Deviations.
2. Field bounds are taken verbatim from AN-STORE / gate-wave-6 requirement 2:
   `exact` 1–2000, `prefix`/`suffix` 0–64, `comment` 0–5000, `tags` ≤10 × ≤40,
   `position` integers with `0 <= start <= end` (a `bool` is not an integer).
3. `GET /annotations` returns the caller's rows under a `notes` key; the list
   reader also accepts `annotations` and a bare array, since the gate response
   key is the gate stream's to fix. Item identity uses the shares segment
   allowlist (`[A-Za-z0-9._-]`, no `.`/`..`).
4. The iframe is same-origin and `X-Frame-Options: SAMEORIGIN` is the gate
   stream's AN-GUARD-8 change; the island simply reads `contentDocument`.
5. `bundle` items expose a payload URL at `_payload/<source>/<path>` (the same
   `payloadUrlFor` the `html` frames use).
6. Orphan state is computed at read time against the frame text; on My notes
   (no text available) "orphan" means the item is not in this build. Nothing is
   written back to the store (AN-OUT-OF-V1).

## Deviations

1. **`data-annotation-` needle is left-boundary aware (Wave 6 FP).** A clean
   public build legitimately contains the substring `data-annotation-` in the
   research citation key `tan-2024-llm-data-annotation-survey`. A plain
   substring search failed the clean build (the same over-broad-needle class as
   Wave 2's `index.html` and Wave 4's `construction-ai`). `containsAnnotationNeedle`
   requires the character before `data-annotation-` to be whitespace, a quote,
   `<`, an opening bracket, a comma or a backtick — every real occurrence
   (`data-annotation-frame`, `data-annotation-island`, `"data-annotation-…"`) is
   caught; the hyphenated citation token is not. A regression test pins the
   citation as clean and a real attribute as red. The other three needles match
   as plain substrings. This narrows coverage only for a hyphen-prefixed token,
   which is not a DOM attribute or a code string.
2. **`firebase.json` path.** Edited `/home/djjay/code/website/firebase.json`
   (repo root), not `site/firebase.json`, for the reason in Assumptions 1.

## Recommendations

- The gate should return `GET /annotations` rows under a single, documented key.
  `annotations.mjs` tolerates `notes`, `annotations` and a bare array; pick one
  (I assumed `notes`) and the site can drop the tolerance.
- Add an npm script for the export (`notes:export`) once the owner wants it;
  it is deliberately not wired into CI (it is owner-triggered and credential-free
  in v1).
- Consider `GET /annotations?scope=all` for the owner's My notes page so the
  owner can read every member's notes there; v1 lists only the caller's own, as
  the contract specifies.

## Alternatives

- **Visual highlights via DOM wrapping (Range.surroundContents / mark).** Rejected:
  it mutates satellite bytes inside the iframe and is easy to get wrong across
  element boundaries. The CSS Custom Highlight API paints Ranges without touching
  the DOM; where it is unavailable the note is still listed in the panel.
- **One Markdown file per item (containing its notes).** The contract says "one
  Markdown file per note … grouped by item"; I wrote one file per note under an
  item directory (`owner/name/<dir>/<section>/<source>/<slug>/<id>.md`), which
  satisfies both readings.
- **Storing the item title in the row.** Rejected by ADR-0021 (private material
  duplicated for no gain); My notes maps identity to a title from the build.

## Risks

- The capture island depends on same-origin iframe DOM access and the gate's
  `SAMEORIGIN` header change; without it the island loads but sees no document
  (it degrades to the panel/read-only UI).
- Orphan detection on My notes is "item not in this build", not "quote no longer
  resolves" — the latter needs the item text, which only the frame has. Recorded,
  not hidden.
- `annotationListEndpoint` builds query strings with `encodeURIComponent`; a
  future gate filter added without a UI path is simply unused.
- Markdown escaping handles `&`, `<`, `>`; a future Markdown renderer that
  executes other constructs (e.g. raw HTML blocks already neutralised) is out of
  scope. The renderer never emits raw HTML.

## Open questions

1. Which response key does the gate use for a list of notes (`notes`,
   `annotations`, `rows`)? The site currently accepts all three.
2. Should the owner's My notes page default to `scope=all`, or stay caller-only
   (v1 contract phrasing is "the caller's notes")?
3. Where should exported files land in the target repo — the item-directory
   layout chosen here (`<dir>/<section>/<source>/<slug>/<id>.md`) or a flat
   `<dir>/<qualified-id>.md`? ADR-0022 does not fix it.

## Related docs

- `llm/sprints/2026-09-hub/contracts/site-wave-6.md`
- `llm/sprints/2026-09-hub/contracts/wave-6-annotations-seams.md`
- `llm/governance/adr/0021-annotations-private-item-notes.md`
- `llm/governance/adr/0022-annotation-export-transport.md` (Proposed)
- `site/notes-routing.json`

## ADR candidates

- **ADR candidate: the annotation list response key and export file layout.**
  Both are interface choices the gate and the site must agree on; a small ADR
  (or an addendum to ADR-0021) would prevent drift.
- **ADR candidate: annotation-like needle bounding in the leak check.** Wave 2,
  Wave 4 and now Wave 6 have each hit an over-broad needle that failed a clean
  build. A short rule — "a needle that is a common English/identifier substring
  is matched token-bounded, and the bound is documented with the counterexample"
  — would make the next needle cheaper and safer to add.
