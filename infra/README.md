# infra — the research hub's cloud foundation

Terraform for Phase 1 (issue #10) of the research hub, per the design authority
`llm/specs/2026-09-10-research-hub-design.md` §8 and §12, ADR-0001, and the
seams in `llm/sprints/2026-09-hub/contracts/phase-1-seams.md` (SEAM-4).

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
| `deploy.tf` | `google_service_account.hub_deploy`, `google_project_iam_member.hub_deploy_hosting_admin`, `google_service_account_iam_member.hub_deploy_wif_main` | The keyless deploy identity, `roles/firebasehosting.admin` only, usable only from `refs/heads/main` |
| `budget.tf` | `google_billing_budget.hub` | $5/month for this project, emailing billing-account admins/users and project owners; `prevent_destroy` |
| `firebase.tf` | `google_firebase_project.hub`, `google_firebase_hosting_site.default`, `google_firebase_hosting_custom_domain.primary` | Firebase on the project, its default Hosting site, and `var.domain` bound to it |

Not managed, by design (Phase 1 scope, issue #10 K1): storage buckets, Artifact
Registry, Cloud Run, Identity Platform, Firestore, per-satellite identities.

Not Terraformable or deliberately manual: creating the project, linking billing
(Blaze), the DNS records at the registrar, and deploying site content (done by
`firebase-tools` in `build.yml`). See the handoff for sources.

## Variables

| Name | Required | Default | Notes |
|---|---|---|---|
| `project_id` | yes | — | The project the owner created (intended `cusati-hub`) |
| `billing_account` | yes | — | `XXXXXX-XXXXXX-XXXXXX`; sensitive; only for the budget |
| `region` | no | `us-east1` | No Phase 1 resource is regional |
| `domain` | no | `cusati.us` | Custom domain for the default Hosting site |
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
| `custom_domain_dns_records` | Records to add at the registrar for `var.domain` |
| `custom_domain_state` | Ownership, host and certificate state of the domain |

## Running it

Prerequisites: Terraform `>= 1.14.0, < 2.0.0`; `gcloud` signed in as the owner;
the project created, billing linked, and the bootstrap APIs enabled (handoff
§Manual steps 1–3).

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
- **Budget.** `google_billing_budget.hub` has `lifecycle { prevent_destroy = true }`,
  so `terraform destroy` or a replacing change fails at plan time (§12.6).
  Removing the budget takes a reviewed commit that deletes that guard first.
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
