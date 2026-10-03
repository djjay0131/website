# Handoff — `Regression Tester`, Wave 3 (Phase 4 sharing)

Agent: Regression Tester (independent; authored nothing in this wave)
Contract: `llm/sprints/2026-09-hub/contracts/regression-tester-wave-3.md`
Wave: 3 · Issue: `hub-004` · Branch: `feat/sharing` · HEAD: `c605c72`
Pre-wave baseline compared: `main` (`4313135`)

## Summary

**PASS — no Wave 3 regression found.** Every guard in the contract is green,
every suite is green, and each difference from `main` is the wave's own
deliverable. The public build is byte-for-byte the same page set (26 pages); the
private build gained exactly the one new page the wave adds (`/p/shares/`) and
no new private item. No pre-existing test was deleted; the only suites that
shrank are the deliberately-rewritten `test_scope.py` guard, whose lost cases
asserted that Phase 4 sharing did **not** exist yet. No failure observed, so
nothing to label as a Wave 3 regression or pre-existing.

All counts below were read from the branch working tree; the `main` column was
produced read-only from a `git archive main` extraction in `/tmp` (no worktree,
no branch checkout, no tracked file modified).

## Checks — area / before / after / verdict

| Area | before (`main` 4313135) | after (`c605c72`) | verdict |
|---|---|---|---|
| `gate` pytest | 296 passed, 0 skipped | **419 passed**, 0 skipped | PASS — +123 net, all expected |
| `site` vitest | 299 passed \| 1 skipped (300) | **326 passed \| 1 skipped (327)** | PASS — +27 added, skip unchanged |
| `contract` tests | 57 tests, 57 pass, 0 fail | **57 tests, 57 pass, 0 fail** | PASS — `contract/` unchanged |
| `build:public` | 26 pages | **26 pages** | PASS — page set unchanged |
| `build:private` | 5 pages, 4 items, 86 files | **6 pages, 4 items, 93 files** | PASS — +1 page `/p/shares/`; items 4→4 |
| smoke route list | 7/7 present | **7/7 present** | PASS |
| `/p/**` in `dist-public` | absent | **absent** | PASS (no `/p/` literal, no `p/` dir) |
| `check:no-private-in-public` | PASS | **PASS** (162 files scanned) | PASS |
| `check:publish-allowlist` | PASS | **PASS** (14 entries, 0 conflicts, 0 stale) | PASS |
| `check:private-links` | PASS | **PASS** (9 pages, 130 outbound anchors) | PASS |
| `firebase.json` rewrites | `/p/**`, `/session`, `/session/end`, `/client-events` | same 4 + `/share/**`, `/s/**` | PASS — additions only, order preserved |
| allowlist file | `5f322a0…` | `5f322a0…` | PASS — blob hash identical |
| effective visibility / OG card / band+footer | — | public `src/**` untouched | PASS |
| Terraform (`infra/`) | — | only `gate.tf` (role line) + `README.md` | PASS |
| governance `--layout` | — | **4 of 4 checks passed** | PASS |

### Test-count deltas, accounted for exactly

- **gate**: `main` 296 → branch 419. `tests/test_shares.py` is new and collects
  **129**. `tests/test_scope.py` went 28 → 22: removed 15 cases
  (`test_no_share_routes_are_declared`, `test_phase_four_and_admin_surfaces_do_not_answer`
  ×12, `test_share_mint_is_not_implemented` ×2) that asserted Phase 4 routes were
  absent, and added 9 (`test_the_route_table_is_exactly_this`,
  `test_surfaces_that_do_not_exist_answer_404` ×6,
  `test_an_unknown_share_token_does_not_answer_200` ×2). 296 − 15 + 9 + 129 = 419.
  All other eight gate test files collect identical counts.
- **site**: `main` 299 → branch 326. New `src-private/lib/shares.test.ts` collects
  24; `scripts/private-structure.test.ts` gains 3. 299 + 24 + 3 = 326. The other
  23 test files are unchanged. The one skip (route-inventory redirect map, needs
  `dist-public`) is identical before and after.
- **contract**: no diff under `contract/`; 57/0 on both.

## Public build is unchanged

`git diff --name-status main...HEAD -- site/src/` is empty: no public page,
component, layout, or lib changed. `site/astro.config.mjs` changes are confined
to the `isPrivate` branch (`? [react(), privateBuild()]`), so the public build
never runs the React plugin. Verified structurally, not just asserted:

```
no react runtime in dist-public/_astro
dist-private/_astro/react.DJY1zw8Z.js   # private only (SEAM-S6 correct)
```

Both builds report the same public page count (26). The private delta is
`/p/shares/` only; the private item set stays at 4
(`cv/anthropic-fellow`, `phd-milestones/{milestones,committee-dossier,internal-notes}`),
so the sync delete list is unchanged.

## The rewrites (SEAM-S4)

`git diff main...HEAD -- firebase.json` adds exactly two entries after the
existing four. The four pre-existing rewrite objects and their order are
byte-identical; `public: "site/dist-public"`, `trailingSlash: true`, the three
anthropic redirects and the headers are untouched. `private-structure.test.ts`
pins the order:

```
/p/**, /session, /session/end, /client-events, /share/**, /s/**
```

## Wave 0b/0c boundaries

- `site/publish-allowlist.json` blob hash `5f322a00dcdd087dee05a35f4b7ac200d9c8e6e5`
  identical at `main` and HEAD.
- `effectiveVisibility` (`site/src/lib/hub-content.mjs`), the OG-card generator
  (`site/scripts/og-card.mjs`) and the shared band/footer
  (`site/src/components/{SiteBand,SiteFooter,SiteIcon}.astro`) are all untouched;
  the "shared band and footer are safe for both builds" suite passes.
- `PrivateBase.astro` gained a `Shares` nav entry; that is a private-only chrome
  addition (the wave's deliverable) and reaches nothing public — public `src/**`
  and `Base.astro` are unchanged.

## Terraform

`git diff main...HEAD -- infra/` names only `infra/README.md` and `infra/gate.tf`.
No `resource "…"` block changed; the sole semantic change is one line in the
existing `google_project_iam_member.hub_gate_firestore`:

```
-  role    = "roles/datastore.viewer"
+  role    = "roles/datastore.user"
```

The rest of the `gate.tf` diff is the explanatory comment block for that
re-widening. No other resource, variable, or output changed.

## Corrected false starts (recorded, not reported as passes)

1. **`main` site appeared as 291 passed / 9 skipped (300).** That was an
   extraction artifact: `git archive main` omits the gitignored synced
   `site/src/content`, so 8 `cv-data`/`bib` tests self-skipped. Symlinking the
   branch's `src/content` into the extraction gave the true baseline **299
   passed / 1 skipped**, matching the branch's single skip. There is no
   skip-count regression.
2. **First delta estimate for gate was off by three.** I initially computed
   `main` 296 − `test_scope` 8 + 5 = 293, but `test_scope` is parametrized:
   `--collect-only` shows 28 → 22, a net −6 (15 removed, 9 added). The −6 are
   entirely the obsolete "no Phase 4" guards; no other file lost a case.
3. **A `grep` pipeline read `exit-grep=0` from `head`, not `grep`.** Re-checked
   with an explicit `if grep -q`; `/p/` and `react` are genuinely absent from
   `dist-public`.

## Assumptions / limits

- `main` was materialised with `git archive main | tar -x` into `/tmp/opencode/…`
  and its suites/builds run there against the branch's installed dependencies.
  No branch was checked out and no tracked file was modified (`git status` clean
  after all work).
- The contract's post-deploy assertions — every public route returns 200 and
  `/p/` signed-out returns 404 over the network — are the **live-prober's**
  evidence. Here they are covered structurally: the smoke list is 7/7 in
  `dist-public`, `/p/**` is absent from `dist-public`, and the gate's own suite
  (419 passed) pins the route table and the 404 behaviour.
- No private content was quoted; counts only.

## Related docs

- `llm/sprints/2026-09-hub/contracts/regression-tester-wave-3.md`
- `llm/sprints/2026-09-hub/handoffs/site-wave-3.md`
- `llm/sprints/2026-09-hub/handoffs/gate-wave-3.md`
- `llm/sprints/2026-09-hub/handoffs/infra-wave-3.md`
- `llm/sprints/2026-09-hub/contracts/phase-4-seams.md`
- `llm/governance/adr/0004-private-area-cloud-run-gate-behind-hosting.md`
- `llm/governance/adr/0005-two-output-build-with-leak-check.md`

## ADR candidates

- None from this role. Regression found no decision that needs recording.
