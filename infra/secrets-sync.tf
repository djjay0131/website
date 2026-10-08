# D19 (2026-10-08) — secrets reach Secret Manager through a GitHub workflow.
#
# Owner decision D19 replaces the manual `gcloud secrets create` hard stop with
# .github/workflows/secrets-sync.yml: the owner pastes the GitHub App private key
# (and the App id / installation id) into the repository's GitHub secrets and
# variables, dispatches the workflow, and the workflow does the rest. No human
# runs `gcloud` for a secret, here or on any future secret (the pattern is written
# down in llm/governance/patterns/secrets-management.md).
#
# WHAT THE WORKFLOW DOES, and therefore what it must be allowed to do:
#   1. enable secretmanager.googleapis.com if it is disabled;
#   2. create Secret Manager secret `notes-export-app-key` in this project if it
#      is absent (automatic replication);
#   3. add a new version from the GitHub secret NOTES_EXPORT_APP_KEY, then disable
#      the prior versions;
#   4. apply the remaining Terraform add — the `hub-gate` secretAccessor binding
#      (notes-sync.tf) — and set the gate's GATE_NOTES_* env from the App id and
#      installation id repository variables.
#
# WHICH IDENTITY, and why it is gate-deploy and not hub-deploy. The workflow
# authenticates as the GATE deploy identity. gate-deploy already holds
# run.developer on the hub-gate service (gate.tf:456-462), which the Terraform
# apply needs in order to set GATE_NOTES_* on that service. hub-deploy
# deliberately cannot deploy the gate — gate.tf:405-438 records that the site
# deployer and the gate deployer are different blast radii — and widening
# hub-deploy here would collapse that separation. notes-sync is gate
# configuration, so its identity is the gate's.
#
# WHY project-level secretmanager.admin (the justification D19 asks for).
# `secretmanager.secrets.create` has no resource to scope to before the secret
# exists, and the workflow itself creates the secret; a secret-scoped grant
# cannot bootstrap the secret it is scoped to, and a project-level custom role
# that can setIamPolicy is no narrower than admin while being bespoke. The
# provider therefore cannot express "create secrets, then manage only the one you
# created", and this is the fallback D19 names. The project holds exactly one
# secret, the one this workflow creates, so the identity can read only a secret
# it created today; **the follow-up to narrow this to a secret-scoped
# secretmanager.admin (and a create-only project role) is tracked as issue
# #112.** No secret value is ever managed by Terraform or written to state.
resource "google_project_iam_member" "gate_deploy_secretmanager_admin" {
  project = var.project_id
  role    = "roles/secretmanager.admin"
  member  = google_service_account.gate_deploy.member
}

# Enabling secretmanager.googleapis.com needs serviceusage.services.enable. D19
# permits this "only if enabling the API needs it", and it does: the API is
# currently disabled on cusati-hub.
resource "google_project_iam_member" "gate_deploy_serviceusage_admin" {
  project = var.project_id
  role    = "roles/serviceusage.serviceUsageAdmin"
  member  = google_service_account.gate_deploy.member
}

# The Terraform state backend is a GCS bucket (versions.tf, D19). A runner has no
# local state, so the workflow must read and write `gs://cusati-hub-tfstate/infra`
# to run the adds-only apply. objectAdmin is the narrowest predefined role that
# covers state objects and the lock object; the bucket is scoped, not the project.
# The bucket itself is a one-time bootstrap (a backend bucket cannot be created by
# the state it stores) and is documented in infra/README.md §State.
resource "google_storage_bucket_iam_member" "gate_deploy_tfstate" {
  bucket = "cusati-hub-tfstate"
  role   = "roles/storage.objectAdmin"
  member = google_service_account.gate_deploy.member
}

# The Terraform GCS backend also reads the bucket's own metadata
# (`storage.buckets.get`), which objectAdmin does not include. The legacy bucket
# reader adds exactly read (get/list) and nothing write.
resource "google_storage_bucket_iam_member" "gate_deploy_tfstate_reader" {
  bucket = "cusati-hub-tfstate"
  role   = "roles/storage.legacyBucketReader"
  member = google_service_account.gate_deploy.member
}

# The gate Cloud Run service's config depends on `data.google_project.hub` for the
# project NUMBER that forms the origin set (local.gate_allowed_origins,
# gate.tf:57). Terraform reads that data source on every plan, so the identity
# that applies the gate env must be able to read the project. roles/browser is
# the narrow predefined read role: resourcemanager.projects.get (+ list), no
# write of any kind.
resource "google_project_iam_member" "gate_deploy_browser" {
  project = var.project_id
  role    = "roles/browser"
  member  = google_service_account.gate_deploy.member
}
