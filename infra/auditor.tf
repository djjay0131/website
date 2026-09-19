# The read-only auditor identity: the one thing that lets the LIVE half of the
# bucket IAM test actually run (issue #58; design doc §12.1).
#
# WHY IT EXISTS. §12.1 requires a bucket IAM test on every deploy, in two halves:
#   - scripts/check_private_bucket_config.py, credential-free, reads the
#     Terraform. It has been wired into budget-guard since Phase 3 and runs on
#     every push and pull request.
#   - scripts/check-private-bucket-iam.sh, which reads the LIVE policy. Until
#     Wave 0 it ran NOWHERE: it was named in one comment in build.yml and no
#     workflow invoked it. Three documents said otherwise.
#
# The live half is the only half that can see anything granted OUTSIDE this
# repository -- a console click, a gcloud command, a role added to a service
# account. #55 is exactly that shape: roles/editor on the default compute
# service account reaches every object in the private bucket through the
# automatic legacy bindings, and granting it touches no file here. Terraform
# structurally cannot see it, because Terraform knows only what it declares.
#
# WHY A NEW IDENTITY RATHER THAN AN EXISTING ONE. Neither existing identity can
# read what the check reads, and widening either one is worse than adding this:
#
#   hub-deploy  holds object permissions only -- roles/storage.objectViewer on
#               the content bucket and privateSyncWriter's four object
#               permissions on this one. None of them reads bucket metadata or a
#               bucket's IAM policy, and none reads the PROJECT's IAM policy,
#               which is what the roles/viewer + roles/editor expansion needs.
#               Adding storage.buckets.getIamPolicy to privateSyncWriter would
#               widen the identity that can DELETE private objects, for the sake
#               of a check rather than of the work.
#   hub-gate    is the runtime identity that serves private objects. Giving the
#               thing on the public internet the ability to read IAM policies is
#               the opposite of ADR-0004's direction of travel.
#
# So: a third identity that can read policies and nothing else. It holds NO
# storage.objects.* permission of any kind, so it cannot read, write, list or
# delete a single private object -- it can only read the POLICY that says who
# can. That property is asserted in CI by scripts/check_private_bucket_config.py
# rather than left to review.
#
# It holds no key (§12.2). GitHub's OIDC token is exchanged through the existing
# Workload Identity pool, and the binding at the bottom of this file admits only
# refs/heads/main of this repository -- which is also why the check is wired to
# the SCHEDULE and to main, never to a pull request: a PR run carries
# refs/pull/<n>/merge and cannot authenticate at all (wif.tf, STATE C25).
#
# COST: $0. Service accounts, custom roles and IAM bindings are not billed.
# The check itself makes two Cloud Storage Class B operations per run
# (buckets.get, buckets.getIamPolicy) plus one Resource Manager call, which is
# free. At the existing hourly schedule that is roughly 1,500 Class B operations
# a month -- inside the 50,000/month Always Free allowance for US regions, and
# $0.0006 at the list price of $0.004 per 10,000 if it were ever billed. The $5
# budget (§12.6) is untouched.

resource "google_service_account" "hub_auditor" {
  project      = var.project_id
  account_id   = "hub-auditor"
  display_name = "Hub auditor (GitHub Actions, read-only)"
  description  = "Reads the private bucket's IAM policy and the project's IAM policy so the live half of the §12.1 bucket IAM test can run on a schedule. Holds no storage.objects.* permission, cannot read a private object, cannot write anything, and has no keys."

  depends_on = [google_project_service.phase1]
}

