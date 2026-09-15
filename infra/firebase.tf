# Firebase and Hosting (design doc §8: "Hosting is not fully Terraformable").
#
# Terraformed here, each a google-beta resource:
# - google_firebase_project: adds Firebase to the existing project.
# - google_firebase_hosting_site: the default Hosting site (site_id = project id,
#   the provider docs' "Firebasehosting Site Default" example).
# - google_firebase_hosting_custom_domain: binds var.domain to that site and
#   exposes the DNS records Hosting needs (required_dns_updates).
#
# Not Terraformed (manual steps in README.md): creating the project, linking
# billing (Blaze), adding DNS records at the registrar, and deploying content --
# the site's files are uploaded by firebase-tools in build.yml, not by Terraform.

resource "google_firebase_project" "hub" {
  provider = google-beta
  project  = var.project_id

  # "Once Firebase has been added to a Google Project it cannot be removed"
  # (provider docs). google-beta 8.2.0 offers no deletion_policy on this
  # resource, so a destroy removes it from state only.

  depends_on = [google_project_service.phase1]
}

resource "google_firebase_hosting_site" "default" {
  provider = google-beta
  project  = google_firebase_project.hub.project
  site_id  = local.hosting_site_id

  # The default site cannot be deleted while the project exists; forget it on
  # destroy rather than fail.
  deletion_policy = "ABANDON"

  lifecycle {
    # firebase.json names no site, so firebase-tools deploys to the project's
    # default site. If the site Terraform created or adopted is not typed
    # DEFAULT_SITE, fail the apply here rather than the first deploy.
    postcondition {
      condition     = self.type == "DEFAULT_SITE"
      error_message = "google_firebase_hosting_site.default (site ${self.site_id}) has type ${coalesce(self.type, "<unset>")}, not DEFAULT_SITE. firebase deploy needs the project's default Hosting site because firebase.json names no site. Find the project's default site in the Firebase console (Hosting) and set hosting_site_id to its ID."
    }
  }
}

resource "google_firebase_hosting_custom_domain" "primary" {
  provider      = google-beta
  project       = google_firebase_project.hub.project
  site_id       = google_firebase_hosting_site.default.site_id
  custom_domain = var.domain

  # Do not block apply on DNS: the records are added at the registrar after
  # apply, from the custom_domain_dns_records output.
  wait_dns_verification = false
}
