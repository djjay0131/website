# ---------------------------------------------------------------------------
# NOBODY HOLDS roles/editor ON THIS PROJECT (issue #55).
#
# WHY THIS FILE EXISTS, and why it is an AUTHORITATIVE binding rather than a
# member resource.
#
# Cloud Storage creates four legacy bindings on every bucket automatically:
#
#     roles/storage.legacyBucketOwner  -> projectEditor, projectOwner
#     roles/storage.legacyObjectOwner  -> projectEditor, projectOwner
#     roles/storage.legacyBucketReader -> projectViewer
#     roles/storage.legacyObjectReader -> projectViewer
#
# They are not declared by this module and cannot be removed by adding IAM
# members to it. `projectEditor:<project>` is not a fixed principal -- it
# EXPANDS to whoever holds roles/editor. So while roles/editor is non-empty,
# every one of those principals holds create, delete, get, LIST, update and
# setIamPolicy on EVERY OBJECT in gs://<private bucket>, plus
# storage.buckets.setIamPolicy on the bucket itself.
#
# storage.objects.list is the sharpest of those. SEAM-1 withholds it from the
# GATE ITSELF -- the one identity that legitimately reads private objects --
# because the object NAMES in that bucket are private material: they name real
# people and their committee dossiers. An untracked identity must not hold it.
#
# The live check (infra/scripts/check-private-bucket-iam.sh, run hourly and on
# every push to main) failed on exactly this the first time it ran on main:
#
#     FAIL: roles/editor on cusati-hub is NOT empty.
#         serviceAccount:<project number>-compute@developer.gserviceaccount.com
#
# That is Google's DEFAULT COMPUTE SERVICE ACCOUNT, which is granted
# roles/editor at project creation and never used here. Verified before removal
# on 2026-09-23: the Compute Engine API is NOT enabled, the only Cloud Run
# service runs as its own identity (hub-gate@), the account has no user-managed
# keys, and roles/editor is the only role it holds. Nothing runs as it.
#
# AUTHORITATIVE, DELIBERATELY. google_project_iam_member can only ADD; it has no
# way to express "this role has no members". Only the authoritative binding can,
# and the invariant this module needs is an ABSENCE: the two-principal design of
# the private bucket (ADR-0010 decision 5, SEAM-1) is false the moment anyone
# holds roles/editor, whoever they are.
#
# THE TRADE, STATED PLAINLY: with this in place, granting roles/editor to anyone
# is undone by the next `terraform apply`. That is the point -- but it means a
# deliberate future grant must be made HERE, in members, and not in the console,
# or it will silently disappear. roles/owner is untouched and is how the owner
# reaches the project.
# ---------------------------------------------------------------------------
resource "google_project_iam_binding" "no_editors" {
  project = var.project_id
  role    = "roles/editor"
  members = []
}
