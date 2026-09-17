"""Cache-Control on /p/**, and the headers that must never appear there.

ADR-0004: Firebase Hosting marks rewrite responses `private` by default and
varies on Cookie, so its CDN caches a gate response ONLY if the gate itself
sends `public` or `s-maxage`. A regression here leaks private content to other
visitors, and it would be invisible in every functional test -- which is why
the assertion is made on every /p/** response, refusals included.
"""

from __future__ import annotations

import pytest
from conftest import request_headers

TRACKER = "/p/phd/milestones/index.html"


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


def test_session_endpoint_is_also_uncacheable(client, verifier, transport):
    verifier.add_user("good-token", "djjay@vt.edu")

    response = client.post("/session", json={"idToken": "good-token"}, headers=request_headers(transport))

    assert response.headers["cache-control"] == "private, no-store"
    assert "s-maxage" not in response.headers["cache-control"].lower()
