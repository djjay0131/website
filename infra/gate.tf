# The gate: its runtime identity, its Cloud Run service, and the identity that
# deploys it (design doc §6, §8; ADR-0004; SEAM-1, SEAM-6).
#
# Three identities appear in this phase and they must not be confused:
#   hub-deploy   (deploy.tf)  -- builds and deploys the SITE; syncs dist-private.
#   hub-gate     (here)       -- what the gate RUNS AS. Reads private objects and
#                                Firestore. Holds no key; never deploys anything.
#   gate-deploy  (here)       -- what gate.yml AUTHENTICATES AS to push an image
#                                and roll out a revision. Never reads a private
#                                object.
# Keeping them apart is the point: a compromised deploy pipeline cannot read
# private content, and a compromised gate cannot change what runs.

locals {
  # Fixed, not a variable. firebase.json's rewrites name this service literally
  # (design doc §8), and Hosting rejects a configuration naming a service that
  # does not exist (issue #10 K2). A variable here would let the two drift into
  # exactly that failure, which breaks the PUBLIC site's deploy, not just the
  # private area.
  gate_service_name = "hub-gate"
}

# ---------------------------------------------------------------------------
# THE GATE'S RUNTIME IDENTITY (contract D2).
#
# It holds NO KEY. It runs as this service account on Cloud Run and obtains
# credentials from the metadata server (§12.2, ADR-0007 decision 3). There is no
# key resource anywhere in this module, and there must never be one.
#
# ROLES GRANTED, each with what needs it:
#
# 1. privateObjectReader on the PRIVATE BUCKET (private-bucket.tf,
#    private-roles.tf) -- exactly storage.objects.get, so /p/** can stream one
#    object by name. Not objectViewer: that adds storage.objects.list, and
#    private object names are private material.
#
# 2. roles/datastore.viewer (project) -- READ-ONLY over the Firestore
#    database. Needed for responsibility 2, the member allowlist (§6).
#
#    NARROWED 2026-09-17, closing the gate stream's finding SD-3. This was
#    roles/datastore.user, which is read AND write, justified by "the gate must
#    be able to write in later phases (shares, Phase 4) without a role change
#    here". That is granting a privilege now for a capability a later phase may
#    need, and the privilege in question is write access to the allowlist --
#    the access-control list for the committee dossier. A flaw in the gate
#    could have added a member. Phase 4 changes this line when Phase 4 needs
#    it, reviewed at that time.
#
#    Verified rather than assumed: gate/app/ contains no Firestore write of any
#    kind. The only call sites are in app/members.py -- the import, the client,
#    and one .collection(...).document(key).get() per request.
#
#    Predefined rather than the custom read-only role the gate stream proposed
#    (datastore.entities.get [+ datastore.databases.get]): neither stream could
#    confirm from a primary source whether the Python client needs
#    databases.get to connect, and a role too narrow to connect fails closed by
#    breaking the private area. The custom-role tightening is a Checkpoint 4
#    item alongside the firebaseauth.admin one.
#
#    It is NOT roles/datastore.owner, which adds index and database
#    administration, import/export, and the ability to delete the allowlist
#    wholesale.
#    NOTE the scope: Firestore data roles are project-level. There is one
#    database in this project, so "project-level" and "this database" coincide
#    today; if a second database is ever added, this grant reaches it.
#
# 3. roles/firebaseauth.admin (project), "Full read/write access to
#    Authentication resources" (Firebase, "Firebase IAM roles"). This is the one
#    role in this file that is wider than I would like, and it is here for a
#    specific, checkable reason: minting the session cookie. The Admin SDK's
#    createSessionCookie is Identity Toolkit's
#    SessionManagementService.CreateSessionCookie, whose permission is
#    firebaseauth.users.createSession -- a permission no narrower PREDEFINED role
#    was found to carry.
#    Verifying an ID token and verifying a session cookie need NO IAM at all:
#    both are signature checks against Google's public certificates, done
#    offline. So this grant exists solely for the mint step.
#    THE INTENDED TIGHTENING, for Checkpoint 4: confirm with
#    `gcloud iam list-testable-permissions //cloudresourcemanager.googleapis.com/projects/<project>`
#    that firebaseauth.users.createSession is custom-role eligible, and if it is,
#    replace this with a custom role holding exactly that one permission -- the
#    same move Phase 2 made for the satellite role, and for the same reason. It
#    is written up in the handoff as an open item rather than left as a silent
#    over-grant.
#
# DELIBERATELY NOT GRANTED (the deploy.tf precedent -- state the omissions):
# - Any role on the CONTENT bucket. The gate never reads satellite sources; it
#   reads the rendered private output only. sources/phd-milestones/ is out of its
#   reach entirely.
# - roles/storage.objectViewer anywhere. It carries storage.objects.list.
# - roles/artifactregistry.reader. The image is pulled by the Cloud Run Service
#   Agent, not by the revision's identity, and the repository is in this project.
# - roles/logging.logWriter. Cloud Run captures a container's stdout and stderr
#   without the runtime identity holding any logging role. A logWriter grant
#   would only be needed if the gate called the Logging API directly, which §6's
#   "keep it small enough to read in one sitting" argues against anyway.
# - roles/run.invoker. The gate is invoked; it invokes nothing.
# - roles/iam.serviceAccountTokenCreator on itself. That is needed to SIGN
#   blobs -- createCustomToken -- which this gate does not do. Session cookies
#   are minted by the Identity Toolkit service, not signed locally.
# - roles/secretmanager.*. There is no secret.
# ---------------------------------------------------------------------------
resource "google_service_account" "hub_gate" {
  project      = var.project_id
  account_id   = local.gate_service_name
  display_name = "Hub gate (Cloud Run runtime)"
  description  = "Runtime identity of the ${local.gate_service_name} Cloud Run service. Reads objects of the private bucket by name and the Firestore member allowlist. Has no keys and no access to the content bucket."

  depends_on = [google_project_service.phase1]
}

