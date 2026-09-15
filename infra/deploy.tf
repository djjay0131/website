# The hub deploy identity (design doc §8: "one SA for hub deploy").
#
# Roles, and why each is needed -- and nothing else:
#
# roles/firebasehosting.admin (project), "Firebase Hosting Admin". Contains
#   firebase.projects.get, firebase.clients.get/list, firebasehosting.sites.*,
#   resourcemanager.projects.get/list. firebase-tools 15.30.1 needs:
#   - firebase.projects.get: the permission preflight every deploy runs
#     (lib/requirePermissions.js BASE_PERMISSIONS) and the default-site lookup
#     (lib/getDefaultHostingSite.js -> Firebase Management projects.get);
#   - firebasehosting.sites.list: the same lookup's fallback (listSites);
#   - firebasehosting.sites.update: the hosting target's declared permission
#     (lib/deploy/index.js TARGET_PERMISSIONS.hosting), which covers creating a
#     version, uploading files and creating the release.
#   Firebase documents this role for Hosting deploys ("Firebase predefined
#   roles"). It is the narrowest predefined role holding those permissions; a
#   custom role with only the four listed above is the tighter alternative
#   (handoff, Alternatives; ADR candidate).
#
# Deliberately NOT granted:
# - roles/serviceusage.apiKeysViewer: Firebase's docs list it for CLI deploys, but
#   in firebase-tools 15.30.1 the API Keys client (lib/gcp/apikeys.js) is imported
#   only by crashlytics/onboarding.js, never on the hosting deploy path. Add it
#   only if a real deploy reports a missing apikeys.* permission.
# - roles/run.viewer: needed only for Hosting rewrites to Cloud Run, which Phase 1
#   does not have (issue #10 K2).
# - roles/firebaseauth.admin: needed only for preview channels, which are not used.
# - roles/serviceusage.serviceUsageConsumer: needed only when a request names a
#   quota project; google-github-actions/auth v3.0.0 exports no
#   GOOGLE_CLOUD_QUOTA_PROJECT, so firebase-tools sends no x-goog-user-project.

resource "google_service_account" "hub_deploy" {
  project      = var.project_id
  account_id   = "hub-deploy"
  display_name = "Hub deploy (GitHub Actions)"
  description  = "Deploys the public site to Firebase Hosting from ${var.github_repository} main via Workload Identity Federation. Has no keys."

  depends_on = [google_project_service.phase1]
}

resource "google_project_iam_member" "hub_deploy_hosting_admin" {
  project = var.project_id
  role    = "roles/firebasehosting.admin"
  member  = google_service_account.hub_deploy.member
}

# Lets GitHub Actions runs on main of this repository -- and nothing else --
# mint short-lived tokens as the deploy service account.
resource "google_service_account_iam_member" "hub_deploy_wif_main" {
  service_account_id = google_service_account.hub_deploy.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository_id_ref/${var.github_repository_id}/${local.deploy_ref}"
}
