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
