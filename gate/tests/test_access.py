"""D24-B / ADR-0025: Firestore policy, bucket catalog, no existence oracle."""

from __future__ import annotations

import json
from dataclasses import replace
from datetime import UTC, datetime
from typing import Any

import pytest
from conftest import origin_header, request_headers
from fastapi.testclient import TestClient

from app.access import (
    AccessItem,
    AccessPolicy,
    AccessRule,
    BucketCatalogStore,
    FirestoreAccessPolicyStore,
    ItemCatalog,
    RuntimeAccessMap,
    StaticAccessMap,
    parse_access_policy,
    parse_catalog_document,
)
from app.annotations import Annotation, TextQuoteSelector, new_annotation_id
from app.main import create_app
from app.members import StaticMemberDirectory

# Synthetic names only. This repository is public.
OWNER = "owner@example.test"
MEMBER_A = "member-a@example.test"
MEMBER_B = "member-b@example.test"
OUTSIDER = "outsider@example.test"
GROUP_A = "group-a"
GROUP_B = "group-b"
SECTION = "section-a"
SOURCE = "source-a"
SLUG_A = "slug-a"
SLUG_B = "slug-b"
ITEM_A = f"{SECTION}/{SOURCE}/{SLUG_A}"
ITEM_B = f"{SECTION}/{SOURCE}/{SLUG_B}"
OBJECT_A = f"{SECTION}/{SOURCE}/{SLUG_A}/index.html"
OBJECT_B = f"{SECTION}/{SOURCE}/{SLUG_B}/index.html"
PAYLOAD_A = f"_payload/{SOURCE}/site/a.html"
PAYLOAD_B = f"_payload/{SOURCE}/site/b.html"
DOSSIER = f"/p/{OBJECT_A}"


def _rule(*, groups=(), roles=()):
    return AccessRule(groups=frozenset(groups), roles=frozenset(roles))


GROUP_A_RULE = _rule(groups={GROUP_A})
GROUP_B_RULE = _rule(groups={GROUP_B})
MEMBER_ROLE_RULE = _rule(roles={"member"})


def _item(slug, *, visibility="private", title=None):
    return AccessItem(
        section=SECTION,
        source=SOURCE,
        slug=slug,
        title=title or slug.replace("-", " ").title(),
        format="html",
        visibility=visibility,
        href=f"/p/{SECTION}/{SOURCE}/{slug}/",
        entry="index.html",
    )


def _policy(*, item_a=GROUP_A_RULE, item_b=GROUP_B_RULE, default=None):
    return AccessPolicy(
        default=default or _rule(),
        sections={},
        sources={},
        items={ITEM_A: item_a, ITEM_B: item_b},
    )


def _catalog(*, items=None, objects=None):
    items = items or {
        ITEM_A: _item(SLUG_A),
        ITEM_B: _item(SLUG_B),
    }
    return ItemCatalog(
        items=items,
        objects=objects
        if objects is not None
        else {
            OBJECT_A: (ITEM_A,),
            OBJECT_B: (ITEM_B,),
            PAYLOAD_A: (ITEM_A,),
            PAYLOAD_B: (ITEM_B,),
        },
    )


def _restricted(deps, *, catalog=None, policy=None, groups=None):
    groups = (
        groups
        if groups is not None
        else {
            MEMBER_A: [GROUP_A],
            MEMBER_B: [GROUP_B],
        }
    )
    members = StaticMemberDirectory(
        {OWNER, MEMBER_A, MEMBER_B, OUTSIDER},
        owners={OWNER},
        groups=groups,
    )
    access = StaticAccessMap(catalog or _catalog(), policy or _policy())
    return replace(deps, members=members, access=access)


def _session(verifier, token, email):
    return verifier.issue_session(verifier.add_user(token, email))


