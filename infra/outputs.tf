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

output "custom_domain_dns_records" {
  description = "DNS records Hosting needs for the custom domain (desired state). Values are computed by Hosting and can lag apply: run `terraform apply -refresh-only` and read this output again if it is empty."
  value = [
    for record in flatten([
      for update in try(google_firebase_hosting_custom_domain.primary.required_dns_updates, []) : [
        for desired in try(update.desired, []) : try(desired.records, [])
      ]
      ]) : {
      domain_name     = record.domain_name
      type            = record.type
      rdata           = record.rdata
      required_action = record.required_action
    }
  ]
}

output "custom_domain_state" {
  description = "Ownership, host and certificate state of the custom domain; all ACTIVE means cusati.us serves the site over HTTPS."
  value = {
    ownership_state = google_firebase_hosting_custom_domain.primary.ownership_state
    host_state      = google_firebase_hosting_custom_domain.primary.host_state
    cert_state      = try(google_firebase_hosting_custom_domain.primary.cert[0].state, null)
  }
}
