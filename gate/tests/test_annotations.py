"""Annotations (issue #107): create, read, delete, and the guards around them.

Every case the gate contract §9 names is here:

  * create / read / delete, and the owner/member split;
  * a non-owner asking for `?scope=all` is refused, never downgraded;
  * a member cannot read or delete another member's note;
  * signed-out and non-member refused on both transports;
  * the origin check on POST and DELETE;
  * every response `private, no-store`;
  * malformed fields refused (intent, exact, selector type, bool bounds,
    traversal in section/source/slug, bounds and tag limits);
  * the create log carries no quote or comment (log-scrape).

The store is an in-memory `StaticAnnotationStore`; there are no cloud
credentials here and none may be created. `_annotation_from_document` -- the
parser every production read goes through -- is driven directly by the last
group, because the static store never calls it.
"""

from __future__ import annotations

import logging
from dataclasses import replace
from datetime import UTC, datetime

import pytest
from conftest import (
    MEMBER_EMAIL,
    OTHER_MEMBER_EMAIL,
    origin_header,
    request_headers,
)
from fastapi.testclient import TestClient

from app.annotations import (
    Annotation,
    TextPositionSelector,
    TextQuoteSelector,
    _annotation_from_document,
    new_annotation_id,
)
from app.main import create_app

ITEM = ("phd", "phd-milestones", "committee-dossier")
OTHER_ITEM = ("cv", "cv", "academic")
SELECTOR = {
    "type": "TextQuoteSelector",
    "exact": "the exact words",
    "prefix": "before ",
    "suffix": " after",
}
POSITION = {"type": "TextPositionSelector", "start": 10, "end": 25}


def _body(**overrides):
    body = {
        "section": ITEM[0],
        "source": ITEM[1],
        "slug": ITEM[2],
        "selector": dict(SELECTOR),
        "position": dict(POSITION),
        "comment": "a note",
        "intent": "paper",
        "tags": ["a", "b"],
    }
    body.update(overrides)
    return body


def _write_headers(transport, session):
    return {**request_headers(transport, {"__session": session}), "origin": origin_header(transport)}


def _create(client, transport, session, **overrides):
    return client.post("/annotations", json=_body(**overrides), headers=_write_headers(transport, session))


def _create_ok(client, transport, session, **overrides) -> str:
    response = _create(client, transport, session, **overrides)
    assert response.status_code == 200, response.text
    return response.json()["id"]


def _read(client, transport, session, query: str = ""):
    return client.get(f"/annotations{query}", headers=request_headers(transport, {"__session": session}))


def _rows(response) -> list[dict]:
    assert response.status_code == 200, response.text
    return response.json()["annotations"]


# --- Create and read -------------------------------------------------------


def test_a_member_creates_a_note_and_reads_it_back(client, member_session, transport):
    created = _create(client, transport, member_session)

    assert created.status_code == 200
    assert set(created.json()) == {"id", "created"}
    assert datetime.fromisoformat(created.json()["created"]) <= datetime.now(UTC)

    rows = _rows(_read(client, transport, member_session))

    assert len(rows) == 1
    row = rows[0]
    assert row["id"] == created.json()["id"]
    assert row["member"] == MEMBER_EMAIL
    assert (row["section"], row["source"], row["slug"]) == ITEM
    assert row["selector"] == SELECTOR
    assert row["position"] == POSITION
    assert row["quote"] == SELECTOR["exact"]
    assert row["comment"] == "a note"
    assert row["intent"] == "paper"
    assert row["tags"] == ["a", "b"]


def test_the_member_comes_from_the_session_not_the_body(client, annotations, member_session, transport):
    """Red Team target 4: a client-supplied `member` cannot forge authorship."""
    response = _create(client, transport, member_session, member="evil@example.com")

    assert response.status_code == 200
    assert "evil@example.com" not in response.text
    stored = annotations.get(response.json()["id"])
    assert stored is not None
    assert stored.member == MEMBER_EMAIL


def test_position_and_context_may_be_absent(client, member_session, transport):
    response = _create(client, transport, member_session, position=None)

    assert response.status_code == 200
    rows = _rows(_read(client, transport, member_session))
    assert rows[0]["position"] is None


