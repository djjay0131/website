# The private bucket (design doc §8, §11; ADR-0004 decision 4; ADR-0010
# decision 5; SEAM-1).
#
# This is where the private rendered output lives, and the only place it lives:
#
#   site/dist-private  --(destructive sync, hub-deploy)-->  gs://<private bucket>/
#                                                                   |
#                                                        streamed by the gate on /p/**
#                                                                   v
#                                                           signed-in member
#
# It is NEVER public and NEVER fronted by Firebase Hosting. Hosting serves
# site/dist-public only; nothing in firebase.json names this bucket. The only
# way a byte leaves it is the gate, which checks a session first (ADR-0004).
#
# THE SETTING THAT CARRIES THIS PHASE:
#
#   uniform_bucket_level_access = true. REQUIRED, and the single most dangerous
#   thing to turn off anywhere in this module. "To use conditions in the allow
#   policy for a Cloud Storage bucket, you must enable uniform bucket-level
#   access on the bucket" (IAM, "Overview of IAM Conditions"). Two things follow:
#     - Any conditioned binding on a bucket without it stops constraining
#       anything, silently. Nothing errors, nothing looks different, and the
#       grant quietly widens to the whole bucket. This was verified live at
#       Checkpoint 3 on the content bucket and it is the invariant the whole
#       satellite boundary rests on.
#     - It disables object ACLs. Without it, a single object ACL could make one
#       private object readable by allUsers with no IAM change anywhere -- the
#       exact leak this phase exists to prevent, invisible to every IAM check.
#   Neither binding below is conditioned today, but the setting is not
#   contingent on that: it is what makes the bucket's access story IAM-only.
#
# The other three, each required rather than preferred:
#
# - public_access_prevention = "enforced". The bucket is never public. This is
#   also half of the roadmap's bucket IAM test, which fails the deploy if the
#   private bucket grants public access (§12.1).
# - versioning. The private sync DELETES objects the current build did not
#   produce (ADR-0010 decision 5), and ADR-0010's own Risks name that as the one
#   place in this system where a build defect can remove data. Versioning is the
#   recovery path for exactly that.
# - force_destroy = false (the provider default, stated for the record).
#   Destroying a bucket that still holds objects fails instead of deleting the
#   private area.
#
# Regional (var.region, us-east1), Standard class: the gate reads these objects
# on every member request, so there is no cold data here, and us-east1 is one of
# the three regions the Cloud Storage Always Free allowance covers (Cloud Storage
# pricing, "Cloud Storage Always Free usage limits": US-WEST1, US-CENTRAL1 and
# US-EAST1). It is also the gate's own region, so a read is in-region.
#
# Deliberately NOT set, with the same reasoning as the content bucket:
# - hierarchical_namespace: it changes object naming semantics and is billed at
#   higher Class A rates. A flat namespace is also what makes a prefix condition
#   safe, should one ever be added here.
# - a bucket retention_policy: it would block the destructive sync, which must
#   be able to delete a withdrawn item.
# - a CORS policy: nothing reads this bucket from a browser. The gate streams
#   the bytes; the browser never talks to Cloud Storage.
# - deletion_policy: left at its "DELETE" default; force_destroy = false is the
#   guard that matters, and it makes a non-empty bucket undestroyable.

locals {
  # Bucket names are globally unique across all of Cloud Storage, so the name is
  # a variable with the project id as its default stem rather than a literal --
  # the same shape as content_bucket_name.
  private_bucket_name = coalesce(var.private_bucket_name, "${var.project_id}-private")
}

resource "google_storage_bucket" "private" {
  project = var.project_id
  name    = local.private_bucket_name

  # GCS stores locations upper-cased; upper() keeps plan and state stable
  # whatever case var.region carries.
  location      = upper(var.region)
  storage_class = "STANDARD"

  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  force_destroy               = false

  versioning {
    enabled = true
  }

  # Soft delete at Google's 7-day default, stated explicitly.
  #
  # Why it matters more here than on the content bucket: hub-deploy holds
  # storage.objects.delete on this bucket (it must, to prune a withdrawal), and
  # delete reaches a specific generation as well as the live object. Versioning
  # alone does not protect history from the identity that owns it; soft delete
  # does, because a deleted generation is retained and restorable for the
  # retention period regardless of who deleted it. 604800 seconds is 7 days, the
  # provider and API default; the minimum non-zero value is also 7 days and 0
  # would disable it.
  soft_delete_policy {
    retention_duration_seconds = 604800
  }

  # Lifecycle. Versioning without expiry grows without bound, and a noncurrent
  # version is billed exactly like a live one ("Data storage charges apply in the
  # same way to live objects, noncurrent objects, and soft-deleted objects" --
  # Cloud Storage pricing). Three rules, matching the content bucket's so the two
  # buckets age the same way:
  #
  # 1. Delete a noncurrent version 30 days after it became noncurrent.
  # 2. Delete a noncurrent version once 5 newer versions exist -- rule 1 bounds
  #    the age of history, rule 2 bounds its size.
  # 3. Abort an incomplete multipart upload after 7 days; unfinished parts are
  #    billed as storage and are invisible to both versioning and the listing.
  #
  # Both delete rules match with_state = "ARCHIVED", so a live object is never
  # touched by a lifecycle rule -- only the sync removes live objects.
  #
  # PRIVACY NOTE, stated rather than left to be discovered: these rules mean a
  # WITHDRAWN private item's bytes survive as noncurrent generations for up to 30
  # days after the sync deletes it. The gate cannot serve them -- it addresses
  # objects by name and never by generation, so a withdrawn path 404s -- but the
  # bytes are recoverable by the owner until the rules expire them. That is the
  # deliberate trade ADR-0010 asks for: its Risks require a recovery path for a
  # bad destructive sync, and a bucket with no history would have none. Where an
  # item must be unrecoverable immediately, deleting its generations is an owner
  # action, not a build one.
  lifecycle_rule {
    action {
      type = "Delete"
    }
    condition {
      with_state                 = "ARCHIVED"
      days_since_noncurrent_time = 30
    }
  }

  lifecycle_rule {
    action {
      type = "Delete"
    }
    condition {
      with_state         = "ARCHIVED"
      num_newer_versions = 5
    }
  }

  lifecycle_rule {
    action {
      type = "AbortIncompleteMultipartUpload"
    }
    condition {
      age = 7
    }
  }

  depends_on = [google_project_service.phase2]
}