@pytest.fixture
def restricted_client(deps, verifier, store):
    store.objects[OBJECT_A] = b"<h1>a</h1>"
    store.objects[OBJECT_B] = b"<h1>b</h1>"
    store.objects[PAYLOAD_A] = b"<h1>payload-a</h1>"
    store.objects[PAYLOAD_B] = b"<h1>payload-b</h1>"
    return TestClient(
        create_app(_restricted(deps)),
        raise_server_exceptions=False,
    )


class _Snapshot:
    def __init__(self, data: dict[str, Any] | None) -> None:
        self.exists = data is not None
        self._data = data

    def to_dict(self) -> dict[str, Any]:
        return dict(self._data or {})


class _Document:
    def __init__(self, store: _FakeFirestore, key: str) -> None:
        self._store = store
        self._key = key

    def get(self) -> _Snapshot:
        self._store.gets += 1
        return _Snapshot(self._store.documents.get(self._key))


class _Collection:
    def __init__(self, store: _FakeFirestore, name: str) -> None:
        self._store = store
        self._name = name

    def document(self, key: str) -> _Document:
        return _Document(self._store, f"{self._name}/{key}")


class _FakeFirestore:
    def __init__(self, documents: dict[str, dict[str, Any]]) -> None:
        self.documents = documents
        self.gets = 0

    def collection(self, name: str) -> _Collection:
        return _Collection(self, name)


def test_a_member_with_the_group_reads_the_item(restricted_client, verifier, transport):
    session = _session(verifier, "member-a-token", MEMBER_A)

    response = restricted_client.get(DOSSIER, headers=request_headers(transport, {"__session": session}))

    assert response.status_code == 200
    assert response.content == b"<h1>a</h1>"


def test_the_owner_reads_any_item(restricted_client, verifier, transport):
    session = _session(verifier, "owner-token", OWNER)

    response = restricted_client.get(DOSSIER, headers=request_headers(transport, {"__session": session}))

    assert response.status_code == 200


def test_a_member_without_the_group_is_refused_before_the_bucket(
    restricted_client, verifier, store, transport
):
    session = _session(verifier, "outsider-token", OUTSIDER)
    store.fetches.clear()

    response = restricted_client.get(DOSSIER, headers=request_headers(transport, {"__session": session}))

    assert response.status_code == 404
    assert "This page isn't available" in response.text
    assert store.fetches == []


def test_no_access_is_indistinguishable_from_a_missing_item(restricted_client, verifier, transport):
    """The exact D24 requirement: same status and same body."""
    session = _session(verifier, "member-b-token", MEMBER_B)
    headers = request_headers(transport, {"__session": session})
    real = restricted_client.get(DOSSIER, headers=headers)
    missing = restricted_client.get(f"/p/{SECTION}/{SOURCE}/no-such-slug/index.html", headers=headers)

    assert real.status_code == missing.status_code == 404
    assert real.text == missing.text
    assert SLUG_A not in real.text.lower()


def test_a_payload_object_uses_the_mapped_item_rule(restricted_client, verifier, store, transport):
    member_a = _session(verifier, "payload-a", MEMBER_A)
    member_b = _session(verifier, "payload-b", MEMBER_B)
    path = f"/p/{PAYLOAD_A}"

    denied = restricted_client.get(path, headers=request_headers(transport, {"__session": member_b}))
    assert denied.status_code == 404
    assert "This page isn't available" in denied.text
    assert store.fetches == []

    allowed = restricted_client.get(path, headers=request_headers(transport, {"__session": member_a}))
    assert allowed.status_code == 200
    assert allowed.content == b"<h1>payload-a</h1>"


def test_shared_chrome_assets_are_readable_by_any_signed_in_member(
    restricted_client, verifier, store, transport
):
    """The emblem is private-site chrome, not an item (D25).

    It is shared by every private page, so it cannot be item-mapped. It is
    still member-only: the signed-out path never reaches this rule.
    """
    for name in ("emblem/research-emblem.svg", "emblem/research-emblem.png", "badges/badge.png"):
        store.objects[name] = b"asset"
        response = restricted_client.get(
            f"/p/{name}",
            headers=request_headers(transport, {"__session": _session(verifier, name, MEMBER_A)}),
        )
        assert response.status_code == 200, name
        assert response.content == b"asset"


