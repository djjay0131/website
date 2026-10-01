# Handoff — `Regression Tester`, Wave 1

Agent: Regression Tester (independent; authored nothing in this wave)
Contract: `llm/sprints/2026-09-hub/contracts/regression-tester-wave-1.md`
Wave: 1 · Issue: #72 · Branch: `feat/satellite-kgis` · HEAD: `283de67`
Pre-wave baseline compared: `main` (`c02596d`) and the WIP parent `9e7408a`

## Summary

Wave 1 did not break anything that worked before. **No regressions found.**

Both builds succeed under `npm run content:fixture`; every guard in the contract is
green; the test suite is green and only grew. The public build adds exactly one page
(`/projects/kgis/kgis-docs/`); the private build adds exactly one page
(`/projects/phd-milestones/internal-notes/`). No route present at `main` disappeared,
nothing under `src/pages` was removed, no tracked file gained or lost its executable
bit, and no test file was deleted or weakened.

| | public pages | private pages |
|---|---|---|
| before (`main`) | 26 | 3 |
| after (`283de67`) | 27 | 4 |
| delta | +1 expected | +1 expected |

## Checks — PASS/FAIL

| # | check | result |
|---|---|---|
| 1 | `build:public` + `build:private` succeed; page set vs pre-wave | **PASS** (27 public / 4 private; +1 each, both expected) |
| 2 | `npm run check:smoke-routes` | **PASS** (7/7) |
| 3 | `npm run check:private-links` (after `build:private`, issue #27 `/p/`) | **PASS** |
| 4 | `npm test` | **PASS** (21 files, 271 passed, 1 skipped / 272) |
| 5 | private-structure import-direction test | **PASS** (6 tests; see below) |
| 6 | executable bits unchanged vs `main` | **PASS** (5/5 same blobs) |
| 7 | `npm run check:no-private-in-public` | **PASS** (163 files scanned) |

## Delta table

| artifact | before (`main`) | after (`283de67`) | verdict |
|---|---|---|---|
| public page routes | 26 | 27 | **+1 expected** — `/projects/kgis/kgis-docs/` only |
| private page routes | 3 | 4 | **+1 expected** — `/projects/phd-milestones/internal-notes/` only |
| public route removals | — | none | no regression |
| private route removals | — | none | no regression |
| public payload routes | none (no public staging) | `/_payload/kgis/` + `assets/style.css` + `manifest.json` | new, expected (item 3) |
| private payload routes | `/_payload/phd-milestones/site/**` (2 docs) | same tree + `internal.html` | shape unchanged; +1 new item |
| `src/pages/**` source tree | 24 files + no frame page | same 24 + `[section]/[source]/[slug].astro` | +1 route source, 0 removed |
| `src-private/pages/**` | `index.astro`, `[...itemPath].astro` | unchanged | unchanged |
| legacy redirect pages | 4 | 4 | unchanged |
| executable files (`100755`) | 5 | 5 (identical blob SHAs) | no regression |
| test files | 18 | 21 (3 added, 2 modified, 0 removed) | grew; nothing dropped |
| test results | (n/a locally on `main`) | 271 passed · 1 skipped | green |
| smoke routes | 7/7 | 7/7 | no regression |
| private links under `/p/` | PASS | PASS | no regression |
| private-in-public leak gate | PASS | PASS | no regression |

## Route added/removed — evidence

**Added, public, expected (the wave's deliverable):**

```
$ npm run build:public
[hub-public-build] staged 3 payload file(s) for 1 public framed item(s)
[build] 27 page(s) built
$ grep -o 'href="/projects/kgis/kgis-docs/"' dist-public/projects/index.html
href="/projects/kgis/kgis-docs/"
```

**Added, private, expected (the planted private `projects` item):**

```
$ npm run build:private
[hub-private-build] staged 4 payload file(s) for 3 private item(s) ...
[hub-private-build] checked 87 emitted path(s) against the gate's allowlist (SD-7)
[build] 4 page(s) built
```

**No route removed.** The pre-wave public page inventory is reconstructable from
`main`'s source alone and does not contain the new frame page:

```
$ git diff --name-status main..HEAD -- site/src/pages site/src-private/pages
A  site/src/pages/[section]/[source]/[slug].astro
M  site/src/pages/projects/index.astro
```

Only one page source was added and one modified; nothing deleted. `src-private/pages`
is byte-identical between `main` and HEAD. Counting: 20 static pages + 4 CV variants
+ 2 CV-pool project slugs = **26** before; + the one `kgis` framed item = **27** after.
Private: `index.astro` + 2 private `phd` items = **3** before; + the one private
`projects` item = **4** after.

The other 31 public routes under `dist-public` are unchanged and are accounted for:
24 real page routes (redirects and payloads excluded), 4 legacy redirects, 2 CV-pool
project slugs, the `robots.txt` endpoint, `sitemap-*.xml`, and the pre-existing
`public/` assets (`favicon.*`, `emblem/research-emblem.*`, the four CV PDFs, the photo).
The only new public artifact beyond the new page is the item-3 payload `/_payload/kgis/**`,
which the wave exists to produce.

## Verbatim transcripts (key checks)

```
$ npm run check:smoke-routes
check:smoke-routes: all 7 smoke routes present in dist-public

$ npm run check:private-links
check:private-links: PASS — every link in 7 page(s) resolves under /p/: no off-origin
SUB-RESOURCE, none escaping the base, and each points at a file that exists. 0 outbound
anchor(s) allowed (see NAVIGATIONAL_TAGS).

$ npm run check:no-private-in-public
check:no-private-in-public: PASS — no private slug, source, route, payload path, title or
summary appears in any path or any file's contents under dist-public (163 files scanned).

$ npm test
 Test Files  21 passed (21)
      Tests  271 passed | 1 skipped (272)

$ git ls-files -s | grep 100755
100755 ... infra/scripts/check-private-bucket-iam.sh
100755 ... infra/scripts/seed-members.sh
100755 ... site/scripts/fetch-data.sh
100755 ... site/scripts/sync-content.sh
100755 ... site/scripts/sync-local-data.sh
```

The five `100755` blob SHAs are identical to `git ls-tree -r main | grep 100755`.
No new `.sh` file was added by the wave (`git diff --name-status main..HEAD -- '*.sh'`
is empty). Issue #27 was verified directly: every root-absolute `href`/`src` in every
`dist-private/**/*.html` carries `/p/`; the sample private frame emits
`href="/p/_payload/phd-milestones/site/index.html"` and `src="/p/_astro/..."`.

## Check 5 — the import-direction test, named

`site/scripts/private-structure.test.ts` passes (6 tests). The pinned property is the
second `describe`, **"nothing the public build compiles imports anything private"**, whose
test **"no file under src/ imports src-private/, private-content or the private build"**
walks every source file under `src/**` and fails on any `import`/`require` line naming
`src-private`, `private-content`, `private-build` or `PrivateBase`. The wave moved the
shared staging/route model into `src/lib/frame-content.mjs` and made
`src-private/lib/private-content.mjs` a thin re-export, so the arrow still points one way.
The sibling test "the sign-in page in particular names nothing private" also passes.

## Assumptions

- "Before" means the last state that actually built: `main` (`c02596d`). The WIP parent
  `9e7408a` is a broken intermediate (it imports a `scripts/public-build.mjs` that did not
  exist) and is not a working baseline. Where the contract says "compare against 9e7408a
  and main", I used `main` for the behavioural baseline and `9e7408a` for the source-tree
  delta; both agree that the only page source added is the frame route.
- Pre-wave page counts were derived from the source/route inventory (no old checkout was
  built; `git stash` was not used and no worktree was created, per the read-only rule).
  The route inventory was computed with the repo's own `routesFromPagesDir` over the
  `main` trees plus the committed `main` fixtures.
- "Page count" is Astro's `page(s) built` figure: real `.html` pages only, excluding
  legacy redirect stubs, the `robots.txt` endpoint, the sitemap and `_payload` assets.
- No private content was quoted; only committed fixtures were built.

## Recommendations

1. The two added routes are exactly the wave's deliverables and nothing else; no
   follow-up action is required for regression.
2. When the real `agentic-kgis` publishes, re-run this same before/after procedure
   against the real manifest — the fixture now proves the route shape, not the bytes.

## Alternatives considered

- Building `main` in a separate worktree for a byte-for-byte route diff. Rejected: a
  worktree is a git mutation and the contract forbids it; the source-level delta plus
  the route-inventory reconstruction is sufficient and is shown above.
- Treating the WIP `9e7408a` as "before". Rejected: it does not build, so it cannot be a
  regression baseline.

## Risks

- The public page count evidence is reconstructed from source, not from a second build
  of `main`. Confidence is high (one added page source, one added public fixture item,
  no deletions), but it is reasoning, not a `main` build artifact.
- The private link check reports `7 page(s)` because it intentionally walks staged
  payload `.html` files as well as frame pages; the count is not comparable to the
  4-page build figure. Both are green.

## Open questions

- None blocking. The wave's own risks (the prefix-root staging rule for a multi-item
  source) are the site stream's, not regression findings; they remain as written in
  `handoffs/site-wave-1.md`.

## Related docs

- `llm/sprints/2026-09-hub/contracts/regression-tester-wave-1.md`
- `llm/sprints/2026-09-hub/contracts/site-wave-1.md`
- `llm/sprints/2026-09-hub/handoffs/site-wave-1.md`
- `llm/governance/adr/0005-two-output-build-with-leak-check.md`
- `llm/governance/adr/0010-withdrawal-semantics.md`
- `llm/governance/adr/0011-two-srcdirs-not-a-visibility-filter.md`

## ADR candidates

- None from this role. Regression found no decision that needs recording.
