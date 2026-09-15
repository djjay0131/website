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

# Hub hostnames (ADR-0006). The apex cusati.us and www.cusati.us are reserved for
# a family site outside this project, and the zone's apex carries Google
# Workspace mail. The validations below keep both out of the hub's Terraform.
variable "domain" {
  description = "The canonical hub host, bound to the default Firebase Hosting site (ADR-0006: jason.cusati.us). Never the apex cusati.us or www.cusati.us, which are reserved for a family site."
  type        = string
  default     = "jason.cusati.us"

  validation {
    condition     = !contains(["cusati.us", "www.cusati.us"], lower(trimsuffix(var.domain, ".")))
    error_message = "domain must not be cusati.us or www.cusati.us: the apex and www are reserved for a family site (ADR-0006)."
  }
}

variable "redirect_domains" {
  description = "Hostnames connected to the same Hosting site that answer with a 301 redirect to var.domain (ADR-0006: research.cusati.us). Connected rather than a bare CNAME, because Hosting issues certificates only for connected hostnames. Never the apex or www."
  type        = list(string)
  default     = ["research.cusati.us"]

  validation {
    condition     = !contains([for d in var.redirect_domains : lower(trimsuffix(d, "."))], lower(trimsuffix(var.domain, ".")))
    error_message = "redirect_domains must not contain var.domain: the canonical host cannot redirect to itself."
  }

  validation {
    condition     = alltrue([for d in var.redirect_domains : !contains(["cusati.us", "www.cusati.us"], lower(trimsuffix(d, ".")))])
    error_message = "redirect_domains must not contain cusati.us or www.cusati.us: the apex and www are reserved for a family site (ADR-0006)."
  }

  validation {
    condition     = length(distinct(var.redirect_domains)) == length(var.redirect_domains)
    error_message = "redirect_domains must not list a hostname twice."
  }
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