def test_a_shared_asset_prefix_cannot_read_an_item_payload(restricted_client, verifier, store, transport):
    """The shared allowlist is a fixed set of chrome prefixes, not a wildcard."""
    session = _session(verifier, "shared-no-payload", MEMBER_A)
    store.objects[f"_payload/{SOURCE}/site/not-shared.css"] = b"x"
    store.fetches.clear()

    response = restricted_client.get(
        f"/p/_payload/{SOURCE}/site/not-shared.css",
        headers=request_headers(transport, {"__session": session}),
    )

    assert response.status_code == 404
    assert store.fetches == []


def test_a_project_hub_page_is_a_member_page_but_its_sub_pages_are_not(
    restricted_client, verifier, store, transport
):
    session = _session(verifier, "project-hub", MEMBER_B)
    headers = request_headers(transport, {"__session": session})
    store.objects["projects/index.html"] = b"landing"
    store.objects["projects/source-a/index.html"] = b"project"
    store.objects[f"projects/{SOURCE}/{SLUG_A}/index.html"] = b"item"

    landing = restricted_client.get("/p/projects/", headers=headers)
    project = restricted_client.get(f"/p/projects/{SOURCE}/", headers=headers)
    inaccessible_item = restricted_client.get(f"/p/projects/{SOURCE}/{SLUG_A}/", headers=headers)

    assert landing.status_code == 200
    assert project.status_code == 200
    # Member B is allowed ITEM_B only; a project landing prefix must not make
    # ITEM_A's sub-page readable.
    assert inaccessible_item.status_code == 404


def test_catalog_item_metadata_carries_date_and_manifest_order():
    catalog = parse_catalog_document(
        {
            "version": 2,
            "items": {
                ITEM_A: {**_item(SLUG_A).as_listing(), "date": "2026-10-17", "order": 0},
            },
            "objects": {OBJECT_A: [ITEM_A]},
        }
    )
    item = catalog.items[ITEM_A]
    assert item.date == "2026-10-17"
    assert item.order == 0
    assert item.as_listing()["date"] == "2026-10-17"
    assert item.as_listing()["order"] == 0


def test_an_unmapped_object_fails_closed(restricted_client, verifier, store, transport):
    store.objects[f"_payload/{SOURCE}/site/orphan.html"] = b"<h1>orphan</h1>"
    session = _session(verifier, "orphan", MEMBER_A)
    store.fetches.clear()

    response = restricted_client.get(
        f"/p/_payload/{SOURCE}/site/orphan.html",
        headers=request_headers(transport, {"__session": session}),
    )

    assert response.status_code == 404
    assert "This page isn't available" in response.text
    assert store.fetches == []


def test_a_role_rule_allows_a_plain_member(deps, verifier, transport, store):
    catalog = _catalog()
    client = TestClient(
        create_app(_restricted(deps, catalog=catalog, policy=_policy(item_a=MEMBER_ROLE_RULE))),
        raise_server_exceptions=False,
    )
    session = _session(verifier, "role-token", MEMBER_B)
    store.objects[OBJECT_A] = b"<h1>a</h1>"

    response = client.get(DOSSIER, headers=request_headers(transport, {"__session": session}))

    assert response.status_code == 200


def test_listing_returns_only_what_the_viewer_may_open(restricted_client, verifier, transport):
    member_a = _session(verifier, "list-a", MEMBER_A)
    member_b = _session(verifier, "list-b", MEMBER_B)
    owner = _session(verifier, "list-owner", OWNER)

    def slugs(session):
        response = restricted_client.get(
            "/private/items", headers=request_headers(transport, {"__session": session})
        )
        return {item["slug"] for item in response.json()["items"]}

    assert slugs(member_a) == {SLUG_A}
    assert slugs(member_b) == {SLUG_B}
    assert slugs(owner) == {SLUG_A, SLUG_B}


