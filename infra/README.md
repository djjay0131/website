# infra — the research hub's cloud foundation

Terraform for Phase 1 (issue #10) of the research hub, per the design authority
`llm/specs/2026-09-10-research-hub-design.md` §8 and §12, ADR-0001, ADR-0006 (the
hub's hostnames), and the seams in `llm/sprints/2026-09-hub/contracts/phase-1-seams.md` (SEAM-4).

One reviewed `terraform apply`, run by the owner, creates everything below.
After the owner sets three GitHub Actions variables from its outputs, the next
push to `main` deploys the site to Firebase Hosting through Workload Identity
Federation. Until then `.github/workflows/build.yml` builds and deploys GitHub
Pages exactly as before and skips every Firebase job.

The full ordered runbook for Checkpoint 2 (create the project, Blaze, apply, DNS,
variables, first deploy, rollback) is in
`llm/sprints/2026-09-hub/handoffs/infra-phase-1.md` §Manual steps. This file is
the reference for the module itself.

## What this module manages

| File | Resources | Why |
|---|---|---|
| `main.tf` | `data.google_project.hub`; `google_project_service.phase1` (8 APIs) | The project is read, never created (§10 Q2). APIs: Cloud Resource Manager, Service Usage, IAM, STS, IAM Credentials, Firebase Management, Firebase Hosting, Billing Budgets |
| `wif.tf` | `google_iam_workload_identity_pool.github`, `google_iam_workload_identity_pool_provider.website` | GitHub OIDC federation; the provider admits only this repository, by immutable ID and name |
| `deploy.tf` | `google_service_account.hub_deploy`, `google_project_iam_member.hub_deploy_hosting_admin`, `google_project_iam_member.hub_deploy_api_keys_viewer`, `google_service_account_iam_member.hub_deploy_wif_main` | The keyless deploy identity, usable only from `refs/heads/main`. It holds `roles/firebasehosting.admin` and `roles/serviceusage.apiKeysViewer`, which Firebase requires for CLI deploys. That is the narrowest supported grant: custom roles cannot control Firebase Hosting resources |
| `budget.tf` | `google_billing_budget.hub` | $5/month for this project, emailing billing-account admins/users and project owners; `prevent_destroy`, a CI presence check and apply provenance (see Guardrails) |
| `firebase.tf` | `google_firebase_project.hub`, `google_firebase_hosting_site.default`, `google_firebase_hosting_custom_domain.primary`, `google_firebase_hosting_custom_domain.redirect` (one per `var.redirect_domains`) | Firebase on the project and its default Hosting site (a postcondition requires type `DEFAULT_SITE`). `var.domain`, the canonical host `jason.cusati.us`, is bound to the site, and `research.cusati.us` is connected to the same site with a 301 redirect to it (`redirect_target`) |
| `deploy-tools/` | none: `package.json` and `package-lock.json` | Pins `firebase-tools` to exactly 15.30.1 with its whole dependency tree. `build.yml` installs it with `npm ci --prefix infra/deploy-tools`. `node_modules/` is git-ignored |

Not managed, by design (Phase 1 scope, issue #10 K1): storage buckets, Artifact
Registry, Cloud Run, Identity Platform, Firestore, per-satellite identities.

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

Copy `terraform.tfvars.example` to `terraform.tfvars` and fill it in.
`terraform.tfvars` is git-ignored (`infra/.gitignore`), as are state files and
`.terraform/`. The dependency lock file `.terraform.lock.hcl` is committed.

## Outputs

| Output | Use |
|---|---|
| `github_actions_variables` | The SEAM-4 variables `GCP_PROJECT_ID`, `GCP_WIF_PROVIDER`, `GCP_DEPLOY_SA` |
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

## Guardrails

- **No keys.** Nothing here creates a service-account key, and nothing may
  (§12.2). GitHub Actions authenticates through WIF.
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

**Proposed backend (ADR candidate, not adopted):** a GCS bucket in the hub project,
for example `<project_id>-tfstate`, with object versioning, uniform
bucket-level access, public access prevention, and no principal other than the
owner. It is created outside this module (it cannot hold its own state), and
adopted with a `backend "gcs"` block and `terraform init -migrate-state`. It is
not in Phase 1 because issue #10 K1 keeps storage buckets out of this phase, and
bucket storage for a few kilobytes of state is negligible but not zero. The owner
decides; see the handoff §ADR candidates.
