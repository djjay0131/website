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


# ---------------------------------------------------------------------------
# Every alert policy has a channel attached (#57).
#
# WHAT THIS REPLACES, AND WHY IT HAD TO CHANGE. The previous guard counted the
# literal string `notification_channels = [` and required one per policy. That
# asserts a SPELLING; its own docstring states the property. PR #53 replaces all
# three inline list literals with `local.alert_notification_channels`, and that
# local concatenates the email channel with an optional SMS one -- so every
# policy gains a SECOND delivery path. The count went to 0 while the code
# IMPROVED, and the guard went red at the moment of the improvement. Verified:
# main 3 policies / 3 matches; the infra branch 3 policies / 0 matches.
#
# A guard that goes red on an improvement gets deleted, and the invariant goes
# with it. So the property is asserted instead: every policy block carries a
# `notification_channels` assignment with a non-empty value -- inline list,
# `local.*` or variable alike.
#
# The guard is a pure function over text so that it can be tested against inputs
# this repository does not contain, which is the only way to show it FAILING on a
# policy that delivers nowhere without breaking a file this stream does not own.
# ---------------------------------------------------------------------------

ALERT_POLICY = re.compile(r'^resource "google_monitoring_alert_policy" "([^"]+)"', re.MULTILINE)
# A top-level HCL block starts in column 1. Everything inside one -- including
# the indented heredocs these policies carry, braces and all -- does not, so this
# is where one policy's text ends. Brace counting would be defeated by `${...}`
# and `%{...}` inside those heredocs.
NEXT_TOP_LEVEL_BLOCK = re.compile(r"^[a-z]", re.MULTILINE)
CHANNEL_ASSIGNMENT = re.compile(r"^[ \t]*notification_channels\s*=\s*(.*)$", re.MULTILINE)


def _assigned_channel_value(block: str) -> str | None:
    """The right-hand side of a policy's `notification_channels`, or None."""
    found = CHANNEL_ASSIGNMENT.search(block)
    if found is None:
        return None
    value = found.group(1).strip()
    if value.startswith("[") and not value.endswith("]"):
        # A list literal spread over several lines.
        value = value + block[found.end() :].split("]", 1)[0] + "]"
    return value


def _delivers_somewhere(value: str | None) -> bool:
    """Is this assignment's value capable of naming a channel at all?"""
    if value is None:
        return False
    inner = value.strip()
    if inner.startswith("[") and inner.endswith("]"):
        inner = inner[1:-1]
    inner = inner.replace(",", " ").strip()
    return bool(inner) and inner != "null"


def policies_without_a_channel(tf: str) -> list[str]:
    """Names of the alert policies in `tf` that would deliver nowhere."""
    missing = []
    for match in ALERT_POLICY.finditer(tf):
        end = NEXT_TOP_LEVEL_BLOCK.search(tf, match.end())
        block = tf[match.end() : end.start() if end else len(tf)]
        if not _delivers_somewhere(_assigned_channel_value(block)):
            missing.append(match.group(1))
    return missing


def _policy(name: str, channels: str) -> str:
    """A minimal alert policy, with the heredoc braces that defeat naive parsing."""
    return (
        f'resource "google_monitoring_alert_policy" "{name}" ' + "{\n"
        '  display_name = "example"\n'
        "  conditions {\n    condition_threshold {\n      trigger { count = 1 }\n    }\n  }\n"
        f"{channels}"
        "  documentation {\n    content = <<-EOT\n"
        "      braces in a heredoc: ${var.project_id} and %{http_code}\n"
        "    EOT\n  }\n}\n"
    )


ATTACHED = [
    ("inline list", "  notification_channels = [google_monitoring_notification_channel.ops_email.id]\n"),
    ("a local, which is what #53 moves to", "  notification_channels = local.alert_notification_channels\n"),
    ("a variable", "  notification_channels = var.alert_channels\n"),
    (
        "a multi-line list",
        "  notification_channels = [\n    google_monitoring_notification_channel.ops_email.id,\n  ]\n",
    ),
]

DELIVERS_NOWHERE = [
    ("no assignment at all", ""),
    ("an empty list", "  notification_channels = []\n"),
    ("commented out, which is how it was lost before", "  # notification_channels = [x]\n"),
    ("an empty multi-line list", "  notification_channels = [\n  ]\n"),
]


@pytest.mark.parametrize("label,channels", ATTACHED, ids=[label for label, _ in ATTACHED])
def test_the_channel_guard_accepts_every_spelling_of_an_attached_channel(label, channels):
    """The property is delivery, not formatting. This is the half #57 was about."""
    assert policies_without_a_channel(_policy("p", channels)) == [], label


@pytest.mark.parametrize("label,channels", DELIVERS_NOWHERE, ids=[label for label, _ in DELIVERS_NOWHERE])
def test_the_channel_guard_catches_a_policy_that_delivers_nowhere(label, channels):
    """And the guard can still fail, which is the only thing that makes it a guard."""
    assert policies_without_a_channel(_policy("p", channels)) == ["p"], label


def test_the_channel_guard_finds_every_policy_in_a_multi_policy_file():
    # The count matters as much as the verdict. A parser that silently saw one
    # policy in a three-policy file would report "nothing missing" for ever while
    # checking almost nothing -- a vacuous guard counted as coverage.
    tf = (
        _policy("has_a_local", "  notification_channels = local.alert_notification_channels\n")
        + _policy("has_nothing", "")
        + _policy("has_a_list", "  notification_channels = [x]\n")
    )

    assert policies_without_a_channel(tf) == ["has_nothing"]


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
    declared = tf.count('resource "google_monitoring_alert_policy"')

    assert declared > 0, "no alert policies found; did the file move?"
    # The parser must see every policy the file declares, or its verdict is empty.
    assert len(ALERT_POLICY.findall(tf)) == declared, (
        "the alert-policy parser did not see every policy in monitoring.tf; its "
        "verdict covers only the ones it found"
    )

    missing = policies_without_a_channel(tf)
    assert missing == [], (
        f"alert policies that would deliver nowhere: {missing}. Every policy must "
        f"attach a channel -- inline list, local.* or variable alike."
    )
    # And it must not be commented out, which is exactly how it was lost before.
    assert "# notification_channels" not in tf
