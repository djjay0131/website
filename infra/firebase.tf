# Firebase and Hosting (design doc §8: "Hosting is not fully Terraformable").
#
# Terraformed here, each a google-beta resource:
# - google_firebase_project: adds Firebase to the existing project.
# - google_firebase_hosting_site: the default Hosting site (site_id = project id,
#   the provider docs' "Firebasehosting Site Default" example).
# - google_firebase_hosting_custom_domain.primary: binds var.domain, the
#   canonical hub host (jason.cusati.us, ADR-0006), to that site.
# - google_firebase_hosting_custom_domain.redirect: one per var.redirect_domains
#   (research.cusati.us), connected to the same site and answering every request
#   with a 301 to var.domain (redirect_target). Connected rather than a bare DNS
#   CNAME, because Hosting issues certificates only for hostnames connected to it.
# Each custom domain exposes the DNS records Hosting needs (required_dns_updates).
#
# Never bound here (ADR-0006): the apex cusati.us and www.cusati.us are reserved
# for a family site outside this project. No hub step adds, changes or removes
# the apex, www, MX or existing TXT records; variables.tf rejects the apex and
# www as hub hostnames.
#
# Not Terraformed (manual steps in README.md): creating the project, linking
# billing (Blaze), adding the hub hostnames' DNS records at the registrar, and
# deploying content -- the site's files are uploaded by firebase-tools in
# build.yml, not by Terraform.

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

# research.cusati.us (and any other redirect domain): connected to the same site,
# so Hosting provisions its certificate, and redirected with a 301 to the
# canonical host. Referencing the primary resource orders creation after it.
resource "google_firebase_hosting_custom_domain" "redirect" {
  provider = google-beta
  for_each = toset(var.redirect_domains)

  project         = google_firebase_project.hub.project
  site_id         = google_firebase_hosting_site.default.site_id
  custom_domain   = each.key
  redirect_target = google_firebase_hosting_custom_domain.primary.custom_domain

  wait_dns_verification = false
}
