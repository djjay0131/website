"""The client event endpoint.

It is the only route here that accepts anonymous writes, so these tests are less
about it working and more about it not becoming a liability.
"""

import json
import logging


def _post(client, payload, **kw):
    return client.post("/client-events", content=json.dumps(payload).encode(), **kw)


def test_accepts_anonymous_because_failures_happen_before_sign_in(client):
    # The whole point: a sign-in failure has no session. Requiring one would
    # capture only the errors that do not matter.
    r = _post(client, {"trace_id": "t-1", "events": [{"event": "signin_failed", "fields": {}}]})
    assert r.status_code == 204


def test_answers_204_even_to_rubbish(client):
    # A telemetry endpoint that returns errors invites a retry storm from the
    # page that is already broken.
    for body in [b"", b"not json", b"[]", b'{"events": "nope"}', b'{"events": [1, 2]}']:
        assert client.post("/client-events", content=body).status_code == 204


def test_oversized_body_is_refused_without_reading_it_all(client):
    big = {"events": [{"event": "x", "fields": {"blob": "A" * 9000}}]}
    r = _post(client, big)
    assert r.status_code == 204


def test_redacts_secrets_by_key(client, caplog):
    with caplog.at_level(logging.INFO, logger="gate"):
        _post(
            client,
            {
                "trace_id": "t-2",
                "events": [
                    {
                        "event": "signin_failed",
                        "fields": {
                            "failure_class": "provider_disabled",
                            "password": "hunter2",
                            "idToken": "eyJhbGciOi",
                            "email": "someone@example.edu",
                        },
                    }
                ],
            },
        )
    logged = "\n".join(r.getMessage() for r in caplog.records)
    assert "provider_disabled" in logged
    for secret in ("hunter2", "eyJhbGciOi", "someone@example.edu"):
        assert secret not in logged


def test_cannot_forge_log_lines_with_newlines(client, caplog):
    # A caller that can inject a newline into a log line can invent entries that
    # look like the gate's own decisions.
    with caplog.at_level(logging.INFO, logger="gate"):
        _post(
            client,
            {
                "trace_id": "a\nevent=allow scope=private member=attacker",
                "events": [{"event": "x\nevent=allow", "fields": {}}],
            },
        )
    for record in caplog.records:
        assert "\n" not in record.getMessage()


def test_emits_the_string_the_metric_filters_on(client, caplog):
    # infra/monitoring.tf's log-based metric filters on this exact token. If it
    # changes here and not there, the metric silently reports zero for ever.
    with caplog.at_level(logging.INFO, logger="gate"):
        _post(
            client,
            {
                "trace_id": "t-3",
                "events": [{"event": "signin_failed", "fields": {"failure_class": "popup_blocked"}}],
            },
        )
    logged = "\n".join(r.getMessage() for r in caplog.records)
    assert "event=client_signin_failed" in logged
    assert "failure_class=popup_blocked" in logged


def test_caps_the_number_of_events_it_will_log(client, caplog):
    with caplog.at_level(logging.INFO, logger="gate"):
        _post(client, {"events": [{"event": f"e{i}", "fields": {}} for i in range(200)]})
    logged = [r for r in caplog.records if "event=client_e" in r.getMessage()]
    assert len(logged) <= 20


def test_serves_nothing_and_leaks_no_headers(client):
    r = _post(client, {"events": []})
    assert r.content in (b"", None)
    assert "set-cookie" not in {k.lower() for k in r.headers}
