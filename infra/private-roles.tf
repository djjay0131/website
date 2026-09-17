# The two private-bucket roles (design doc §12.1, §12.3; ADR-0004 decision 4;
# ADR-0010 decision 5).
#
# These are the security boundary of Phase 3, and they are kept in a file of
# their own for the same reason satellite-role.tf exists: the permission lists
# are the thing most worth protecting from a careless diff, and a single-purpose
# file makes them reviewable as a unit and greppable by a CI guard
# (scripts/check_private_bucket_config.py).
#
# Both are CUSTOM roles because no predefined Cloud Storage role is narrow
# enough, and the difference matters here more than anywhere else in the module:
# every predefined role that can read an object also carries
# storage.objects.list ("IAM roles for Cloud Storage"), and list over this bucket
# is an enumeration of private item names.
#
# deletion_policy = "PREVENT" on both, for the reason satellite-role.tf records:
# "A deleted role is permanently deleted after 7 days, but it can take up to 30
# more days (i.e. between 7 and 37 days after deletion) before the role name is
# made available again" (google_project_iam_custom_role). Destroying either role
# would break the private area for up to 37 days with no way to apply out of it
# -- the gate could not read, or the hub could not publish. Revoking access does
# not need the role destroyed: remove the BINDING in private-bucket.tf, which is
# instant and reversible.

# ---------------------------------------------------------------------------
# THE GATE'S READ ROLE: one permission.
#
#   storage.objects.get
#     Reads an object's data and metadata. This is what streaming /p/** is:
#     the gate resolves a request path to one object name and gets it.
#
# AND DELIBERATELY NOT storage.objects.list.
#
#   The gate never enumerates. It is asked for a path and serves that path; the
#   private build's navigation, which lives only in dist-private, is what tells
#   a member what exists. A gate holding list could enumerate every private
#   object name, and in this repository object names ARE private material --
#   committee and milestone filenames disclose before a byte is read. This is
#   the same property ADR-0007 decision 4 protects on the content bucket, applied
#   to the bucket where the consequence is worst.
#
#   It also keeps the blast radius of a gate compromise to "can read an object
#   whose exact name it already knew".
#
# AND NOT storage.objects.create / .delete: the gate serves; it never writes.
# A gate that cannot write cannot be made to overwrite or destroy private
# content, whatever a request does to it.
# ---------------------------------------------------------------------------
resource "google_project_iam_custom_role" "private_object_reader" {
  project = var.project_id

  # role_id is camel case: "[c]annot contain `-` characters" (provider docs).
  role_id     = "privateObjectReader"
  title       = "Private object reader (gate)"
  description = "Read one object of the private bucket by name. Never grants storage.objects.list: object names in that bucket are themselves private material. Bind only on the private bucket."

  # The launch stage of the role, not of the permissions. GA is the provider
  # default; stated so the role is not read as experimental.
  stage = "GA"

  # EXACTLY this one.
  permissions = [
    "storage.objects.get",
  ]

  deletion_policy = "PREVENT"

  depends_on = [google_project_service.phase1]
}

# ---------------------------------------------------------------------------
# THE HUB'S SYNC ROLE: four permissions, one per thing a destructive sync does.
#
#   storage.objects.create
#     Uploads each object of dist-private. Without it nothing publishes.
#
#   storage.objects.delete
#     TWO jobs, and both are required. It is half of an overwrite -- replacing
#     an object needs create AND delete, which is why roles/storage.objectCreator
#     "[d]oes not give permission to view, delete, or overwrite objects" ("IAM
#     roles for Cloud Storage") and fails on every republish. And it is what
#     makes a withdrawal real: ADR-0010 decision 5 requires the sync to delete
#     destination objects the current build did not produce, so a withdrawn
#     private item stops being READABLE rather than merely stopping being linked.
#
#   storage.objects.get
#     Reads an object back -- comparing what is there against what was built, so
#     an unchanged sync is a no-op rather than a rewrite of every object.
#
#   storage.objects.list
#     THE ONE THAT NEEDS ARGUING, because everywhere else in this module list is
#     the forbidden permission. A destructive sync must discover what the
#     destination currently holds; that is what pruning means. Without list the
#     hub inherits exactly the defect ADR-0007 gives satellites -- "a satellite
#     cannot prune" -- and ADR-0010 decision 5 becomes unimplementable.
#
#     Why it is safe HERE and not on the content bucket:
#       - Scope. This binding is on the private bucket alone. list cannot be
#         restricted by prefix, which is precisely why no satellite may hold it
#         on the SHARED content bucket: one satellite's list would enumerate
#         every other source. This bucket has no second tenant to leak to. Its
#         whole contents are one build's output.
#       - Trust direction. hub-deploy is not a reader that sneaked in; it is the
#         process that produced these bytes, from sources it already reads in the
#         content bucket under sources/phd-milestones/ (SEAM-1). It learns
#         nothing from listing that it did not itself write minutes earlier.
#       - It still cannot change IAM, make anything public, or reach the gate.
#
#     If a future change wants list on the CONTENT bucket for a satellite, that
#     is a different question with a different answer: no.
#
# AND DELIBERATELY NOT roles/storage.objectAdmin, which is the predefined role
# that would "just work". It carries the whole storage.objects.* surface --
# including setIamPolicy/getIamPolicy on objects and setRetention -- and while
# uniform bucket-level access makes the object-IAM half inert, a granted
# permission that happens to be unusable is not the same as one that was never
# granted. A custom role keeps the list short enough to review and to assert in
# CI.
# ---------------------------------------------------------------------------
resource "google_project_iam_custom_role" "private_sync_writer" {
  project = var.project_id

  role_id     = "privateSyncWriter"
  title       = "Private output sync (hub deploy)"
  description = "Publish site/dist-private to the private bucket and prune objects the current build did not produce (ADR-0010 decision 5). Includes storage.objects.list, which a destructive sync requires; bind only on the private bucket, which has a single tenant."

  stage = "GA"

  # EXACTLY these four, in this order. See the header for each one.
  permissions = [
    "storage.objects.create",
    "storage.objects.delete",
    "storage.objects.get",
    "storage.objects.list",
  ]

  deletion_policy = "PREVENT"

  depends_on = [google_project_service.phase1]
}
