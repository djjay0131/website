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
# THE SECOND CHANNEL, WHICH DOES NOT DEPEND ON EMAIL.
#
# WHY. On 2026-09-18 the email channel above had no verificationStatus field at
# all, which means unverified: Google emailed the address at 15:27:37Z and until
# that link is clicked all three policies accept events and deliver NOTHING.
# The owner separately reports that Firebase sign-in emails never arrive. Two
# independent symptoms pointing at one delivery problem is enough to stop
# designing alerting that depends on email, so this channel exists to give the
# chain a second, unrelated delivery path.
#
# WHY SMS AND NOT A WEBHOOK. A webhook channel is free in Cloud Monitoring but
# is not free of a RECEIVER, and no receiver exists here at zero cost that the
# owner already operates. pubsub has the same problem one layer down: it
# delivers to a topic, and a topic is not a person. slack, pagerduty and
# google_chat each need an account or a space this project does not have.
# sms is GA in this project, needs no third party, and Cloud Monitoring's
# pricing bills metrics ingestion, API calls, uptime checks and alerting-policy
# metric references -- not notification delivery. Channel types available here
# were read from the API rather than assumed:
#   GET https://monitoring.googleapis.com/v3/projects/<project>/notificationChannelDescriptors
# returns campfire(DEPRECATED), email, google_chat(BETA), hipchat(DEPRECATED),
# pagerduty(BETA), pubsub, slack, sms, webhook_basicauth, webhook_tokenauth.
#
# ITS VERIFICATION PATH IS THE POINT: Google sends a code by SMS and the owner
# enters it. That path shares nothing with email, so it still works if email
# delivery is the thing that is broken.
#
# GOOGLE'S OWN CAVEAT, recorded rather than glossed: "SMS isn't a fully reliable
# notification channel type, and it might not be available in certain regions",
# and Google recommends pairing it with a different type. That is exactly what
# this is -- a SECOND channel beside email, not a replacement for it. Both are
# attached to every policy below.
#
# OFF BY DEFAULT. ops_sms_number is "" unless the owner sets it, because a
# channel pointing at no number is worse than no channel: it looks like
# redundancy and delivers nothing, which is the failure this whole file exists
# to stop repeating.
resource "google_monitoring_notification_channel" "ops_sms" {
  count = var.ops_sms_number == "" ? 0 : 1

  project      = var.project_id
  display_name = "Hub ops SMS"
  type         = "sms"

  labels = {
    number = var.ops_sms_number
  }

  force_delete = false
}

locals {
  # Every policy attaches EVERY configured channel. The rule learned from the
  # reference project was a policy whose channels were commented out; the rule
  # learned here is that one channel is a single point of delivery failure.
  alert_notification_channels = concat(
    [google_monitoring_notification_channel.ops_email.id],
    google_monitoring_notification_channel.ops_sms[*].id,
  )
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

  notification_channels = local.alert_notification_channels

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

  notification_channels = local.alert_notification_channels

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

  notification_channels = local.alert_notification_channels

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

# ---------------------------------------------------------------------------
# THE GATE CAME UP MISCONFIGURED (issue #54; gate handoff gate-wave-0-fixes.md;
# Chief Reviewer routing 2026-09-19).
#
# WHY THIS IS NOT COVERED BY WHAT IS ALREADY HERE. The gate's CSRF check now
# builds its accepted-origin set from GATE_ALLOWED_ORIGINS and has NO header
# fallback: unset, POST /session/end refuses every request and no member can
# sign out. The gate stream's own risk note says plainly that its "the deploy
# fails loudly" claim leans on .github/workflows/gate.yml's smoke assertions,
# which the Skeptic Verifier recorded as un-failable by construction (U-2) and
# which that stream was told not to touch. So the deploy is NOT the safety net.
#
# What is independently solid is the log: the revision emits
# event=misconfigured at ERROR once at startup. That is what this watches.
#
# It is deliberately a SEPARATE policy from the denial spike. hub-gate-denials
# already matches the resulting refusals (they log event=deny), so a
# misconfigured deploy would eventually show up there -- but only once a member
# tries to sign out and fails, and reported as "denials are up" rather than as
# "the gate started without its origin set". This fires at BOOT, before anyone
# is affected, and names the cause.
#
# COST, stated because a new resource needs one (§12.6). Two charges exist and
# both are effectively zero here:
#   - The log-based metric is a user-defined metric, chargeable by bytes
#     ingested, against a free allotment of the first 150 MiB per billing
#     account per month. A DELTA counter whose filter matches a single line at
#     startup ingests a negligible number of bytes, and this project is far
#     below the allotment.
#   - Alerting policies are billed "$0.35 per month for each metric reference in
#     an alerting policy", with NO free allotment -- but the effective date on
#     Google's pricing summary is 1 September 2027. Until then this policy is
#     free. From that date it costs $0.35/month, and the three policies already
#     in this file start costing the same each, so the whole file becomes about
#     $1.40/month against the $5 budget. That is worth knowing in advance; it is
#     not a reason to leave a loud failure unwatched today.
# ---------------------------------------------------------------------------
resource "google_logging_metric" "gate_misconfigured" {
  project = var.project_id
  name    = "hub-gate-misconfigured"

  # Emitted once, at startup, by a revision that came up without a setting it
  # cannot work without. The gate's line is:
  #   event=misconfigured setting=GATE_ALLOWED_ORIGINS effect=signout_refuses_every_request
  # Anchored on the EVENT rather than on the setting name, so a second such
  # setting is covered the day it exists rather than the day someone remembers
  # this file.
  filter = <<-EOT
    resource.type="cloud_run_revision"
    resource.labels.service_name="${google_cloud_run_v2_service.gate.name}"
    textPayload:"event=misconfigured"
  EOT

  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
    unit        = "1"
  }
}