def test_intent_defaults_to_question_when_absent(client, member_session, transport):
    body = _body()
    del body["intent"]
    del body["selector"]["prefix"]
    del body["selector"]["suffix"]

    response = client.post("/annotations", json=body, headers=_write_headers(transport, member_session))

    assert response.status_code == 200
    rows = _rows(_read(client, transport, member_session))
    assert rows[0]["intent"] == "question"
    assert rows[0]["selector"]["prefix"] == ""
    assert rows[0]["selector"]["suffix"] == ""


def test_empty_comment_and_no_tags_are_valid(client, member_session, transport):
    response = _create(client, transport, member_session, comment="", tags=[])

    assert response.status_code == 200
    rows = _rows(_read(client, transport, member_session))
    assert rows[0]["comment"] == ""
    assert rows[0]["tags"] == []


def test_new_annotation_ids_are_long_and_unique():
    ids = {new_annotation_id() for _ in range(50)}

    assert len(ids) == 50
    for annotation_id in ids:
        assert len(annotation_id) >= 20
        assert all(ch.isalnum() or ch in "-_" for ch in annotation_id)


# --- Delete ----------------------------------------------------------------


def test_a_member_deletes_their_own_note(client, member_session, transport):
    annotation_id = _create_ok(client, transport, member_session)

    deleted = client.delete(
        f"/annotations/{annotation_id}", headers=_write_headers(transport, member_session)
    )

    assert deleted.status_code == 200
    assert deleted.json() == {"status": "ok"}
    assert _rows(_read(client, transport, member_session)) == []


def test_delete_unknown_note_is_404(client, member_session, transport):
    response = client.delete("/annotations/never-existed", headers=_write_headers(transport, member_session))

    assert response.status_code == 404


def test_a_member_cannot_delete_another_members_note(client, member_session, other_member_session, transport):
    annotation_id = _create_ok(client, transport, member_session)

    refused = client.delete(
        f"/annotations/{annotation_id}", headers=_write_headers(transport, other_member_session)
    )

    assert refused.status_code == 403
    # The note is untouched.
    assert _rows(_read(client, transport, member_session))[0]["id"] == annotation_id


def test_the_owner_can_delete_any_note(client, member_session, other_member_session, transport):
    annotation_id = _create_ok(client, transport, other_member_session)

    deleted = client.delete(
        f"/annotations/{annotation_id}", headers=_write_headers(transport, member_session)
    )

    assert deleted.status_code == 200
    assert _rows(_read(client, transport, other_member_session)) == []


# --- Scope and cross-member reads ------------------------------------------


def test_the_default_list_is_only_the_callers_own(client, member_session, other_member_session, transport):
    owner_note = _create_ok(client, transport, member_session, selector={**SELECTOR, "exact": "owner"})
    other_note = _create_ok(client, transport, other_member_session, selector={**SELECTOR, "exact": "other"})

    owner_rows = _rows(_read(client, transport, member_session))
    other_rows = _rows(_read(client, transport, other_member_session))

    assert [row["id"] for row in owner_rows] == [owner_note]
    assert [row["id"] for row in other_rows] == [other_note]


def test_a_non_owner_asking_for_all_is_refused_not_downgraded(
    client, member_session, other_member_session, transport
):
    _create_ok(client, transport, member_session)

    refused = _read(client, transport, other_member_session, "?scope=all")

    assert refused.status_code == 403
    assert "annotations" not in refused.json()


def test_the_owner_enumerates_every_note_but_reads_only_their_own(
    client, member_session, other_member_session, transport
):
    """Chief Reviewer must-fix 1: the owner moderates, but does not read a member's note."""
    _create_ok(
        client, transport, member_session, selector={**SELECTOR, "exact": "owner"}, comment="owner-comment"
    )
    _create_ok(
        client,
        transport,
        other_member_session,
        selector={**SELECTOR, "exact": "other"},
        comment="other-comment",
    )

    response = _read(client, transport, member_session, "?scope=all")
    rows = _rows(response)
    by_member = {row["member"]: row for row in rows}
    assert sorted(by_member) == sorted([MEMBER_EMAIL, OTHER_MEMBER_EMAIL])

    # The owner's own note keeps its content.
    assert by_member[MEMBER_EMAIL]["quote"] == "owner"
    assert by_member[MEMBER_EMAIL]["comment"] == "owner-comment"
    # The other member's note is enumerable so the owner can delete it, but its
    # content is redacted: the owner may not read another member's note.
    other = by_member[OTHER_MEMBER_EMAIL]
    assert other.get("redacted") is True
    assert "quote" not in other and "comment" not in other and "selector" not in other
    assert "other-comment" not in response.text


