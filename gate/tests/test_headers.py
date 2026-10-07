"""Cache-Control on /p/**, and the headers that must never appear there.

ADR-0004: Firebase Hosting marks rewrite responses `private` by default and
varies on Cookie, so its CDN caches a gate response ONLY if the gate itself
sends `public` or `s-maxage`. A regression here leaks private content to other
visitors, and it would be invisible in every functional test -- which is why
the assertion is made on every /p/** response, refusals included.
"""

from __future__ import annotations

from dataclasses import replace

import pytest
from conftest import FakeStore, request_headers
from fastapi.testclient import TestClient

from app.main import _is_payload_object, create_app

TRACKER = "/p/phd/milestones/index.html"
# AN-CAP 3: the capture island reads the selection from the item payload iframe
# at `/p/_payload/<source>/<path>`, same origin as the frame, so a SERVED
# private payload document is the one response that may be framed by its own
# origin. `conftest.PRIVATE_OBJECTS` holds this object.
PAYLOAD = "/p/_payload/phd-milestones/site/committee.html"


def _all_private_responses(client, member_session, non_member_session, verifier, transport):
    """One response per class of /p/** outcome."""
    dead = verifier.issue_session(verifier.add_user("dead-token", "djjay@vt.edu"))
    verifier.expired_sessions.add(dead)

    return {
        "served": client.get(TRACKER, headers=request_headers(transport, {"__session": member_session})),
        "signed_out": client.get(TRACKER, headers=request_headers(transport)),
        "non_member": client.get(
            TRACKER, headers=request_headers(transport, {"__session": non_member_session})
        ),
        "expired": client.get(TRACKER, headers=request_headers(transport, {"__session": dead})),
        "traversal": client.get(
            "/p/../../etc/passwd", headers=request_headers(transport, {"__session": member_session})
        ),
        "missing": client.get(
            "/p/phd/nothing/index.html",
            headers=request_headers(transport, {"__session": member_session}),
        ),
        "asset": client.get(
            "/p/assets/private.css", headers=request_headers(transport, {"__session": member_session})
        ),
    }


def test_every_private_response_is_private_no_store(
    client, member_session, non_member_session, verifier, transport
):
    responses = _all_private_responses(client, member_session, non_member_session, verifier, transport)

    for label, response in responses.items():
        assert response.headers["cache-control"] == "private, no-store", label


def test_no_private_response_is_cacheable_by_the_cdn(
    client, member_session, non_member_session, verifier, transport
):
    """The explicit assertion the contract and the roadmap both require."""
    responses = _all_private_responses(client, member_session, non_member_session, verifier, transport)

    for label, response in responses.items():
        cache_control = response.headers["cache-control"].lower()
        assert "public" not in cache_control, label
        assert "s-maxage" not in cache_control, label


def test_private_responses_vary_on_cookie(client, member_session, non_member_session, verifier, transport):
    responses = _all_private_responses(client, member_session, non_member_session, verifier, transport)

    for label, response in responses.items():
        assert "cookie" in response.headers["vary"].lower(), label


@pytest.mark.parametrize(
    "header,value",
    [
        ("x-content-type-options", "nosniff"),
        ("referrer-policy", "no-referrer"),
        ("x-frame-options", "DENY"),
    ],
)
def test_security_headers_are_present(client, member_session, header, value, transport):
    response = client.get(TRACKER, headers=request_headers(transport, {"__session": member_session}))

    assert response.headers[header] == value


def test_a_served_payload_document_is_frameable_by_the_same_origin(client, member_session, transport):
    """AN-CAP 3: `_payload/**` is served SAMEORIGIN so the capture island works."""
    response = client.get(PAYLOAD, headers=request_headers(transport, {"__session": member_session}))

    assert response.status_code == 200
    assert response.headers["x-frame-options"] == "SAMEORIGIN"


@pytest.mark.parametrize(
    "name,prefix,expected",
    [
        ("_payload/a/b.html", "", True),
        ("_payload", "", True),
        ("_payloadx/a", "", False),
        ("phd/_payload/a", "", False),
        ("hub/_payload/a/b.html", "hub", True),
        ("_payload/a/b.html", "hub", False),
        ("hubx/_payload/a", "hub", False),
    ],
)
def test_the_payload_object_check_strips_the_private_prefix(name, prefix, expected):
    assert _is_payload_object(name, prefix) is expected


def test_a_payload_document_under_a_private_prefix_is_frameable(deps, member_session):
    """AN-CAP 3 with a non-empty GATE_PRIVATE_PREFIX: strip it, then check."""
    settings = replace(deps.settings, private_prefix="hub")
    store = FakeStore({"hub/_payload/phd-milestones/site/committee.html": b"<h1>payload</h1>"})
    client = TestClient(
        create_app(replace(deps, settings=settings, store=store)), raise_server_exceptions=False
    )

    response = client.get(
        "/p/_payload/phd-milestones/site/committee.html",
        headers=request_headers("direct", {"__session": member_session}),
    )

    assert response.status_code == 200
    assert response.headers["x-frame-options"] == "SAMEORIGIN"


def test_a_non_payload_document_keeps_deny(client, member_session, transport):
    response = client.get(TRACKER, headers=request_headers(transport, {"__session": member_session}))

    assert response.headers["x-frame-options"] == "DENY"


def test_a_refused_or_missing_payload_keeps_deny(client, member_session, transport):
    """Only a SERVED payload is frameable; a 404 or a refusal keeps DENY."""
    signed_out = client.get(PAYLOAD, headers=request_headers(transport))
    missing = client.get(
        "/p/_payload/phd-milestones/site/missing.html",
        headers=request_headers(transport, {"__session": member_session}),
    )
    traversal = client.get(
        "/p/_payload/../../etc/passwd",
        headers=request_headers(transport, {"__session": member_session}),
    )

    assert signed_out.status_code == 404
    assert missing.status_code == 404
    assert traversal.status_code == 404
    assert signed_out.headers["x-frame-options"] == "DENY"
    assert missing.headers["x-frame-options"] == "DENY"
    assert traversal.headers["x-frame-options"] == "DENY"


def test_session_endpoint_is_also_uncacheable(client, verifier, transport):
    verifier.add_user("good-token", "djjay@vt.edu")

    response = client.post("/session", json={"idToken": "good-token"}, headers=request_headers(transport))

    assert response.headers["cache-control"] == "private, no-store"
    assert "s-maxage" not in response.headers["cache-control"].lower()
