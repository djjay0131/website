"""GET /p/** -- the allowlist and serving the private bucket (§6 resp. 2-3).

Every authorisation case here runs through both transports. The `direct` runs
are the ones that matter for ADR-0004: the invoker is `allUsers`, so a check
that holds only behind Hosting is not a check.
"""

from __future__ import annotations

from conftest import MEMBER_EMAIL, PRIVATE_OBJECTS, request_headers

TRACKER = "/p/phd/milestones/index.html"
DOSSIER = "/p/phd/committee-dossier/index.html"


def test_member_reads_the_tracker(client, member_session, transport):
    response = client.get(TRACKER, headers=request_headers(transport, {"__session": member_session}))

    assert response.status_code == 200
    assert response.content == PRIVATE_OBJECTS["phd/milestones/index.html"]
    assert response.headers["content-type"].startswith("text/html")


def test_member_reads_the_dossier(client, member_session, transport):
    response = client.get(DOSSIER, headers=request_headers(transport, {"__session": member_session}))

    assert response.status_code == 200
    assert response.content == PRIVATE_OBJECTS["phd/committee-dossier/index.html"]


def test_signed_out_gets_no_private_content(client, store, transport):
    response = client.get(TRACKER, headers=request_headers(transport))

    assert response.status_code == 404
    assert b"Milestone tracker" not in response.content
    # The bucket is never consulted on behalf of an anonymous caller.
    assert store.fetches == []


def test_signed_out_response_does_not_reveal_the_path(client, transport):
    response = client.get(TRACKER, headers=request_headers(transport))

    for fragment in ("milestones", "committee-dossier", "phd"):
        assert fragment not in response.text


def test_signed_out_response_is_identical_for_real_and_imaginary_paths(client, transport):
    """No hint that an item exists: the refusal cannot be used to enumerate."""
    real = client.get(TRACKER, headers=request_headers(transport))
    imaginary = client.get("/p/there/is/nothing/here.html", headers=request_headers(transport))

    assert real.status_code == imaginary.status_code
    assert real.text == imaginary.text


def test_non_member_gets_not_shared_with_you(client, non_member_session, store, transport):
    """SEAM-3, and the roadmap's non-member criterion."""
    response = client.get(TRACKER, headers=request_headers(transport, {"__session": non_member_session}))

    assert response.status_code == 404
    assert "Not shared with you" in response.text
    assert b"Milestone tracker" not in response.content
    assert store.fetches == []


def test_non_member_response_is_identical_for_real_and_imaginary_paths(client, non_member_session, transport):
    headers = request_headers(transport, {"__session": non_member_session})
    real = client.get(TRACKER, headers=headers)
    imaginary = client.get("/p/there/is/nothing/here.html", headers=headers)

    assert real.status_code == imaginary.status_code
    assert real.text == imaginary.text


def test_expired_session_is_refused(client, verifier, member_session, store, transport):
    verifier.expired_sessions.add(member_session)

    response = client.get(TRACKER, headers=request_headers(transport, {"__session": member_session}))

    assert response.status_code == 404
    assert b"Milestone tracker" not in response.content
    assert store.fetches == []


def test_revoked_session_is_refused(client, verifier, member_session, store, transport):
    verifier.revoked_sessions.add(member_session)

    response = client.get(TRACKER, headers=request_headers(transport, {"__session": member_session}))

    assert response.status_code == 404
    assert store.fetches == []


def test_forged_session_cookie_is_refused(client, store, transport):
    response = client.get(TRACKER, headers=request_headers(transport, {"__session": "made-up"}))

    assert response.status_code == 404
    assert store.fetches == []


def test_a_session_under_any_other_cookie_name_is_not_accepted(client, member_session, store):
    """The other half of the `__session` constraint.

    Sent directly (Hosting would have stripped it), a valid session under a
    different name must still not authenticate: the gate reads exactly one
    cookie.
    """
    response = client.get(TRACKER, headers=request_headers("direct", {"session": member_session}))

    assert response.status_code == 404
    assert store.fetches == []


def test_hosting_strips_every_cookie_but___session(client, member_session, transport):
    """A member carrying unrelated cookies is still served through Hosting."""
    response = client.get(
        TRACKER,
        headers=request_headers(
            transport, {"analytics": "abc", "__session": member_session, "theme": "dark"}
        ),
    )

    assert response.status_code == 200


def test_member_asking_for_a_missing_object_gets_the_generic_page(client, member_session, transport):
    response = client.get(
        "/p/phd/not-a-real-item/index.html",
        headers=request_headers(transport, {"__session": member_session}),
    )

    assert response.status_code == 404
    assert "Not found" in response.text


def test_directory_request_serves_the_index_document(client, member_session, transport):
    response = client.get(
        "/p/phd/milestones/", headers=request_headers(transport, {"__session": member_session})
    )

    assert response.status_code == 200
    assert response.content == PRIVATE_OBJECTS["phd/milestones/index.html"]


def test_content_type_is_correct_for_assets(client, member_session, transport):
    response = client.get(
        "/p/assets/private.css", headers=request_headers(transport, {"__session": member_session})
    )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/css")


def test_membership_is_rechecked_on_every_request(client, deps, member_session, store):
    """Removing someone from the allowlist takes effect without a new session."""
    headers = request_headers("direct", {"__session": member_session})
    assert client.get(TRACKER, headers=headers).status_code == 200

    deps.members._emails.discard(MEMBER_EMAIL)

    second = client.get(TRACKER, headers=headers)
    assert second.status_code == 404
    assert "Not shared with you" in second.text


def test_unhandled_error_returns_no_detail(client, store, member_session, transport):
    def explode(name):
        raise RuntimeError(f"bucket blew up reading phd/milestones/index.html for {name}")

    store.fetch = explode

    response = client.get(TRACKER, headers=request_headers(transport, {"__session": member_session}))

    assert response.status_code == 500
    assert "milestones" not in response.text
    assert "RuntimeError" not in response.text
    assert "Traceback" not in response.text
