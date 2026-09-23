DRIFTING

# Governance Audit — Wave 0

Role: `Governance Auditor` · Wave 0 · Issue #44 (hub-007) · 2026-09-19
Contract: `llm/sprints/2026-09-hub/contracts/governance-auditor-wave-0.md`
Canon: resolved from `llm/governance/governance-delta.md` §Canon Location →
`~/code/agentic-governance` (at `v0.9.1-1-g10e4bd0`; CI pin `851a50a` = v0.9.0 is binding — see check 2).

> **Independence.** I authored nothing in this wave and nothing under review. The only file I
> wrote is this handoff. No git, `gh` or cloud mutation was made; every `gh` call was a
> read-only query through the resolved Windows binary. No branch was checked out.
>
> **Reading conditions, stated because they affect what I saw.** The worktree is checked out
> on `admin/wave-0-preconditions` (PR #45's branch), not `main`, so every on-disk read is of
> that branch's tree. Mid-audit the branch advanced by one commit — `661f0ab`, "Security
> Tester and Skeptic Verifier dispositions; RT-7 corrected" — which was unpushed when I first
> read it and is pushed now. Branch diffs below are `git diff main...<branch>` against the
> local ref and therefore include it; the PR as GitHub saw it at audit time ended at `8d21a53`.

---

## Results

| # | Check | Verdict | Evidence | Routes to |
|---|---|---|---|---|
| 1 | Governance level declaration | **FAIL** | No gov-L* label on any of #45/#47/#48/#53 (all four carry **zero** labels), against canon `labels.md` "exactly one governance-level label on every PR" and this repo's own practice on #9/#12/#15/#17/#20/#23/#25. Separately, **#45 is declared L2 and its diff is L3** | Lead Architect → owner |
| 2 | The two-plane rule | **PASS** | Declared command with `--layout`: `4 of 4 checks passed, 0 failed` (governance-links, adr-index, adr-status, layout), exit 0. `docs/` holds one file, a derived view naming the `llm/` documents it projects. No branch but #45 touched `llm/**` or `docs/**` | — |
| 3 | Scope discipline vs the contracts | **PASS** | Every stream stayed inside its FILE CONTRACT, file for file. The gate stream *refused* a contract instruction that would have crossed into `infra/` | — |
| 4 | Agent mutations | **PASS** (in this repo) + finding M-1 | No sub-agent commit, branch, push, PR, review or comment. No `workflow_dispatch` since 2026-09-17, i.e. none in this wave. **Nothing merged**; D5 never exercised. But a commit was pushed to `phd-milestones` outside the PR workflow | Lead Architect |
| 5 | Stale branches | **PASS** | Judged from `git ls-remote --heads origin`, not a fetch. Six local `: gone` refs correctly **not** raised. `handoff/research-hub` **not** recommended for deletion | — |
| 6 | ADR hygiene | **PASS** + 2 findings | Index matches files; all statuses legal; ADR-0012 (Proposed) consistent. Findings: design-authority status line amended with no ADR; `/client-events` live with no authorising ADR | Lead Architect → owner |
| 7 | The record matches reality | **FAIL** | STATE §Current position names a closed issue, a merged PR and a deleted branch. Memory bank states things **false about merged work** — the S-6/A-3 recurrence. D5 cites a brief §8 that does not exist | Lead Architect; Steward lane (memory bank) |
| 8 | Secrets and keys | **PASS** | Zero matches across all four diffs. **No Actions secrets exist at all.** WIF only. §12.2 not triggered — no stop | — |

**Overall verdict: DRIFTING.**

---

## Check 1 — Governance level declaration — FAIL

**1a. No governance-level label on any Wave 0 PR.** All four PRs carry an empty label set.
Canon `llm/governance/labels.md`: *"Apply exactly one governance-level label to every PR,
matching the level declared in the PR template"* and *"Every PR additionally carries exactly
one governance-level label (`gov-L0`…`gov-L3`)"*. The labels exist and are installed —
`gov-L0`…`gov-L3` all verified present — and this repo applied them correctly on #9, #12,
#15, #17, #20, #23 and #25. This is a regression from the repo's own practice, not an
unfamiliarity with the rule. Issue #44 carries `gov-L2`; its PRs carry nothing.

**1b. PR #45 is declared L2. Its diff is L3.** The body's reasoning is sound as far as it goes
— it correctly identifies the design-doc status line as the escalating element and correctly
cites the mixed-PR rule — but it stops one level short.

What the diff actually does (`444` lines added, `0` removed in STATE; plus the roadmap):

| Diff content | Canon L3 category |
|---|---|
| D1 — R-A3 retired; Phases 4, 5, 6 unblocked for execution | MVP scope |
| Q3 answered "wanted" — the roadmap previously read *"open; the owner may cut this phase"* | MVP scope |
| Q6 — `agentic-kgis` substituted for `agentic-kg`, order fixed | prioritization |
| D8 — private by default; a satellite's `visibility` demoted to a *request* | privacy policy; business rule; user-visible behavior |
| Checkpoints 5, 6, 7 defined with acceptance criteria | requirements |
| Design-authority status line "Phase 0–3" → "Phase 0–6" | L1 floor (design-authority-document change) |

Canon `governance-levels.md` L3 is *"requirements, MVP scope, personas, business rules,
user-visible workflow behavior, privacy/consent policy, and prioritization."* Four of the six
rows land inside that sentence. Mixed PRs take the highest level, so #45 is **L3**.

**The repo's own precedent is directly on point.** STATE's header declares *"**L3 for PR #12**
(roadmap requirement changes — delta review 2, Part D)"*, and PR #12 carries `gov-L3`. PR #45
makes roadmap requirement changes of the same class and larger scope.

**Why this matters beyond bookkeeping.** Canon: *"AI roles may only move classification up;
only the human owner may move it down."* An L2 declaration where L3 is not merely plausible
but precedented is a downward classification made by an AI role. The conservative default
points the same way.

**1c. #47, #48 and #53 are correctly declared L2.** Checked against their diffs, not their
bodies: a new state-changing gate route with CSRF handling; build/config plus a Hosting
rewrite; cloud IAM narrowing plus CI guards. All squarely canon L2. No escalation needed.

**1d. None of the four PR bodies follows this repo's own `pull_request_template.md`.** All
four substitute prose headings for the template's structure, and the omitted sections are
precisely the ones this wave has open questions about: no level **checkbox**, no **Related
ADRs** (this wave raises at least six ADR candidates), no **Memory Bank Updates** (the subject
of finding R-2), no **Files Changed**, no `Closes #`. The Data/Security/Privacy section — the
one the delta's domain questions require — *is* present and well answered in all four.

---

## Check 2 — The two-plane rule — PASS

Ran the command the delta declares, from the repository root:

```
$ node ~/code/agentic-governance/plugin/scripts/governance-checks.mjs --layout
PASS  governance-links
PASS  adr-index
PASS  adr-status
PASS  layout
4 of 4 checks passed, 0 failed.        EXIT=0
```

Stated honestly: this ran against the working tree, which is on `admin/wave-0-preconditions`,
not `main`. Independent corroboration that it holds per-branch — `governance-checks` is a
required context and reports **SUCCESS on all four PRs**, as does `budget-guard`.

Also noted: my local canon checkout is `v0.9.1-1-g10e4bd0`, newer than CI's pinned `851a50a`
(v0.9.0). The delta's §Canon Location anticipates exactly this divergence and declares CI
authoritative. Both agree at 4 of 4, so nothing turns on it.

**Data plane is clean.** `docs/` contains exactly one file, `docs/satellites.md`, and it opens
by declaring itself *"a derived view for satellite owners"*, naming the design doc §3–§4 and
ADRs 0002/0007/0008 as the control-plane sources, and stating they win on disagreement. That
satisfies the rule that any view in the artifacts tree must name the `llm/` document it
projects. No artifact governing repository operation lives there. No branch except #45 (the
Lead Architect's own) touched `llm/**` or `docs/**`.

---

## Check 3 — Scope discipline against the contracts — PASS

Each stream's declared FILE CONTRACT against the files its branch actually changed:

| Stream | May modify | Actually modified | Verdict |
|---|---|---|---|
| gate (#47) | `gate/**`, `.github/workflows/gate.yml` | `gate.yml`, `gate/README.md`, `gate/app/main.py`, 4× `gate/tests/` | inside |
| site (#48) | `site/**`, `firebase.json` | 8× `site/**`, `firebase.json` | inside |
| infra (#53) | `infra/**`, `build.yml`, `ci.yml` | 8× `infra/**`, `build.yml` (`ci.yml` untouched) | inside |
| satellite-phd | only `/mnt/c/code/phd-milestones`; read-only in the hub | no hub file on any branch | inside |
| roadmap-truth + 7 testers/adversaries | one handoff file each; explicit NO git / gh / cloud mutations | one handoff each, all in #45 | inside |

**No stream edited another stream's file.** Not once, across fourteen contracts.

Worth recording as a positive, because it is the behaviour bounded contracts exist to produce:
the gate contract *invited* a violation — it instructed the stream to move the health path to
`/_gate/health`, which would have required editing `infra/monitoring.tf`, another stream's
file and a live uptime check. The stream **declined, reasoned about it, and reported instead**
(G-2/G-3), and the Lead Architect accepted the refusal. The sprint has a recorded instance of
a contract error producing cross-stream confusion; this is the same error class caught by the
mechanism working.

---

## Check 4 — Agent mutations — PASS in this repo, with finding M-1

**Identity caveat first.** Every commit on all four branches and on `main` is authored and
committed by `Jason Cusati <djjay@vt.edu>`. Per the delta's §Platform Enforcement Reality the
platform cannot distinguish roles — all sessions use the owner's token — so the no-mutation
rule is procedural and I audited the procedural trail, not the identity.

What the trail shows:

- **Reflog**: the only branch creations and checkouts are the top-level session's. Each
  stream's output was committed by the Lead Architect on a branch it created, then the session
  returned to `admin/wave-0-preconditions`. No sub-agent commit, branch or push appears.
- **No PR reviews, no PR comments, no issue comments** exist on #45/#47/#48/#53 or #44 —
  consistent with assumption A8 (the reviewer returns a report; the Lead Architect persists it).
- **Workflow runs during the wave**: `pull_request` and `schedule` only, plus `push` on `main`
  for pre-wave merges. The most recent `workflow_dispatch` is **2026-09-17T20:59Z**, before
  Wave 0. No agent dispatched a deploy.
- Every tester and adversary contract carries an explicit NO git / NO gh / NO cloud mutations
  clause, and the Security Tester's handoff opens by asserting compliance and a clean worktree.

**On D5 and the §8 conditions.** `main` is still `f98a928` — the exact SHA the preconditions
recorded. **Nothing merged.** The gated merge/apply authority was therefore never exercised,
so there is no merge whose §8 conditions I could test. The reason nothing merged is correct
and is the wave's best result: the Security Tester returned **4 FAILs**, and the one-FAIL-
blocks-everything rule was honoured without argument. The gate did what it exists to do.
(The separate problem — that §8 itself is unauditable from the repository — is finding R-5.)

**Finding M-1 — a commit was pushed to a second repository, outside the PR workflow.**
`djjay0131/phd-milestones` commit `4f26a17` ("H-5: self-host the webfonts the private pages
load") is pushed to `origin/feat/publish-contract`; that repo's `pushed_at` is
2026-09-19T03:36:24Z, inside the wave. That branch's only pull request, #1, **merged on
2026-09-17**. So new work now sits on an already-merged branch with **no open PR, no declared
governance level and no review**, and `4f26a17` is not on that repo's `main`.

Two things I checked before calling this a finding, because the record looked contradictory:

- The `satellite-phd` handoff states *"Nothing was committed, branched, pushed or published"*
  while STATE SP-2 says *"**Fixed.** Committed with `core.fileMode=false`."* These are **not**
  in conflict. The agent committed nothing; the commit is the Lead Architect's — author, date
  (23:36:22, inside the LA's commit window) and a message documenting the `core.fileMode=false`
  handling all match. Sub-agent discipline held.
- The mode handling was done correctly: `git ls-files -s` reports **36 files, all `100644`**.

The finding is not that an agent mutated a repo. It is that repository-changing work —
a **privacy fix on the repository that is Incident A1's subject** — reached a remote without
an issue, a branch of its own, a draft PR, a level declaration or a review, and that STATE
records it as "Committed" without recording that it was **pushed**.

---

## Check 5 — Stale branches — PASS

**I did not fetch, and I did not need to.** I used `git ls-remote --heads origin`, which
queries the remote directly and mutates no ref at all — neither local nor remote. It is
strictly read-only *and* immune to the Phase 3 failure mode, which `fetch --prune` only cures
by writing to local refs. Saying so explicitly, as the contract requires.

Authoritative remote branches (7): `admin/wave-0-preconditions`, `feat/gate-signout`,
`feat/infra-wave-0`, `feat/site-wave-0`, `fellowship-sprint-notebook`,
`fix/derive-education-assertion`, `main`.

**The Phase 3 precedent reproduces exactly, and I raise none of it.** Six local branches still
carry remote-tracking refs — `admin/phase-2-closeout`, `feat/email-privacy-pages`,
`feat/publishing-contract`, `fix/content-bootstrap`, `fix/education-pool-count`,
`handoff/research-hub` — every one marked `: gone`. All were deleted at merge by
`delete_branch_on_merge: true`. A reviewer reading local refs without pruning would file six
phantom stale-branch findings. That is precisely the Phase 3 error; these are not findings.

**Genuinely stale on the remote — two, and neither should be deleted:**

| Branch | Last commit | State |
|---|---|---|
| `fellowship-sprint-notebook` | 2026-07-19 | PR #3 **OPEN** (draft), 1 ahead of `main`, unmerged |
| `fix/derive-education-assertion` | 2026-08-17 | PR #5 **OPEN**, 4 ahead of `main`, unmerged |

These are **abandoned work, not merge debris**. Deleting either destroys the only copy of
unmerged commits. The right action is to triage the two open PRs — land them or close them
deliberately — not branch cleanup. Not a FAIL.

**`handoff/research-hub` — NOT recommended for deletion, and never to be.** Verified against
the standing rule on all three counts: absent from `ls-remote` (never pushed / already removed
remotely); **not reachable from `main`** (`merge-base --is-ancestor` → false), so it is the
only copy of its commit; and it holds `87177ad`, the SHA an Incident A1 purge request would
need. STATE §Follow-ups carries the same instruction. Recorded here so no future audit
re-raises it.

---

## Check 6 — ADR hygiene — PASS, with two findings

- **Index matches files.** 12 ADRs plus template and README; every index row resolves to an
  existing file. `adr-index` and `adr-status` both PASS mechanically.
- **All statuses legal.** 0001–0011 `Accepted`, 0012 `Proposed` — all within the canonical
  lifecycle, and ADR-0012's index row matches its `Status:` line.
- **ADR-0012 is correctly formed.** Its Related Documents cite design doc §8/§12.6, STATE
  §Follow-ups, the infra handoff and ADR-0004. It decides and deliberately does **not**
  implement. It does not amend design authority in substance, so the ADR-0008/0010 "say so"
  obligation is not triggered. Correct as written.

**Finding ADR-1 — the design-authority document's status line was amended with no ADR.**
"Approved for Phase 0–3 execution" → "Phase 0–6", with R-A3 retired and O7 closed alongside.
The amendment is inline, dated, and attributed to the owner, which is the strongest available
provenance, and the owner is the authority over their own document. But this repo's own
established pattern is the opposite: **ADR-0010 states the rule explicitly** — *"an ADR that
amends design authority in substance must say so, as ADR-0008 did for §2 and §4"* — and
ADR-0011 did the same for §5. Here the equivalent amendment is carried only by a sprint STATE
table and a roadmap edit. Recommend either an ADR recording the Phase 0–6 approval and R-A3's
retirement, or an explicit owner statement that the inline amendment suffices.

**Finding ADR-2 — `/client-events` is live in production with no authorising ADR.** An
unauthenticated Cloud Run rewrite present in neither design doc §8's rewrite set nor the
contract's. Confirmed independently: **no file under `llm/governance/adr/` mentions it.** This
is the Security Tester's check-7 FAIL and the Lead Architect has already dispositioned it
*"fix now, by ADR rather than removal"*, which is the right call. Recorded under ADR hygiene
because it is an ADR gap on **already-merged, already-live** work, not on a branch.

**Correctly deferred, not overdue.** The three gate ADR candidates (G-8), the site provenance-
marker ADR (S-1) and the two ADRs D4/D8 require are all recorded in STATE as "written at Wave
0's close". At this point in the wave that is the right place for them.

---

## Check 7 — The record matches reality — FAIL

Three defects in the same class the Phase 3 audit already found once (S-6/A-3).

**R-1 (FAIL) — STATE's header and Current position are false.** The file says
`Last updated: 2026-09-16` while its newest content is dated 2026-09-19 and its last commit is
2026-09-19T00:29. §Current position reads *"**Phase 3 — Private area. IN PROGRESS** (issue
#24, branch `feat/private-area`, owner's go 2026-09-17)"*. In reality **issue #24 is CLOSED**,
**PR #25 merged 2026-09-17**, **`feat/private-area` no longer exists on the remote**, and the
sprint is in Wave 0 of a run-to-completion with Phases 4–6 approved. This is the contract's
named sub-check — does Current position match the actual branch and PR state — and it does
not. A session picking this file up is told the wrong phase, the wrong issue, and a branch
that is gone.

**R-2 (FAIL) — the memory bank states things that are false about merged work.** The precise
recurrence of S-6/A-3. `llm/memory_bank/activeContext.md` (Last updated 2026-09-16):

- lists as **open** after Checkpoint 4: **#27**, **#30**, #31. **#27 and #30 are both CLOSED**
  — and this wave's own preconditions verified #30 does not reproduce (PR #35 fixed it). Only
  #31 is genuinely open.
- **"Stop point:** the rest of Checkpoint 3 is the owner's alone … then merge `cv` #14, hub
  #17, `cv` #13". Checkpoint 3 passed 2026-09-16/17 and hub PR #17 merged 2026-09-16. The
  stated stop point is two phases stale.
- **"Agents do not merge"** — superseded for this run by owner decision D5 (gated). Caution is
  not wrong, but this is the first document a fresh session reads and it contradicts a
  standing owner decision.

`progress.md` contradicts **itself**: "Done … **Checkpoint 4 executed 2026-09-17**" while
"What is left" still lists *"**Checkpoint 4**: the first `terraform apply` for Phase 3, the
gate's first deploy…"*. Both cannot be true; the apply happened (29 added, 0 changed, 0
destroyed). And neither file records the single most important fact this wave established —
**Checkpoint 4 is NOT passed**.

**On the question put to me directly — is "the memory bank has not been updated this wave" a
finding now, or correctly deferred to wave close? Correctly deferred. I am not filing it.**
Canon is explicit: synchronising the memory bank to *already-merged, already-approved* work is
L0 bookkeeping, and *"recording a new direction, scope, or decision in the memory bank is
semantic and travels with the PR that makes it."* **Nothing in Wave 0 has merged** — `main` is
unchanged — so there is no merged reality from this wave to sync to. Syncing it to *intended*
outcomes is exactly the failure S-6 was. Deferring to wave close is right.

**That defence does not cover R-2.** The false statements above are about work merged in
**Phases 2 and 3**, before this wave began. They were already due, they are L0 to fix, and
they are independent of anything Wave 0 merges. The deferral is correct; the staleness is a
finding.

**R-3 (PASS, recorded positively) — the roadmap is honest.** I checked rather than assumed:
the #45 roadmap diff contains **no `[x]` addition at all**, and Phase 3 still carries **31
unchecked / 0 checked** boxes. With `roadmap-truth` reporting 3 FALSE and 4 NOT VERIFIABLE,
leaving every box unchecked is the correct outcome. The contract's "boxes ticked only where
live evidence exists" sub-check **passes**, and under real pressure to show progress. Worth
saying plainly: this is the part of the record that did what the governance asks.

**R-4 (finding, minor) — the design-authority document's own governance pin is stale.** Line 8
reads *"Governance: agentic-governance **v0.5** (pin in governance-delta.md)"* while the delta
and CI pin **v0.9.0** (`851a50a`). PR #45 edited the line directly above it and left this one.

**R-5 (finding) — D5's merge authority is gated on a section that does not exist in the
document it names.** D5 reads: *"the Lead Architect may merge … when, and only when, every
condition in **the run brief's §8** holds."* STATE then reasons from *"§8's stateful-resource
list"* and *"§8 is explicit: a single FAIL blocks every merge."* But
`llm/plans/2026-09-10-research-hub-orchestration-brief.md` — the only brief in the repository,
and the one the delta names — **ends at §7 (Definition of Done). There is no §8.** The
conditions being enforced exist only in the owner's run-to-completion prompt, which is not in
the repository.

Consequence: the most consequential authority grant of this run — merge to `main`, run
`terraform apply` — cites a rule set **that cannot be audited from the repository**. I can
confirm the Lead Architect's *stated* reading was honoured (one FAIL blocked everything, and
four were found), but I **cannot verify that the §8 conditions are what STATE says they are**.
Transcribe §8 verbatim into STATE or the brief before any merge happens.

---

## Check 8 — Secrets and keys — PASS. §12.2 not triggered; no stop.

- **All four branch diffs scanned** for private-key headers, `"type": "service_account"`,
  `private_key`, `ghp_` / `github_pat_`, `AIza…`, `AKIA…`, `client_secret`, `xox[baprs]-`.
  **Zero matches**, except prose in the Security Tester's own contract and handoff describing
  the check itself.
- **No `.env`, `.pem`, `.p12`, credential or `*-key.json` file** added on any branch.
- **`gh secret list` is empty. The repository holds no Actions secrets at all.** WIF only,
  exactly as principle 2 requires.
- **Actions variables reviewed individually** — all non-secret configuration: project id,
  bucket names, service-account *e-mail addresses*, the WIF provider resource path, region,
  site URL. `PUBLIC_FIREBASE_API_KEY` is a Firebase **Web** API key: public by design, shipped
  in the client bundle, named `PUBLIC_` accordingly. It is **not** a credential under §12.2 and
  is **not** a finding — recorded explicitly so a future auditor does not re-raise it.
- **One carried item I cannot close, and it is not this wave's.** STATE Checkpoint 3 action 1
  required revoking the `WEBSITE_DISPATCH_PAT` **token** at github.com/settings/tokens after
  deleting the `cv` secret and variable. The record shows the secret and variable deleted;
  token revocation is an owner console step in another repository's account settings and is
  **UNVERIFIABLE from here**. What would verify it: the owner confirming the token is absent
  from github.com/settings/tokens. Flagged, not counted as a FAIL of this wave's diffs.

---

## Audit of the Lead Architect's own dispositions

Asked to check the self-corrections against the handoffs they cite, on the premise that more
were missed than the one already found.

**RT-7 — now corrected, and the correction is right.** Commit `661f0ab` strikes the original
disposition and files **#58** with an accurate reason. I verified both halves independently:

- `check_private_bucket_config.py` (the **static** half) is wired in `build.yml` — confirmed
  in the #53 diff at the `budget-guard` job.
- `check-private-bucket-iam.sh` (the **live** half) is referenced by **no workflow**. The
  #53 diff adds the new `roles/viewer` expansion check **into that script**, and the build.yml
  diff wires only the static check plus a new declaration-only satellite guard. The new
  guard's own comment concedes it: *"the live half is a Checkpoint procedure
  (`infra/scripts/check-private-bucket-iam.sh`)."*
- The stated reason it cannot simply move into `budget-guard` also holds: that job runs on
  pull requests, and `wif.tf` admits `refs/heads/main` only, so a PR build cannot authenticate
  to read the bucket policy.

**Consequence worth stating beyond the correction:** #55's `roles/editor` exposure and #53's
new `roles/viewer` check **both live in a script that runs nowhere**. Two of this wave's
security fixes land in an unwired file.

**A disposition I checked that holds.** D-4's claim that SEAM-B5 was *"amended before
implementation"* is true: `contracts/private-by-default-seams.md` carries the amendment
inline, dated 2026-09-18, attributed to the Dissenter's objection 3, with the superseded
reasoning **quoted rather than deleted**. That is the right shape, and it is the model for the
next finding.

**A second missed disposition — D-1 / SEAM-10.** STATE D-1 states *"**SEAM-10's H1 wording is
amended**."* SEAM-10 lives in `handoffs/site-wave-0.md` (§SEAM-10; H1 at line 429). That file
has exactly **one** commit, `75a5cc1`, made *before* the Dissenter round — **the handoff was
never touched and the amendment is not in it.** H1 still reads as originally written; the
correction exists only in the STATE disposition table.

This matters because the infra stream consumes SEAM-10 as its specification: anyone following
SEAM-10 gets the claim D-1 found overstated, with no marker pointing at the correction. Note
the genuine tension — editing a completed agent's handoff in place would falsify the record of
what that agent delivered, which is worse. The fix is an **appended, dated, attributed
amendment note** on the handoff, exactly as SEAM-B5 did in the contract file — not an edit to
the original text.

**Lesson-3 evidence — not yet a finding, but wider than recorded.** D-5 accepts that lesson 3
*"now has this repo's own evidence, and I will record it there at the wave's close."* I
verified `llm/governance/patterns/execution-patterns.md`: lessons **1, 2, 3 and 4 all** still
read *"This repo: no evidence yet — onboarded 2026-09-14 (issue #7)"*, and the file's Last
updated is 2026-09-14. That is consistent with the stated intent, so it is **not** a finding
now. But by this wave's own record, lesson 1 has earned this repo's evidence (this audit and
every prior one), lesson 2 has earned it (the routing discipline the dispositions demonstrate),
and lesson 3 has earned it (D-5's third instance). **All of them should be updated at close,
not just lesson 3.**

---

## Summary

The governance around Wave 0 largely held, and in the two places that matter most it held
well: **the security gate blocked the wave on four FAILs and nothing merged**, and **no stream
crossed another stream's file boundary in fourteen contracts**. Secrets are clean to the point
of there being no Actions secrets at all. The two-plane rule passes mechanically and on
inspection. The roadmap stayed honest under pressure to show progress — 31 Phase 3 boxes
unchecked, which is the correct answer.

It is DRIFTING rather than PASS on the record-keeping and classification layer. The wave's own
record PR is classified one level below what its diff does, against the repo's own PR #12
precedent; **no Wave 0 PR carries a governance-level label at all**, reversing seven PRs of
correct practice; the memory bank states things that are false about **merged** work, which is
the Phase 3 S-6/A-3 finding recurring; STATE's Current position names a closed issue, a merged
PR and a deleted branch; and the merge-authority grant that governs this entire run cites a
brief section that does not exist in the repository.

Per the portfolio record in my contract: this is the expected shape, not an anomaly. Zero
multi-agent sprints have produced a clean first audit, and finding nothing would itself have
required evidence.

## Assumptions

- The canon checkout was resolved from the delta's §Canon Location, not hardcoded. Where my
  local canon (v0.9.1) and CI's pin (v0.9.0) could differ, I treated **CI as authoritative**,
  as §Canon Location instructs. Both produce 4 of 4.
- Commit authorship cannot distinguish roles on this platform (delta §Platform Enforcement
  Reality). I audited the procedural trail — reflog, PR timeline, workflow events, handoff
  self-assertions — and say so rather than claiming identity-level proof.
- Branch diffs are against the **local** refs, which for `admin/wave-0-preconditions` include
  the commit pushed mid-audit.
- I read the four PRs, all fourteen Wave 0 contracts, and the ten handoffs. I did not read the
  Chief Reviewer's output; it runs concurrently and independence required that I not.

## Recommendations

Ordered by what should happen before anything merges.

1. **Transcribe run-brief §8 into the repository** (STATE or the brief), verbatim, including
   its stateful-resource list. Nothing should merge under an authority whose conditions cannot
   be read from the repo. → Lead Architect → owner.
2. **Re-declare PR #45 as L3** and put it to the owner. Escalation needs no justification and
   cannot be overruled downward by an AI role. → Lead Architect → owner.
3. **Apply exactly one `gov-L*` label to all four PRs** — `gov-L3` on #45, `gov-L2` on #47,
   #48, #53. → Lead Architect.
4. **Fix the memory bank's false statements about merged work** (R-2): #27 and #30 closed,
   Checkpoint 3 complete, the `progress.md` self-contradiction, and Checkpoint 4 NOT passed.
   L0 bookkeeping against merged reality, due now and independent of this wave. → Steward lane.
5. **Correct STATE's header date and §Current position** (R-1). → Lead Architect.
6. **Append the SEAM-10 H1 amendment to `handoffs/site-wave-0.md`** as a dated, attributed
   note — do not edit the original text. → Lead Architect.
7. **Decide ADR-1**: an ADR for the Phase 0–6 approval and R-A3's retirement, or a recorded
   owner statement that the inline amendment suffices. → Lead Architect → owner.
8. **Fix the design doc's stale `v0.5` governance pin** (R-4). → Lead Architect.
9. **Record M-1**: note in STATE that `4f26a17` was pushed to `phd-milestones` outside the PR
   workflow, and decide whether it gets a PR before it merges. → Lead Architect.
10. **At wave close, update all four execution-patterns lessons**, not only lesson 3.
11. **Triage PRs #3 and #5** rather than deleting their branches.

Per `execution-patterns.md` lesson 2, **none of these should be applied from this report
directly**: each routes through the Lead Architect to the owner of the affected document. I
have amended nothing.

## Alternatives considered

- **Grading check 1 as PASS on the label point**, on the grounds that the level is declared in
  every PR body and the label is redundant. Rejected: canon states the requirement twice, in
  mandatory terms, and the label is what makes level queryable across a repo — prose in a body
  is not. The repo's own seven-PR history shows it knows this.
- **Grading check 7 as DRIFTING-but-PASS**, since the memory-bank staleness predates the wave.
  Rejected: the contract names the memory bank explicitly and cites S-6/A-3 as the precedent
  to check against. A recurrence of a previously-found defect is a FAIL, not a footnote.
- **`git fetch --prune` before the stale-branch check**, as the contract's wording suggests.
  Rejected in favour of `git ls-remote`, which is authoritative about the remote *and* mutates
  nothing. It satisfies the intent — do not judge from stale refs — without writing to the
  repository another agent is reading.
- **Treating M-1 as a standing-constraint violation.** Rejected: the constraint binds
  sub-agents, and the evidence shows the Lead Architect made the commit. It is a workflow and
  record finding, not a mutation-discipline breach.
- **Declaring check 4 UNVERIFIABLE** because identities are indistinguishable. Rejected as
  over-cautious: the procedural trail is complete and consistent, and the delta already records
  the identity limitation honestly. I state the limit rather than refusing the check.

## Risks

- **Two security fixes are landing in a script that runs nowhere** (#55's `roles/editor`
  expansion and #53's `roles/viewer` check, both inside `check-private-bucket-iam.sh`, per
  #58). They will read as shipped and enforce nothing until the live half is wired.
- **The §8 gap is a governance single point of failure.** If the owner's prompt is lost, the
  conditions under which merges and applies were authorised become unreconstructible.
- **The memory bank is the first document a fresh session reads.** While it says Checkpoint 3
  is the stop point and #30 is open, any resumed session starts from a false position — the
  exact cost S-6 was filed for.
- **A privacy fix sits unreviewed on a merged branch** in the Incident A1 repository (M-1).
- **`cv/anthropic-fellow` remains publicly reachable on five origins**, contradicting standing
  owner decision D8. Correctly dispositioned to Wave 0b as highest priority; noted here only
  because live state contradicts a recorded decision, which is this check's subject.
- **Label absence compounds quietly.** Level-based queries and any future audit of
  classification history will under-report this wave.

## Open questions

1. Where does run-brief §8 live, and will it be committed? Until it is, D5's gate is
   unauditable. **(Owner.)**
2. Does the owner accept the design-doc status-line amendment without an ADR, against
   ADR-0010's stated rule and ADR-0008/0011's precedent? **(Owner.)**
3. Should `4f26a17` in `phd-milestones` get a pull request before it merges, and does that
   repository adopt the hub's governance workflow? **(Owner.)**
4. PRs #3 and #5 have been open since July and August — land or close? **(Owner.)**
5. Was the `WEBSITE_DISPATCH_PAT` **token** itself ever revoked at github.com/settings/tokens?
   The repository secret was deleted; the token is unverifiable from here. **(Owner.)**

## Related docs

- `llm/governance/governance-delta.md` — §Canon Location, §Governance Check Command,
  §Platform Enforcement Reality, §Steward Activation Status (INACTIVE), §L0 Path Allowlist
- `<canon>/llm/governance/governance-levels.md` — the four levels, mixed-level rule, the
  escalation asymmetry that finding 1b rests on
- `<canon>/llm/governance/labels.md` — the one-governance-label-per-PR rule (finding 1a)
- `<canon>/llm/governance/architecture-governance.md` — §ADR Process, §Memory Bank Rules
  (the L0/semantic split behind the check-7 deferral answer)
- `<canon>/llm/governance/definition-of-done.md` — L2 completion requirements
- `llm/governance/patterns/execution-patterns.md` — lesson 1 (no clean first audit), lesson 2
  (route findings through owners — why this report amends nothing)
- `llm/sprints/2026-09-hub/STATE.md` — §Wave 0 dispositions, §Owner decisions 2026-09-18,
  §§8 merge sequencing, §Incident A1, §Standing constraints
- `llm/sprints/2026-09-hub/handoffs/security-wave-0.md` — the 4 FAILs that blocked the wave
- `llm/sprints/2026-09-hub/handoffs/site-wave-0.md` §SEAM-10 — the unamended H1
- All fourteen `llm/sprints/2026-09-hub/contracts/*-wave-0.md`

## ADR candidates

- **The Phase 0–6 approval and R-A3's retirement** — an amendment to design authority
  currently carried only by a sprint record (finding ADR-1).
- **`/client-events`** — a live unauthenticated rewrite authorised by no ADR and absent from
  design doc §8 (finding ADR-2; already accepted by the Lead Architect).
- **Governance-level classification of owner-decision records.** This wave shows that a PR
  which merely *records* owner decisions can carry L3 scope, privacy and prioritization
  changes. Worth a durable rule: a record PR is classified by the decisions it lands, not by
  the fact that it is a record.
- **Cross-repository change control.** M-1 shows satellite repositories receiving pushes
  outside any workflow. Whether satellites inherit the hub's Issue→Branch→Draft PR discipline
  is undecided and will recur at Phase 5 with `kgis` and `construction-ai-proposal`.
- **Where a corrected seam lives.** The SEAM-10 case has no recorded rule: amending a
  delivered handoff falsifies the agent's record, but leaving the correction only in a
  disposition table lets downstream streams consume superseded text. The append-a-dated-note
  pattern SEAM-B5 used should be written down as the rule.
