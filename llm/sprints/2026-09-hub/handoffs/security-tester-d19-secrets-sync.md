# Handoff — Security Tester, adversarial round D19 (secrets-sync)

Status: Delivered
Date: 2026-10-08
Stream: Security Tester (owns the gate; VETO on any FAIL)
Branch: `feat/secrets-sync` (working tree; **nothing committed**)
Head: `757474a` (base `main`); D19 artifacts are uncommitted — `M
infra/versions.tf`, `M llm/governance/adr/0022-annotation-export-transport.md`,
`?? .github/workflows/secrets-sync.yml`, `?? infra/secrets-sync.tf`,
`?? llm/governance/patterns/secrets-management.md`, `?? docs/secrets-management.md`,
`?? llm/sprints/2026-09-hub/contracts/adversarial-d19-secrets-sync.md`
Contract: `llm/sprints/2026-09-hub/contracts/adversarial-d19-secrets-sync.md` (§Security Tester)
Authority: `llm/governance/adr/0022-annotation-export-transport.md` §5 (amended D19)
Artifacts: `/tmp/opencode/d19/{extract.py,bin/gcloud,run-check1.sh,blocks.json,*.log}`

## Verdict

**Round 2 (2026-10-08, re-verification) — NO VETO; 0 FAIL / 6 PASS.** Check 4,
the round-1 FAIL, is remediated to **PASS-with-caveat**: the narrowing follow-up
now exists as **issue #112** with a concrete plan, and project-level
`roles/secretmanager.admin` is the D19-named fallback whose practical read
surface today is the single secret the workflow creates. Checks 2 and 6 remain
PASS; the `-target`ed apply removes the round-1 "can touch unintended resources"
caveat. The wave is clear to merge. Full re-verification, evidence, and the new
check table are in **`# Round 2`** at the end of this file; the round-1 analysis
immediately below is retained unchanged for the record.

