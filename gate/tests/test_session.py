"""POST /session -- minting and verifying the session cookie (§6 resp. 1)."""

from __future__ import annotations

from datetime import timedelta

from conftest import MEMBER_EMAIL, NON_MEMBER_EMAIL, request_headers

from app.config import SESSION_COOKIE_NAME


def _post_session(client, transport, body):
    return client.post("/session", json=body, headers=request_headers(transport))


def test_member_mints_a_session_cookie(client, verifier, transport):
    verifier.add_user("good-token", MEMBER_EMAIL)

    response = _post_session(client, transport, {"idToken": "good-token"})

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    assert "set-cookie" in response.headers


def test_the_cookie_is_named_exactly___session(client, verifier, transport):
    """ADR-0004 / SEAM-2.

    Firebase Hosting strips every cookie except `__session` on a Cloud Run
    rewrite. Any other name here yields a gate that passes every direct test
    and fails only through Hosting.
    """
    verifier.add_user("good-token", MEMBER_EMAIL)

    response = _post_session(client, transport, {"idToken": "good-token"})

    assert SESSION_COOKIE_NAME == "__session"
    assert response.headers["set-cookie"].startswith("__session=")


def test_cookie_attributes_match_the_adr(client, verifier, transport):
    verifier.add_user("good-token", MEMBER_EMAIL)

    header = _post_session(client, transport, {"idToken": "good-token"}).headers["set-cookie"]
    lowered = header.lower()

    assert "httponly" in lowered
    assert "secure" in lowered
    assert "samesite=lax" in lowered
    assert "path=/" in lowered
    # 14 days (§6, ADR-0004 decision 2).
    assert "max-age=1209600" in lowered


def test_session_is_minted_for_fourteen_days(client, verifier, transport):
    verifier.add_user("good-token", MEMBER_EMAIL)

    _post_session(client, transport, {"idToken": "good-token"})

    assert verifier.minted[-1][1] == timedelta(days=14)


def test_expired_id_token_is_refused_with_no_cookie(client, verifier, transport):
    verifier.add_user("stale-token", MEMBER_EMAIL)
    verifier.expired_id_tokens.add("stale-token")

    response = _post_session(client, transport, {"idToken": "stale-token"})

    assert response.status_code == 401
    assert response.json() == {"status": "invalid_token"}
    assert "set-cookie" not in response.headers


def test_malformed_token_is_refused_with_no_cookie(client, transport):
    response = _post_session(client, transport, {"idToken": "not-a-jwt"})

    assert response.status_code == 401
    assert "set-cookie" not in response.headers


def test_verified_non_member_gets_no_cookie(client, verifier, transport):
    """SEAM-3: a successful sign-in that is not on the allowlist."""
    verifier.add_user("outsider-token", NON_MEMBER_EMAIL)

    response = _post_session(client, transport, {"idToken": "outsider-token"})

    assert response.status_code == 200
    assert response.json() == {"status": "not_a_member"}
    assert "set-cookie" not in response.headers


def test_unverified_email_is_never_a_member(client, verifier, transport):
    """An unverified address must not be able to claim an allowlisted one."""
    verifier.add_user("unverified-token", MEMBER_EMAIL, email_verified=False)

    response = _post_session(client, transport, {"idToken": "unverified-token"})

    assert response.json() == {"status": "not_a_member"}
    assert "set-cookie" not in response.headers


def test_allowlist_lookup_is_case_insensitive(client, verifier, transport):
    """SEAM-3: the gate lowercases the token's email before lookup."""
    verifier.add_user("shouty-token", "DJJay@VT.edu")

    response = _post_session(client, transport, {"idToken": "shouty-token"})

    assert response.json() == {"status": "ok"}


def test_malformed_json_does_not_echo_the_body(client, transport):
    secret = "eyJhbGciOiJSUzI1NiJ9.SUPERSECRETTOKEN"
    response = client.post(
        "/session",
        content=("{" + secret).encode(),
        headers={**request_headers(transport), "content-type": "application/json"},
    )

    assert response.status_code == 400
    assert response.json() == {"status": "invalid_request"}
    assert secret not in response.text


def test_missing_id_token_is_rejected(client, transport):
    response = _post_session(client, transport, {"notAToken": "x"})

    assert response.status_code == 400
    assert response.json() == {"status": "invalid_request"}


def test_oversized_body_is_refused_unread(client, transport):
    response = client.post(
        "/session",
        content=b"x" * 9000,
        headers={**request_headers(transport), "content-type": "application/json"},
    )

    assert response.status_code == 413
    assert response.json() == {"status": "invalid_request"}
