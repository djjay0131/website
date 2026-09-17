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
#   roles"). It is the narrowest predefined role holding those permissions.
#
# roles/serviceusage.apiKeysViewer (project), "API Keys Viewer". Read-only.
#   Firebase: a member deploying with the Firebase CLI "must also be assigned the
#   API Keys Viewer role" (firebase.google.com/docs/projects/iam/
#   roles-predefined-product). Granted so the first deploy follows the documented
#   path, although firebase-tools 15.30.1 was not seen to call the API Keys API on
#   the hosting path. Phase 1 creates no API keys. The owner may reverse this at
#   Checkpoint 2.
#
# These two roles are the narrowest SUPPORTED grant. A custom role is not an
# option: "Custom roles cannot currently be used for controlling access to
# Firebase Hosting resources" (firebase.google.com/docs/projects/iam/permissions).
#
# Deliberately NOT granted:
# - roles/run.viewer AT PROJECT LEVEL. Phase 3 added the Hosting rewrites this note
#   said Phase 1 did not have, and deploying a config with a `run` rewrite requires
#   run.services.get on the target service: Hosting resolves the service while
#   writing the version, and without it the deploy fails with
#   "HTTP Error: 403, Permission 'run.services.get' denied on resource
#   namespaces/<project number>/services/hub-gate". That is exactly what happened
#   at Checkpoint 4. The grant is therefore made, but SERVICE-SCOPED on hub-gate
#   (see gate.tf), not project-wide: Hosting needs to read one service, not every
#   service the project will ever run.
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

resource "google_project_iam_member" "hub_deploy_api_keys_viewer" {
  project = var.project_id
  role    = "roles/serviceusage.apiKeysViewer"
  member  = google_service_account.hub_deploy.member
}

# Lets GitHub Actions runs on main of this repository -- and nothing else --
# mint short-lived tokens as the deploy service account.
resource "google_service_account_iam_member" "hub_deploy_wif_main" {
  service_account_id = google_service_account.hub_deploy.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository_id_ref/${var.github_repository_id}/${local.deploy_ref}"
}
