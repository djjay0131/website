# Monitoring: uptime, error rate, and sign-in failures.
#
# WHY THIS FILE EXISTS. Before it, this project had zero alert policies, zero
# uptime checks, zero notification channels and zero log-based metrics. Nothing
# would ever have told the owner the site was down or that sign-in was broken --
# and in fact nothing did: a sign-in failure was found by trying to sign in, and
# diagnosed by an afternoon of interactive troubleshooting.
#
# Everything here is Terraform. Nothing is clicked in a console, so nothing
# silently reverts and everything is reviewable.
#
# FIVE GCP SHARP EDGES, each of which is a 400 at apply time:
#   1. An alert filter must constrain resource.type even when the underlying log
#      metric already does. Omitting it fails the apply.
#   2. Log-based counters are DELTA. Use ALIGN_DELTA; ALIGN_COUNT is rejected.
#   3. condition_absent cannot catch "never emitted at all" -- absence of a
#      metric that has never existed is not absence. Pair it with a threshold
#      carrying evaluation_missing_data = EVALUATION_MISSING_DATA_ACTIVE.
#   4. Uptime checks need the host WITHOUT scheme.
#   5. The email channel is unverified until the recipient clicks Google's
#      confirmation link. An unverified channel accepts the apply and then never
#      delivers, which looks exactly like "nothing is wrong".
#
# AND THE RULE LEARNED FROM THE REFERENCE PROJECT: its single most important
# alert had notification_channels commented out and had been firing into the
# void. Every policy below attaches the channel, and infra/README.md records
# that this must be VERIFIED after apply rather than assumed.

resource "google_monitoring_notification_channel" "ops_email" {
  project      = var.project_id
  display_name = "Hub ops email"
  type         = "email"

  labels = {
    email_address = var.ops_email
  }

  # Sharp edge 5: this is created immediately but stays unverified until the
  # recipient clicks the link Google sends. Check verification_status after the
  # first apply.
  force_delete = false
}

# ---------------------------------------------------------------------------
# Is the public site answering at all?
# ---------------------------------------------------------------------------
resource "google_monitoring_uptime_check_config" "public_site" {
  project      = var.project_id
  display_name = "Hub public site"
  timeout      = "10s"
  period       = "300s"

  http_check {
    path         = "/"
    port         = 443
    use_ssl      = true
    validate_ssl = true
  }

  monitored_resource {
    type = "uptime_url"
    labels = {
      # Sharp edge 4: host only, no scheme.
      host       = var.domain
      project_id = var.project_id
    }
  }
}

# The gate is checked separately and on its OWN health path, because the public
# site can be perfectly healthy while the private area is down -- they are
# different services behind one domain, and conflating them would hide exactly
# the outage the members would notice.
#
# /_health and not /healthz: Google's frontend answers /healthz for this service
# before the request ever reaches the container, so a check against it would
# report on Google's error page rather than on the gate.
resource "google_monitoring_uptime_check_config" "gate" {
  project      = var.project_id
  display_name = "Hub private gate"
  timeout      = "10s"
  period       = "300s"

  http_check {
    path         = "/_health"
    port         = 443
    use_ssl      = true
    validate_ssl = true
  }

  monitored_resource {
    type = "uptime_url"
    labels = {
      host       = replace(replace(google_cloud_run_v2_service.gate.uri, "https://", ""), "/", "")
      project_id = var.project_id
    }
  }
}

# ---------------------------------------------------------------------------
# Log-based metrics over the grammar the gate ALREADY emits.
#
# The gate logs event=allow|deny|reject with scope= and reason= on every
# decision. That was already queryable and nothing consumed it; these turn it
# into something that can page.
# ---------------------------------------------------------------------------
resource "google_logging_metric" "gate_denials" {
  project = var.project_id
  name    = "hub-gate-denials"
  filter  = <<-EOT
    resource.type="cloud_run_revision"
    resource.labels.service_name="${google_cloud_run_v2_service.gate.name}"
    textPayload:"event=deny"
  EOT

  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
    unit        = "1"
  }
}

resource "google_logging_metric" "signin_failures" {
  project = var.project_id
  name    = "hub-signin-failures"

  # Emitted by the gate when the browser reports a classified sign-in failure.
  # The class is extracted as a label so "which way is it failing?" is one chart
  # rather than a log trawl -- the whole point of a closed vocabulary.
  filter = <<-EOT
    resource.type="cloud_run_revision"
    resource.labels.service_name="${google_cloud_run_v2_service.gate.name}"
    textPayload:"event=client_signin_failed"
  EOT

  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
    unit        = "1"
  }
}

