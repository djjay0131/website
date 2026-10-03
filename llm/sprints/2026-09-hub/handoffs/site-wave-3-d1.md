# Handoff — `site`, Wave 3 follow-up (Dissenter D1 fix)

Status: Delivered (not committed)
Date: 2026-10-03
Stream: `site` (`site/**`)
Issue: `hub-004`
Branch: `feat/sharing`
Contract: `llm/sprints/2026-09-hub/contracts/site-wave-3.md`, Addendum (requirements 8–11)
Seams: `llm/sprints/2026-09-hub/contracts/phase-4-seams.md` SEAM-S1 (amended 2026-10-03)

## Summary

A share now serves a self-contained, item-scoped document tree at
`<section>/<source>/<slug>/_doc/` instead of the members' frame. The private
build stages that tree for every effectively-private item, additively with the
existing `_payload/…` member staging, and `check:private-links` treats `_doc/**`
as satellite bytes (no existence policing of its internal links, but off-origin
sub-resources and links leaving the tree still fail).

For the phd fixture the built share tree for `committee-dossier` is exactly:

```
dist-private/phd/phd-milestones/committee-dossier/_doc/index.html        # from site/committee.html
dist-private/phd/phd-milestones/committee-dossier/_doc/assets/style.css  # the shared asset
```

No `internal.html`, no `committee.html`, and no second `index.html` from
`milestones`. The member frame at
`phd/phd-milestones/committee-dossier/index.html` and `_payload/…` are unchanged.

## What changed

All changes are under `site/**`; `gate/**`, `infra/**`, `firebase.json`,
`llm/**` (except this handoff), the manifest schema and `_payload` staging were
not touched.

- **`site/src/lib/frame-content.mjs`** — added `SHARE_DOC_ROOT = "_doc"` and
  `docStagingPlanFor(sourcesDir, items)` (plus private helpers
  `shareDocRootFor`/`addDocFile`). `stagingPlanFor` is untouched.
- **`site/src-private/lib/private-content.mjs`** — re-exports `SHARE_DOC_ROOT`
  and `docStagingPlanFor` (still a thin re-export; implementation lives in the
  public-safe module so the two builds cannot drift on the segment rules).
- **`site/scripts/private-build.mjs`** — after `stagingPlanFor`, computes
  `docStagingPlanFor` and copies both plans through one map (a duplicate `to`
  with a different `from` throws rather than silently overwriting). The member
  log line and `payloadFileCount` keep their meaning; the receipt gains
  `docFileCount`. `fileCount` still counts the whole output, so sync-private P4
  holds.
- **`site/scripts/check-private-links.mjs`** — added `isShareDoc` and
  `shareDocTreePrefix`. For a `_doc/` page the existence check is skipped (the
  item copy deliberately omits sibling documents), but an off-origin
  sub-resource, a link outside `/p/`, or a same-origin link that leaves the
  item's `_doc/` tree still fails. `_payload/**` keeps its existence check.
- **Tests** — `site/src-private/lib/private-content.test.ts` (plan unit tests),
  `site/scripts/private-build.test.ts` (new; drives the real
  `astro:build:done` hook into a temp dir against the fixture and checks the
  tree plus receipt P4), `site/scripts/check-private-links.test.ts` (satellite
  behaviour).
- **`site/scripts/private-structure.test.ts`** — drive-by: the working tree
  carries the exact `/share` rewrite the contract Exit names, so the ordered
  rewrite assertion now expects `/share` before `/share/**` and `/s/**`. This
  file is site's, and `firebase.json` itself was not touched.

## The item-scoped plan's exact rules

`docStagingPlanFor(sourcesDir, items)` returns `{from, to, source}[]` sorted by
`to`, for the same effectively-private, non-`data` item set the member plan
uses.

1. **Reserved namespace.** Skip an item whose `source` or `slug` is `_doc`. The
   manifest schema already rejects both (leading `_`), so this is the
   fail-closed second check.
2. **Safe tree root.** `section`, `source` and `slug` must be non-empty, and
   every `/`-segment must match the gate segment allowlist and not be `.`/`..`;
   otherwise the item is skipped. The destination is
   `path.posix.join(section, source, slug, "_doc")`.
3. **Entry.** The item's own document (`item.path`) is copied to
   `<treeRoot>/index.html`, if it exists and is contained in the source prefix.
4. **Assets.** For `html`/`bundle` items only, walk the document's containing
   directory recursively and copy every non-`.html`/`.htm` file to
   `<treeRoot>/<rel-from-containing-dir>`, preserving structure. A non-framed
   item (pdf/data) stages only its entry — walking would sweep the whole source
   prefix when `path` sits at the root (the cv trap).
5. **Documents.** A document is not an asset:
   - **named directory** (the containing dir is not the source prefix root):
     only the renamed entry travels. Sibling pages and a withdrawn page's
     leftover bytes both stay behind — the same protection `stagingPlanFor`
     gives the member payload;
   - **prefix root** (a built site, `index.html` at the root): the whole subtree
     travels, except any document another item of the same source declares.
     Undeclared pages are the built site's own pages.
6. The source of truth for step 5's prefix-root exclusion is the set of
   `item.path`s of every item passed in for that source (the per-source,
   per-item `declaredPages` filter).

## Evidence (exact commands / counts)

All from `site/` on `feat/sharing`, working tree:

