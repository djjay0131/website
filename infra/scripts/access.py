#!/usr/bin/env python3
"""Owner tooling for the private access policy (ADR-0025, D24-B).

The access policy lives in Firestore at `access_policy/current`. It is NOT in
this repository: the repository is public and must not reveal what private
content exists or who it is for. Member roles and groups stay on
`members/{email}`.

Every write is a Firestore transaction that also appends an `access_audit`
record (who, when, action, target, before, after). No client SDK may read or
write `access_policy` or `access_audit`; the released rules deny every client.

This script takes every name as an argument or environment value. It contains
no member email, item key, source name, section name, group name or role name.

Examples (all values are placeholders):

    ./access.py show
    ./access.py set-rule --scope default --groups GROUP_A,GROUP_B
    ./access.py set-rule --scope source --name SOURCE_NAME --groups GROUP_A
    ./access.py set-rule --scope item --name SECTION/SOURCE/SLUG --groups GROUP_A
    ./access.py clear-rule --scope source --name SOURCE_NAME
    ./access.py add-group --member MEMBER_EMAIL --group GROUP_A
    ./access.py remove-group --member MEMBER_EMAIL --group GROUP_A
    ./access.py set-role --member MEMBER_EMAIL --role owner
    ./access.py replace-policy --file /path/outside/the/repo/policy.json

`--by` defaults to `ACCESS_BY`, then to the active `gcloud` account. Use
`--dry-run` to print the before/after for a change without writing it.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import uuid
from datetime import UTC, datetime
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen

POLICY_COLLECTION = "access_policy"
POLICY_DOCUMENT = "current"
AUDIT_COLLECTION = "access_audit"
MEMBERS_COLLECTION = "members"
POLICY_VERSION = 1

NAME_PATTERN = re.compile(r"^[a-z0-9][a-z0-9-]{0,63}$")
SEGMENT_PATTERN = re.compile(r"^[A-Za-z0-9._-]+$")
SCOPES = ("default", "section", "source", "item")


class AccessToolError(Exception):
    pass


def _run_gcloud_account() -> str:
    try:
        return subprocess.run(
            ["gcloud", "config", "get-value", "account"],
            check=True,
            capture_output=True,
            text=True,
        ).stdout.strip()
    except (OSError, subprocess.CalledProcessError) as exc:
        raise AccessToolError(
            "cannot determine the actor: pass --by, set ACCESS_BY, or sign in with gcloud"
        ) from exc


def _actor(args: argparse.Namespace) -> str:
    value = args.by or os.environ.get("ACCESS_BY") or _run_gcloud_account()
    if not value or value == "(unset)":
        raise AccessToolError("an actor is required: pass --by or set ACCESS_BY")
    return value


def _token() -> str:
    try:
        token = subprocess.run(
            ["gcloud", "auth", "print-access-token"],
            check=True,
            capture_output=True,
            text=True,
        ).stdout.strip()
    except (OSError, subprocess.CalledProcessError) as exc:
        raise AccessToolError("cannot obtain an ADC access token from gcloud") from exc
    if not token:
        raise AccessToolError("gcloud returned an empty access token")
    return token


def _base_url(project: str, database: str) -> str:
    return (
        f"https://firestore.googleapis.com/v1/projects/{quote(project)}"
        f"/databases/{quote(database, safe='')}/documents"
    )


def _document_name(project: str, database: str, path: str) -> str:
    return f"projects/{project}/databases/{database}/documents/{path}"


def _request(method: str, url: str, token: str, body: dict[str, Any] | None = None) -> Any:
    data = None if body is None else json.dumps(body).encode()
    request = Request(
        url,
        data=data,
        method=method,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urlopen(request, timeout=30) as response:  # noqa: S310 - fixed Google endpoint
            payload = response.read()
    except HTTPError as exc:
        detail = exc.read().decode(errors="replace")
        raise AccessToolError(f"Firestore HTTP {exc.code}: {detail}") from exc
    except URLError as exc:
        raise AccessToolError(f"cannot reach Firestore: {exc.reason}") from exc
    return json.loads(payload) if payload else {}


def _to_value(value: Any) -> dict[str, Any]:
    if value is None:
        return {"nullValue": None}
    if isinstance(value, bool):
        return {"booleanValue": value}
    if isinstance(value, int):
        return {"integerValue": str(value)}
    if isinstance(value, float):
        return {"doubleValue": value}
    if isinstance(value, str):
        return {"stringValue": value}
    if isinstance(value, list):
        return {"arrayValue": {"values": [_to_value(item) for item in value]}}
    if isinstance(value, dict):
        return {"mapValue": {"fields": {key: _to_value(item) for key, item in value.items()}}}
    raise AccessToolError(f"cannot encode {type(value).__name__} as a Firestore value")


def _from_value(value: dict[str, Any]) -> Any:
    if "nullValue" in value:
        return None
    if "booleanValue" in value:
        return value["booleanValue"]
    if "integerValue" in value:
        return int(value["integerValue"])
    if "doubleValue" in value:
        return float(value["doubleValue"])
    if "stringValue" in value:
        return value["stringValue"]
    if "timestampValue" in value:
        return value["timestampValue"]
    if "arrayValue" in value:
        return [_from_value(item) for item in value["arrayValue"].get("values", [])]
    if "mapValue" in value:
        return {key: _from_value(item) for key, item in value["mapValue"].get("fields", {}).items()}
    return None


def _fields(document: dict[str, Any]) -> dict[str, Any]:
    return {key: _from_value(value) for key, value in document.get("fields", {}).items()}


def _get_document(base: str, path: str, token: str, transaction: str | None = None) -> dict[str, Any] | None:
    query = f"?{urlencode({'transaction': transaction})}" if transaction else ""
    try:
        document = _request("GET", f"{base}/{path}{query}", token)
    except AccessToolError as exc:
        if "HTTP 404" in str(exc):
            return None
        raise
    return document


def _begin_transaction(base: str, token: str) -> str:
    # An omitted/empty options object is a read-write transaction. Sending
    # `readOnly: false` is invalid: readOnly is a TransactionOptions.ReadOnly
    # message, not a boolean.
    response = _request("POST", f"{base}:beginTransaction", token, {})
    return response["transaction"]


def _commit(
    base: str, token: str, transaction: str, writes: list[dict[str, Any]], *, dry_run: bool
) -> None:
    if dry_run:
        return
    _request("POST", f"{base}:commit", token, {"transaction": transaction, "writes": writes})


def _write_update(
    name: str, fields: dict[str, Any], *, field_paths: list[str] | None = None
) -> dict[str, Any]:
    write: dict[str, Any] = {
        "update": {
            "name": name,
            "fields": {key: _to_value(value) for key, value in fields.items()},
        }
    }
    if field_paths is not None:
        write["updateMask"] = {"fieldPaths": field_paths}
    return write


def _write_create(name: str, fields: dict[str, Any]) -> dict[str, Any]:
    return {
        "update": {
            "name": name,
            "fields": {key: _to_value(value) for key, value in fields.items()},
        },
        "currentDocument": {"exists": False},
    }


def _audit_write(
    project: str,
    database: str,
    *,
    by: str,
    action: str,
    target: str,
    before: Any,
    after: Any,
) -> dict[str, Any]:
    record = {
        "at": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
        "by": by,
        "action": action,
        "target": target,
        "before": before,
        "after": after,
    }
    name = _document_name(project, database, f"{AUDIT_COLLECTION}/{uuid.uuid4().hex}")
    return _write_create(name, record)


def _normalise_names(values: list[str], field: str) -> list[str]:
    out: list[str] = []
    for value in values:
        if not NAME_PATTERN.fullmatch(value):
            raise AccessToolError(
                f"{field} value {value!r} is not a lower-case name matching {NAME_PATTERN.pattern}"
            )
        if value not in out:
            out.append(value)
    return out


def _split_names(value: str, field: str) -> list[str]:
    return _normalise_names([item.strip() for item in value.split(",") if item.strip()], field)


def _validate_email(value: str) -> str:
    email = value.strip().lower()
    if not email or "@" not in email or "/" in email or email in (".", ".."):
        raise AccessToolError(f"invalid member email: {value!r}")
    return email


def _validate_scope(scope: str, name: str | None) -> str | None:
    if scope == "default":
        if name:
            raise AccessToolError("--name is not used with --scope default")
        return None
    if not name:
        raise AccessToolError(f"--name is required with --scope {scope}")
    if scope == "item":
        parts = name.split("/")
        if len(parts) != 3 or not all(SEGMENT_PATTERN.fullmatch(part) for part in parts):
            raise AccessToolError("an item name must be section/source/slug")
    elif not SEGMENT_PATTERN.fullmatch(name):
        raise AccessToolError(f"invalid {scope} name: {name!r}")
    return name


def _empty_policy(by: str) -> dict[str, Any]:
    return {
        "version": POLICY_VERSION,
        "default": {"groups": [], "roles": []},
        "sections": {},
        "sources": {},
        "items": {},
        "updated_at": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
        "updated_by": by,
    }


def _load_policy(base: str, token: str, transaction: str) -> dict[str, Any] | None:
    document = _get_document(
        base, f"{POLICY_COLLECTION}/{POLICY_DOCUMENT}", token, transaction
    )
    return None if document is None else _fields(document)


def _validate_policy(policy: dict[str, Any]) -> None:
    """The same rules the gate applies: anything malformed is refused."""
    if not isinstance(policy, dict) or policy.get("version") != POLICY_VERSION:
        raise AccessToolError("policy must be an object with version 1")
    unknown = set(policy) - {
        "version",
        "default",
        "sections",
        "sources",
        "items",
        "updated_at",
        "updated_by",
    }
    if unknown:
        raise AccessToolError(f"policy has unknown key(s): {sorted(unknown)}")
    if not isinstance(policy.get("default"), dict):
        raise AccessToolError("policy.default must be an object")
    for section in ("sections", "sources", "items"):
        if policy.get(section) is None:
            policy[section] = {}
        if not isinstance(policy[section], dict):
            raise AccessToolError(f"policy.{section} must be an object")
    rules = [("default", policy["default"])]
    for section in ("sections", "sources", "items"):
        rules.extend((section, rule) for rule in policy[section].values())
    for section, rule in rules:
        if not isinstance(rule, dict) or set(rule) - {"groups", "roles"}:
            raise AccessToolError(f"policy.{section} has an invalid rule")
        for field in ("groups", "roles"):
            names = rule.get(field, [])
            if not isinstance(names, list) or any(
                not isinstance(name, str) or not NAME_PATTERN.fullmatch(name) for name in names
            ):
                raise AccessToolError(f"policy.{section}.{field} has an invalid name")
        # Normalise so the write carries every field the gate expects.
        rule["groups"] = list(rule.get("groups", []))
        rule["roles"] = list(rule.get("roles", []))


def _policy_write(
    project: str, database: str, policy: dict[str, Any]
) -> dict[str, Any]:
    name = _document_name(project, database, f"{POLICY_COLLECTION}/{POLICY_DOCUMENT}")
    return _write_update(
        name,
        policy,
        field_paths=[
            "version",
            "default",
            "sections",
            "sources",
            "items",
            "updated_at",
            "updated_by",
        ],
    )


def _member_path(email: str) -> str:
    return f"{MEMBERS_COLLECTION}/{quote(email, safe='@._+-')}"


def _member_snapshot(fields: dict[str, Any]) -> dict[str, Any]:
    return {
        "role": fields.get("role", "member"),
        "groups": sorted(fields.get("groups", [])),
    }


def _transaction(
    args: argparse.Namespace,
    mutate,
) -> None:
    """Run one mutation in a transaction and append its audit record."""
    project = args.project
    database = args.database
    base = _base_url(project, database)
    token = _token()
    by = _actor(args)
    transaction = _begin_transaction(base, token)
    writes, action, target, before, after = mutate(base, token, transaction, by)
    writes.append(
        _audit_write(
            project,
            database,
            by=by,
            action=action,
            target=target,
            before=before,
            after=after,
        )
    )
    _commit(base, token, transaction, writes, dry_run=args.dry_run)
    label = "would write" if args.dry_run else "wrote"
    print(f"{label} {action} {target} by {by}")
    print(json.dumps({"before": before, "after": after}, indent=2, sort_keys=True))


# --- Commands --------------------------------------------------------------


def command_replace_policy(args: argparse.Namespace) -> None:
    with open(args.file, encoding="utf-8") as handle:
        policy = json.load(handle)
    _validate_policy(policy)

    def mutate(base, token, transaction, by):
        before = _load_policy(base, token, transaction)
        after = dict(policy)
        after["updated_at"] = datetime.now(UTC).isoformat().replace("+00:00", "Z")
        after["updated_by"] = by
        _validate_policy(after)
        return (
            [_policy_write(args.project, args.database, after)],
            "replace_policy",
            f"{POLICY_COLLECTION}/{POLICY_DOCUMENT}",
            before,
            after,
        )

    _transaction(args, mutate)


def command_set_rule(args: argparse.Namespace) -> None:
    name = _validate_scope(args.scope, args.name)
    rule = {
        "groups": _split_names(args.groups, "group"),
        "roles": _split_names(args.roles, "role"),
    }

    def mutate(base, token, transaction, by):
        before_policy = _load_policy(base, token, transaction)
        if before_policy is None:
            if args.scope != "default":
                raise AccessToolError(
                    "no access policy exists; create it with replace-policy or set the default first"
                )
            before_policy = _empty_policy(by)
        after_policy = json.loads(json.dumps(before_policy))
        target = args.scope if name is None else f"{args.scope}:{name}"
        if args.scope == "default":
            before = after_policy.get("default")
            after_policy["default"] = rule
        else:
            collection = {"section": "sections", "source": "sources", "item": "items"}[args.scope]
            after_policy.setdefault(collection, {})
            before = after_policy[collection].get(name)
            after_policy[collection][name] = rule
        after_policy["updated_at"] = datetime.now(UTC).isoformat().replace("+00:00", "Z")
        after_policy["updated_by"] = by
        _validate_policy(after_policy)
        return (
            [_policy_write(args.project, args.database, after_policy)],
            "set_rule",
            target,
            before,
            rule,
        )

    _transaction(args, mutate)


def command_clear_rule(args: argparse.Namespace) -> None:
    if args.scope == "default":
        raise AccessToolError("the default rule cannot be cleared; set it to an empty rule instead")
    name = _validate_scope(args.scope, args.name)

    def mutate(base, token, transaction, by):
        after_policy = _load_policy(base, token, transaction)
        if after_policy is None:
            raise AccessToolError("no access policy exists")
        collection = {"section": "sections", "source": "sources", "item": "items"}[args.scope]
        before = (after_policy.get(collection) or {}).get(name)
        if before is None:
            raise AccessToolError(f"no {args.scope} rule named {name!r}")
        del after_policy[collection][name]
        after_policy["updated_at"] = datetime.now(UTC).isoformat().replace("+00:00", "Z")
        after_policy["updated_by"] = by
        _validate_policy(after_policy)
        return (
            [_policy_write(args.project, args.database, after_policy)],
            "clear_rule",
            f"{args.scope}:{name}",
            before,
            None,
        )

    _transaction(args, mutate)


def _member_mutation(args: argparse.Namespace, action: str, change) -> None:
    email = _validate_email(args.member)

    def mutate(base, token, transaction, by):
        path = _member_path(email)
        document = _get_document(base, path, token, transaction)
        if document is None:
            raise AccessToolError(f"member {email!r} does not exist")
        fields = _fields(document)
        before = _member_snapshot(fields)
        after = change(dict(before))
        updates = {
            "groups": sorted(set(after["groups"])),
            "role": after["role"],
        }
        # One write per document per transaction.
        write = _write_update(
            _document_name(args.project, args.database, path),
            {"groups": updates["groups"], "role": updates["role"]},
            field_paths=["groups", "role"],
        )
        return ([write], action, f"member:{email}", before, updates)

    _transaction(args, mutate)


def command_add_group(args: argparse.Namespace) -> None:
    group = _normalise_names([args.group], "group")[0]

    def change(before):
        if group not in before["groups"]:
            before["groups"].append(group)
        return before

    _member_mutation(args, "add_group", change)


def command_remove_group(args: argparse.Namespace) -> None:
    group = _normalise_names([args.group], "group")[0]

    def change(before):
        if group not in before["groups"]:
            raise AccessToolError(f"member is not in group {group!r}")
        before["groups"].remove(group)
        return before

    _member_mutation(args, "remove_group", change)


def command_set_role(args: argparse.Namespace) -> None:
    if args.role not in ("owner", "member"):
        raise AccessToolError("--role must be owner or member")

    def change(before):
        before["role"] = args.role
        return before

    _member_mutation(args, "set_role", change)


def command_show(args: argparse.Namespace) -> None:
    base = _base_url(args.project, args.database)
    token = _token()
    if args.member:
        document = _get_document(base, _member_path(_validate_email(args.member)), token)
        if document is None:
            raise AccessToolError("member does not exist")
        print(json.dumps(_member_snapshot(_fields(document)), indent=2, sort_keys=True))
        return
    policy = _load_policy(base, token, None)
    if policy is None:
        raise AccessToolError(
            f"no {POLICY_COLLECTION}/{POLICY_DOCUMENT} document exists; the gate fails closed"
        )
    print(json.dumps(policy, indent=2, sort_keys=True))


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Show or change the Firestore private access policy (ADR-0025).",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("--project", default=os.environ.get("GCP_PROJECT_ID") or os.environ.get("PROJECT"))
    parser.add_argument("--database", default=os.environ.get("FIRESTORE_DATABASE", "(default)"))
    parser.add_argument("--by", default=None, help="actor recorded in access_audit")
    parser.add_argument("--dry-run", action="store_true", help="show before/after without writing")
    sub = parser.add_subparsers(dest="command", required=True)

    show = sub.add_parser("show", help="print the policy (or one member's role/groups)")
    show.add_argument("--member", default=None)
    show.set_defaults(func=command_show)

    set_rule = sub.add_parser("set-rule", help="set a default, section, source or item rule")
    set_rule.add_argument("--scope", required=True, choices=SCOPES)
    set_rule.add_argument("--name", default=None, help="section, source or section/source/slug")
    set_rule.add_argument("--groups", default="", help="comma-separated group names")
    set_rule.add_argument("--roles", default="", help="comma-separated role names")
    set_rule.set_defaults(func=command_set_rule)

    clear = sub.add_parser("clear-rule", help="remove a section/source/item override")
    clear.add_argument("--scope", required=True, choices=SCOPES)
    clear.add_argument("--name", required=True)
    clear.set_defaults(func=command_clear_rule)

    replace = sub.add_parser("replace-policy", help="replace the whole policy from a JSON file")
    replace.add_argument("--file", required=True)
    replace.set_defaults(func=command_replace_policy)

    add = sub.add_parser("add-group", help="add a member to a group")
    add.add_argument("--member", required=True)
    add.add_argument("--group", required=True)
    add.set_defaults(func=command_add_group)

    remove = sub.add_parser("remove-group", help="remove a member from a group")
    remove.add_argument("--member", required=True)
    remove.add_argument("--group", required=True)
    remove.set_defaults(func=command_remove_group)

    role = sub.add_parser("set-role", help="set a member's role")
    role.add_argument("--member", required=True)
    role.add_argument("--role", required=True, choices=["owner", "member"])
    role.set_defaults(func=command_set_role)

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = _parser()
    args = parser.parse_args(argv)
    if not args.project:
        parser.error("--project or GCP_PROJECT_ID is required")
    try:
        args.func(args)
    except AccessToolError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
