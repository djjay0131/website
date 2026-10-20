#!/usr/bin/env python3
"""Owner tooling for the private calendar (D26 / ADR-0027).

Events live in Firestore `calendar_events`; satellite deadlines come from the
private build. Nothing in this repository contains an event, a project name or a
member value: every field is an argument or an out-of-repo JSON file.

Every write is one Firestore transaction that also appends a `calendar_audit`
record (who, when, action, target, before, after). Firestore security rules deny
every browser client read and write; only the gate and this tool reach the
collection through service-account credentials.

Examples (values are placeholders):

    python3 calendar_events.py list
    python3 calendar_events.py add --file /path/outside/the/repo/event.json
    python3 calendar_events.py update --id EVENT_ID --file /path/outside/the/repo/event.json
    python3 calendar_events.py done --id EVENT_ID
    python3 calendar_events.py remove --id EVENT_ID

`--by` defaults to `ACCESS_BY`, then to the active `gcloud` account. Use
`--dry-run` to print the before/after without writing.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import os
import re
import sys
import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

SCRIPT = Path(__file__).resolve().parent / "access.py"
_spec = importlib.util.spec_from_file_location("owner_access_tool", SCRIPT)
if _spec is None or _spec.loader is None:
    raise RuntimeError(f"could not load {SCRIPT}")
_access = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_access)

EVENTS_COLLECTION = "calendar_events"
AUDIT_COLLECTION = "calendar_audit"
KINDS = {"submission", "abstract", "notification", "camera-ready", "conference", "milestone", "work"}
STATUSES = {"active", "done", "cancelled"}
FIELDS = (
    "id",
    "project",
    "title",
    "kind",
    "start",
    "end",
    "all_day",
    "timezone",
    "conference",
    "url",
    "notes",
    "status",
)
DATE = re.compile(r"^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:\d{2}))?$")
TIMEZONE = re.compile(r"^[A-Za-z][A-Za-z0-9_+/-]{0,63}$")

AccessToolError = _access.AccessToolError


def _validate_date(value: str, field: str) -> None:
    if not DATE.fullmatch(value):
        raise AccessToolError(f"{field} must be an ISO date or a datetime with an offset")
    try:
        datetime.fromisoformat(value)
    except ValueError as exc:
        raise AccessToolError(f"{field} is not a real date or time") from exc


def _validate_event(raw: Any) -> dict[str, Any]:
    if not isinstance(raw, dict):
        raise AccessToolError("an event must be a JSON object")
    unknown = set(raw) - set(FIELDS)
    if unknown:
        raise AccessToolError(f"event has unknown key(s): {sorted(unknown)}")
    event = dict(raw)
    event["id"] = str(event.get("id") or "").strip() or uuid.uuid4().hex
    if not _access.NAME_PATTERN.fullmatch(event["id"]):
        raise AccessToolError("id must be a lower-case slug")
    text_fields = (
        ("title", 200),
        ("start", 64),
        ("end", 64),
        ("timezone", 64),
        ("conference", 120),
        ("notes", 2000),
    )
    for field, limit in text_fields:
        value = event.get(field)
        if value is None:
            continue
        if not isinstance(value, str) or not value.strip():
            raise AccessToolError(f"{field} must be a non-empty string")
        if len(value) > limit:
            raise AccessToolError(f"{field} is too long")
        event[field] = value.strip()
    if not event.get("title"):
        raise AccessToolError("title is required")
    if not event.get("start"):
        raise AccessToolError("start is required")
    _validate_date(event["start"], "start")
    if event.get("end") is not None:
        _validate_date(event["end"], "end")
    if event.get("timezone") is not None and not TIMEZONE.fullmatch(event["timezone"]):
        raise AccessToolError("timezone must be an IANA zone name or AoE")
    if event.get("kind") not in KINDS:
        raise AccessToolError(f"kind must be one of {sorted(KINDS)}")
    if event.get("status", "active") not in STATUSES:
        raise AccessToolError(f"status must be one of {sorted(STATUSES)}")
    project = event.get("project")
    if project is not None and (not isinstance(project, str) or not _access.NAME_PATTERN.fullmatch(project)):
        raise AccessToolError("project must be a lower-case source key or null")
    if "all_day" in event and not isinstance(event["all_day"], bool):
        raise AccessToolError("all_day must be a boolean")
    url = event.get("url")
    if url is not None and (not isinstance(url, str) or not url.startswith("https://")):
        raise AccessToolError("url must be https")
    event.setdefault("status", "active")
    event.setdefault("all_day", "T" not in event["start"])
    event.setdefault("timezone", "UTC")
    return event


def _event_path(event_id: str) -> str:
    return f"{EVENTS_COLLECTION}/{event_id}"


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
    name = _access._document_name(project, database, f"{AUDIT_COLLECTION}/{uuid.uuid4().hex}")
    return _access._write_create(name, record)


def _list_events(base: str, token: str) -> list[dict[str, Any]]:
    response = _access._request("GET", f"{base}/{EVENTS_COLLECTION}?pageSize=1000", token)
    out = []
    for document in response.get("documents", []):
        fields = _access._fields(document)
        fields["id"] = document["name"].rsplit("/", 1)[-1]
        out.append(fields)
    return sorted(out, key=lambda event: (str(event.get("start", "")), str(event.get("title", "")).lower()))


def command_list(args: argparse.Namespace) -> None:
    base = _access._base_url(args.project, args.database)
    token = _access._token()
    events = _list_events(base, token)
    if args.project is not None:
        events = [event for event in events if event.get("project") == args.project]
    if not args.include_done:
        events = [event for event in events if event.get("status") != "done"]
    print(json.dumps(events, indent=2, sort_keys=True))


def _mutate(args: argparse.Namespace, *, action: str, build) -> None:
    base = _access._base_url(args.project, args.database)
    token = _access._token()
    by = _access._actor(args)
    transaction = _access._begin_transaction(base, token)
    writes, target, before, after = build(base, token, transaction, by)
    writes.append(
        _audit_write(
            args.project,
            args.database,
            by=by,
            action=action,
            target=target,
            before=before,
            after=after,
        )
    )
    _access._commit(base, token, transaction, writes, dry_run=args.dry_run)
    print(f"{'would write' if args.dry_run else 'wrote'} {action} {target} by {by}")
    print(json.dumps({"before": before, "after": after}, indent=2, sort_keys=True))


def command_add(args: argparse.Namespace) -> None:
    with open(args.file, encoding="utf-8") as handle:
        event = _validate_event(json.load(handle))

    def build(base, token, transaction, by):
        current = _access._get_document(base, _event_path(event["id"]), token, transaction)
        if current is not None:
            raise AccessToolError("an event with that id already exists")
        fields = {
            **event,
            "created_at": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
            "created_by": by,
        }
        write = _access._write_create(
            _access._document_name(args.project, args.database, _event_path(event["id"])), fields
        )
        return [write], f"event:{event['id']}", None, event

    _mutate(args, action="add_event", build=build)


def command_update(args: argparse.Namespace) -> None:
    with open(args.file, encoding="utf-8") as handle:
        event = _validate_event(json.load(handle))
    if event["id"] != args.id:
        raise AccessToolError("--id and the file's id must match")

    def build(base, token, transaction, by):
        document = _access._get_document(base, _event_path(args.id), token, transaction)
        if document is None:
            raise AccessToolError("no such event")
        before = _access._fields(document)
        fields = {
            **event,
            "updated_at": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
            "updated_by": by,
        }
        # EVERY event field is in the mask, not only the keys the new file
        # happens to carry. A field in the mask but absent from `fields` is
        # deleted, which is how update removes an optional conference/end/url.
        write = _access._write_update(
            _access._document_name(args.project, args.database, _event_path(args.id)),
            fields,
            field_paths=[*list(FIELDS), "updated_at", "updated_by"],
        )
        return [write], f"event:{args.id}", before, event

    _mutate(args, action="update_event", build=build)


def command_done(args: argparse.Namespace) -> None:
    _set_status(args, "done", "done_event")


def command_remove(args: argparse.Namespace) -> None:
    def build(base, token, transaction, by):
        document = _access._get_document(base, _event_path(args.id), token, transaction)
        if document is None:
            raise AccessToolError("no such event")
        before = _access._fields(document)
        write = {"delete": _access._document_name(args.project, args.database, _event_path(args.id))}
        return [write], f"event:{args.id}", before, None

    _mutate(args, action="remove_event", build=build)


def _set_status(args: argparse.Namespace, status: str, action: str) -> None:
    def build(base, token, transaction, by):
        document = _access._get_document(base, _event_path(args.id), token, transaction)
        if document is None:
            raise AccessToolError("no such event")
        before = _access._fields(document)
        write = _access._write_update(
            _access._document_name(args.project, args.database, _event_path(args.id)),
            {
                "status": status,
                "updated_at": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
                "updated_by": by,
            },
            field_paths=["status", "updated_at", "updated_by"],
        )
        return [write], f"event:{args.id}", before, {**before, "status": status}

    _mutate(args, action=action, build=build)


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="List or change private calendar events (ADR-0027).",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("--project", default=os.environ.get("GCP_PROJECT_ID") or os.environ.get("PROJECT"))
    parser.add_argument("--database", default=os.environ.get("FIRESTORE_DATABASE", "(default)"))
    parser.add_argument("--by", default=None)
    parser.add_argument("--dry-run", action="store_true")
    sub = parser.add_subparsers(dest="command", required=True)

    listing = sub.add_parser("list")
    listing.add_argument("--project", dest="filter_project", default=None)
    listing.add_argument("--include-done", action="store_true")
    listing.set_defaults(func=command_list)

    add = sub.add_parser("add")
    add.add_argument("--file", required=True)
    add.set_defaults(func=command_add)

    update = sub.add_parser("update")
    update.add_argument("--id", required=True)
    update.add_argument("--file", required=True)
    update.set_defaults(func=command_update)

    done = sub.add_parser("done")
    done.add_argument("--id", required=True)
    done.set_defaults(func=command_done)

    remove = sub.add_parser("remove")
    remove.add_argument("--id", required=True)
    remove.set_defaults(func=command_remove)
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
