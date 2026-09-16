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

# ---------------------------------------------------------------------------
# Phase 2 (issue #16): the content bucket and the satellites that publish to it.
# ---------------------------------------------------------------------------

variable "content_bucket_name" {
  description = "Name of the content bucket satellites publish to (SEAM-2). Null means <project_id>-content. Bucket names are globally unique across all of Cloud Storage, so this is a variable rather than a literal; override only if the default stem is already taken."
  type        = string
  default     = null

  validation {
    # Cloud Storage bucket naming: 3-63 characters, lowercase letters, digits,
    # hyphens, underscores and dots, starting and ending alphanumeric. Names
    # containing a dot have extra rules (domain verification), so they are
    # rejected here rather than half-supported.
    condition     = var.content_bucket_name == null || can(regex("^[a-z0-9][a-z0-9_-]{1,61}[a-z0-9]$", var.content_bucket_name))
    error_message = "content_bucket_name must be 3-63 characters of lowercase letters, digits, hyphens or underscores, starting and ending with a letter or digit, and must not contain a dot."
  }

  validation {
    condition     = var.content_bucket_name == null || !can(regex("^goog|google", coalesce(var.content_bucket_name, "x")))
    error_message = "content_bucket_name must not begin with \"goog\" or contain \"google\": Cloud Storage reserves those names."
  }
}

# The satellites that may publish, keyed by SOURCE NAME. The key is the same
# string in three places: the manifest's "source" field, the bucket prefix
# sources/<source>/, and the IAM condition bound to that prefix (SEAM-2,
# SEAM-3). Adding a satellite in a later phase is one entry here.
#
# The two numeric IDs per satellite are public values read from the GitHub REST
# API (GET /repos/<owner>/<name> -> .id and .owner.id). Google recommends
# binding to them because a name can be re-registered by someone else after a
# rename or deletion, while the numeric IDs cannot be reused (see wif.tf).
#
# default_branch is the ONLY ref whose runs may publish. For cv that is master,
# not main: cv is a public repository whose default branch is master (ADR-0008
# decision 6, correcting design doc §2).
#
# Phase 3 adds phd-milestones here and nowhere else (roadmap "Not in this
# phase" keeps it out of Phase 2).
variable "satellites" {
  description = "Satellite repositories allowed to publish to the content bucket, keyed by source name. Each gets a keyless service account, its own WIF provider in the satellites pool, and a write grant restricted to gs://<content bucket>/sources/<key>/."
  type = map(object({
    repository          = string # owner/name, matched by the provider condition
    repository_id       = string # immutable numeric repository ID
    repository_owner_id = string # immutable numeric owner ID
    default_branch      = string # the only branch whose runs may publish
  }))

  default = {
    cv = {
      repository          = "djjay0131/cv"
      repository_id       = "1211056144"
      repository_owner_id = "5666389"
      default_branch      = "master"
    }
  }

  validation {
    # SEAM-2: <source> matches ^[a-z][a-z0-9-]{0,38}$ and equals the manifest's
    # source. The bucket prefix and the IAM condition are built from this key.
    condition     = alltrue([for source in keys(var.satellites) : can(regex("^[a-z][a-z0-9-]{0,38}$", source))])
    error_message = "Each satellite key is a source name: a lowercase letter followed by up to 38 lowercase letters, digits or hyphens (SEAM-2)."
  }

  validation {
    # The service account is named publish-<source>. A service account ID is
    # 6-30 characters, so the source name may be at most 22.
    condition     = alltrue([for source in keys(var.satellites) : length(source) <= 22])
    error_message = "A satellite key must be at most 22 characters: the service account is named publish-<key> and a service account ID is limited to 30 characters."
  }

  validation {
    # The WIF provider is named github-<source>. A provider ID is 4-32
    # characters, so the source name may be at most 25 -- less binding than the
    # service-account limit above, but checked so a rename cannot slip past.
    condition     = alltrue([for source in keys(var.satellites) : length(source) <= 25])
    error_message = "A satellite key must be at most 25 characters: the workload identity provider is named github-<key> and a provider ID is limited to 32 characters."
  }

  validation {
    condition     = alltrue([for satellite in values(var.satellites) : can(regex("^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$", satellite.repository))])
    error_message = "Each satellite's repository must be in owner/name form, for example djjay0131/cv."
  }

  validation {
    condition     = alltrue([for satellite in values(var.satellites) : can(regex("^[0-9]+$", satellite.repository_id)) && can(regex("^[0-9]+$", satellite.repository_owner_id))])
    error_message = "Each satellite's repository_id and repository_owner_id must be the numeric IDs from the GitHub API, not names."
  }

  validation {
    # The branch name is interpolated into a principalSet member as
    # refs/heads/<default_branch>. A leading refs/heads/, a wildcard or a space
    # would silently produce a binding that admits nothing.
    condition     = alltrue([for satellite in values(var.satellites) : can(regex("^[A-Za-z0-9._/-]+$", satellite.default_branch)) && !startswith(satellite.default_branch, "refs/")])
    error_message = "Each satellite's default_branch is a bare branch name such as master or main: no refs/heads/ prefix, no wildcards and no spaces."
  }
}
