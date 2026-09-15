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
  description = "The three SEAM-4 GitHub Actions variables, ready to set."
  value = {
    GCP_PROJECT_ID   = data.google_project.hub.project_id
    GCP_WIF_PROVIDER = google_iam_workload_identity_pool_provider.website.name
    GCP_DEPLOY_SA    = google_service_account.hub_deploy.email
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
