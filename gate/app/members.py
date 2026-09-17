"""The allowlist: Firestore `members/{email}`, document id lowercased.

phase-3-seams.md SEAM-3. The document id is the email LOWERCASED, and the gate
lowercases the token's email before lookup. Case-sensitive matching here is a
silent "not shared with you" -- a bug indistinguishable from correct refusal,
which is why normalisation lives in one function with its own tests.
"""

from __future__ import annotations

from typing import Any, Protocol

# A Firestore document id may not contain "/" and may not be "." or "..".
# An email address cannot legitimately be any of those, so a value that is
# becomes a refusal rather than a malformed document path.
_FORBIDDEN_IDS = frozenset({".", ".."})


def normalise_email(email: str) -> str | None:
    """Return the allowlist key for an email, or None if it cannot be one.

    Lowercasing is the whole point (SEAM-3). The rejections guard the Firestore
    document path: they are not email validation, and they are not a
    substitute for Firebase having verified the address.
    """
    key = email.strip().lower()
    if not key or "/" in key or key in _FORBIDDEN_IDS or len(key.encode("utf-8")) > 1500:
        return None
    return key


class MemberDirectory(Protocol):
    """The one question the gate asks the allowlist."""

    def is_member(self, email: str) -> bool: ...


class FirestoreMemberDirectory:
    """MemberDirectory backed by Firestore Native mode.

    Reads one document per request. The gate never writes here: member
    management is not in Phase 3 (roadmap "Not in this phase"), so the runtime
    identity needs read access only -- see the handoff's IAM section.
    """

    def __init__(self, collection: str = "members", project_id: str | None = None) -> None:
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

    def is_member(self, email: str) -> bool:
        key = normalise_email(email)
        if key is None:
            return False
        snapshot = self._ensure_client().collection(self._collection).document(key).get()
        return bool(snapshot.exists)


class StaticMemberDirectory:
    """An in-memory allowlist. Used by the tests; never wired in production."""

    def __init__(self, emails: object = ()) -> None:
        self._emails = {e.strip().lower() for e in emails}  # type: ignore[union-attr]

    def is_member(self, email: str) -> bool:
        key = normalise_email(email)
        return key is not None and key in self._emails
