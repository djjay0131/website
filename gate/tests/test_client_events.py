"""The client event endpoint.

It is the only route here that accepts anonymous writes, so these tests are less
about it working and more about it not becoming a liability.
"""

import json
import logging

from conftest import through_the_gates_own_handler


def _post(client, payload, **kw):
    return client.post("/client-events", content=json.dumps(payload).encode(), **kw)


def _written(client, payload):
    """Post a batch and return what the gate's OWN handler wrote.

    NOT caplog. Four assertions in this file still use it and are blind to a
    missing handler (recorded as G-4); nothing below adds a fifth.
    """
    return through_the_gates_own_handler(lambda: _post(client, payload))


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


# ---------------------------------------------------------------------------
# Metric forgery (#54). The endpoint is unauthenticated BY DESIGN and stays so --
# it exists to hear from a browser that has FAILED to sign in, so requiring a
# credential would defeat it (ADR-0013). What is closed here is narrower: both
# log-based metrics match a SUBSTRING of textPayload anywhere in the line, so a
# client-supplied value carrying `event=` can make a metric count an event that
# never happened. Demonstrated against production.
# ---------------------------------------------------------------------------


def test_a_field_value_cannot_smuggle_the_denials_metric_trigger(client):
    """The exact payload that made production count a denial that never happened.

    `note=event=deny` survives _clean_client_value() -- correctly, since it has
    no newline and no space -- and the denials metric matches `event=deny`
    anywhere in the line. From an endpoint that performs no authorisation at all.
    """
    written = _written(
        client,
        {"trace_id": "t-forge", "events": [{"event": "probe", "fields": {"note": "event=deny"}}]},
    )

    assert "event=deny" not in written, "an anonymous caller just forged a denial"
    assert "event=client_grammar_rejected" in written


def test_a_field_value_cannot_smuggle_the_signin_failure_metric_trigger(client):
    written = _written(
        client,
        {
            "trace_id": "t-forge",
            "events": [{"event": "probe", "fields": {"failure_class": "event=client_signin_failed"}}],
        },
    )

    assert "event=client_signin_failed" not in written
    assert "event=client_grammar_rejected" in written


def test_the_trace_id_cannot_smuggle_it_either(client):
    """The trace id is client-supplied too, and it is on every line of the batch."""
    written = _written(
        client,
        {"trace_id": "event=deny", "events": [{"event": "probe", "fields": {}}]},
    )

    assert "event=deny" not in written
    assert "event=client_grammar_rejected" in written


def test_the_event_name_cannot_smuggle_it_either(client):
    written = _written(client, {"trace_id": "t-forge", "events": [{"event": "x event=deny"}]})

    assert "event=deny" not in written


def test_case_does_not_get_it_past(client):
    """`EVENT=deny` is the same forgery with the shift key held down."""
    written = _written(
        client,
        {"trace_id": "t-forge", "events": [{"event": "probe", "fields": {"note": "EVENT=deny"}}]},
    )

    assert "EVENT=deny" not in written
    assert "event=deny" not in written.lower().replace("event=client_grammar_rejected", "")


def test_a_rejected_report_is_counted_and_kept_not_dropped(client):
    """Dropping it silently is the same blindness in a different costume.

    This endpoint exists because browser-side failures were invisible. A report
    discarded for looking suspicious is invisible too -- and the caller would
    learn which payloads vanish. So it is counted, reclassified, and emitted with
    the offending text neutralised, which is what an operator reads in Cloud
    Logging.
    """
    written = _written(
        client,
        {
            "trace_id": "t-forge",
            "events": [{"event": "probe", "fields": {"note": "event=deny", "why": "event=allow"}}],
        },
    )

    assert "smuggled=2" in written, written
    assert "reported=probe" in written
    # The content survives, neutralised, so the report is still diagnostic.
    assert "note=event-deny" in written
    assert "why=event-allow" in written


def test_a_smuggled_signin_failure_is_not_counted_as_a_signin_failure(client):
    """Reclassification is the point: the caller does not choose its metric.

    A report that tries to smuggle the grammar is not trustworthy as a sign-in
    failure either, so it does not get to land in the sign-in-failure metric by
    naming itself `signin_failed`.
    """
    written = _written(
        client,
        {
            "trace_id": "t-forge",
            "events": [{"event": "signin_failed", "fields": {"note": "event=deny"}}],
        },
    )

    assert "event=client_signin_failed" not in written
    assert "event=client_grammar_rejected" in written
    assert "reported=signin_failed" in written


def test_an_honest_report_is_untouched_and_still_reaches_the_metric(client):
    """The regression guard for the two above: ordinary reports must be unaffected.

    Asserted through the gate's own handler rather than caplog, so it also fails
    if the gate cannot log at all -- which is the state that made both metrics
    dead on arrival for 48 hours.
    """
    written = _written(
        client,
        {
            "trace_id": "t-ok",
            "events": [{"event": "signin_failed", "fields": {"failure_class": "popup_blocked"}}],
        },
    )

    assert "event=client_signin_failed" in written
    assert "failure_class=popup_blocked" in written
    assert "client_grammar_rejected" not in written


def test_serves_nothing_and_leaks_no_headers(client):
    r = _post(client, {"events": []})
    assert r.content in (b"", None)
    assert "set-cookie" not in {k.lower() for k in r.headers}
