# Chief Reviewer: Phase 1 delta review of PR #12

- **Reviewed:** `feat/foundation` at `53654ea`, the delta `8867946..53654ea`: `9a2ca88`, `b5327b1`, `3ec90ed`, `d54204d`, `53654ea`.
- **Base:** `origin/main` at `d32cd36`. CI tested merge ref `4fea02b`, whose parents are `d32cd36` and `53654ea` (GitHub API).
- **Contract:** `llm/sprints/2026-09-hub/contracts/chief-reviewer-phase-1-delta.md`
- **Independence:** I wrote the original review. I authored and certified none of the remediation.
- **Evidence rule:** every status below rests on the file and line at `53654ea`, a CI job result, or a command I ran. The implementers' handoffs and the PR body are cited only as the artifacts under review, never as proof.
- **Access:** read-only.
  - No file writes, no git or gh mutations, no Terraform plan or apply, no cloud reads.
  - Terraform: `fmt -check` and `validate` only. `init` was not needed because the provider cache was already present, and `git status` was clean afterwards.

---

## Part A: Resolution table

| # | Sev. | Status | Evidence at `53654ea` |
|---|---|---|---|
| **F1** | must-fix | **RESOLVED** | See the F1 detail below the table. |
| F2 | should-fix | **RESOLVED** (owner may reverse at Checkpoint 2) | `infra/deploy.tf:53-57` adds `google_project_iam_member.hub_deploy_api_keys_viewer` (`roles/serviceusage.apiKeysViewer`). The grant's comment is at `deploy.tf:18-24`, and API Keys Viewer is gone from the "NOT granted" list (`:30-36`). STATE:368-370 now recommends accepting it. Plan count "18 to add" (handoff:479) matches the configuration: 10 resource blocks, one of them `for_each` over 8 APIs. `terraform validate` is valid. |
| F3 | should-fix | **RESOLVED** | The custom-role path is withdrawn, with the Firebase quote, at `infra/deploy.tf:26-28`, `infra/README.md:24`, STATE C11 (:313-316) and STATE:369-370. The handoff records it as withdrawn (infra handoff:718-719). A grep of `*.md`, `*.tf`, `*.yml` and `*.mjs` finds no remaining recommendation to use a custom role. |
| F4 | should-fix | **RESOLVED** | The invariant is stated at `infra/wif.tf:24-34`: every provider in the pool must map `attribute.repository_id_ref` from `assertion.repository_id + '/' + assertion.ref`, and a separate satellite pool is recommended. It matches the mapping at `wif.tf:63`. STATE C12 (:317-321) carries the invariant and the Phase 2 recommendation. "Can never satisfy" is gone. |
| F5 | should-fix | **RESOLVED** (install path unexercised; see B3) | See the F5 detail below the table. |
| F6 | should-fix | **RESOLVED** | The PR #12 body (read via `gh pr view`) now has: 18 resources, the lockfile, Node 22.23.1, `budget-guard`, SEAM-7, "CI on `53654ea`", a dispositions table for F1–F14, and "Draft until the Chief Reviewer's delta review". Still to do (STATE:156): record this delta review's outcome in the body when marking ready. |
| F7 | should-fix | **RESOLVED** (ratification is the owner's) | STATE:371-374 lists muted `#636a68`, caution `#87620d`, the originals kept for non-text use, and the added status green, with a recommended default. |
| F8 | should-fix | **RESOLVED** | Site script: `site/scripts/check-smoke-routes.mjs` reads `SMOKE_ROUTES` (`site-routes.mjs:20-28`) and exits 1 on a missing route and 2 when there is no output. I ran it read-only: `…/nonexistent-dir` gave rc=2 and `src` gave rc=1 ("7 of 7 smoke routes missing"). Tests: `check-smoke-routes.test.ts`, 7 tests, passing in CI. Workflow: `build.yml:192-196` and `:261-265`, after the build and before the upload. CI: 7 of 7 OK in both build jobs on fetched data (Part C). The SEAM-7 text overstates "one source" (B4). |
| F9 | note | **RESOLVED** | The issue #10 body, Definition of Done checklist, has a new sub-item: "Memory-bank sync after Phase 1 (review finding F9): merge PR #11 first … then sync `activeContext.md` and `progress.md`…". |
| F10 | note | **RESOLVED** | `build.yml:376-379` sets `node-version: 22.23.1`, and `check-latest` is gone (grep). 22.23.1 exists: nodejs.org `dist/index.json` lists it (2026-06-22, npm 10.9.8), and `actions/node-versions` has `node-22.23.1-linux-x64.tar.gz`. The build jobs keep `22` (`:154`, `:228`); they hold no credential, as the comment at `:374-375` says. |
| F11 | note | **RESOLVED** (verification by design at the first post-merge run) | The bump table and verification step are at infra handoff:384-401, with step 9 at handoff:565-569; the PR body dispositions row covers it too. **Correction to my original F11:** `upload-pages-artifact` v5.0.0 does run on pull requests. Run 34933057665, job `build`: "Artifact github-pages successfully finalized. Artifact ID 10382153555". Only `deploy-pages` v5.0.1 is unexercised before merge. |
| F12 | note | **RESOLVED** (the site type itself is still unverified until apply, but now fails at apply) | The postcondition `self.type == "DEFAULT_SITE"` is at `infra/firebase.tf:34-42`. `terraform validate` passes, which confirms `type` is in the google-beta 8.2.0 schema. The site import line is gone: handoff:495-496 says "The Hosting site needs no import", with a postcondition recovery at :497-503. The only remaining `import google_firebase_hosting_site` text is in the remediation narrative (handoff:1093). |
| F13 | note | **RESOLVED** | STATE:375-377: "confirm you are **Billing Account Administrator** … needed to create the budget (Billing Account User is not enough)". |
| F14 | note | **RESOLVED** | `infra-phase-1.md:3`: "Status: Review (delivered and reconciled in 9f0718a, 3ec90ed; PR #12 awaiting owner review)". `site-phase-1.md:3`: "… 0ce2865, 8867946, b5327b1 …". Both are accurate for a PR awaiting owner review. |

**F1 detail.** The blocker required (1) corrected texts and (2) a rewritten step 10. Item (3) was recommended.
- **(1) Texts corrected.**
  - `infra/budget.tf:15-29` now reads "ONLY while this resource block is in the configuration", quoting Terraform.
  - `infra/README.md:104-120` gives the same limit and "No rollback removes `budget.tf` or the budget".
  - Infra handoff:288-305 corrects the claim and names the refuted text.
- **(2) Step 10 rewritten** (handoff:570-616).
  - "The budget is never removed"; there is no `terraform destroy` without `-target`.
  - Targeted destroy goes through a saved plan that "must not mention `google_billing_budget.hub`".
  - Allowed and never-target lists are given, with `google_project_service.phase1` correctly never targeted because the budget depends on it.
  - A revert must leave `budget.tf` unchanged, checked with `git diff origin/main -- infra/budget.tf`.
- **(3) CI presence check and apply provenance.**
  - The `budget-guard` job is at `build.yml:91-131`. CI job 104265119802 succeeded: "OK: infra/budget.tf declares google_billing_budget.hub with prevent_destroy = true."
  - My own stdin mutation tests of the job's perl program (no file written):

    | Mutation | Exit code |
    |---|---|
    | unchanged file | 0 |
    | `prevent_destroy = false` | 3 |
    | guard `#`-commented | 3 |
    | guard line deleted | 3 |
    | resource block deleted | 2 |
    | resource renamed | 2 |
    | block in `/* */` | 2 |
    | guard moved to another resource | 3 |
    | guard only in a comment | 3 |
    | empty input | 2 |

  - `count = 0` passes the check (rc=0) but is not a way around the guard: Terraform v1.14.0 runs `checkPreventDestroy` on orphaned instances (`internal/terraform/node_resource_plan_orphan.go:197`).
  - Apply provenance is at handoff:465-473 and README:121-129.
  - Two residual gaps in these new controls are notes, not blockers (B1, B2).
  - `budget-guard` is not yet a required check: `main` requires only `governance-checks` (API `required_status_checks`). That decision is correctly with the owner (STATE:384-386).

**F5 detail.**
- **Package pin:** `infra/deploy-tools/package.json` pins `"firebase-tools": "15.30.1"`.
- **Lockfile** (read with `node`, no install): lockfileVersion 3 and 673 packages. Every `resolved` URL is on `registry.npmjs.org`, and none lacks `integrity`. `node_modules/firebase-tools` is 15.30.1. The lockfile root matches `package.json`.
- **Engines:** every `engines.node` in the lockfile allows 22.23.1, and every `engines.npm` allows 10.9.8 (checked with `semver.satisfies`).
- **Install scripts:** `protobufjs` (required), `re2` (optional) and `fsevents` (optional, darwin only).
- **Workflow:**
  - `build.yml:384-385` runs `npm ci --prefix infra/deploy-tools`, before auth (`:391`).
  - `:403` invokes `infra/deploy-tools/node_modules/.bin/firebase`.
  - `npx` and `FIREBASE_TOOLS_VERSION` are gone (grep).
- **Repository hygiene:** `infra/.gitignore:28` ignores `deploy-tools/node_modules/`, and `git ls-files | grep -c node_modules` = 0.

---

## Part B: Regressions and new findings

### B.1 Findings (most severe first)

| # | Severity | Artifact and location | Defect | Failure scenario | Owner | Fix |
|---|---|---|---|---|---|---|
| B1 | note | `.github/workflows/build.yml:99` (`budget-guard` runs only on `pull_request` or `push`); `:521-528` (`notify-recovery` needs `budget-guard`; condition is `!cancelled()`, smoke-test success, no failure) | `budget-guard` joined both notification jobs' `needs` but runs on only two of the five triggers. On `repository_dispatch`, `workflow_dispatch` and a `schedule` run with `changed=true`, its result is `skipped`. That is not `failure`, so `notify-recovery` closes the `ci-failure` issue without the failing check having run again. | A PR that deletes `budget.tf` merges; `budget-guard` is not required, and enforce_admins is off. The push run fails `budget-guard`, and `notify-failure` opens the tracking issue. The next `cv-updated` dispatch builds, deploys and smoke-tests green, and `notify-recovery` closes the issue with "Recovered" while `main` still lacks the budget. The commit's red check stays, and provenance requires green, so an apply from that commit is still refused. Only the notification is wrong. | infra | Remove the `if:` at `build.yml:99` so `budget-guard` runs on every trigger. It is a 6-second, `contents: read` job. A still-missing budget then keeps the issue open and adds a "Still failing" comment. |
| B2 | note | Apply provenance: `infra/README.md:123`, infra handoff:467 (`git status --porcelain` prints nothing); `infra/.gitignore:19-22` (`override.tf`, `*_override.tf` ignored); `build.yml:110` (`budget-guard` reads only `infra/budget.tf`) | A "clean" `git status --porcelain` does not show git-ignored files, and Terraform override files merge into resource blocks. Terraform docs (`language/files/override.mdx`:105-106): "the contents of any `lifecycle` nested block are merged on an argument-by-argument basis." An override can set `prevent_destroy = false` while `budget.tf` is unchanged and `budget-guard` is green. A force-added, committed override is not caught by `budget-guard` either. | A leftover local `infra/budget_override.tf`, from debugging or an earlier experiment, disables the guard. The provenance check passes: clean status, SHA matches, `budget-guard` green. A `terraform destroy`, or an edit that forces replacement, then proceeds against the budget. The step 10 rules ("never destroy without `-target`"; read the plan) are the only remaining barrier. | infra | (1) Add to the provenance rule that `git status --porcelain --ignored infra` lists no `override.tf*` or `*_override.tf*`. Or `ls infra/override.tf* infra/*_override.tf* 2>/dev/null` must print nothing. (2) Make `budget-guard` fail when any tracked file under `infra/` matches those patterns. |
| B3 | note | `build.yml:384-385` (`npm ci --prefix infra/deploy-tools`), `:403` (`.bin/firebase`) | The locked install path replaced `npx`, but no CI job exercises it. `firebase-deploy` is skipped on pull requests (run 34933057665) and dormant until the variables are set. The lockfile was generated with npm 11.16.0 (infra handoff:1013-1014); the deploy job runs npm 10.9.8 (bundled with Node 22.23.1). My static checks pass (F5), but `npm ci` itself has not run in CI. | At Checkpoint 2, the first Firebase deploy fails in "Install firebase-tools from the lockfile": for example the lock is rejected as out of sync, or `.bin/firebase` is missing. That happens before auth, so no credential is exposed and Pages is unaffected. "cusati.us serves the site" then waits on another PR. | infra | Add a credential-free pull-request step, for example in a small job with `contents: read` on Node 22.23.1: `npm ci --prefix infra/deploy-tools --no-audit --no-fund`, then `infra/deploy-tools/node_modules/.bin/firebase --version`. Or accept, and name it explicitly in Checkpoint 2 step 9. |
| B4 | note | `llm/sprints/2026-09-hub/contracts/phase-1-seams.md:93-94` ("`site/scripts/site-routes.mjs` exports the smoke-test routes; it is their one source"); `build.yml:305`, `:432` (inline route lists); `site/scripts/site-routes.mjs:18-19` ("Keep in step with that workflow") | The seam claims one source, but three copies exist. The copies match today (read at `53654ea`). | Someone adds a route to one or both smoke-test loops in `build.yml` only. SEAM-7 never checks that route, so the F8 failure mode returns for it: a pre-deploy pass, then a post-deploy-only failure. | Lead Architect (seam text); infra (C13) | Reword SEAM-7 to "the list the check reads; `build.yml`'s smoke loops keep copies until C13", or have both loops read `SMOKE_ROUTES` (C13). |

Nothing else in the delta broke:
- actionlint 1.7.12 reports 0 errors on `build.yml`.
- `terraform fmt -check -recursive` exits 0.
- `terraform validate` reports "Success! The configuration is valid."
- `ci.yml` is unchanged (`git diff --quiet 8867946..HEAD -- .github/workflows/ci.yml`).
- Each commit's files match its stated scope (`git show --stat`).
- The redundant step-level `working-directory: site` (`build.yml:195`, `:264`) resolves correctly: the CI log shows `> website@0.0.1 check:smoke-routes` reading `dist-public`.

### B.2 Workflow behaviour on every declared trigger (`build.yml:3-12`)

The "Firebase" column covers `build-firebase`, `firebase-deploy` and `firebase-smoke-test`. For these jobs "var-gated" means they are skipped unless `vars.GCP_PROJECT_ID` is set, and the repository has no variables today. The one exception is `build-firebase`, which also runs on every pull request.

| Trigger | `check` | `budget-guard` | `build` (+ SEAM-7) | `deploy`, `smoke-test` | Firebase | `notify-failure` (`:466`) | `notify-recovery` (`:524-528`) |
|---|---|---|---|---|---|---|---|
| `push` (main) | runs, `changed=true` | **runs** | runs | runs | var-gated | on any failure, including `budget-guard` | closes the issue if smoke-test succeeded and no job failed |
| `pull_request` (to main) | runs | **runs** | runs, uploads the Pages artifact | skipped | `build-firebase` runs without upload; deploy jobs skipped | skipped (event) | skipped (event) |
| `repository_dispatch` (`cv-updated`) | runs, `changed=true` | **skipped** (`:99`) | runs | runs | var-gated | on failure; a skipped `budget-guard` is not a failure | runs on smoke success; a skipped `budget-guard` does not block it (**B1**) |
| `schedule`, fingerprint unchanged | runs, `changed=false` | skipped | skipped | skipped (the `needs` chain) | skipped | not triggered (no failure); triggered if `check` itself fails | not triggered (smoke skipped). Unchanged from before |
| `schedule`, fingerprint changed | as dispatch | skipped | runs | runs | var-gated | as dispatch | as dispatch (**B1**) |
| `workflow_dispatch` | as dispatch | skipped | runs | runs | var-gated | as dispatch | as dispatch (**B1**) |

Pull request, verified on run 34933057665: `budget-guard`, `check`, `build` and `build-firebase` succeeded, and the six other jobs were skipped.

- **Failure path after SEAM-7.** Before, a `cv` release that dropped a smoke route deployed, then failed `smoke-test` once. The deployed fingerprint advanced, so later polls skipped.
  - Now `build` fails before upload, `deploy` is skipped, and Pages keeps its last good deployment. `notify-failure` opens the issue.
  - Because the deployed fingerprint does not advance, every hourly poll rebuilds, fails, and adds a "Still failing" comment until a fixed release or site change lands.
  - This is the intended trade-off of F8, and it is the pre-existing one-issue-per-outage pattern. It is not a defect, but expect hourly comment emails during such an outage.
- **Recovery path.** A later run with a successful `smoke-test` and no failed job closes the issue. That is unchanged, except for B1.
- **Skipped `budget-guard`.** Both notification jobs use status functions: `failure()`, and `!cancelled()` with an explicit result check. So a skipped `budget-guard` neither suppresses them nor triggers them.

---

## Part C: CI evidence on `53654ea`

| Evidence | Result |
|---|---|
| PR head and runs | `gh pr view 12`: `headRefOid` `53654ea…`, draft, open. Run 34933057567 (`ci`) and run 34933057665 (`build-and-deploy`): `headSha` `53654eaa38dc…`, event `pull_request`, conclusion `success`. The checkout fetched merge ref `4fea02b` (parents `d32cd36`, `53654ea`). |
| `ci` / `governance-checks` | success (job 104265118744) |
| **`budget-guard`** (job 104265119802) | success, 6 s. Log: `OK: infra/budget.tf declares google_billing_budget.hub with prevent_destroy = true.` |
| `check` (job 104265119929) | success |
| **`build`** (job 104265140987), GitHub Pages variant | `Fetching CV data from djjay0131/cv@latest` → `CV data fetched.` The fingerprint lists `academic.pdf`, `anthropic-fellow.pdf`, `cv-data.zip`, `research-professional.pdf`, `sde-long.pdf` (all `2026-07-27T00:30:06Z`). `npm test`: 7 files passed, **54 passed, 1 skipped (55)**, including `check-smoke-routes.test.ts` (7 tests). Build: 33 pages. **`check:smoke-routes`:** OK for `/`, `/resumes/`, `/cv/academic`, `/cv/research-professional`, `/papers/`, `/pdfs/academic.pdf`, `/projects/`, then "all 7 smoke routes present in dist-public". The uploaded artifact lists `./pdfs/academic.pdf` plus the other three fetched PDFs, so the file route passed on real fetched data, not a stub. |
| **`build-firebase`** (job 104265140981), Firebase variant | The same fetch and fingerprint. 54 passed, 1 skipped (55). 33 pages. **`check:smoke-routes`:** the same 7 OK lines, "all 7 smoke routes present in dist-public". No upload (pull request). |
| Skipped as designed | `deploy`, `smoke-test`, `firebase-deploy`, `firebase-smoke-test`, `notify-failure`, `notify-recovery` |
| Local, read-only | Terraform 1.14.0: `fmt -check -recursive` rc=0; `validate` "Success! The configuration is valid." actionlint 1.7.12: rc=0. `budget-guard` mutation matrix and Terraform source check (Part A, F1 detail). Lockfile and engine checks (Part A, F5 detail). Smoke-route script failure paths rc=2 and rc=1. `git status` clean. |

---

## Part D: Verdict

**Comment.**
- The must-fix (F1) is resolved on evidence, and so are all seven should-fix findings (F2–F8) and all six notes (F9–F14).
- The remediation introduced no blocking regression. B1–B4 are notes against the new controls: a notification that closes early, a provenance gap for override files, a lockfile install path CI never runs, and seam wording. The infra ones (B1–B3) are small workflow or README edits; B4 is a one-line seam rewording.

**PR #12 may be marked ready for Checkpoint 2.** Conditions and reminders:
1. Before marking ready, the PR body records this delta review's outcome and drops its "Draft until the delta review" line (STATE:156, F6).
2. B1–B4 may be fixed before merge or tracked as follow-ups; none changes what `terraform apply` creates. If B2 is not fixed before the first apply, the owner should run `ls infra/*override.tf* infra/override.tf*` and confirm it prints nothing, as part of the step 5 provenance check.
3. Still to verify at Checkpoint 2 (unchanged from Phase 1):
   - the first Firebase deploy: the permission set, the `DEFAULT_SITE` postcondition, and now the locked install (B3);
   - `deploy-pages` v5.0.1 on the first post-merge run (F11);
   - the owner's decisions in STATE §Decisions for the owner at Checkpoint 2, including making `budget-guard` a required status check.
4. This review does not replace the owner's L2 review and merge decision.