resource "google_project_iam_member" "hub_gate_firestore" {
  project = var.project_id
  role    = "roles/datastore.viewer"
  member  = google_service_account.hub_gate.member
}

resource "google_project_iam_member" "hub_gate_auth_admin" {
  project = var.project_id
  role    = "roles/firebaseauth.admin"
  member  = google_service_account.hub_gate.member
}

# ---------------------------------------------------------------------------
# THE CLOUD RUN SERVICE (contract D3; ADR-0004 decision 1; SEAM-6 step 1).
#
# WHY TERRAFORM CREATES IT AT ALL, given the image does not exist yet.
# SEAM-6 orders the phase: infra first, then the gate image is built and
# deployed, then firebase.json gains the rewrites. If the workflow created the
# service, then the invoker policy, the runtime identity, scaling and ingress --
# every security-relevant property -- would live in a workflow file instead of in
# reviewed Terraform, and the invoker binding below would have nothing to attach
# to. So the service is created here with a PLACEHOLDER image, and gate.yml
# replaces only the image.
#
# THE DIVISION OF OWNERSHIP, which the gate stream must respect:
#   Terraform owns: the service's identity, scaling, ingress, env vars and IAM.
#   gate.yml owns:  the image, and nothing else.
# `gcloud run deploy --image ...` preserves the rest, so the two do not fight.
# A deploy that passes --set-env-vars or --service-account would fight Terraform
# and is a defect, not a workaround.
#
# Until the first real deploy, the *.run.app URL serves Google's sample "hello"
# container. That is harmless -- it reads nothing and holds no grant -- but it is
# publicly reachable, so firebase.json must still not point at it (SEAM-6, and
# the site stream's constraint) until the gate is actually deployed.
# ---------------------------------------------------------------------------
resource "google_cloud_run_v2_service" "gate" {
  project  = var.project_id
  name     = local.gate_service_name
  location = var.region

  description = "The private-area gate (ADR-0004). Authorisation is application-level: the invoker is allUsers deliberately."

  # INGRESS_TRAFFIC_ALL, deliberately, and it is not laziness.
  # ADR-0004 records that the invoker is allUsers because authentication is at
  # the application level, and that "Every check must hold on direct requests".
  # An internal-only ingress would ALSO break Firebase Hosting rewrites, which
  # reach the service over the public internet -- so tightening this would take
  # the public site's /p/** path down while changing nothing about
  # authorisation, which lives in the gate's code and its session check.
  ingress = "INGRESS_TRAFFIC_ALL"

  # false, because the guard is in the wrong place for this resource. The
  # provider defaults this to true, which makes any destroy of the service fail
  # -- including a deliberate, reviewed rollback (README §Phase 3 rollback),
  # where removing the gate is the recovery action. What must not be destroyed is
  # the DATA: the private bucket (force_destroy = false, versioning, soft delete)
  # and the Firestore allowlist (delete protection). The service is stateless and
  # is re-created by one apply plus one image deploy, so protecting it would cost
  # a rollback path and protect nothing.
  deletion_protection = false

  template {
    # The gate runs as its own least-privilege identity. Without this line Cloud
    # Run uses the project's DEFAULT compute service account, which holds
    # roles/editor on the project -- read/write access to the private bucket,
    # Firestore, and everything else. That default is the single most dangerous
    # omission available in this file.
    service_account = google_service_account.hub_gate.email

    scaling {
      # min 0: the service scales to zero and costs nothing at rest (§6, §8).
      # ADR-0004 accepts the ~1s cold start that follows.
      min_instance_count = 0
      # max 3 (orchestration brief §4 Phase 3), so a burst of traffic to a public
      # URL cannot scale into the $5 budget. The gate serves a handful of
      # documents to a handful of members.
      max_instance_count = var.gate_max_instance_count
    }

    containers {
      # A PLACEHOLDER until gate.yml pushes the real image; see ignore_changes
      # below. Google's public sample container, which serves a static page and
      # reads nothing.
      image = var.gate_image

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }

        # CPU is allocated only during requests, which is what makes min-instances
        # 0 actually free. The provider requires this to be explicit once a
        # resources block exists: "if 'resources' is set, this field must be
        # explicitly set to true to preserve the default behavior".
        cpu_idle = true
      }

      # GATE_-prefixed, and that prefix is load-bearing. app/config.py reads
      # GATE_PRIVATE_BUCKET and raises ValueError when it is empty, so a bare
      # PRIVATE_BUCKET here makes the container fail at startup -- the revision
      # never becomes healthy, and nothing in either stream's tests catches it
      # because neither runs the other's code. Found at integration, 2026-09-17.
      env {
        name  = "GATE_PRIVATE_BUCKET"
        value = google_storage_bucket.private.name
      }

      env {
        name  = "GOOGLE_CLOUD_PROJECT"
        value = var.project_id
      }
    }
  }

  lifecycle {
    ignore_changes = [
      # gate.yml owns the image. Without this, every apply after a deploy would
      # roll the service back to the placeholder -- a Terraform apply silently
      # un-deploying the gate.
      template[0].containers[0].image,
      # `gcloud run deploy` stamps these on the service it touches. They carry no
      # meaning for this configuration and would otherwise show as perpetual
      # drift, training the reader to ignore diffs on this resource.
      client,
      client_version,
    ]
  }

  depends_on = [google_project_service.phase3]
}

