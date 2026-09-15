# The project is an input, not a resource: the owner creates it and links billing
# by hand (design doc §10 Q2; README.md manual steps). Terraform only reads it,
# so `terraform destroy` can never delete the project.
data "google_project" "hub" {
  project_id = var.project_id
}

locals {
  # Every API Phase 1 needs, with the reason. Nothing for buckets, Artifact
  # Registry, Cloud Run, Identity Platform or Firestore (issue #10 K1; roadmap
  # "Not in this phase").
  services = {
    # Project metadata (data.google_project), project-level IAM bindings, and the
    # testIamPermissions preflight firebase-tools runs before every deploy.
    "cloudresourcemanager.googleapis.com" = "project metadata, project IAM, firebase-tools permission preflight"
    # google_project_service itself.
    "serviceusage.googleapis.com" = "enabling the other APIs"
    # Workload Identity pool/provider and the deploy service account.
    "iam.googleapis.com" = "workload identity pool, provider and service account"
    # Security Token Service: exchanges the GitHub OIDC token for a federated token.
    "sts.googleapis.com" = "GitHub OIDC token exchange"
    # generateAccessToken: the federated identity impersonates the deploy service account.
    "iamcredentials.googleapis.com" = "service account impersonation from WIF"
    # Firebase Management API: google_firebase_project, and firebase-tools' projects.get.
    "firebase.googleapis.com" = "adding Firebase to the project"
    # Hosting sites, custom domain, and every deploy (versions, files, releases).
    "firebasehosting.googleapis.com" = "Hosting site, custom domain and deploys"
    # google_billing_budget, called with this project as the quota project.
    "billingbudgets.googleapis.com" = "the $5 budget"
  }

  hosting_site_id = coalesce(var.hosting_site_id, var.project_id)
}

resource "google_project_service" "phase1" {
  provider = google.no_user_project_override
  for_each = local.services

  project = var.project_id
  service = each.key

  # Leave APIs on if this module is destroyed: later phases and anything the
  # owner enabled by hand may depend on them, and disabling cascades.
  disable_on_destroy         = false
  disable_dependent_services = false
}
