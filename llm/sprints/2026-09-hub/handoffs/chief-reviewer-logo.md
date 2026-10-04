# Handoff — Chief Reviewer, L1 follow-up wave "logo" (owner decision D16)

Agent: Chief Reviewer (independent gate; authored nothing in this wave)
Contract: `llm/sprints/2026-09-hub/contracts/logo-wave.md`
Design authority: `llm/specs/2026-10-01-branding-design.md` (amended 2026-10-04); ADR-0015 (amended 2026-10-04)
Decision: D16 (`STATE.md` 2026-10-04); related D13
Repo: `/home/djjay/code/website` · branch `feat/logo` · HEAD `2236c54` · `main` `9bd10ed`
Mode: read-only against source and built output. The only file written is this handoff; no git/gh/cloud mutation.
This report does not author, fix, or re-run the wave's own tests in place; it re-runs the checks and re-derives the numbers.

## Summary

The three surfaces are real and I reproduced them from a clean local build: the emblem is on
**27/27 chrome pages in `dist-public` and 6/6 in `dist-private`** with `alt="Jason Cusati research
emblem"`; the default `og:image` on every public chrome page is
`https://jason.cusati.us/emblem/research-emblem.png`; the badge hero is on the public home
only (0 private) with `1x/2x` `srcset`, `width/height=200`, no `loading`, and a descriptive alt;
both badge PNGs are 13,775 B and 38,611 B (<150 KB) and their segments match the gate's
`[A-Za-z0-9._-]` class; ADR-0015 / the spec / D13 are amended to acknowledge D16; no infra, gate,
Terraform, contract, or workflow path changed.

I found **no functional defect** and no security/privacy regression. But two items of the *record*
are not true as written, and one is a direct leftover of the contradiction the contract promised
to remove. The wave is mergeable on substance; it should not be merged until the record is
corrected, because the wave's own requirement 4 and the Dissenter's S2 settlement criterion are
not met while they stand.

