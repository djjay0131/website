# Handoff: Infrastructure Implementation Engineer — Phase 1

Status: Draft
Last updated: 2026-09-15
Owner: Infrastructure Implementation Engineer (Specialist 2)

Contract: `llm/sprints/2026-09-hub/contracts/infra-phase-1.md`. Seams:
`llm/sprints/2026-09-hub/contracts/phase-1-seams.md`. Issue #10, branch
`feat/foundation`. No git or gh mutation was made; no cloud resource was created,
changed or read; no credential exists.

## Summary

- **D1 — `infra/`**: a Terraform root module (google and google-beta `~> 8.2`,
  Terraform `>= 1.14.0, < 2.0.0`, lock file committed with hashes for linux_amd64,
  windows_amd64, darwin_amd64 and darwin_arm64). It reads the owner-created
  project, enables 8 APIs, and creates:
  - a WIF pool and GitHub provider bound to this repository's immutable IDs and
    name;
  - a keyless `hub-deploy` service account, usable only from `refs/heads/main`,
    with `roles/firebasehosting.admin` and `roles/serviceusage.apiKeysViewer`;
  - a $5 project budget. `prevent_destroy` guards it only while its block is in
    the configuration, so a CI presence check and an apply-provenance rule back
    it up;
  - Firebase on the project, the default Hosting site (a postcondition requires
    type `DEFAULT_SITE`), and `cusati.us` bound to it.

  Outputs: the SEAM-4 values, the default Hosting URL, and the custom domain's
  DNS records and state. `infra/deploy-tools/` locks firebase-tools 15.30.1.
- **D2 — `.github/workflows/build.yml`**: all triggers, the concurrency model, the
  Pages deploy and smoke test, and the failure and recovery jobs kept. It builds
  and tests from `site/`, fetches data through `site/scripts/fetch-data.sh`, and
  writes `site/public/build-info.json`. It builds the Pages and the Firebase
  variants from the same commit in two jobs, `build` and `build-firebase`. The
  Pages deploy needs only `build`, so no Firebase step can fail or skip it (SEAM-4).
  `build-firebase` runs on pull requests (build and test, no upload) and on the
  deploy path only once `vars.GCP_PROJECT_ID` is set. Both build jobs run the
  SEAM-7 `npm run check:smoke-routes` before any upload. New `firebase-deploy` (WIF;
  Node 22.23.1 exactly; firebase-tools 15.30.1 from the `infra/deploy-tools`
  lockfile; `--project`) and `firebase-smoke-test` jobs run only off pull requests
  and only when `vars.GCP_PROJECT_ID` is non-empty. A new `budget-guard` job, on
  every pull request and push to `main`, fails when `infra/budget.tf` loses the
  budget or its `prevent_destroy`. The fingerprint check reads
  `vars.SITE_URL` or else the Pages URL. `permissions: {}` at the top with a
  per-job grant, and every action is pinned by commit SHA.
- **D3 — `infra/README.md`**; **D4 — this handoff**.
- Validation: all green (below). `terraform plan` / `apply` were not run, by contract.

## Files changed

- `infra/versions.tf`, `infra/providers.tf`, `infra/variables.tf`, `infra/main.tf`,
  `infra/wif.tf`, `infra/deploy.tf`, `infra/budget.tf`, `infra/firebase.tf`,
  `infra/outputs.tf` (new)
- `infra/.terraform.lock.hcl`, `infra/.gitignore`, `infra/terraform.tfvars.example`,
  `infra/README.md` (new)
- `.github/workflows/build.yml` (modified)
- `llm/sprints/2026-09-hub/handoffs/infra-phase-1.md` (this file)
- Remediation of the Chief Reviewer's findings: `infra/budget.tf`, `infra/deploy.tf`,
  `infra/wif.tf`, `infra/firebase.tf`, `infra/.gitignore`, `infra/README.md`,
  `.github/workflows/build.yml` (modified); `infra/deploy-tools/package.json`,
  `infra/deploy-tools/package-lock.json` (new). See §Remediation.

`infra/.terraform/` exists locally from `terraform init` and is git-ignored, as is
`infra/deploy-tools/node_modules/`.

## Validation (verbatim, original submission)

The remediation re-run is in §Remediation.

Terraform used: the Windows executable through WSL interop (Terraform v1.14.0 on
windows_amd64); interop worked, so no Linux download was needed. Re-run from
`infra/` after the verifier fix (the fix touched no Terraform file; the first run
had started from a fresh `rm -rf .terraform` and installed both providers v8.2.0,
signed by HashiCorp):

```text
$ terraform fmt -check -recursive
exit=0
$ terraform init -backend=false
Initializing provider plugins...
- Reusing previous version of hashicorp/google-beta from the dependency lock file
- Reusing previous version of hashicorp/google from the dependency lock file
- Using previously-installed hashicorp/google-beta v8.2.0
- Using previously-installed hashicorp/google v8.2.0

Terraform has been successfully initialized!
...
exit=0
$ terraform validate
Success! The configuration is valid.

exit=0
```

The first `validate` found three errors, now fixed: `all_updates_rule` needs
`monitoring_notification_channels` or `pubsub_topic` (reported twice), and
`deletion_policy` is not an argument of `google_firebase_project` in google-beta
8.2.0.

actionlint (container `rhysd/actionlint:latest`, version 1.7.12), after the
verifier fix:

```text
verbose: Linting .github/workflows/build.yml
verbose: Found 0 parse errors in 0 ms for .github/workflows/build.yml
verbose: Found total 0 errors in 74 ms for .github/workflows/build.yml
exit=0
```

YAML parse: `js-yaml load OK; jobs: check, build, build-firebase, deploy,
smoke-test, firebase-deploy, firebase-smoke-test, notify-failure, notify-recovery ;
top-level permissions {}`, and Python `yaml.safe_load OK` with `deploy needs build`
and `firebase-deploy needs build-firebase`. The `build` job's step list is the
same sequence as `HEAD`'s (checkout, Node, `npm ci`, fetch, tests, build, Pages
upload), plus the SEAM-2 script call and the build-info step, and has no
Firebase step.

Secret scan of every file above for private keys, service-account JSON,
`credentials_json`, email addresses, billing-account-shaped IDs and machine
paths: no hits.

## What `terraform apply` creates

Expected `Plan: 18 to add, 0 to change, 0 to destroy.`

| # | Address | What |
|---|---|---|
| 1–8 | `google_project_service.phase1["…"]` | APIs (see below) |
| 9 | `google_iam_workload_identity_pool.github` | Pool `github-actions` |
| 10 | `google_iam_workload_identity_pool_provider.website` | GitHub OIDC provider `website` |
| 11 | `google_service_account.hub_deploy` | `hub-deploy@<project>.iam.gserviceaccount.com` |
| 12 | `google_project_iam_member.hub_deploy_hosting_admin` | `roles/firebasehosting.admin` to `hub-deploy` |
| 13 | `google_project_iam_member.hub_deploy_api_keys_viewer` | `roles/serviceusage.apiKeysViewer` to `hub-deploy` |
| 14 | `google_service_account_iam_member.hub_deploy_wif_main` | `roles/iam.workloadIdentityUser` on `hub-deploy` for `…/attribute.repository_id_ref/1212933399/refs/heads/main` |
| 15 | `google_billing_budget.hub` | $5/month, this project only, thresholds 50/90/100% actual and 100% forecast |
| 16 | `google_firebase_project.hub` | Firebase added to the project |
| 17 | `google_firebase_hosting_site.default` | Default site, id = project id; postcondition: type `DEFAULT_SITE` |
| 18 | `google_firebase_hosting_custom_domain.primary` | `cusati.us` on that site |

Read, not created: `data.google_project.hub`.

### APIs, each justified

| API | Why Phase 1 needs it |
|---|---|
| `cloudresourcemanager.googleapis.com` | `data.google_project`, project IAM bindings, and the `testIamPermissions` preflight firebase-tools runs before every deploy |
| `serviceusage.googleapis.com` | `google_project_service` itself |
| `iam.googleapis.com` | WIF pool and provider, service account |
| `sts.googleapis.com` | Exchanges GitHub's OIDC token for a federated token |
| `iamcredentials.googleapis.com` | The federated identity impersonates `hub-deploy` (generateAccessToken) |
| `firebase.googleapis.com` | `google_firebase_project`; firebase-tools' `projects.get` |
| `firebasehosting.googleapis.com` | Site, custom domain, and every deploy |
| `billingbudgets.googleapis.com` | `google_billing_budget`, with this project as the quota project |

## Design decisions and their sources

### WIF attribute condition

```text
assertion.repository_id == '1212933399'
&& assertion.repository_owner_id == '5666389'
&& assertion.repository == 'djjay0131/website'
&& assertion.event_name != 'pull_request_target'
```

