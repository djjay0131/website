"""The owner calendar tool's offline validation (D26 / ADR-0027)."""

from __future__ import annotations

import importlib.util
from pathlib import Path

import pytest

SCRIPT = Path(__file__).resolve().parents[2] / "infra" / "scripts" / "calendar_events.py"
spec = importlib.util.spec_from_file_location("calendar_tool", SCRIPT)
assert spec and spec.loader
calendar_tool = importlib.util.module_from_spec(spec)
spec.loader.exec_module(calendar_tool)


def test_a_valid_event_is_completed_with_defaults():
    event = calendar_tool._validate_event(
        {
            "id": "paper-submission",
            "title": "Paper submission",
            "kind": "submission",
            "start": "2026-10-23",
        }
    )
    assert event["status"] == "active"
    assert event["all_day"] is True
    assert event["timezone"] == "UTC"


def test_malformed_events_are_refused():
    base = {"id": "x", "title": "X", "kind": "work", "start": "2026-10-23"}
    with pytest.raises(calendar_tool.AccessToolError):
        calendar_tool._validate_event({**base, "kind": "deadline"})
    with pytest.raises(calendar_tool.AccessToolError):
        calendar_tool._validate_event({**base, "url": "javascript:alert(1)"})
    with pytest.raises(calendar_tool.AccessToolError):
        calendar_tool._validate_event({**base, "project": "Not A Source"})
    with pytest.raises(calendar_tool.AccessToolError):
        calendar_tool._validate_event({**base, "unknown": True})
    with pytest.raises(calendar_tool.AccessToolError):
        calendar_tool._validate_event({**base, "start": "2026-02-31"})
    with pytest.raises(calendar_tool.AccessToolError):
        calendar_tool._validate_event({**base, "start": "2026-10-23T09:00:00"})
    with pytest.raises(calendar_tool.AccessToolError):
        calendar_tool._validate_event({**base, "timezone": "not a zone"})
