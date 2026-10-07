# Handoff — `Regression Tester`, Wave 6 (annotations)

Agent: Regression Tester (independent; authored nothing in this wave)
Contract: `llm/sprints/2026-09-hub/contracts/regression-tester-wave-6.md`
Wave: 6 · Issue: #107 · Branch: `feat/annotations` · HEAD: `c557485`
Pre-wave baseline compared: `main` @ `4f33edc`

## Summary

**No regressions found. PASS on every suite in the contract.** Every number that
changed is additive and explained; nothing that worked at `4f33edc` stopped
working.

The wave's own surfaces behave as designed: the annotation needles are now part
of the leak check and it stayed green on the clean build; the demo still fails
as intended; `X-Frame-Options` was relaxed **only** for a served `_payload`
document; `/share`, `/s/**`, `/p/**` and `/session/*` are unchanged; and
`/p/notes/` is private-build only.

## Baseline methodology — read this first

The contract forbids git/gh mutations and tracked-file changes, and the
precedent set by `regression-tester-wave-1.md` is that a checkout or a worktree
is such a mutation. I therefore did **not** re-run the suites at `main`:

- **Pre-wave counts are the recorded baselines**, from the contract and the
  wave-6 stream handoffs: site **421 passed / 2 skipped / 31 files**
  (contract; `site-wave-6.md:81`), gate **455 passed** (`gate-wave-6.md:57`),
  contract **57 / 0** (unchanged — `git diff 4f33edc..HEAD -- contract/` is
  empty), governance **4/4**.
- **Post counts are observed** on `feat/annotations` @ `c557485`, from the
  repo's existing `site/node_modules` and `gate/.venv` (no `npm ci`, no network,
  no credential).
- Two stream handoffs predate the Red Team fix commit `c557485` and record
  `site 488/2` (`site-wave-6.md:80`) and `gate 624` (`gate-wave-6.md:56`); my
  observed figures are 3 and 2 higher respectively, exactly the tests that fix
  added. See "Count deltas explained".

## Per-suite results (pre → post → verdict)

### `site` (from `site/`)

| Suite | Pre-baseline (`main` @ `4f33edc`) | Post (`c557485`) | Verdict |
|---|---|---|---|
| `npm test` | 421 passed / 2 skipped (31 files) | **491 passed / 2 skipped (34 files)** | **PASS** (+70, explained) |
| `npm run build:public` | 33 page(s) | **33 page(s)** | **PASS** (unchanged) |
| `npm run build:private` | 6 page(s) | **7 page(s)** | **PASS** (+1, `/notes/`, expected) |
| `npm run check:no-private-in-public` | PASS | **PASS** (226 files + 48 stubs; annotation needles scanned) | **PASS** |
| `npm run check:private-links` | PASS | **PASS** (13 page(s), 151 allowed anchors) | **PASS** |
| `npm run check:publish-allowlist` | PASS | **PASS** (mode pr; 20 entries, 0 conflicts, 0 stale) | **PASS** |
| `npm run check:smoke-routes` | 7/7 | **7/7** | **PASS** |
| `npm run contrast` | 56 pairs, 0 below AA | **56 pairs, 0 below AA** | **PASS** |
| `npm run demo:leak-check` | exit 0, caught the leak | **exit 0, caught the leak in all 10 outputs** | **PASS** |

### `gate` (from `gate/`)

| Suite | Pre-baseline | Post | Verdict |
|---|---|---|---|
| `.venv/bin/python -m pytest` | 455 passed | **626 passed, 2 warnings** | **PASS** (+171, explained) |
| — `tests/test_annotations.py` | 0 (new) | 157 | new |
| — `tests/test_shares.py` | (unchanged file) | 165 | **PASS** |
| — `tests/test_headers.py` | (unchanged behaviour) | 28 | **PASS** |
| — `tests/test_session.py` | — | 24 | **PASS** |
| — `tests/test_serve.py` | — | 32 | **PASS** |
| — `tests/test_scope.py` | — | 22 | **PASS** |
| — all others (`paths` 106, `signout` 52, `client_events` 17, `monitoring_contract` 16, `logging_config` 7) | — | 269 | **PASS** |

The header/share/session/serve/scope subset was also run on its own:
**271 passed** in 2.58s.

### `contract` (from `contract/`)

| Suite | Pre-baseline | Post | Verdict |
|---|---|---|---|
| `npm test` (`node --test test/*.test.mjs`) | 57 pass / 0 fail | **57 pass / 0 fail** (17 subtests) | **PASS** (unchanged; no `contract/**` diff) |