- Google, "Configure Workload Identity Federation with deployment pipelines"
  (GitHub Actions section), says a condition is required and that "Using 'name'
  fields like repository and repository_owner increases the chances of
  cybersquatting and typosquatting attacks … use the numeric `*_id` fields
  instead, which are unique and can't be reused." google-github-actions/auth's
  README: "Always add an Attribute Condition to restrict entry into the Workload
  Identity Pool."
- GitHub, "OpenID Connect reference": `repository_id` and `repository_owner_id`
  are claims. Repositories created after 2026-07-15 get immutable `sub` claims;
  this one predates that, so the condition matches the ID claims directly and
  does not rely on `sub`.
- The IDs came from `GET /repos/djjay0131/website` (`.id`, `.owner.id`). They are
  public, and they are variables so a fork or re-created repository can be pointed
  at without a code change.
- The name is also matched, so a renamed or transferred repository stops
  authenticating until the module is reviewed again.
- `pull_request_target` is refused because it runs with the base ref
  (`refs/heads/main`) while it handles pull-request input.

### Deploy binding: only `refs/heads/main`

Mapping `attribute.repository_id_ref = assertion.repository_id + '/' + assertion.ref`.
The binding member is
`principalSet://iam.googleapis.com/<pool name>/attribute.repository_id_ref/1212933399/refs/heads/main`.

- Pull-request runs carry `refs/pull/<n>/merge`, and branch runs and
  `workflow_dispatch` on other branches carry their own ref, so none of them can
  impersonate the account.
- The repository ID is part of the value to keep other repositories off this
  binding. That holds **only while every provider in the `github-actions` pool
  maps `attribute.repository_id_ref` from `assertion.repository_id + '/' + assertion.ref`**.
  The `principalSet` is scoped to the pool, and each provider defines its own
  mapping. A provider added to the pool with a different mapping could satisfy
  this binding and deploy the hub. Terraform does not enforce the invariant;
  `infra/wif.tf` states it.
- Recommended for Phase 2: a separate pool for satellites, so the pool is the
  trust boundary and the invariant is structural. Otherwise every provider added
  to this pool must carry this exact mapping, checked in review.
- The pool's description no longer announces satellites ("GitHub Actions OIDC
  identities for the research hub website."), so it does not presume a shared
  pool.

### Deploy identity roles (least privilege)

Two roles are granted: `roles/firebasehosting.admin` and
`roles/serviceusage.apiKeysViewer`.

**Hosting Admin.** According to the `iam-dataset`
role export it contains `firebase.clients.get/list`, `firebase.projects.get`,
`firebasehosting.sites.{create,delete,get,list,update}` and
`resourcemanager.projects.{get,list}`. Firebase's "Firebase predefined roles" page
documents it for Hosting deploys. Evidence from the published firebase-tools
15.30.1 package:

- `lib/requirePermissions.js`: `BASE_PERMISSIONS = ["firebase.projects.get"]` is
  checked before every deploy.
- `lib/deploy/index.js`: `TARGET_PERMISSIONS.hosting = ["firebasehosting.sites.update"]`.
- `lib/getDefaultHostingSite.js`: Firebase Management `projects.get`, with a
  fallback to `listSites` (`firebasehosting.sites.list`).

