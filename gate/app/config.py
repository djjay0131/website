"""Runtime configuration, read from the environment.

Everything here is set by Cloud Run (the infra stream owns the service's env
block). Nothing here is a credential: the gate runs as its own service account
and obtains tokens from the metadata server through Application Default
Credentials, so there is no key file to configure and none may be added
(design doc §12.2).
"""

from __future__ import annotations

import os
from dataclasses import dataclass

# ADR-0004, and phase-3-seams.md SEAM-2. Firebase Hosting forwards only the
# cookie named `__session` to a Cloud Run rewrite and strips every other cookie
# ("Manage cache behavior"). This is deliberately NOT configurable: an env var
# would make it possible to deploy a gate that passes every direct test and
# fails only through Hosting, which is precisely the failure the ADR names.
SESSION_COOKIE_NAME = "__session"

# Firebase caps a session cookie at 14 days, which is also what §6 specifies.
SESSION_MAX_DAYS = 14

_TRUTHY = frozenset({"1", "true", "yes", "on"})


def _flag(name: str, *, default: bool) -> bool:
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return default
    return raw.strip().lower() in _TRUTHY


def _positive_int(name: str, *, default: int, maximum: int) -> int:
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return default
    try:
        value = int(raw)
    except ValueError as exc:
        raise ValueError(f"{name} must be an integer, got {raw!r}") from exc
    if not 1 <= value <= maximum:
        raise ValueError(f"{name} must be between 1 and {maximum}, got {value}")
    return value


@dataclass(frozen=True)
class Settings:
    """Immutable runtime settings."""

    private_bucket: str
    project_id: str | None
    private_prefix: str
    members_collection: str
    session_days: int
    check_revoked: bool
    log_object_paths: bool

    @property
    def session_max_age_seconds(self) -> int:
        return self.session_days * 24 * 60 * 60


def load_settings() -> Settings:
    """Build Settings from the process environment.

    Raises ValueError when a required value is missing, so a misconfigured
    revision fails at startup rather than serving requests it cannot satisfy.
    """
    bucket = os.environ.get("GATE_PRIVATE_BUCKET", "").strip()
    if not bucket:
        raise ValueError("GATE_PRIVATE_BUCKET is required: the gate has nothing to serve without it.")

    prefix = os.environ.get("GATE_PRIVATE_PREFIX", "").strip().strip("/")

    return Settings(
        private_bucket=bucket,
        project_id=(os.environ.get("GOOGLE_CLOUD_PROJECT") or os.environ.get("GATE_PROJECT_ID") or None),
        private_prefix=prefix,
        members_collection=os.environ.get("GATE_MEMBERS_COLLECTION", "members").strip() or "members",
        session_days=_positive_int("GATE_SESSION_DAYS", default=SESSION_MAX_DAYS, maximum=SESSION_MAX_DAYS),
        # Revocation is checked on every request by default. It costs an
        # Identity Toolkit lookup per request, and it is what makes "sign this
        # person out everywhere" actually work for a committee dossier.
        check_revoked=_flag("GATE_CHECK_REVOKED", default=True),
        # Off by default: an object path under /p/** IS a private slug, and
        # Cloud Logging is readable by anyone with project-level log access.
        log_object_paths=_flag("GATE_LOG_OBJECT_PATHS", default=False),
    )
