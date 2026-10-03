# Handoff — Chief Reviewer, Wave 3 (Phase 4 sharing)

Stream: Chief Reviewer (authored nothing in this wave; this handoff is its only write)
Wave: 3 — Phase 4 sharing (`hub-004`); PR #93
Branch: `feat/sharing` (HEAD `46af523`)
Date: 2026-10-03
Contract: `llm/sprints/2026-09-hub/contracts/chief-reviewer-wave-3.md`
Design authority: `llm/specs/2026-09-10-research-hub-design.md` §6 resp. 4 (as amended), §11 Phase 4
Seams: `llm/sprints/2026-09-hub/contracts/phase-4-seams.md`

**VERDICT: Comment.** Approve-with-comments: nothing in the committed tree blocks
merge. The share model (`_doc` + `entry`) is faithful to design doc §6 as amended
and to SEAM-S1 in code, not only in prose; Security Tester round 2 is 0 FAIL; Red
Team round 2 is 0 BYPASS; the Skeptic Verifier reports 0 un-failable guards and 0
coverage gaps; governance `--layout` is green. No *Fix now*. Four should-fix /
record items (STATE staleness, a contract scope omission, the not-yet-committed
round records, and the memory-bank checkbox) are below and do not gate the merge.
**Governance level: L2** (confirmed; no escalation, cannot de-escalate).

Read-only. `git status --short` shows six untracked round handoffs
(`dissenter-wave-3.md`, `red-team-wave-3{,-round2}.md`,
`security-tester-wave-3{,-round2}.md`, `regression-tester-wave-3.md`) and no
tracked edit by me. I ran no build, no test suite, no git or cloud mutation; I
read the tree and PR head, and ran only the governance layout check.

---

## What I verified rather than accepted

- **Governance `--layout` (ran, not read).**
  `node ~/code/agentic-governance/plugin/scripts/governance-checks.mjs --layout`
  → `PASS governance-links`, `adr-index`, `adr-status`, `layout`;
  **4 of 4 checks passed, 0 failed**.
- **Required checks (read from GitHub).** `gh pr checks 93` → every non-deploy
  job SUCCESS: `governance-checks`, `build`, `test`, `budget-guard`,
  `contract-tests`, `leak-check-self-test`, `deploy-tools`, `check`,
  `build-firebase`. The skipped jobs (`deploy`, `firebase-deploy`,
  `private-sync`, `smoke-test`, `private-bucket-live-iam`, …) are
  merge/deploy-gated, not failing. `mergeStateStatus: BLOCKED` is the review
  gate, not a red check. I did **not** re-run `pytest`/`vitest` locally; CI green
  plus the handoffs are my evidence.
- **SEAM-S1 upheld in code (the seam defect the contract names).**
  `section`/`entry` are stored and used, not merely described:
  `gate/app/shares.py:61,64` (`Share.section`, `.entry`),
  `:151-154` (`create` writes all eight fields), `:100-108`
  (`_share_from_document` refuses a row missing `entry`);
  `gate/app/main.py:958-983` (`_share_item_prefix` returns
  `<section>/<source>/<slug>/_doc`, and `:981` makes `section`/`source`
  single-segment); `:934,938` (`_share_entry` defaults `index.html`, else
  `safe_prefix`); `:652-653` (empty path serves the stored `entry`);
  `:656` (`safe_object_path(path, prefix)` re-confines). Site side:
  `site/src/lib/frame-content.mjs:44` (`SHARE_DOC_ROOT = "_doc"`),
  `:241-319` (`docStagingPlanFor`: entry copied under its own basename, `:270-271`;
  assets preserved; sibling-declared documents excluded, `:297`), wired at
  `site/scripts/private-build.mjs:99,126`.
