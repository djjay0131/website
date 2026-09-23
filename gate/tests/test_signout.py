"""POST /session/end -- sign-out (SD-4).

Until this route existed there was no way out of a 14-day `HttpOnly` session:
the cookie could only be forgotten by the browser, so a member on a shared
machine could not end their own session. STATE records it as a security defect
today, made worse by every piece of session state Phase 4 adds.

These tests are written against the four ways a sign-out route is wrong while
looking right:

  1. It "clears" the cookie with a header the browser stores as a DIFFERENT
     cookie, because one attribute differs. The member is told they signed out,
     the gate logs that they did, and the session is still there. Nothing
     observable goes wrong -- which is why parity is asserted by parsing both
     headers rather than by reading the code.
  2. It accepts a cross-site POST. `SameSite=Lax` does not stop one: Lax still
     sends the cookie on a top-level POST a cross-site page triggers.
  3. It answers differently when a session existed, which turns the route into
     the existence oracle C29 forbids everywhere else.
  4. It works through Hosting and not on the direct *.run.app URL, or the other
     way round. The invoker is `allUsers` (ADR-0004), so every case here runs
     twice -- see conftest's `transport` fixture.

A NOTE ON caplog, because it matters. The `event=` assertions below do not use
it. pytest's caplog attaches its own handler and forces propagation, which is
precisely what production lacked for four revisions while every logging test
passed (STATE; tests/test_logging_config.py). These assertions push a buffer
through the gate's OWN handler instead -- conftest's through_the_gates_own_handler
-- so they fail if the gate's logging is misconfigured rather than passing
because the harness fixed it.
"""

from __future__ import annotations

from dataclasses import replace

import pytest
from conftest import (
    HOSTING_HEADERS,
    MEMBER_EMAIL,
    origin_header,
    request_headers,
    through_the_gates_own_handler,
)
from fastapi.testclient import TestClient

from app.config import SESSION_COOKIE_NAME
from app.main import create_app


def _signout(client, transport, cookies=None):
    """A same-origin POST, exactly as the member's own browser would send it."""
    headers = request_headers(transport, cookies)
    headers["origin"] = origin_header(transport)
    return client.post("/session/end", headers=headers)


def _forged(client, transport, origin="https://cross-site.invalid", cookies=None):
    """The same POST, triggered by a page the member is merely visiting."""
    headers = request_headers(transport, cookies)
    if origin is not None:
        headers["origin"] = origin
    return client.post("/session/end", headers=headers)


def _blind_client(deps):
    """A gate whose GATE_ALLOWED_ORIGINS is unset, as a misconfigured deploy has."""
    blind = replace(deps, settings=replace(deps.settings, allowed_origins=frozenset()))
    return TestClient(create_app(blind), raise_server_exceptions=False)


def _parse_set_cookie(header: str) -> tuple[str, str, dict[str, str]]:
    """Split a Set-Cookie header into (name, value, attributes)."""
    name_value, _, rest = header.partition(";")
    name, _, value = name_value.partition("=")
    attributes: dict[str, str] = {}
    for part in rest.split(";"):
        part = part.strip()
        if not part:
            continue
        key, _, val = part.partition("=")
        attributes[key.strip().lower()] = val.strip()
    return name.strip(), value.strip(), attributes


# ---------------------------------------------------------------------------
# 1. It actually clears the cookie, with every attribute the mint path set.
# ---------------------------------------------------------------------------


def test_signing_out_clears_the_session_cookie(client, transport):
    response = _signout(client, transport)

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    name, value, attributes = _parse_set_cookie(response.headers["set-cookie"])
    assert name == SESSION_COOKIE_NAME
    assert value.strip('"') == ""
    assert attributes["max-age"] == "0"


def test_the_clear_carries_every_attribute_the_mint_path_sets(client, verifier, transport):
    """The silent failure this route is most likely to have.

    A browser keys a cookie on name, domain and path. A clear that differs in
    Path -- or that drops Secure, HttpOnly or SameSite -- can be stored as a
    second cookie and leave `__session` exactly where it was. The response says
    200, the log says the member signed out, and the session survives.
    """
    verifier.add_user("good-token", MEMBER_EMAIL)
    minted = client.post("/session", json={"idToken": "good-token"}, headers=request_headers(transport))
    cleared = _signout(client, transport)

    _, _, mint = _parse_set_cookie(minted.headers["set-cookie"])
    _, _, clear = _parse_set_cookie(cleared.headers["set-cookie"])

    # Stated outright, so the requirement survives a refactor of the mint path.
    assert clear["path"] == "/"
    assert clear["samesite"].lower() == "lax"
    assert "secure" in clear
    assert "httponly" in clear

    # And equal to the mint path attribute for attribute, lifetime aside --
    # which is the part that has to differ.
    lifetime = {"max-age", "expires"}
    assert {k: v for k, v in clear.items() if k not in lifetime} == {
        k: v for k, v in mint.items() if k not in lifetime
    }


