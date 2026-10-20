"""The members' private calendar (D26 / ADR-0027).

Two event sources are merged at request time:

  * `_hub/calendar.json` in the private bucket -- optional `deadlines[]` from
    satellite manifests, written by the private build. It carries no access
    decision, only the project (source key) each event belongs to.
  * `calendar_events` in Firestore -- owner-managed events, including
    non-project personal milestones. Written only by the owner's arg-driven
    tool; every write appends a `calendar_audit` record.

The gate filters the merged list through the SAME item policy as `/private/items`:
a member sees an event only when its project has at least one item the member may
open. A non-project event is owner-only. Inaccessible events are never returned
and no count of them is exposed, so the endpoint adds no existence oracle.

Both sources fail closed. A missing or malformed calendar document leaves a
member with no satellite events; it never turns into "show everything".
"""

from __future__ import annotations

import json
import logging
import re
import time
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Protocol

logger = logging.getLogger("gate")

CALENDAR_OBJECT = "_hub/calendar.json"
CALENDAR_VERSION = 1
DEFAULT_CACHE_SECONDS = 30
MAX_CACHE_SECONDS = 30

EVENT_KINDS = frozenset(
    {"submission", "abstract", "notification", "camera-ready", "conference", "milestone", "work"}
)
EVENT_STATUSES = frozenset({"active", "done", "cancelled"})
# A timed value MUST carry an explicit offset (or Z); a date-only value has no
# time. Otherwise the viewer's browser would silently choose a zone for a
# satellite deadline, which is the one thing AoE exists to prevent.
_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:\d{2}))?$")
_NAME = re.compile(r"^[a-z0-9][a-z0-9-]{0,63}$")
_URL = re.compile(r"^https://[^\s]+$")
# Firestore documents written by infra/scripts/calendar_events.py carry audit
# metadata beside the event fields. It is not part of the event and is ignored.
_META_FIELDS = frozenset({"created_at", "created_by", "updated_at", "updated_by"})


@dataclass(frozen=True)
class CalendarEvent:
    id: str
    project: str | None
    title: str
    kind: str
    start: str
    end: str | None
    all_day: bool
    timezone: str
    conference: str | None
    url: str | None
    notes: str | None
    status: str

    def as_listing(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "project": self.project,
            "title": self.title,
            "kind": self.kind,
            "start": self.start,
            "all_day": self.all_day,
            "timezone": self.timezone,
            "status": self.status,
            **({"end": self.end} if self.end else {}),
            **({"conference": self.conference} if self.conference else {}),
            **({"url": self.url} if self.url else {}),
            **({"notes": self.notes} if self.notes else {}),
        }


class CalendarSource(Protocol):
    def events(self) -> list[CalendarEvent] | None: ...


class OwnerCalendarStore(Protocol):
    def events(self) -> list[CalendarEvent] | None: ...


def _valid_date(value: str, field: str) -> None:
    """Accept an ISO date or datetime, refusing impossible calendar values.

    The regex pins the shape; `fromisoformat` pins the calendar (no 2026-02-31,
    no 25:00). Python accepts a trailing Z, and every timed value already
    requires an offset, so a date-only value stays unambiguous.
    """
    if not _DATE.fullmatch(value):
        raise ValueError(f"calendar event {field} is not an ISO date or datetime with an offset")
    try:
        datetime.fromisoformat(value)
    except ValueError as exc:
        raise ValueError(f"calendar event {field} is not a real date or time") from exc


def _text(value: object, field: str, max_length: int, *, required: bool = False) -> str | None:
    if value is None:
        if required:
            raise ValueError(f"{field} is required")
        return None
    if not isinstance(value, str):
        raise ValueError(f"{field} must be a string")
    text = value.strip()
    if required and not text:
        raise ValueError(f"{field} is required")
    if len(text) > max_length:
        raise ValueError(f"{field} is too long")
    return text or None


