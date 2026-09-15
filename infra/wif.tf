# Workload Identity Federation for GitHub Actions (design doc §8, §12.2).
#
# No service-account key exists anywhere: GitHub's OIDC token is exchanged for a
# short-lived Google token, which impersonates the deploy service account.
#
# Admission is decided twice:
#
# 1. The provider's attribute_condition admits a token only if it comes from this
#    repository, matched on its immutable numeric repository_id and
#    repository_owner_id AND its name. Google: "Using 'name' fields like
#    repository and repository_owner increases the chances of cybersquatting and
#    typosquatting attacks ... use the numeric *_id fields instead, which are
#    unique and can't be reused" (Configure Workload Identity Federation with
#    deployment pipelines, GitHub Actions section). The name is kept as well so a
#    transferred or renamed repository stops authenticating until this module is
#    reviewed. pull_request_target runs are refused outright: they execute with
#    the base branch's ref (refs/heads/main) while handling pull-request input.
#
# 2. The deploy binding on the service account admits only principals whose
#    repository_id/ref attribute is "<repository_id>/refs/heads/main". Pull
#    request runs carry refs/pull/<n>/merge and branch runs carry their own ref,
#    so neither can deploy. The attribute joins the repository ID to the ref so
#    that a future provider in the same pool (Phase 2 satellites) can never
#    satisfy this binding with its own main branch.

locals {
  github_oidc_issuer = "https://token.actions.githubusercontent.com"
  deploy_ref         = "refs/heads/main"
}

resource "google_iam_workload_identity_pool" "github" {
  project                   = var.project_id
  workload_identity_pool_id = "github-actions"
  display_name              = "GitHub Actions"
  description               = "GitHub Actions OIDC identities for the research hub and, from Phase 2, its satellites."

  depends_on = [google_project_service.phase1]
}

resource "google_iam_workload_identity_pool_provider" "website" {
  project                            = var.project_id
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "website"
  display_name                       = "GitHub: website"
  description                        = "OIDC tokens from ${var.github_repository} only."

  attribute_mapping = {
    "google.subject"                = "assertion.sub"
    "attribute.repository"          = "assertion.repository"
    "attribute.repository_id"       = "assertion.repository_id"
    "attribute.repository_owner_id" = "assertion.repository_owner_id"
    "attribute.ref"                 = "assertion.ref"
    "attribute.repository_id_ref"   = "assertion.repository_id + '/' + assertion.ref"
  }

  attribute_condition = join(" && ", [
    "assertion.repository_id == '${var.github_repository_id}'",
    "assertion.repository_owner_id == '${var.github_repository_owner_id}'",
    "assertion.repository == '${var.github_repository}'",
    "assertion.event_name != 'pull_request_target'",
  ])

  oidc {
    issuer_uri = local.github_oidc_issuer
  }
}