# ---------------------------------------------------------------------------
# 2. CSRF. The check is written here, where a forged sign-out is a nuisance,
#    because Phase 4's mint and revoke will need the same one.
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "spoof",
    [
        lambda host: "https://cross-site.invalid",
        lambda host: f"http://{host}",
        lambda host: "null",
        lambda host: f"https://{host}.cross-site.invalid",
        lambda host: f"https://cross-site{host}",
        lambda host: f"https://{host}:8443",
        lambda host: f"https://cross-site.invalid/{host}",
        lambda host: "",
    ],
    ids=["other-site", "plain-http", "null", "suffix", "prefix", "other-port", "path", "empty"],
)
def test_a_cross_origin_post_is_refused_and_clears_nothing(client, transport, spoof):
    host = origin_header(transport).removeprefix("https://")

    response = _forged(client, transport, origin=spoof(host))

    assert response.status_code == 403
    assert response.json() == {"status": "forbidden"}
    # The decisive half: a refused caller must not be able to clear anything,
    # or the refusal would perform the attack it exists to prevent.
    assert "set-cookie" not in response.headers


def test_a_post_with_no_origin_header_at_all_is_refused(client, transport):
    """Absence is not consent.

    Every browser sends Origin on a cross-site POST, so accepting a request
    without one would accept exactly what this check exists to refuse. A
    non-browser caller that wants the route sends its own Origin -- gate.yml's
    smoke test does.
    """
    response = _forged(client, transport, origin=None)

    assert response.status_code == 403
    assert "set-cookie" not in response.headers


def test_a_same_origin_post_is_accepted_on_both_transports(client, transport):
    """The check must hold identically through Hosting and on *.run.app.

    ADR-0004: the invoker is `allUsers`. A CSRF check that recognised only the
    site's domain would refuse every sign-out made against the service's own
    URL, and one that recognised only the service would refuse every real one.
    """
    assert _signout(client, transport).status_code == 200


@pytest.mark.parametrize(
    "host_headers",
    [
        {"x-forwarded-host": "cross-site.invalid"},
        {"x-forwarded-host": f"{HOSTING_HEADERS['host']}, cross-site.invalid"},
        {"host": "cross-site.invalid"},
        {},
    ],
    ids=["forged-x-forwarded-host", "x-forwarded-host-comma-list", "forged-host", "no-host-games"],
)
def test_an_unaccepted_origin_is_refused_however_it_spells_its_host_headers(client, host_headers):
    """The requirement, replacing a test that asserted the bypass was correct.

    WHAT THIS REPLACES. An earlier test here posted a forged `x-forwarded-host`
    and asserted 200 plus a cleared cookie. It was honest about its motive -- see
    the open question below -- but its effect was a regression test against its
    own fix: whoever narrowed `_same_origin` would have watched it go red and had
    to decide whether to delete a test or "fix" the fix.

    THE PROPERTY. An `Origin` the gate does not accept is refused, and no
    combination of `Host` or `X-Forwarded-Host` changes that, because the
    accepted set comes from GATE_ALLOWED_ORIGINS and not from the request. The
    three cases parametrised here are the three spellings that were demonstrated
    to work over real HTTP against the version this replaces: a forged
    `X-Forwarded-Host`, a comma list whose second element is the attacker, and a
    forged `Host` alone. The fourth is the control -- an honest Host, which was
    refused before and must still be.

    THE OPEN QUESTION IS STILL OPEN, and is not settled here. Which header
    carries the site's domain on a Firebase Hosting -> Cloud Run rewrite is
    unknown until `/session/end` is deployed behind the rewrite, and A UNIT TEST
    CANNOT SETTLE IT: this file can only assert what the gate does with headers
    the test itself wrote. It is settled by a live probe against the deployed
    route, and the handoff carries that probe. Nothing here depends on the
    answer -- that is the point of configuring the set instead of deriving it,
    and it is why the uncertainty no longer has to be resolved by widening.
    """
    headers = {
        "host": HOSTING_HEADERS["host"],
        "x-forwarded-proto": "https",
        "origin": "https://cross-site.invalid",
    }
    headers.update(host_headers)

    response = client.post("/session/end", headers=headers)

    assert response.status_code == 403
    assert response.json() == {"status": "forbidden"}
    assert "set-cookie" not in response.headers


def test_an_accepted_origin_is_accepted_whatever_the_host_headers_say(client):
    """The other direction, which is what proves the headers stopped deciding.

    A test that only shows forged headers being refused is also satisfied by a
    route that refuses everything. This one sends the same hostile header soup
    with an Origin that IS in the configured set, and requires 200 -- so the
    suite pins that the accepted set, and nothing else, makes the decision.
    """
    response = client.post(
        "/session/end",
        headers={
            "host": "cross-site.invalid",
            "x-forwarded-host": "cross-site.invalid",
            "x-forwarded-proto": "https",
            "origin": f"https://{HOSTING_HEADERS['host']}",
        },
    )

    assert response.status_code == 200
    assert _parse_set_cookie(response.headers["set-cookie"])[0] == SESSION_COOKIE_NAME


