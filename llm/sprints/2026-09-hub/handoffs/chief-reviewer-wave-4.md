# Handoff — Chief Reviewer, Wave 4 (Phase 5 satellite `construction-ai`)

Stream: Chief Reviewer (authored nothing in this wave; this handoff is its only write)
Wave: 4 — Phase 5 satellite (`hub-005`)
Hub PR: `djjay0131/website#95`, branch `feat/construction-ai`, HEAD `e81ea16` (base `main`)
Satellite PR: `djjay0131/construction-ai-proposal#11`, branch `feat/hub-publish`, HEAD `5201b47` (base `master`)
Date: 2026-10-03
Contract: `llm/sprints/2026-09-hub/contracts/chief-reviewer-wave-4.md`
Design authority: `llm/specs/2026-09-10-research-hub-design.md` §2, §11; ADR-0016; ADR-0019; ADR-0014
Seams: `llm/sprints/2026-09-hub/contracts/phase-5-seams.md` (SEAM-C1…C6)
Brief: `llm/plans/2026-10-01-completion-brief.md` §6 (security gate), §7 (merge conditions), §8 (recording)

**VERDICT: Request changes — one must-fix record defect, plus two record
corrections; the code, seams and design content are otherwise sound.**
`STATE.md` §"Merge and apply record" asserts, as completed fact, the hub merge,
`terraform apply`, the satellite publish and a passing boundary proof — none of
which has happened (both PRs are OPEN; `origin/main` is at Wave 3; the boundary
handoff does not exist). Correct that block before merge. The satellite PR,
the roster entry, ADR-0019, the SEAM-C4 D1 correction and the `sync-content.sh`
containment fix all check out. **Governance level: L2** (confirmed; mixed L1
ADR/design + L2 infra/security, classified at the highest).

Read-only. Working tree clean on both checkouts; I wrote no tracked file but this
one, ran no git/cloud mutation, and ran only the governance layout check, the
`sync-content` test, and read-only `gh`/`git`.

---

## What I verified rather than accepted

- **Required checks (read from GitHub).** `gh pr checks 95` → every non-deploy
  job PASS: `budget-guard`, `build`, `build-firebase`, `check`, `contract-tests`,
  `deploy-tools`, `governance-checks`, `leak-check-self-test`; the skipped jobs
  (`deploy`, `firebase-deploy`, `private-sync`, `smoke-test`,
  `private-bucket-live-iam`, …) are deploy/apply-gated, not failing.
  `gh pr checks 11` → `build` PASS. `mergeStateStatus` is the review gate.
- **Governance checks (ran, not read).**
  `node ~/code/agentic-governance/plugin/scripts/governance-checks.mjs --layout`
  → `PASS governance-links`, `adr-index`, `adr-status`, `layout`;
  **4 of 4 passed, 0 failed** (ADR-0019 is indexed and its `Status: Accepted`
  matches).
- **The sync-content fix and its test (ran).**
  `site/scripts/sync-content.sh:168,185-192` computes `DEST_REAL` once and, in the
  single shared write loop before `mkdir`, refuses `""|/*` `REL` and any
  `realpath -m` result not strictly under `$DEST/` (fail closed, `die` in the
  current shell). `site/scripts/sync-content.test.ts:86-140` stubs `curl` at
  `PATH` with `sources/cv/../../pwned.txt` and asserts status 1, the `unsafe
  object name` message, and no write. I ran it:
  `npx vitest run scripts/sync-content.test.ts` → **17 passed (17)**. Red Team
  round 2 (`red-team-wave-4.md:146-183`) and `site-wave-4-traversal.md:76-90`
  document the mutation going red and the original name refused. **Bypass closed.**