def parse_event(raw: object, *, fallback_id: str | None = None) -> CalendarEvent:
    """Parse one event from the bucket document or a Firestore document."""
    if not isinstance(raw, dict):
        raise ValueError("calendar event must be an object")
    unknown = set(raw) - {
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
        *_META_FIELDS,
    }
    if unknown:
        raise ValueError(f"calendar event has unknown key(s): {sorted(unknown)}")
    event_id = _text(raw.get("id") or fallback_id, "id", 200, required=True)
    title = _text(raw.get("title"), "title", 200, required=True)
    kind = _text(raw.get("kind"), "kind", 40, required=True)
    start = _text(raw.get("start"), "start", 64, required=True)
    if kind not in EVENT_KINDS:
        raise ValueError("calendar event kind is not allowed")
    _valid_date(start, "start")
    end = _text(raw.get("end"), "end", 64)
    if end is not None:
        _valid_date(end, "end")
    project = _text(raw.get("project"), "project", 64)
    if project is not None and not _NAME.fullmatch(project):
        raise ValueError("calendar event project is not a lower-case source key")
    status = (_text(raw.get("status"), "status", 20) or "active").lower()
    if status not in EVENT_STATUSES:
        raise ValueError("calendar event status is not allowed")
    all_day = raw.get("all_day", "T" not in start)
    if not isinstance(all_day, bool):
        raise ValueError("calendar event all_day must be a boolean")
    timezone = _text(raw.get("timezone"), "timezone", 64) or "UTC"
    if not re.fullmatch(r"[A-Za-z][A-Za-z0-9_+/-]{0,63}", timezone):
        raise ValueError("calendar event timezone is not a zone name or AoE")
    url = _text(raw.get("url"), "url", 500)
    if url is not None and not _URL.fullmatch(url):
        raise ValueError("calendar event url must be https")
    conference = _text(raw.get("conference"), "conference", 120)
    notes = _text(raw.get("notes"), "notes", 2000)
    return CalendarEvent(
        id=event_id,
        project=project,
        title=title,
        kind=kind,
        start=start,
        end=end,
        all_day=all_day,
        timezone=timezone,
        conference=conference,
        url=url,
        notes=notes,
        status=status,
    )


def parse_calendar_document(raw: object) -> list[CalendarEvent]:
    """Parse `_hub/calendar.json`, refusing anything malformed."""
    if not isinstance(raw, dict) or raw.get("version") != CALENDAR_VERSION:
        raise ValueError("calendar document must be an object with version 1")
    raw_events = raw.get("events")
    if not isinstance(raw_events, list):
        raise ValueError("calendar document must carry an events array")
    return [parse_event(event) for event in raw_events]


class StaticCalendarSource:
    """In-memory CalendarSource for tests; never wired in production."""

    def __init__(self, events: list[CalendarEvent] | None) -> None:
        self._events = events

    def events(self) -> list[CalendarEvent] | None:
        return self._events


class StaticOwnerCalendarStore(StaticCalendarSource):
    """In-memory OwnerCalendarStore for tests."""


class BucketCalendarStore:
    """CalendarSource backed by `_hub/calendar.json` in the private bucket."""

    def __init__(
        self,
        store: Any,
        object_name: str = CALENDAR_OBJECT,
        *,
        cache_seconds: int = DEFAULT_CACHE_SECONDS,
        clock: Any = time.monotonic,
    ) -> None:
        if not 1 <= cache_seconds <= MAX_CACHE_SECONDS:
            raise ValueError(f"cache_seconds must be between 1 and {MAX_CACHE_SECONDS}")
        self._store = store
        self._object_name = object_name
        self._cache_seconds = cache_seconds
        self._clock = clock
        self._loaded: list[CalendarEvent] | None = None
        self._loaded_at: float | None = None

    def events(self) -> list[CalendarEvent] | None:
        now = self._clock()
        if self._loaded_at is not None and now - self._loaded_at < self._cache_seconds:
            return self._loaded
        self._loaded_at = now
        self._loaded = None
        try:
            stored = self._store.fetch(self._object_name)
            if stored is None:
                raise ValueError(f"missing {self._object_name}")
            payload = b"".join(stored.chunks())
            self._loaded = parse_calendar_document(json.loads(payload))
            return self._loaded
        except Exception as exc:
            logger.error(
                "event=misconfigured setting=calendar object=%s error=%s",
                self._object_name,
                type(exc).__name__,
            )
            return None


class FirestoreCalendarEventStore:
    """OwnerCalendarStore backed by the `calendar_events` collection."""

    def __init__(
        self,
        collection: str = "calendar_events",
        project_id: str | None = None,
        *,
        cache_seconds: int = DEFAULT_CACHE_SECONDS,
        clock: Any = time.monotonic,
        client: Any | None = None,
    ) -> None:
        self._collection = collection
        self._project_id = project_id
        self._cache_seconds = cache_seconds
        self._clock = clock
        self._client = client
        self._loaded: list[CalendarEvent] | None = None
        self._loaded_at: float | None = None

    def _ensure_client(self) -> Any:
        from google.cloud import firestore

        if self._client is None:
            self._client = (
                firestore.Client(project=self._project_id) if self._project_id else firestore.Client()
            )
        return self._client

    def events(self) -> list[CalendarEvent] | None:
        now = self._clock()
        if self._loaded_at is not None and now - self._loaded_at < self._cache_seconds:
            return self._loaded
        self._loaded_at = now
        self._loaded = None
        try:
            out: list[CalendarEvent] = []
            for snapshot in self._ensure_client().collection(self._collection).stream():
                data = snapshot.to_dict() or {}
                out.append(parse_event(data, fallback_id=snapshot.id))
            self._loaded = out
            return out
        except Exception as exc:
            logger.error(
                "event=misconfigured setting=calendar_events collection=%s error=%s",
                self._collection,
                type(exc).__name__,
            )
            return None
