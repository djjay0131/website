"""Scope and hygiene.

Phase 3 builds §6 responsibilities 1-3. Share links -- responsibility 4,
/s/** and /share/** -- are Phase 4 and the roadmap lists them under "Not in
this phase". These tests fail if someone adds them early, including as a stub:
a half-built share route that answers at all is a way to reach private bytes
without a session.
"""

from __future__ import annotations

import pytest
from conftest import request_headers

from app.main import create_app
from app.members import normalise_email


def test_no_share_routes_are_declared(deps):
    paths = {getattr(route, "path", "") for route in create_app(deps).routes}

    # /client-events is the fourth route, added deliberately: browser errors had
    # nowhere to go, so a sign-in failure could only be diagnosed by a person
    # describing symptoms. It is the ONLY unauthenticated writable route, and it
    # reads nothing and serves nothing -- see test_client_events.py.
    #
    # This assertion is exact on purpose. Its job is to make a new route -- a
    # half-built share endpoint especially -- fail loudly rather than appear.
    # /session/end is the fifth, added for SD-4: a 14-day HttpOnly cookie with no
    # in-band clear meant a member on a shared machine could not sign out. It is
    # session teardown, not a share route -- see tests/test_signout.py.
    assert paths == {
        "/session",
        "/session/end",
        "/p/{path:path}",
        "/_health",
        "/client-events",
    }


@pytest.mark.parametrize(
    "path",
    ["/s/token/index.html", "/share/token", "/share", "/s/", "/members", "/admin"],
)
def test_phase_four_and_admin_surfaces_do_not_answer(client, path, transport):
    response = client.get(path, headers=request_headers(transport))

    assert response.status_code == 404


def test_share_mint_is_not_implemented(client, member_session, transport):
    response = client.post(
        "/share",
        json={"slug": "milestones", "expires_in_days": 14},
        headers=request_headers(transport, {"__session": member_session}),
    )

    assert response.status_code in (404, 405)


def test_no_schema_document_is_published(client, transport):
    """The service answers anyone at *.run.app; it publishes no route map."""
    for path in ("/openapi.json", "/docs", "/redoc"):
        assert client.get(path, headers=request_headers(transport)).status_code == 404


def test_healthz_reveals_nothing(client, transport):
    response = client.get("/_health", headers=request_headers(transport))

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("djjay@vt.edu", "djjay@vt.edu"),
        ("DJJay@VT.edu", "djjay@vt.edu"),
        ("  DJJAY@VT.EDU  ", "djjay@vt.edu"),
    ],
)
def test_emails_normalise_to_the_allowlist_key(raw, expected):
    assert normalise_email(raw) == expected


@pytest.mark.parametrize("raw", ["", "   ", ".", "..", "a/b@example.com", "x" * 1600])
def test_emails_that_cannot_be_document_ids_are_refused(raw):
    assert normalise_email(raw) is None