def test_a_member_cannot_read_another_members_note(client, member_session, other_member_session, transport):
    marker = "zzz-other-members-quote-zzz"
    _create_ok(client, transport, member_session, selector={**SELECTOR, "exact": marker})

    response = _read(client, transport, other_member_session)

    assert _rows(response) == []
    assert marker not in response.text


def test_an_unknown_scope_is_refused(client, member_session, transport):
    assert _read(client, transport, member_session, "?scope=bogus").status_code == 400


# --- Filters ---------------------------------------------------------------


def test_intent_source_and_slug_filters(client, member_session, transport):
    paper = _create_ok(client, transport, member_session, intent="paper", selector={**SELECTOR, "exact": "p"})
    experiment = _create_ok(
        client,
        transport,
        member_session,
        intent="experiment",
        section=OTHER_ITEM[0],
        source=OTHER_ITEM[1],
        slug=OTHER_ITEM[2],
        selector={**SELECTOR, "exact": "e"},
    )

    assert [row["id"] for row in _rows(_read(client, transport, member_session, "?intent=paper"))] == [paper]
    assert [row["id"] for row in _rows(_read(client, transport, member_session, "?intent=experiment"))] == [
        experiment
    ]
    assert [row["id"] for row in _rows(_read(client, transport, member_session, "?source=cv"))] == [
        experiment
    ]
    assert [
        row["id"] for row in _rows(_read(client, transport, member_session, "?slug=committee-dossier"))
    ] == [paper]
    combined = _rows(_read(client, transport, member_session, "?source=cv&slug=academic"))
    assert [row["id"] for row in combined] == [experiment]


@pytest.mark.parametrize(
    "query",
    [
        "?intent=bogus",
        "?intent=",
        "?source=../secrets",
        "?source=a/b",
        "?slug=../secrets",
        "?slug=",
    ],
)
def test_a_malformed_filter_is_refused(client, member_session, transport, query):
    assert _read(client, transport, member_session, query).status_code == 400


# --- Authorisation ---------------------------------------------------------


def test_signed_out_and_non_member_are_refused_on_both_transports(client, non_member_session, transport):
    # GET /annotations.
    assert client.get("/annotations", headers=request_headers(transport)).status_code == 403
    assert (
        client.get(
            "/annotations", headers=request_headers(transport, {"__session": non_member_session})
        ).status_code
        == 403
    )

    # POST /annotations, with a valid origin so it is identity that refuses.
    anonymous = client.post(
        "/annotations",
        json=_body(),
        headers={**request_headers(transport), "origin": origin_header(transport)},
    )
    outsider = client.post(
        "/annotations",
        json=_body(),
        headers={
            **request_headers(transport, {"__session": non_member_session}),
            "origin": origin_header(transport),
        },
    )
    assert anonymous.status_code == 403
    assert outsider.status_code == 403

    # DELETE /annotations/{id}.
    assert (
        client.delete(
            "/annotations/anything",
            headers={**request_headers(transport), "origin": origin_header(transport)},
        ).status_code
        == 403
    )
    assert (
        client.delete(
            "/annotations/anything",
            headers={
                **request_headers(transport, {"__session": non_member_session}),
                "origin": origin_header(transport),
            },
        ).status_code
        == 403
    )


def test_create_refuses_a_cross_origin_request(client, member_session, transport):
    response = client.post(
        "/annotations",
        json=_body(),
        headers={
            **request_headers(transport, {"__session": member_session}),
            "origin": "https://evil.example",
        },
    )

    assert response.status_code == 403


def test_delete_refuses_a_cross_origin_request(client, member_session, transport):
    annotation_id = _create_ok(client, transport, member_session)

    response = client.delete(
        f"/annotations/{annotation_id}",
        headers={
            **request_headers(transport, {"__session": member_session}),
            "origin": "https://evil.example",
        },
    )

    assert response.status_code == 403
    # The note is untouched.
    assert _rows(_read(client, transport, member_session))[0]["id"] == annotation_id


def test_create_and_delete_refuse_when_no_origin_is_configured(deps, member_session):
    blind = replace(deps, settings=replace(deps.settings, allowed_origins=frozenset()))
    client = TestClient(create_app(blind), raise_server_exceptions=False)
    headers = {**request_headers("direct", {"__session": member_session}), "origin": "https://x.example"}

    created = client.post("/annotations", json=_body(), headers=headers)
    assert created.status_code == 403
    assert client.delete("/annotations/anything", headers=headers).status_code == 403


