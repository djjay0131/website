"""Share links: mint, list, revoke and the session-less /s/** view.

Design doc §6 responsibility 4 and the Wave 3 seams. Every case the gate contract
§8 names is here:

  * mint / verify, and the item served without a session;
  * a non-owner member and an anonymous caller refused management;
  * unknown / expired / revoked tokens all 404;
  * slug escape (`../`, encoded dots, a second slug, absolute) refused under
    /s/**;
  * token entropy;
  * every /s/** and /share/** response `private, no-store`;
  * the list hides the full token.

The share store is an in-memory `StaticShareStore`; there are no cloud
credentials here and none may be created.
"""

from __future__ import annotations

from dataclasses import replace
from datetime import UTC, datetime, timedelta

import pytest
from conftest import MEMBER_EMAIL, PRIVATE_OBJECTS, origin_header, request_headers
from fastapi.testclient import TestClient

from app.main import create_app
from app.serve import UnsafePath, safe_object_path
from app.shares import Share

# `(section, source, slug)` -- the real private-build address, e.g.
# `phd/phd-milestones/committee-dossier/` (frame-content.mjs: routeFor).
OWNER_ITEM = ("phd", "phd-milestones", "committee-dossier")
OTHER_ITEM = ("cv", "cv", "academic")

# Encoded traversal spellings, which an HTTP client transmits verbatim and the
# ASGI server decodes before routing -- the same device test_paths.py uses.
HOSTILE_PATHS = [
    "%2e%2e%2fsecrets",
    "%2e%2e%2f..%2fsecrets",
    "..%2fsecrets",
    "%2e%2e",
    "%2fetc%2fpasswd",
    "%5cwindows%5csystem32",
    "%00",
    "phd%2fphd-milestones%2f%2e%2e%2fsecrets",
]

# Raw spellings that a conforming client refuses to put on the wire; their unit
# test is the real test (test_paths.py makes the same distinction).
HOSTILE_RAW = [
    "../secrets",
    "..",
    "/etc/passwd",
    "a/../../b",
    "phd/phd-milestones/../../cv/cv/academic",
]


def _mint_headers(transport, session):
    return {**request_headers(transport, {"__session": session}), "origin": origin_header(transport)}


def _mint(client, transport, session, **overrides):
    # `entry` is deliberately absent by default: most tests exercise the
    # `index.html` default, and a test that wants another entry adds it here.
    body = {
        "section": OWNER_ITEM[0],
        "source": OWNER_ITEM[1],
        "slug": OWNER_ITEM[2],
        "expires_in_days": 14,
    }
    body.update(overrides)
    return client.post("/share", json=body, headers=_mint_headers(transport, session))


def _mint_ok(client, transport, session, **overrides) -> str:
    response = _mint(client, transport, session, **overrides)
    assert response.status_code == 200, response.text
    return response.json()["token"]


def _seed(
    shares,
    token: str,
    *,
    days: int = 14,
    revoked: bool = False,
    item=OWNER_ITEM,
    entry: str = "index.html",
) -> None:
    now = datetime.now(UTC)
    shares.create(
        Share(
            token=token,
            section=item[0],
            source=item[1],
            slug=item[2],
            entry=entry,
            exp=now + timedelta(days=days),
            revoked=revoked,
            created_by=MEMBER_EMAIL,
            created_at=now,
        )
    )


# --- Mint and verify -------------------------------------------------------


def test_owner_mints_a_share(client, member_session, transport):
    response = _mint(client, transport, member_session)

    assert response.status_code == 200
    assert set(response.json()) == {"token", "expires_at", "url"}
    assert response.json()["url"] == f"/s/{response.json()['token']}/"
    assert datetime.fromisoformat(response.json()["expires_at"]) > datetime.now(UTC)


def test_a_minted_token_is_long_and_url_safe(client, member_session, transport):
    """SEAM-S1 / Red Team target: 256 bits, not a guessable id."""
    tokens = {_mint_ok(client, transport, member_session) for _ in range(5)}

    assert len(tokens) == 5
    for token in tokens:
        assert len(token) >= 32
        assert all(ch.isalnum() or ch in "-_" for ch in token)


