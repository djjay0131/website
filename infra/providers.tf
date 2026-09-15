# Provider configuration.
#
# The owner runs Terraform with user Application Default Credentials. Two
# settings follow from that:
#
# - user_project_override + billing_project: the Billing Budgets API returns 403
#   for user ADC unless a billing (quota) project is set and overridden
#   (google_billing_budget docs, warning box); the Firebase Terraform guide
#   likewise configures its main provider with user_project_override = true so
#   quota is checked against the Firebase project.
# - A second, aliased provider WITHOUT the override enables the APIs. The Firebase
#   Terraform guide uses exactly this split, because the project cannot accept
#   quota checks for an API that is not enabled yet.

provider "google" {
  project               = var.project_id
  region                = var.region
  user_project_override = true
  billing_project       = var.project_id
}

provider "google-beta" {
  project               = var.project_id
  region                = var.region
  user_project_override = true
  billing_project       = var.project_id
}

provider "google" {
  alias                 = "no_user_project_override"
  project               = var.project_id
  region                = var.region
  user_project_override = false
}
