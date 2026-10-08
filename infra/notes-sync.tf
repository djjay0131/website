# Wave 6 notes-sync (ADR-0022; D18, amended by D19): the gate commits annotations
# to a long-lived `notes` branch in each destination repository, through a GitHub
# App.
#
# CREDENTIAL HANDLING (owner decision D19, 2026-10-08). There is no manual
# `gcloud` step. The owner pastes the App private key into the repository's
# GitHub Actions secret `NOTES_EXPORT_APP_KEY` (and the App id / installation id
# into the repository variables `NOTES_EXPORT_APP_ID` and
# `NOTES_EXPORT_INSTALLATION_ID`), then runs `gh workflow run secrets-sync.yml`.
# That workflow (`../.github/workflows/secrets-sync.yml`) enables the Secret
# Manager API, creates the `notes-export-app-key` secret if absent, adds a
# version, disables the prior versions, and applies this accessor binding with
# the ids as TF_VARs. Creating the GitHub App itself stays manual only because
# GitHub offers no API to create an App or mint its key.
#
# Terraform owns ONLY the accessor binding and the gate's configuration. It does
# not create the secret and holds no key: a Terraform state file is not a place
# for a private key. The generalized pattern is
# `../llm/governance/patterns/secrets-management.md`.

# The gate runtime identity may read the one secret. Scoped to the secret, not
# the project: no secretmanager.admin, no project-level grant.
resource "google_secret_manager_secret_iam_member" "hub_gate_notes_export_key" {
  project   = var.project_id
  secret_id = "notes-export-app-key"
  role      = "roles/secretmanager.secretAccessor"
  member    = google_service_account.hub_gate.member
}

# The routing file has ONE source of truth: site/notes-routing.json, read here at
# plan time and passed to the gate as configuration. The gate never reads the
# repository, and the site never reads a copy.
locals {
  notes_routing_json = file("${path.module}/../site/notes-routing.json")
}
