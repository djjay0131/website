# The content bucket (design doc §8, §11; ADR-0002; ADR-0007 decision 8; SEAM-2).
#
# Every satellite publishes a finished dist/ and a manifest.json under its own
# prefix; the hub reads the whole bucket and builds the site from it:
#
#   gs://<bucket>/sources/<source>/manifest.json
#   gs://<bucket>/sources/<source>/<path…>      -- exactly the satellite's dist/
#
# The prefix is literally "sources/<source>/" (SEAM-2). The IAM conditions in
# satellites.tf match that literal string, so no stream may vary it.
#
# Four settings carry the security of this phase. Each is required, not
# preferred:
#
# - uniform_bucket_level_access = true. REQUIRED, and the single most
#   dangerous thing to turn off. An IAM condition does not apply to a bucket
#   without it: "To use conditions in the allow policy for a Cloud Storage
#   bucket, you must enable uniform bucket-level access on the bucket"
#   (IAM, "Overview of IAM Conditions"). With it off, the per-prefix condition
#   on every satellite binding stops constraining anything and each satellite's
#   write grant applies to the WHOLE bucket. The prefix boundary would fail
#   open, and it would fail open silently -- nothing else in this module would
#   look different. It also disables object ACLs, which are the other way an
#   object could be shared without an IAM change.
# - public_access_prevention = "enforced". The bucket is never public
#   (ADR-0007 decision 8). Nothing reads it from a browser: the public site is
#   served by Firebase Hosting out of the built output.
# - versioning. ADR-0007 accepts that a satellite can overwrite and delete its
#   own objects -- it must, to republish (see satellite-role.tf). Versioning is
#   what makes that recoverable: an overwrite or a delete keeps the previous
#   generation as a noncurrent version.
# - force_destroy = false (the provider default, stated for the record:
#   "Optional, Default: false"). Destroying a bucket that still holds objects
#   fails instead of deleting published content.
#
# The bucket is regional (var.region, us-east1), matching design doc §8, and
# Standard class: the hub reads the objects on every poll that finds a change,
# so there is no cold data here, and us-east1 is one of the three regions the
# Cloud Storage Always Free allowance covers (Cloud Storage pricing, "Cloud
# Storage Always Free usage limits": US-WEST1, US-CENTRAL1 and US-EAST1).
#
# Deliberately NOT set:
# - hierarchical_namespace: it would change object naming semantics under the
#   prefix conditions and is billed at higher Class A rates. A flat namespace
#   is also what makes the prefix condition safe (see satellites.tf).
# - a bucket retention_policy: it would block a satellite's own republish.
# - deletion_policy: left at its "DELETE" default. force_destroy = false is the
#   guard that matters here -- a bucket holding published objects cannot be
#   destroyed -- and an empty content bucket is cheap to re-create.

locals {
  # Phase 2's one new API. Everything else it needs (IAM for the custom role,
  # the service accounts and the pool; STS and IAM Credentials for the token
  # exchange; Cloud Resource Manager for project IAM) is already enabled by
  # google_project_service.phase1 in main.tf.
  phase2_services = {
    # Buckets, bucket IAM, and every object a satellite publishes or the hub reads.
    "storage.googleapis.com" = "the content bucket and its objects"
  }

  # Bucket names are globally unique across all of Cloud Storage, so the name is
  # a variable with the project id as its default stem rather than a literal.
  content_bucket_name = coalesce(var.content_bucket_name, "${var.project_id}-content")
}

resource "google_project_service" "phase2" {
  provider = google.no_user_project_override
  for_each = local.phase2_services

  project = var.project_id
  service = each.key

  # Same reasoning as phase1: leave APIs on if this module is destroyed.
  disable_on_destroy         = false
  disable_dependent_services = false
}

