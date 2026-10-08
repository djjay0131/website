# Handoff — `Regression Tester`, Wave 6 notes-sync (D18)

Agent: Regression Tester (independent; authored nothing in this wave)
Contract: `llm/sprints/2026-09-hub/contracts/adversarial-wave-6-notes-sync.md`
§Regression Tester
Wave: 6 · Issue: #107 · Branch: `feat/annotations-sync` · HEAD: `f333a62`
Pre-wave baseline compared: `ac959a3` (the merge commit named in the task)

## Summary

**PASS — no regression found. Every suite is green and every change in count
is additive and accounted for.** The gate rose from **626** collected to **643**,
exactly the **+17** new tests in `gate/tests/test_notes_sync.py`. The site suite
is unchanged at **494 passed / 2 skipped**, both builds complete, the leak check
passes, the contract suite is unchanged at **57/57**, and `governance-checks
--layout` is **4/4**. No failure observed anywhere, so there is nothing to label
a regression.

The branch touches **only** `gate/**`, `infra/**` and `llm/**` (plus the new
notes-sync contract and the amended ADR-0022). **No `site/`, `contract/` or
`docs/` file is changed**, so the site and contract suites are definitionally
unaffected; the only `infra/` changes are the three additive files the wave
names. The existing wave-1 annotation routes behave exactly as before when sync
is disabled (the default).

## Baseline methodology — read this first

The `ac959a3` baseline was produced **read-only** with
`git archive ac959a3 | tar -x -C <tmpdir>`, then running the same
`gate/.venv/bin/python -m pytest` from the extracted tree. That is a read of the
object store, not a checkout, worktree or branch switch; no tracked file in the
working tree was touched.

One caveat, so the numbers are read correctly: a **gate-only** extraction skips
5 tests in `tests/test_monitoring_contract.py` because `infra/monitoring.tf` and
`.github/workflows/gate.yml` are not in the archive (`621 passed, 5 skipped`).
Those skips are an artefact of the partial extraction, not of the branch. A
**full-repo** extraction at `ac959a3` gives the clean baseline below.

## Per-suite results

| Suite | Baseline `ac959a3` | Branch `f333a62` | Verdict |
|---|---|---|---|
| `gate` pytest (`gate/.venv/bin/python -m pytest`) | **626 passed**, 0 skipped | **643 passed**, 0 skipped | PASS — +17, exactly the new file |
| ↳ `gate/tests/test_notes_sync.py` (new) | — (file absent) | **17 passed** | PASS — the wave's own tests |
| ↳ `gate/tests/test_annotations.py` (existing) | collects same set | **157 passed** | PASS — wave-1 behaviour intact |
| `site` npm test (`vitest run`) | no `site/` file changed | **494 passed \| 2 skipped (496)**, 34 files | PASS — unchanged |
| `site` `npm run build:public` | no `site/` file changed | **33 pages built, Complete** | PASS |
| `site` `npm run build:private` | no `site/` file changed | **7 pages, 4 items, 107 files checked (SD-7), Complete** | PASS |
| `site` `npm run check:no-private-in-public` | no `site/` file changed | **PASS** (172 files `dist-public`, 48 `dist-redirects`) | PASS |
| `contract` `npm test` (`node --test test/*.test.mjs`) | no `contract/` file changed | **57 tests, 57 pass, 0 fail** | PASS — unchanged |
| `governance-checks.mjs --layout` (repo root) | — | **4 of 4 checks passed, 0 failed** | PASS |
| `infra/` diff scope | — | `gate.tf`, `notes-sync.tf`, `variables.tf` only (+87 lines, additive) | PASS |

`build:public` / `build:private` ran the annotation leak needles too: the check
reports `annotation needles scanned: /annotations, /p/notes, hub:annotation:,
data-annotation-` and finds **none** in the public output.

### Gate count delta, accounted for exactly

`626` collected at `ac959a3` → `643` at `f333a62` is **+17**. The only new test
file is `gate/tests/test_notes_sync.py`, which collects **17** items
(`def test_` count = 17; run = `17 passed`). No pre-existing test was deleted or
skipped: the baseline's 5 environmental skips in the partial extraction are all
`test_monitoring_contract.py` and run/pass in the full checkout.

### Site / contract are untouched — proven by the diff, not just the count

`git diff --name-only ac959a3..HEAD` contains **no** `site/`, `contract/` or
`docs/` path:

```
gate/app/annotations.py        gate/tests/test_notes_sync.py
gate/app/config.py             infra/gate.tf
gate/app/main.py               infra/notes-sync.tf
gate/app/notes_sync.py         infra/variables.tf
llm/governance/adr/0022-annotation-export-transport.md
llm/governance/adr/README.md
llm/sprints/2026-09-hub/contracts/wave-6-notes-sync-seams.md
llm/sprints/2026-09-hub/contracts/gate-wave-6-notes-sync.md
llm/sprints/2026-09-hub/contracts/infra-wave-6-notes-sync.md
llm/sprints/2026-09-hub/contracts/adversarial-wave-6-notes-sync.md
```

`infra/` is the only non-`gate`/non-`llm` tree the branch touches, and only
`gate.tf` (+29), `notes-sync.tf` (+35, new) and `variables.tf` (+23) — all
insertions, zero deletions.

## Wave-1 annotation behaviour unchanged with sync disabled

Sync is off by default (`notes_export_enabled: bool = False`, and the routes'
`deps.notes_sync is None` in the tests), so every existing annotation test runs
the dormant path. Targeted named runs, all PASSED:

| Claim | Test(s) | Result |
|---|---|---|
| create / list / delete unchanged | `test_a_member_creates_a_note_and_reads_it_back`, `test_a_member_deletes_their_own_note[hosting\|direct]`, `test_delete_unknown_note_is_404` | PASS |
| cross-member isolation | `test_a_member_cannot_delete_another_members_note`, `test_a_member_cannot_read_another_members_note`, `test_the_default_list_is_only_the_callers_own`, `test_the_owner_can_delete_any_note` | PASS |
| `private, no-store` on every annotation response | `test_every_annotation_response_is_private_no_store[hosting\|direct]` | PASS |
| DELETE-id guard (log grammar / injection) | `test_delete_id_cannot_forge_the_log_grammar_or_inject_a_line[hosting\|direct]` | PASS |
| `_payload` served SAMEORIGIN | `test_a_served_payload_document_is_frameable_by_the_same_origin[hosting\|direct]` | PASS |
| disabled sync makes no change | `test_notes_sync.py::test_disabled_sync_is_a_noop` | PASS |

### The soft-delete change did not break the wave-1 delete tests

`annotations.py` switched `delete()` → `soft_delete()` (tombstone) and
`list_all`/`list_for` now exclude deleted rows. Every delete-related test in the
gate passes:

```
.venv/bin/python -m pytest -k 'delete or tombstone or dormant or disabled' -v
18 passed, 625 deselected
```

This includes all wave-1 delete/authorisation tests
(`test_a_member_deletes_their_own_note`, `test_delete_unknown_note_is_404`,
`test_a_member_cannot_delete_another_members_note`,
`test_the_owner_can_delete_any_note`, `test_delete_refuses_a_cross_origin_request`,
`test_create_and_delete_refuse_when_no_origin_is_configured`,
`test_delete_id_cannot_forge_the_log_grammar_or_inject_a_line`) and the new
tombstone tests (`test_render_records_a_tombstone_instead_of_dropping_the_entry`,
`test_destinations_group_by_intent_and_exclude_question_and_tombstones`).

## Verdict

**PASS.** No regression. All existing suites green and unchanged in count; the
gate's +17 is the notes-sync file alone; `governance-checks` 4/4; the wave-1
annotation routes are behaviourally unchanged under the disabled default.

## Transcripts (exact tails)

```
gate:  643 passed, 2 warnings in 11.85s
test_notes_sync.py: 17 passed, 2 warnings in 0.04s
test_annotations.py: 157 passed, 2 warnings in 1.41s
-k 'delete or tombstone or dormant or disabled': 18 passed, 625 deselected
baseline (full ac959a3): 626 passed, 2 warnings in 7.97s

site:  Test Files 34 passed (34)
       Tests 494 passed | 2 skipped (496), Duration 15.84s
build:public:  [build] 33 page(s) built ... [build] Complete!
build:private: [hub-private-build] checked 107 emitted path(s) against the
               gate's allowlist (SD-7) ... [build] 7 page(s) ... Complete!
check:no-private-in-public: PASS — ... 172 file(s) scanned in dist-public,
               48 in dist-redirects.

contract: # tests 57  # pass 57  # fail 0  # skipped 0
governance: PASS governance-links / adr-index / adr-status / layout
            4 of 4 checks passed, 0 failed.
```