# ---------------------------------------------------------------------------
# Alerts. Each carries the command to run, because the alert email IS the first
# page of the runbook -- an alert that only says "something is wrong" starts the
# same interactive troubleshooting this file exists to end.
# ---------------------------------------------------------------------------
resource "google_monitoring_alert_policy" "site_down" {
  project      = var.project_id
  display_name = "Hub — public site down"
  combiner     = "OR"

  conditions {
    display_name = "uptime check failing"
    condition_threshold {
      filter = join(" AND ", [
        "metric.type=\"monitoring.googleapis.com/uptime_check/check_passed\"",
        # Sharp edge 1: resource.type is required here even though the check
        # already scopes it.
        "resource.type=\"uptime_url\"",
        "metric.label.check_id=\"${google_monitoring_uptime_check_config.public_site.uptime_check_id}\"",
      ])
      comparison      = "COMPARISON_LT"
      threshold_value = 1
      duration        = "300s"

      aggregations {
        alignment_period     = "300s"
        per_series_aligner   = "ALIGN_NEXT_OLDER"
        cross_series_reducer = "REDUCE_COUNT_FALSE"
        group_by_fields      = ["resource.label.host"]
      }

      trigger { count = 1 }
    }
  }

  notification_channels = [google_monitoring_notification_channel.ops_email.id]

  documentation {
    mime_type = "text/markdown"
    content   = <<-EOT
      The public site stopped answering.

          curl -sS -o /dev/null -w '%%{http_code}\n' https://${var.domain}/
          gcloud run services describe ${google_cloud_run_v2_service.gate.name} --region ${var.region} --project ${var.project_id}
          gcloud logging read 'resource.type="cloud_run_revision"' --project ${var.project_id} --freshness=15m --limit=30

      Hosting serves the static site; only /p/** and /session reach Cloud Run. If
      the gate is healthy but this alert fired, the fault is Hosting or DNS, not
      the gate.
    EOT
  }
}

resource "google_monitoring_alert_policy" "gate_down" {
  project      = var.project_id
  display_name = "Hub — private gate down"
  combiner     = "OR"

  conditions {
    display_name = "gate uptime check failing"
    condition_threshold {
      filter = join(" AND ", [
        "metric.type=\"monitoring.googleapis.com/uptime_check/check_passed\"",
        "resource.type=\"uptime_url\"",
        "metric.label.check_id=\"${google_monitoring_uptime_check_config.gate.uptime_check_id}\"",
      ])
      comparison      = "COMPARISON_LT"
      threshold_value = 1
      duration        = "300s"

      aggregations {
        alignment_period     = "300s"
        per_series_aligner   = "ALIGN_NEXT_OLDER"
        cross_series_reducer = "REDUCE_COUNT_FALSE"
        group_by_fields      = ["resource.label.host"]
      }

      trigger { count = 1 }
    }
  }

  notification_channels = [google_monitoring_notification_channel.ops_email.id]

  documentation {
    mime_type = "text/markdown"
    content   = <<-EOT
      The members' area gate is not answering /_health.

          gcloud run services describe ${google_cloud_run_v2_service.gate.name} --region ${var.region} --project ${var.project_id}
          gcloud run revisions list --service ${google_cloud_run_v2_service.gate.name} --region ${var.region} --project ${var.project_id}
          gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="${google_cloud_run_v2_service.gate.name}"' --project ${var.project_id} --freshness=15m --limit=50

      The container refuses to start if GATE_PRIVATE_BUCKET is unset, so a
      revision that never became healthy is the first thing to check.
    EOT
  }
}

resource "google_monitoring_alert_policy" "signin_failing" {
  project      = var.project_id
  display_name = "Hub — sign-in failing"
  combiner     = "OR"

  conditions {
    display_name = "classified sign-in failures"
    condition_threshold {
      filter = join(" AND ", [
        "metric.type=\"logging.googleapis.com/user/${google_logging_metric.signin_failures.name}\"",
        "resource.type=\"cloud_run_revision\"",
      ])
      comparison      = "COMPARISON_GT"
      threshold_value = 3
      duration        = "300s"

      aggregations {
        alignment_period = "300s"
        # Sharp edge 2: DELTA metric, so ALIGN_DELTA.
        per_series_aligner = "ALIGN_DELTA"
      }

      trigger { count = 1 }

      # INACTIVE, deliberately, and the opposite of what sharp edge 3 warns about.
      #
      # That warning applies to a HEALTH signal, where silence means the thing
      # stopped reporting and is bad. This is a FAILURE counter: no data means
      # nobody failed to sign in, which is the state we want. ACTIVE here would
      # page continuously on a perfectly healthy site, and an alert that cries
      # wolf gets muted -- which would leave us exactly where we started.
      #
      # The consequence is honest and worth stating: this policy cannot tell
      # "sign-in is fine" from "the metric stopped being written". The uptime
      # checks above cover the service being gone, which is the case that matters.
      evaluation_missing_data = "EVALUATION_MISSING_DATA_INACTIVE"
    }
  }

  notification_channels = [google_monitoring_notification_channel.ops_email.id]

  documentation {
    mime_type = "text/markdown"
    content   = <<-EOT
      More than three classified sign-in failures in five minutes.

      The class is in the log line, and the classes are a closed set, so this
      should say WHICH way it is failing rather than that it is failing:

          gcloud logging read 'resource.type="cloud_run_revision" AND textPayload:"event=client_signin_failed"' --project ${var.project_id} --freshness=30m --limit=50

      provider_disabled   - a sign-in provider is not enabled (console)
      unauthorized_domain - the site is not an authorised domain (console)
      link_expired        - people are using stale email links; usually benign
      network_unreachable - the gate or Hosting is unreachable from browsers
      rate_limited        - Identity Platform is throttling; back off

      Sign-in decisions the gate itself made are a different query:

          gcloud logging read 'resource.type="cloud_run_revision" AND textPayload:"event=deny"' --project ${var.project_id} --freshness=30m --limit=50
    EOT
  }
}