def test_the_minted_share_serves_its_item_without_a_session(client, member_session, transport):
    token = _mint_ok(client, transport, member_session)

    response = client.get(f"/s/{token}/index.html", headers=request_headers(transport))

    assert response.status_code == 200
    assert response.content == PRIVATE_OBJECTS["phd/phd-milestones/committee-dossier/_doc/index.html"]
    assert response.headers["content-type"].startswith("text/html")


def test_a_share_directory_request_serves_the_entry_document(client, member_session, transport):
    token = _mint_ok(client, transport, member_session)

    response = client.get(f"/s/{token}/", headers=request_headers(transport))

    assert response.status_code == 200
    assert response.content == PRIVATE_OBJECTS["phd/phd-milestones/committee-dossier/_doc/index.html"]


def test_the_empty_path_serves_the_stored_entry_not_index_html(client, member_session, transport):
    """SEAM-S1, amended again 2026-10-03: the token root serves `_doc/<entry>`."""
    token = _mint_ok(client, transport, member_session, entry="dossier.html")

    response = client.get(f"/s/{token}/", headers=request_headers(transport))

    assert response.status_code == 200
    assert response.content == PRIVATE_OBJECTS["phd/phd-milestones/committee-dossier/_doc/dossier.html"]
    assert response.headers["content-type"].startswith("text/html")


def test_a_pdf_entry_is_served_as_a_pdf(client, member_session, transport):
    """A `pdf` entry must not be mangled to `text/html` -- the bug `entry` fixes."""
    token = _mint_ok(client, transport, member_session, entry="anthropic-fellow.pdf")

    response = client.get(f"/s/{token}/", headers=request_headers(transport))

    assert response.status_code == 200
    assert (
        response.content == PRIVATE_OBJECTS["phd/phd-milestones/committee-dossier/_doc/anthropic-fellow.pdf"]
    )
    assert response.headers["content-type"].startswith("application/pdf")

    # The same object is reachable by its own name, also as a PDF.
    named = client.get(f"/s/{token}/anthropic-fellow.pdf", headers=request_headers(transport))
    assert named.status_code == 200
    assert named.headers["content-type"].startswith("application/pdf")


def test_entry_may_be_several_segments(client, member_session, transport):
    """Ruling 7: `entry` may be several segments (e.g. `site/index.html`)."""
    _mint_ok(client, transport, member_session, entry="site/index.html")

    listed = client.get("/share", headers=request_headers(transport, {"__session": member_session}))

    assert listed.status_code == 200
    assert listed.json()["shares"][0]["entry"] == "site/index.html"


def test_entry_defaults_to_index_html_when_omitted(client, member_session, transport):
    """Ruling 7: the field defaults, so existing clients keep working."""
    token = _mint_ok(client, transport, member_session)

    listed = client.get("/share", headers=request_headers(transport, {"__session": member_session}))
    assert listed.json()["shares"][0]["entry"] == "index.html"

    response = client.get(f"/s/{token}/", headers=request_headers(transport))
    assert response.content == PRIVATE_OBJECTS["phd/phd-milestones/committee-dossier/_doc/index.html"]


def test_a_share_serves_a_subpath_with_the_right_content_type(client, member_session, transport):
    token = _mint_ok(client, transport, member_session, slug="milestones")

    response = client.get(f"/s/{token}/private.css", headers=request_headers(transport))

    assert response.status_code == 200
    assert response.content == PRIVATE_OBJECTS["phd/phd-milestones/milestones/_doc/private.css"]
    assert response.headers["content-type"].startswith("text/css")


def test_an_unknown_token_is_a_404(client, transport):
    response = client.get("/s/not-a-real-token/index.html", headers=request_headers(transport))

    assert response.status_code == 404
    assert "Not found" in response.text


def test_an_expired_share_is_a_404(client, shares, transport):
    _seed(shares, "expired-token", days=-1)

    response = client.get("/s/expired-token/index.html", headers=request_headers(transport))

    assert response.status_code == 404


