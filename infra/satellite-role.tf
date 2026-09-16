# The satellite publish role (ADR-0007 decision 4; SEAM-3; roadmap
# §phase-2-contract; design doc §12.3 principle 3).
#
# This role is the security boundary of Phase 2, and it is kept in a file of its
# own so that the permission list is reviewed as a unit and a diff to it is
# impossible to miss.
#
# THREE PERMISSIONS. NOTHING ELSE. Bound on the content bucket with a per-prefix
# IAM condition (satellites.tf), it lets a satellite publish and republish its
# own dist/ and nothing more.
#
#   storage.objects.create
#     Writes an object. Every publish needs it; without it nothing is uploaded.
#
#   storage.objects.delete
#     Present because a REPUBLISH IS AN OVERWRITE, and an overwrite is create +
#     delete. roles/storage.objectCreator "[a]llows users to create objects.
#     Does not give permission to view, delete, or overwrite objects" ("IAM
#     roles for Cloud Storage"), so a satellite holding only objectCreator would
#     succeed on its first publish and fail on every one after it. The cost of
#     granting it is that a satellite can delete its own objects; ADR-0007
#     accepts that, and bucket versioning plus soft delete (storage.tf) make it
#     recoverable. The blast radius is one prefix.
#
#   storage.objects.get
#     Reads an object's data and metadata under the satellite's own prefix. The
#     upload path needs to read back what it wrote to confirm a publish, and a
#     satellite must be able to see its own manifest. It is scoped by the same
#     prefix condition, so it reveals nothing about any other source.
#
# AND DELIBERATELY NOT storage.objects.list -- NOT IN THIS ROLE, NOT IN ANY
# OTHER ROLE GRANTED TO A SATELLITE, CONDITIONED OR NOT.
#
#   list cannot be restricted by prefix. "Since the storage.objects.list
#   permission is granted at the bucket level, you cannot use the resource.name
#   condition attribute to restrict object listing access to a subset of objects
#   in the bucket" (Cloud Storage, "IAM for Cloud Storage"). An IAM condition on
#   a listing grant therefore constrains nothing: a satellite holding list could
#   enumerate EVERY source's object names, whatever condition sits next to it.
#   Today that would leak the shape of the cv content; in Phase 3 it would leak
#   the names of private phd-milestones items -- committee and milestone
#   filenames are themselves sensitive, before anyone reads a byte.
#
#   This is the constraint that decides the publish primitive too, so it cannot
#   be worked around downstream: "gcloud storage cp --recursive" requires
#   storage.objects.list, which is why ADR-0007 decision 6 rejects it and
#   requires google-github-actions/upload-cloud-storage, whose source globs
#   locally and uploads per file, making no list call.
#
#   If a future publish step appears to need list, the design is wrong, not this
#   role: stop and raise it, per the Phase 2 contract.
#
# Why a custom role at all: no predefined Cloud Storage role holds exactly these
# three. objectCreator cannot overwrite; objectUser and objectAdmin both carry
# storage.objects.list; objectViewer carries list and cannot write. All three
# permissions are GA and custom-role eligible, verified against this project's
# live iam list-testable-permissions (issue #16, constraint 3).
#
# ONE role, shared by every satellite, not one per satellite: the permission SET
# is identical for all of them, and it is the BINDING that differs -- each
# satellite's condition names its own prefix (satellites.tf). Adding a satellite
# is one entry in var.satellites and touches this file not at all.
#
# deletion_policy = "PREVENT", chosen deliberately against the provider's
# soft-delete caveat: "A deleted role is permanently deleted after 7 days, but
# it can take up to 30 more days (i.e. between 7 and 37 days after deletion)
# before the role name is made available again. This means a deleted role that
# has been deleted for more than 7 days cannot be changed at all by Terraform,
# and new roles cannot share that name" (google_project_iam_custom_role).
# Destroying this role would therefore lock its role_id for up to 37 days and
# leave every satellite unable to publish for that whole window, with no way to
# re-apply out of it. PREVENT makes such a plan fail at plan time instead.
# Revoking a satellite does not need this role destroyed: remove the satellite's
# entry from var.satellites, which removes its BINDING (instant and reversible).
# Retiring the role itself is a reviewed change of this line to "DELETE",
# followed by an apply -- the same shape as the budget's guard in budget.tf,
# though this is the resource's own argument, not lifecycle.prevent_destroy.

resource "google_project_iam_custom_role" "satellite_publisher" {
  project = var.project_id

  # role_id is camel case: "[c]annot contain `-` characters" (provider docs).
  role_id     = "satellitePublisher"
  title       = "Satellite publisher (prefix-scoped)"
  description = "Publish objects under one sources/<source>/ prefix of the content bucket. Never grants storage.objects.list: it cannot be prefix-restricted (ADR-0007 decision 4). Bind only with a prefix condition."

  # The launch stage of the role itself, not of the permissions. GA is the
  # provider default; stated so the role is not read as experimental.
  stage = "GA"

  # EXACTLY these three, in this order. See the header for each one's
  # justification and for why storage.objects.list is absent.
  permissions = [
    "storage.objects.create",
    "storage.objects.delete",
    "storage.objects.get",
  ]

  deletion_policy = "PREVENT"

  depends_on = [google_project_service.phase1]
}
