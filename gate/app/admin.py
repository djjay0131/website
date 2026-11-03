"""Owner administration for members, groups, access rules and the change log.

D32 / ADR-0029. This module is the write half of the access model that
`access.py` and `members.py` already read:

  * `members/{email}` -- role and groups;
  * `access_policy/current` -- default, section, source and item rules;
  * `access_audit` -- one appended record per write;
  * `calendar_audit` and `share_audit` -- the other two change-log sources.

The repository is public, so this module contains no member email, group name,
source name or item key. Every value is a request argument.

Two properties are deliberate and pinned by tests:

  * every mutation is one Firestore transaction that also appends its audit
    record, so a write without a record is impossible;
  * the owner cannot demote or remove themselves. A presentation site whose
    only owner can lock themselves out is one bad click from no administrator.
"""

from __future__ import annotations

import re
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any, Protocol

from .access import parse_access_policy
from .members import MemberProfile, normalise_email, normalise_group

POLICY_COLLECTION = "access_policy"
POLICY_DOCUMENT = "current"
MEMBERS_COLLECTION = "members"
ACCESS_AUDIT_COLLECTION = "access_audit"
CALENDAR_AUDIT_COLLECTION = "calendar_audit"
SHARE_AUDIT_COLLECTION = "share_audit"
POLICY_VERSION = 1

_NAME_PATTERN = re.compile(r"^[a-z0-9][a-z0-9-]{0,63}$")
_SEGMENT_PATTERN = re.compile(r"^[A-Za-z0-9._-]+$")
_SCOPES = {"default": None, "section": "sections", "source": "sources", "item": "items"}


class AdminError(Exception):
    """A refused admin operation. `code` is safe to return to the owner."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


@dataclass(frozen=True)
class MemberRecord:
    email: str
    role: str
    groups: tuple[str, ...]

    def as_json(self) -> dict[str, Any]:
        return {"email": self.email, "role": self.role, "groups": list(self.groups)}


def _clean_groups(values: object) -> list[str]:
    if values is None:
        return []
    if not isinstance(values, list):
        raise AdminError("invalid_groups")
    out: list[str] = []
    for value in values:
        if not isinstance(value, str):
            raise AdminError("invalid_groups")
        clean = normalise_group(value)
        if clean is None:
            raise AdminError("invalid_groups")
        if clean not in out:
            out.append(clean)
    return sorted(out)


def _clean_names(values: object, field: str) -> list[str]:
    if values is None:
        return []
    if not isinstance(values, list):
        raise AdminError(f"invalid_{field}")
    out: list[str] = []
    for value in values:
        if not isinstance(value, str) or not _NAME_PATTERN.fullmatch(value):
            raise AdminError(f"invalid_{field}")
        if value not in out:
            out.append(value)
    return out


def _clean_role(value: object) -> str:
    if value not in ("owner", "member"):
        raise AdminError("invalid_role")
    return str(value)


def _clean_scope(scope: object, name: object) -> tuple[str, str | None]:
    if scope == "default":
        if name not in (None, ""):
            raise AdminError("invalid_scope")
        return "default", None
    if scope not in _SCOPES or not isinstance(name, str) or not name:
        raise AdminError("invalid_scope")
    if scope == "item":
        parts = name.split("/")
        if len(parts) != 3 or not all(_SEGMENT_PATTERN.fullmatch(part) for part in parts):
            raise AdminError("invalid_scope")
    elif not _SEGMENT_PATTERN.fullmatch(name):
        raise AdminError("invalid_scope")
    return str(scope), name


def _audit_record(actor: str, action: str, target: str, before: object, after: object) -> dict[str, Any]:
    return {
        "at": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
        "by": actor,
        "action": action,
        "target": target,
        "before": before,
        "after": after,
    }


class AdminStore(Protocol):
    def list_members(self) -> list[MemberRecord]: ...

    def add_member(
        self, email: str, role: str, groups: list[str], note: str | None, actor: str
    ) -> MemberRecord: ...

    def update_member(self, email: str, role: str, groups: list[str], actor: str) -> MemberRecord: ...

    def remove_member(self, email: str, actor: str) -> None: ...

    def policy(self) -> dict[str, Any]: ...

    def set_rule(
        self, scope: str, name: str | None, groups: list[str], roles: list[str], actor: str
    ) -> dict[str, Any]: ...

    def clear_rule(self, scope: str, name: str | None, actor: str) -> dict[str, Any]: ...

    def audit(self, limit: int = 100) -> list[dict[str, Any]]: ...

    def record_share(self, action: str, target: str, actor: str) -> None: ...


def _member_record(email: str, data: dict[str, Any]) -> MemberRecord:
    role = "owner" if data.get("role") == "owner" else "member"
    groups = _clean_groups(data.get("groups") or [])
    return MemberRecord(email=email, role=role, groups=tuple(groups))


def _empty_policy(actor: str) -> dict[str, Any]:
    return {
        "version": POLICY_VERSION,
        "default": {"groups": [], "roles": []},
        "sections": {},
        "sources": {},
        "items": {},
        "updated_at": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
        "updated_by": actor,
    }


def _validate_policy(policy: object) -> dict[str, Any]:
    """Reject anything the gate's own parser would reject, then return it."""
    try:
        parse_access_policy(policy)
    except ValueError as exc:
        raise AdminError("invalid_policy") from exc
    if not isinstance(policy, dict):
        raise AdminError("invalid_policy")
    return policy


