"""Fakes and fixtures.

There are no cloud credentials in this environment and none may be created, so
every collaborator is an in-memory fake implementing the same Protocol the
production class does. The Firestore emulator was not used: it is a Java
program and no JVM is installed here (see the handoff).

The single most important device in this file is `request_headers`. It sends
every authorisation test twice:

  * `hosting` -- as Firebase Hosting would deliver it, which means EVERY COOKIE
    EXCEPT `__session` IS STRIPPED (ADR-0004);
  * `direct`  -- as anyone on the internet can deliver it to the service's
    *.run.app URL, because the invoker is `allUsers`.

A gate that named its cookie anything else would pass every `direct` case and
fail every `hosting` one, which is exactly the failure ADR-0004 warns about,
made visible in CI instead of at Checkpoint 4.
"""

from __future__ import annotations

from datetime import timedelta

import pytest
from fastapi.testclient import TestClient

from app.auth import Principal, TokenRejected, principal_from_claims
from app.config import Settings
from app.main import Dependencies, create_app
from app.members import StaticMemberDirectory
from app.serve import StoredObject, guess_content_type

MEMBER_EMAIL = "djjay@vt.edu"
OTHER_MEMBER_EMAIL = "cbrown@vt.edu"
NON_MEMBER_EMAIL = "djjay0131@gmail.com"  # SEAM-3's documented matching trap.

# The two private items Phase 3 puts behind the gate (SEAM-7).
PRIVATE_OBJECTS = {
    "phd/milestones/index.html": b"<h1>Milestone tracker</h1>",
    "phd/committee-dossier/index.html": b"<h1>Committee dossier</h1>",
    "assets/private.css": b"body{color:#0F5C5A}",
}

HOSTING_HEADERS = {
    "host": "jason.cusati.us",
    "x-forwarded-proto": "https",
    "x-forwarded-for": "203.0.113.5",
}
DIRECT_HEADERS = {"host": "hub-gate-abcdef1234-ue.a.run.app"}


class FakeVerifier:
    """In-memory stand-in for the Firebase Admin SDK."""

    def __init__(self) -> None:
        self.id_tokens: dict[str, dict] = {}
        self.session_cookies: dict[str, dict] = {}
        self.expired_id_tokens: set[str] = set()
        self.expired_sessions: set[str] = set()
        self.revoked_sessions: set[str] = set()
        self.minted: list[tuple[str, timedelta]] = []

    def add_user(self, token: str, email: str, *, email_verified: bool = True) -> str:
        self.id_tokens[token] = {
            "email": email,
            "email_verified": email_verified,
            "sub": f"uid-{token}",
        }
        return token

    def issue_session(self, token: str) -> str:
        """Mint a session cookie directly, as POST /session would have."""
        return self.create_session_cookie(token, timedelta(days=14))

    def verify_id_token(self, id_token: str) -> Principal:
        if id_token in self.expired_id_tokens:
            raise TokenRejected("expired_id_token")
        claims = self.id_tokens.get(id_token)
        if claims is None:
            raise TokenRejected("invalid_id_token")
        return principal_from_claims(claims)

    def create_session_cookie(self, id_token: str, expires_in: timedelta) -> str:
        claims = self.id_tokens.get(id_token)
        if claims is None:
            raise TokenRejected("invalid_id_token")
        cookie = f"session-for-{id_token}"
        self.session_cookies[cookie] = claims
        self.minted.append((cookie, expires_in))
        return cookie

    def verify_session_cookie(self, cookie: str, *, check_revoked: bool) -> Principal:
        if cookie in self.expired_sessions:
            raise TokenRejected("expired_session")
        if check_revoked and cookie in self.revoked_sessions:
            raise TokenRejected("revoked_session")
        claims = self.session_cookies.get(cookie)
        if claims is None:
            raise TokenRejected("invalid_session")
        return principal_from_claims(claims)


class FakeStore:
    """In-memory private bucket that records every lookup it is asked for."""

    def __init__(self, objects: dict[str, bytes] | None = None) -> None:
        self.objects = dict(objects or {})
        self.fetches: list[str] = []

    def fetch(self, name: str) -> StoredObject | None:
        self.fetches.append(name)
        data = self.objects.get(name)
        if data is None:
            return None
        return StoredObject(
            name=name,
            size=len(data),
            content_type=guess_content_type(name),
            chunks=lambda: iter([data]),
        )


@pytest.fixture
def settings() -> Settings:
    return Settings(
        private_bucket="cusati-hub-private",
        project_id="cusati-hub",
        private_prefix="",
        members_collection="members",
        session_days=14,
        check_revoked=True,
        log_object_paths=False,
    )


@pytest.fixture
def verifier() -> FakeVerifier:
    return FakeVerifier()


@pytest.fixture
def store() -> FakeStore:
    return FakeStore(PRIVATE_OBJECTS)


@pytest.fixture
def members() -> StaticMemberDirectory:
    return StaticMemberDirectory({MEMBER_EMAIL, OTHER_MEMBER_EMAIL})


@pytest.fixture
def deps(settings, verifier, members, store) -> Dependencies:
    return Dependencies(settings=settings, verifier=verifier, members=members, store=store)


@pytest.fixture
def client(deps) -> TestClient:
    # raise_server_exceptions=False so the registered 500 handler is exercised
    # rather than the exception being re-raised into the test.
    return TestClient(create_app(deps), raise_server_exceptions=False)


@pytest.fixture(params=["hosting", "direct"])
def transport(request) -> str:
    """Every authorisation test runs through Hosting AND against run.app."""
    return request.param


def request_headers(transport: str, cookies: dict[str, str] | None = None) -> dict[str, str]:
    """Build request headers for one transport, modelling what it forwards."""
    headers = dict(HOSTING_HEADERS if transport == "hosting" else DIRECT_HEADERS)
    jar = dict(cookies or {})
    if transport == "hosting":
        # ADR-0004: Firebase Hosting forwards only `__session` to a Cloud Run
        # rewrite and strips every other cookie.
        jar = {name: value for name, value in jar.items() if name == "__session"}
    if jar:
        headers["cookie"] = "; ".join(f"{name}={value}" for name, value in jar.items())
    return headers


@pytest.fixture
def member_session(verifier) -> str:
    token = verifier.add_user("member-token", MEMBER_EMAIL)
    return verifier.issue_session(token)


@pytest.fixture
def non_member_session(verifier) -> str:
    token = verifier.add_user("outsider-token", NON_MEMBER_EMAIL)
    return verifier.issue_session(token)