**Round 1 (2026-10-08, superseded) — VETO, 1 FAIL / 5 PASS.** Checks 1, 2, 3, 5 pass; checks 2 and 6 pass with a
recorded caveat. **Check 4 FAILS**: the workflow identity authenticates as
`gate-deploy`, which holds **project-level `roles/secretmanager.admin`**, and
that role includes `secretmanager.versions.access` on **every** secret in
`cusati-hub` — so it *can* read a secret it did not create. The disclosure in
`infra/secrets-sync.tf:36-39` names a narrowing follow-up **as issue #112, but
no such issue (or PR) exists** (`gh api …/issues/112` → 404; the repository's
highest issue is #111). The compensating control the caveat depends on is
therefore not recorded, and the literal check fails. This is a **VETO** on the
D19 cut as written. It is cheap to clear: file #112 with a concrete plan, or
land the secret-scoped narrowing, and the row becomes PASS-with-caveat.

No other check is a FAIL, and no secret value was observed to leak anywhere in
check 1 (17/17 harness assertions pass).

## Check table

| # | Check | Verdict | Evidence |
|---|---|---|---|
| 1 | Key cannot leak via logs / artifacts / step outputs / job summary / temp residue | **PASS** | 17/17 assertions on the extracted `run:` block under a stub `gcloud`: canary absent from stdout+stderr+argv+`$GITHUB_OUTPUT`; value only ever in a `0600` `mktemp` file (`sha256` verified), removed by the `EXIT` trap on success, on `set -e` failure, and on the create/enable path; no `set -x`; no `upload-artifact`, no `$GITHUB_STEP_SUMMARY` in the workflow |
| 2 | No `pull_request` / `pull_request_target` / `workflow_run` / `issue_comment` trigger; unreachable from a fork | **PASS** (caveat) | `secrets-sync.yml:43-50` = `workflow_dispatch` + `push[main, paths secrets-sync.yml]` only; no dangerous trigger in any of the four workflows; WIF provider admits only this repo (numeric ids + name, `pull_request_target` refused) at `wif.tf:66-71`, and the SA binding pins `…/refs/heads/main` at `gate.tf:478-482`. Caveat: repo secrets are readable by any *same-repo* branch workflow (GitHub provides secrets to non-fork runs), so a write-capable collaborator is a trust boundary independent of this workflow (see Risks) |
| 3 | No-op path: unset repository secret = empty string, credentialed steps skipped, green | **PASS** | `guard` sets `have_key=false` from `[ -z "${NOTES_EXPORT_APP_KEY}" ]` (`secrets-sync.yml:88-98`); `auth`/`setup-gcloud`/`sync` all carry `if: steps.guard.outputs.have_key == 'true'` (`:101,:109,:115`); `terraform` job `if: needs.sync-secret.outputs.have_key == 'true'` (`:163`), with the job output wired at `:75-76`. Guard harness returns 0 and `have_key=false` when unset |
| 4 | Workflow identity cannot read a secret it did not create | **FAIL** | `secrets-sync.tf:40-44` grants `gate_deploy` **project-level** `roles/secretmanager.admin`; `gcloud iam roles describe roles/secretmanager.admin` includes `secretmanager.versions.access` (+ `secrets.delete`, `secrets.setIamPolicy`) → read of **any** secret in the project. Disclosure at `secrets-sync.tf:36-39` names #112, but **#112 does not exist** (max issue #111), so the gap is neither narrowed nor tracked |
| 5 | Accessor binding is the runtime's, secret-scoped; no key file; no credential in state | **PASS** | `notes-sync.tf:23-28` = `google_secret_manager_secret_iam_member.hub_gate_notes_export_key`, `hub-gate` → `roles/secretmanager.secretAccessor`, `secret_id = "notes-export-app-key"` — secret-scoped, no project role. No `google_service_account_key`, no `google_secret_manager_secret`/`_version` resource anywhere in `infra/*.tf`; the only `google_secret_manager*` resource is the binding |
| 6 | Terraform changes adds-only (no destroy/replace of stateful resource); declared backend; assess full `-refresh=false` apply | **PASS** (caveat) | `git status infra`: `M versions.tf` (backend comment → `backend "gcs"` block, no resource), `?? secrets-sync.tf` (all `_iam_member`, additive). Backend declared `bucket = "cusati-hub-tfstate"`, `prefix = "infra"` (`versions.tf:35-38`). Caveat: the workflow runs a **full, unscoped** `terraform apply` (`:219-222`), not `-target`; see Risks |

## Summary

D19 replaces the manual `gcloud secrets` step with
`.github/workflows/secrets-sync.yml`. The secret-handling mechanics are sound:
the value is never echoed, never on a command line, never an output or artifact,
and lives in a `0600` `mktemp` file under `umask 077` removed by an `EXIT` trap.
The trigger surface is correct (dispatch + a `paths`-scoped push to `main`), and
the WIF chain admits only `refs/heads/main` of this repository. The runtime path
is least-privileged (secret-scoped `secretAccessor` for `hub-gate`).

The one failing property is the *workflow's* identity. `gate-deploy` is granted
project-level `roles/secretmanager.admin` to bootstrap a secret that does not yet
exist when the apply runs. That role reads (and deletes, and re-policies) every
secret in the project. The design/documentation discloses this and pins the fix
to issue #112 — but #112 was never filed, so the disclosure has no backing
record and the property is simply false today. Everything else passes.

## Assumptions

- **A1.** "Read a secret it did not create" is judged against the capability of
  the granted role, not against the current contents of the project. The project
  holds one secret today (`infra/secrets-sync.tf:35-36`), so the *practical*
  blast radius today is that one secret; the *capability* is every secret.
- **A2.** GitHub's documented behavior that an unset repository secret resolves
  to `""` and that non-fork runs (including branch runs) receive repository
  secrets is taken as given; it cannot be exercised from this read-only session.
- **A3.** The real `gcloud` tool is assumed not to print secret payloads on the
  `versions add`/`disable` paths; only a stub was used (no credentials). GitHub's
  log masking of `secrets.*` is a backstop, not the control.
- **A4.** "Stateful resource" = private bucket, Firestore, Artifact Registry, the
  Cloud Run service's identity/env, IAM. The `versions.tf` backend change is a
  state *location* change, not a resource change.
- **A5.** Issue-number references (`#112`) are to `djjay0131/website`; checked
  there and in the sibling repos.

## Recommendations

1. **File #112 (or land the narrowing) before accepting D19.** The comment at
   `infra/secrets-sync.tf:36-39` already specifies the target: a secret-scoped
   `secretmanager.admin` for the one secret plus a create-only project role. If
   the provider cannot express it (as the comment argues), say so *in the issue*
   and record the accepted residual, so the caveat is a tracked decision rather
   than a dangling reference.
2. **Scope the apply, don't just rely on the diff.** Prefer `-target` on the two
   intended resources (the `hub-gate` accessor binding and the `google_cloud_run_v2_service.gate` env), or split the secret-sync apply into its own root/workspace so a future merge cannot be swept into a secret rotation. Today the plan is "1 to add, 1 to change, 0 to destroy", but the command itself is a general apply.
3. **Consider a GitHub Environment** (`environment:` with required reviewers) for
   `sync-secret`, so the repository secret is not readable by an arbitrary
   branch run by any writer (see Risks R3).
4. **Update `STATE.md`.** D19's artifact list names `STATE.md §D19`, but no such
   section exists; `STATE.md:3847-3857` still documents the *manual*
   `gcloud secrets create … && gcloud secrets versions add …` hard stop. That is
   the exact step D19 removes, so the sprint record currently contradicts the
   decision.
5. **Narrow `serviceusage.serviceUsageAdmin`** if possible (it enables/disables
   *any* API project-wide); at minimum record it alongside #112. The pattern doc
   (`patterns/secrets-management.md:52-56`) asks implementers to "record any
   broadening and open a narrowing follow-up" — this is the place.

## Alternatives

- **Keep the manual `gcloud` step.** Rejected by D19. The D19 path is strictly
  better for reviewability; the only cost is the project-level role, which is a
  narrowing problem, not a reason to keep the manual path.
- **Custom project role (create + `versions.add`/`disable` only) plus a
  secret-scoped `_member` added *after* first creation.** The `secrets-sync.tf`
  comment rejects a bespoke custom role as no narrower than admin; that is true
  only if it also carries `setIamPolicy`. A custom role without `setIamPolicy`
  and without `versions.access` would be narrower and would *not* let the sync
  identity read values. Worth re-evaluating in #112.
- **Two-phase bootstrap:** create the (empty) secret resource in Terraform
  (no version), grant a secret-scoped role, then have the workflow only
  `versions.add`/`disable`. This removes the project-level role entirely, at the
  cost of a Terraform-managed secret container. This is the strongest narrowing
  candidate; it also removes the "API might be disabled" branch (the service
  would be declared as `google_project_service`).

## Risks

- **R1 — Check 4 (open, VETO).** Project-level `secretmanager.admin` on
  `gate-deploy`. Any run of `secrets-sync.yml` or `gate.yml` on `main` (or a
  future merged change) bears a credential that can read/delete/re-policy every
  secret in `cusati-hub`. Currently one secret exists; the capability outlives
  that coincidence.
- **R2 — Full unscoped apply.** `secrets-sync.yml:219-222` runs
  `terraform apply -auto-approve -refresh=false` over the whole root as
  `gate-deploy`. `-refresh=false` makes it blind to live drift (so it will not
  revert out-of-band changes), but it *will* apply any committed config diff the
  next time it is dispatched — including, in principle, a replace of a stateful
  resource, gated only by review of `main`. The narrow trigger (`paths:`) means a
  merge of `infra/*.tf` alone does not fire it; a later manual dispatch does.
- **R3 — Repo-secret trust boundary.** GitHub delivers repository secrets to any
  workflow run on any ref of the repository that is not a *fork* — including a
  branch run by a user with write access — unless an `environment:` with
  reviewers gates it. WIF's `refs/heads/main` condition stops the *cloud
  credential* on a non-main ref, but the secret value is available to the runner
  before auth. This is inherent to repository secrets and applies to
  `NOTIFICATION_WEBHOOK` too; recorded, not treated as a D19 regression.
- **R4 — Temp-file residue on SIGKILL.** The `EXIT` trap (`:122`) covers normal
  and `set -e` exits (verified). A `SIGKILL` (job cancel/timeout) leaves the
  `0600` file in `/tmp`; GitHub-hosted runners are destroyed after the job, so
  residue is ephemeral. Low.
- **R5 — Broad state-bucket grant.** `roles/storage.objectAdmin` on
  `cusati-hub-tfstate` (`secrets-sync.tf:61-65`) is bucket-scoped, not prefix-
  scoped; it can read/write the whole bucket. Only the `infra` prefix is declared
  in this repo, and the bucket is a one-time bootstrap. Acceptable, worth stating.
- **R6 — `serviceusage.serviceUsageAdmin`** can disable any API (including
  Secret Manager) project-wide; a DoS, disclosed as needed for enablement.

## Open questions

- Q1. Is #112 intended to exist but was never filed (the number is written in
  `secrets-sync.tf:39` as if it does)? What is the concrete narrowing plan?