# ---------------------------------------------------------------------------
# WHO MAY TOUCH THIS BUCKET. Exactly two principals, and nothing else.
#
# The roadmap's bucket IAM test fails the deploy if this bucket "grants public
# access, or any reader other than the gate's service account". Read literally,
# the second clause and ADR-0010 decision 5 cannot both hold: a destructive sync
# must LIST the destination to know what to prune, and list is a read. The
# resolution, argued in full in the Phase 3 handoff §Open question (a), is that
# the criterion names the wrong invariant. What must be true is:
#
#   No principal outside this project's own two deploy-time identities can read
#   a private object, and no human or satellite identity can read one at all.
#
# hub-deploy is not a third party that happens to have access: it is the process
# that PRODUCES these bytes, and it already reads every private source byte in
# the content bucket under sources/phd-milestones/ (SEAM-1, and the hub's
# unconditioned objectViewer grant in storage.tf). Denying it read here would
# protect nothing it cannot already see, while making withdrawal unimplementable.
#
# So: two bindings, two custom roles, each the minimum for its job
# (private-roles.tf), and the Checkpoint 4 procedure asserts the policy holds
# exactly these two members and no allUsers/allAuthenticatedUsers.
# ---------------------------------------------------------------------------

# 1. THE GATE -- the only identity that reads a private object to serve it.
#
# roles/privateObjectReader is a custom role holding exactly
# storage.objects.get. NOT roles/storage.objectViewer, which is what a first
# draft reaches for: objectViewer also carries storage.objects.list, and a gate
# that can list can enumerate every private object name. Object names here are
# milestone and committee-dossier paths, which are sensitive before anyone reads
# a byte -- the same reasoning that denies satellites list (ADR-0007 decision 4).
# The gate serves a path it was asked for; it never enumerates.
#
# Granted on the BUCKET, not the project, so it reaches nothing else.
resource "google_storage_bucket_iam_member" "gate_private_reader" {
  bucket = google_storage_bucket.private.name
  role   = google_project_iam_custom_role.private_object_reader.name
  member = google_service_account.hub_gate.member
}

# 2. THE HUB'S DEPLOY IDENTITY -- the process that writes and prunes the output.
#
# roles/privateSyncWriter is a custom role holding exactly create, delete, get
# and list on objects. Each is load-bearing for ADR-0010 decision 5; the handoff
# names them one by one. It is UNCONDITIONED, because the sync owns the whole
# bucket: every object here is produced by the build, and there are no prefixes
# to separate.
#
# This grant is the reason the private sync can be destructive at all. Without
# list it could only add, and a withdrawn private item would keep being served
# at its old path -- "a privacy failure wearing the costume of a stale page"
# (ADR-0010 Rationale).
resource "google_storage_bucket_iam_member" "hub_deploy_private_sync" {
  bucket = google_storage_bucket.private.name
  role   = google_project_iam_custom_role.private_sync_writer.name
  member = google_service_account.hub_deploy.member
}

# DELIBERATELY ABSENT from this bucket, each stated so a reader knows it was
# considered and refused rather than forgotten:
#
# - allUsers / allAuthenticatedUsers in any role. public_access_prevention =
#   "enforced" would refuse such a binding anyway, and the Checkpoint 4 check
#   asserts neither appears. Two independent controls, because this is the
#   failure with the worst consequence.
# - Any satellite. No publish identity has any grant here; satellites write to
#   the CONTENT bucket under their own prefix and never see the rendered output.
# - The gate's DEPLOY identity (gate-deploy, gate.tf). It ships an image; it has
#   no business reading private content.
# - Any human. The owner reaches the bucket through project-level roles, which
#   is a real exposure and is called out in the handoff §Risks: project Viewer on
#   this project can read every object in both buckets. That was recorded as
#   acceptable at Checkpoint 3 for the content bucket and it needs the owner's
#   eyes now that the bucket holds private material.