def test_annotation_create_requires_access_to_the_item(restricted_client, verifier, transport):
    member_a = _session(verifier, "note-a", MEMBER_A)
    member_b = _session(verifier, "note-b", MEMBER_B)
    body = {
        "section": SECTION,
        "source": SOURCE,
        "slug": SLUG_A,
        "selector": {"type": "TextQuoteSelector", "exact": "a quote", "prefix": "", "suffix": ""},
        "comment": "note",
    }

    denied = restricted_client.post(
        "/annotations",
        json=body,
        headers={**request_headers(transport, {"__session": member_b}), "Origin": origin_header(transport)},
    )
    allowed = restricted_client.post(
        "/annotations",
        json=body,
        headers={**request_headers(transport, {"__session": member_a}), "Origin": origin_header(transport)},
    )

    assert denied.status_code == 403
    assert allowed.status_code == 200


def test_annotation_list_filters_items_the_member_lost_access_to(
    restricted_client, verifier, deps, transport
):
    session = _session(verifier, "note-list", MEMBER_B)
    row = Annotation(
        id=new_annotation_id(),
        member=MEMBER_B,
        section=SECTION,
        source=SOURCE,
        slug=SLUG_A,
        selector=TextQuoteSelector(exact="x", prefix="", suffix=""),
        position=None,
        quote="x",
        comment="mine but not mine to read now",
        intent="question",
        tags=(),
        created=datetime.now(UTC),
        updated=datetime.now(UTC),
    )
    deps.annotations.create(row)

    response = restricted_client.get(
        "/annotations", headers=request_headers(transport, {"__session": session})
    )

    assert response.status_code == 200
    assert response.json()["annotations"] == []


def test_a_missing_catalog_fails_closed_for_members(deps, verifier, transport):
    no_catalog = replace(
        _restricted(deps),
        access=StaticAccessMap(ItemCatalog(items={}, objects={}), _policy()),
    )
    client = TestClient(create_app(no_catalog), raise_server_exceptions=False)
    session = _session(verifier, "missing-catalog", MEMBER_A)

    response = client.get(DOSSIER, headers=request_headers(transport, {"__session": session}))

    assert response.status_code == 404
    assert "This page isn't available" in response.text


def test_a_missing_policy_fails_closed_but_the_owner_is_still_allowed(deps, verifier, transport, store):
    store.objects[OBJECT_A] = b"<h1>a</h1>"
    no_policy = replace(_restricted(deps), access=StaticAccessMap(_catalog(), None))
    client = TestClient(create_app(no_policy), raise_server_exceptions=False)

    member = _session(verifier, "missing-policy-member", MEMBER_A)
    owner = _session(verifier, "missing-policy-owner", OWNER)

    denied = client.get(DOSSIER, headers=request_headers(transport, {"__session": member}))
    allowed = client.get(DOSSIER, headers=request_headers(transport, {"__session": owner}))

    assert denied.status_code == 404
    assert allowed.status_code == 200


def test_a_malformed_policy_fails_closed():
    with pytest.raises(ValueError):
        parse_access_policy({"version": 1, "default": {"groups": "not-a-list"}})
    with pytest.raises(ValueError):
        parse_access_policy({"version": 1, "default": {"groups": ["Not-Lower"]}})
    with pytest.raises(ValueError):
        parse_access_policy({"version": 1, "default": {"everyone": True}})
    with pytest.raises(ValueError):
        parse_access_policy({"version": 2, "default": {}})


def test_the_catalogue_carries_no_access_decision():
    with pytest.raises(ValueError):
        parse_catalog_document(
            {
                "version": 2,
                "items": {
                    ITEM_A: {
                        **_item(SLUG_A).as_listing(),
                        "access": {"groups": [GROUP_A]},
                    }
                },
                "objects": {},
            }
        )


