# Handoff — Chief Reviewer, owner decision D19 (secrets-sync)

Status: Delivered
Date: 2026-10-08
Role: Chief Reviewer (authored nothing in this wave; review and report only)
Branch: `feat/secrets-sync` · PR **#116** · head `672cb0e` (2 commits ahead of
`main`)
Authority under review: owner decision **D19** — all secrets are handled by a
GitHub workflow, never by a manual `gcloud` step.
Design authority: `llm/governance/adr/0022-annotation-export-transport.md` §1, §5
(amended on D19); pattern `llm/governance/patterns/secrets-management.md`.
Contract: `llm/sprints/2026-09-hub/contracts/adversarial-d19-secrets-sync.md`.

Read-only statement: I made no git/gh/gcloud/terraform/firebase **mutation**. I
changed no tracked file (the only new file is this handoff). I ran only
`git`/`gh api` GETs, file reads, `terraform fmt -check`, `terraform validate`, a
read-only `terraform plan -out=/tmp/…` in `infra/`, and a clean-copy `terraform
plan` reproduction under `/tmp/opencode/`. No apply. `git status` is clean.

## Verdict

**Round 3 (final, 2026-10-08, head `96a8406`): Approve — merge unblocked, zero
must-fix.** MF-1, MF-2 and MF-3 are all fixed and independently reproduced; with
the real repository variables the tfvars-free targeted plan is `1 to add, 1 to
change, 0 to destroy` with **no `GATE_ALLOWED_ORIGINS` diff**. Only residual
advisories remain, in `# Round 3` at the end of this file.

**Round 2 (2026-10-08, head `df728bb`): Request changes — one remaining
must-fix (MF-3).** Both round-1 must-fixes are fixed and independently
reproduced: **MF-1** (the CI Terraform job could not run) and **MF-2** (a live
infra file still printed the removed manual `gcloud` command). Making the job
runnable exposed a third defect: the targeted
`google_cloud_run_v2_service.gate` apply **reverts `GATE_ALLOWED_ORIGINS`**,
because `gate_extra_allowed_origins` exists only in the local, git-ignored
`terraform.tfvars`. Evidence, reproduction, and advisory re-checks are in
`# Round 2` at the end of this file. All round-1 content below is retained
unchanged for the record.

**Round 1 (2026-10-08, head `672cb0e`): Request changes — two must-fix.** The
security posture of the workflow is sound and independently re-verified, but
(1) the workflow's Terraform job **cannot execute in CI as written**, so D19's
central "the workflow runs the adds-only apply" claim is false today; and (2) a
**live infra file still ships the exact manual `gcloud secrets` command D19
removes**. Neither is a reachable secret-exposure; both are correctness/record
defects the adversarial rounds missed. With MF-1 and MF-2 fixed, this is
mergeable and the security reasoning stands.

Must-fix vs advisory summary:

| # | Sev | Finding | Pointer |
|---|---|---|---|
| MF-1 | **must-fix (functional blocker)** | The `terraform` job supplies no `TF_VAR_project_id` / `TF_VAR_billing_account`; both are required with no default and CI has no `terraform.tfvars`. `terraform plan -input=false` fails before planning. | `.github/workflows/secrets-sync.yml:170-240`; `infra/variables.tf:1,52` |
| MF-2 | **must-fix (contract contradiction)** | `notes-sync.tf` still prints the removed manual hard stop and its `gcloud secrets create` / `versions add` commands. | `infra/notes-sync.tf:4-19` (commands `:11-15`) |
| A-1 | advisory | Committed workflow differs from the adversarially-reviewed revision; the post-review change is safer and recorded, but their green attaches to a pre-commit tree. | `.github/workflows/secrets-sync.yml` sha `c967b96f…` vs Red Team r2 `95db1a31…` |
| A-2 | advisory | `-target` comment overstates blast-radius reduction (dependency closure is still in-graph). | `.github/workflows/secrets-sync.yml:221-229` |
| A-3 | advisory | `serviceusage.serviceUsageAdmin` is project-wide (any-API disable) and is not named by #112. | `infra/secrets-sync.tf:49-53` |
| A-4 | advisory | The disable-prior loop swallows a `versions list` failure (`|| true`); a stale enabled version persists silently. | `.github/workflows/secrets-sync.yml:155-163` |
| A-5 | advisory | No alert on a failed/partial sync (no secret-sync alarm in `monitoring.tf`). | Red Team Q5 |
| A-6 | advisory | `setup-terraform` action is SHA-pinned, but the Terraform CLI version is not pinned. | `.github/workflows/secrets-sync.yml:193-194` |
| A-7 | advisory | The pattern's "sync identity is not a reader of values" invariant is contradicted by its own reference implementation (project-level admin). | `patterns/secrets-management.md:57-59` vs `infra/secrets-sync.tf:40-44` |
| A-8 | advisory | Repo-secret trust boundary: a same-repo branch run by a writer can read the secret; consider an `environment:`. | Red Team R3 |
| A-9 | advisory | Historical STATE phrase reads as current ("or created the secret (owner hard stop 2)"). | `STATE.md:3896` |

## D19 brief — verification against the tree