def test_a_revoked_share_is_a_404(client, shares, transport):
    _seed(shares, "revoked-token", revoked=True)

    response = client.get("/s/revoked-token/index.html", headers=request_headers(transport))

    assert response.status_code == 404


def test_a_revoked_minted_share_is_a_404(client, member_session, transport):
    token = _mint_ok(client, transport, member_session)
    assert client.get(f"/s/{token}/", headers=request_headers(transport)).status_code == 200

    revoked = client.delete(f"/share/{token}", headers=_mint_headers(transport, member_session))

    assert revoked.status_code == 200
    assert client.get(f"/s/{token}/", headers=request_headers(transport)).status_code == 404


def test_revoke_is_idempotent(client, member_session, transport):
    token = _mint_ok(client, transport, member_session)
    headers = _mint_headers(transport, member_session)

    assert client.delete(f"/share/{token}", headers=headers).status_code == 200
    # A second revoke of the same token, and a revoke of a token that never
    # existed, both answer 200: the caller's goal is already true.
    assert client.delete(f"/share/{token}", headers=headers).status_code == 200
    assert client.delete("/share/never-existed", headers=headers).status_code == 200


# --- Authorisation ---------------------------------------------------------


def test_a_non_owner_member_cannot_mint(client, other_member_session, transport):
    assert _mint(client, transport, other_member_session).status_code == 403


def test_a_non_owner_member_cannot_list(client, other_member_session, transport):
    response = client.get("/share", headers=request_headers(transport, {"__session": other_member_session}))

    assert response.status_code == 403


def test_a_non_owner_member_cannot_revoke(client, member_session, other_member_session, transport):
    token = _mint_ok(client, transport, member_session)

    response = client.delete(f"/share/{token}", headers=_mint_headers(transport, other_member_session))

    assert response.status_code == 403
    assert client.get(f"/s/{token}/", headers=request_headers(transport)).status_code == 200


def test_an_anonymous_caller_cannot_mint(client, transport):
    response = client.post(
        "/share",
        json={
            "section": OWNER_ITEM[0],
            "source": OWNER_ITEM[1],
            "slug": OWNER_ITEM[2],
            "expires_in_days": 14,
        },
        headers={**request_headers(transport), "origin": origin_header(transport)},
    )

    assert response.status_code == 403


def test_an_unauthenticated_session_cannot_list_or_revoke(client, transport):
    assert client.get("/share", headers=request_headers(transport)).status_code == 403
    assert (
        client.delete(
            "/share/anything",
            headers={**request_headers(transport), "origin": origin_header(transport)},
        ).status_code
        == 403
    )


def test_mint_refuses_a_cross_origin_request(client, member_session, transport):
    assert _mint(client, transport, member_session).status_code == 200

    forged = client.post(
        "/share",
        json={
            "section": OWNER_ITEM[0],
            "source": OWNER_ITEM[1],
            "slug": OWNER_ITEM[2],
            "expires_in_days": 14,
        },
        headers={
            **request_headers(transport, {"__session": member_session}),
            "origin": "https://evil.example",
        },
    )

    assert forged.status_code == 403


def test_revoke_refuses_a_cross_origin_request(client, member_session, transport):
    token = _mint_ok(client, transport, member_session)

    response = client.delete(
        f"/share/{token}",
        headers={
            **request_headers(transport, {"__session": member_session}),
            "origin": "https://evil.example",
        },
    )

    assert response.status_code == 403
    # The grant is untouched.
    assert client.get(f"/s/{token}/", headers=request_headers(transport)).status_code == 200


def test_mint_and_revoke_refuse_everything_when_no_origin_is_configured(deps, member_session):
    blind = replace(deps, settings=replace(deps.settings, allowed_origins=frozenset()))
    client = TestClient(create_app(blind), raise_server_exceptions=False)
    headers = {**request_headers("direct", {"__session": member_session}), "origin": "https://x.example"}

    minted = client.post(
        "/share",
        json={
            "section": OWNER_ITEM[0],
            "source": OWNER_ITEM[1],
            "slug": OWNER_ITEM[2],
            "expires_in_days": 14,
        },
        headers=headers,
    )

    assert minted.status_code == 403
    assert client.delete("/share/anything", headers=headers).status_code == 403


