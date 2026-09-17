"""Identity: verifying Firebase ID tokens and minting/verifying session cookies.

The gate never sees a password and never stores a credential. It verifies
tokens Firebase issued, and mints a Firebase session cookie in exchange
(design doc §6 responsibility 1; ADR-0004 decision 2).

The concrete Firebase implementation sits behind a small Protocol so the
request-handling code can be tested without cloud credentials, which do not
exist in this environment and may not be created.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta
from typing import Any, Protocol


class TokenRejected(Exception):
    """An ID token or session cookie did not verify.

    Carries a short machine-readable reason for logging. The reason is never
    returned to the caller: every refusal renders the same static body.
    """

    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


@dataclass(frozen=True)
class Principal:
    """Who the caller is, as far as Firebase is concerned.

    `email_verified` is carried separately from membership: an unverified email
    is never treated as a member, because sign-up with an unverified address
    would otherwise be a way to claim an allowlisted identity.
    """

    email: str
    email_verified: bool
    uid: str | None = None


class TokenVerifier(Protocol):
    """The identity operations the gate needs. Implemented by Firebase Admin."""

    def verify_id_token(self, id_token: str) -> Principal: ...

    def create_session_cookie(self, id_token: str, expires_in: timedelta) -> str: ...

    def verify_session_cookie(self, cookie: str, *, check_revoked: bool) -> Principal: ...


def principal_from_claims(claims: dict[str, Any]) -> Principal:
    """Extract the identity fields the gate uses from a decoded token.

    A token with no `email` claim cannot match an allowlist keyed by email, so
    it is refused here rather than silently becoming a non-member.
    """
    email = claims.get("email")
    if not isinstance(email, str) or not email.strip():
        raise TokenRejected("no_email_claim")
    return Principal(
        email=email.strip(),
        email_verified=bool(claims.get("email_verified", False)),
        uid=claims.get("uid") or claims.get("sub"),
    )


class FirebaseTokenVerifier:
    """TokenVerifier backed by the Firebase Admin SDK.

    The Admin SDK is initialised from Application Default Credentials. On Cloud
    Run those come from the metadata server as the service's runtime service
    account -- there is no key file, and adding one would be a review failure
    (design doc §12.2).
    """

    def __init__(self, project_id: str | None = None) -> None:
        self._project_id = project_id
        self._app: Any | None = None

    def _ensure_app(self) -> Any:
        # Imported lazily so the module can be imported (and the rest of the
        # gate unit-tested) on a machine with no cloud credentials at all.
        import firebase_admin
        from firebase_admin import credentials

        if self._app is None:
            try:
                self._app = firebase_admin.get_app()
            except ValueError:
                options = {"projectId": self._project_id} if self._project_id else None
                self._app = firebase_admin.initialize_app(credentials.ApplicationDefault(), options)
        return self._app

    def verify_id_token(self, id_token: str) -> Principal:
        from firebase_admin import auth as fb_auth

        app = self._ensure_app()
        try:
            claims = fb_auth.verify_id_token(id_token, app=app, check_revoked=True)
        except fb_auth.ExpiredIdTokenError as exc:
            raise TokenRejected("expired_id_token") from exc
        except fb_auth.RevokedIdTokenError as exc:
            raise TokenRejected("revoked_id_token") from exc
        except fb_auth.InvalidIdTokenError as exc:
            raise TokenRejected("invalid_id_token") from exc
        except fb_auth.UserDisabledError as exc:
            raise TokenRejected("user_disabled") from exc
        except ValueError as exc:
            # The SDK raises bare ValueError for a structurally malformed token.
            raise TokenRejected("malformed_id_token") from exc
        return principal_from_claims(claims)

    def create_session_cookie(self, id_token: str, expires_in: timedelta) -> str:
        from firebase_admin import auth as fb_auth

        app = self._ensure_app()
        try:
            return fb_auth.create_session_cookie(id_token, expires_in=expires_in, app=app)
        except fb_auth.InvalidIdTokenError as exc:
            raise TokenRejected("invalid_id_token") from exc
        except ValueError as exc:
            raise TokenRejected("malformed_id_token") from exc

    def verify_session_cookie(self, cookie: str, *, check_revoked: bool) -> Principal:
        from firebase_admin import auth as fb_auth

        app = self._ensure_app()
        try:
            claims = fb_auth.verify_session_cookie(cookie, check_revoked=check_revoked, app=app)
        except fb_auth.ExpiredSessionCookieError as exc:
            raise TokenRejected("expired_session") from exc
        except fb_auth.RevokedSessionCookieError as exc:
            raise TokenRejected("revoked_session") from exc
        except fb_auth.InvalidSessionCookieError as exc:
            raise TokenRejected("invalid_session") from exc
        except fb_auth.UserDisabledError as exc:
            raise TokenRejected("user_disabled") from exc
        except ValueError as exc:
            raise TokenRejected("malformed_session") from exc
        return principal_from_claims(claims)