- **Prior-round findings resolved.**
  (a) bare `/share` rewrite: `firebase.json:39-45`.
  (b) log leak (D5): `gate/app/main.py:562-566` logs `id=%s by=%s` only; guarded
  by `gate/tests/test_shares.py:801` `test_the_mint_log_carries_no_item_material`,
  which the Skeptic's break #12 confirmed red.
  (c) D1 (`_doc`): above; `test_shares.py:605,626` are the direct-request frame /
  `_payload` guards the Skeptic's W1/W2/C3 forced into existence.
  (d) `entry`/content-type: `main.py:162` + `serve.py:121-133`
  (extension-first); `test_shares.py:162`; round-2 observed
  `application/pdf` for a `.pdf` entry.
  (e) `datastore.user` recorded: ADR-0018; `infra/gate.tf`; `infra-wave-3.md`
  plan `1 to add, 0 to change, 1 to destroy` (the IAM member only; no stateful
  resource), cross-checked by the Security Tester's own read-only plan.
  (f) design §6 amended: `llm/specs/2026-09-10-research-hub-design.md:221-227`
  (dated note adding `(section, source, slug)` + `entry` + `_doc/`).
  (g) D3 restated as a real risk: ADR-0018 §Negative/Tradeoffs names the
  `members/`-write owner backdoor explicitly rather than calling the class+rules
  a bound.
  (h) stale record: `contracts/security-tester-wave-0.md:99` now `datastore.user`
  with a dated `CORRECTED 2026-10-03` note at `:102-107`, authorised by
  `infra-wave-3.md` scope bullet 3.
- **§8 conditions.** Security Tester round 2: **0 FAIL** (9/10 PASS; one
  pre-existing Wave 0 sub-clause unmet, explicitly out of wave 3 scope; Check 10
  live logging NOT TESTED). Red Team round 2: **0 BYPASS** (6 groups refused,
  2 considered-and-dismissed). Skeptic Verifier: **0 un-failable guards, 0
  coverage gaps** after commit `46af523`, which adds the four missing/hardened
  guards (`test_shares.py:775,789,801,528`, `:605,626`). PR body carries
  `## Data, Security and Privacy Impact` (answered).
- **Scope.** All 55 changed paths classify inside a declared stream:
  `gate/**` (gate contract), `site/**` + `firebase.json` (site contract),
  `infra/**` (infra contract), and `llm/**` records/design (Lead Architect).
  No secret, key, state or machine path: `git diff main...HEAD` matched no key
  material; the only `/home/...` strings are the repository path in handoff
  prose, as in every prior handoff.