class FirestoreAdminStore:
    """AdminStore backed by the same Firestore documents the gate reads."""

    def __init__(
        self,
        *,
        project_id: str | None = None,
        members_collection: str = MEMBERS_COLLECTION,
        policy_collection: str = POLICY_COLLECTION,
        policy_document: str = POLICY_DOCUMENT,
        access_audit_collection: str = ACCESS_AUDIT_COLLECTION,
        calendar_audit_collection: str = CALENDAR_AUDIT_COLLECTION,
        share_audit_collection: str = SHARE_AUDIT_COLLECTION,
        client: Any | None = None,
    ) -> None:
        self._project_id = project_id
        self._members = members_collection
        self._policy_collection = policy_collection
        self._policy_document = policy_document
        self._access_audit = access_audit_collection
        self._calendar_audit = calendar_audit_collection
        self._share_audit = share_audit_collection
        self._client = client

    def _ensure_client(self) -> Any:
        from google.cloud import firestore

        if self._client is None:
            self._client = (
                firestore.Client(project=self._project_id) if self._project_id else firestore.Client()
            )
        return self._client

    def _run(self, callback: Any) -> Any:
        """Run one read-write Firestore transaction.

        A method rather than `@client.transactional`: the SDK exposes the
        decorator at module level, and importing it lazily keeps this module
        importable without cloud credentials (the test suite's requirement).
        """
        from google.cloud import firestore

        client = self._ensure_client()

        @firestore.transactional
        def _wrapped(transaction: Any) -> Any:
            return callback(transaction)

        return _wrapped(client.transaction())

    # --- members ---------------------------------------------------------

    def list_members(self) -> list[MemberRecord]:
        rows = [
            _member_record(doc.id, doc.to_dict() or {})
            for doc in self._ensure_client().collection(self._members).stream()
        ]
        rows.sort(key=lambda row: row.email)
        return rows

    def add_member(
        self, email: str, role: str, groups: list[str], note: str | None, actor: str
    ) -> MemberRecord:
        key = normalise_email(email)
        if key is None:
            raise AdminError("invalid_email")
        clean_role = _clean_role(role)
        clean_groups = _clean_groups(groups)
        client = self._ensure_client()
        reference = client.collection(self._members).document(key)

        def _write(transaction: Any) -> None:
            snapshot = reference.get(transaction=transaction)
            if snapshot.exists:
                raise AdminError("member_exists")
            after = {
                "added_at": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
                "added_by": actor,
                "groups": clean_groups,
                "role": clean_role,
            }
            if note:
                after["note"] = note
            transaction.set(reference, after)
            self._append_audit(
                transaction,
                self._access_audit,
                actor,
                "add_member",
                f"member:{key}",
                None,
                {"role": clean_role, "groups": clean_groups},
            )

        self._run(_write)
        return MemberRecord(email=key, role=clean_role, groups=tuple(clean_groups))

    def update_member(self, email: str, role: str, groups: list[str], actor: str) -> MemberRecord:
        key = normalise_email(email)
        if key is None:
            raise AdminError("invalid_email")
        clean_role = _clean_role(role)
        clean_groups = _clean_groups(groups)
        if key == normalise_email(actor) and clean_role != "owner":
            raise AdminError("owner_cannot_demote_self")
        client = self._ensure_client()
        reference = client.collection(self._members).document(key)

        def _write(transaction: Any) -> None:
            snapshot = reference.get(transaction=transaction)
            if not snapshot.exists:
                raise AdminError("member_missing")
            before = _member_record(key, snapshot.to_dict() or {})
            after = {"role": clean_role, "groups": clean_groups}
            transaction.update(reference, after)
            self._append_audit(
                transaction,
                self._access_audit,
                actor,
                "update_member",
                f"member:{key}",
                before.as_json(),
                after,
            )

        self._run(_write)
        return MemberRecord(email=key, role=clean_role, groups=tuple(clean_groups))

    def remove_member(self, email: str, actor: str) -> None:
        key = normalise_email(email)
        if key is None:
            raise AdminError("invalid_email")
        if key == normalise_email(actor):
            raise AdminError("owner_cannot_remove_self")
        client = self._ensure_client()
        reference = client.collection(self._members).document(key)

        def _write(transaction: Any) -> None:
            snapshot = reference.get(transaction=transaction)
            if not snapshot.exists:
                raise AdminError("member_missing")
            before = _member_record(key, snapshot.to_dict() or {})
            if before.role == "owner":
                # There is one owner today; refusing every owner removal keeps
                # that true even if a second owner is ever added by mistake.
                raise AdminError("cannot_remove_owner")
            transaction.delete(reference)
            self._append_audit(
                transaction,
                self._access_audit,
                actor,
                "remove_member",
                f"member:{key}",
                before.as_json(),
                None,
            )

        self._run(_write)

    # --- policy ----------------------------------------------------------

    def policy(self) -> dict[str, Any]:
        snapshot = (
            self._ensure_client().collection(self._policy_collection).document(self._policy_document).get()
        )
        if not snapshot.exists:
            raise AdminError("policy_missing")
        return _validate_policy(snapshot.to_dict() or {})

    def _mutate_policy(self, actor: str, mutate: Any, action: str, target: str) -> dict[str, Any]:
        client = self._ensure_client()
        reference = client.collection(self._policy_collection).document(self._policy_document)

        def _write(transaction: Any) -> dict[str, Any]:
            snapshot = reference.get(transaction=transaction)
            before = _validate_policy(snapshot.to_dict() or {}) if snapshot.exists else None
            working = (
                _empty_policy(actor)
                if before is None
                else {
                    **{
                        key: (dict(value) if isinstance(value, dict) else value)
                        for key, value in before.items()
                    }
                }
            )
            after = _validate_policy(mutate(working))
            after["updated_at"] = datetime.now(UTC).isoformat().replace("+00:00", "Z")
            after["updated_by"] = actor
            transaction.set(reference, after)
            self._append_audit(transaction, self._access_audit, actor, action, target, before, after)
            return after

        return self._run(_write)

    def set_rule(
        self, scope: str, name: str | None, groups: list[str], roles: list[str], actor: str
    ) -> dict[str, Any]:
        clean_scope, clean_name = _clean_scope(scope, name)
        rule = {"groups": _clean_names(groups, "groups"), "roles": _clean_names(roles, "roles")}
        collection = _SCOPES.get(clean_scope)
        if collection is None:
            raise AdminError("invalid_scope")

        def mutate(policy: dict[str, Any]) -> dict[str, Any]:
            policy.setdefault(collection, {})
            if clean_scope == "default":
                policy["default"] = rule
            else:
                policy[collection][clean_name] = rule
            return policy

        target = "default" if clean_name is None else f"{clean_scope}:{clean_name}"
        return self._mutate_policy(actor, mutate, "set_rule", target)

    def clear_rule(self, scope: str, name: str | None, actor: str) -> dict[str, Any]:
        clean_scope, clean_name = _clean_scope(scope, name)
        if clean_scope == "default":
            raise AdminError("default_cannot_be_cleared")
        collection = _SCOPES[clean_scope]

        def mutate(policy: dict[str, Any]) -> dict[str, Any]:
            rules = policy.get(collection) or {}
            if clean_name not in rules:
                raise AdminError("rule_missing")
            del rules[clean_name]
            return policy

        return self._mutate_policy(actor, mutate, "clear_rule", f"{clean_scope}:{clean_name}")

    # --- change log ------------------------------------------------------

    def _append_audit(
        self,
        transaction: Any,
        collection: str,
        actor: str,
        action: str,
        target: str,
        before: object,
        after: object,
    ) -> None:
        client = self._ensure_client()
        reference = client.collection(collection).document(uuid.uuid4().hex)
        transaction.set(reference, _audit_record(actor, action, target, before, after))

    def _read_audit(self, collection: str, limit: int) -> list[dict[str, Any]]:
        from google.cloud import firestore

        query = (
            self._ensure_client()
            .collection(collection)
            .order_by("at", direction=firestore.Query.DESCENDING)
            .limit(limit)
        )
        rows: list[dict[str, Any]] = []
        for doc in query.stream():
            data = doc.to_dict() or {}
            if isinstance(data.get("at"), str):
                rows.append({**data, "_source": collection})
        return rows

    def audit(self, limit: int = 100) -> list[dict[str, Any]]:
        rows = (
            self._read_audit(self._access_audit, limit)
            + self._read_audit(self._calendar_audit, limit)
            + self._read_audit(self._share_audit, limit)
        )
        rows.sort(key=lambda row: str(row.get("at", "")), reverse=True)
        return rows[:limit]

    def record_share(self, action: str, target: str, actor: str) -> None:
        client = self._ensure_client()
        reference = client.collection(self._share_audit).document(uuid.uuid4().hex)
        reference.set(_audit_record(actor, action, target, None, None))