# ---------------------------------------------------------------------------
# 2b. And when the accepted set is not configured at all, it fails CLOSED.
# ---------------------------------------------------------------------------


def test_sign_out_refuses_every_request_when_no_origin_is_configured(deps, transport):
    """Unset GATE_ALLOWED_ORIGINS must refuse, never fall back to the headers.

    A fallback to comparing Origin against Host is the bypass returning under a
    better name, so the failure direction is chosen deliberately: a member cannot
    sign out until the deploy is fixed, which is a visible nuisance, rather than a
    check that is quietly not a check.
    """
    client = _blind_client(deps)

    response = client.post(
        "/session/end",
        headers={**request_headers(transport), "origin": origin_header(transport)},
    )

    assert response.status_code == 403
    assert "set-cookie" not in response.headers


def test_an_unconfigured_origin_set_says_so_in_the_log_rather_than_failing_quietly(deps, transport):
    """Failing closed silently would be its own defect: nobody would know why."""
    client = _blind_client(deps)

    written = through_the_gates_own_handler(
        lambda: client.post(
            "/session/end",
            headers={**request_headers(transport), "origin": origin_header(transport)},
        )
    )

    assert "event=deny scope=signout reason=no_allowed_origins_configured" in written
    assert "setting=GATE_ALLOWED_ORIGINS" in written


def test_the_boot_log_names_the_accepted_origins_and_shouts_when_there_are_none(deps):
    """Silent degradation should be readable from the boot logs.

    That is the lesson of the missing log handler, which survived four revisions
    because its absence looked exactly like its presence.
    """
    create_app(deps)  # ensure the gate's own handler exists to capture through

    healthy = through_the_gates_own_handler(lambda: create_app(deps))
    for origin in sorted(deps.settings.allowed_origins):
        assert origin in healthy
    assert "event=misconfigured" not in healthy

    blind = replace(deps, settings=replace(deps.settings, allowed_origins=frozenset()))
    misconfigured = through_the_gates_own_handler(lambda: create_app(blind))

    assert "allowed_origins=none" in misconfigured
    assert "event=misconfigured setting=GATE_ALLOWED_ORIGINS" in misconfigured


# ---------------------------------------------------------------------------
# 3. No existence oracle. Exactly what C29 requires of /p/**.
# ---------------------------------------------------------------------------


def test_the_answer_is_identical_whether_or_not_a_session_existed(
    client, verifier, member_session, transport
):
    dead = verifier.issue_session(verifier.add_user("dead-token", MEMBER_EMAIL))
    verifier.expired_sessions.add(dead)
    verifier.verified.clear()

    answers = {
        "no cookie": _signout(client, transport),
        "live session": _signout(client, transport, {"__session": member_session}),
        "expired session": _signout(client, transport, {"__session": dead}),
        "garbage cookie": _signout(client, transport, {"__session": "not-a-session"}),
    }

    shapes = {
        label: (
            response.status_code,
            response.text,
            response.headers["set-cookie"],
            response.headers["cache-control"],
        )
        for label, response in answers.items()
    }
    assert len(set(shapes.values())) == 1, shapes

    # And nothing was looked up to produce them. A route that verifies the
    # cookie can be timed even when its answer is constant.
    assert verifier.verified == [], "sign-out inspected the session; that is an oracle"


def test_signing_out_touches_no_bucket(client, store, transport):
    _signout(client, transport)

    assert store.fetches == []


# ---------------------------------------------------------------------------
# 4. The headers, the grammar, and the method.
# ---------------------------------------------------------------------------


def test_both_outcomes_are_private_no_store(client, transport):
    for label, response in (
        ("cleared", _signout(client, transport)),
        ("refused", _forged(client, transport)),
    ):
        assert response.headers["cache-control"] == "private, no-store", label
        assert "s-maxage" not in response.headers["cache-control"].lower(), label


def test_a_sign_out_is_visible_in_the_log(client, transport):
    written = through_the_gates_own_handler(lambda: _signout(client, transport))

    # The full line, levelname and logger name included, so this pins the
    # grammar every other decision in main.py uses rather than inventing a
    # second one that Cloud Logging would have to be taught separately.
    assert "INFO gate event=allow scope=signout" in written


def test_a_refused_sign_out_is_visible_in_the_log(client, transport):
    written = through_the_gates_own_handler(lambda: _forged(client, transport))

    assert "INFO gate event=deny scope=signout reason=cross_origin" in written


def test_the_log_line_never_names_the_member(client, member_session, transport):
    """Naming the member would mean verifying the cookie, which is the oracle."""
    written = through_the_gates_own_handler(
        lambda: _signout(client, transport, {"__session": member_session})
    )

    assert MEMBER_EMAIL not in written


@pytest.mark.parametrize("method", ["get", "put", "delete"])
def test_only_a_post_ends_a_session(client, transport, method):
    response = getattr(client, method)("/session/end", headers=request_headers(transport))

    assert response.status_code in (404, 405)
    assert "set-cookie" not in response.headers