### Governance (from repo root)

| Check | Pre-baseline | Post | Verdict |
|---|---|---|---|
| `node ~/code/agentic-governance/plugin/scripts/governance-checks.mjs --layout` | 4/4 | **4 of 4 checks passed, 0 failed** | **PASS** |

## Count deltas explained

**site: 423 → 493 tests (+70 passed; skipped unchanged at 2).** All additive:

- `src-private/lib/annotations.test.ts` — 36 (new)
- `scripts/export-notes.test.ts` — 14 (new)
- `scripts/wave-6-structure.test.ts` — 11 (new)
- `scripts/check-no-private-in-public.test.ts` — +9 (AN-LEAK / entity / left-boundary
  cases added)
- `scripts/private-structure.test.ts` — modified (one-way import guards extended)
  but net test count unchanged (12 → 12)

36 + 14 + 11 + 9 = 70. Files 31 → 34 (+3 new). The two skipped tests are
pre-existing build-dependent ones and are the same two:
`route-inventory.test.ts` (build-inventory, `REDIRECT_MAP_CHECK_BUILD`) and
`wave-5-structure.test.ts` (search-index present). Both skips are their normal
gated state, not new.

**gate: 455 → 626 (+171).** `test_annotations.py` contributes 157 (the handoff
recorded 155; `c557485` added 2). The remaining **+14** are in the wave's edited
files — `test_headers.py` gained the `_payload` SAMEORIGIN/DENY and
prefix-stripping cases, `test_scope.py` gained the 3 annotation routes, and the
Red Team fix added cases in the share/session area. This matches
`gate-wave-6.md` exactly: baseline 455 + 169 (155 annotation + 14 elsewhere) =
624 recorded, **+2** from `c557485` = **626** observed.

**contract: 57 → 57 (0 delta).** Wave 6 touched no file under `contract/`
(verified by `git diff --stat 4f33edc..HEAD -- contract/`, empty), so the count
cannot move.

## Wave-6-specific findings

### 1. Leak check gained annotation needles and stayed green; demo still fails — PASS

`check-no-private-in-public.mjs` now defines and scans four fixed needles
(`ANNOTATION_NEEDLES = ["/annotations", "/p/notes", "hub:annotation:",
"data-annotation-"]`), independent of any manifest, with a left-boundary rule for
`data-annotation-` so the CV citation key `tan-2024-llm-data-annotation-survey`
does not trip it. On the clean build:

```
check:no-private-in-public: annotation needles scanned: /annotations, /p/notes, hub:annotation:, data-annotation-
check:no-private-in-public: PASS — … none of the annotation needles … appears
  (226 file(s) scanned in dist-public, 48 in dist-redirects).
EXIT=0
```

The demo still goes red as designed and the guard caught the injected private
item in **all 10 outputs** (`index.html` path+contents, `rss.xml`,
`sitemap-0.xml`, `pagefind/pagefind-entry.json`, the three gzip `.pf_*`
payloads, the OG card path, the redirect stub):

```
demo:leak-check: the check exited 1 (1 means it caught the leak).
demo:leak-check: PASS — the guard failed on the injected leak in all 10 output(s) …
EXIT=0
```

The check was run with the Pagefind index built (`npm run search:index`), as CI
does, so the derived-output coverage (og-card 2, search-text 10, rss 1,
sitemap 2) is exercised. Scanned-file count (226) is above the Wave-5 figure
(211) because the tree has grown since; the guard is green in both.

### 2. `X-Frame-Options` did not relax any non-`_payload` response — PASS

`gate/app/main.py` sends `DENY` as the default and switches to `SAMEORIGIN`
**only** when `request.state.served_object_name`, with the private prefix
stripped, is `_payload` or begins `_payload/`. That state is set in
`serve_private` on the successful 200 path only (`main.py:542`); it is absent on
every non-`/p` route, and a 404/refusal/traversal never reaches the assignment.
`gate/tests/test_headers.py` (28 tests, all pass) pins exactly this:

- `test_a_served_payload_document_is_frameable_by_the_same_origin` → SAMEORIGIN
- `test_a_non_payload_document_keeps_deny` → DENY
- `test_a_refused_or_missing_payload_keeps_deny` (signed-out, missing,
  traversal) → 404 + DENY
- `test_a_payload_document_under_a_private_prefix_is_frameable` → strip prefix,
  then SAMEORIGIN
- `test_the_payload_object_check_strips_the_private_prefix` → 7 parametrised
  cases including `_payloadx/a`, `phd/_payload/a`, `hubx/_payload/a`, all False
