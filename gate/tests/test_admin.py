"""D32 / ADR-0029: the owner administration surface.

Every test here is about a boundary rather than a form:

  * owner-only (a member and a signed-out caller both get the same 404);
  * CSRF (a state change without the accepted Origin is refused);
  * audit (every accepted write leaves a record with the verified actor);
  * no self-lockout (the owner cannot demote or remove themselves);
  * no IDOR on a share id (the admin route revokes only an active row whose
    short id is unique, never an arbitrary token).
"""

from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta

from conftest import MEMBER_EMAIL, OTHER_MEMBER_EMAIL, origin_header, request_headers

from app.shares import Share, mint_token


def _write_headers(transport, session):
    return {
        **request_headers(transport, {"__session": session}),
        "origin": origin_header(transport),
        "content-type": "application/json",
    }


def test_admin_endpoints_are_owner_only(client, member_session, other_member_session, transport):
    headers = request_headers(transport, {"__session": other_member_session})
    for path in ("/admin/members", "/admin/policy", "/admin/audit", "/admin/sync"):
        assert client.get(path, headers=headers).status_code == 404

    signed_out = request_headers(transport)
    assert client.get("/admin/members", headers=signed_out).status_code == 404
    assert client.get("/admin/members").status_code == 404


def test_owner_lists_members_and_policy(client, member_session, transport):
    headers = request_headers(transport, {"__session": member_session})
    members = client.get("/admin/members", headers=headers)
    assert members.status_code == 200
    assert {row["email"] for row in members.json()["members"]} == {
        MEMBER_EMAIL,
        OTHER_MEMBER_EMAIL,
    }
    policy = client.get("/admin/policy", headers=headers)
    assert policy.status_code == 200
    assert policy.json()["policy"]["version"] == 1


def test_a_write_needs_the_accepted_origin(client, member_session, transport):
    headers = request_headers(transport, {"__session": member_session})
    response = client.post(
        "/admin/members",
        headers=headers,
        json={"email": "new@example.org", "role": "member", "groups": []},
    )
    assert response.status_code == 403


def test_add_member_is_audited(client, member_session, admin_store, transport):
    headers = _write_headers(transport, member_session)
    response = client.post(
        "/admin/members",
        headers=headers,
        json={"email": "new@example.org", "role": "member", "groups": ["committee"]},
    )
    assert response.status_code == 200
    assert response.json()["member"]["email"] == "new@example.org"
    assert admin_store.audit_rows[0]["action"] == "add_member"
    assert admin_store.audit_rows[0]["by"] == MEMBER_EMAIL


def test_owner_cannot_demote_or_remove_self(client, member_session, transport):
    headers = _write_headers(transport, member_session)
    demote = client.patch(
        f"/admin/members/{MEMBER_EMAIL}",
        headers=headers,
        json={"email": MEMBER_EMAIL, "role": "member", "groups": []},
    )
    assert demote.status_code == 400
    assert demote.json()["status"] == "owner_cannot_demote_self"

    remove = client.delete(f"/admin/members/{MEMBER_EMAIL}", headers=headers)
    assert remove.status_code == 400
    assert remove.json()["status"] == "owner_cannot_remove_self"


def test_update_and_remove_another_member_are_audited(client, member_session, admin_store, transport):
    headers = _write_headers(transport, member_session)
    update = client.patch(
        f"/admin/members/{OTHER_MEMBER_EMAIL}",
        headers=headers,
        json={"role": "member", "groups": ["committee", "project-team"]},
    )
    assert update.status_code == 200
    assert update.json()["member"]["groups"] == ["committee", "project-team"]

    remove = client.delete(f"/admin/members/{OTHER_MEMBER_EMAIL}", headers=headers)
    assert remove.status_code == 200
    assert [row["action"] for row in admin_store.audit_rows[:2]] == [
        "remove_member",
        "update_member",
    ]


