"""Scope and hygiene.

The gate's route table is asserted exactly, so a new route cannot appear without
a matching test and a matching README entry. Wave 3 added the Phase 4 sharing
routes (design doc §6 responsibility 4); the listing is now:

  * /share and /share/{token} -- owner-only mint/list/revoke, and
  * /s/{token}/{path} -- the session-less share view.
"""

from __future__ import annotations

import pytest
from conftest import request_headers

from app.main import create_app
from app.members import normalise_email


def test_the_route_table_is_exactly_this(deps):
    paths = {getattr(route, "path", "") for route in create_app(deps).routes}

    # /client-events is the only unauthenticated writable route; it reads nothing
    # and serves nothing (test_client_events.py). /session/end is sign-out (SD-4).
    # The /share and /s/** entries are Wave 3's Phase 4 sharing routes.
    #
    # This assertion is exact on purpose: its job is to make a new route fail
    # loudly rather than appear un-tested and un-documented.
    assert paths == {
        "/session",
        "/session/end",
        "/p/{path:path}",
        "/share",
        "/share/{token}",
        "/s/{token}/{path:path}",
        "/_health",
        "/client-events",
    }


@pytest.mark.parametrize("path", ["/share/extra/deep", "/members", "/admin"])
def test_surfaces_that_do_not_exist_answer_404(client, path, transport):
    response = client.get(path, headers=request_headers(transport))

    assert response.status_code == 404


def test_an_unknown_share_token_does_not_answer_200(client, transport):
    response = client.get("/s/unknown-token/index.html", headers=request_headers(transport))

    assert response.status_code == 404


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
