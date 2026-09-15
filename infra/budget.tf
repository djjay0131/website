# Cost guardrail (design doc §8, §12.6: "The budget alert is never removed").
#
# Recipients: no email address is committed. Budget emails go to
# - the default IAM recipients: "Billing Account Administrators and Billing
#   Account Users on the target Cloud Billing account" (Cloud Billing, "Create,
#   edit, or delete budgets and budget alerts"), which includes the owner, who
#   owns the personal billing account; and
# - the project-level recipients, "users with Owner role on a cloud project",
#   because the budget is scoped to exactly this one project
#   (enable_project_level_recipients, google_billing_budget docs).
#
# A budget alerts; it does not cap spend ("Setting an alerts-only budget doesn't
# automatically cap ... usage or spending").
#
# Guard, and its limit. prevent_destroy makes a plan fail if it would destroy
# or replace this budget -- `terraform destroy`, or an edit that forces
# replacement -- but ONLY while this resource block is in the configuration.
# Terraform: "This rule doesn't prevent Terraform from destroying a resource if
# you remove its configuration" (language/meta-arguments/lifecycle). Deleting
# this block, or this file, destroys the budget in a single apply; the guard is
# never evaluated. Two further controls cover that case:
# - CI presence check: the budget-guard job in .github/workflows/build.yml, on
#   every trigger, fails when this file lacks
#   resource "google_billing_budget" "hub" or its prevent_destroy = true, or
#   when any override.tf* or *_override.tf* file is tracked under infra/.
#   Terraform merges override files into this block's lifecycle argument by
#   argument, so an override could set prevent_destroy = false.
# - Apply provenance: apply only from a clean checkout of the reviewed PR head or
#   of main with no override file in infra/ (tracked or git-ignored), and record
#   the applied commit SHA (README.md, Guardrails).
# No rollback removes this file or the budget (§12.6). prevent_destroy is kept
# over deletion_policy-style flags because it is core Terraform, works on every
# resource, and fails at plan time rather than at the API.

locals {
  budget_amount_usd = 5
}

resource "google_billing_budget" "hub" {
  billing_account = var.billing_account
  display_name    = "${var.project_id} monthly USD ${local.budget_amount_usd}"

  budget_filter {
    projects        = ["projects/${data.google_project.hub.number}"]
    calendar_period = "MONTH"
  }

  amount {
    specified_amount {
      currency_code = "USD"
      units         = tostring(local.budget_amount_usd)
    }
  }

  threshold_rules {
    threshold_percent = 0.5
  }

  threshold_rules {
    threshold_percent = 0.9
  }

  threshold_rules {
    threshold_percent = 1.0
  }

  threshold_rules {
    threshold_percent = 1.0
    spend_basis       = "FORECASTED_SPEND"
  }

  all_updates_rule {
    # The provider requires one of channels or a Pub/Sub topic; an empty list is
    # the documented way to rely on the IAM and project-owner recipients alone
    # ("Billing Budget Notify Project Recipient" example).
    monitoring_notification_channels = []
    disable_default_iam_recipients   = false
    enable_project_level_recipients  = true
  }

  lifecycle {
    prevent_destroy = true
  }

  depends_on = [google_project_service.phase1]
}