# --- Input validation ------------------------------------------------------


@pytest.mark.parametrize(
    "overrides",
    [
        {"intent": "nonsense"},
        {"intent": None},
        {"intent": 5},
        {"selector": None},
        {"selector": {}},
        {"selector": {"type": "Nope", "exact": "x"}},
        {"selector": {"type": "TextQuoteSelector"}},
        {"selector": {"type": "TextQuoteSelector", "exact": ""}},
        {"selector": {"type": "TextQuoteSelector", "exact": "x" * 2001}},
        {"selector": {"type": "TextQuoteSelector", "exact": "x", "prefix": "p" * 65}},
        {"selector": {"type": "TextQuoteSelector", "exact": "x", "suffix": "s" * 65}},
        {"selector": {"type": "TextQuoteSelector", "exact": "x", "prefix": 5}},
        {"selector": {"type": "TextQuoteSelector", "exact": "x", "suffix": None}},
        {"selector": "TextQuoteSelector"},
        {"position": {"type": "TextPositionSelector", "start": True, "end": 5}},
        {"position": {"type": "TextPositionSelector", "start": 0, "end": False}},
        {"position": {"type": "TextPositionSelector", "start": 5, "end": 3}},
        {"position": {"type": "TextPositionSelector", "start": -1, "end": 5}},
        {"position": {"type": "TextPositionSelector"}},
        {"position": {"type": "Wrong", "start": 0, "end": 1}},
        {"position": {"start": 0, "end": 1}},
        {"position": "TextPositionSelector"},
        {"comment": "c" * 5001},
        {"comment": 5},
        {"tags": ["t"] * 11},
        {"tags": ["t" * 41]},
        {"tags": "notalist"},
        {"tags": [5]},
        {"section": ""},
        {"section": "a/b"},
        {"section": "../secrets"},
        {"section": None},
        {"section": 5},
        {"source": ""},
        {"source": "a/b"},
        {"source": "../secrets"},
        {"slug": ""},
        {"slug": "../secrets"},
        {"slug": "a//b"},
        {"quote": "mismatched"},
    ],
)
def test_create_rejects_bad_input_with_400(client, member_session, transport, overrides):
    response = _create(client, transport, member_session, **overrides)

    assert response.status_code == 400
    assert response.json() == {"status": "invalid_request"}


def test_create_accepts_the_exact_and_tag_boundaries(client, member_session, transport):
    assert (
        _create(
            client,
            transport,
            member_session,
            selector={**SELECTOR, "exact": "x" * 2000},
            tags=["t" * 40] * 10,
        ).status_code
        == 200
    )


def test_create_refuses_an_oversized_body_with_413(client, member_session, transport):
    response = client.post(
        "/annotations",
        json=_body(comment="c" * (16384 + 100)),
        headers=_write_headers(transport, member_session),
    )

    assert response.status_code == 413


def test_create_rejects_a_malformed_body_without_echoing_it(client, member_session, transport):
    secret = "an-secret-not-a-note"
    response = client.post(
        "/annotations",
        content=("{" + secret).encode(),
        headers={
            **request_headers(transport, {"__session": member_session}),
            "origin": origin_header(transport),
            "content-type": "application/json",
        },
    )

    assert response.status_code == 400
    assert secret not in response.text


# --- Caching ---------------------------------------------------------------


def test_every_annotation_response_is_private_no_store(
    client, member_session, other_member_session, transport
):
    annotation_id = _create_ok(client, transport, member_session)

    responses = {
        "create": _create(client, transport, member_session),
        "create_malformed": _create(client, transport, member_session, intent="bogus"),
        "create_reserved": _create(client, transport, other_member_session, intent="bogus"),
        "list": _read(client, transport, member_session),
        "list_refused": _read(client, transport, other_member_session, "?scope=all"),
        "list_signed_out": client.get("/annotations", headers=request_headers(transport)),
        "delete": client.delete(
            f"/annotations/{annotation_id}", headers=_write_headers(transport, member_session)
        ),
        "delete_unknown": client.delete(
            "/annotations/nope", headers=_write_headers(transport, member_session)
        ),
        "delete_cross_origin": client.delete(
            f"/annotations/{annotation_id}",
            headers={
                **request_headers(transport, {"__session": member_session}),
                "origin": "https://evil.example",
            },
        ),
    }

    for label, response in responses.items():
        assert response.headers["cache-control"] == "private, no-store", label
        lowered = response.headers["cache-control"].lower()
        assert "public" not in lowered, label
        assert "s-maxage" not in lowered, label