def test_access_rule_set_and_clear_are_audited(client, member_session, admin_store, transport):
    headers = _write_headers(transport, member_session)
    set_rule = client.post(
        "/admin/policy/rule",
        headers=headers,
        json={"scope": "source", "name": "example-source", "groups": ["committee"], "roles": []},
    )
    assert set_rule.status_code == 200
    assert set_rule.json()["policy"]["sources"]["example-source"]["groups"] == ["committee"]

    clear = client.delete(
        "/admin/policy/rule?scope=source&name=example-source",
        headers=headers,
    )
    assert clear.status_code == 200
    assert "example-source" not in clear.json()["policy"]["sources"]
    assert [row["action"] for row in admin_store.audit_rows[:2]] == ["clear_rule", "set_rule"]


def test_a_malformed_rule_is_refused(client, member_session, transport):
    headers = _write_headers(transport, member_session)
    response = client.post(
        "/admin/policy/rule",
        headers=headers,
        json={"scope": "source", "name": "../escape", "groups": [], "roles": []},
    )
    assert response.status_code == 400


def test_share_revoke_by_unique_short_id(client, member_session, shares, admin_store, transport):
    token = mint_token()
    shares.create(
        Share(
            token=token,
            section="section-test",
            source="source-test",
            slug="item-a",
            entry="index.html",
            exp=datetime.now(UTC) + timedelta(days=2),
            revoked=False,
            created_by=MEMBER_EMAIL,
            created_at=datetime.now(UTC),
        )
    )
    headers = _write_headers(transport, member_session)
    response = client.delete(f"/admin/shares/{token[:12]}", headers=headers)
    assert response.status_code == 200
    assert shares.get(token).revoked is True
    assert admin_store.audit_rows[0]["action"] == "revoke"

    # A second call finds no active row: the short id is not an address that can
    # be used to revoke an arbitrary token later.
    assert client.delete(f"/admin/shares/{token[:12]}", headers=headers).status_code == 404


def test_a_member_cannot_revoke_a_share_through_admin(client, other_member_session, shares, transport):
    token = mint_token()
    shares.create(
        Share(
            token=token,
            section="section-test",
            source="source-test",
            slug="item-a",
            entry="index.html",
            exp=datetime.now(UTC) + timedelta(days=2),
            revoked=False,
            created_by=MEMBER_EMAIL,
            created_at=datetime.now(UTC),
        )
    )
    headers = _write_headers(transport, other_member_session)
    assert client.delete(f"/admin/shares/{token[:12]}", headers=headers).status_code == 404
    assert shares.get(token).revoked is False


def test_sync_status_reports_stale_and_missing(client, member_session, store, transport):
    headers = request_headers(transport, {"__session": member_session})
    assert client.get("/admin/sync", headers=headers).json()["status"] == "failed"

    store.objects["_hub/publish-status.json"] = json.dumps(
        {
            "version": 1,
            "built_at": "2026-10-01T00:00:00Z",
            "commit": "a" * 40,
            "run_id": "123",
            "projects": [{"source": "example-source", "published": "2026-01-01T00:00:00Z", "items": 2}],
        }
    ).encode()
    response = client.get("/admin/sync", headers=headers)
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["projects"][0]["stale"] is True
    assert body["run_url"].endswith("/actions/runs/123")


def test_the_admin_shell_is_served_only_to_the_owner(
    client, store, member_session, other_member_session, transport
):
    store.objects["admin/index.html"] = b"<h1>Owner administration</h1>"
    owner = request_headers(transport, {"__session": member_session})
    response = client.get("/p/admin/", headers=owner)
    assert response.status_code == 200
    assert b"Owner administration" in response.content

    member = request_headers(transport, {"__session": other_member_session})
    assert client.get("/p/admin/", headers=member).status_code == 404
    assert client.get("/p/admin/").status_code == 404


def test_private_me_adds_admin_only_for_the_owner(client, member_session, other_member_session, transport):
    owner = request_headers(transport, {"__session": member_session})
    body = client.get("/private/me", headers=owner).json()
    assert body["member"] is True and body["owner"] is True
    assert [item["label"] for item in body["nav"]] == ["Calendar", "Notes", "Admin"]

    member = request_headers(transport, {"__session": other_member_session})
    body = client.get("/private/me", headers=member).json()
    assert body["owner"] is False
    assert [item["label"] for item in body["nav"]] == ["Calendar", "Notes"]

    assert client.get("/private/me").status_code == 403