# --- Input validation ------------------------------------------------------


@pytest.mark.parametrize(
    "overrides",
    [
        {"section": ""},
        {"section": "a/b"},
        {"section": ".."},
        {"section": "%2e%2e"},
        {"section": "/absolute"},
        {"section": None},
        {"section": 5},
        {"source": ""},
        {"source": "../cv"},
        {"source": "a/b"},
        {"source": None},
        {"slug": ""},
        {"slug": "../milestones"},
        {"slug": "a//b"},
        {"slug": "/absolute"},
        {"slug": None},
        {"entry": "../secrets"},
        {"entry": "/etc/passwd"},
        {"entry": ""},
        {"entry": None},
        {"entry": "a//b"},
        {"entry": "a/b/../c"},
        {"entry": 5},
        {"expires_in_days": 0},
        {"expires_in_days": 31},
        {"expires_in_days": -1},
        {"expires_in_days": "14"},
        {"expires_in_days": True},
        {"expires_in_days": None},
        {"expires_in_days": 1.5},
    ],
)
def test_mint_rejects_bad_input_with_400(client, member_session, transport, overrides):
    response = _mint(client, transport, member_session, **overrides)

    assert response.status_code == 400
    assert response.json() == {"status": "invalid_request"}


def test_mint_rejects_a_body_with_no_section_at_all(client, member_session, transport):
    """Ruling 1: the section is required, not defaulted."""
    response = client.post(
        "/share",
        json={"source": OWNER_ITEM[1], "slug": OWNER_ITEM[2], "expires_in_days": 14},
        headers=_mint_headers(transport, member_session),
    )

    assert response.status_code == 400
    assert response.json() == {"status": "invalid_request"}


def test_mint_rejects_a_malformed_body_without_echoing_it(client, member_session, transport):
    secret = "sh-this-is-not-a-token"
    response = client.post(
        "/share",
        content=("{" + secret).encode(),
        headers={
            **request_headers(transport, {"__session": member_session}),
            "origin": origin_header(transport),
            "content-type": "application/json",
        },
    )

    assert response.status_code == 400
    assert secret not in response.text


def test_mint_accepts_the_thirty_day_cap(client, member_session, transport):
    response = _mint(client, transport, member_session, expires_in_days=30)

    assert response.status_code == 200
    expires = datetime.fromisoformat(response.json()["expires_at"])
    assert expires > datetime.now(UTC) + timedelta(days=29)


# --- Path confinement (SEAM-S8) --------------------------------------------


@pytest.mark.parametrize("hostile", HOSTILE_PATHS)
def test_a_share_refuses_traversal_and_never_touches_the_bucket(
    client, store, member_session, transport, hostile
):
    token = _mint_ok(client, transport, member_session)
    store.fetches.clear()

    response = client.get(f"/s/{token}/{hostile}", headers=request_headers(transport))

    assert response.status_code == 404
    assert store.fetches == []


@pytest.mark.parametrize("hostile", HOSTILE_RAW)
def test_safe_object_path_with_an_item_prefix_refuses_raw_traversal(hostile):
    with pytest.raises(UnsafePath):
        safe_object_path(hostile, "phd/phd-milestones/committee-dossier/_doc")


def test_a_share_cannot_reach_a_second_item(client, member_session, transport):
    """SEAM-S1: one token addresses one item and cannot address a second."""
    token = _mint_ok(
        client, transport, member_session, section=OTHER_ITEM[0], source=OTHER_ITEM[1], slug=OTHER_ITEM[2]
    )

    served = client.get(f"/s/{token}/index.html", headers=request_headers(transport))
    assert served.status_code == 200
    assert served.content == PRIVATE_OBJECTS["cv/cv/academic/_doc/index.html"]

    sibling = client.get(
        f"/s/{token}/phd/phd-milestones/committee-dossier/_doc/index.html",
        headers=request_headers(transport),
    )
    assert sibling.status_code == 404
    assert b"Committee dossier" not in sibling.content


