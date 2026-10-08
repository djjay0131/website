# Terraform and provider pins for the hub's cloud foundation (Phase 1).
#
# The google-beta provider is required as well as google: google_firebase_project,
# google_firebase_hosting_site and google_firebase_hosting_custom_domain are beta
# resources ("This resource is in beta, and should be used with the
# terraform-provider-google-beta provider" -- provider docs for each resource).
#
# .terraform.lock.hcl is committed; `terraform init` records the exact provider
# builds chosen inside these constraints.

terraform {
  required_version = ">= 1.14.0, < 2.0.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 8.2"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 8.2"
    }
  }

  # Remote state (D19, 2026-10-08). Owner decision D19 moves the last manual
  # step — the Secret Manager accessor binding for the notes-sync gate SA — onto
  # .github/workflows/secrets-sync.yml. A GitHub Actions runner has no local
  # state, so the state this repository already used must be reachable from CI:
  # the bootstrap bucket `cusati-hub-tfstate` (created once by the lead because a
  # backend bucket cannot be created by the state it stores). This is ADR
  # candidate C10, adopted here; the migration was `terraform init
  # -migrate-state`. Object versioning is on, uniform bucket-level access on,
  # public access prevention enforced, and only the gate deploy identity reads or
  # writes it (infra/gate.tf).
  backend "gcs" {
    bucket = "cusati-hub-tfstate"
    prefix = "infra"
  }
}
