"""Share links: a bounded, revocable read grant for one item.

Design doc §6 responsibility 4 and `phase-4-seams.md` SEAM-S1..S3. A share names
ONE item by `(section, source, slug)` and stores it at Firestore
`shares/{token}`:

    { section, source, slug, exp, revoked, created_by, created_at }

The token is the document id and is minted with `secrets.token_urlsafe(32)` --
256 bits, twice the brief's floor. `exp` is computed on the server and
`expires_in_days` is capped at 30; the route that mints never trusts a
client-supplied instant. One token addresses one item and can never address a
second.

The shape mirrors `members.py`: a Protocol, a Firestore implementation for
production, and a static implementation that is the test double. There are no
cloud credentials in the development environment and none may be created.
"""

from __future__ import annotations

import secrets
from dataclasses import dataclass, replace
from datetime import UTC, datetime, timedelta
from typing import Any, Protocol

# SEAM-S1: expires_in_days ∈ [1, 30]. Enforced here as well as at the route, so
# no caller and no future route can mint a longer grant by bypassing validation.
MIN_SHARE_DAYS = 1
MAX_SHARE_DAYS = 30

# 32 bytes -> 43 characters of URL-safe base64. `secrets`, not `random`: this is
# the only credential a share holder presents.
TOKEN_BYTES = 32


def mint_token() -> str:
    """A fresh share token. Never log it and never return it in a list."""
    return secrets.token_urlsafe(TOKEN_BYTES)


def expiry_from_days(days: int, *, now: datetime | None = None) -> datetime:
    """The UTC expiry for a grant, refusing anything outside [1, 30]."""
    if not MIN_SHARE_DAYS <= days <= MAX_SHARE_DAYS:
        raise ValueError("expires_in_days must be between 1 and 30")
    moment = now or datetime.now(UTC)
    return moment + timedelta(days=days)


@dataclass(frozen=True)
class Share:
    """One row of `shares/{token}`."""

    token: str
    section: str
    source: str
    slug: str
    exp: datetime
    revoked: bool
    created_by: str
    created_at: datetime

    def is_active(self, *, now: datetime | None = None) -> bool:
        """True only while the grant is neither revoked nor past its expiry.

        `now` is injectable so a test can expire a share without sleeping and
        so the decision is a pure function of stored state.
        """
        moment = now or datetime.now(UTC)
        return not self.revoked and self.exp > moment


class ShareStore(Protocol):
    """The operations the gate needs from the share store."""

    def create(self, share: Share) -> None: ...

    def get(self, token: str) -> Share | None: ...

    def list_active(self) -> list[Share]: ...

    def revoke(self, token: str) -> None: ...


def _share_from_document(token: str, data: dict[str, Any]) -> Share | None:
    """Build a Share from a Firestore document, or None if it is malformed.

    A document missing a field is refused rather than defaulted: a share with an
    unknown expiry is not a share, and defaulting `revoked` to False would serve
    bytes a corrupt row never granted.
    """
    section = data.get("section")
    source = data.get("source")
    slug = data.get("slug")
    created_by = data.get("created_by")
    exp = data.get("exp")
    created_at = data.get("created_at")
    if not all(isinstance(value, str) and value for value in (section, source, slug, created_by)):
        return None
    if not isinstance(exp, datetime) or not isinstance(created_at, datetime):
        return None
    return Share(
        token=token,
        section=section,
        source=source,
        slug=slug,
        exp=exp,
        revoked=bool(data.get("revoked", False)),
        created_by=created_by,
        created_at=created_at,
    )


class FirestoreShareStore:
    """ShareStore backed by Firestore Native mode.

    Reads and writes `shares/{token}` only. Firestore cannot restrict an IAM
    grant to a collection, so the runtime service account's `datastore.user`
    grant is project-wide; the collection discipline is this class and the
    deny-all released rules that keep the Web SDK out (SEAM-S5).
    """

    def __init__(self, collection: str = "shares", project_id: str | None = None) -> None:
        self._collection = collection
        self._project_id = project_id
        self._client: Any | None = None

    def _ensure_client(self) -> Any:
        # Lazy import: keeps the module importable without cloud credentials.
        from google.cloud import firestore

        if self._client is None:
            self._client = (
                firestore.Client(project=self._project_id) if self._project_id else firestore.Client()
            )
        return self._client

    def create(self, share: Share) -> None:
        self._ensure_client().collection(self._collection).document(share.token).set(
            {
                "section": share.section,
                "source": share.source,
                "slug": share.slug,
                "exp": share.exp,
                "revoked": share.revoked,
                "created_by": share.created_by,
                "created_at": share.created_at,
            }
        )

    def get(self, token: str) -> Share | None:
        snapshot = self._ensure_client().collection(self._collection).document(token).get()
        if not snapshot.exists:
            return None
        return _share_from_document(token, snapshot.to_dict() or {})

    def list_active(self) -> list[Share]:
        # The `exp` filter is applied in Python, not in the query. Firestore
        # needs a composite index for an equality filter on one field plus an
        # inequality on another; keeping the query to the automatic single-field
        # index on `revoked` means listing works without an infra-managed index.
        now = datetime.now(UTC)
        query = self._ensure_client().collection(self._collection).where("revoked", "==", False)
        shares = [
            share
            for doc in query.stream()
            if (share := _share_from_document(doc.id, doc.to_dict() or {})) and share.exp > now
        ]
        shares.sort(key=lambda share: share.created_at, reverse=True)
        return shares

    def revoke(self, token: str) -> None:
        # Idempotent and non-creating: a token that does not exist is already
        # revoked as far as a caller can observe.
        reference = self._ensure_client().collection(self._collection).document(token)
        if reference.get().exists:
            reference.update({"revoked": True})


class StaticShareStore:
    """In-memory ShareStore. Used by the tests; never wired in production."""

    def __init__(self, shares: object = ()) -> None:
        self._shares: dict[str, Share] = {share.token: share for share in shares}  # type: ignore[union-attr]

    def create(self, share: Share) -> None:
        self._shares[share.token] = share

    def get(self, token: str) -> Share | None:
        return self._shares.get(token)

    def list_active(self) -> list[Share]:
        now = datetime.now(UTC)
        return [share for share in self._shares.values() if share.is_active(now=now)]

    def revoke(self, token: str) -> None:
        existing = self._shares.get(token)
        if existing is not None:
            self._shares[token] = replace(existing, revoked=True)
