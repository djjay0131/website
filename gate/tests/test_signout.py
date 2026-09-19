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
through the gate's OWN handler instead, so they fail if the gate's logging is
misconfigured rather than passing because the harness fixed it.
"""

from __future__ import annotations

import io

import pytest
from conftest import MEMBER_EMAIL, origin_header, request_headers

from app.config import SESSION_COOKIE_NAME
from app.main import logger


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


def _through_the_gates_own_handler(call) -> str:
    """Run `call` with the gate's own log handler writing into a buffer.

    NOT caplog. See the module docstring: caplog supplies the handler and the
    propagation that production did not have, so a test using it passes whether
    or not the gate can log at all.
    """
    handler = next(h for h in logger.handlers if getattr(h, "_hub_gate_handler", False))
    buffer = io.StringIO()
    original, handler.stream = handler.stream, buffer
    try:
        call()
    finally:
        handler.stream = original
    return buffer.getvalue()


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


def test_the_site_domain_is_recognised_when_it_arrives_in_x_forwarded_host(client):
    """Which header carries `jason.cusati.us` on a Hosting rewrite is not settled.

    If Hosting replaces Host with the run.app host and puts the site's domain in
    X-Forwarded-Host, a Host-only comparison would refuse every sign-out made
    through the CDN while passing every test here. Both are accepted, so the
    route cannot fail that way; the handoff carries the live probe that says
    which one it actually is.
    """
    response = client.post(
        "/session/end",
        headers={
            "host": "hub-gate-abcdef1234-ue.a.run.app",
            "x-forwarded-host": "jason.cusati.us",
            "x-forwarded-proto": "https",
            "origin": "https://jason.cusati.us",
        },
    )

    assert response.status_code == 200
    assert _parse_set_cookie(response.headers["set-cookie"])[0] == SESSION_COOKIE_NAME


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
    written = _through_the_gates_own_handler(lambda: _signout(client, transport))

    # The full line, levelname and logger name included, so this pins the
    # grammar every other decision in main.py uses rather than inventing a
    # second one that Cloud Logging would have to be taught separately.
    assert "INFO gate event=allow scope=signout" in written


def test_a_refused_sign_out_is_visible_in_the_log(client, transport):
    written = _through_the_gates_own_handler(lambda: _forged(client, transport))

    assert "INFO gate event=deny scope=signout reason=cross_origin" in written


def test_the_log_line_never_names_the_member(client, member_session, transport):
    """Naming the member would mean verifying the cookie, which is the oracle."""
    written = _through_the_gates_own_handler(
        lambda: _signout(client, transport, {"__session": member_session})
    )

    assert MEMBER_EMAIL not in written


@pytest.mark.parametrize("method", ["get", "put", "delete"])
def test_only_a_post_ends_a_session(client, transport, method):
    response = getattr(client, method)("/session/end", headers=request_headers(transport))

    assert response.status_code in (404, 405)
    assert "set-cookie" not in response.headers
