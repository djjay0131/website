"""The owner access tool's validation rules (D24-B).

The script itself is the only writer of `access_policy/current` and
`access_audit`. These tests stay offline: they exercise the pure validation and
encoding helpers, not a live Firestore write.
"""

from __future__ import annotations

import importlib.util
from pathlib import Path

import pytest

SCRIPT = Path(__file__).resolve().parents[2] / "infra" / "scripts" / "access.py"
spec = importlib.util.spec_from_file_location("access_tool", SCRIPT)
assert spec and spec.loader
access_tool = importlib.util.module_from_spec(spec)
spec.loader.exec_module(access_tool)


def test_a_policy_with_synthetic_names_is_accepted_and_normalised():
    policy = {
        "version": 1,
        "default": {"groups": ["group-a"], "roles": []},
        "sections": {"section-a": {"groups": ["group-b"]}},
        "sources": {},
        "items": {"section-a/source-a/slug-a": {"roles": ["member"]}},
    }
    access_tool._validate_policy(policy)
    assert policy["default"] == {"groups": ["group-a"], "roles": []}
    assert policy["sections"]["section-a"]["roles"] == []


def test_malformed_policy_values_are_refused():
    with pytest.raises(access_tool.AccessToolError):
        access_tool._validate_policy({"version": 1, "default": {"groups": ["Group-A"]}})
    with pytest.raises(access_tool.AccessToolError):
        access_tool._validate_policy({"version": 1, "default": {"everyone": True}})
    with pytest.raises(access_tool.AccessToolError):
        access_tool._validate_policy({"version": 2, "default": {}})


def test_group_and_role_names_are_lower_case_tokens():
    assert access_tool._split_names("group-a, group-b", "group") == ["group-a", "group-b"]
    with pytest.raises(access_tool.AccessToolError):
        access_tool._split_names("Group-A", "group")
    with pytest.raises(access_tool.AccessToolError):
        access_tool._split_names("group a", "group")


def test_item_scope_requires_section_source_slug():
    assert access_tool._validate_scope("item", "section-a/source-a/slug-a") == ("section-a/source-a/slug-a")
    with pytest.raises(access_tool.AccessToolError):
        access_tool._validate_scope("item", "section-a/source-a")
    with pytest.raises(access_tool.AccessToolError):
        access_tool._validate_scope("default", "unexpected")


def test_a_member_snapshot_has_a_role_and_sorted_groups():
    assert access_tool._member_snapshot({"groups": ["group-b", "group-a"]}) == {
        "role": "member",
        "groups": ["group-a", "group-b"],
    }


def test_a_new_member_document_carries_its_role_and_sorted_groups():
    fields = access_tool._new_member_fields("actor@example.invalid", "member", ["group-b", "group-a"], None)
    assert fields["role"] == "member"
    assert fields["groups"] == ["group-a", "group-b"]
    assert fields["added_by"] == "actor@example.invalid"
    assert "note" not in fields
    assert "added_at" in fields


def test_firestore_values_round_trip():
    value = {"a": [1, True, None, "x"], "b": {"c": 1.5}}
    assert access_tool._from_value(access_tool._to_value(value)) == value
