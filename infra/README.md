# infra — the research hub's cloud foundation

Terraform for Phases 1 and 2 of the research hub, per the design authority
`llm/specs/2026-09-10-research-hub-design.md` §8 and §12, ADR-0001, ADR-0006 (the
hub's hostnames), ADR-0007 (satellite publishing and the prefix boundary),
ADR-0008 (`cv` is public, default branch `master`), and the seams in
`llm/sprints/2026-09-hub/contracts/phase-1-seams.md` (SEAM-4) and
`phase-2-seams.md` (SEAM-2, SEAM-3, SEAM-4, SEAM-6, SEAM-7).

**Phase 1 (issue #10)** — one reviewed `terraform apply`, run by the owner,
creates the project's APIs, the deploy identity and Firebase Hosting. After the
owner sets three GitHub Actions variables from its outputs, the next push to
`main` deploys the site to Firebase Hosting through Workload Identity
Federation.

**Phase 2 (issue #16)** — the same apply now also creates the **content
bucket** and a **publishing identity for each satellite**. A satellite can write
only under its own `sources/<source>/` prefix, cannot enumerate anything else in
the bucket, and holds no key and no GitHub credential. Adding the next satellite
is one entry in `var.satellites`, not a new module. See
[Phase 2: the content bucket and satellite publishing](#phase-2-the-content-bucket-and-satellite-publishing).

The full ordered runbook for Checkpoint 2 (create the project, Blaze, apply, DNS,
variables, first deploy, rollback) is in
`llm/sprints/2026-09-hub/handoffs/infra-phase-1.md` §Manual steps, and the
Checkpoint 3 runbook is in `infra-phase-2.md`. This file is the reference for
the module itself.

## What this module manages

| File | Resources | Why |
|---|---|---|
| `main.tf` | `data.google_project.hub`; `google_project_service.phase1` (8 APIs) | The project is read, never created (§10 Q2). APIs: Cloud Resource Manager, Service Usage, IAM, STS, IAM Credentials, Firebase Management, Firebase Hosting, Billing Budgets |
| `wif.tf` | `google_iam_workload_identity_pool.github`, `google_iam_workload_identity_pool_provider.website` | GitHub OIDC federation; the provider admits only this repository, by immutable ID and name |
| `deploy.tf` | `google_service_account.hub_deploy`, `google_project_iam_member.hub_deploy_hosting_admin`, `google_project_iam_member.hub_deploy_api_keys_viewer`, `google_service_account_iam_member.hub_deploy_wif_main` | The keyless deploy identity, usable only from `refs/heads/main`. It holds `roles/firebasehosting.admin` and `roles/serviceusage.apiKeysViewer`, which Firebase requires for CLI deploys. That is the narrowest supported grant: custom roles cannot control Firebase Hosting resources |
| `budget.tf` | `google_billing_budget.hub` | $5/month for this project, emailing billing-account admins/users and project owners; `prevent_destroy`, a CI presence check and apply provenance (see Guardrails) |
| `firebase.tf` | `google_firebase_project.hub`, `google_firebase_hosting_site.default`, `google_firebase_hosting_custom_domain.primary`, `google_firebase_hosting_custom_domain.redirect` (one per `var.redirect_domains`) | Firebase on the project and its default Hosting site (a postcondition requires type `DEFAULT_SITE`). `var.domain`, the canonical host `jason.cusati.us`, is bound to the site, and `research.cusati.us` is connected to the same site with a 301 redirect to it (`redirect_target`) |
| `storage.tf` | `google_project_service.phase2` (1 API), `google_storage_bucket.content`, `google_storage_bucket_iam_member.hub_deploy_content_viewer` | The content bucket: uniform bucket-level access (**required** — an IAM condition does not apply without it), public access prevention enforced, versioning, soft delete, three lifecycle rules, `force_destroy = false`. The hub's `hub-deploy` gets `roles/storage.objectViewer` on it, unconditioned, because the hub owns the bucket and must list and read every prefix (SEAM-4) |
| `satellite-role.tf` | `google_project_iam_custom_role.satellite_publisher` | The satellite grant: **exactly** `storage.objects.create`, `storage.objects.delete`, `storage.objects.get`, and **never** `storage.objects.list`, which cannot be prefix-restricted (ADR-0007 decision 4). One role for all satellites; the prefix lives in the binding |
| `satellites.tf` | `google_iam_workload_identity_pool.satellites`, and per satellite `google_iam_workload_identity_pool_provider.satellite`, `google_service_account.satellite_publish`, `google_service_account_iam_member.satellite_publish_wif`, `google_storage_bucket_iam_member.satellite_publish_prefix` | One keyless identity per satellite, in a pool **separate** from the hub's (ADR-0007 decision 5), admitted only from that repository and its default branch (`master` for `cv`), and granted the custom role on the bucket conditioned to `sources/<source>/` |
| `deploy-tools/` | none: `package.json` and `package-lock.json` | Pins `firebase-tools` to exactly 15.30.1 with its whole dependency tree. `build.yml` installs it with `npm ci --prefix infra/deploy-tools`. `node_modules/` is git-ignored |

Not managed, by design (roadmap "Not in this phase"; Phase 3 owns them): the
**private** bucket, Artifact Registry, Cloud Run, Identity Platform, Firestore,
the sign-in gate, and any `phd-milestones` identity. Adding `phd-milestones`
later is one entry in `var.satellites` plus whatever Phase 3 decides about
private items — this module needs no new resource type for it.

Not Terraformable or deliberately manual: creating the project, linking billing
(Blaze), the hub hostnames' DNS records at the registrar, and deploying site content (done by
`firebase-tools` in `build.yml`). See the handoff for sources.

## Variables

| Name | Required | Default | Notes |
|---|---|---|---|
| `project_id` | yes | — | The project the owner created (intended `cusati-hub`) |
| `billing_account` | yes | — | `XXXXXX-XXXXXX-XXXXXX`; sensitive; only for the budget |
| `region` | no | `us-east1` | No Phase 1 resource is regional |
| `domain` | no | `jason.cusati.us` | The canonical hub host, bound to the default Hosting site (ADR-0006). Validation rejects `cusati.us` and `www.cusati.us` |
| `redirect_domains` | no | `["research.cusati.us"]` | Hostnames connected to the same site that 301-redirect to `domain`. Validation rejects `domain` itself, the apex, `www`, and duplicates |
| `github_repository` | no | `djjay0131/website` | Name matched by the WIF condition |
| `github_repository_id` | no | `1212933399` | Immutable repository ID matched by the WIF condition and deploy binding |
| `github_repository_owner_id` | no | `5666389` | Immutable owner ID matched by the WIF condition |
| `hosting_site_id` | no | `null` (= `project_id`) | Override only if the project ID is taken as a site ID |
| `content_bucket_name` | no | `null` (= `<project_id>-content`) | Bucket names are globally unique; override if the default stem is taken. Validation rejects dots, uppercase, and `goog*`/`*google*` |
| `satellites` | no | one entry, `cv` | Satellites allowed to publish, **keyed by source name**. Per satellite: `repository`, `repository_id`, `repository_owner_id`, `default_branch`. Validation enforces the SEAM-2 source-name shape, the service-account and provider ID length limits, numeric IDs, and a bare branch name |

Copy `terraform.tfvars.example` to `terraform.tfvars` and fill it in.
`terraform.tfvars` is git-ignored (`infra/.gitignore`), as are state files and
`.terraform/`. The dependency lock file `.terraform.lock.hcl` is committed.

## Outputs

| Output | Use |
|---|---|
| `github_actions_variables` | The variables to set on **this** repository: `GCP_PROJECT_ID`, `GCP_WIF_PROVIDER`, `GCP_DEPLOY_SA`, `GCP_CONTENT_BUCKET` |
| `satellite_github_actions_variables` | Per source name, the variables to set in **that satellite's own** repository: `GCP_PROJECT_ID`, `GCP_WIF_PROVIDER`, `GCP_PUBLISH_SA`, `GCP_CONTENT_BUCKET` |
| `content_bucket_name`, `content_bucket_url` | The bucket, as a name and as a `gs://` URL |
| `satellites_pool_name`, `satellite_publish_role_id` | The satellites WIF pool and the custom role, for the Checkpoint 3 checks |
| `satellite_publish_service_accounts`, `satellite_workload_identity_providers` | The same per-satellite values individually, keyed by source name |
| `satellite_prefixes` | The one `gs://…/sources/<source>/` prefix each satellite may write |
| `project_id`, `project_number`, `workload_identity_provider`, `deploy_service_account_email` | The same values individually |
| `hosting_default_url` | The `*.web.app` URL the Firebase smoke test uses when `SITE_URL` is unset |
| `custom_domain_dns_records` | Records to add or remove at the registrar, one entry per record, for every connected hostname. `custom_domain` names the hostname each record is for |
| `custom_domain_state` | Per hostname: `redirect_target`, and its ownership, host and certificate state |

## Running it

Prerequisites: Terraform `>= 1.14.0, < 2.0.0`; `gcloud` signed in as the owner;
the project created, billing linked, and the bootstrap APIs enabled (handoff
§Manual steps 1–3). Apply only under the apply-provenance rule in §Guardrails:
a clean checkout of the reviewed PR head or of `main`, with the applied commit
SHA recorded.

```sh
gcloud auth application-default login
gcloud auth application-default set-quota-project <project_id>

cd infra
cp terraform.tfvars.example terraform.tfvars   # then edit
terraform init
terraform plan -out=tfplan                     # review every line
terraform apply tfplan
terraform output github_actions_variables
terraform output custom_domain_dns_records
```

If an apply fails with `SERVICE_DISABLED` or `has not been used in project`, the
API enablement is still propagating: wait two minutes and run
`terraform apply` again.

After apply, `terraform plan` must report no changes (roadmap Phase 1
acceptance, §12.5). The custom domain's computed state changes as DNS and the
certificate progress; refresh it with `terraform apply -refresh-only`.

Validation that needs no cloud access:

```sh
terraform fmt -check -recursive
terraform init -backend=false
terraform validate
```

## Phase 2: the content bucket and satellite publishing

### What Phase 2 adds

Nine resources (`Plan: 9 to add, 0 to change, 0 to destroy` on top of Phase 1's
19), the layout `gs://<bucket>/sources/<source>/…`, and one publishing identity
per entry in `var.satellites` — `cv` today.

The boundary, in one line: **a satellite may create, overwrite and read objects
under its own prefix, and may do nothing else at all** — not write elsewhere,
not read another prefix, and not even list the bucket.

### The two settings that must never change

1. **`uniform_bucket_level_access = true`** on the bucket. This is not
   hardening; it is load-bearing. "To use conditions in the allow policy for a
   Cloud Storage bucket, you must enable uniform bucket-level access on the
   bucket" (<https://cloud.google.com/iam/docs/conditions-overview>). Turn it
   off and every satellite's prefix condition stops constraining anything, so
   each satellite's write grant silently covers the **whole** bucket.
2. **No satellite ever gets `storage.objects.list`**, under any role,
   conditioned or not. "Since the `storage.objects.list` permission is granted
   at the bucket level, you cannot use the `resource.name` condition attribute
   to restrict object listing access to a subset of objects in the bucket"
   (<https://cloud.google.com/storage/docs/access-control/iam>). A satellite
   holding `list` could enumerate every other source's object names — in
   Phase 3, private `phd-milestones` items. This is also why the publish step
   may not use `gcloud storage cp --recursive`, which requires `list`
   (ADR-0007 decision 6).

### Manual steps, in order

Continues from the Phase 1 runbook. Every apply follows the same apply-provenance
rule (§Guardrails): a clean checkout of the reviewed PR head or of `main`,
`budget-guard` green, no override file under `infra/`, and the applied commit SHA
recorded in the sprint `STATE.md`.

1. **Apply.** From `infra/`:
   - `terraform init` — expected: `Terraform has been successfully initialized!`
   - `terraform plan -out=tfplan` — expected: **`Plan: 9 to add, 0 to change, 0 to destroy.`**
     Nothing may be changed or destroyed. If the plan wants to change or replace
     a Phase 1 resource, or mentions `google_billing_budget.hub`, **stop**.
   - `terraform apply tfplan` — expected: `Apply complete! Resources: 9 added, 0 changed, 0 destroyed.`
   - `terraform plan` again — expected: `No changes.` (§12.5).

   If apply fails with `SERVICE_DISABLED` for `storage.googleapis.com`, the API
   is still propagating: wait two minutes and apply again.

2. **Confirm the bucket's security settings** before anything writes to it:

   ```sh
   gcloud storage buckets describe "$(terraform output -raw content_bucket_url)" \
     --format="value(uniform_bucket_level_access.enabled,public_access_prevention,versioning.enabled)"
   ```

   Expected: `True  enforced  True`. If the first value is not `True`, **stop**:
   the prefix boundary is not in effect.

3. **Confirm the custom role holds exactly three permissions and no `list`:**

   ```sh
   gcloud iam roles describe satellitePublisher --project "$(terraform output -raw project_id)" \
     --format="value(includedPermissions)"
   ```

   Expected, exactly: `storage.objects.create;storage.objects.delete;storage.objects.get`.
   If `storage.objects.list` appears, **stop and raise it** — do not proceed.

4. **Set the GitHub Actions variables in BOTH repositories.** None is secret;
   all are variables (Settings → Secrets and variables → Actions → Variables).

   In `djjay0131/website` (adds one variable to Phase 1's three):

   ```sh
   gh variable set GCP_CONTENT_BUCKET --body "$(terraform -chdir=infra output -raw content_bucket_name)"
   ```

   In `djjay0131/cv` (all four are new there):

   ```sh
   terraform -chdir=infra output -json satellite_github_actions_variables | jq -r '.cv | to_entries[] | "\(.key)\t\(.value)"'
   # then, from a checkout of cv, or with --repo djjay0131/cv:
   gh variable set GCP_PROJECT_ID     --repo djjay0131/cv --body "<GCP_PROJECT_ID>"
   gh variable set GCP_WIF_PROVIDER   --repo djjay0131/cv --body "<GCP_WIF_PROVIDER>"
   gh variable set GCP_PUBLISH_SA     --repo djjay0131/cv --body "<GCP_PUBLISH_SA>"
   gh variable set GCP_CONTENT_BUCKET --repo djjay0131/cv --body "<GCP_CONTENT_BUCKET>"
   ```

   Expected: `gh variable list --repo djjay0131/cv` shows all four.
   `GCP_WIF_PROVIDER` has the form
   `projects/<number>/locations/global/workloadIdentityPools/satellites/providers/github-cv`.
   **Note the trap:** `GCP_WIF_PROVIDER` exists in both repositories with
   *different* values — the hub's is in the `github-actions` pool, `cv`'s is in
   the `satellites` pool. Setting the hub's value in `cv` fails closed (the hub's
   provider refuses `cv`'s repository ID), but the error reads like a broken
   provider, so check the pool name in the value.

   Confirm `cv` holds no Google key and no hub credential:
   `gh secret list --repo djjay0131/cv` shows no `WEBSITE_DISPATCH_PAT` and no
   Google credential (§12.2, ADR-0007 decision 2).

5. **Verify the prefix boundary.** The three recorded tests the roadmap requires
   are written out in full, with expected output, in
   `llm/sprints/2026-09-hub/handoffs/infra-phase-2.md` §Checkpoint 3. Run them
   before the first real publish.

### Cost

Phase 2's expected addition to the bill: **$0.00/month**, and about **$0.01/month**
if the free allowance did not exist at all. Rates are us-east1 list prices from
<https://cloud.google.com/storage/pricing> (read 2026-09-15).

| Line | Rate | Phase 2 usage | Cost |
|---|---|---|---|
| Standard storage, us-east1 | $0.020 per GB per month | ≤ ~60 MB: one `cv` publish is ~5 MB (4 PDFs plus the `cv-data` payload), and the lifecycle rules keep at most 5 noncurrent versions or 30 days, with soft-deleted copies for a further 7 days | $0.0012 → **$0.00** |
| Class A operations (writes, and every bucket listing) | $0.005 per 1,000 | ~930/month: ~210 object writes (≈21 files × ~10 publishes) plus 720 hourly poll listings | $0.005 → **$0.00** |
| Class B operations (reads) | $0.0004 per 1,000 | ~210/month: the hub downloads ~21 objects on each of the ~10 polls that find a change | $0.0001 → **$0.00** |
| Network egress to the GitHub Actions runner | $0.12 per GB from North America | ~50 MB/month | $0.006 → **$0.00** |
| WIF pool, providers, service accounts, IAM bindings, the custom role | $0 — "All use of Identity and Access Management API is free of charge" | 1 pool, 1 provider, 1 SA, 3 bindings, 1 role | **$0.00** |

Every line lands at $0.00 because it sits inside the Cloud Storage Always Free
allowance — 5 GB-months of Standard storage, 5,000 Class A operations, 50,000
Class B operations and 100 GB of North American egress per month, which "apply to
usage in US-WEST1, US-CENTRAL1, and US-EAST1 regions" (Cloud Storage pricing,
"Cloud Storage Always Free usage limits"). The bucket is in us-east1, so it
qualifies. Note that storage is billed the same for live, noncurrent and
soft-deleted bytes ("Data storage charges apply in the same way to live objects,
noncurrent objects, and soft-deleted objects"), which is what the lifecycle rules
in `storage.tf` bound.

Sensitivity, so the number is honest rather than merely small:

- **Poll frequency is the only line that scales with time, not content.** Hourly
  polling is 720 listings/month, comfortably inside the 5,000 free Class A
  operations. Polling every 5 minutes would be 8,640, past the free allowance, and
  would cost about $0.02/month — still negligible, but it is the line to watch if
  the interval ever shortens.
- The $5 budget would need roughly 250 GB stored, or a million Class A
  operations, before it alerted on this bucket. Phase 1's $0.00 expectation is
  unchanged.

### Rollback (Phase 2 resources only)

The budget is never removed (§12.6), and no rollback runs `terraform destroy`
without `-target`. In increasing order of severity:

1. **Stop one satellite publishing, immediately:** remove its entry from
   `var.satellites` and apply. That destroys its provider, its service account
   and its bucket binding — nothing else. It is instant and fully reversible by
   putting the entry back.
2. **Stop every satellite publishing:** set `satellites = {}` and apply. The pool
   and the bucket remain; published content is untouched.
3. **Cut the hub's read access:** targeted destroy of
   `google_storage_bucket_iam_member.hub_deploy_content_viewer`. The hub build
   then cannot sync the bucket.
4. **Remove the bucket:** only when it is empty. `force_destroy = false` means a
   bucket still holding objects fails to destroy, by design. Restore content by
   re-publishing from each satellite.

Never target `google_project_iam_custom_role.satellite_publisher`: it is
`deletion_policy = "PREVENT"`, and a deleted custom role locks its ID for
between 7 and 37 days, so every satellite would be unable to publish for that
window with no way to apply out of it. Revoke a satellite at its **binding**
(step 1), never at the role.

## Guardrails

- **No keys.** Nothing here creates a service-account key, and nothing may
  (§12.2). GitHub Actions authenticates through WIF — the hub's deploy identity
  and every satellite's publish identity alike.
- **No satellite gets `storage.objects.list`** (ADR-0007 decision 4), and the
  content bucket keeps `uniform_bucket_level_access = true`. See
  [the two settings that must never change](#the-two-settings-that-must-never-change).
  If a change appears to need either, stop and raise it; do not widen the grant.
- **Domains (ADR-0006).** The hub is `jason.cusati.us`. `research.cusati.us`
  301-redirects to it.
  - `cusati.us` and `www.cusati.us` are reserved for a family site outside this
    project. This module never binds them, and `variables.tf` rejects them.
  - The apex carries Google Workspace MX records and a Google site-verification
    TXT record. **No hub step adds, changes or removes records on the apex or
    `www`, or any MX or existing TXT record.**
  - At the registrar, change only the records `custom_domain_dns_records` lists
    for the two hub hostnames. If an entry's `domain_name` is the apex or `www`,
    stop.
- **Budget (§12.6: the budget alert is never removed).** Three controls:
  - `google_billing_budget.hub` has `lifecycle { prevent_destroy = true }`. A plan
    that would destroy or replace the budget (`terraform destroy`, or an edit
    that forces replacement) fails, but **only while the resource block is in
    the configuration**. Terraform: "This rule doesn't prevent Terraform from
    destroying a resource if you remove its configuration"
    (<https://developer.hashicorp.com/terraform/language/meta-arguments/lifecycle>).
    Deleting the block, or `budget.tf`, destroys the budget in one apply.
  - The `budget-guard` job in `.github/workflows/build.yml` runs on every
    trigger of the workflow. It fails when `infra/budget.tf` is missing,
    or lacks `resource "google_billing_budget" "hub"` or that block's
    `prevent_destroy = true`. It also fails when any tracked file under `infra/`
    matches `override.tf*` or `*_override.tf*`: Terraform merges override files
    into resource blocks, "the contents of any `lifecycle` nested block … on an
    argument-by-argument basis", so an override can set
    `prevent_destroy = false` while `budget.tf` is unchanged. The job runs on
    every trigger.
  - Apply provenance (below).

  No rollback removes `budget.tf` or the budget. To remove other resources,
  use a targeted destroy of named resources (handoff, manual step 10). If a plan
  lists `google_billing_budget.hub` to be destroyed or replaced, do not apply it.
- **Apply provenance.** Run `terraform apply` only from a clean checkout of the
  reviewed PR head or of `main`:
  - `git status --porcelain` prints nothing;
  - `git rev-parse HEAD` equals the PR's head commit, or `origin/main` after
    `git fetch`;
  - the `budget-guard` check is green on that commit;
  - from the repository root,
    `ls infra/override.tf* infra/*_override.tf* 2>/dev/null` prints nothing.
    `infra/.gitignore` ignores override files, so neither `git status --porcelain`
    nor `budget-guard` sees a local one, yet Terraform would merge it into the
    budget's `lifecycle`.

  Apply a saved plan (`terraform plan -out=tfplan`, then `terraform apply tfplan`).
  Record the applied commit SHA in the sprint `STATE.md`.
- **Destroy.** The project is a data source and survives `terraform destroy`.
  Firebase cannot be removed from a project once added; the Hosting site uses
  `deletion_policy = "ABANDON"`. APIs are left enabled.

## State

Phase 1 uses **local state**, kept out of git by `infra/.gitignore`. State holds
resource names and the billing account ID but no credentials. Back up
`terraform.tfstate` after every apply to a private location outside the
repository.

**Proposed backend (ADR candidate C10, still not adopted):** a GCS bucket in the
hub project, for example `<project_id>-tfstate`, with object versioning, uniform
bucket-level access, public access prevention, and no principal other than the
owner. It is created outside this module (it cannot hold its own state), and
adopted with a `backend "gcs"` block and `terraform init -migrate-state`.

Phase 2 removes the reason it was deferred: `storage.googleapis.com` is now
enabled and this module already creates buckets, so the Phase 1 blocker (issue
#10 K1) is gone, and the owner's Checkpoint 2 decision was "local for now; move
to a bucket in Phase 2 (C10)". It is **not** done here because the Phase 2 scope
in the roadmap does not include it. It needs a decision and its own change; see
the Phase 2 handoff §ADR candidates.

## Checkpoint 3 — verifying the boundary

**Do not use `gcloud storage` to test the satellite identity.** Verified at Checkpoint 3 on
2026-09-16: `gcloud storage cp` requires `storage.objects.list` even for a single
non-recursive file into the satellite's *own* prefix, and that permission is deliberately
never granted. A `gcloud` test therefore fails on the **allowed** path too, which looks like
a broken boundary and is not one. Test with the JSON API and an impersonated token, which
exercises exactly the permissions the real publish path uses:

```bash
TOKEN="$(gcloud auth print-access-token --impersonate-service-account="$SA")"
U=https://storage.googleapis.com

# ALLOWED inside its own prefix: create, overwrite, read, delete -> 200 200 200 204
curl -s -o /dev/null -w '%{http_code}\n' -X POST -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: text/plain' --data-binary @/tmp/boundary.txt \
  "$U/upload/storage/v1/b/$BUCKET/o?uploadType=media&name=sources%2Fcv%2F_probe.txt"

# DENIED outside it, including sources/cv-other/ which proves the trailing slash -> 403
curl -s -o /dev/null -w '%{http_code}\n' -X POST -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: text/plain' --data-binary @/tmp/boundary.txt \
  "$U/upload/storage/v1/b/$BUCKET/o?uploadType=media&name=sources%2Fcv-other%2F_probe.txt"

# DENIED listing, even its own prefix -> 403
curl -s -o /dev/null -w '%{http_code}\n' -H "Authorization: Bearer $TOKEN" \
  "$U/storage/v1/b/$BUCKET/o?prefix=sources%2Fcv%2F&maxResults=1"
```

**Prove there is no *other* grant** (Chief Reviewer S10). The checks above confirm the role
and the bucket binding are right; these confirm nothing else reaches the satellite, which
Terraform cannot show because it sees only what it declares:

```bash
# Expect NO rows: the publishing identity must hold no project-level role at all.
gcloud projects get-iam-policy "$PROJECT" \
  --flatten="bindings[].members" \
  --filter="bindings.members:publish-cv@${PROJECT}.iam.gserviceaccount.com" \
  --format="table(bindings.role)"

# Expect EXACTLY two bindings: hub-deploy objectViewer (unconditioned), and
# satellitePublisher conditioned to sources/cv/.
gcloud storage buckets get-iam-policy "gs://${CONTENT_BUCKET}"

# Expect NO user-managed keys.
gcloud iam service-accounts keys list \
  --iam-account="publish-cv@${PROJECT}.iam.gserviceaccount.com" --managed-by=user
```