- **Design authority.** The share model matches §6 resp. 4 as amended and §11
  Phase 4 (mint/list/revoke + Shares page); §11 is untouched and nothing in this
  PR ticks a roadmap acceptance criterion (SEAM-S7 is the owner's live step), so
  the L2 classification is right.

## Governance level

**L2 — Implementation.** The PR is mixed-level: **L1** for new ADR content
(0017, 0018) and the design-authority amendment (§6), **L2** for production code
(gate routes/store, auth `is_owner`, IAM widening, rewrites, private build).
`governance-levels.md` §Mixed-Level classifies at the highest level touched
(L2 > L1), and there is no L3 (no requirements, product scope, persona, workflow
or privacy-policy change; Phase 4's criterion stays unticked pending SEAM-S7).
The PR body's own one-line justification is consistent. No AI role may move
this down; I see no basis to move it up.

---

## Should-fix

1. **`STATE.md:3138-3166` is a stale mid-wave snapshot.** It still says
   "in progress"; its "**Still to do in Wave 3**" paragraph lists the gate
   `section` follow-up, the `site` stream, the `infra` stream and the
   adversarial round — all of which are present in this PR — and it carries no
   §8 five-line status or round result. Evidence: `git diff main...HEAD --
   llm/sprints/2026-09-hub/STATE.md` adds only that block; the file's last line
   is "Nothing merged yet." Update STATE at wave close so the record does not
   contradict the merged tree (as the wave-0b/0c exit commits did). Not a
   blocker: wave close is the recording point.
2. **The `site` contract does not name `site/src/lib/frame-content.mjs`.** The
   PR changes it (+154: `SHARE_DOC_ROOT`, `docStagingPlanFor`,
   `shareDocRootFor`), and it is the home of the item-scoped plan requirement 8
   describes, but `site-wave-3.md`'s Scope list names only `src-private/**`,
   `astro.config.mjs`, `src/lib`'s sibling `scripts/**`, and the package files.
   The stream header (`site`, `site/**`, `firebase.json`) covers it and the
   change is additive and public-safe (Regression Tester: public build is
   byte-for-byte 26 pages; `git diff main...HEAD -- site/src/` is empty), so the
   contract is not violated — but it should name the file. Evidence to settle:
   add it to the Scope/Addendum.
3. **Memory-bank checkbox overstates at review time.** The PR body checks
   "Memory-bank update included (at wave close)", but `llm/memory_bank/*` is
   unmodified and absent from the diff. In wave 0c the memory bank landed in the
   post-merge `docs(records): Wave 0c exit` commit `545475d`, i.e. at exit, not
   in the implementation PR — so the intent is plausible, but the checkbox
   should either name that exit-time L0 commit or be unchecked until it exists.
4. **The independent round records are not yet on the branch.** At HEAD the six
   files named in the opened paragraph are untracked and absent from
   `gh pr diff 93 --name-only`, and the PR body's "Related Documents" cites them.
   This is expected at review time — wave-0b `c4d376d` and wave-0c `808f3fa`
   committed the round records (including the Chief Reviewer's) into the
   implementation branch before merge, and this reviewer is likewise untracked.
   Ensure the Lead Architect's round-records commit lands them (and this file)
   before merge so the §8 record is complete. Not a defect in the diff.

## Notes

- **D4 (revoke-by-display-id) and D6 (cost measurement) remain fix-later.**
  D4 is dispositioned and stated (gate ruling 2; PR Open Questions; the island's
  paste-a-link fallback at `site/src-private/lib/shares.mjs:171-178,331-349`),
  so the "revoke" promise is caveated rather than silently incomplete. D6 has no
  surviving overclaim — `phase-4-seams.md` makes no "sound cost model" assertion
  — so it is carried, not contradicted.
- **Red Team dismissed observation B — `_doc` reservation is exact-match.**
  `frame-content.mjs:258` skips only `source === "_doc" || slug === "_doc"`, and
  the gate's `_share_item_prefix` has no `_`-reservation at all; a slug
  `foo/_doc` would nest inside item `foo`'s tree. Unreachable today because both
  slug patterns reject `_` (`content.config.ts:66`, `hub-content.mjs:356-358`).
  A segment-aware reservation in both places would be defence-in-depth if the
  charset ever loosens.
- **Red Team dismissed observation A — `trailingSlash: true` and the bare
  `/share` POST.** `SHARE_ENDPOINT = "/share"` and Hosting's `trailingSlash`
  could 301 the bare path; if a POST is redirected to a GET the mint fails
  (fail-closed). Not verifiable pre-deploy; see UNVERIFIABLE.
- **ADRs land as `Status: Accepted`.** The template default is `Proposed`, but
  ADRs 0010–0016 all landed Accepted; 0017/0018 are consistent with the repo
  convention, so no action.
- **`_share_item_prefix` uses no hardcoded section enum** (`main.py:958-983`),
  matching the Lead Architect's ruling 1; an object that does not exist still
  404s, and the item is validated for shape only at mint.

## UNVERIFIABLE (with the evidence that would settle each)

- **SEAM-S7 — owner live mint/open/revoke.** The harness cannot mint as the
  owner. Settled by the owner opening a real 14-day link signed-out, then
  revoking and re-testing, post-deploy.
- **`/s/**` + `/share/**` live Hosting rewrite binding, including the
  `trailingSlash`/POST question.** Settled by the first deployed revision
  (Live Prober's contract) — e.g. `curl -X POST https://<host>/share`.
- **Check 10 — do the `event=` share lines actually reach Cloud Logging?**
  Round 2 captured them at the gate's own handler only; live reach is
  post-deploy. Settled by a Cloud Logging query after the owner's mint.
- **A7 / issue #51 closure ("the `/s/**` half is proven").** The
  `private, no-store` half is unit- and HTTP-test-verified here; the live
  signed-out read is the post-deploy probe.

## Related docs

- `llm/sprints/2026-09-hub/contracts/chief-reviewer-wave-3.md`
- `llm/sprints/2026-09-hub/contracts/phase-4-seams.md` (SEAM-S1, all amendments)
- `llm/sprints/2026-09-hub/contracts/{gate,site,infra}-wave-3.md`
- `llm/governance/adr/0017-shares-serve-the-item-document.md`, `0018-…`
- `llm/specs/2026-09-10-research-hub-design.md` §6, §11
- `handoffs/{gate,site,infra}-wave-3*.md`, `handoffs/skeptic-verifier-wave-3.md`,
  and the six untracked round handoffs
- `gate/app/{main,shares,serve,members,config}.py`,
  `gate/tests/{test_shares,test_scope}.py`
- `site/src/lib/frame-content.mjs`, `site/src-private/lib/shares.mjs`,
  `site/scripts/private-build.mjs`, `firebase.json`, `infra/gate.tf`
- PR: https://github.com/djjay0131/website/pull/93