I concur with the Dissenter's authority reading: D16 is **within the owner's authority and is not
a §9 hard stop**. It is captured by the very mechanism ADR-0015 decision 3 prescribes ("adding the
mark later is an ADR amendment"), it is owner-directed, and the “change larger than an ADR
amendment” hard stop does not apply to a change that *is* an ADR amendment. D13 is reconciled in
the D13 row ("superseded in part by D16") and the ADR/spec amendments.

## Verdict

**Comment — approved with comments.** Not Approve, because two Fix-now items must land before
merge; not Request changes, because neither is a design, security, or correctness defect in the
shipped site, and both are record/scope-level.

### Fix-now (before merge)

- **F1 — `og-card.mjs:78` still asserts "the default og:image".** The runtime log line
  ``logger.info(`generated the default og:image (no portrait): public/og-card.png`)`` was not
  touched; only the file-header comment was. The Dissenter's own S2 settlement criterion —
  ``grep -rn "default.*og:image\|default og:image" site/`` and show no hit asserts the card —
  **fails on this hit**. The four corrected sites (`og-card.mjs:1-15`, `og-card.test.ts:4-6`,
  `site-routes.mjs:40`, `astro.config.mjs:56-60`) omit it. Requirement 4's stated goal ("no
  existing source of truth is left contradicted") is therefore not met. Fix: change the string
  (no behaviour change — it is a log message, not behaviour) and adjust the contract's
  “og-card.mjs behaviour / comments-only” scope line to say so; or record the residual explicitly.
- **F2 — STATE's evidence table misstates two things.** `STATE.md:3547` says `npm test`
  **412 passed / 2 skipped**; the actual and the a11y handoff's number is **421 passed /
  2 skipped** (31 files). `STATE.md:3551` credits the **Skeptic Verifier** with “6 uncovered
  claims closed with checks” — but the Skeptic's own handoff (HEAD `a310db8`) reports the
  opposite: “**6 new claims of this wave have no guard at all**” and a table of uncovered claims
  A–F (`skeptic-verifier-logo.md:13,81-100`). The guards that closed the gaps were added in
  `95f3ab5` — a commit that also *persists* the Skeptic handoff — i.e. Lead-authored **after**
  the Skeptic's review and **never re-verified** by the Skeptic. Fix: either re-run the Skeptic on
  the `95f3ab5` guards and record the result, or restate the row honestly (“Lead-added,
  not independently re-verified; the Skeptic's A/B/C/E/F gaps only partly closed”). The §8 phrase
  “every finding dispositioned” is satisfied by “recorded + addressed”, but the attribution as
  written is false.

### Non-blocking notes

- **N1 — "emblem in the band on every page" is not guarded.** The built-output guards
  (`logo.test.ts:126-158`) read only `dist-public/index.html` and `dist-private/index.html`.
  `npm test` therefore cannot catch a change that drops the emblem from one *other* page; the
  Exit line "the emblem is in the band on every page" is verified only by the one-off a11y scan
  and by me (27/27 public chrome, 6/6 private), not by a permanent guard. Recommended: glob all
  `dist-public/**/*.html` (chrome pages) rather than the single index.
- **N2 — §8's PR-based conditions are not yet demonstrable.** `feat/logo` has no upstream
  (`git ls-remote --heads origin feat/logo` → empty) and `gh pr view feat/logo` → no PR. So
  "every required check green" in CI and "the PR body carries the data/security/privacy section"
  cannot be confirmed from the repository; only my local reproduction of the contract's evidence
  list is green. The PR must exist with the template body before the merge gate is actually met.
- **N3 — `/og-card.png` and `/og-card.svg` are retained as orphan served URLs.** No emitted HTML
  references them (`grep -rl og-card dist-public --include='*.html'` → none), but they are still
  generated, in `CI_PUBLIC_FILES`, and in the redirect map. The contract explicitly permits this
  as a follow-up (the card's behaviour is frozen by the contract), and the Security Tester found
  no exposure; I accept the retention as **non-blocking**.
- **N4 — the ADR/spec amendments name only the HokieBird.** `STATE.md` separately records the
  Dissenter's S3 source-material note (PR #70's README says every badge uses the VT mark **and**
  the HokieBird, so the asset may carry both). The ADR amendment and the spec amendment do not
  cross-reference that note. The image bytes could not be viewed by any agent (no image input);
  this is a record-completeness gap, not a served defect.
- **N5 — numeric drift.** `STATE.md:3547` "leak check PASS (211 files)" vs the actual
  `check:no-private-in-public` output: "166 file(s) scanned in dist-public, 42 in
  dist-redirects". Cosmetic, but it is the second stale figure in the same row (see F2).

### Deliberately not raised

- The emblem as a **square 1200×1200** PNG replacing a 1200×630 card (Dissenter S5) is an owner
  choice the amendment records; #71 did the same. Not a defect.
- The **0.6 px burnt-orange rim at 40 px** and the logotype exemption (S4) are correctly
  characterised by the a11y handoff and the amended `logo.test.ts:110-123`; the white disc
  (8.86:1) carries legibility. Not a defect.
- The **duplicate home link** (emblem anchor + wordmark anchor) passes WCAG 2.4.4 and is a common
  pattern; accepted by the a11y pass. Not raised.

## Scope

Every changed path is inside the contract. `--name-status` vs `main...feat/logo`:

| Path | In contract scope | Notes |
|---|---|---|
| `site/src/components/SiteBand.astro` | yes | emblem mark, as specified |
| `site/src/pages/index.astro` | yes | badge hero |
| `site/src/layouts/Base.astro` | yes | OG default |
| `site/public/badges/…today{,-2x}.png` | yes | only that PNG; PR #70 untouched |
| `site/redirects/github-pages.json` | yes | two sorted entries |
| `site/scripts/logo.test.ts` | yes | new guards |
| `site/astro.config.mjs`, `site/scripts/og-card.mjs`, `og-card.test.ts`, `site-routes.mjs` | yes, **comments only** | independently verified below |
| ADR-0015, branding spec, STATE, wave records | yes | |

**"Comments only" is true for the four files.** Filtering the diff to non-header `+`/`-` lines
shows every changed line is a `//` comment (numbers unchanged, no control flow, no exported
values). `site-routes.mjs`'s `export const CI_PUBLIC_FILES = ["build-info.json", "og-card.png"]`
appears in the diff as *context*, not a change. The one residual non-comment string is
`og-card.mjs:78` (F1) — and it was **left unchanged**, which is precisely the problem.

**Must-NOT-touch is clean:** `git diff --name-only main...feat/logo -- gate infra contract
.github firebase.json site/firebase.json` is empty. No Terraform, gate, workflow, or
`contract/manifest.schema.json` change. Only the two badge PNGs under `site/public/` were added;
`site/public/emblem/` already existed on `main`. PR #70 is still `OPEN`/`isDraft:true`.

## Findings

### Record / authority

- **D16 is recorded at the right authority.** A row in STATE's decision table with the owner
  caveat **verbatim** (`STATE.md:496,501-505`), plus dated amendments to ADR-0015 (2026-10-04)
  and the branding spec (§3 and §6) and the D13 row reconciled ("superseded in part by D16").
  The verbatim caveat in ADR-0015 and STATE match character-for-character.
- **No contradiction left at the intended authority.** ADR-0015 decision 3 ("no mark without
  permission") is explicitly overridden "for exactly one asset"; ADR-0015 decision 1's OG card is
  superseded; D13's "no VT logo or HokieBird is ever served" is amended in its own row. The only
  contradiction left is the stale runtime string at `og-card.mjs:78` (F1), which is a build log,
  not an authority document, but which the contract's requirement 4 promised to remove.
- **Not a §9 hard stop.** The §9 list (`llm/plans/2026-10-01-completion-brief.md:160-167`) bars
  "a design-authority change larger than an ADR amendment". D16 is an ADR amendment — the exact
  mechanism ADR-0015 decision 3 prescribes — and it is owner-directed on the owner's own site, so
  it is an exercise of the owner's authority, not an autonomous agent path that must stop.

### Guard quality (the repo's stated failure mode is vacuous guards)

- I ran the Skeptic's own kill-shots myself against the *final* HEAD, reading the actual files:
  the source-level guards are genuine — commenting out the emblem `<a>` block, changing the OG
  default, dropping the badge `srcset`, or renaming the `-2x` asset each make `logo.test.ts`
  fail (and the `@2x` rename fails `build:private` SD-7). The exaggerated earlier claim is not
  present at this HEAD.
- The **contrast guard is now ring-specific** (`logo.test.ts:110-123` matches `r="188"` with
  `fill="#e5751f"`), closing the Skeptic's guard-8 precision gap.
- **But the built-output guards are narrow** (N1): one file each. The dissenter's and skeptic's
  claim A ("emblem on every page") is still not permanently guarded, and the ring's *dark-theme
  invariance* and the badge's *visibility* (claim C, `display:none`) remain unguarded — though
  the a11y pass and my scan confirm both are correct today.

### Where the handoffs overreach (adversarial read)

- The dissenter accurately *describes* S1–S7, but its head note "(a failed build)" and raw
  `logo.test.ts` "10/10" predate the final guards; it did not see `95f3ab5`.
- The skeptic report is honest about its own scope (HEAD `a310db8`, 10 tests) but is quoted by
  STATE as if it had verified the later guards — it had not (F2).
- The a11y handoff's `npm test 421` is correct; STATE's 412 is stale (F2).

## §8 status

| Condition (STATE §"Standing gap" transcription) | Status | Evidence |
|---|---|---|
| every required check green | **LOCAL green; CI not run** | reproduced: `npm test` 421/2; `contrast` 56/0; `build` 27 pages; `build:private` 102 paths; `check:no-private-in-public` PASS; `check:private-links` PASS; `check:publish-allowlist` PASS; `check:smoke-routes` PASS; `redirects:stubs` PASS. No PR/push → CI unverifiable (N2). |
| Chief Reviewer Approve or Comment | **Comment** | this report |
| Security Tester zero FAIL | **PASS** | handoff says 0; I re-confirmed empty gate/infra/firebase diff and only two new public files |
| every Red Team/Skeptic finding dispositioned | **PARTIAL** | S1/S2 fixed; but the Skeptic's 6 uncovered claims were partly closed by Lead-authored `95f3ab5` and *not* re-verified, and STATE misattributes it (F2, N1) |
| Skeptic no un-failable guard | **PASS** | handoff reports 0 un-failable; guards are genuinely fail-able at HEAD |
| `governance-checks --layout` green | **PASS** | reran `node ../agentic-governance/plugin/scripts/governance-checks.mjs --layout` → 4/4, exit 0 |
| PR body carries data/security/privacy section | **NOT YET** | no PR exists (N2) |

## Evidence checked

Commands I ran, read-only, on `feat/logo` at `2236c54`:

- `npm test` → 31 files, **421 passed | 2 skipped**.
- `npm run contrast` → **56 pairs, 0 below AA** (emblem pair absent from `contrast.mjs`; covered by `npm test`).
- `npm run build` → 27 pages, exit 0; `npm run build:private` → 6 pages, SD-7 "checked 102 emitted path(s)".
- `npm run demo:leak-check` → PASS (red→green); `npm run check:no-private-in-public` → PASS (166 public + 42 redirect files).
- `npm run check:private-links` / `check:publish-allowlist` / `check:smoke-routes` / `redirects:stubs` → PASS.
- `node scripts/generate-redirect-map.mjs --check` → exit 1, but the two badge routes are **not** in the missing list (pre-existing misses: `_payload/kgis/*`, fixture projects, `kgis-docs`).
- `node ../agentic-governance/plugin/scripts/governance-checks.mjs --layout` → 4 of 4 passed, exit 0.
- Own HTML scan: `dist-public` 33 HTML files, 27 chrome, **27 with emblem**, 27 with `og:image`, 1 with badge; `dist-private` 12 HTML files, 6 chrome, **6 with emblem**, 0 with `og:image`, 0 with badge.
- Computed with the repo's own `contrastRatio`: `#e5751f` on `#861f41` = **3.0166:1**, `#fbfbf8` on `#861f41` = **8.8610:1**; dark `--color-band` = `#861f41` (identical).
- `fs.statSync`: badges 13,775 B / 38,611 B; emblem PNG 190,461 B. Gate regex `^[A-Za-z0-9._-]+$` accepts both badge segments.
- Diff-filtered the four comment-only files (all added/removed lines are `//`) and the gate/infra/firebase/workflow paths (**empty**).
- `gh pr view 70` → OPEN, draft, head `assets/research-badges`; `gh pr view feat/logo` → none.

## Notes

- **Authorship.** Every commit on the branch is authored by the Lead Architect (`djjay@vt.edu`);
  the four adversaries' handoffs each state they authored no source. The only authorship wrinkle
  is process, not code: the `95f3ab5` guards that answer the Skeptic were written by the Lead and
  committed together with the Skeptic's frozen report, which is why STATE's attribution to the
  Skeptic is wrong (F2).
- **og-card retention.** Accepted as non-blocking per the contract's explicit follow-up carve-out;
  the residual concern is the stale log string (F1) and the orphan URLs (N3), not a served risk.
- **The badge is knowingly served without permission.** The record is explicit that no permission
  is claimed and no precedent set; the owner owns the risk. As a reviewer I confirm the mechanism
  (owner decision + ADR amendment) matches ADR-0015's own prescribed path, so the agent did not
  cross a §9 hard stop.
- **Owner action still outstanding:** decide the `og-card` retirement follow-up, and (if desired)
  confirm whether the badge depicts the registered VT mark in addition to the HokieBird (N4).

## Related docs

- `llm/sprints/2026-09-hub/contracts/logo-wave.md`
- `llm/governance/adr/0015-branding-no-portrait-band-and-mark-rule.md` (2026-10-04 amendment)
- `llm/specs/2026-10-01-branding-design.md` §3, §6 amendments
- `llm/sprints/2026-09-hub/STATE.md` D13, D16, §"Standing gap", logo round table
- `llm/sprints/2026-09-hub/handoffs/{dissenter,skeptic-verifier,security-tester,a11y-tester}-logo.md`
- `llm/plans/2026-10-01-completion-brief.md` §7, §9
- `git diff main...feat/logo`; `git log --oneline main..feat/logo`

## ADR candidates

- **"A completed record may not cite an adversary's report for work the adversary did not see."**
  When the Lead adds guards to answer a reviewer, a fresh reviewer round (or an explicit
  "Lead-added, unverified" annotation) is required before STATE may attribute the closure. This
  would have prevented F2.
- **"Superseding a default removes every positive claim of the old default, including log
  strings."** Requirement 4's grep must include non-comment strings and emitted build output, not
  only source comments. This would have caught F1.
- **"Rendered-surface Exit criteria are pinned across all pages, not the index."** Carry the
  Skeptic's ADR candidate: build-output guards must glob the whole output when the criterion says
  "every page". This would close N1.