def test_a_token_cannot_reach_a_sibling_section(client, store, member_session, transport):
    """Lead Architect ruling 1: the section is part of the prefix.

    `phd/phd-milestones/committee-dossier` and
    `projects/phd-milestones/internal-notes` share a source but not a section;
    traversal to the sibling must be refused before the bucket is touched.
    """
    token = _mint_ok(client, transport, member_session)
    store.fetches.clear()

    sibling = client.get(
        f"/s/{token}/%2e%2e%2f%2e%2e%2f%2e%2e%2f%2e%2e%2fprojects%2fphd-milestones"
        "%2finternal-notes%2f_doc%2findex.html",
        headers=request_headers(transport),
    )

    assert sibling.status_code == 404
    assert b"Internal notes" not in sibling.content
    assert store.fetches == []


def test_a_token_cannot_reach_a_prefix_extended_slug(client, store, member_session, transport):
    """A slug that merely starts with the token's slug is not inside its prefix.

    `.../committee-dossier` must not reach `.../committee-dossier-evil/`; the
    containment check is on whole segments, so `-evil` is a sibling, not a child.
    """
    token = _mint_ok(client, transport, member_session)
    store.fetches.clear()

    sibling = client.get(
        f"/s/{token}/%2e%2e%2f%2e%2e%2fcommittee-dossier-evil%2f_doc%2findex.html",
        headers=request_headers(transport),
    )

    assert sibling.status_code == 404
    assert b"Evil sibling" not in sibling.content
    assert store.fetches == []


def test_safe_object_path_keeps_the_prefix_segment_bounded():
    """A prefix-string overlap is refused by the segment allowlist, not by luck."""
    with pytest.raises(UnsafePath):
        safe_object_path(
            "../committee-dossier-evil/_doc/index.html", "phd/phd-milestones/committee-dossier/_doc"
        )


def test_a_corrupt_stored_section_is_refused(client, shares, transport):
    """A stored row whose section is not a single legal segment never serves."""
    _seed(shares, "corrupt-section", item=("a/b", "phd-milestones", "committee-dossier"))

    response = client.get("/s/corrupt-section/", headers=request_headers(transport))

    assert response.status_code == 404


def test_a_share_path_is_confined_to_the_token_prefix(client, store, member_session, transport):
    token = _mint_ok(client, transport, member_session)
    store.fetches.clear()

    # `assets/private.css` exists in the bucket and is servable under /p/, but
    # it is outside this token's item prefix and must 404.
    response = client.get(f"/s/{token}/assets/private.css", headers=request_headers(transport))

    assert response.status_code == 404
    assert store.fetches == ["phd/phd-milestones/committee-dossier/_doc/assets/private.css"]


def test_the_member_frame_is_unreachable_with_zero_bucket_fetches(client, store, member_session, transport):
    """SEAM-S1 as amended: a token serves `_doc/`, never the member frame.

    `<section>/<source>/<slug>/index.html` is the members' frame -- the whole
    private nav plus absolute `/p/...` links -- and exists in the bucket. The
    token prefix ends at `_doc`, so the only route to the frame is traversal,
    and that is refused before any bucket read.
    """
    token = _mint_ok(client, transport, member_session)
    store.fetches.clear()

    frame = client.get(f"/s/{token}/%2e%2e%2findex.html", headers=request_headers(transport))

    assert frame.status_code == 404
    assert b"Member frame" not in frame.content
    assert store.fetches == []


def test_the_payload_namespace_is_unreachable_with_zero_bucket_fetches(
    client, store, member_session, transport
):
    """`_payload/**` is a sibling of the item directory, outside every `_doc/`.

    `/_payload/<source>/...` carries the document bytes for members, and the
    item's own `_payload/` is a sibling of its `_doc/`. A share holder reaches
    only the staged `_doc/` copy, so traversal toward either is refused before
    any bucket read.
    """
    token = _mint_ok(client, transport, member_session)
    store.fetches.clear()

    attempts = [
        f"/s/{token}/%2e%2e%2f_payload%2fhidden.html",
        f"/s/{token}/%2e%2e%2f%2e%2e%2f%2e%2e%2f%2e%2e%2f_payload%2fphd-milestones%2fsite%2fcommittee.html",
    ]
    for url in attempts:
        response = client.get(url, headers=request_headers(transport))

        assert response.status_code == 404
        assert b"must not serve" not in response.content
        assert store.fetches == []


