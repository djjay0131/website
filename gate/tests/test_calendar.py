"""D26 / ADR-0027: private calendar filtering, fail-closed and no oracle."""

from __future__ import annotations

from dataclasses import replace

import pytest
from conftest import request_headers
from fastapi.testclient import TestClient

from app.access import AccessItem, AccessPolicy, AccessRule, ItemCatalog, StaticAccessMap
from app.calendar import StaticCalendarSource, StaticOwnerCalendarStore, parse_calendar_document
from app.main import create_app
from app.members import StaticMemberDirectory

OWNER = "owner@example.test"
MEMBER_A = "member-a@example.test"
MEMBER_B = "member-b@example.test"
GROUP_A = "group-a"
GROUP_B = "group-b"
SOURCE_A = "source-a"
SOURCE_B = "source-b"


def _event(event_id: str, project: str | None, **overrides):
    value = {
        "id": event_id,
        "project": project,
        "title": event_id,
        "kind": "submission",
        "start": "2026-10-23",
        "all_day": True,
        "timezone": "AoE",
        "status": "active",
        **overrides,
    }
    return value


def _calendar_client(deps, verifier, *, satellite, owned):
    items = {
        f"section-a/{SOURCE_A}/one": AccessItem(
            section="section-a",
            source=SOURCE_A,
            slug="one",
            title="One",
            format="html",
            visibility="private",
            href="/p/section-a/source-a/one/",
            entry="index.html",
        ),
        f"section-a/{SOURCE_B}/two": AccessItem(
            section="section-a",
            source=SOURCE_B,
            slug="two",
            title="Two",
            format="html",
            visibility="private",
            href="/p/section-a/source-b/two/",
            entry="index.html",
        ),
    }
    catalog = ItemCatalog(
        items=items,
        objects={f"section-a/{SOURCE_A}/one/index.html": (f"section-a/{SOURCE_A}/one",)},
    )
    policy = AccessPolicy(
        default=AccessRule(),
        sections={},
        sources={SOURCE_A: AccessRule(groups=frozenset({GROUP_A}))},
        items={f"section-a/{SOURCE_B}/two": AccessRule(groups=frozenset({GROUP_B}))},
    )
    members = StaticMemberDirectory(
        {OWNER, MEMBER_A, MEMBER_B},
        owners={OWNER},
        groups={MEMBER_A: [GROUP_A], MEMBER_B: [GROUP_B]},
    )
    wired = replace(
        deps,
        members=members,
        access=StaticAccessMap(catalog, policy),
        calendar=StaticCalendarSource(satellite),
        calendar_events=StaticOwnerCalendarStore(owned),
    )
    return TestClient(create_app(wired), raise_server_exceptions=False)


def _session(verifier, token, email):
    return verifier.issue_session(verifier.add_user(token, email))


@pytest.mark.parametrize(
    ("email", "expected"),
    [
        (OWNER, {"a-active", "b-active", "owner-only"}),
        (MEMBER_A, {"a-active"}),
        (MEMBER_B, {"b-active"}),
    ],
)
def test_calendar_returns_only_projects_the_viewer_may_open(deps, verifier, transport, email, expected):
    client = _calendar_client(
        deps,
        verifier,
        satellite=parse_calendar_document(
            {"version": 1, "events": [_event("a-active", SOURCE_A), _event("b-active", SOURCE_B)]}
        ),
        owned=[parse_calendar_document({"version": 1, "events": [_event("owner-only", None)]})[0]],
    )
    session = _session(verifier, f"calendar-{email}", email)
    response = client.get("/private/calendar", headers=request_headers(transport, {"__session": session}))
    assert response.status_code == 200
    assert {event["id"] for event in response.json()["events"]} == expected


def test_calendar_never_returns_a_count_of_denied_events(deps, verifier, transport):
    client = _calendar_client(
        deps,
        verifier,
        satellite=[
            parse_calendar_document({"version": 1, "events": [_event("a", SOURCE_A)]})[0],
            parse_calendar_document({"version": 1, "events": [_event("b", SOURCE_B)]})[0],
        ],
        owned=[],
    )
    session = _session(verifier, "calendar-count", MEMBER_B)
    response = client.get("/private/calendar", headers=request_headers(transport, {"__session": session}))
    body = response.json()
    assert [event["id"] for event in body["events"]] == ["b"]
    assert "count" not in body
    assert "total" not in body
    assert "a" not in body


def test_a_missing_or_malformed_calendar_fails_closed_for_members(deps, verifier, transport):
    client = _calendar_client(deps, verifier, satellite=[], owned=[])
    wired = client.app.state.dependencies  # type: ignore[attr-defined]
    wired = replace(wired, calendar=StaticCalendarSource(None))
    client = TestClient(create_app(wired), raise_server_exceptions=False)
    session = _session(verifier, "calendar-missing", MEMBER_A)
    response = client.get("/private/calendar", headers=request_headers(transport, {"__session": session}))
    assert response.status_code == 200
    assert response.json()["events"] == []


def test_owner_still_sees_owner_events_when_the_satellite_file_is_missing(deps, verifier, transport):
    client = _calendar_client(
        deps,
        verifier,
        satellite=[],
        owned=[parse_calendar_document({"version": 1, "events": [_event("owner-only", None)]})[0]],
    )
    wired = client.app.state.dependencies  # type: ignore[attr-defined]
    client = TestClient(
        create_app(replace(wired, calendar=StaticCalendarSource(None))),
        raise_server_exceptions=False,
    )
    session = _session(verifier, "calendar-owner", OWNER)
    response = client.get("/private/calendar", headers=request_headers(transport, {"__session": session}))
    assert {event["id"] for event in response.json()["events"]} == {"owner-only"}


def test_non_member_and_signed_out_are_refused(deps, verifier, transport):
    client = _calendar_client(deps, verifier, satellite=[], owned=[])
    outsider = _session(verifier, "calendar-outsider", "outsider@example.test")
    non_member = client.get("/private/calendar", headers=request_headers(transport, {"__session": outsider}))
    anonymous = client.get("/private/calendar", headers=request_headers(transport))
    assert non_member.status_code == 403
    assert anonymous.status_code == 403


def test_a_malformed_calendar_document_is_refused():
    with pytest.raises(ValueError):
        parse_calendar_document({"version": 2, "events": []})
    with pytest.raises(ValueError):
        parse_calendar_document({"version": 1, "events": [{"id": "x"}]})
    with pytest.raises(ValueError):
        parse_calendar_document({"version": 1, "events": [_event("x", SOURCE_A, kind="deadline")]})
    with pytest.raises(ValueError):
        parse_calendar_document({"version": 1, "events": [_event("x", SOURCE_A, start="23/10/2026")]})
    with pytest.raises(ValueError):
        parse_calendar_document({"version": 1, "events": [_event("x", SOURCE_A, start="2026-02-31")]})
    with pytest.raises(ValueError):
        parse_calendar_document(
            {"version": 1, "events": [_event("x", SOURCE_A, start="2026-10-23T09:00:00")]}
        )


def test_owner_tool_metadata_does_not_break_a_firestore_event():
    # infra/scripts/calendar_events.py stamps every document with audit
    # metadata. The gate must ignore it rather than treat the whole source as
    # malformed and fail closed on every event.
    document = {
        "version": 1,
        "events": [
            _event(
                "owner-only",
                None,
                created_at="2026-10-20T00:00:00Z",
                created_by="owner@example.test",
                updated_at="2026-10-20T01:00:00Z",
                updated_by="owner@example.test",
            )
        ],
    }
    assert parse_calendar_document(document)[0].id == "owner-only"