# --- Logging discipline ----------------------------------------------------


def test_the_create_log_carries_no_quote_or_comment(client, member_session, transport, caplog):
    quote_marker = "zzz-logmarker-quote-zzz"
    comment_marker = "zzz-logmarker-comment-zzz"

    with caplog.at_level(logging.INFO):
        response = _create(
            client,
            transport,
            member_session,
            selector={**SELECTOR, "exact": quote_marker},
            comment=comment_marker,
        )

    assert response.status_code == 200
    records = "\n".join(record.getMessage() for record in caplog.records)
    assert "action=create" in records, "the create did not log at INFO"
    assert quote_marker not in records
    assert comment_marker not in records
    assert response.json()["id"] not in records  # full id is returned once, not logged


def test_delete_id_cannot_forge_the_log_grammar_or_inject_a_line(
    client, member_session, transport, caplog
):
    """RT6-08a/08b: the DELETE id is client-supplied and must not reach a log line.

    A member requesting `/annotations/event=deny` must not put `event=deny` into
    the gate's log grammar (which would forge the `hub-gate-denials` metric),
    and `%0a` must not inject a second physical log line. Both are refused as a
    malformed id with a fixed, value-free line.
    """
    with caplog.at_level(logging.INFO):
        forged = client.delete(
            "/annotations/event=deny", headers=_write_headers(transport, member_session)
        )
        injected = client.delete(
            "/annotations/%0aevent=deny", headers=_write_headers(transport, member_session)
        )
        trailing = client.delete(
            "/annotations/abc%0a", headers=_write_headers(transport, member_session)
        )

    assert forged.status_code == 404
    assert injected.status_code == 404
    assert trailing.status_code == 404
    # Only the GATE's own records: httpx logs its request line, which contains
    # the forged path and would otherwise false-positive this assertion.
    lines = [record.getMessage() for record in caplog.records if record.name == "gate"]
    assert any("reason=invalid_id" in line for line in lines), "the refusal was not logged"
    assert all("event=deny" not in line for line in lines), "the log grammar was forged"
    assert all("\n" not in line for line in lines), "a log line was injected"


# --- Stored-document parsing (FirestoreAnnotationStore's parser) -----------
#
# `StaticAnnotationStore` hands whole `Annotation` objects to the gate, so the
# parser every production read goes through is driven directly here.


def _stored_document(**overrides):
    now = datetime.now(UTC)
    document = {
        "member": MEMBER_EMAIL,
        "section": ITEM[0],
        "source": ITEM[1],
        "slug": ITEM[2],
        "selector": {"type": "TextQuoteSelector", "exact": "x", "prefix": "", "suffix": ""},
        "position": {"type": "TextPositionSelector", "start": 0, "end": 1},
        "quote": "x",
        "comment": "",
        "intent": "question",
        "tags": [],
        "created": now,
        "updated": now,
    }
    document.update(overrides)
    return document


def test_a_well_formed_document_builds_an_annotation():
    annotation = _annotation_from_document("abc", _stored_document())

    assert isinstance(annotation, Annotation)
    assert annotation.id == "abc"
    assert annotation.selector == TextQuoteSelector(exact="x", prefix="", suffix="")
    assert annotation.position == TextPositionSelector(start=0, end=1)
    assert annotation.tags == ()


@pytest.mark.parametrize(
    "overrides",
    [
        {"member": None},
        {"section": None},
        {"quote": None},
        {"comment": None},
        {"intent": "nonsense"},
        {"created": None},
        {"selector": None},
        {"selector": {"exact": "x"}},
        {"selector": {"type": "Nope", "exact": "x"}},
        {"position": {"type": "Nope", "start": 0, "end": 1}},
        {"position": {"type": "TextPositionSelector", "start": True, "end": 1}},
        {"tags": [5]},
        {"quote": "does-not-match-exact"},
    ],
)
def test_a_malformed_document_is_refused_not_defaulted(overrides):
    assert _annotation_from_document("abc", _stored_document(**overrides)) is None


def test_an_absent_position_document_is_valid():
    annotation = _annotation_from_document("abc", _stored_document(position=None))

    assert isinstance(annotation, Annotation)
    assert annotation.position is None