# ---------------------------------------------------------------------------
# THE AUDITOR'S ROLE: three permissions, one per thing the live check reads.
#
#   resourcemanager.projects.getIamPolicy
#     `gcloud projects get-iam-policy` -- §2b of the check, which expands
#     roles/viewer and roles/editor into the principals the legacy
#     projectViewer/projectEditor bindings actually reach. This is the
#     permission the whole of #55 turns on: without it the check cannot tell an
#     empty role from a populated one.
#
#   storage.buckets.get
#     `gcloud storage buckets describe` -- uniform_bucket_level_access and
#     public_access_prevention. UBLA is the setting that fails OPEN, so reading
#     it live rather than trusting the Terraform is the point of this half.
#
#   storage.buckets.getIamPolicy
#     `gcloud storage buckets get-iam-policy` -- the bucket's own bindings: the
#     allUsers/allAuthenticatedUsers check, the exactly-two-principals equality,
#     and the legacy bindings printed for the record.
#
# AND DELIBERATELY NOT, each stated so a reader knows it was refused rather than
# forgotten:
#
# - storage.objects.get / .list / .create / .delete / anything under
#   storage.objects.*. The auditor reads policies, never content. It cannot read
#   the committee dossier and cannot enumerate its object names. This is the
#   property that makes a third principal in this project acceptable at all, and
#   check_private_bucket_config.py asserts it positively.
# - storage.buckets.setIamPolicy, or any write. A check that can change what it
#   checks is not a check.
# - roles/iam.securityReviewer, the predefined role that would "just work". It
#   carries getIamPolicy over EVERY resource type in the project -- service
#   accounts, Cloud Run services, Artifact Registry, Firestore -- where three
#   permissions are needed. Same reasoning as private-roles.tf.
#
# SCOPE, and the trade made deliberately. This role is bound at PROJECT level,
# not on the private bucket. resourcemanager.projects.getIamPolicy is a project
# permission and has no bucket-scoped form, so a project binding is required in
# any case; putting the two storage permissions in the same binding means the
# auditor can also read bucket METADATA and bucket IAM for the content bucket.
# The alternative -- a second, bucket-scoped binding on the private bucket --
# was rejected because it would add a THIRD principal to that bucket's own IAM
# policy, and "the private bucket carries exactly two bindings" is an equality
# invariant asserted in two places (check_private_bucket_config.py §5 and the
# live check §2). Trading a widely-quoted invariant for a marginally narrower
# read of one extra bucket's policy is a bad trade, and the widening is bounded:
# policy metadata about two buckets this project already owns, no object data.
#
# deletion_policy = "PREVENT", as on every custom role in this module: "A
# deleted role is permanently deleted after 7 days, but it can take up to 30
# more days ... before the role name is made available again". A destroyed role
# would leave the live check unable to authenticate for up to 37 days, which is
# the guard switching itself off -- the exact failure this file exists to end.
# ---------------------------------------------------------------------------
resource "google_project_iam_custom_role" "private_bucket_auditor" {
  project = var.project_id

  role_id     = "privateBucketAuditor"
  title       = "Private bucket auditor (CI, read-only)"
  description = "Read the project's IAM policy and a bucket's settings and IAM policy, for the live half of the §12.1 bucket IAM test. Grants NO storage.objects.* permission: the holder cannot read, list, write or delete any object."

  stage = "GA"

  # EXACTLY these three. See the header for each one.
  permissions = [
    "resourcemanager.projects.getIamPolicy",
    "storage.buckets.get",
    "storage.buckets.getIamPolicy",
  ]

  deletion_policy = "PREVENT"

  depends_on = [google_project_service.phase1]
}

resource "google_project_iam_member" "hub_auditor_policy_reader" {
  project = var.project_id
  role    = google_project_iam_custom_role.private_bucket_auditor.name
  member  = google_service_account.hub_auditor.member
}

# Lets GitHub Actions runs on main of THIS repository -- and nothing else --
# mint short-lived tokens as the auditor. Identical in shape to
# hub_deploy_wif_main (deploy.tf) and gate_deploy_wif_main (gate.tf), in the same
# pool, and pinned to the same local.deploy_ref.
#
# A SCHEDULED run carries refs/heads/main, so this binding admits it with no
# second binding and no second provider (ADR-0007 decision 7 records the same
# property for the content-bucket poll). A pull_request run carries
# refs/pull/<n>/merge and is refused -- which is not a gap in the wiring but the
# reason the live check cannot be a PR check at all.
resource "google_service_account_iam_member" "hub_auditor_wif_main" {
  service_account_id = google_service_account.hub_auditor.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository_id_ref/${var.github_repository_id}/${local.deploy_ref}"
}