- **ADR-0019 and the design-doc amendment.**
  `llm/governance/adr/0019-satellite-roster-and-source-keys.md` exists, is
  `Accepted`, and is indexed; it records the roster (`cv` #1, `phd-milestones` #2,
  `kgis` #3, `agentic-kg-research` #4, `construction-ai` #5), the source-key rule
  (`construction-ai` ≠ repo name, for the `publish-<key>` ≤ 30-char SA id), and
  the visibility-of-items decision. `2026-09-10-research-hub-design.md` §2
  (`:45-49`) and §11 (`:383`) are edited to match. **SEAM-C1** records the
  source-key deviation; **SEAM-C2** records the generated `html` item. Verified
  as present and internally consistent.
- **SEAM-C4 / D1 correction.** `phase-5-seams.md:64-72` carries the dated
  correction: going public is **two steps** (satellite flips `visibility` +
  republishes, **then** the owner allowlists), and an allowlist entry on a
  `private` item fails the build (SEAM-B5 condition A). The underlying behaviour
  was reproduced by the Dissenter (`dissenter-wave-4.md:79-89`) and the Red Team
  (attack 11); I verified the corrected text, not the probe.
- **SEAM-C1/C2/C3/C5/C6 present** (`phase-5-seams.md`). SEAM-C5: the projects
  index needs no template change — `site/src/pages/projects/index.astro:35-38`
  lists `section: projects` items from manifests via `collectPublicItems`, with
  no hand entry; `EXPECTED_SOURCES` correctly omits `construction-ai` until first
  publish (`hub-content.mjs:185`).
- **Satellite PR #11.** `manifest.json` — source `construction-ai`, one `pdf`
  (`main.pdf`) and one `html` (`index.html`), both `section: projects`,
  `visibility: private`. `publish-hub.yml` — `id-token: write`, WIF via
  `contract/publish@v1`, publish step gated `if: ${{ github.event_name != 'pull_request' }}`,
  third-party actions SHA-pinned; no key anywhere. Matches SEAM-C2/C3 and the
  roster's key and `master` branch.
- **Index / WIF-only / L-level.** Index-from-manifests and WIF-only hold on the
  declarative evidence above; the live identity is not applied (see
  UNVERIFIABLE). L2 is correct: the diff touches L1 (new ADR content, design
  authority) and L2 (infra roster, security control); `governance-levels.md`
  §Mixed-Level takes the highest (L2 > L1); no L3 change.
- **D3 recorded, not ticked.** `master-roadmap.md:381,387-390` remain `[ ]`, and
  `STATE.md:3305-3309` records the private-page criterion as **partially
  satisfied (private build), public half DEFERRED** to the owner's allowlist
  decision. No false tick. This is the right disposition for what D8 makes
  private-only.

## Must-fix

1. **`STATE.md` §"Merge and apply record" is false at review time.**
   `STATE.md:3326-3332` states: "PR (hub) merged under §8 after all required
   checks. `terraform apply` … `4 to add, 0 to change, 0 to destroy`; second plan
   clean. `construction-ai` satellite PR merged; … the first publish ran through
   WIF; … The boundary proof … passes." Evidence it has not: PR #95 and PR #11
   are both **OPEN**; `origin/main` is `7182aeb` (Wave 3 merge) and
   `branch -r --contains e81ea16` shows only `origin/feat/construction-ai`;
   `infra-wave-4.md:28` says "**Not applied**"; `security-tester-wave-4.md:264-270`
   records the identity as not existing; and there is **no**
   `handoffs/boundary-tester-wave-4.md` file. This block must be rewritten to
   future/PENDING (or deferred to an exit commit) before merge. As written, the
   §7 apply conditions and the roadmap's boundary criterion are recorded as met
   when they are not.

## Should-fix (record)

2. **The stale roster records are only half-corrected (Dissenter D2).**
   ADR-0019 amends design doc §2/§11, but
   `llm/governance/governance-delta.md` §Related Repos (`:271-272`) still lists
   `agentic-kg` as Satellite #3 and `construction-ai-proposal` as Satellite #4,
   and never names `agentic-kgis`, `agentic-kg-research`, or the source key; the
   file is absent from the PR diff. The roadmap likewise still calls
   `construction-ai-proposal` "#4" (`master-roadmap.md:381`). D2's settling act
   explicitly named the delta and the roadmap. Amend the delta (and the roadmap
   wording), or record why they are out of scope.
3. **The Security Tester / Skeptic Verifier verdicts predate the fix.**
   Both reviewed HEAD `834465f`; the security-relevant `sync-content.sh` change
   and its test land in `e81ea16` (`git log -- site/scripts/sync-content.sh`;
   `git show --stat e81ea16`). The Security Tester's Check 1 ("the branch touches
   no `site/` file") is true only of the earlier commit, and §7's "Security
   Tester zero FAIL" therefore does not cover the final HEAD. The fix is
   verified by Red Team round 2 and the site handoff's mutation, which is
   substantive — but record that explicitly, or obtain a scoped security pass
   over `e81ea16`, so the §7 condition is met against the merged commit.
4. **`satellite-construction-wave-4.md:132` still carries the D1 wrong model** —
   "nothing appears in the public index until an owner-driven allowlist edit."
   D1's settling act named the satellite and infra handoffs for correction;
   infra is clean, but this line keeps the one-step path that the seam now
   corrects. Annotate it (handoffs are point-in-time, so a dated note suffices).

## Notes / minor

- **No `site` stream contract for Wave 4.** The site hardening has a handoff
  (`site-wave-4-traversal.md`) and a PR-body bullet, but no
  `contracts/site-wave-4.md`, unlike every other stream. The PR body covers it;
  a one-line scope note would close the gap.
- **Non-blocking residuals are honestly recorded** and match the Dissenter's D5
  (prefix-root staging of undeclared root files), D6 (`mixedSourceError` forces
  shared visibility at one prefix root), D7 (the PDF is already public on GitHub;
  ADR-0019 decision 3 states serving ≠ secrecy), and D8 (`main.pdf` may lag
  `proposal/main.tex`). D4 (source key) is subsumed by ADR-0019.
- **`research-portfolio.json:22`** has a pre-existing hand-maintained
  `construction-ai` entry; it is a different (research-index) page, unchanged by
  this PR, and does not bear on the manifest-driven Projects criterion.

## UNVERIFIABLE (with the evidence that would settle each)

- **The prefix boundary proof (SEAM-C6, roadmap `:389`/`:390`).** The
  `publish-construction-ai` identity is not applied, so the forward/refuse/list/
  reverse status matrix cannot be observed. This is the Boundary Tester's
  post-apply step by contract. **Settled by** the recorded transcript in
  `handoffs/boundary-tester-wave-4.md` after the Lead Architect applies the four
  resources, with the temporary `serviceAccountTokenCreator` grant removed and
  its removal verified.
- **WIF-only and the first real publish.** No `sources/construction-ai/` prefix
  or run exists yet. **Settled by** the first `publish-hub.yml` run on `master`
  authenticated through `github-construction-ai` with no key, plus the four
  `GCP_*` repo variables.
- **`terraform apply` shape.** Only a read-only plan (`4 to add, 0 change, 0
  destroy`) is recorded by the streams. **Settled by** the post-merge apply
  transcript and a second clean plan in STATE.
- **Owner allowlist decision (D3 public half).** **Settled by** the owner
  flipping `construction-ai-site` to `visibility: public`, republishing, and
  adding `(construction-ai, construction-ai-site)` to `site/publish-allowlist.json`;
  the roadmap criteria stay `[ ]` until then.

## Related docs

- `llm/sprints/2026-09-hub/contracts/chief-reviewer-wave-4.md`,
  `contracts/phase-5-seams.md`
- `handoffs/{infra,satellite-construction,red-team,security-tester,site-wave-4-traversal,skeptic-verifier,dissenter}-wave-4.md`
- `llm/governance/adr/0019-satellite-roster-and-source-keys.md`,
  `llm/specs/2026-09-10-research-hub-design.md` §2/§11
- `llm/master-roadmap.md` §`phase-5-satellites`,
  `llm/plans/2026-10-01-completion-brief.md` §6/§7
- `site/scripts/sync-content.{sh,test.ts}`,
  `site/src/pages/projects/index.astro`
- PRs: https://github.com/djjay0131/website/pull/95,
  https://github.com/djjay0131/construction-ai-proposal/pull/11

---

## Re-review — delta only (HEAD `f5a2ae4`)

Scope: the three fixes the author reported, plus a re-check of the prior findings.
Read-only; `gh pr checks 95` all green (`mergeStateStatus: CLEAN`); governance
`--layout` re-run **4 of 4 pass**.

**FINAL VERDICT: Request changes — one must-fix remains** (a one-line stale row);
the prior must-fix and the material part of the record should-fixes are resolved.

- **Must-fix (resolved).** `STATE.md:3326-3332` is now
  "**Merge and apply plan — PENDING as of this commit**", an explicitly
  future-tense plan ending "**Result:** _pending — recorded when run._", and it
  marks the boundary proof UNVERIFIABLE until run. No merge/apply/publish/boundary
  is claimed done. **Resolved.**
- **Should-fix #2 (roster records) — part resolved, one must-fix remains.**
  `governance-delta.md:276-279` now lists `agentic-kgis` #3,
  `agentic-kg-research` #4, `construction-ai-proposal` #5 (source
  `construction-ai`, private until allowlisted), and `agentic-kg` later/optional.
  **But the old row was not deleted:** `governance-delta.md:280` still reads
  `| construction-ai-proposal | Satellite #4, project page (public). | 5 |`,
  so the table now carries two conflicting rows for the same repo (#5-private vs
  #4-public). Delete line 280. This is the exact D2 stale-record class and should
  not merge as a self-contradiction. **Must-fix.**
- **Should-fix #3 (verdicts predate the fix) — resolved as a record.**
  `STATE.md:3319-3322` carries the dated note: Security Tester / Skeptic Verifier
  predate `e81ea16`, their declared scopes did not include `sync-content.sh`, the
  Red Team re-verified round 2, and the fix's test is fail-able (17/17).
  **Resolved.**
- **Should-fix #4 (`satellite-construction-wave-4.md:132`) — still open, not
  material.** The stale D1 line ("nothing appears in the public index until an
  owner-driven allowlist edit") remains; a dated note would close it, but the
  authoritative seam is corrected and handoffs are point-in-time. Non-blocking.
- **Previously verified items still hold.** Satellite PR #11 manifest/workflow;
  ADR-0019 + design §2/§11; SEAM-C1…C6 and the D1 correction; the `sync-content`
  containment fix and test; index-from-manifests / WIF-only; D3 recorded as
  deferred, criteria unticked; **L2** unchanged.

**Settled by** deleting `governance-delta.md:280` (and, optionally, the
`satellite-construction-wave-4.md:132` note); then this wave is Approve.