resource "google_monitoring_alert_policy" "gate_misconfigured" {
  project      = var.project_id
  display_name = "Hub — gate started misconfigured"
  combiner     = "OR"

  conditions {
    display_name = "gate logged event=misconfigured at startup"
    condition_threshold {
      filter = join(" AND ", [
        "metric.type=\"logging.googleapis.com/user/${google_logging_metric.gate_misconfigured.name}\"",
        # Sharp edge 1: the alert filter must constrain resource.type even
        # though the log metric's own filter already does.
        "resource.type=\"cloud_run_revision\"",
      ])

      # ANY occurrence. One is a fault: a revision only logs this when it came
      # up unable to do its job.
      comparison      = "COMPARISON_GT"
      threshold_value = 0
      duration        = "0s"

      aggregations {
        alignment_period = "300s"
        # Sharp edge 2: DELTA metric, so ALIGN_DELTA.
        per_series_aligner = "ALIGN_DELTA"
      }

      trigger { count = 1 }

      # INACTIVE, for the same reason as the sign-in failure counter: this is a
      # FAULT counter, and no data means no revision has come up misconfigured,
      # which is the state we want. ACTIVE would page continuously on a healthy
      # service and an alert that cries wolf gets muted.
      evaluation_missing_data = "EVALUATION_MISSING_DATA_INACTIVE"
    }
  }

  notification_channels = local.alert_notification_channels

  documentation {
    mime_type = "text/markdown"
    content   = <<-EOT
      A gate revision started without a setting it cannot work without, and said so.

      Today that means GATE_ALLOWED_ORIGINS is unset or empty. The CSRF check then
      has no accepted origins at all, so POST /session/end refuses EVERY request
      and no member can sign out. It fails CLOSED -- nothing is exposed, no session
      is affected -- but the sign-out capability is gone until this is fixed.

      What the revision said:

          gcloud logging read 'resource.type="cloud_run_revision" AND textPayload:"event=misconfigured"' --project ${var.project_id} --freshness=1h --limit=10

      What it actually parsed at boot (allowed_origins=none is the tell):

          gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="${google_cloud_run_v2_service.gate.name}" AND textPayload:"event=boot"' --project ${var.project_id} --freshness=1h --limit=1 --format='value(textPayload)'

      What it should be, and the URL the service actually answers on -- these two
      must agree, and the second may use the older <service>-<hash>-<region>.a.run.app
      spelling this module cannot construct:

          terraform -chdir=infra output -raw gate_allowed_origins
          gcloud run services describe ${google_cloud_run_v2_service.gate.name} --project ${var.project_id} --region ${var.region} --format 'value(status.url)'

      Fix: apply infra/ so the env var reaches the service (Terraform owns the env
      block; gate.yml owns only the image), then roll a revision. If the serving URL
      is a spelling this module does not construct, add it to
      var.gate_extra_allowed_origins rather than editing the service by hand.
    EOT
  }
}
