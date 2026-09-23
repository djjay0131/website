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
from urllib.parse import urlsplit

# ADR-0004, and phase-3-seams.md SEAM-2. Firebase Hosting forwards only the
# cookie named `__session` to a Cloud Run rewrite and strips every other cookie
# ("Manage cache behavior"). This is deliberately NOT configurable: an env var
# would make it possible to deploy a gate that passes every direct test and
# fails only through Hosting, which is precisely the failure the ADR names.
SESSION_COOKIE_NAME = "__session"

# Firebase caps a session cookie at 14 days, which is also what §6 specifies.
SESSION_MAX_DAYS = 14

_TRUTHY = frozenset({"1", "true", "yes", "on"})

# The variable that carries the CSRF check's accepted-origin set. Comma
# separated, each entry a serialized https origin: scheme://host[:port], nothing
# else. It MUST name both origins the gate answers on, because ADR-0004 puts the
# Cloud Run invoker at `allUsers`: the site's domain and the service's own
# *.run.app URL. Unset means /session/end refuses every request -- see
# app/main.py `_same_origin`, and the handoff for why that direction is correct.
ALLOWED_ORIGINS_VAR = "GATE_ALLOWED_ORIGINS"


def parse_origin(text: str) -> str | None:
    """Normalise a serialized origin, or return None when it is not one.

    ONE function parses both ends of the CSRF comparison -- the configured set
    and the incoming `Origin` header -- so the two cannot disagree about case,
    about a trailing slash, or about what an origin even is. A set built by a
    different rule than the one the request is measured against is the shape of
    every "it matched in staging" defect.

    A serialized origin is scheme://host[:port] and nothing else. `null`, a bare
    hostname, an http:// downgrade, userinfo, and anything carrying a path, query
    or fragment are all refused.
    """
    candidate = text.strip()
    if not candidate:
        return None
    parsed = urlsplit(candidate)
    if parsed.scheme != "https" or not parsed.netloc:
        return None
    if parsed.path or parsed.query or parsed.fragment:
        return None
    # user:pass@host would make `https://evil.example@real.example` read as the
    # real host to a careless comparison.
    if parsed.username or parsed.password:
        return None
    return f"https://{parsed.netloc.lower()}"


def _allowed_origins(name: str) -> frozenset[str]:
    """Parse the accepted-origin set. Anything malformed is dropped, not guessed.

    A dropped entry is not silent: create_app() logs the set it ended up with at
    boot, so a typo shows as an origin missing from that line rather than as a
    sign-out that mysteriously 403s months later.
    """
    raw = os.environ.get(name, "")
    parsed = (parse_origin(candidate) for candidate in raw.split(","))
    return frozenset(origin for origin in parsed if origin is not None)


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
    # The CSRF check's accepted origins. NOT derived from any request header:
    # that was the defect. Empty means /session/end refuses everything.
    allowed_origins: frozenset[str]

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
        # Deliberately NOT required at startup, unlike GATE_PRIVATE_BUCKET, and
        # the difference is reasoned: an unset bucket means the gate has nothing
        # to serve, so refusing to boot costs nothing. An unset origin list means
        # one route -- sign-out -- cannot be used. Refusing to boot on it would
        # take the private area down to protect a nuisance-grade POST. So the
        # gate boots, logs the misconfiguration at ERROR, and refuses every
        # sign-out; gate.yml's deploy smoke test asserts a same-origin sign-out
        # returns 200, so an unset variable fails the deploy rather than sitting
        # there quietly.
        allowed_origins=_allowed_origins(ALLOWED_ORIGINS_VAR),
    )
