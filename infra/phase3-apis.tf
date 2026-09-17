# Phase 3 API enablement (issue #24; design doc §8; roadmap §phase-3-private-area).
#
# Phase 1 enabled eight APIs (main.tf) and Phase 2 added Cloud Storage
# (storage.tf). Phase 3's resources need five more, and each is listed with the
# resource that needs it, so a reader can tell why every one is on.
#
# A separate google_project_service resource per phase, rather than more keys in
# local.services, so the resource name does not misdescribe what it enables --
# the same choice storage.tf made for Phase 2.
#
# NOT enabled here, deliberately:
# - cloudbuild.googleapis.com: the gate image is built by GitHub Actions and
#   pushed to Artifact Registry (gate.yml, the gate stream). Nothing in this
#   project builds from source, and Cloud Build would add a second build path
#   and a second identity to reason about.
# - secretmanager.googleapis.com: nothing in this design holds a secret. The
#   gate runs as a service account on Cloud Run and reads no credential
#   (§12.2, ADR-0007 decision 3). If a change appears to need Secret Manager,
#   that is a signal to stop, not an API to enable.
# - logging/monitoring: Cloud Run captures a container's stdout and stderr
#   without the revision's service account holding any logging role, so nothing
#   here needs the Logging API enabled explicitly or a logWriter grant.

locals {
  phase3_services = {
    # Cloud Run service hub-gate (gate.tf), its IAM policy and its revisions.
    "run.googleapis.com" = "the hub-gate Cloud Run service"
    # The Docker repository that holds the gate image (registry.tf).
    "artifactregistry.googleapis.com" = "the gate image repository"
    # google_firestore_database (firestore.tf): the member allowlist.
    "firestore.googleapis.com" = "the Firestore database holding members/{email}"
    # google_identity_platform_config (identity-platform.tf). This is also the
    # API the gate calls to mint a session cookie: the Admin SDK's
    # createSessionCookie is Identity Toolkit's
    # SessionManagementService.CreateSessionCookie.
    "identitytoolkit.googleapis.com" = "Identity Platform sign-in config, and session-cookie minting by the gate"
    # google_firebaserules_ruleset / _release (firestore.tf): the deny-all
    # Firestore ruleset that keeps every client SDK out of members/{email}.
    "firebaserules.googleapis.com" = "the deny-all Firestore security rules"
  }
}

resource "google_project_service" "phase3" {
  provider = google.no_user_project_override
  for_each = local.phase3_services

  project = var.project_id
  service = each.key

  # Same reasoning as phase1 and phase2: leave APIs on if this module is
  # destroyed. Disabling cascades, and later phases plus anything the owner
  # enabled by hand may depend on them.
  disable_on_destroy         = false
  disable_dependent_services = false
}
