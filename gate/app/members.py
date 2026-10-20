"""The allowlist: Firestore `members/{email}`, document id lowercased.

phase-3-seams.md SEAM-3. The document id is the email LOWERCASED, and the gate
lowercases the token's email before lookup. Case-sensitive matching here is a
silent "not shared with you" -- a bug indistinguishable from correct refusal,
which is why normalisation lives in one function with its own tests.
"""

from __future__ import annotations

from dataclasses import dataclass
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


def normalise_group(group: str) -> str | None:
    """Return the allowlist key for a group name, or None if it is unusable.

    Group names are lower-case tokens. A typo is a denial, never a widening,
    which is the failure direction ADR-0025 chooses.
    """
    key = group.strip().lower()
    if not key or len(key) > 64:
        return None
    if any(not (ch.isalnum() or ch == "-") for ch in key):
        return None
    return key


@dataclass(frozen=True)
class MemberProfile:
    """A member document's role and groups (ADR-0025)."""

    email: str
    role: str = "member"
    groups: frozenset[str] = frozenset()

    @property
    def is_owner(self) -> bool:
        return self.role == "owner"


class MemberDirectory(Protocol):
    """The questions the gate asks the allowlist.

    `is_owner` is the same lookup as `is_member` with the `role` field checked
    (design doc §6 responsibility 2: members with `role: owner` manage shares).
    `profile` adds the D24 role/groups view. It is separate from `is_member` so
    no route can confuse "may read" with "may mint".
    """

    def is_member(self, email: str) -> bool: ...

    def is_owner(self, email: str) -> bool: ...

    def profile(self, email: str) -> MemberProfile | None: ...


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

    def profile(self, email: str) -> MemberProfile | None:
        key = normalise_email(email)
        if key is None:
            return None
        snapshot = self._ensure_client().collection(self._collection).document(key).get()
        if not snapshot.exists:
            return None
        data = snapshot.to_dict() or {}
        role = "owner" if data.get("role") == "owner" else "member"
        groups = frozenset(
            normalised
            for group in (data.get("groups") or [])
            if isinstance(group, str) and (normalised := normalise_group(group))
        )
        return MemberProfile(email=key, role=role, groups=groups)

    def is_member(self, email: str) -> bool:
        return self.profile(email) is not None

    def is_owner(self, email: str) -> bool:
        profile = self.profile(email)
        return profile is not None and profile.is_owner


class StaticMemberDirectory:
    """An in-memory allowlist. Used by the tests; never wired in production."""

    def __init__(self, emails: object = (), owners: object = (), groups: object = None) -> None:
        self._emails = {e.strip().lower() for e in emails}  # type: ignore[union-attr]
        self._owners = {e.strip().lower() for e in owners}  # type: ignore[union-attr]
        self._groups = {
            str(email).strip().lower(): frozenset(
                normalised
                for group in (values or [])  # type: ignore[union-attr]
                if (normalised := normalise_group(str(group)))
            )
            for email, values in (groups or {}).items()  # type: ignore[union-attr]
        }

    def profile(self, email: str) -> MemberProfile | None:
        key = normalise_email(email)
        if key is None or key not in self._emails:
            return None
        return MemberProfile(
            email=key,
            role="owner" if key in self._owners else "member",
            groups=self._groups.get(key, frozenset()),
        )

    def is_member(self, email: str) -> bool:
        return self.profile(email) is not None

    def is_owner(self, email: str) -> bool:
        profile = self.profile(email)
        return profile is not None and profile.is_owner
