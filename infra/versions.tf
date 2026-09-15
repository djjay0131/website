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

  # No backend block: Phase 1 uses local state, which infra/.gitignore keeps out
  # of the repository. The proposed remote backend is described in README.md
  # (§State) and recorded as an ADR candidate; adopting it is a later, reviewed
  # change followed by `terraform init -migrate-state`.
}
