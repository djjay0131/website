variable "project_id" {
  description = "ID of the existing GCP project the owner created for the hub (design doc §10 Q2; intended id cusati-hub). Terraform reads it; it never creates it."
  type        = string

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{4,28}[a-z0-9]$", var.project_id))
    error_message = "project_id must be a valid GCP project ID: 6-30 characters, lowercase letters, digits and hyphens, starting with a letter."
  }
}

variable "region" {
  description = "Default region for regional resources. Phase 1 creates no regional resource; this is the region later phases use (design doc §8)."
  type        = string
  default     = "us-east1"
}

variable "domain" {
  description = "Custom domain bound to the default Firebase Hosting site (design doc §10 Q1)."
  type        = string
  default     = "cusati.us"
}

variable "billing_account" {
  description = "Cloud Billing account ID that pays for the project, in the form XXXXXX-XXXXXX-XXXXXX. Used only to attach the $5 budget. Supply it in a git-ignored terraform.tfvars; never commit it."
  type        = string
  sensitive   = true

  validation {
    condition     = can(regex("^[0-9A-Fa-f]{6}-[0-9A-Fa-f]{6}-[0-9A-Fa-f]{6}$", var.billing_account))
    error_message = "billing_account must look like XXXXXX-XXXXXX-XXXXXX (hexadecimal groups)."
  }
}

variable "github_repository" {
  description = "The one GitHub repository (owner/name) allowed to authenticate through the Workload Identity provider."
  type        = string
  default     = "djjay0131/website"
}

# The two immutable IDs below are public values, read from the GitHub REST API
# (GET /repos/djjay0131/website -> .id and .owner.id). They are variables, not
# literals, so the module can be pointed at a fork or a re-created repository
# without editing code. Google recommends binding to them because names can be
# re-registered by someone else after a rename or deletion; the numeric IDs
# cannot be reused.
variable "github_repository_id" {
  description = "Immutable numeric ID of github_repository (the OIDC token's repository_id claim)."
  type        = string
  default     = "1212933399"

  validation {
    condition     = can(regex("^[0-9]+$", var.github_repository_id))
    error_message = "github_repository_id must be the numeric repository ID."
  }
}

variable "github_repository_owner_id" {
  description = "Immutable numeric ID of the owner of github_repository (the OIDC token's repository_owner_id claim)."
  type        = string
  default     = "5666389"

  validation {
    condition     = can(regex("^[0-9]+$", var.github_repository_owner_id))
    error_message = "github_repository_owner_id must be the numeric owner ID."
  }
}

variable "hosting_site_id" {
  description = "ID of the default Firebase Hosting site. Null means the project ID, which is what Firebase uses for a project's default site. Site IDs are globally unique; override only if the project ID is already taken as a site ID."
  type        = string
  default     = null
}