def test_a_token_cannot_reach_a_sibling_items_doc(client, store, member_session, transport):
    """One token reaches one item: the sibling item's `_doc/` is never served."""
    token = _mint_ok(client, transport, member_session)
    store.fetches.clear()

    sibling = client.get(
        f"/s/{token}/%2e%2e%2fmilestones%2f_doc%2findex.html",
        headers=request_headers(transport),
    )

    assert sibling.status_code == 404
    assert b"Milestone tracker" not in sibling.content
    assert store.fetches == []


# --- Caching (SEAM-S3) -----------------------------------------------------


def test_every_share_response_is_private_no_store(
    client, shares, member_session, other_member_session, transport
):
    token = _mint_ok(client, transport, member_session)
    _seed(shares, "expired-for-cache", days=-1)
    responses = {
        "served": client.get(f"/s/{token}/", headers=request_headers(transport)),
        "unknown_token": client.get("/s/nope/index.html", headers=request_headers(transport)),
        "expired_token": client.get("/s/expired-for-cache/", headers=request_headers(transport)),
        "traversal": client.get(f"/s/{token}/%2e%2e%2fsecrets", headers=request_headers(transport)),
        "missing_file": client.get(f"/s/{token}/nothing.html", headers=request_headers(transport)),
        "mint": _mint(client, transport, member_session),
        "mint_refused": _mint(client, transport, other_member_session),
        "list": client.get("/share", headers=request_headers(transport, {"__session": member_session})),
        "list_refused": client.get("/share", headers=request_headers(transport)),
        "revoke": client.delete(f"/share/{token}", headers=_mint_headers(transport, member_session)),
        "revoke_refused": client.delete(
            "/share/other", headers=_mint_headers(transport, other_member_session)
        ),
    }

    for label, response in responses.items():
        assert response.headers["cache-control"] == "private, no-store", label
        lowered = response.headers["cache-control"].lower()
        assert "public" not in lowered, label
        assert "s-maxage" not in lowered, label


# --- Listing hides the credential ------------------------------------------


def test_the_list_never_returns_the_full_token(client, member_session, transport):
    token = _mint_ok(client, transport, member_session)

    response = client.get("/share", headers=request_headers(transport, {"__session": member_session}))

    assert response.status_code == 200
    assert token not in response.text
    rows = response.json()["shares"]
    assert len(rows) == 1
    assert rows[0]["id"] == token[:12]
    assert rows[0]["section"] == OWNER_ITEM[0]
    assert rows[0]["source"] == OWNER_ITEM[1]
    assert rows[0]["slug"] == OWNER_ITEM[2]
    assert rows[0]["entry"] == "index.html"
    assert rows[0]["created_by"] == MEMBER_EMAIL
    assert "token" not in rows[0]


def test_the_list_shows_only_active_shares(client, shares, member_session, transport):
    _seed(shares, "active-token", days=14)
    _seed(shares, "expired-token", days=-1)
    _seed(shares, "revoked-token", revoked=True)

    response = client.get("/share", headers=request_headers(transport, {"__session": member_session}))

    rows = response.json()["shares"]
    assert [row["id"] for row in rows] == ["active-token"[:12]]


# --- No credentials on /s/** -----------------------------------------------


def test_a_share_view_sets_no_cookie(client, member_session, transport):
    token = _mint_ok(client, transport, member_session)

    response = client.get(f"/s/{token}/", headers=request_headers(transport))

    assert response.status_code == 200
    assert "set-cookie" not in response.headers


def test_a_session_cookie_is_not_a_credential_for_someone_elses_share(client, member_session, transport):
    """A valid session does not make an unknown /s/ token resolve."""
    response = client.get(
        "/s/unknown-token/",
        headers=request_headers(transport, {"__session": member_session}),
    )

    assert response.status_code == 404
    assert "set-cookie" not in response.headers