```
$ npm test
Test Files  26 passed (26)
     Tests  348 passed | 1 skipped (349)

$ npm run build:private
[hub-private-build] staged 5 payload file(s) for 4 private item(s) from their containing directories
[hub-private-build] staged 7 item-scoped _doc file(s) for 4 private item(s) (the share-servable copy)
[hub-private-build] checked 100 emitted path(s) against the gate's allowlist (SD-7)
[hub-private-build] wrote .hub-private-build.json: 4 private item(s), 100 file(s).
[build] 6 page(s) built in 1.23s
# receipt: privateItemCount 4, payloadFileCount 5, docFileCount 7, fileCount 100

$ find dist-private -path '*_doc*' -type f | sort
dist-private/cv/cv/anthropic-fellow/_doc/index.html
dist-private/phd/phd-milestones/committee-dossier/_doc/assets/style.css
dist-private/phd/phd-milestones/committee-dossier/_doc/index.html
dist-private/phd/phd-milestones/milestones/_doc/assets/style.css
dist-private/phd/phd-milestones/milestones/_doc/index.html
dist-private/projects/phd-milestones/internal-notes/_doc/assets/style.css
dist-private/projects/phd-milestones/internal-notes/_doc/index.html

$ npm run check:private-links
check:private-links: PASS — every link in 13 page(s) resolves under /p/: no off-origin
SUB-RESOURCE, none escaping the base, and each points at a file that exists.
130 outbound anchor(s) allowed.
# was 9 pages before this change; +4 are the `_doc/` index.html copies

$ npm run check:no-private-in-public
check:no-private-in-public: PASS — no private slug, source, route, payload path, title
or summary appears in any path or any file's contents under dist-public (162 files scanned).

$ npm run check:publish-allowlist
check:publish-allowlist: PASS (mode pr) — 14 entries, 0 conflicts, 0 stale.

$ npm run build:public
[hub-public-build] staged 3 payload file(s) for 1 public framed item(s)
[build] 26 page(s) built in 1.53s      # unchanged

$ node ~/code/agentic-governance/plugin/scripts/governance-checks.mjs --layout
4 of 4 checks passed, 0 failed.        # governance-links, adr-index, adr-status, layout
```

Extra (not required): `npm run check:smoke-routes` → all 7 present in
`dist-public`. `find dist-public -path '*_doc*'` → 0; `_payload` still holds the
same 5 member files.

## Assumptions

- The plan tests use `site/fixtures/content/sources`, not
  `site/src/content/sources`. A pull-request build supplies only `cv` (the
  cv-release fallback), so the synced tree cannot be relied on to carry
  `phd-milestones`; the committed fixture is byte-identical for it.
- The build-level assertion drives the real `astro:build:done` hook (staging,
  SD-7 check and receipt) into a temp dir against the fixture. A full Astro
  render is deliberately not spawned inside `npm test`; the real
  `npm run build:private` output is recorded above instead.
- "Sibling-declared" means declared by any item of the same source in the set
  passed to the plan; the current item's own path is skipped as the renamed
  entry first, so it is never double-handled.
- `check-private-links` identifies a share page by any `_doc` path segment;
  `_doc` is reserved, so no legitimate member path uses it.

## Risks

- **Non-framed entry rename.** A private `pdf` item's entry is renamed to
  `_doc/index.html`; the gate infers `text/html` from the extension, so a shared
  private PDF would be served with the wrong content type. This is live for
  `cv/anthropic-fellow` (effectively private — not in the allowlist). It is
  untriggered by the D1 acceptance scenario but needs a ruling (see Open
  questions). The alternative — not renaming — also breaks `/s/{token}/`, which
  the gate appends `index.html` to.
- **Prefix-root breadth.** A prefix-root framed item copies its whole subtree;
  a withdrawn sibling's shared non-document asset still travels (the C28
  residual) and the built site's undeclared pages travel. Intended, but it makes
  `_doc/` wider than `_payload/` for that shape.
- **Existence check skipped only for `_doc`.** `_payload/**` keeps its
  existence check, so a broken member page is still caught; the share tree is
  the only place a missing internal link is tolerated, because the item copy
  omits sibling documents by design.
- **`_doc` detection by segment.** A `_payload` satellite directory literally
  named `_doc` would have its internal-link existence checks skipped. Negligible
  (reserved namespace), but recorded.
- **Drive-by test change.** `private-structure.test.ts` now blesses the
  uncommitted exact `/share` rewrite that the contract Exit names; if that
  rewrite is removed, the assertion must move back.

## Open questions

- Should a non-framed private item be renamed to `_doc/index.html`, or staged
  under its own name and served with its own content type? The contract text
  says "renamed to `index.html`" without a format carve-out; the gate appends
  `index.html` for a directory request, so a pdf cannot be served correctly
  either way today.
- The parenthetical "exactly as it treats `_payload/**`" is contradictory in the
  existing code: `_payload` does existence-check its links. This change keeps
  `_payload` strict and skips existence only for `_doc`. Confirm that is the
  intended reading, or else name the class explicitly.
- Should an undeclared document inside a NAMED directory travel (a literal
  "only sibling-declared documents are excluded" reading)? This change withholds
  it, mirroring `stagingPlanFor`'s withdrawn-document protection and the
  contract's "every non-document file" wording; a prefix-root site keeps its
  undeclared pages. Confirm the named-directory reading.
- `docStagingPlanFor` lives in `frame-content.mjs` to reuse `walk`,
  `normalizeRel` and the segment rules; if it should live under `src-private/`
  instead, it can move without a behaviour change (the structural test only
  forbids public → private imports).