class StaticAdminStore:
    """In-memory AdminStore for the gate tests; never wired in production."""

    def __init__(
        self,
        members: list[dict[str, Any]] | None = None,
        policy: dict[str, Any] | None = None,
    ) -> None:
        self.members = {
            normalise_email(str(row["email"])) or str(row["email"]): {
                "role": row.get("role", "member"),
                "groups": list(row.get("groups", [])),
            }
            for row in (members or [])
        }
        self._policy = policy or _empty_policy("test")
        self.audit_rows: list[dict[str, Any]] = []

    def list_members(self) -> list[MemberRecord]:
        return [_member_record(email, data) for email, data in sorted(self.members.items())]

    def add_member(
        self, email: str, role: str, groups: list[str], note: str | None, actor: str
    ) -> MemberRecord:
        key = normalise_email(email)
        if key is None:
            raise AdminError("invalid_email")
        if key in self.members:
            raise AdminError("member_exists")
        clean_role = _clean_role(role)
        clean_groups = _clean_groups(groups)
        self.members[key] = {"role": clean_role, "groups": clean_groups}
        self._audit(actor, "add_member", f"member:{key}", None, {"role": clean_role, "groups": clean_groups})
        return MemberRecord(email=key, role=clean_role, groups=tuple(clean_groups))

    def update_member(self, email: str, role: str, groups: list[str], actor: str) -> MemberRecord:
        key = normalise_email(email)
        if key is None:
            raise AdminError("invalid_email")
        clean_role = _clean_role(role)
        clean_groups = _clean_groups(groups)
        if key == normalise_email(actor) and clean_role != "owner":
            raise AdminError("owner_cannot_demote_self")
        if key not in self.members:
            raise AdminError("member_missing")
        before = _member_record(key, self.members[key]).as_json()
        self.members[key] = {"role": clean_role, "groups": clean_groups}
        self._audit(
            actor, "update_member", f"member:{key}", before, {"role": clean_role, "groups": clean_groups}
        )
        return MemberRecord(email=key, role=clean_role, groups=tuple(clean_groups))

    def remove_member(self, email: str, actor: str) -> None:
        key = normalise_email(email)
        if key is None:
            raise AdminError("invalid_email")
        if key == normalise_email(actor):
            raise AdminError("owner_cannot_remove_self")
        if key not in self.members:
            raise AdminError("member_missing")
        before = _member_record(key, self.members[key]).as_json()
        if before["role"] == "owner":
            raise AdminError("cannot_remove_owner")
        del self.members[key]
        self._audit(actor, "remove_member", f"member:{key}", before, None)

    def policy(self) -> dict[str, Any]:
        return _validate_policy(self._policy)

    def set_rule(
        self, scope: str, name: str | None, groups: list[str], roles: list[str], actor: str
    ) -> dict[str, Any]:
        clean_scope, clean_name = _clean_scope(scope, name)
        rule = {"groups": _clean_names(groups, "groups"), "roles": _clean_names(roles, "roles")}
        collection = _SCOPES.get(clean_scope)
        if collection is None:
            raise AdminError("invalid_scope")
        if clean_scope == "default":
            before = self._policy.get("default")
            self._policy["default"] = rule
        else:
            self._policy.setdefault(collection, {})
            before = self._policy[collection].get(clean_name)
            self._policy[collection][clean_name] = rule
        after = _validate_policy(self._policy)
        target = "default" if clean_name is None else f"{clean_scope}:{clean_name}"
        self._audit(actor, "set_rule", target, before, rule)
        return after

    def clear_rule(self, scope: str, name: str | None, actor: str) -> dict[str, Any]:
        clean_scope, clean_name = _clean_scope(scope, name)
        if clean_scope == "default":
            raise AdminError("default_cannot_be_cleared")
        collection = _SCOPES[clean_scope]
        rules = self._policy.get(collection) or {}
        if clean_name not in rules:
            raise AdminError("rule_missing")
        before = rules.pop(clean_name)
        after = _validate_policy(self._policy)
        self._audit(actor, "clear_rule", f"{clean_scope}:{clean_name}", before, None)
        return after

    def audit(self, limit: int = 100) -> list[dict[str, Any]]:
        return list(self.audit_rows)[:limit]

    def record_share(self, action: str, target: str, actor: str) -> None:
        self._audit(actor, action, target, None, None)

    def _audit(self, actor: str, action: str, target: str, before: object, after: object) -> None:
        self.audit_rows.insert(0, {**_audit_record(actor, action, target, before, after), "_source": "test"})