- Q2. Can the provider express a secret-scoped role for the managed secret, or is
  a two-phase bootstrap (Terraform owns the secret container, workflow owns
  versions) the real path? (See Alternatives.)
- Q3. Is `NOTES_EXPORT_APP_KEY` acceptable as a plain repository secret, or
  should `sync-secret` use an `environment:` with required reviewers?
- Q4. Should the apply be `-target`-scoped or moved to its own root/workspace?
- Q5. Who owns updating `STATE.md` to remove the manual `gcloud` hard stop?

## Related docs

- `llm/sprints/2026-09-hub/contracts/adversarial-d19-secrets-sync.md`
- `.github/workflows/secrets-sync.yml` (`:43-50` triggers, `:88-98` guard,
  `:114-156` sync, `:161-222` terraform)
- `infra/secrets-sync.tf` (`:40-44` the FAIL), `infra/notes-sync.tf:23-28`,
  `infra/versions.tf:35-38`, `infra/gate.tf:439-482`, `infra/wif.tf:66-71`,
  `infra/deploy.tf:66-72`
- `llm/governance/adr/0022-annotation-export-transport.md` §5
- `llm/governance/patterns/secrets-management.md` (invariants `:42-62`)
- `docs/secrets-management.md`
- `llm/sprints/2026-09-hub/STATE.md:3847-3857` (stale manual hard stop)

