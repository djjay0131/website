# Firestore in Native mode (design doc §6 responsibility 2, §8; ADR-0004
# decision 3; SEAM-3).
#
# One database, holding one collection that matters: members/{email}, whose
# document id is the member's LOWERCASED email and whose fields are
# {added_by, added_at, note, role}. The gate reads it on every request to decide
# whether a verified sign-in is a member (SEAM-3). Seeding it is the owner's
# step at Checkpoint 4, not Terraform's: this module creates the database, never
# its contents, so no real email address is written into this repository.
#
# THE LOCATION IS PERMANENT. "Be aware that once you provision a database
# instance, you cannot change its location setting" (Firestore, "Firestore
# locations"). Moving later means creating a second database and migrating, so
# this is an ADR candidate flagged in the handoff rather than a default chosen in
# passing. var.firestore_location defaults to us-east1 because:
#   - design doc §8 fixes the project's region as us-east1, and the gate runs
#     there; a same-region read is the fastest and cheapest path for a lookup
#     that happens on EVERY private request;
#   - a multi-region (nam5) would buy availability this system does not need for
#     an allowlist of two documents, at a higher write cost;
#   - it matches both buckets, so there is one region to reason about.
#
# Native mode, not Datastore mode: §8 and ADR-0004 decision 3 both say Native,
# and the Firebase Admin SDK the gate uses speaks Native.
#
# THE DATABASE IS NAMED "(default)". Firestore's default database is literally
# named "(default)", and the Admin SDK connects to it unless told otherwise. A
# named database would work but would require the gate to pass a database id
# everywhere, for no gain.
#
# Deliberately NOT set:
# - point_in_time_recovery_enablement: PITR retains versions for 7 days at extra
#   storage cost. The allowlist is two documents and is re-seedable from the
#   seed script, which §12.5 requires anyway ("Owner can rebuild from the repo").
#   Backup for a two-row table is the script, not a feature.
# - concurrency_mode / app_engine_integration_mode: left at their defaults. There
#   is no App Engine app in this project, and nothing here does multi-document
#   transactions under contention.
# - database_edition: STANDARD, the default. Enterprise is a MongoDB-compatible
#   edition this design has no use for.
# - cmek_config: Google-managed encryption. A KMS key is a key to rotate and pay
#   for, and the sensitive data here is two email addresses that the owner
#   already holds.

resource "google_firestore_database" "hub" {
  project = var.project_id

  name        = "(default)"
  location_id = var.firestore_location
  type        = "FIRESTORE_NATIVE"

  # The allowlist IS the access-control list for private material. Deleting the
  # database deletes the answer to "who may read this", so deletion is made to
  # fail rather than to happen quietly.
  #
  # Two settings, and they are not the same thing:
  # - delete_protection_state guards the DATABASE at the API: "When delete
  #   protection is enabled, this database cannot be deleted."
  # - deletion_policy guards TERRAFORM's behaviour. "ABANDON" (the provider
  #   default, stated for the record) means a `terraform destroy` removes the
  #   resource from state without deleting the database. The provider notes the
  #   two interact: "to delete this database using 'terraform destroy',
  #   'deletion_policy' must be set to 'DELETE'" -- and delete protection must be
  #   turned off first. Retiring it is therefore a deliberate, reviewed,
  #   two-step change, which is the intent.
  delete_protection_state = "DELETE_PROTECTION_ENABLED"
  deletion_policy         = "ABANDON"

  depends_on = [google_project_service.phase3]
}

# ---------------------------------------------------------------------------
# DENY-ALL SECURITY RULES. The piece that is easy to omit and expensive to omit.
#
# The gate reaches Firestore through the Admin SDK, which authenticates as a
# service account and BYPASSES security rules entirely. Rules therefore do not
# constrain the gate at all -- they constrain everyone else.
#
# Who else is there? The sign-in page (site stream, D6) loads the Firebase Web
# SDK on a PUBLIC page, and that SDK can talk to Firestore directly from a
# browser using the project's public API key. What stops a signed-in
# non-member -- or any signed-in stranger -- from reading members/{email}
# straight out of the browser console is the ruleset, and nothing else.
#
# members/{email} is a list of real people's email addresses (STATE §10 Q4). A
# default-permissive or absent ruleset would make the allowlist itself readable
# by anyone who can sign in, which is a personal-data leak that no part of the
# gate's code would notice.
#
# So: one ruleset that denies every client read and write, released to
# cloud.firestore. The gate is unaffected. The site's sign-in page never needs
# Firestore access -- it obtains an ID token and POSTs it to /session (SEAM-2).
#
# If a later phase needs client-side Firestore access (shares, Phase 4), that is
# a deliberate rules change with its own review, not an accident of omission.
# ---------------------------------------------------------------------------
resource "google_firebaserules_ruleset" "firestore_deny_all" {
  project = var.project_id

  source {
    # FIREBASE_RULES is the default language; stated so the block is readable
    # without knowing the default.
    language = "FIREBASE_RULES"

    files {
      name = "firestore.rules"

      # rules_version '2' is the current syntax. The match on {document=**}
      # covers every path in the database, including members/{email} and any
      # collection a later phase adds -- a new collection is denied until
      # someone deliberately allows it, which is the right default for a
      # database whose contents decide who reads private material.
      content = <<-EOT
        rules_version = '2';
        service cloud.firestore {
          match /databases/{database}/documents {
            // No client SDK may read or write anything, ever. The gate uses the
            // Firebase Admin SDK, which bypasses these rules; every other
            // caller -- including a signed-in non-member with the public API
            // key -- is refused here. See infra/firestore.tf for why.
            match /{document=**} {
              allow read, write: if false;
            }
          }
        }
      EOT
    }
  }

  depends_on = [google_project_service.phase3]
}

# The release is what makes a ruleset take effect. A ruleset that is created but
# never released governs nothing -- which would look, in a plan, exactly like
# this working.
#
# The name is fixed by the API: "Firestore Rules Releases will **always** have
# the name 'cloud.firestore'" (provider docs).
#
# basename() on the ruleset's name is deliberate. The provider documents the
# attribute as "Format: projects/{project_id}/rulesets/{ruleset_id}" while its
# own example interpolates it into "projects/<project>/rulesets/${...name}",
# which would double the prefix if the attribute were already qualified.
# basename() takes the last path segment either way, so this line is correct
# under both readings instead of betting on one. Checkpoint 4 confirms the
# release points at this ruleset.
resource "google_firebaserules_release" "firestore" {
  project = var.project_id

  name         = "cloud.firestore"
  ruleset_name = "projects/${var.project_id}/rulesets/${basename(google_firebaserules_ruleset.firestore_deny_all.name)}"

  depends_on = [google_firestore_database.hub]
}