def test_an_object_mapped_to_an_unknown_item_is_malformed():
    with pytest.raises(ValueError):
        parse_catalog_document(
            {
                "version": 2,
                "items": {ITEM_A: _item(SLUG_A).as_listing()},
                "objects": {OBJECT_B: ["no/such/item"]},
            }
        )


def test_policy_cache_expires_and_a_change_takes_effect_without_a_deploy(deps, verifier, store, transport):
    """A Firestore policy write must take effect within the cache window."""
    catalog = _catalog()
    store.objects["_hub/catalog.json"] = json.dumps(
        {
            "version": 2,
            "items": {ITEM_A: _item(SLUG_A).as_listing()},
            "objects": {OBJECT_A: [ITEM_A]},
        }
    ).encode()
    store.objects[OBJECT_A] = b"<h1>a</h1>"

    firestore = _FakeFirestore({"access_policy/current": {"version": 1, "default": {"groups": [GROUP_A]}}})
    clock = [0.0]
    policy_store = FirestoreAccessPolicyStore(client=firestore, cache_seconds=30, clock=lambda: clock[0])
    access = RuntimeAccessMap(policy_store, BucketCatalogStore(store, clock=lambda: clock[0]))
    wired = replace(
        _restricted(deps, catalog=catalog, policy=_policy()),
        access=access,
    )
    client = TestClient(create_app(wired), raise_server_exceptions=False)
    session = _session(verifier, "policy-change", MEMBER_B)

    # Member B is not in group-a: denied under the first policy.
    before = client.get(DOSSIER, headers=request_headers(transport, {"__session": session}))
    assert before.status_code == 404

    # The owner changes the policy in Firestore to allow group-b.
    firestore.documents["access_policy/current"] = {
        "version": 1,
        "default": {"groups": [GROUP_B]},
    }

    # Still inside the window: the cached policy applies.
    clock[0] = 29.0
    cached = client.get(DOSSIER, headers=request_headers(transport, {"__session": session}))
    assert cached.status_code == 404

    # After the window: the new policy applies with no rebuild and no redeploy.
    clock[0] = 30.0
    after = client.get(DOSSIER, headers=request_headers(transport, {"__session": session}))
    assert after.status_code == 200

    # A tampered/malformed policy fails closed after the next cache expiry.
    firestore.documents["access_policy/current"] = {
        "version": 1,
        "default": {"groups": "not-a-list"},
    }
    clock[0] = 60.0
    tampered = client.get(DOSSIER, headers=request_headers(transport, {"__session": session}))
    assert tampered.status_code == 404


def test_a_group_change_takes_effect_without_a_deploy(deps, verifier, store, transport):
    """Member group changes live in Firestore and are read per request."""
    members = StaticMemberDirectory({OWNER, MEMBER_B}, owners={OWNER}, groups={MEMBER_B: []})
    client = TestClient(
        create_app(replace(_restricted(deps), members=members)),
        raise_server_exceptions=False,
    )
    store.objects[OBJECT_A] = b"<h1>a</h1>"
    session = _session(verifier, "group-change", MEMBER_B)
    headers = request_headers(transport, {"__session": session})

    assert client.get(DOSSIER, headers=headers).status_code == 404

    # Simulate the owner adding the group to the member document.
    members._groups[MEMBER_B] = frozenset({GROUP_A})

    assert client.get(DOSSIER, headers=headers).status_code == 200


def test_policy_store_fails_closed_when_the_document_is_missing_or_malformed():
    clock = [0.0]
    missing = FirestoreAccessPolicyStore(client=_FakeFirestore({}), clock=lambda: clock[0])
    assert missing.policy() is None

    malformed = FirestoreAccessPolicyStore(
        client=_FakeFirestore({"access_policy/current": {"version": 1}}),
        clock=lambda: clock[0],
    )
    assert malformed.policy() is None