## ADR candidates

- **C10** (already named in `versions.tf:30-31`): remote GCS state backend —
  adopted by this change.
- **C-narrow-sync-identity**: "a credential-bootstrapping workflow may not hold a
  value-read capability; split container-creation (Terraform, secret-scoped
  grant) from version-write (workflow)". This is the general rule #112 needs and
  the pattern doc's least-privilege invariant (`secrets-management.md:52-59`)
  implies but does not state.

## Reproductions

### Check 1 — leakage harness (17/17 PASS)

```
$ bash /tmp/opencode/d19/run-check1.sh            # EXIT=0, "RESULT: 17 passed, 0 failed"
```

The harness extracts the `run:` block from `secrets-sync.yml` with PyYAML
(`extract.py`), puts a stub `gcloud` first on `PATH`, and runs the block with a
canary-bearing key (`LEAKCANARY_9f3a2b7c`, plus `%s %n -e $(id) `id` ' " \ $HOME`
and embedded newlines). Asserted per scenario (A success, B `versions add`
failure, C create/enable, D guard no-op): canary absent from stdout+stderr,
argv, and `$GITHUB_OUTPUT`; `sha256(tempfile) == sha256(value)`; temp mode `600`;
temp file gone after exit; no `set -x`. Key evidence line (argv is path-only):

