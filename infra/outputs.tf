# SEAM-4 values. Set each as a GitHub Actions *variable* (not a secret -- none
# of them is secret) with the same name as the key in github_actions_variables.

output "project_id" {
  description = "GCP_PROJECT_ID."
  value       = data.google_project.hub.project_id
}

output "project_number" {
  description = "Numeric project number (appears in the WIF provider name)."
  value       = data.google_project.hub.number
}

output "workload_identity_provider" {
  description = "GCP_WIF_PROVIDER: full resource name of the GitHub OIDC provider."
  value       = google_iam_workload_identity_pool_provider.website.name
}

output "deploy_service_account_email" {
  description = "GCP_DEPLOY_SA: the hub deploy service account."
  value       = google_service_account.hub_deploy.email
}

output "github_actions_variables" {
  description = "The GitHub Actions variables to set on THIS repository (djjay0131/website): the three Phase 1 deploy values plus GCP_CONTENT_BUCKET, which the site stream's sync and poll jobs read (Phase 2 SEAM-2)."
  value = {
    GCP_PROJECT_ID     = data.google_project.hub.project_id
    GCP_WIF_PROVIDER   = google_iam_workload_identity_pool_provider.website.name
    GCP_DEPLOY_SA      = google_service_account.hub_deploy.email
    GCP_CONTENT_BUCKET = google_storage_bucket.content.name
  }
}

output "hosting_default_url" {
  description = "Default Firebase Hosting URL. The Firebase smoke test uses https://<GCP_PROJECT_ID>.web.app when SITE_URL is unset; if this differs, set SITE_URL."
  value       = google_firebase_hosting_site.default.default_url
}

# Every hostname connected to the Hosting site, keyed by hostname: the canonical
# host (var.domain) and each redirect domain (ADR-0006).
locals {
  hosting_custom_domains = merge(
    { (var.domain) = google_firebase_hosting_custom_domain.primary },
    google_firebase_hosting_custom_domain.redirect,
  )
}

output "custom_domain_dns_records" {
  description = "DNS records to add (required_action ADD) or remove (REMOVE) at the registrar, for every hostname connected to the Hosting site, in Hosting's desired state. custom_domain is the connected hostname the record is for; domain_name is the DNS name to set it on. Change only these records: never the apex cusati.us, www.cusati.us, MX or existing TXT records (ADR-0006). Values are computed by Hosting and can lag apply: run `terraform apply -refresh-only` and read this output again if it is empty."
  value = flatten([
    for hostname, custom_domain in local.hosting_custom_domains : [
      for record in flatten([
        for update in try(custom_domain.required_dns_updates, []) : [
          for desired in try(update.desired, []) : try(desired.records, [])
        ]
        ]) : {
        custom_domain   = hostname
        domain_name     = record.domain_name
        type            = record.type
        rdata           = record.rdata
        required_action = record.required_action
      }
    ]
  ])
}

# ---------------------------------------------------------------------------
# Phase 2 (issue #16): the content bucket and the satellite publish identities.
#
# None of these values is secret. Every one is set as a GitHub Actions
# VARIABLE, never a secret: treating a public value as a secret only makes a
# failed run harder to read (docs/satellites.md says the same to satellite
# owners).
#
# They are set in TWO different repositories:
# - github_actions_variables        -> djjay0131/website (the hub)
# - satellite_github_actions_variables[<source>] -> that satellite's repository
#
# Note the collision of names across repositories: GCP_WIF_PROVIDER in the hub
# is the hub's provider in the github-actions pool, while GCP_WIF_PROVIDER in
# cv is cv's provider in the satellites pool. They are different values with
# the same variable name, in different repositories, on purpose -- the publish
# action's input is named workload_identity_provider whichever repository calls
# it (docs/satellites.md).
# ---------------------------------------------------------------------------

output "content_bucket_name" {
  description = "GCP_CONTENT_BUCKET: the content bucket satellites publish to and the hub syncs (SEAM-2). Set it in both repositories."
  value       = google_storage_bucket.content.name
}

output "content_bucket_url" {
  description = "The content bucket as a gs:// URL, for the manual verification steps in README.md."
  value       = google_storage_bucket.content.url
}

output "satellites_pool_name" {
  description = "Full resource name of the satellites Workload Identity pool, separate from the hub's github-actions pool (ADR-0007 decision 5)."
  value       = google_iam_workload_identity_pool.satellites.name
}

output "satellite_publish_role_id" {
  description = "The custom role bound to every satellite: exactly storage.objects.create, .delete and .get, and never .list. Read it back after apply with: gcloud iam roles describe satellitePublisher --project <project id>."
  value       = google_project_iam_custom_role.satellite_publisher.name
}

output "satellite_publish_service_accounts" {
  description = "GCP_PUBLISH_SA per satellite, keyed by source name."
  value       = { for source, account in google_service_account.satellite_publish : source => account.email }
}

output "satellite_workload_identity_providers" {
  description = "GCP_WIF_PROVIDER per satellite, keyed by source name: the full resource name of that satellite's provider in the satellites pool."
  value       = { for source, provider in google_iam_workload_identity_pool_provider.satellite : source => provider.name }
}

output "satellite_github_actions_variables" {
  description = "Everything a satellite's own repository needs, keyed by source name. Set each as a GitHub Actions variable in THAT repository (for cv: djjay0131/cv). The satellite needs no secret and no GitHub credential for this repository (ADR-0007 decision 2)."
  value = {
    for source, satellite in var.satellites : source => {
      GCP_PROJECT_ID     = data.google_project.hub.project_id
      GCP_WIF_PROVIDER   = google_iam_workload_identity_pool_provider.satellite[source].name
      GCP_PUBLISH_SA     = google_service_account.satellite_publish[source].email
      GCP_CONTENT_BUCKET = google_storage_bucket.content.name
    }
  }
}

output "satellite_prefixes" {
  description = "The one prefix each satellite may write, keyed by source name. These are the literal strings the IAM conditions match; the Checkpoint 3 boundary tests in the handoff use them."
  value       = { for source in keys(var.satellites) : source => "gs://${google_storage_bucket.content.name}/sources/${source}/" }
}

output "custom_domain_state" {
  description = "Per connected hostname: redirect_target (null for the canonical host) and its ownership, host and certificate state. All three ACTIVE for var.domain means the canonical host serves the site over HTTPS; for a redirect domain it means its 301 to var.domain is served over HTTPS."
  value = {
    for hostname, custom_domain in local.hosting_custom_domains : hostname => {
      redirect_target = custom_domain.redirect_target
      ownership_state = custom_domain.ownership_state
      host_state      = custom_domain.host_state
      cert_state      = try(custom_domain.cert[0].state, null)
    }
  }
}