# THE INVOKER IS allUsers, AND THAT IS THE DESIGN (ADR-0004).
#
# Do not "fix" this. It is not an oversight and it is not a weakening:
# authentication and authorisation are application-level (§8), and every check
# the gate makes must hold on a direct *.run.app request as well as through
# Hosting. Making the invoker anything narrower would push authorisation into
# Cloud Run IAM, which cannot express "is this email on the allowlist", and would
# break Hosting rewrites, which arrive unauthenticated.
#
# The roadmap makes the consequence an acceptance criterion in its own right:
# signed-out and non-member requests sent straight to the *.run.app URL must be
# refused exactly as they are through Hosting.
resource "google_cloud_run_v2_service_iam_member" "gate_invoker_all_users" {
  project  = var.project_id
  location = google_cloud_run_v2_service.gate.location
  name     = google_cloud_run_v2_service.gate.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# Firebase Hosting must be able to READ this service to deploy a rewrite that names
# it. When it writes a Hosting version whose config contains a `run` rewrite, it
# resolves the service as the DEPLOYING identity -- hub-deploy -- and a missing
# run.services.get fails the whole deploy, including the public site, with a 403
# naming namespaces/<project number>/services/hub-gate. Checkpoint 4 hit exactly
# that: firebase-deploy was the only failing job, /p/ stayed 404, and the sign-in
# page stayed unconfigured, while everything else went green.
#
# Scoped to THIS SERVICE rather than roles/run.viewer at project level. Hosting
# needs to read one service; a project-level grant would let the deploy identity
# enumerate and read every Cloud Run service the project ever runs, which is a
# wider blast radius than the problem warrants (deploy.tf states the same rule for
# every other grant this identity holds).
#
# It is a READ role: run.viewer cannot deploy, update or invoke. Invocation is
# allUsers by design (ADR-0004), and deployment belongs to gate-deploy.
resource "google_cloud_run_v2_service_iam_member" "hub_deploy_run_viewer" {
  project  = var.project_id
  location = google_cloud_run_v2_service.gate.location
  name     = google_cloud_run_v2_service.gate.name
  role     = "roles/run.viewer"
  member   = google_service_account.hub_deploy.member
}

# ---------------------------------------------------------------------------
# THE GATE'S DEPLOY IDENTITY (what .github/workflows/gate.yml authenticates as).
#
# A SEPARATE identity from hub-deploy, which is the decision worth stating.
# Reusing hub-deploy would have been less Terraform, and would have meant the
# identity that deploys the public SITE could also roll out gate revisions -- and
# conversely that a compromised gate pipeline could deploy the site. They are
# different blast radii, so they are different accounts. Neither can read a
# private object.
#
# ROLES, each on the NARROWEST resource that works, never on the project:
#
# 1. roles/artifactregistry.writer on THE GATE REPOSITORY (registry.tf).
#    "Read and write artifacts" -- what pushing an image requires. Scoped to the
#    one repository, so it cannot write to any other.
# 2. roles/run.developer on THE hub-gate SERVICE. Cloud Run documents the
#    deployer's requirement as "Cloud Run Developer (roles/run.developer) on the
#    Cloud Run service". Scoped to this service, so this identity cannot create
#    or alter any other Cloud Run service in the project.
# 3. roles/iam.serviceAccountUser on THE GATE'S RUNTIME SA ONLY. Deploying a
#    revision that runs as hub-gate means acting as it: "Service Account User
#    (roles/iam.serviceAccountUser) on the service identity". Granted on that one
#    service account -- NOT at project level, which would let this identity run
#    workloads as ANY service account in the project, including hub-deploy.
#
# DELIBERATELY NOT GRANTED:
# - roles/run.admin. It includes setIamPolicy on services, so this identity
#   could change the invoker policy -- the one control ADR-0004 rests on.
#   Deploying a revision does not need it.
# - Anything on the private bucket or Firestore. A deploy pipeline has no
#   business reading private content or the allowlist.
# - roles/artifactregistry.reader separately: writer includes read, and the
#   pull at deploy time is done by the Cloud Run Service Agent in any case.
# ---------------------------------------------------------------------------
resource "google_service_account" "gate_deploy" {
  project      = var.project_id
  account_id   = "gate-deploy"
  display_name = "Gate deploy (GitHub Actions)"
  description  = "Builds and deploys the ${local.gate_service_name} image from ${var.github_repository} main via Workload Identity Federation. Has no keys and cannot read private content."

  depends_on = [google_project_service.phase1]
}

resource "google_artifact_registry_repository_iam_member" "gate_deploy_writer" {
  project    = var.project_id
  location   = google_artifact_registry_repository.gate.location
  repository = google_artifact_registry_repository.gate.name
  role       = "roles/artifactregistry.writer"
  member     = google_service_account.gate_deploy.member
}

resource "google_cloud_run_v2_service_iam_member" "gate_deploy_developer" {
  project  = var.project_id
  location = google_cloud_run_v2_service.gate.location
  name     = google_cloud_run_v2_service.gate.name
  role     = "roles/run.developer"
  member   = google_service_account.gate_deploy.member
}

resource "google_service_account_iam_member" "gate_deploy_act_as_gate" {
  service_account_id = google_service_account.hub_gate.name
  role               = "roles/iam.serviceAccountUser"
  member             = google_service_account.gate_deploy.member
}

# Lets GitHub Actions runs on main of THIS repository -- and nothing else --
# mint short-lived tokens as the gate deploy identity. Identical in shape to
# hub_deploy_wif_main (deploy.tf) and in the same pool: the gate workflow runs in
# the hub's own repository, so it authenticates through the hub's provider. The
# satellites pool is for satellites and stays untouched (ADR-0007 decision 5).
#
# Pull request runs carry refs/pull/<n>/merge and other branches carry their own
# ref, so neither can deploy the gate.
resource "google_service_account_iam_member" "gate_deploy_wif_main" {
  service_account_id = google_service_account.gate_deploy.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository_id_ref/${var.github_repository_id}/${local.deploy_ref}"
}
