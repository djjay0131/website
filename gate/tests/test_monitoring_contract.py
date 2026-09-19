"""The gate's log strings are a CONTRACT with infra/monitoring.tf.

WHY THIS FILE EXISTS. `event=client_signin_failed` is written in two places: the
gate emits it, and a log-based metric in infra/monitoring.tf filters on it. Change
either alone and nothing fails -- every unit test still passes, the apply still
succeeds, the dashboard still renders. The metric simply reports zero for ever,
and the alert built on it never fires. A monitoring system that has quietly
stopped watching is worse than none, because it is also reassuring.

This is the same shape as the defect that cost this project a gate that could not
start: infra rendered PRIVATE_BUCKET, the app read GATE_PRIVATE_BUCKET, both were
individually correct, and nothing compared them. STATE records that as a standing
constraint -- "a cross-stream contract is a contract, and nothing checks it". This
is that check.
"""

import re
from pathlib import Path

import pytest

from app.main import create_app

REPO = Path(__file__).resolve().parents[2]
MAIN = REPO / "gate" / "app" / "main.py"
MONITORING = REPO / "infra" / "monitoring.tf"
GATE_WORKFLOW = REPO / ".github" / "workflows" / "gate.yml"

# The health path is a THREE-WAY contract with nothing holding it together: the
# app declares the route, infra/monitoring.tf points an uptime check at it, and
# gate.yml's smoke test curls it on every deploy. Change any one alone and
# nothing here fails -- the deploy goes green, the uptime check goes red for a
# reason no test explains, or the smoke test passes against a path Google's
# frontend answered on the service's behalf.
#
# WHY THIS PATH AND NOT /healthz. `/healthz` never reaches this container on
# Cloud Run: Google's frontend answers it with a 1568-byte error page of its own,
# no such request appears in the container log, and the same image returns
# {"status":"ok"} for /healthz when run locally. Four revisions carried a smoke
# test that could not pass. The route was moved; this is the test that stops it
# moving back, or the other two ends drifting off it.
HEALTH_PATH = "/_health"
INTERCEPTED_HEALTH_PATH = "/healthz"

# Every token the gate emits that something downstream filters on.
CONTRACTED_TOKENS = [
    "event=client_signin_failed",
    "event=deny",
]


@pytest.mark.skipif(not MONITORING.exists(), reason="infra/monitoring.tf not present")
@pytest.mark.parametrize("token", CONTRACTED_TOKENS)
def test_monitoring_filters_on_a_string_the_gate_actually_emits(token):
    tf = MONITORING.read_text(encoding="utf-8")
    assert token in tf, (
        f"infra/monitoring.tf no longer filters on {token!r}. Either the metric was "
        f"changed without changing the gate, or this contract was dropped. A metric "
        f"filtering on a string nothing emits reports zero for ever and its alert "
        f"never fires."
    )


def test_the_gate_emits_the_signin_failure_token():
    # The emitter side. Guards the reverse drift: renaming it here while
    # monitoring.tf keeps the old filter.
    source = MAIN.read_text(encoding="utf-8")
    assert "client_signin_failed" in source


def test_the_app_serves_the_health_path_and_not_the_intercepted_one(deps):
    paths = {getattr(route, "path", "") for route in create_app(deps).routes}

    assert HEALTH_PATH in paths
    assert INTERCEPTED_HEALTH_PATH not in paths, (
        "the health route is back on a path Google's frontend answers before the "
        "request reaches this container; the smoke test can never pass and the "
        "uptime check reports on Google's error page, not on the gate"
    )


@pytest.mark.skipif(not MONITORING.exists(), reason="infra/monitoring.tf not present")
def test_the_uptime_check_probes_the_path_the_app_actually_serves():
    tf = MONITORING.read_text(encoding="utf-8")

    assert re.search(rf'path\s*=\s*"{re.escape(HEALTH_PATH)}"', tf), (
        f"infra/monitoring.tf's uptime check no longer probes {HEALTH_PATH}. An "
        f"uptime check on a path the gate does not serve measures Google's 404 page."
    )


@pytest.mark.skipif(not GATE_WORKFLOW.exists(), reason=".github/workflows/gate.yml not present")
def test_the_deploy_smoke_test_probes_the_path_the_app_actually_serves():
    workflow = GATE_WORKFLOW.read_text(encoding="utf-8")

    assert f'{HEALTH_PATH}"' in workflow, (
        f"gate.yml's smoke test no longer probes {HEALTH_PATH}. This is the exact "
        f"shape of the defect that survived four revisions."
    )


@pytest.mark.skipif(not MONITORING.exists(), reason="infra/monitoring.tf not present")
def test_every_alert_policy_has_a_notification_channel():
    """An alert with no channel fires into the void.

    Carried directly from the project this design was taken from, where the single
    most important policy had `notification_channels` commented out and had been
    silently delivering nothing. A silent alert and a healthy system look
    identical from the outside, which is what makes this worth a test rather than
    a code review comment.
    """
    tf = MONITORING.read_text(encoding="utf-8")
    policies = tf.count('resource "google_monitoring_alert_policy"')
    attached = tf.count("notification_channels = [")
    assert policies > 0, "no alert policies found; did the file move?"
    assert attached >= policies, (
        f"{policies} alert policies but only {attached} notification_channels "
        f"assignments. Every policy must attach a channel."
    )
    # And it must not be commented out, which is exactly how it was lost before.
    assert "# notification_channels" not in tf