```
ARGV: secrets versions add notes-export-app-key --project cusati-hub \
      --data-file=/tmp/tmp.2PCnsJHXsX --format value(name)
Added notes-export-app-key version 42.
::notice::notes-export-app-key is synced; prior versions were disabled; the value was never printed.
```

### Check 2 — trigger enumeration

```
$ python3 /tmp/opencode/d19/enumerate.py
### secrets-sync.yml  triggers: ['workflow_dispatch', 'push']  perms {} 
    job sync-secret: id-token=True    job terraform: if=needs.sync-secret.outputs.have_key == 'true'
### ci.yml            triggers: ['push', 'pull_request']       (no id-token, no secret)
### gate.yml          triggers: ['push', 'pull_request', 'workflow_dispatch']
    build-and-deploy if="github.event_name != 'pull_request' && …"
### build.yml         triggers: ['push', 'pull_request', 'schedule', 'workflow_dispatch']
    notify-failure uses secrets.NOTIFICATION_WEBHOOK, if="failure() && event != 'pull_request'"
```

`grep -Rn 'pull_request_target|workflow_run|issue_comment|repository_dispatch' .github/workflows`
matches only prose (e.g. `build.yml:32` explains the removed
`repository_dispatch`). `secrets.` matches only `NOTES_EXPORT_APP_KEY`
(`secrets-sync.yml:91,117`) and `NOTIFICATION_WEBHOOK` (`build.yml:1626`). WIF:
`wif.tf:66-71` (repo id + owner id + name, `event_name != 'pull_request_target'`);
`gate.tf:481`
`…/attribute.repository_id_ref/${var.github_repository_id}/refs/heads/main`.

### Check 3 — no-op guard

```
$ run guard with NOTES_EXPORT_APP_KEY=""   → rc=0, GITHUB_OUTPUT: have_key=false
$ run guard with the canary key            → rc=0, GITHUB_OUTPUT: have_key=true; canary not in stdout
```

### Check 4 — the FAIL

```
$ gcloud iam roles describe roles/secretmanager.admin --format='value(includedPermissions)' | tr ';' '\n' | grep versions.access
secretmanager.versions.access

$ gh api repos/djjay0131/website/issues/112 --jq '{number,title,state}'
{"message":"Not Found", ... "status":"404"}
$ gh api 'repos/djjay0131/website/issues?state=all&per_page=1&sort=created&direction=desc' --jq '.[0].number'
111
```

