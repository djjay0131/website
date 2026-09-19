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

# ---------------------------------------------------------------------------
# Phase 3 (issue #24): the private area.
#
# As in Phase 2, none of these values is secret and every one is set as a GitHub
# Actions VARIABLE, never a secret. They are consumed by two different workflows
# in THIS repository:
#   - build.yml (site stream): GCP_PRIVATE_BUCKET, for the destructive sync of
#     site/dist-private (ADR-0010 decision 5).
#   - gate.yml (gate stream):  the Artifact Registry, Cloud Run and gate-deploy
#     values.
# ---------------------------------------------------------------------------

output "private_bucket_name" {
  description = "GCP_PRIVATE_BUCKET: the bucket the gate serves from and the hub syncs site/dist-private into (SEAM-1). Never public, never fronted by Hosting."
  value       = google_storage_bucket.private.name
}

output "private_bucket_url" {
  description = "The private bucket as a gs:// URL, for the manual verification steps in README.md."
  value       = google_storage_bucket.private.url
}

output "auditor_service_account_email" {
  description = "GCP_AUDITOR_SA: the read-only identity the private-bucket-live-iam job in build.yml authenticates as (issue #58). Set this GitHub Actions variable on this repository as soon as this module is applied -- the job FAILS rather than skipping while it is unset, deliberately. It holds no storage.objects.* permission and cannot read a private object."
  value       = google_service_account.hub_auditor.email
}

output "gate_service_account_email" {
  description = "The gate's RUNTIME identity: the only principal that reads a private object to serve it. Not a deploy identity."
  value       = google_service_account.hub_gate.email
}

output "gate_deploy_service_account_email" {
  description = "GCP_GATE_DEPLOY_SA: what .github/workflows/gate.yml authenticates as through WIF. Pushes the image and rolls out a revision; cannot read private content."
  value       = google_service_account.gate_deploy.email
}

output "gate_service_name" {
  description = "The Cloud Run service name. firebase.json's /p/** and /session rewrites must name exactly this (design doc §8); Hosting rejects a config naming a service that does not exist (issue #10 K2), so the rewrites land only after the gate is deployed (SEAM-6)."
  value       = google_cloud_run_v2_service.gate.name
}

output "gate_service_uri" {
  description = "The gate's direct *.run.app URL. Its invoker is allUsers deliberately (ADR-0004), so every authorisation check must hold on THIS URL as well as through Hosting -- which is a roadmap acceptance criterion, not a footnote."
  value       = google_cloud_run_v2_service.gate.uri
}

output "gate_allowed_origins" {
  description = "The exact string rendered into the gate's GATE_ALLOWED_ORIGINS environment variable (issue #54). The gate builds its CSRF accepted-origin set from this at startup and has no header fallback, so if it is wrong, sign-out refuses every request. Compare it against the set the running revision prints in its boot line -- see gate_allowed_origins_check_command."
  value       = local.gate_allowed_origins
}

output "gate_allowed_origins_check_command" {
  description = "Post-apply verification for the CSRF origin set, in three parts: the URL Cloud Run actually serves (which may use the older <service>-<hash>-<regioncode>.a.run.app spelling rather than the project-number form this module constructs), the accepted set the running revision parsed at boot, and any misconfiguration line. The first two must agree; allowed_origins=none means the variable never reached the revision. Add a missing spelling with var.gate_extra_allowed_origins."
  value = join(" ; ", [
    "gcloud run services describe ${google_cloud_run_v2_service.gate.name} --project ${var.project_id} --region ${var.region} --format 'value(status.url)'",
    "gcloud logging read 'resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"${google_cloud_run_v2_service.gate.name}\" AND textPayload:\"event=boot\"' --project ${var.project_id} --limit 1 --freshness=1h --format='value(textPayload)'",
    "gcloud logging read 'resource.type=\"cloud_run_revision\" AND textPayload:\"event=misconfigured\"' --project ${var.project_id} --freshness=1h --limit=5",
  ])
}

output "gate_image_repository" {
  description = "GCP_ARTIFACT_REGISTRY: the Docker repository path to push the gate image to, without a tag. Keeps the 5 most recent versions (roadmap R-A4)."
  value       = "${google_artifact_registry_repository.gate.location}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.gate.repository_id}"
}

output "firestore_database" {
  description = "The Firestore database holding members/{email}. Its location is PERMANENT and cannot be changed after creation."
  value = {
    name     = google_firestore_database.hub.name
    location = google_firestore_database.hub.location_id
    type     = google_firestore_database.hub.type
  }
}

output "private_bucket_roles" {
  description = "The two custom roles bound on the private bucket, for the Checkpoint 4 checks. The gate holds exactly storage.objects.get; the hub's deploy identity holds create/delete/get/list, which ADR-0010 decision 5 requires for a destructive sync. Read them back with: gcloud iam roles describe <role id> --project <project id>."
  value = {
    gate_reader = google_project_iam_custom_role.private_object_reader.name
    hub_sync    = google_project_iam_custom_role.private_sync_writer.name
  }
}

output "gate_github_actions_variables" {
  description = "The Phase 3 variables to set on THIS repository (djjay0131/website), alongside the Phase 1 and 2 ones in github_actions_variables. GCP_WIF_PROVIDER is unchanged -- the gate workflow uses the hub's existing provider with a different service account."
  value = {
    GCP_PRIVATE_BUCKET    = google_storage_bucket.private.name
    GCP_GATE_DEPLOY_SA    = google_service_account.gate_deploy.email
    GCP_GATE_SERVICE      = google_cloud_run_v2_service.gate.name
    GCP_GATE_REGION       = google_cloud_run_v2_service.gate.location
    GCP_ARTIFACT_REGISTRY = "${google_artifact_registry_repository.gate.location}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.gate.repository_id}"
  }
}

output "private_bucket_iam_check_command" {
  description = "The live half of the roadmap's bucket IAM test (§12.1), ready to paste for an owner-run check. It ALSO runs automatically, hourly and on every push to main, in build.yml's private-bucket-live-iam job as the read-only auditor (issue #58) -- this command is for running it by hand, not the only place it runs. The credential-free half runs on every push and pull request in the budget-guard job (a required check): python3 infra/scripts/check_private_bucket_config.py."
  value       = "PROJECT=${var.project_id} BUCKET=${google_storage_bucket.private.name} GATE_SA=${google_service_account.hub_gate.email} HUB_SA=${google_service_account.hub_deploy.email} bash infra/scripts/check-private-bucket-iam.sh"
}

output "gate_session_minter_role_id" {
  description = "The custom role the gate holds instead of roles/firebaseauth.admin (N-1): exactly firebaseauth.users.createSession and firebaseauth.users.get. Read it back after apply with: gcloud iam roles describe gateSessionMinter --project <project id>."
  value       = google_project_iam_custom_role.gate_session_minter.name
}

output "gate_auth_role_check_command" {
  description = "Post-apply verification for the narrowed Identity Platform grant. The first command must print exactly the two permissions; the second must print NO row for roles/firebaseauth.admin. Sign-in itself cannot be proven by either -- that needs the live email-link sign-in in the Checkpoint runbook."
  value       = "gcloud iam roles describe gateSessionMinter --project ${var.project_id} --format='value(includedPermissions)' && gcloud projects get-iam-policy ${var.project_id} --flatten='bindings[].members' --filter='bindings.members:${google_service_account.hub_gate.email}' --format='value(bindings.role)'"
}