def member_for_actor(profile: MemberProfile) -> str:
    """The actor string recorded in the audit trail (the verified email)."""
    return profile.email


# --- publish status --------------------------------------------------------


def parse_publish_status(raw: object, *, now: datetime | None = None) -> dict[str, Any]:
    """Parse `_hub/publish-status.json` for /admin/sync.

    The build writes it, so a malformed or missing document means the build or
    the sync failed. The route reports that as `status: failed` rather than
    raising: an owner needs to SEE the failure, not a 500.
    """
    if not isinstance(raw, dict) or raw.get("version") != 1:
        raise AdminError("status_malformed")
    projects = raw.get("projects")
    if not isinstance(projects, list):
        raise AdminError("status_malformed")
    moment = now or datetime.now(UTC)
    rows: list[dict[str, Any]] = []
    for entry in projects:
        if not isinstance(entry, dict):
            raise AdminError("status_malformed")
        source = entry.get("source")
        published = entry.get("published")
        if not isinstance(source, str) or not source or not isinstance(published, str):
            raise AdminError("status_malformed")
        age_days: float | None
        try:
            stamp = datetime.fromisoformat(published.replace("Z", "+00:00"))
            age_days = max(0.0, (moment - stamp).total_seconds() / 86400)
        except ValueError:
            age_days = None
        rows.append(
            {
                "source": source,
                "published": published,
                "items": entry.get("items"),
                "private_items": entry.get("private_items"),
                "age_days": None if age_days is None else round(age_days, 1),
                "stale": age_days is not None and age_days > 7,
            }
        )
    rows.sort(key=lambda row: str(row["source"]))
    return {
        "version": 1,
        "built_at": raw.get("built_at"),
        "commit": raw.get("commit"),
        "run_id": raw.get("run_id"),
        "projects": rows,
    }