- `test_security_headers_are_present` → non-payload gets `x-frame-options: DENY`

No non-`_payload` response was relaxed.

### 3. `/share`, `/s/**`, `/p/**`, `/session/*` unchanged — PASS

The shares suite (165 tests) pins `/share` POST/GET/DELETE and every `/s/**`
view including `private, no-store`; `test_session.py` (24) and
`test_serve.py` (32) pin `/session` and `/p/**`; `test_scope.py` (22) pins the
exact route table (with the three new annotation routes added — the only route
change). All green. Combined targeted run: **271 passed**.

### 4. `/p/notes/` private-only; item frames and Shares page still emitted — PASS

- `dist-public` contains **no** `notes/` path, no `/p/notes`, no `/annotations`
  and no annotation DOM string (the only `data-annotation` hits are the two
  research pages carrying the hyphenated citation key, which the left-boundary
  rule correctly ignores). Confirmed by `find`/grep and by the leak check.
- `dist-private` emits `/notes/index.html` (new), `/shares/index.html`
  (unchanged) and the **four** existing item frames
  (`cv/cv/anthropic-fellow/`, `phd/phd-milestones/committee-dossier/`,
  `phd/phd-milestones/milestones/`, `projects/phd-milestones/internal-notes/`),
  plus the `_payload` / `_doc` staged copies.
- `build:private` → 7 pages (index + shares + notes + 4 frames), one more than
  the pre-wave 6 and expected; `build:public` is unchanged at 33 pages.

### 5. `governance-checks --layout` — PASS (4/4)

`PASS governance-links / adr-index / adr-status / layout`, `4 of 4 checks
passed, 0 failed`.

## Evidence — verbatim tails

```
$ cd site && npm test
 Test Files  34 passed (34)
      Tests  491 passed | 2 skipped (493)

$ cd gate && .venv/bin/python -m pytest
626 passed, 2 warnings in 11.07s

$ cd contract && npm test
# tests 57
# pass 57
# fail 0

$ cd site && npm run build:public
[build] 33 page(s) built in 2.07s

$ cd site && npm run build:private
[hub-private-build] staged 5 payload file(s) for 4 private item(s) from their containing directories
[hub-private-build] checked 107 emitted path(s) against the gate's allowlist (SD-7)
[build] 7 page(s) built in 1.67s

$ cd site && npm run check:private-links
check:private-links: PASS — every link in 13 page(s) resolves under /p/ …

$ cd site && npm run check:publish-allowlist
check:publish-allowlist: PASS (mode pr) — 20 entries, 0 conflicts, 0 stale.

$ cd site && npm run check:smoke-routes
check:smoke-routes: all 7 smoke routes present in dist-public

$ cd site && npm run contrast
56 pairs, 0 below AA
```

## Assumptions

- "Pre-wave" is `main` @ `4f33edc`; its counts are cited, not re-run, under the
  read-only rule (same stance as `regression-tester-wave-1.md`). The baselines
  are corroborated in two independent places (contract + stream handoffs), and
  the arithmetic of every delta closes exactly.
- `gate-wave-6.md`'s gate baseline (455) and `site-wave-6.md`'s site baseline
  (421/2) are the same numbers the contract names for this wave.
- The build/content tree is the credential-free fixture (`npm run
  content:fixture`), which any contributor can reproduce; the fixture is
  current relative to `4f33edc` (wave 6 changed no `site/fixtures/**`).

## Risks

- The only sub-baseline figure I could not re-derive is `main`'s gate **per-file**
  breakdown; the total (455) is the recorded one. The post per-file breakdown and
  the total both reconcile to the observed 626.
- The leak check's scanned-file count is not directly comparable run-to-run
  (content and pages have grown); it is reported, but the pass/fail property, not
  the count, is the guard.

## Open questions

- None blocking. The dissenter's D1 (owner reads all members' notes with no
  notice/consent) and the Red Team's export-injection residuals are product/security
  decisions for the wave's owners, not regressions against `4f33edc`; they are
  recorded here only so they are not mistaken for regression findings.

## Related docs

- `llm/sprints/2026-09-hub/contracts/regression-tester-wave-6.md`
- `llm/sprints/2026-09-hub/handoffs/site-wave-6.md`, `gate-wave-6.md`
- `llm/sprints/2026-09-hub/handoffs/red-team-wave-6.md`, `skeptic-verifier-wave-6.md`
- `llm/governance/adr/0005-two-output-build-with-leak-check.md`
- `llm/governance/adr/0021-annotations-private-item-notes.md`

## ADR candidates

- None from this role. Regression found no decision that needs recording.