**API Keys Viewer** (review F2). Firebase: "To deploy via the Firebase CLI, a
project member must *also* be assigned the API Keys Viewer role
(`roles/serviceusage.apiKeysViewer`)"
(<https://firebase.google.com/docs/projects/iam/roles-predefined-product>).
- It is granted so the first deploy follows the documented path. The trace of
  firebase-tools 15.30.1 (the API Keys client imported only by
  `lib/crashlytics/onboarding.js`) is not grounds to depart from the docs: a later
  firebase-tools version could reach that client on the hosting path.
- It is read-only, and Phase 1 creates no API keys.
- **The owner may reverse this at Checkpoint 2.** If reversed, record it in C11 as
  a deliberate departure from Firebase's docs, with the expected failure: a
  permission error naming `apikeys.*`.

**Narrowest supported grant** (review F3). Hosting Admin plus API Keys Viewer is
the narrowest supported grant. There is no tighter custom role: "Custom roles
cannot currently be used for controlling access to Firebase Hosting resources"
(<https://firebase.google.com/docs/projects/iam/permissions>). The custom-role
tightening this handoff once proposed is withdrawn.

Not granted, with reasons:

- `roles/run.viewer`: only needed for rewrites to Cloud Run; there are none (K2).
- `roles/firebaseauth.admin`: only needed for preview channels; none are used.
- `roles/serviceusage.serviceUsageConsumer`. It is needed only when requests name
  a quota project. google-github-actions/auth v3.0.0 exports no
  `GOOGLE_CLOUD_QUOTA_PROJECT` (its `src/main.ts` exports
  `GOOGLE_APPLICATION_CREDENTIALS` and five project variables). firebase-tools
  sets `x-goog-user-project` only from that variable (`lib/apiv2.js`).

### firebase-tools accepts the WIF credentials (primary sources)

- google-github-actions/auth v3.0.0, with `workload_identity_provider` and
  `service_account` and `create_credentials_file` left at its default `true`,
  writes an `external_account` credentials file that impersonates the service
  account. It exports `GOOGLE_APPLICATION_CREDENTIALS` (`src/main.ts`).
- firebase-tools 15.30.1, `src/requireAuth.ts`: with no `--token`,
  `FIREBASE_TOKEN` or signed-in user, `requireAuth` calls `autoAuth`, which builds
  `new GoogleAuth({ scopes, projectId })` from google-auth-library and calls
  `getAccessToken()`. That is Application Default Credentials, which reads
  `GOOGLE_APPLICATION_CREDENTIALS`, `external_account` files included.
- The auth README says direct WIF (no service account) "is not supported by
  Firebase Admin SDK". So the workflow uses WIF **through a service account**:
  the token firebase-tools receives is an ordinary short-lived service-account
  OAuth token. No access token is passed on the command line, and no key exists.
- In-the-field confirmation: firebase/firebase-tools#3926 (2022, WIF with
  `service_account` working) and #10716 (2026-06). #10716 shows this exact setup,
  `auth` + `create_credentials_file` + `GOOGLE_APPLICATION_CREDENTIALS` with
  `external_account`, in production use. Its regression was traced to Node
  22.23.0 / 24.17.0 (nodejs/node#63989), fixed in 22.23.1, so the deploy job pins
  Node to exactly `22.23.1` (review F10).

### Budget recipients and the guard

- No email address is committed.
- `disable_default_iam_recipients = false`: alerts go to "Billing Account
  Administrators and Billing Account Users on the target Cloud Billing account"
  (Cloud Billing, "Create, edit, or delete budgets and budget alerts"). That
  includes the owner of the personal billing account.
- `enable_project_level_recipients = true`: "users with Owner role on a cloud
  project" (google_billing_budget docs).
- `monitoring_notification_channels = []` satisfies the provider's
  one-of requirement, following the docs' "Notify Project Recipient" example.
- `lifecycle { prevent_destroy = true }` fails a plan that would destroy or
  replace the budget, including `terraform destroy`, before any API call. It does
  so **only while the `google_billing_budget.hub` block is in the configuration.**
  Terraform: "This rule doesn't prevent Terraform from destroying a resource if
  you remove its configuration"
  (<https://developer.hashicorp.com/terraform/language/meta-arguments/lifecycle>).
  Deleting the block, or `infra/budget.tf`, destroys the budget in one apply.
  (This corrects an earlier claim, refuted in review F1, that removal needs a
  commit deleting the guard first.)
- Two controls cover that gap:
  - **CI presence check.** The `budget-guard` job in `build.yml`, on every pull
    request and push to `main`, fails when `infra/budget.tf` is missing, lacks
    `resource "google_billing_budget" "hub"`, or lacks `prevent_destroy = true`
    in that block's `lifecycle`. It strips comments and tolerates whitespace, and
    is not gated on `vars.GCP_PROJECT_ID`.
  - **Apply provenance.** Apply only from a clean checkout of the reviewed PR
    head or of `main`, and record the applied commit SHA (manual step 5).
- No rollback removes `budget.tf` or the budget (manual step 10).
- `prevent_destroy` is still the right first guard: it is core Terraform, applies
  to this resource, and fails at plan time. A budget alerts and does not cap
  spend (same Cloud Billing page).
- The amount is a local constant (`5`), not a variable, so changing it is a code
  review, not a tfvars edit.

### Workflow structure

- `build` builds and tests only the Pages variant
  (`SITE_URL=https://djjay0131.github.io SITE_BASE=/website/`) and uploads the
  Pages artifact. `deploy` (Pages) needs only `build`, so the Pages path has
  exactly its old failure points (SEAM-4).
- `build-firebase` (added after verifier finding 1): its own checkout, `npm ci`,
  `fetch-data.sh` and build-info step, then `npm test` and `npm run build` with the
  SEAM-1 defaults, from the same commit (SEAM-5). Job condition:
  `needs.check.outputs.changed == 'true' && (github.event_name == 'pull_request' || vars.GCP_PROJECT_ID != '')`.
  So pull requests build and test both variants (D2), and an unconfigured push,
  dispatch or schedule runs exactly the jobs it ran before. Its
  `Upload Firebase Hosting artifact` step is also gated
  (`github.event_name != 'pull_request' && vars.GCP_PROJECT_ID != ''`), so a pull
  request stores no artifact. Once configured, a Firebase build failure
  fails only `build-firebase` and `firebase-deploy`, and it opens the tracking
  issue through `notify-failure`, while Pages still deploys.
- Choice recorded for the Lead Architect: the Firebase build is **not** run on
  unconfigured pushes to `main`. To validate it on every commit instead, drop
  `|| vars.GCP_PROJECT_ID != ''` from the job condition's second clause and make it
  run whenever `changed == 'true'`. The upload stays gated either way. The cost of
  that alternative: one more job per non-skipped run, and a Firebase build
  failure would open the tracking issue and hold it open before GCP exists.
- `firebase-deploy` needs only `build-firebase`, so it is independent of the Pages
  build and deploy.
  Its steps: check that the other two variables are set, checkout (for
  `firebase.json`; before auth, which writes its credentials file into the
  workspace), download the artifact to `site/dist-public`, Node `22.23.1`
  exactly, `npm ci --prefix infra/deploy-tools --no-audit --no-fund` (before
  auth, so no Google credential exists while packages install), auth, then
  `infra/deploy-tools/node_modules/.bin/firebase deploy --only hosting --project … --non-interactive --message "<sha> (run <id>)"`.
  firebase-tools 15.30.1 and its whole tree come from the committed
  `infra/deploy-tools/package-lock.json`; a bump is a reviewed lockfile change.
- `build` and `build-firebase` each run `npm run check:smoke-routes` from `site/`
  after `npm run build` and before any upload (SEAM-7). A `cv` release that drops
  a smoke route fails the build, and so never reaches deploy. The build jobs keep
  `node-version: 22`; only the deploy job, which holds credentials, is pinned
  exactly.
- `budget-guard` runs on `pull_request` and `push` events (pushes are `main`
  only), checks out the repository, and runs the budget presence check (see
  §Budget recipients and the guard). It is not gated on `vars.GCP_PROJECT_ID`,
  deploys nothing, and no deploy job needs it, so the Pages path is unchanged.
- `firebase-smoke-test` tests `vars.SITE_URL` or else
  `https://<GCP_PROJECT_ID>.web.app`, with the same 7 routes and the same body
  checks as the Pages smoke test.
- `notify-recovery`'s condition changed from `success() && …` to
  `!cancelled() && event != pull_request && needs.smoke-test.result == 'success' && !contains(needs.*.result, 'failure')`.
  The Firebase jobs are skipped until configured, and an implicit `success()`
  over a skipped need would stop the tracking issue from ever closing. No-op
  scheduled runs still do not count: Pages smoke must have succeeded.
- `notify-failure` and `notify-recovery` now set `GH_REPO`. These jobs have no
  checkout, and `gh issue …` without `--repo` works on "a local repository"
  (`gh help environment`). No `ci-failure` issue has ever been created
  (`gh issue list --label ci-failure --state all` returns `[]`), so the old path
  was never exercised.
- `notify-failure` and `notify-recovery` also need `build-firebase` and
  `budget-guard`. Both may be skipped (the first until configured, the second on
  schedule and dispatch runs), which recovery tolerates for the same reason as
  above. A `budget-guard` failure on a push to `main` opens the tracking issue.
- Per-job permissions: `check`, `budget-guard`, `build` and `build-firebase` `contents: read`; `deploy`
  `pages: write` and `id-token: write` (deploy-pages README); `firebase-deploy`
  `contents: read` and `id-token: write`; both smoke tests `{}`; both notify jobs
  `issues: write`.
- Pins, resolved with `gh api repos/<repo>/commits/<tag>`:
  - checkout `fbc6f39…` (v5, same as ci.yml)
  - setup-node `a0853c2…` (v5, same as ci.yml)
  - upload-pages-artifact `fc324d3…` (v5.0.0)
  - deploy-pages `368f825…` (v5.0.1)
  - upload-artifact `043fb46…` (v7.0.1)
  - download-artifact `3e5f45b…` (v8.0.1)
  - google-github-actions/auth `7c6bc77…` (v3.0.0)

### Major action-version bumps on the GitHub Pages path (review F11)

Compared with `origin/main` (`d32cd36`), this PR moves the authoritative Pages
path across major versions. Each is a potential behaviour change:

| Action | Before (`main`) | After | Exercised before merge? |
|---|---|---|---|
| `actions/checkout` | `v4` | `v5` (`fbc6f39…`) | Yes: PR run 34930495246, `build` |
| `actions/setup-node` | `v4` | `v5` (`a0853c2…`) | Yes: same run |
| `actions/upload-pages-artifact` | `v3` | `v5.0.0` (`fc324d3…`) | Yes: "Upload Pages artifact: success" in the same run's `build` job (its step has no pull-request condition) |
| `actions/deploy-pages` | `v4` | `v5.0.1` (`368f825…`) | **No.** `deploy` never runs on a pull request |

**Verification step:** the first post-merge `build-and-deploy` run on `main`
(manual step 9 and the Checkpoint 2 list). `build`, `deploy` and `smoke-test` must
be green, and `https://djjay0131.github.io/website/` must return 200. This does
not depend on GCP being configured. If `deploy` fails, Pages keeps its last
deployment and `notify-failure` opens the tracking issue. Fix forward, or revert
the action pins by PR.

## Open questions answered

### (a) What cannot be Terraformed, and why

| Item | Why | Source |
|---|---|---|
| Creating the GCP project | Terraform could, but the contract and design doc §10 Q2 make it an owner input; it is a data source here so `destroy` can never delete it | Contract D1; §10 Q2 |
| Linking billing / Blaze | Needs the project to exist and the owner's billing-account role; `google_project.billing_account` would require managing the project resource. Blaze is simply "a project with a billing account" | Contract D4; Firebase pricing page |
| Uploading site content (versions, files, releases) | `google_firebase_hosting_version` / `_release` carry Hosting *config* (redirects, rewrites, headers) but no file upload; file hashes and uploads are firebase-tools' job | Provider docs for `google_firebase_hosting_version` and the Cloud Run example in `google_firebase_hosting_custom_domain`; design doc §8 ("Hosting is not fully Terraformable") |
| DNS records at the registrar | cusati.us is not hosted in Cloud DNS; the registrar is outside Google Cloud. Terraform outputs the records instead | `google_firebase_hosting_custom_domain.required_dns_updates` |
| Release storage retention (number of releases kept) | Console setting only ("Release storage settings"); no provider argument found | Firebase, "Manage live & preview channels, releases, and versions" |
| Bootstrap APIs and the ADC quota project | Terraform's own API calls need them before it can run | google_billing_budget docs (user ADC needs `billing_project` + override); Firebase Terraform guide (no-override provider) |
| Firebase Terms of Service acceptance (if never accepted on the account) | A one-time account action in the Firebase console | Assumption; see manual step 6 |

Terraformed, for the record: `google_firebase_project`, `google_firebase_hosting_site`
and `google_firebase_hosting_custom_domain`. All three are beta: each provider
doc says "This resource is in beta, and should be used with the
terraform-provider-google-beta provider".

### (b) Estimated monthly cost of the owner's apply: **$0.00 expected** (plus the domain renewal, paid to the registrar)

| Item | Cost | Source |
|---|---|---|
| WIF pool/provider, STS exchanges, service account, IAM bindings | $0 | Google Cloud IAM pricing: "All use of Identity and Access Management API is free of charge." No separate WIF charge is listed on that page |
| Enabled APIs | $0 (enabling an API is free; usage is billed per product) | — |
| Billing budget | $0 (no charge for budgets is listed) | Cloud Billing budgets doc |
| Firebase project | $0 | Firebase pricing |
| Hosting storage | $0 while under 10 GB; then $0.026/GB. The current build is ~249 KB plus the CV PDFs; old releases count toward storage | Firebase pricing; "Manage … releases" |
| Hosting transfer | $0 while under 360 MB/day (~10.8 GB/month); then $0.15/GB | Firebase pricing |
| Custom domain and SSL | $0 ("Included") | Firebase pricing |
| Cloud Audit Logs for STS | Admin Activity logs are free; Data Access logs are off by default | Assumption, not verified this session |

A personal research site would have to serve roughly 11 GB a month, about 44,000
page-plus-PDF views at 250 KB each, before the first cent. The $5 budget alerts
long before that becomes material.

## Manual steps (in order)

`<project>` is the project id (intended `cusati-hub`); `<billing>` is the billing
account id. Run from a shell with `gcloud` signed in as the owner's **personal**
account (`gcloud auth list` shows it as active).

1. **Create the project.**
   Run: `gcloud projects create <project> --name="Research Hub"`.
   Expected: `Operation "operations/…" finished successfully.`
   Verify with `gcloud projects describe <project> --format="value(lifecycleState,parent)"`:
   it prints `ACTIVE` and an empty parent (a personal account, no organization).
   If the id is taken, choose another; it is only a variable.
2. **Link billing (Blaze).**
   Run `gcloud billing accounts list`, then
   `gcloud billing projects link <project> --billing-account=<billing>`.
   Expected: `billingEnabled: true`. On Firebase, a project with a billing account
   is on Blaze; confirm in step 7.
3. **Enable the bootstrap APIs.**
   Run: `gcloud services enable serviceusage.googleapis.com cloudresourcemanager.googleapis.com --project=<project>`.
   Expected: `Operation "operations/…" finished successfully.` (or nothing, if
   already enabled).
4. **Set the ADC quota project.**
   Run: `gcloud auth application-default login`, then
   `gcloud auth application-default set-quota-project <project>`.
   Expected: `Credentials saved to file: […]` and `Quota project "<project>" was added to ADC …`.
5. **Terraform init / plan / apply.**
   **Apply provenance (review F1).** This step, and every later apply including
   step 10, runs only from a clean checkout of the reviewed PR head or of `main`:
   - `git fetch origin`; then `git status --porcelain` prints nothing;
   - `git rev-parse HEAD` equals the PR's head commit (shown on the PR) or
     `git rev-parse origin/main`;
   - the `budget-guard` check is green on that commit.

   After apply, record the applied commit SHA, the date, and the apply summary
   line in `llm/sprints/2026-09-hub/STATE.md` (Lead Architect).

   `cd infra`; `cp terraform.tfvars.example terraform.tfvars` and set
   `project_id` and `billing_account`. Then:
   - `terraform init`. Expected: `Reusing previous version of hashicorp/google … v8.2.0`,
     then `Terraform has been successfully initialized!`
   - `terraform plan -out=tfplan`. Expected: `Plan: 18 to add, 0 to change, 0 to destroy.`
     Review every resource against the table above.
   - `terraform apply tfplan`. Expected: `Apply complete! Resources: 18 added, 0 changed, 0 destroyed.`
   - Then `terraform plan` again. Expected: `No changes.` (roadmap §12.5
     criterion). If it shows only computed custom-domain state, run
     `terraform apply -refresh-only` and plan again.
   - Back up `terraform.tfstate` privately, outside the repository.

   If apply fails:
   - `SERVICE_DISABLED` / "has not been used in project": the APIs are
     propagating. Wait 2 minutes and run `terraform apply` again.
   - `google_firebase_project` reports that terms of service must be accepted:
     do step 6 first, then apply again.
   - `google_firebase_project` reports "already exists" (Firebase was added in
     the console earlier): run
     `terraform import google_firebase_project.hub projects/<project>`, then plan
     again. The Hosting site needs no import: the provider adopts an existing
     site (it reads it, then updates it).
   - `google_firebase_hosting_site.default` fails its postcondition ("… has type
     USER_SITE, not DEFAULT_SITE"): the site Terraform manages is not the
     project's default site, and a deploy would fail. In the Firebase console,
     under Hosting, find the default site's ID, set `hosting_site_id` to it in
     `terraform.tfvars`, and plan and apply again. The wrong site is abandoned,
     not deleted (`deletion_policy = "ABANDON"`); delete it in the console if
     unwanted. Then set `SITE_URL` per step 8.
6. **Firebase steps Terraform does not do.**
   - Only if step 5 asked: open https://console.firebase.google.com as the owner
     and accept the Firebase terms once.
   - Confirm the plan: Firebase console → project → Usage and billing shows
     **Blaze**.
   - Set release retention: Hosting → Release history → ⋮ →
     **Release storage settings** → keep, for example, 20 releases. Expected:
     older releases are scheduled for deletion, oldest first. This bounds storage
     and keeps enough history for rollback.
7. **DNS records at the registrar for cusati.us.**
   - Run `terraform output custom_domain_dns_records`. If it is empty, run
     `terraform apply -refresh-only` first.
   - At the registrar, add every record listed with `required_action = "ADD"`
     (typically an `A` record for `cusati.us` and a `TXT` ownership record). Delete
     every record listed as `REMOVE`, and any other `A`/`AAAA` records on the apex.
     If the domain has `CAA` records, they must allow the issuer Hosting names.
   - Verify: `dig +short A cusati.us` and `dig +short TXT cusati.us` match the
     output.
   - After propagation (minutes, and up to 24 hours for ownership and the
     certificate), run `terraform apply -refresh-only` and then
     `terraform output custom_domain_state`. Expected: `OWNERSHIP_ACTIVE`,
     `HOST_ACTIVE`, `CERT_ACTIVE`.
8. **Set the GitHub Actions variables** (Settings → Secrets and variables →
   Actions → **Variables**; not secrets). With gh, from the repository:
   - `gh variable set GCP_PROJECT_ID --body "$(terraform -chdir=infra output -raw project_id)"`
   - `gh variable set GCP_WIF_PROVIDER --body "$(terraform -chdir=infra output -raw workload_identity_provider)"`
   - `gh variable set GCP_DEPLOY_SA --body "$(terraform -chdir=infra output -raw deploy_service_account_email)"`

   Expected: `gh variable list` shows all three. The provider value has the form
   `projects/<number>/locations/global/workloadIdentityPools/github-actions/providers/website`.
   **Do not set `SITE_URL` yet.** Set it only after step 7 shows `CERT_ACTIVE`:
   `gh variable set SITE_URL --body "https://cusati.us"`. From then on the smoke test
   and the hourly fingerprint check use cusati.us.

   If `terraform output hosting_default_url` is not `https://<project>.web.app`,
   set `SITE_URL` to it until the domain is active.
9. **First deploy and verification.**
   - Merge the Phase 1 PR, or after it has merged run
     `gh workflow run build-and-deploy --ref main`.
   - Expected in the run: `build`, `deploy`, `smoke-test`, `build-firebase`,
     `firebase-deploy` and `firebase-smoke-test` all green. The `firebase-deploy` log ends with
     `Deploy complete!` and the Hosting URL; each smoke test prints `OK:` for all 7
     routes and both body sizes.
   - Verify by hand:
     - `curl -sI https://<project>.web.app/` returns `HTTP/2 200`.
     - After `SITE_URL` is set, `curl -sI https://cusati.us/` returns `HTTP/2 200`,
       and `curl -svo /dev/null https://cusati.us/ 2>&1 | grep -iE "subject:|issuer:"`
       shows a valid certificate for cusati.us.
     - `curl -s https://cusati.us/build-info.json` shows `built_from_sha` equal to
       the merged commit and `cv_fingerprint` equal to the `check` job's value.
     - `curl -sI https://djjay0131.github.io/website/` still returns `200`.
     - Firebase console → Hosting → Release history shows the release message
       `<sha> (run <id>)`.
   - Also confirm the no-key criterion: `gh secret list` shows no Google
     credential, and
     `gcloud iam service-accounts keys list --iam-account=<GCP_DEPLOY_SA> --managed-by=user`
     lists nothing.
   - `hub-deploy` holds API Keys Viewer, as Firebase documents. If the owner
     removed it at Checkpoint 2 and the deploy then fails on a missing `apikeys.*`
     permission, restore `google_project_iam_member.hub_deploy_api_keys_viewer`
     by PR and apply under the step 5 provenance rule.
   - **Action-version bumps (F11).** The first post-merge `build-and-deploy` run is
     also the verification step for the Pages path's major action bumps
     (§Major action-version bumps). `build`, `deploy` (deploy-pages v5.0.1, never
     run on a pull request) and `smoke-test` must be green. This check applies
     even if GCP is not yet configured.
10. **Rollback.** **The budget is never removed.** No rollback deletes
    `infra/budget.tf`, removes or edits out `google_billing_budget.hub`, or runs
    `terraform destroy` without `-target` (§12.6; review F1). Every rollback
    apply follows the step 5 provenance rule.
    - Bad site content: Firebase console → Hosting → Release history → hover over
      the last good release → ⋮ → **Roll back**. Or, by CLI as the owner, from a
      clean checkout: `npm ci --prefix infra/deploy-tools`, then
      `infra/deploy-tools/node_modules/.bin/firebase hosting:clone <project>:@<VERSION_ID> <project>:live`.
      Then revert the offending commit on `main`.
    - Stop Firebase deploys without touching Pages:
      `gh variable delete GCP_PROJECT_ID`. The Firebase jobs skip and Pages
      continues as before. Also `gh variable delete SITE_URL`, which points the
      fingerprint check back at Pages.
    - Take cusati.us off Firebase: remove the step 7 records at the registrar.
    - Infrastructure: remove named resources with a targeted destroy.
      1. `terraform plan -destroy -target=<address> [-target=<address> …] -out=rollback.tfplan`
      2. Read the plan. It must list only the named resources and their
         dependents, and must not mention `google_billing_budget.hub`. If it
         does, stop and do not apply.
      3. `terraform apply rollback.tfplan`.
      4. Remove the same resource blocks from `infra/` in a reviewed PR that leaves
         `infra/budget.tf` unchanged, with `budget-guard` green. After merge,
         `terraform plan` from `main` shows `No changes.` Until that PR merges, do
         not run a plain `terraform apply`: it would re-create the resources.

      Addresses that may be targeted:
      - `google_service_account_iam_member.hub_deploy_wif_main` (cuts GitHub's
        deploy access; target it first);
      - `google_project_iam_member.hub_deploy_hosting_admin`,
        `google_project_iam_member.hub_deploy_api_keys_viewer`;
      - `google_service_account.hub_deploy` (its IAM members go with it);
      - `google_firebase_hosting_custom_domain.primary` (takes cusati.us off
        Firebase).

      Never target:
      - `google_billing_budget.hub`;
      - `google_project_service.phase1`: the budget depends on it, so the plan
        would include the budget, and the APIs stay enabled by design;
      - the WIF pool and provider: a deleted pool may block re-creation under
        the same ID during Google's soft-delete window (unverified).
    - Infrastructure, reverting a Terraform change: only by a revert PR that leaves
      `infra/budget.tf` unchanged (`git diff origin/main -- infra/budget.tf` prints
      nothing), with `budget-guard` green, applied from `main` after merge. A
      revert that deletes `budget.tf` is not a rollback option. That includes
      reverting all of this PR's `infra/`.
    - `terraform destroy` without `-target` is never run. `prevent_destroy` would
      stop it at the budget, but only while `budget.tf` is present.
    - The project, Firebase and the Hosting site are kept (data source /
      irreversible / `ABANDON`).

## Acceptance criteria (roadmap Phase 1, this scope)

| Criterion | Status | Evidence |
|---|---|---|
| Scope: Terraform in `infra/` with provider, project, APIs, and variables for project id, region, domain | Met locally | `infra/*.tf`; validate passes |
| Scope: WIF pool and provider for `djjay0131/website`, least-privilege deploy SA | Met locally | `infra/wif.tf`, `infra/deploy.tf` |
| Scope: $5 budget with email alert | Met locally (config) | `infra/budget.tf` |
| Scope: Firebase project and Hosting bound to `cusati.us` | Met locally (config); live at Checkpoint 2 | `infra/firebase.tf` |
| Scope: Actions deploy to Firebase Hosting on push to `main` | Met locally (actionlint 0 errors); first run at Checkpoint 2 | `build.yml` `firebase-deploy` |
| Scope: the hourly fingerprint check repointed | Met locally, activated when `SITE_URL` is set | `build.yml` `check` |
| Scope: the handoff states what apply creates, cost, manual steps | Met | this file |
| `https://cusati.us/` serves over HTTPS with a valid certificate | Checkpoint 2 | manual steps 7, 9 |
| Every current route returns 200 on cusati.us | Checkpoint 2 | `firebase-smoke-test` (7 smoke routes; `/research/**` parity is the site stream's) |
| `/cv/academic`, `/papers/` bodies ≥ 500 bytes | Checkpoint 2 | `firebase-smoke-test` body check |
| `djjay0131.github.io/website/` still serves | Met locally (Pages path unchanged, same smoke test; `deploy` needs only the Pages `build`, which has no Firebase step); confirmed at Checkpoint 2 | `build.yml` `build`, `deploy`, `smoke-test` |
| CV on cusati.us matches the latest release; fingerprint check reads the new host | Checkpoint 2 | `check` reads `SITE_URL`; step 9 |
| Every Phase 1 cloud resource is declared in `infra/`; `plan` shows no changes after apply | Declared locally; no-change plan at Checkpoint 2 | step 5 |
| The manual steps Terraform cannot perform are written in the repository | Met | this file; `infra/README.md` |
| The billing account has a $5 budget that emails the owner | Checkpoint 2 | `budget.tf`; the owner receives the first threshold email or sees the budget in the console |
| Deploy authenticates through WIF only, no JSON key in the repo or secrets | Met locally | no key inputs; scan clean; step 9 key-list check at Checkpoint 2 |
| The GCP project belongs to the personal account; its id is a Terraform variable | Variable met locally; ownership at Checkpoint 2 | `var.project_id`; step 1 |

Definition of Done (canon §Implementation Work):

- Approved issue: #10.
- Design docs and ADRs: ADR-0001, ADR-0004, design doc.
- PR review: pending, owned by the Lead Architect.
- Validation: included above.
- Documentation: `infra/README.md` and this handoff.
- Data, security and privacy impacts: below.
- Memory bank: for the Lead Architect.

## Data, security and privacy impacts

- No credential of any kind is created or stored. The only secret-like value, the
  billing account id, lives in a git-ignored tfvars file and local state. It is a
  `sensitive` variable and no output exposes it.
- Budget emails go to billing-account and project IAM principals; no address is
  committed.
- The WIF surface: one repository, by immutable IDs and name; the deploy only
  from `refs/heads/main`; no `pull_request_target`.
- The deploy account can modify Hosting sites in the project, including create
  and delete, and read API key metadata through API Keys Viewer (Phase 1 creates
  no API keys). It holds nothing else.
- firebase-tools and its dependency tree are installed from a committed lockfile
  before the auth step (review F5); the deploy runtime is an exact Node version
  (F10).

## Assumptions

- The billing account's currency is USD. The budget's `currency_code` must match
  it, or apply fails.
- The cusati.us registrar is outside Google Cloud DNS; records are added by hand.
- New projects have Service Usage enabled or accept step 3; step 3 is idempotent.
- The default Hosting site id equals the project id and is globally available.
  If it is not, set `hosting_site_id` to the project's real default site and set
  `SITE_URL` to the resulting `default_url`. The `DEFAULT_SITE` postcondition on
  `google_firebase_hosting_site.default` fails the apply when this assumption is
  wrong, instead of the first deploy.
- The site stream's `site/scripts/fetch-data.sh` and `firebase.json` (SEAM-2,
  SEAM-3) are as observed in the working tree today (read-only check).
- Firebase Terms of Service may need a one-time acceptance in the console
  (not verified from a primary source).

## Recommendations

1. After the first deploy, grep `site/dist-public` for `href="/website/` and
   `src="/website/`. A CI step for this is a small, useful follow-up. It is not
   added here, because the check belongs to the site stream's acceptance criterion
   and must avoid false positives on GitHub URLs in CV content.
2. Protect a `firebase-hosting` GitHub environment later if a human approval
   gate on production deploys is wanted. Environments change the OIDC `sub` but
   not `ref`, so the WIF binding keeps working.
3. Consider a `www.cusati.us` custom domain redirecting to the apex: one more
   `google_firebase_hosting_custom_domain` with `redirect_target`. It is not in
   the contract.
4. Make `budget-guard` a required status check on `main`, alongside
   `governance-checks`, so a pull request that removes the budget cannot merge.
   This is a branch-protection change, outside this contract.
5. Phase 2: put satellite WIF providers in a separate pool (ADR candidate I-2;
   review F4).
6. Consider `npm ci --ignore-scripts` for `infra/deploy-tools`. The install runs
   in a job that holds `id-token: write`, although before auth. Three locked
   packages have install scripts: `protobufjs` (required), and `re2` and
   `fsevents` (optional). Skipping them needs a deploy test first, because `re2`
   would then be absent.

## Alternatives considered

- **Direct WIF (principalSet granted Hosting roles, no service account).**
  Rejected: the auth README says direct WIF is "not supported by Firebase Admin
  SDK", and tokens last at most 10 minutes. Service-account impersonation is the
  documented path that works with firebase-tools (#3926, #10716).
- **Passing a short-lived access token to firebase-tools.** Rejected: `--token`
  and `FIREBASE_TOKEN` are deprecated in 15.30.1 (`requireAuth.ts` warnings), and
  ADC through `GOOGLE_APPLICATION_CREDENTIALS` is the supported non-interactive path.
- **FirebaseExtended/action-hosting-deploy.** Rejected: it takes
  `firebaseServiceAccount`, a JSON key, which is forbidden by §12.2.
- **A custom role in place of the predefined Hosting roles.** Not an option, and
  withdrawn (review F3): "Custom roles cannot currently be used for controlling
  access to Firebase Hosting resources"
  (<https://firebase.google.com/docs/projects/iam/permissions>). Hosting Admin
  plus API Keys Viewer is the narrowest supported grant.
- **Omitting API Keys Viewer.** Rejected after review F2: Firebase documents it as
  required for CLI deploys. The owner may still choose it at Checkpoint 2.
- **`npx firebase-tools@<version>` at deploy time.** Replaced after review F5: the
  version was pinned, but its dependency tree resolved at run time with no
  lockfile, in the job holding the deploy identity.
- **`check-latest: true` on Node 22 for the deploy.** Replaced after review F10 by
  an exact `22.23.1`, so the runtime does not float.
- **Relying on `prevent_destroy` alone for the budget.** Rejected after review F1:
  it does not stop removal when the block is deleted.
- **Attribute condition on `repository_owner` only** (Google's baseline
  example). Rejected: it admits every repository of the owner, and names are
  reusable.
- **Binding the deploy on `attribute.ref` alone.** Rejected: a future satellite
  provider in the same pool could satisfy it from its own `main`.
- **An email notification channel for the budget.** Rejected: it commits or
  requires an email address; the IAM and project-owner recipients need neither.
- **One `build` job for both variants** (the first submission). Replaced after
  verifier finding 1. The Firebase test, build and upload ran after the Pages
  upload in the job `deploy` needs, so any of them could fail `build` and skip the
  Pages deploy, even with GCP unconfigured, and every pull request stored an
  unused artifact. That broke SEAM-4 ("the GitHub Pages path behaves exactly as
  today"). Separate jobs cost a second checkout, install and data fetch (R9).
- **Keeping one job but gating the Firebase steps on `vars.GCP_PROJECT_ID`.**
  Rejected: once configured, a Firebase build failure would again skip the Pages
  deploy, and SEAM-5 asks for a separate build.
- **A GCS state backend now.** Deferred: K1 keeps buckets out of Phase 1 (see ADR
  candidates).

## Risks

- **R1 — Deploy permission set unproven until the first deploy.** Hosting Admin
  plus API Keys Viewer follows Firebase's documentation (F2), but no deploy has
  run. Mitigation: the failure is loud, and Pages is unaffected. If the owner
  removes API Keys Viewer, the step 9 fallback applies.
- **R2 — Beta resources.** The Firebase Hosting resources are beta and can change
  between provider minors. `~> 8.2` plus the lock file pins them.
- **R3 — Custom domain drift.** Computed `required_dns_updates`, `cert` and
  states change as Hosting reconciles, which could make `plan` noisy.
  Mitigation: `apply -refresh-only`. If a real diff persists, report it rather
  than adding `ignore_changes` blindly.
- **R4 — One `SITE_URL` for two jobs.** Once `SITE_URL` points at cusati.us, the
  hourly skip compares against Firebase only. If a Pages deploy failed while
  Firebase succeeded, Pages can stay stale until the next push or cv change.
  Failures still open the tracking issue.
- **R5 — Node regressions** in google-auth-library's STS exchange (#10716).
  Mitigation: the deploy job pins Node `22.23.1` exactly, and firebase-tools
  15.30.1 is locked. A bump of either is a reviewed commit.
- **R6 — `pull_request_target` and `workflow_run`.** The condition refuses
  `pull_request_target`. A `workflow_run`-triggered workflow on `main` would carry
  `refs/heads/main` and could deploy; none exists, and adding one to `main` is an
  owner-reviewed change.
- **R7 — Local state loss** would orphan management of the budget and the WIF
  resources. Mitigation: back up state (step 5); the remote backend ADR.
- **R8 — Firebase trailing-slash handling** (SEAM-3, site-owned). `firebase.json`
  sets `trailingSlash: true`. The smoke test follows redirects (`curl -L`), so
  directory routes should pass. How `/pdfs/academic.pdf` and extensionless routes
  like `/cv/academic` behave has to be confirmed by the first Firebase smoke test.
- **R9 — Two data fetches.** `build` and `build-firebase` each run
  `fetch-data.sh` against the cv repo's `latest` release, seconds apart. If that
  release is replaced between them, the two hosts could ship different CV data
  under the same `cv_fingerprint` (from `check`). The single-job design had the
  same window between `check` and the fetch. Mitigation: the next scheduled poll
  sees a new fingerprint and rebuilds both.
- **R10 — Pages-path action majors** (F11). `deploy-pages` v5.0.1 first runs after
  merge. Mitigation: the first post-merge run is the named verification step;
  Pages keeps its last deployment on failure.
- **R11 — Budget removal outside CI.** `budget-guard` and the provenance rule make
  removal visible and procedural, but a local apply from an unreviewed checkout
  can still delete the budget. Mitigation: the step 5 rule, and making
  `budget-guard` a required check (Recommendation 4).
- **R12 — SEAM-7 script dependency.** Both build jobs now run
  `npm run check:smoke-routes`, which the site stream owns. If the script is
  missing or wrong, every build fails before upload, and so every deploy. That is
  loud, and Pages keeps its last deployment.

## Seam issues

- **SEAM-3 / SEAM-1:** `firebase.json` (site-owned) sets `trailingSlash: true`.
  Firebase, "Configure Hosting behavior": "When true, Hosting redirects URLs to
  add a trailing slash … When unspecified, Hosting only uses trailing slashes for
  directory index files." Read literally, `/pdfs/academic.pdf` would redirect to
  `/pdfs/academic.pdf/`, which may not resolve. The page does not say whether
  files with extensions are exempt. Directory routes (`/cv/academic` →
  `/cv/academic/`) are fine because the smoke test follows redirects. **Reported
  to the site stream, not changed:** consider leaving `trailingSlash` unset. The
  first `firebase-smoke-test` run confirms either way (R8).
- **SEAM-4:** it does not say what the Firebase smoke test uses when `SITE_URL`
  is unset. The contract says "the project's default Hosting URL", implemented as
  `https://<GCP_PROJECT_ID>.web.app`, which is correct only while the default site
  id equals the project id. Terraform outputs `hosting_default_url` for the owner
  to check.
- **SEAM-4 / SEAM-5:** `SITE_URL` serves two purposes, the Firebase smoke target
  and the fingerprint source. The seams are consistent, but the owner must not set
  it before the domain's certificate is active, or both jobs fail or build
  needlessly. Written into step 8.
- **SEAM-4 / SEAM-5 (verifier finding 1):** the seams do not say whether the
  Firebase variant must build on unconfigured pushes. SEAM-4 ("behaves exactly as
  today") and SEAM-5 ("a separate build … from the same commit") are both met by
  the `build-firebase` job as implemented: it runs on pull requests, and on the
  deploy path only once `GCP_PROJECT_ID` is set. **Suggested for the Lead
  Architect to record in SEAM-4/SEAM-5** (not edited; `llm/**` is outside this
  contract): "The Firebase variant builds in its own job; the Pages deploy never
  depends on it. It builds on pull requests and, on the deploy path, only when
  `vars.GCP_PROJECT_ID` is set; its artifact is uploaded only on the deploy path."

## Open questions

- Should the Firebase variant also build on every unconfigured push to `main`
  (a one-clause change; see §Workflow structure), or only on pull requests and
  once configured (as implemented)?
- Does the owner want the GCS state backend (ADR candidate I-1) despite K1?
- Does the owner keep API Keys Viewer on `hub-deploy` (granted per F2; reversible
  at Checkpoint 2)?
- The contract said the budget should email "the owner". Default IAM recipients
  cover this only if the owner holds Billing Account Administrator or User on the
  billing account, which is true for a personal billing account. Confirm. Creating
  the budget needs Billing Account Administrator; Billing Account User is not
  enough (review F13; STATE §Decisions).

## Related docs

- `llm/sprints/2026-09-hub/contracts/infra-phase-1.md`,
  `llm/sprints/2026-09-hub/contracts/phase-1-seams.md`
- `llm/specs/2026-09-10-research-hub-design.md` §3, §8, §10, §11, §12
- `llm/governance/adr/0001-promote-website-to-hub-on-firebase-hosting.md`,
  `llm/governance/adr/0004-private-area-cloud-run-gate-behind-hosting.md`
- `llm/master-roadmap.md` §phase-1-foundation
- `infra/README.md`
- External:
  - Google Cloud, "Configure Workload Identity Federation with deployment pipelines"
  - google-github-actions/auth README and `src/main.ts` @ v3.0.0
  - GitHub, "OpenID Connect reference"
  - Terraform provider docs: `google_firebase_project`,
    `google_firebase_hosting_site`, `google_firebase_hosting_custom_domain`,
    `google_billing_budget`, `google_firebase_hosting_version`
  - Firebase: Terraform get-started, predefined roles, pricing, "Manage live &
    preview channels, releases, and versions"
  - Cloud Billing, "Create, edit, or delete budgets and budget alerts"
  - Google Cloud IAM pricing
  - firebase-tools 15.30.1 source and package; firebase/firebase-tools#3926 and
    #10716; nodejs/node#63989
  - FirebaseExtended/action-hosting-deploy `docs/service-account.md`
  - actions/deploy-pages README @ v5.0.1
  - Terraform, lifecycle meta-argument:
    <https://developer.hashicorp.com/terraform/language/meta-arguments/lifecycle>
  - Firebase, IAM permissions (custom roles and Hosting):
    <https://firebase.google.com/docs/projects/iam/permissions>
  - Firebase, product-level predefined roles (API Keys Viewer for CLI deploys):
    <https://firebase.google.com/docs/projects/iam/roles-predefined-product>
  - `llm/sprints/2026-09-hub/handoffs/chief-reviewer-phase-1.md` (findings F1–F14)

## ADR candidates

- **I-1 — Terraform state backend.** Proposal: a GCS bucket
  `<project>-tfstate` in the hub project, with versioning, uniform access,
  public-access prevention and owner-only IAM. Bootstrapped outside the module,
  adopted with `backend "gcs"` + `init -migrate-state`. Alternatives: local state
  with private backup (Phase 1 today), HCP Terraform. The tension with K1 (no
  buckets in Phase 1) needs the owner's ruling.
- **I-2 — WIF attribute-condition policy and the pool as trust boundary.** One
  provider per repository. Each condition matches immutable `repository_id` and
  `repository_owner_id` plus the name, and refuses `pull_request_target`. Deploy
  bindings use a `repository_id_ref` attribute.
  - The binding is pool-scoped, so it excludes other repositories only while
    every provider in the pool maps `attribute.repository_id_ref` from
    `assertion.repository_id + '/' + assertion.ref` (review F4).
  - Recommended for Phase 2: a separate pool for satellites, making the
    invariant structural. The alternative, a shared pool, requires that mapping
    in every provider, checked in review.
  - Extends C12.
- **I-3 — Deploy identity roles.** `roles/firebasehosting.admin` plus
  `roles/serviceusage.apiKeysViewer` (Firebase-documented for CLI deploys; F2,
  owner-reversible at Checkpoint 2). This is the narrowest supported grant:
  custom roles cannot control Firebase Hosting resources (F3).
  - Documented omissions: `run.viewer` (until the Phase 3 rewrites, when it
    becomes required), `firebaseauth.admin`, `serviceUsageConsumer`.
  - Extends C11.
- **I-4 — Budget guardrail enforcement** (F1). `prevent_destroy`, the
  `budget-guard` CI presence check, the apply-provenance rule (clean checkout of
  the reviewed PR head or `main`, applied SHA recorded in STATE), and a rollback
  runbook that never removes the budget.
- **I-5 — CI supply-chain pinning** (F5, F10). Actions by commit SHA, CLI tools by
  a committed lockfile (`infra/deploy-tools`), and the deploy runtime by exact
  version.

## Remediation (Chief Reviewer findings)

Source: `llm/sprints/2026-09-hub/handoffs/chief-reviewer-phase-1.md` §A.2 and
§A.3, all dispositions accepted (STATE §Phase 1 review dispositions). Branch
`feat/foundation`, on top of `9a2ca88`. No git or gh mutation, no Terraform plan
or apply, and no cloud read or change was made. Line numbers are as of this
remediation. Handoff line numbers refer to this file.

### F1 (must-fix): budget guardrail

- **Claim corrected.** `prevent_destroy` blocks a destroy or replace only while
  `google_billing_budget.hub` is in the configuration. Terraform: "This rule
  doesn't prevent Terraform from destroying a resource if you remove its
  configuration".
  - `infra/budget.tf:15-29` (guard comment rewritten);
  - `infra/README.md:104-128` (§Guardrails: Budget; new Apply provenance);
  - handoff §Budget recipients and the guard (lines 277-310).
- **Rollback rewritten.** Handoff step 10 (lines 570-618):
  - The budget is never removed. No rollback deletes `budget.tf`, removes the
    block, or runs `terraform destroy` without `-target`.
  - Infrastructure rollback is a targeted destroy of named resources, through a
    saved plan that must not mention the budget, followed by a PR that leaves
    `budget.tf` unchanged.
  - Alternatively, a revert PR that leaves `budget.tf` unchanged.
  - The step lists which addresses may be targeted, and which may never be.
- **CI presence check.** New job `budget-guard` in
  `.github/workflows/build.yml:91-131`.
  - Runs on `pull_request` and `push` (pushes are `main` only). Not gated on
    `vars.GCP_PROJECT_ID`. Checks out the repository (`contents: read`,
    `persist-credentials: false`).
  - Fails when `infra/budget.tf` is missing, has no
    `resource "google_billing_budget" "hub"`, or has no `prevent_destroy = true`
    inside that block's `lifecycle`.
  - Comments (`#`, `//`, `/* */`) are stripped first, so a commented-out block
    or guard fails. Whitespace, and quoted or bare labels, are accepted.
  - Added to `notify-failure` and `notify-recovery` `needs` (lines 462, 522), so
    a failure on `main` opens the tracking issue. No deploy job needs it, so the
    Pages path is unchanged.
  - Tested locally with the same script against nine variants. It passes the
    real file and a whitespace-mangled copy. It fails, as intended, on:
    `prevent_destroy = false`; a commented-out guard; a renamed resource; a
    block-commented `lifecycle`; `lifecycle` removed; the guard present only in
    another resource; and the file missing.
- **Apply-provenance rule.** Apply only from a clean checkout of the reviewed PR
  head or of `main`, and record the applied commit SHA in STATE.
  - `infra/README.md:66-69` (Running it) and `:121-128` (Guardrails);
  - handoff step 5 (lines 465-474), which also governs step 10.

### F2: API Keys Viewer granted

- `infra/deploy.tf:53-57`: new
  `google_project_iam_member.hub_deploy_api_keys_viewer` with
  `roles/serviceusage.apiKeysViewer`, next to `hub_deploy_hosting_admin`.
- `infra/deploy.tf:18-24`: the comment now explains the grant. The
  "Deliberately NOT granted" list (line 30) no longer names API Keys Viewer.
- `infra/README.md:24`: table row updated.
- Handoff:
  - §Deploy identity roles (lines 208-253);
  - apply table (18 resources, row 13, line 133; `Plan: 18 to add`);
  - step 5 expected counts;
  - step 9 fallback, if the owner reverses the grant;
  - §Data, security and privacy impacts;
  - R1;
  - §Open questions;
  - I-3.
- The owner may reverse this at Checkpoint 2.
- Firebase quote re-checked this session: "To deploy via the Firebase CLI, a
  project member must *also* be assigned the API Keys Viewer role".
- Not verified this session: the exact permission list of API Keys Viewer.
  Google's role page did not render through the fetch tool. The comment says
  only "Read-only", which matches the role's name and the reviewer's finding.

### F3: custom-role alternative withdrawn

- `infra/deploy.tf:26-28`: Hosting Admin plus API Keys Viewer is the narrowest
  supported grant, quoting "Custom roles cannot currently be used for
  controlling access to Firebase Hosting resources". The custom-role alternative
  sentence is removed.
- Handoff:
  - §Deploy identity roles, "Narrowest supported grant" (line 239);
  - §Alternatives (line 718): now recorded as not an option and withdrawn;
  - §Recommendations: old item 4 replaced;
  - §Open questions: custom-role question removed;
  - I-3 (line 893).

### F4: shared-pool invariant recorded

- `infra/wif.tf:19-34`: "can never satisfy this binding" is replaced by the
  invariant. The binding excludes other repositories only while every provider
  in the `github-actions` pool maps `attribute.repository_id_ref` from
  `assertion.repository_id + '/' + assertion.ref`. Terraform does not enforce
  that. The comment recommends a separate pool for satellites in Phase 2.
- `infra/wif.tf:45`: the pool description no longer announces Phase 2
  satellites. It is an in-place update, and nothing is applied yet.
- Handoff:
  - §Deploy binding (lines 185-206);
  - I-2 (line 882);
  - Recommendation 5.
- C12 in STATE is the Lead Architect's.

### F5: firebase-tools locked

- New `infra/deploy-tools/package.json`: `"firebase-tools": "15.30.1"`, exact,
  line 8.
- New `infra/deploy-tools/package-lock.json`:
  - generated with `npm install --package-lock-only --ignore-scripts` (npm
    11.16.0);
  - `lockfileVersion` 3, 674 package entries;
  - `node_modules/firebase-tools` 15.30.1 at line 3472;
  - all 673 `resolved` URLs on `https://registry.npmjs.org/`;
  - no machine paths.
- `infra/.gitignore:26-28`: `deploy-tools/node_modules/`.
- `build.yml` `firebase-deploy`:
  - new step "Install firebase-tools from the lockfile",
    `npm ci --prefix infra/deploy-tools --no-audit --no-fund` (lines 381-385),
    after Node setup and before the auth step;
  - "Deploy to Firebase Hosting" invokes
    `infra/deploy-tools/node_modules/.bin/firebase deploy --only hosting --project …`
    (line 403);
  - the `npx` invocation and `FIREBASE_TOOLS_VERSION` are removed.
- Handoff:
  - §Workflow structure (lines 335-344);
  - step 10: `hosting:clone` now uses the locked CLI;
  - §Alternatives;
  - I-5.
- Note: three locked packages have install scripts, `protobufjs` (required), and
  `re2` and `fsevents` (optional). CI runs `npm ci` with scripts enabled, as
  specified. Recommendation 6 records `--ignore-scripts` as a hardening to test.
  `npm ci` also reports "7 moderate severity vulnerabilities" in the tree.

### F8: SEAM-7, the build.yml half

- `build.yml:192-196`: `build` (GitHub Pages variant) gains "Check smoke-test
  routes exist (GitHub Pages variant)", `npm run check:smoke-routes`,
  `working-directory: site`. It sits after "Build Astro" and before "Upload
  Pages artifact".
- `build.yml:261-265`: `build-firebase` gains the same step for the Firebase
  Hosting variant. It sits after "Build Astro" and before "Upload Firebase
  Hosting artifact".
- The YAML parse confirms build < check < upload in both jobs.
- No environment is passed, because SEAM-7 defines none. The script is the site
  stream's, and was not created or touched here. It already appears as
  `check:smoke-routes` in `site/package.json`, in the site stream's work (read
  only).
- Handoff: §Workflow structure (line 345); R12.

### F10: Node pinned on the deploy path

- `build.yml:370-379`: `firebase-deploy` sets `node-version: 22.23.1` in place of
  `node-version: 22` plus `check-latest: true`. The comment about the 22.23.0
  keep-alive regression (firebase-tools#10716, nodejs/node#63989) is kept.
- The build jobs' `node-version: 22` is deliberately unchanged (lines 154 and
  228, both "Set up Node" steps). They hold no cloud credential. This is
  stated in the workflow comment and in the handoff §Workflow structure.
- Handoff:
  - §firebase-tools accepts the WIF credentials (last bullet);
  - R5;
  - §Alternatives;
  - I-5.

### F11: major action-version bumps documented

- Handoff §Major action-version bumps on the GitHub Pages path (lines 384-401):
  - checkout v4 to v5; setup-node v4 to v5; upload-pages-artifact v3 to v5.0.0;
    deploy-pages v4 to v5.0.1;
  - `origin/main` before the PR, read with `git show`.
- **Verification step:** the first post-merge `build-and-deploy` run on `main`.
  It is named in step 9 (line 565), in R10 (line 786), and for the Checkpoint 2
  list.
- **Correction to the review's A.2 text.** Upload-pages-artifact v5.0.0 *did*
  run on a pull request. PR run 34930495246, job `build`: "Upload Pages
  artifact: success" (`gh run view`, read-only). Its step has no pull-request
  condition. Only `deploy-pages` v5.0.1 is unexercised before merge.

### F12: default-site postcondition

- `infra/firebase.tf:34-42`: `google_firebase_hosting_site.default` gains
  `lifecycle { postcondition { condition = self.type == "DEFAULT_SITE" … } }`.
  The error message names the site ID and type, and says to set
  `hosting_site_id` to the project's default site.
- Attribute confirmed in google-beta 8.2.0 from the local provider schema
  (`terraform providers schema -json`, read locally, no cloud access): `type`,
  string, computed, "The type of Hosting site, either 'DEFAULT_SITE' or
  'USER_SITE'". `terraform validate` passes.
- Handoff step 5:
  - the `terraform import google_firebase_hosting_site.default …` line is
    removed; the provider adopts an existing site;
  - a recovery bullet is added for a postcondition failure (line 497).
- Handoff also updated: apply table row 17; §Assumptions.

### Remediation validation (verbatim)

From `infra/`, with the Windows `terraform.exe` (v1.14.0, windows_amd64):

```text
$ terraform fmt -check -recursive
exit=0
$ terraform init -backend=false
Initializing provider plugins...
- Reusing previous version of hashicorp/google-beta from the dependency lock file
- Reusing previous version of hashicorp/google from the dependency lock file
- Using previously-installed hashicorp/google-beta v8.2.0
- Using previously-installed hashicorp/google v8.2.0

Terraform has been successfully initialized!

You may now begin working with Terraform. Try running "terraform plan" to see
any changes that are required for your infrastructure. All Terraform commands
should now work.

If you ever set or change modules or backend configuration for Terraform,
rerun this command to reinitialize your working directory. If you forget, other
commands will detect it and remind you to do so if necessary.
exit=0
$ terraform validate
Success! The configuration is valid.

exit=0
```

actionlint (container `rhysd/actionlint:latest`):

```text
1.7.12
installed by building from source
built with go1.26.1 compiler for linux/amd64
verbose: Linting .github/workflows/build.yml
verbose: Using project at /repo
verbose: Found 0 parse errors in 1 ms for .github/workflows/build.yml
verbose: Found total 0 errors in 88 ms for .github/workflows/build.yml
exit=0
```

YAML parse (Python `yaml.safe_load`):

```text
yaml.safe_load OK; jobs: check, budget-guard, build, build-firebase, deploy, smoke-test, firebase-deploy, firebase-smoke-test, notify-failure, notify-recovery
budget-guard if: github.event_name == 'pull_request' || github.event_name == 'push'
build: build@6 smoke-check@7 upload@8 order_ok=True
build-firebase: build@6 smoke-check@7 upload@8 order_ok=True
firebase-deploy steps: ['Check deploy configuration', 'actions/checkout@fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09', 'Download Firebase Hosting build', 'Set up Node', 'Install firebase-tools from the lockfile', 'Authenticate to Google Cloud', 'Deploy to Firebase Hosting']
node: [{'node-version': '22.23.1'}]
notify-failure needs: ['check', 'budget-guard', 'build', 'deploy', 'smoke-test', 'build-firebase', 'firebase-deploy', 'firebase-smoke-test']
notify-recovery needs: ['check', 'budget-guard', 'build', 'deploy', 'smoke-test', 'build-firebase', 'firebase-deploy', 'firebase-smoke-test']
```

Lockfile install, then git status:

```text
$ npm ci --prefix infra/deploy-tools --ignore-scripts
npm warn deprecated node-domexception@1.0.0: Use your platform's native DOMException instead
npm warn deprecated json-ptr@3.1.1: Package no longer supported. Contact Support at https://www.npmjs.com/support for more info.
npm warn deprecated uuid@9.0.1: uuid@10 and below is no longer supported.  For ESM codebases, update to uuid@latest.  For CommonJS codebases, use uuid@11 (but be aware this version will likely be deprecated in 2028).
npm warn deprecated glob@10.5.0: Old versions of glob are not supported, and contain widely publicized security vulnerabilities, which have been fixed in the current version. Please update. Support for old versions may be purchased (at exorbitant rates) by contacting i@izs.me

added 671 packages, and audited 672 packages in 2m

97 packages are looking for funding
  run `npm fund` for details

7 moderate severity vulnerabilities

To address issues that do not require attention, run:
  npm audit fix

To address all issues (including breaking changes), run:
  npm audit fix --force

Run `npm audit` for details.
exit=0
$ infra/deploy-tools/node_modules/.bin/firebase --version
15.30.1
$ git status --short
 M .github/workflows/build.yml
 M infra/.gitignore
 M infra/README.md
 M infra/budget.tf
 M infra/deploy.tf
 M infra/firebase.tf
 M infra/wif.tf
 M llm/sprints/2026-09-hub/handoffs/infra-phase-1.md
?? infra/deploy-tools/
$ git status --short | grep -c node_modules
0
```

`git check-ignore -v infra/deploy-tools/node_modules` reports
`infra/.gitignore:28:deploy-tools/node_modules/`.

Scans of the changed files found:
- no private keys, `credentials_json`, billing-account-shaped IDs or machine
  paths, and no email address apart from generic service-account text;
- no remaining statement the review refuted ("can never satisfy", "deletes the
  guard first", `check-latest`, `npx firebase-tools`, "17 to add", the custom-role
  alternative, or the site import line).

### Noticed outside this scope (reported, not changed)

- Making `budget-guard` a required status check on `main` is a
  branch-protection change for the owner or Lead Architect (Recommendation 4).
- STATE C11 and C12 and the PR #12 body still need the F2, F3, F4 and F11 wording
  (Lead Architect, per the dispositions).
- The handoff `Status: Draft` line is left for the Lead Architect (F14).