resource "google_storage_bucket" "content" {
  project = var.project_id
  name    = local.content_bucket_name

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

  # Soft delete, kept at Google's 7-day default and stated explicitly so the
  # bucket can be rebuilt from this repository alone (§12.5).
  #
  # Why keep it, given versioning is already on: a satellite's grant includes
  # storage.objects.delete under its own prefix, and that reaches a specific
  # generation as well as the live object. A satellite could therefore purge
  # its own history -- versioning alone does not protect against the identity
  # that owns the prefix. Soft delete does: a deleted generation is retained
  # and restorable for the retention period regardless of who deleted it.
  # Cost is negligible here (see README, "Cost"): soft-deleted bytes are billed
  # like live bytes ("Data storage charges apply in the same way to live
  # objects, noncurrent objects, and soft-deleted objects" -- Cloud Storage
  # pricing), and the whole bucket is a few megabytes against a 5 GB-month
  # free allowance. 604800 seconds is 7 days, the provider and API default;
  # the minimum non-zero value is also 7 days and 0 would disable it.
  soft_delete_policy {
    retention_duration_seconds = 604800
  }

  # Lifecycle. Versioning without expiry grows without bound, and every
  # noncurrent version is billed like a live one (same quote as above). Three
  # rules, each justified against the $5 budget (budget.tf):
  #
  # 1. Delete a noncurrent version 30 days after it became noncurrent. 30 days
  #    is one budget period: anything worth restoring is noticed within the
  #    month it was published, and a month of CV history is a few megabytes.
  # 2. Delete a noncurrent version once 5 newer versions exist. Rule 1 alone
  #    bounds the age of the history but not its size, so a satellite
  #    republishing in a loop could still accumulate 30 days of versions.
  #    Rule 2 bounds the count; together they bound the bill either way.
  #    Both rules match with_state = "ARCHIVED", so a live object is never
  #    touched -- published content only ever leaves the bucket when the
  #    satellite that owns it replaces or withdraws it.
  # 3. Abort an incomplete multipart upload after 7 days. Unfinished upload
  #    parts are billed as storage and are invisible to both versioning and
  #    the object listing, so a publish interrupted mid-upload would otherwise
  #    leave bytes nobody can see and nothing removes.
  #
  # A lifecycle delete is itself subject to soft delete above, so a version
  # these rules remove is still restorable for a further 7 days.
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

# The hub's read access to the content bucket (SEAM-4; ADR-0007 decision 1).
#
# UNCONDITIONED, and deliberately so. This is the one grant on this bucket that
# carries no prefix condition, which is the opposite of every satellite grant in
# satellites.tf. The difference is not an oversight:
#
# - The hub OWNS the bucket. It syncs every source's prefix on every build, so a
#   condition naming one prefix would have to be rewritten for each satellite
#   added, and a missed edit would silently drop that source from the site.
# - The hub needs storage.objects.list, which is exactly the permission a
#   satellite may never hold. list "is granted at the bucket level, [so] you
#   cannot use the resource.name condition attribute to restrict object listing
#   access to a subset of objects in the bucket" (Cloud Storage, "IAM for Cloud
#   Storage"). A conditioned viewer grant would therefore be a fiction: the
#   condition could not constrain the listing anyway.
# - The trust directions are opposite. Satellites are untrusted and must not
#   reach each other (§12.3, principle 3); the hub is the thing they publish TO.
#
# roles/storage.objectViewer is the narrowest predefined role that lists and
# reads objects: resourcemanager.projects.get/list, storage.folders.get/list,
# storage.managedFolders.get/list, storage.objects.get and storage.objects.list
# ("IAM roles for Cloud Storage"). It cannot write, delete or change IAM, so a
# compromised hub deploy run cannot alter what a satellite published. Granted on
# the BUCKET, not the project, so it reaches nothing else in the project.
#
# Note for Phase 3: this grant reads every prefix, so when private
# phd-milestones items arrive the hub build is what keeps them out of public
# output (the two-output build and leak check, ADR-0005). That is the hub's job,
# not this binding's.
resource "google_storage_bucket_iam_member" "hub_deploy_content_viewer" {
  bucket = google_storage_bucket.content.name
  role   = "roles/storage.objectViewer"
  member = google_service_account.hub_deploy.member
}