| D19 requirement | Result | Evidence |
|---|---|---|
| Trigger = `workflow_dispatch` + push to `main` on the workflow file only; no `pull_request` | PASS | `.github/workflows/secrets-sync.yml:45-52`; only `workflow_dispatch`/`push` keys |
| WIF auth with the existing identity | PASS | `:102-108` and `:186-191` use `vars.GCP_GATE_DEPLOY_SA` + `vars.GCP_WIF_PROVIDER`; binding `infra/gate.tf:478-482`; provider `infra/wif.tf:66-71` |
| Enable the API if disabled | PASS | `:129-134` (`gcloud services list` then `services enable`) |
| Create the secret if absent | PASS | `:136-140` (`describe` then `create --replication-policy=automatic`) |
| Add a version | PASS | `:142-144` (`versions add --data-file`) |
| Disable prior versions | PASS (caveat A-4) | `:154-163` (list `state=enabled`, disable all but the new one) |
| Never print the value | PASS (re-verified) | `:114-165`: `printf` to a `0600` `mktemp` under `umask 077`, `EXIT` trap, no `set -x`, no `echo`/summary/artifact; only names and `${X##*/}` version numbers are printed |
| Missing secret no-ops green | PASS | guard `:90-100`; credentialed steps gated `:103,111,117`; `terraform` job gated `:172` on `:77-78` output |
| Apply reads App id / installation id as TF_VARs | PASS | `:200-209` |
| `TF_VAR_notes_export_enabled=true` only when **both** set | PASS | `:210-216` |
| The apply actually runs in CI | **FAIL (MF-1)** | reproduced below |
| Record matches reality (ADR §5 replaced the hard stop; STATE removed it; pattern exists; #112–#115 exist) | PASS with MF-2 | ADR `:15-21,92-127`; `STATE.md:3844-3864,3913-3973`; pattern file present; `gh api` confirms #112/#113/#114/#115 all **open** |
| Terraform adds-only; no destroy/replace of a stateful resource | PASS | reproduced plan `1 to add, 0 to change, 0 to destroy` |
| Follow-ups #112–#115 exist | PASS | `gh api repos/djjay0131/website/issues/{112..115}` → open, titles match D19 follow-ups |

## MF-1 — the workflow's Terraform job cannot run in CI (reproduced)

`project_id` (`infra/variables.tf:1`) and `billing_account`
(`infra/variables.tf:52`) are required root variables with **no default**. Only
`infra/terraform.tfvars.example` is tracked (`git ls-files | grep tfvars`); real
`*.tfvars` and `*.tfvars.json` are git-ignored (`infra/.gitignore`). The
`terraform` job sets `GCP_PROJECT_ID` for the `auth` action only and, in the
derive step, exports only `TF_VAR_notes_export_*`
(`.github/workflows/secrets-sync.yml:177-180,200-216`). No `TF_VAR_project_id`
or `TF_VAR_billing_account` is exported anywhere (repo-wide grep confirms).

Reproduced in a clean copy of `infra/` with `terraform.tfvars` and state removed,
using the same command the workflow uses:

```
$ terraform init -backend=false -input=false
$ TF_VAR_notes_export_app_id=… TF_VAR_notes_export_installation_id=… \
    terraform plan -input=false -refresh=false -lock=false \
      -target=google_secret_manager_secret_iam_member.hub_gate_notes_export_key \
      -target=google_cloud_run_v2_service.gate
Error: No value for required variable
  on variables.tf line 1: variable "project_id" { … is not set, and has no default value.
Error: No value for required variable
  on variables.tf line 52: variable "billing_account" { … is not set, and has no default value.
PLAN_RC=1
```

`-target` does not waive root-variable requirements, and `-refresh=false` does
not change this. So the moment the owner sets the key and dispatches, the
workflow reaches the `terraform` job and **fails at plan** — the accessor binding
is never applied, which is the exact resource D19 exists to apply. (Note also:
on merge, the `paths`-scoped push triggers the workflow; with the secret still
unset it no-ops green, so this is latent until first dispatch.)

Fix (small): export `TF_VAR_project_id=${GCP_PROJECT_ID}` and
`TF_VAR_billing_account` from a repository secret (e.g. `BILLING_ACCOUNT`) in
the `terraform` job `env:` or in the derive step. `billing_account` is sensitive
and must be a secret, not a variable. After that, the plan/apply path is
exercised end to end.

This is why the adversarial green does not clear the wave on runnability: Security
Tester Check 6 and Red Team A5/N2 reasoned about the apply's blast radius and
TF_VAR leakage but never ran the plan from a clean, `tfvars`-less checkout.
`terraform validate` also cannot catch it (it does not evaluate variable values).

## MF-2 — a live infra file still ships the removed manual `gcloud` step

`infra/notes-sync.tf:4-19` still says "**TWO OWNER HARD STOPS** gate this file's
apply" and prints, as hard stop 2:

```
infra/notes-sync.tf:12:  gcloud secrets create notes-export-app-key --project=cusati-hub --replication-policy=automatic
infra/notes-sync.tf:14:  gcloud secrets versions add notes-export-app-key --project=cusati-hub --data-file=/path/to/app.private-key.pem
```

That is the exact command D19 removes. It contradicts:

- `llm/governance/adr/0022-annotation-export-transport.md:15-21,94-103` ("the
  manual `gcloud` step is **replaced**"; "no `gcloud` command is ever run by hand");
- `llm/governance/patterns/secrets-management.md:11-13,31-32` ("No human ever
  runs `gcloud secrets …`");
- `llm/sprints/2026-09-hub/STATE.md:3844-3864` ("That command is **removed**");
- the PR #116 body ("The stale manual `gcloud secrets` instructions are removed").

Both adversarial rounds missed it. Red Team RTD19-03/A7 grepped **only**
`STATE.md` and marked the finding "FIXED"; Security Tester Check 5 read only
`notes-sync.tf:23-28` (the binding). `infra/notes-sync.tf` is explicitly in the
contract's "Artifacts under test" list
(`contracts/adversarial-d19-secrets-sync.md:21`).

Fix (small): rewrite the header to D19 reality — hard stop 1 (the GitHub App)
remains; the secret container and its versions are created/rotated by
`.github/workflows/secrets-sync.yml`; Terraform still owns only the
`secretAccessor` binding and never the secret or its value.

Historical records that keep the old command (contracts `infra-wave-6-notes-sync.md:32`,
`wave-6-notes-sync-seams.md:111`; handoffs `security-tester-wave-6-notes-sync.md:174`,
`chief-reviewer-wave-6-notes-sync.md:47-49`; the dated Wave 6b post-merge
subsection `STATE.md:3896`) are **records of the state at the time** and are
acceptable as history, especially if given a one-line supersession pointer. A
live `.tf` header is not a history record.

## Spot-checks I performed (rather than trusting the rounds)

- **"No leak" re-verified.** The Security Tester's harness
  (`/tmp/opencode/d19/run-check1.sh`, whose `extract.py` reads the committed
  `.github/workflows/secrets-sync.yml`) re-ran here: **17 passed, 0 failed,
  EXIT=0**. The committed sync `run:` block is unchanged from what the harness
  stubs; no print path exists (`printf`→file, only names/version numbers logged,
  no `set -x`, no summary/artifact). I could not falsify the no-leak claim.
- **"No-op green" re-verified.** The guard harness returns `have_key=false` when
  the secret is unset and `have_key=true` when set; every credentialed step and
  the `terraform` job are gated on that output (`:103,111,117,172`).
- **Trigger enumeration re-checked.** Only `workflow_dispatch` and
  `push[main, paths=.github/workflows/secrets-sync.yml]`; no
  `pull_request`/`pull_request_target`/`workflow_run`/`issue_comment`
  (`:45-52`). WIF/provider conditions as the rounds state
  (`infra/wif.tf:66-71`, `infra/gate.tf:478-482`).
- **Adds-only re-verified.** Read-only plan (real state):
  `Plan: 1 to add, 0 to change, 0 to destroy.` — solely
  `google_secret_manager_secret_iam_member.hub_gate_notes_export_key`, an
  additive `_iam_member`. `terraform fmt -check -recursive` and
  `terraform validate` are clean. The GCS backend is declared
  (`infra/versions.tf:35-38`) and the backend bucket is a documented one-time
  bootstrap (`infra/README.md` §State, `:753-767`).
- **Follow-ups re-verified.** `gh api` GETs: #112, #113, #114, #115 all **open**
  with titles matching D19 follow-ups.
- **Record re-verified.** ADR-0022 §1/§5 amended; `STATE.md` §D19 and the owner
  steps present; pattern + `docs/` derived view present.

## Assumptions

- "Faithful implementation" includes that the workflow can actually execute its
  job; I treat the CI plan failure (MF-1) as in-scope.
- Historical sprint/contract/handoff prose is a record and need not be rewritten;
  only live artifacts must match D19.
- GitHub action/platform behavior (unset secret ⇒ `""`; forks receive no
  secrets) is taken from documentation; it cannot be exercised from this session.
- The security rounds' transcripts are reports, not ground truth; where I could,
  I re-derived from the committed tree.
- Issue numbers are against `djjay0131/website` (checked).

## Recommendations

1. **Fix MF-1 before dispatch** (merge-first is fine only if it lands before the
   owner runs the workflow; otherwise D19's automation claim is false). Export
   `TF_VAR_project_id` from `vars.GCP_PROJECT_ID` and `TF_VAR_billing_account`
   from a new repository secret.
2. **Fix MF-2** in this PR: rewrite `infra/notes-sync.tf:4-19`.
3. Reword the `-target` comment (A-2) to "only these two resources and their
   dependency closure" (matching Red Team R2-N1).
4. Fold the `serviceusage.serviceUsageAdmin` narrowing into #112 (A-3), and
   reconcile the pattern's invariant text with its reference implementation
   (A-7).
5. Consider `environment:` (A-8) and a sync-failure alert (A-5) as follow-ups,
   not merge gates.

## Alternatives

- **Merge as "Comment" and fix MF-1/MF-2 in a fast-follow.** Acceptable only if
  MF-1 lands before the owner's dispatch; the security posture does not change,
  but the decision is not delivered until the apply can run.
- **Split the secret sync from the Terraform apply.** Would sidestep MF-1's
  variable plumbing only if the apply moved to a root that already carries the
  variables; it does not remove the requirement.
- **Two-phase bootstrap** (Terraform owns the secret container; the workflow owns
  versions only) — the strongest narrowing of #112, and it removes the
  "API-disabled" branch. Worth evaluating in #112, not here.

## Risks

- **R-1 (open, MF-1):** D19's promise fails on first dispatch; the accessor
  binding stays unapplied, leaving notes-sync dormant with a red workflow.
- **R-2 (open, MF-2):** an operator following `notes-sync.tf` runs the manual
  `gcloud` command, defeating the decision's premise (not a leak; a policy
  regression and an out-of-band secret).
- **R-3 (accepted, tracked):** project-level `secretmanager.admin` on
  `gate-deploy` can read/delete/re-policy **every** secret (#112). Practical
  surface is one secret today.
- **R-4 (accepted, tracked):** `gate-deploy` can deploy a revision running as
  `hub-gate` (#115), contradicting `gate.tf:11-12`.
- **R-5 (accepted, tracked):** WIF admits a future `workflow_run`/`issue_comment`
  (#113); branch protection does not force code-owner review (#114).
- **R-6 (inherent):** repo-secret trust boundary for same-repo writers (A-8);
  R3 in the Red Team handoff.

## Open questions

- Q1. Where should the billing account come from in CI — a new repository secret
  (`BILLING_ACCOUNT`), or a narrower root that does not require it? (Owner.)
- Q2. Should MF-2's rewrite of `notes-sync.tf` land in this PR or a fast-follow?
- Q3. #112: does the narrowing also cover `serviceusage.serviceUsageAdmin` (A-3)?
- Q4. #115: should the sync identity be split from `gate-deploy` to remove the
  actAs-`hub-gate` overlap?
- Q5. Should `sync-secret` be gated by an `environment:` with required reviewers?

**What waits on the owner (nothing here can be verified from the tree):** the
three GitHub names in `djjay0131/website` — the secret `NOTES_EXPORT_APP_KEY` and
the variables `NOTES_EXPORT_APP_ID` and `NOTES_EXPORT_INSTALLATION_ID` — then
`gh workflow run secrets-sync.yml`; plus the console actions in #113/#114/#115.
No unverifiable claim is used to block: MF-1 and MF-2 are both reproduced from
the committed tree.

## Related docs

- `.github/workflows/secrets-sync.yml` (triggers `:45-52`, guard `:90-100`, sync
  `:114-165`, terraform job `:170-240`)
- `infra/secrets-sync.tf` (`:40-44` admin, `:49-53` serviceusage, `:61-74` state,
  `:82-86` browser), `infra/notes-sync.tf:4-19,23-28`,
  `infra/variables.tf:1,52`, `infra/versions.tf:35-38`, `infra/gate.tf:456-468,478-482`,
  `infra/wif.tf:66-71`, `infra/README.md` §State
- `llm/governance/adr/0022-annotation-export-transport.md:15-21,36-49,92-127`
- `llm/governance/patterns/secrets-management.md:11-13,31-32,52-59`
- `docs/secrets-management.md`
- `llm/sprints/2026-09-hub/STATE.md:3844-3864,3913-3973`
- `llm/sprints/2026-09-hub/contracts/adversarial-d19-secrets-sync.md`
- `llm/sprints/2026-09-hub/handoffs/{security-tester,red-team}-d19-secrets-sync.md` (`# Round 2`)
- `llm/plans/2026-10-01-completion-brief.md` §5/§6/§7/§9;
  `llm/governance/governance-delta.md` §Domain Review Questions

## ADR candidates

- **C-narrow-sync-identity** (carried): a credential-bootstrapping workflow must
  not hold a value-read capability; split container creation (Terraform +
  secret-scoped grant) from version-write (workflow). This is the general rule
  #112 needs and the pattern implies but does not state.
- **C10** (existing, adopted): remote GCS state backend.
- **C-D19-1** (Red Team): the sync identity is not the deploy identity.
- **C-D19-2** (Red Team): WIF admission should allowlist the event, not denylist
  one.
- **C-D19-3** (Red Team): "adds-only" applies should be enforced by a reviewed
  plan, not a comment.
- **C-D19-4** (this review): a CI Terraform job must receive every required
  root variable as code/secret by construction, or it fails closed at plan; a
  plan that "is adds-only" is not evidence that it *runs*.

## Reproductions (read-only)

```
$ bash /tmp/opencode/d19/run-check1.sh
RESULT: 17 passed, 0 failed            # leak harness against the committed workflow

$ cd infra && terraform fmt -check -recursive       # exit 0
$ cd infra && terraform validate                    # Success! The configuration is valid.
$ cd infra && terraform plan -input=false -refresh=false -lock=false \
    -target=google_secret_manager_secret_iam_member.hub_gate_notes_export_key \
    -target=google_cloud_run_v2_service.gate -out=/tmp/opencode/d19-plan.tfplan
Plan: 1 to add, 0 to change, 0 to destroy.

$ cd /tmp/opencode/d19-ci2   # clean infra copy, terraform.tfvars + state removed
$ terraform init -backend=false -input=false
$ TF_VAR_notes_export_app_id=… TF_VAR_notes_export_installation_id=… \
    terraform plan -input=false -refresh=false -lock=false -target=…
Error: No value for required variable  (project_id)          # PLAN_RC=1
Error: No value for required variable  (billing_account)

$ gh api repos/djjay0131/website/issues/112 --jq '{number,state,title}'
{"number":112,"state":"open","title":"Narrow gate-deploy's project-level Secret Manager role (D19 follow-up)"}
# same for 113, 114, 115 — all open
```

## Governance level

The PR declares **L2 — Implementation (semantic; human review required)**. I
**agree**. The PR mixes an L1-flavored artifact (ADR-0022 amendment; the new
`llm/governance/patterns/secrets-management.md`) with L2 implementation
(workflow, Terraform), and the repo's own rule is "a PR touching several levels
takes the highest" (`.github/pull_request_template.md:9-11`); on the repo's
recorded reading, ADRs are L1 and implementation is L2, so the highest is L2
(`STATE.md:1327-1332`). The orchestration brief pins every stream at L2. This
change does not alter roadmap acceptance criteria (which is what escalated PR
#25 to L3). L2 is correct. It requires human/owner review and merge either way.

---

Reviewer: Chief Reviewer · report-only, no fix applied.

# Round 2

Status: Delivered (re-verification)
Date: 2026-10-08
Role: Chief Reviewer (authored nothing in this wave; review and report only)
Branch: `feat/secrets-sync` · PR **#116** · head **`df728bb`** (3 commits ahead
of `main`; round 1 reviewed `672cb0e`).
Scope: re-verify MF-1 and MF-2 against the updated tree; re-check the round-1
advisories; confirm `fmt`/`validate`, YAML, and triggers.

Read-only statement: no git/gh/gcloud/firebase mutation. I created no tracked
file except this append. For the CI reproduction I copied `infra/` to a scratch
directory under `/tmp/opencode/d19-r2root/` (with a copy of
`site/notes-routing.json`) and removed the copy's `terraform.tfvars` and local
state files — **no repository file was moved**. `git status` shows only this
handoff modified. I ran only `terraform fmt -check`, `terraform validate`,
`terraform show -json`, and read-only `terraform plan` (no apply).

## Round-2 verdict

**Request changes — one remaining must-fix (MF-3).** MF-1 and MF-2 are fixed and
reproduced; MF-3 is new and was exposed precisely because the Terraform job now
runs: the targeted gate apply reverts an unrelated, live env value. The security
posture is unchanged and still sound.

| # | Sev | Finding | Pointer |
|---|---|---|---|
| MF-1 | **fixed** | The TF job now exports `TF_VAR_project_id` and derives `TF_VAR_billing_account` from state; fails loudly if absent. Reproduced: tfvars-free targeted plan **1 to add, 1 to change, 0 to destroy, RC=0**. | `.github/workflows/secrets-sync.yml:229-243` |
| MF-2 | **fixed** | `infra/notes-sync.tf` header rewritten for D19; no `gcloud secrets` command anywhere in `infra/` (only prose describing its removal). | `infra/notes-sync.tf:1-19`; `infra/secrets-sync.tf:3` |
| MF-3 | **must-fix (new)** | The CI apply reverts `GATE_ALLOWED_ORIGINS` (drops the legacy `…a.run.app` hash spelling) because `gate_extra_allowed_origins` is only in the local, git-ignored `terraform.tfvars`. | `.github/workflows/secrets-sync.yml:229-259`; `infra/variables.tf:365`; `infra/terraform.tfvars` (local) |
| A-1 | remains (re-scoped) | The Security Tester / Red Team round-2 verdicts still attach to a pre-`df728bb` workflow (reviewed hash `95db1a31…`; now `8dfa39c4…`); the new billing-derivation step was not adversarially tested. | see below |
| A-2 | remains | `-target` comment still overstates ("no other resource can be modified"). | `.github/workflows/secrets-sync.yml:245-249` |
| A-4 | remains | Disable loop still swallows a `versions list` failure with `|| true`. | `.github/workflows/secrets-sync.yml:161-163` |
| A-9 | **resolved** | STATE now marks D18 hard stop 2 "since replaced by D19". | `STATE.md:3896` |
| A-10 | new (advisory) | `TF_VAR_billing_account` is written to `$GITHUB_ENV` without `::add-mask::`, though `billing_account` is declared `sensitive`. | `.github/workflows/secrets-sync.yml:243`; `infra/variables.tf:54` |
| A-3/A-5/A-6/A-7/A-8 | remain | unchanged from round 1 (serviceusage breadth; no sync-failure alarm; CLI version unpinned; pattern invariant vs reference implementation; repo-secret trust boundary). | round-1 tables |

## MF-1 — fixed (reproduced)

The new step (`.github/workflows/secrets-sync.yml:229-243`) runs after
`terraform init`, exports `TF_VAR_project_id=${GCP_PROJECT_ID}`, and derives
`TF_VAR_billing_account` from state via
`terraform show -json | jq -r '.. | objects | select(.type? == "google_billing_budget") | .values.billing_account? // empty'`,
exiting non-zero with `::error::` if empty. I confirmed the derivation against
the live state and re-ran the exact CI plan from a tfvars-free copy:

```
$ terraform show -json | jq -r '… google_billing_budget … .values.billing_account' | head -n1
011A3C-…-8B0DB7

$ TF_VAR_project_id=cusati-hub TF_VAR_billing_account=… \
    TF_VAR_notes_export_app_id=… TF_VAR_notes_export_installation_id=… \
    TF_VAR_notes_export_enabled=true \
    terraform plan -input=false -refresh=false -lock=false \
      -target=google_secret_manager_secret_iam_member.hub_gate_notes_export_key \
      -target=google_cloud_run_v2_service.gate -out=/tmp/opencode/d19-r2-plan.tfplan
Plan: 1 to add, 1 to change, 0 to destroy.        # RC=0, no terraform.tfvars present
```

The failure path is sound: `set -euo pipefail` plus the explicit `-z` guard means
a state read that cannot find the budget aborts the job rather than proceeding
with an unset required variable. MF-1 is closed.

## MF-2 — fixed (confirmed)

```
$ grep -rn "gcloud secrets" infra/
infra/secrets-sync.tf:3:# Owner decision D19 replaces the manual `gcloud secrets create` hard stop with
```

The only hit is prose stating that the manual command is **replaced**. The
`infra/notes-sync.tf` header (`:1-19`) now describes D19: the owner pastes the
three GitHub names and dispatches `secrets-sync.yml`, which creates the secret,
adds a version, disables priors, and applies this binding; Terraform owns only
the `secretAccessor` binding and holds no key. MF-2 is closed.

## MF-3 — new must-fix: the CI apply reverts `GATE_ALLOWED_ORIGINS`

Making the TF job runnable reveals what it will actually apply. The saved plan
from the reproduction above changes the gate service env as follows:

```
BEFORE  GATE_ALLOWED_ORIGINS=https://jason.cusati.us,https://hub-gate-410552878319.us-east1.run.app,https://hub-gate-ywkmredngq-ue.a.run.app
AFTER   GATE_ALLOWED_ORIGINS=https://jason.cusati.us,https://hub-gate-410552878319.us-east1.run.app
```

The "1 to change" is therefore **not** just setting `GATE_NOTES_*`; it also
**drops the legacy hash spelling** of the gate URL. Cause: the only source of
that value is the local, git-ignored `infra/terraform.tfvars` —

```
# Issue #62: the hash spelling of the gate URL (status.url) that gate.yml sends as Origin.
# Passed on the CLI at the Wave 0 apply; without it here, every plan tries to drop it.
gate_extra_allowed_origins = ["https://hub-gate-ywkmredngq-ue.a.run.app"]
```

— and the variable defaults to `[]` (`infra/variables.tf:365`). CI has no
`terraform.tfvars`, and the workflow supplies no
`TF_VAR_gate_extra_allowed_origins`, so the targeted
`google_cloud_run_v2_service.gate` apply writes the default set.

Why it matters: `gate_extra_allowed_origins` is the issue-#62 fix; README records
that the gate has two live `*.run.app` spellings and that "if the service answers
on the older one, sign-out from that host is refused until it is added to
`var.gate_extra_allowed_origins`" (`infra/README.md:99,479-482`), and STATE's live
verification used `hub-gate-ywkmredngq-ue.a.run.app`. After the owner dispatches
`secrets-sync`, the gate's CSRF accepted-origin set loses that host, so sign-out
(and any origin check) from it is refused — a silent, live regression delivered
by the D19 apply.

Fix: carry the value through CI too. Add a repository **variable**
(e.g. `GATE_EXTRA_ALLOWED_ORIGINS`, not secret) holding the hash spelling, and
export `TF_VAR_gate_extra_allowed_origins` in the variable-supply step next to
`TF_VAR_project_id` (parse it into a list, or use the JSON form
`-var 'gate_extra_allowed_origins=[…]'`). This is an owner-visible config value,
so it also belongs in the workflow header's "what the owner sets" list. Until
then, the workflow's apply is not "the notes-sync binding + the gate env" only;
it also reverts a documented setting.

## Advisory re-checks

- **A-1 — remains, re-scoped.** Neither adversarial handoff was touched by
  `df728bb` (`git show df728bb --stat` lists only the workflow, `notes-sync.tf`,
  `STATE.md`, and the round-1 chief-reviewer file). Their round-2 "no new
  bypass" therefore certifies a workflow (sha `95db1a31…`) that is no longer the
  committed one (`8dfa39c4…`). The two deltas since — save-then-apply, and the
  new billing/state read — were not adversarially tested; I reviewed both here.
  The billing step reads the whole state JSON into `jq` (never echoed, no
  `set -x`), so it introduces no value-leak path, but it is a new
  credential-adjacent surface and should be named in the adversarial record (or
  re-run at `df728bb`).
- **A-2 — remains.** The `-target` comment
  (`.github/workflows/secrets-sync.yml:245-249`) still says "so no other resource
  can be modified even if the state drifts"; `-target` includes the dependency
  closure. Reword. MF-3 is a related reminder: targeting a resource applies its
  whole config, not just the intended attribute.
- **A-4 — remains.** `:161-163` still appends `|| true` to the `versions list`
  substitution; a failed list silently leaves prior versions enabled (no leak).
- **A-9 — resolved.** `STATE.md:3896` now reads "(the D18 hard stop 2, **since
  replaced by D19**)".
- **A-3, A-5, A-6, A-7, A-8 — remain** unchanged (project-wide
  `serviceusage.serviceUsageAdmin`; no secret-sync failure alarm; Terraform CLI
  version not pinned; pattern invariant `:57-59` vs its own reference
  implementation; same-repo secret trust boundary).

## New advisory A-10

`TF_VAR_billing_account` is appended to `$GITHUB_ENV`
(`.github/workflows/secrets-sync.yml:243`). `billing_account` is declared
`sensitive = true` (`infra/variables.tf:54`) and `.gitignore` keeps it out of the
repo, yet `$GITHUB_ENV` values are not automatically masked (unlike registered
secrets). No current step prints the environment, so there is no leak today, but
`echo "::add-mask::${BILLING}"` before writing it would match the sensitivity the
repo already declares. Low.

## Confirmations requested

- `terraform fmt -check -recursive` → exit 0.
- `terraform validate` → "Success! The configuration is valid."
- YAML parses; `on:` = `['workflow_dispatch', 'push']`; `push` =
  `{branches: [main], paths: [.github/workflows/secrets-sync.yml]}`; no other
  trigger key.
- No destructive action in the plan: **1 to add, 1 to change (the gate service
  env, including the MF-3 revert), 0 to destroy**; `fmt`/`validate` clean.
- The committed workflow sa is `8dfa39c4…`; the round-1 must-fix commit
  `df728bb` also carries this handoff's round-1 text (321 lines) — hence this
  append rather than a rewrite.

## Governance level

Unchanged: **L2** (implementation is the highest level touched; ADR-0022 §1/§5
amendment is L1-flavored; the repo's rule takes the highest). Agree.

## What waits on the owner (unchanged, plus MF-3)

The three GitHub names in `djjay0131/website` — secret `NOTES_EXPORT_APP_KEY`,
variables `NOTES_EXPORT_APP_ID` and `NOTES_EXPORT_INSTALLATION_ID` — then
`gh workflow run secrets-sync.yml`; and, if MF-3 is fixed by configuration, a new
repository variable for the legacy allowed origin. Plus the console actions in
#113/#114/#115. Nothing unverifiable blocks: MF-3 is reproduced from the
committed tree and the live state. No fix applied in this round.

## Related docs (Round 2)

- `.github/workflows/secrets-sync.yml` (supply step `:229-243`, plan `:253-259`)
- `infra/notes-sync.tf:1-19`; `infra/terraform.tfvars` (local, git-ignored);
  `infra/variables.tf:365`; `infra/README.md:99,455-482`
- `llm/sprints/2026-09-hub/STATE.md:3893-3898` (A-9)
- `llm/sprints/2026-09-hub/handoffs/{security-tester,red-team}-d19-secrets-sync.md`
  (`# Round 2` — hash `95db1a31…`, pre-`df728bb`)

## ADR candidates (Round 2)

- **C-D19-5** (new): a CI apply that targets a *whole* Terraform resource to set
  one attribute must carry every variable that resource's config reads, or it
  will revert the attributes owned by values that live only on an operator's
  machine. The general form of MF-3, and the reason "adds-only" and "-target'd"
  are not sufficient safety statements on their own.

# Round 3 (final)

Status: Delivered (final re-verification)
Date: 2026-10-08
Role: Chief Reviewer (authored nothing; review and report only)
Branch: `feat/secrets-sync` · PR **#116** · head **`96a8406`** (4 commits ahead
of `main`; round 2 reviewed `df728bb`).

Read-only statement: no git/gh/gcloud/firebase mutation; no repository file
moved. Reproduction ran in a scratch mirror under `/tmp/opencode/d19-r3root/`
(`infra/` copy + `site/notes-routing.json`, `terraform.tfvars` and local state
removed). Only this handoff is modified. No apply.

## Final verdict

**Approve — merge is unblocked; zero remaining must-fix.** All three must-fixes
are fixed and independently reproduced. Residual items are advisories only.

## Must-fix dispositions (all closed)

| # | Fixed in | Re-verification |
|---|---|---|
| MF-1 | `df728bb` | Re-run in the scratch mirror (no `terraform.tfvars`): plan `1 to add, 1 to change, 0 to destroy`, RC=0. `TF_VAR_project_id` from `vars.GCP_PROJECT_ID`; `TF_VAR_billing_account` derived from state and masked. |
| MF-2 | `df728bb` | `grep -rn "gcloud secrets" infra/` → only the prose at `infra/secrets-sync.tf:3`; `infra/notes-sync.tf:1-19` is D19-correct. |
| MF-3 | `96a8406` | Reproduced with the real repo variables: `GATE_ALLOWED_ORIGINS` is **unchanged** by the plan, and the legacy hash origin is preserved. See below. |
| A-10 | `96a8406` | `echo "::add-mask::${BILLING}"` precedes `TF_VAR_billing_account` (`.github/workflows/secrets-sync.yml:254`). |

## MF-3 — fixed (reproduced with the real repository variables)

The new "Supply the required Terraform variables" step reconstructs
`TF_VAR_gate_extra_allowed_origins` from the live state: it takes the service's
current `GATE_ALLOWED_ORIGINS`, subtracts the two bases Terraform renders
(`https://${SITE_URL%/}` and
`https://${GCP_GATE_SERVICE}-<project number>.<GCP_GATE_REGION>.run.app`, the
number parsed from `GCP_WIF_PROVIDER`), and writes the remainder.

Repository variables (read via `gh api`, **14 total** — a first unpaginated list
showed only 10 and briefly hid `SITE_URL`; `--paginate` is required):

```
GCP_PROJECT_ID=cusati-hub
GCP_WIF_PROVIDER=projects/410552878319/locations/global/workloadIdentityPools/github-actions/providers/website
GCP_GATE_SERVICE=hub-gate   GCP_GATE_REGION=us-east1
SITE_URL=https://jason.cusati.us
```

Exact derivation reproduced in the scratch mirror (no `terraform.tfvars`):

```
CURRENT = https://jason.cusati.us,https://hub-gate-410552878319.us-east1.run.app,https://hub-gate-ywkmredngq-ue.a.run.app
BASE_DOMAIN = https://jason.cusati.us        BASE_NUMBER = https://hub-gate-410552878319.us-east1.run.app
EXTRAS = ["https://hub-gate-ywkmredngq-ue.a.run.app"]
```

Plan with `TF_VAR_project_id`, `TF_VAR_billing_account`,
`TF_VAR_gate_extra_allowed_origins`, and the notes vars:

```
Plan: 1 to add, 1 to change, 0 to destroy.        # RC=0
origins_same = true
changed env vars on google_cloud_run_v2_service.gate:
  GATE_NOTES_APP_ID:            (none) -> <id>
  GATE_NOTES_INSTALLATION_ID:   (none) -> <id>
  GATE_NOTES_EXPORT_ENABLED:    0 -> 1
```

The "1 to change" is exactly the notes env — `GATE_ALLOWED_ORIGINS` is not in the
diff, and the hash origin (#62) survives. MF-3 is closed. (This also means my
round-1/2 concern about the origin being reverted is fully resolved now that the
Terraform job can actually run.)

## Confirmations requested

- `terraform fmt -check -recursive` → exit 0; `terraform validate` → success.
- YAML parses; `on:` = `['workflow_dispatch', 'push']`; `push` =
  `{branches: [main], paths: [.github/workflows/secrets-sync.yml]}`; no other
  trigger.
- No destructive action: `1 to add, 1 to change, 0 to destroy`.
- Committed workflow sha `1a15cf1e…`; `grep "gcloud secrets" infra/` clean.

## Residual advisories (non-blocking; carry forward)

All round-1/2 advisories not previously closed remain, unchanged:
**A-1** (Security Tester / Red Team rounds still attach to pre-`df728bb`
revisions — the billing derivation and origin reconstruction were never
adversarially tested; I reviewed both and found no value-leak path), **A-2**
(`-target` comment overstates — `.github/workflows/secrets-sync.yml:273-280`),
**A-3** (`serviceusage.serviceUsageAdmin` project-wide, not named by #112),
**A-4** (disable loop swallows `versions list` failure — `:161-163`), **A-5** (no
secret-sync failure alarm), **A-6** (Terraform CLI version not pinned), **A-7**
(pattern invariant vs its own reference implementation), **A-8** (same-repo
secret trust boundary). A-9 and A-10 are closed.

New (round 3):

- **A-11 — the reconstruction silently depends on `SITE_URL` exactly equalling
  `https://<var.domain>`.** If `SITE_URL` is unset or different, the base
  site-domain is not subtracted and `GATE_ALLOWED_ORIGINS` gains a **duplicate**
  that then grows on every dispatch. Measured in the scratch mirror: with
  `SITE_URL` empty, `EXTRAS` = `[https://jason.cusati.us, <hash>]`,
  `origins_same=false`, and `AFTER` = base + number + **duplicate site-domain** +
  hash. The repo sets `SITE_URL=https://jason.cusati.us` today, so this is not
  live; a guard (or subtracting the known `var.domain` default) would harden it.
  It also makes `SITE_URL`, `GCP_GATE_SERVICE` and `GCP_GATE_REGION` load-bearing
  for `secrets-sync`, worth a line in the workflow header's owner/config notes.
- **A-12 — `terraform show -json` is invoked twice** in the step (billing, then
  origins); compute it once.

## Governance level

Unchanged: **L2** — agree.

## What waits on the owner (unchanged)

The three GitHub names in `djjay0131/website` — secret `NOTES_EXPORT_APP_KEY`,
variables `NOTES_EXPORT_APP_ID` and `NOTES_EXPORT_INSTALLATION_ID` — then
`gh workflow run secrets-sync.yml`. No fix applied in this round.

## Related docs (Round 3)

- `.github/workflows/secrets-sync.yml` (supply step `:235-271`, plan `:281-287`)
- `infra/gate.tf:55-58` (`local.gate_allowed_origins`), `infra/variables.tf:365`,
  `infra/README.md:99,455-482`
- round-1/2 sections of this handoff

## ADR candidates (Round 3)

- **C-D19-5** (carried): a CI apply targeting a whole resource to set one
  attribute must carry every variable that resource's config reads.
- **C-D19-6** (new, from A-11): a CI job that reconstructs an input from
  configuration that lives on an operator's machine (here, an origin list in a
  git-ignored `terraform.tfvars`) should derive it from the same source of truth
  the configuration uses (the `var.domain` default), not from a second variable
  (`SITE_URL`) that must be kept in exact agreement.
