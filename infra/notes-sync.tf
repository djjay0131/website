# Wave 6 notes-sync (ADR-0022, D18): the gate commits annotations to a long-lived
# `notes` branch in each destination repository, through a GitHub App.
#
# TWO OWNER HARD STOPS gate this file's apply, and neither credential is created
# by Terraform:
#
#   1. The owner creates the GitHub App, installs it on EXACTLY
#      djjay0131/soa-agentic-se and djjay0131/agentic-kg-research with Contents:
#      Read and write only, and reports the App id and installation id (set as
#      var.notes_export_app_id / var.notes_export_installation_id).
#   2. The owner creates the secret and adds the private key version:
#        gcloud secrets create notes-export-app-key \
#          --project=cusati-hub --replication-policy=automatic
#        gcloud secrets versions add notes-export-app-key \
#          --project=cusati-hub --data-file=/path/to/app.private-key.pem
#
# Terraform owns ONLY the accessor binding and the gate's configuration. It does
# not create the secret and holds no key: a Terraform state file is not a place
# for a private key, and the owner explicitly creates the secret.

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