Grant: `infra/secrets-sync.tf:40-44` (`google_project_iam_member`,
`role = "roles/secretmanager.admin"`, `member = google_service_account.gate_deploy.member`).
Claim to the contrary: `infra/secrets-sync.tf:36-39` ("the identity can read only
a secret it created today; … tracked as issue #112").

### Check 5 — access path

```
$ grep -Rn 'google_service_account_key|google_secret_manager_secret' infra/*.tf
(only notes-sync.tf:23 google_secret_manager_secret_iam_member)
$ grep -Rn 'secretmanager' infra/*.tf
notes-sync.tf:26  role = "roles/secretmanager.secretAccessor"   # hub-gate, secret-scoped
secrets-sync.tf:42 role = "roles/secretmanager.admin"           # gate_deploy, project-level
```

### Check 6 — diff and backend

```
$ git status --short infra
 M infra/versions.tf
?? infra/secrets-sync.tf
$ git diff infra/versions.tf        # comment → backend "gcs" block; no resource body
$ grep -n 'backend "' infra/*.tf
infra/versions.tf:35:  backend "gcs" {
```

# Round 2

Status: Delivered (re-verification)
Date: 2026-10-08
Stream: Security Tester (owns the gate; VETO on any FAIL)
Branch: `feat/secrets-sync` (working tree; **nothing committed**)
Base: `757474a`; changed since round 1: `M llm/sprints/2026-09-hub/STATE.md`,
`M .github/workflows/secrets-sync.yml` (`-target` flags + header comment; now
untracked-as-new still), `M llm/governance/adr/0022-annotation-export-transport.md`
(§5). `infra/secrets-sync.tf`, `infra/notes-sync.tf`, `infra/wif.tf`,
`infra/gate.tf`, `infra/versions.tf` are **unchanged** since round 1.
Scope: re-verify all six checks against the updated tree.

## Round 2 verdict

**NO VETO — 0 FAIL / 6 PASS.** The round-1 Check 4 FAIL is remediated to
**PASS-with-caveat** (issue #112 now exists and records the narrowing plan); the
round-1 Check 6 caveat (unscoped full apply) is removed by `-target`; Check 2
stays PASS with its recorded same-repo caveat. Nothing else changed. **The wave
may merge.**

## Round 2 check table

| # | Check | Verdict | Evidence (round 2) |
|---|---|---|---|
| 1 | Key cannot leak | **PASS** | Harness re-run on the updated `secrets-sync.yml`: **17/17**, EXIT=0; sync `run:` block byte-identical to round 1 (`:120-158`) |
| 2 | No PR/fork reach | **PASS** (caveat) | Triggers unchanged (`secrets-sync.yml:45-52`); no YAML `pull_request_target:`/`workflow_run:`/`issue_comment:`/`repository_dispatch:` key in any workflow (only a prose mention at `build.yml:32`); WIF unchanged (`wif.tf:66-71`, `gate.tf:481`). Caveat (same-repo write collaborator) stands; header now states branch protection does not require code-owner review and cites #114 |
| 3 | No-op green | **PASS** | Guard harness: unset → rc=0, `have_key=false`; set → `have_key=true`; all credentialed steps still gated (`:103,:111,:117`) and `terraform` job `:165` |
| 4 | Cannot read a secret it did not create | **PASS** (caveat) | **#112 exists** with the narrowing plan; project-level admin is the D19-named fallback; practical read surface today is the one secret it creates. Residual stated below |
| 5 | Runtime access path | **PASS** | `notes-sync.tf:23-28` unchanged; no key resource, no secret resource, no project-level grant for `hub-gate` |
| 6 | Adds-only + backend + full-apply caveat | **PASS** | Apply now `-target`ed (`:224-226`); infra diff still adds-only; backend `versions.tf:35-38` unchanged. Caveat removed |

## Check 4 disposition — PASS-with-caveat (was FAIL)

The literal property ("cannot read a secret it did not create") is still **not**
true as a *capability*: `gate-deploy` holds project-level
`roles/secretmanager.admin` (`infra/secrets-sync.tf:40-44`), which includes
`secretmanager.versions.access` (verified round 1 via
`gcloud iam roles describe`). What changed is the **compensating control the
round-1 FAIL turned on**: the follow-up is now **recorded and concrete**.

```
$ gh api repos/djjay0131/website/issues/112 --jq '{number,title,state}'
{"number":112,"state":"open","title":"Narrow gate-deploy's project-level Secret Manager role (D19 follow-up)"}
```

The issue body states the live fact ("today the identity can read any secret in
cusati-hub — there is exactly one, the one it creates, but the property must
hold as more secrets land") and a narrowing plan: once the secret exists, move
version management and IAM to a **secret-scoped** `roles/secretmanager.admin` on
`notes-export-app-key`, keep only a **create-only project role**
(`secretmanager.secrets.create` + `serviceusage.services.enable`; no
`versions.access`, no project-scope `setIamPolicy`), and verify with a negative
read test. `infra/secrets-sync.tf:36-39` cites #112; `STATE.md` §D19 records it
as the D19-named fallback.

Why this is PASS-with-caveat and not FAIL: the contract's Check 4 asks the tester
to "state the project-level-secretmanager.admin caveat **and whether #112 closes
it**" — i.e. the expected disposition is a disclosed, tracked fallback, with the
untracked-reference being the defect. #112 closes the round-1 defect (the
dangling reference) and schedules the narrowing. The residual caveat is real and
must be carried forward: **the read capability is project-wide until #112
lands.** Today's blast radius is one secret; the design permits the broad role
only because `secretmanager.secrets.create` has no resource to scope to before
the secret exists.

**Residual risk (not a FAIL):** any run of `secrets-sync.yml` or `gate.yml` on
`main` bears a credential that can read/delete/re-policy *every* secret in
`cusati-hub`. It becomes a live exposure the moment a second secret is added
before #112 lands. #112 is the gate on adding that second secret.

## R2 disposition — caveat removed

The round-1 caveat was that the workflow ran a full, unscoped apply. The apply
step is now:

```
224:          terraform apply -input=false -auto-approve -refresh=false -lock-timeout=5m \
225:            -target=google_secret_manager_secret_iam_member.hub_gate_notes_export_key \
226:            -target=google_cloud_run_v2_service.gate
```

`-target` restricts the plan/apply to exactly the accessor binding and the Cloud
Run service, plus their declared dependencies (all no-op in state), so the
workflow **cannot touch an unrelated resource even if state drifts**. Both
targets are non-destructive: the binding is an additive `_iam_member`, and the
service is stateless with `ignore_changes` on the image (`gate.tf:344-356`;
`deletion_protection=false`). The round-1 caveat is removed. `-refresh=false`
remains drift-blind by design, which is the safe direction here (it will not
revert out-of-band changes).

## A7 / A8 confirmations

- **A7 (manual `gcloud` removed): PASS.**
  `grep -n "gcloud secrets" llm/sprints/2026-09-hub/STATE.md` returns only
  supersession prose — lines 3846 and 3918, at `STATE.md:3846` ("Owner decision D19 **replaces**
  D18 hard stop 2 (a manual `gcloud secrets …`)") and `STATE.md:3918` ("the manual `gcloud
  secrets create` hard stop is removed"). No runnable command remains; the D18
  section now points at D19 and a `## D19` section was added (`STATE.md` diff).
- **A8 (CODEOWNERS claim corrected): PASS.** `secrets-sync.yml:38-43` now says
  "current branch protection requires CI and conversation resolution but does
  NOT require a code-owner review, so the merge gate is the owner's judgement
  plus `.github/CODEOWNERS` as a social signal (hardening tracked in #114)".
  The false "CODEOWNERS reviews every change" claim is gone.
- **Follow-ups exist:** #112 (open), #113 (open, WIF event allowlist), #114
  (open, enforce code-owner review).

## Round 2 reproductions

```
$ bash /tmp/opencode/d19/run-check1.sh                      # "RESULT: 17 passed, 0 failed"; EXIT=0
$ grep -n 'target=' .github/workflows/secrets-sync.yml      # :225,:226
$ grep -rn 'pull_request_target:\|workflow_run:\|issue_comment:\|repository_dispatch:' .github/workflows/
.github/workflows/build.yml:32:# … `repository_dispatch: [cv-updated]` …     # prose only
$ grep -n 'gcloud secrets' llm/sprints/2026-09-hub/STATE.md # 3846, 3918 (supersession only)
$ gh api repos/djjay0131/website/issues/112 --jq .state     # "open"
```

## Round 2 related docs / ADR candidates

- Updated: `.github/workflows/secrets-sync.yml` (triggers `:45-52`, guard
  `:90-100`, sync `:116-158`, derive `:193-209`, apply `:221-226`),
  `llm/sprints/2026-09-hub/STATE.md` (§D19), `llm/governance/adr/0022-…§5`.
- Unchanged: `infra/secrets-sync.tf`, `infra/notes-sync.tf`, `infra/wif.tf`,
  `infra/gate.tf`, `infra/versions.tf`.
- ADR candidate (carried from round 1): **C-narrow-sync-identity** — a
  credential-bootstrapping workflow must not hold a value-read capability; split
  container creation (Terraform + secret-scoped grant) from version-write
  (workflow). This is the general form of #112 and belongs in
  `patterns/secrets-management.md` (its least-privilege invariant `:52-59`
  implies it but does not state it).
