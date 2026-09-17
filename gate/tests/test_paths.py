"""Path-traversal rejection on /p/ (deliverable D2).

The private bucket's namespace is flat, so a crafted path is a literal object
name rather than a filesystem walk. These run with a VALID MEMBER SESSION on
purpose: refusing an anonymous caller proves nothing about the path validator,
because authentication happens first.

There are two lists below, and the distinction is load-bearing.

`HOSTILE_PATHS` is every spelling the validator must reject, tested directly
against `safe_object_path`. Several of them -- a raw NUL, a raw CR/LF, a bare
`.` segment -- cannot be put on the wire at all: a conforming HTTP client
refuses to send them, or normalises them away before the request leaves. Their
unit test is the real test, because if such a byte ever does reach the handler
(a non-conforming client, a future framework change, a direct ASGI call) the
validator is the only thing standing there.

`HOSTILE_REQUESTS` is what an attacker can actually transmit: the same attacks
percent-encoded, which travel intact through clients and proxies and arrive at
the handler decoded. Those are exercised end to end through the gate.
"""

from __future__ import annotations

import pytest
from conftest import request_headers

from app.serve import UnsafePath, safe_object_path

# Spelled as they would arrive at the handler, after the server has decoded the
# path. Includes the bytes no HTTP client will transmit -- see the module note.
HOSTILE_PATHS = [
    "../secrets.html",
    "../../etc/passwd",
    "phd/../../etc/passwd",
    "phd/milestones/../../../secrets",
    "..",
    "../",
    "%2e%2e/secrets",
    "%2e%2e%2fsecrets",
    "..%2fsecrets",
    "%252e%252e%252fsecrets",
    "....//secrets",
    "/etc/passwd",
    "//evil.example.com/x",
    "\\windows\\system32",
    "phd\\..\\..\\secrets",
    "phd/milestones\x00.html",
    "phd/\x00/milestones",
    "phd//milestones/index.html",
    "./phd/milestones/index.html",
    "phd/./milestones/index.html",
    "phd/milestones/index.html\n",
    "phd/milestones/index.html\r\nX-Injected: 1",
    "a b/c.html",
    "sources/../../private",
    "\x00",
]

# Percent-encoded attacks, which an HTTP client transmits verbatim and the ASGI
# server decodes before routing. This is the form a real traversal attempt
# takes, precisely because it survives intermediaries that would normalise a
# literal `../`.
HOSTILE_REQUESTS = [
    "%2e%2e%2fsecrets",
    "%2e%2e/secrets",
    "..%2fsecrets",
    "%252e%252e%252fsecrets",
    "phd%2f..%2f..%2fsecrets",
    "phd%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd",
    "%2fetc%2fpasswd",
    "%5cwindows%5csystem32",
    "phd%5c..%5c..%5csecrets",
    "phd/milestones%00.html",
    "%00",
    "phd%0d%0aX-Injected:%201",
    "phd%0aX-Injected:%201",
    "%2e%2e",
    "....%2f%2fsecrets",
    "phd%2f%2fmilestones%2findex.html",
    "a%20b/c.html",
]


@pytest.mark.parametrize("hostile", HOSTILE_PATHS)
def test_safe_object_path_rejects(hostile):
    with pytest.raises(UnsafePath):
        safe_object_path(hostile)


@pytest.mark.parametrize("hostile", HOSTILE_REQUESTS)
def test_gate_refuses_hostile_requests_and_never_touches_the_bucket(
    client, store, member_session, hostile, transport
):
    response = client.get(f"/p/{hostile}", headers=request_headers(transport, {"__session": member_session}))

    assert response.status_code == 404
    # The decisive assertion: no object lookup happened at all, so a crafted
    # name cannot become a literal object name in a flat namespace.
    assert store.fetches == []


@pytest.mark.parametrize("hostile", HOSTILE_REQUESTS)
def test_hostile_requests_leak_nothing_in_the_response(client, member_session, hostile, transport):
    response = client.get(f"/p/{hostile}", headers=request_headers(transport, {"__session": member_session}))

    assert "Milestone tracker" not in response.text
    assert "Committee dossier" not in response.text
    # The refusal never echoes what was asked for.
    assert "secrets" not in response.text
    assert "passwd" not in response.text


def test_a_query_string_cannot_change_the_object_name(client, store, member_session, transport):
    """A query string is not part of the path, and must not become one.

    Cache-busting query strings are normal on a static build's assets, so this
    is served -- but the object fetched is the path alone.
    """
    response = client.get(
        "/p/phd/milestones/index.html?v=deadbeef",
        headers=request_headers(transport, {"__session": member_session}),
    )

    assert response.status_code == 200
    assert store.fetches == ["phd/milestones/index.html"]


@pytest.mark.parametrize(
    "path,expected",
    [
        ("phd/milestones/index.html", "phd/milestones/index.html"),
        ("assets/private.css", "assets/private.css"),
        ("phd/milestones/", "phd/milestones/index.html"),
        ("", "index.html"),
        ("a-b_c.1/d.html", "a-b_c.1/d.html"),
    ],
)
def test_safe_object_path_accepts_real_build_output(path, expected):
    assert safe_object_path(path) == expected


def test_prefix_is_applied_when_configured():
    assert safe_object_path("phd/milestones/index.html", "private") == ("private/phd/milestones/index.html")


@pytest.mark.parametrize("hostile", ["../escape.html", "..", "/absolute"])
def test_nothing_escapes_a_configured_prefix(hostile):
    with pytest.raises(UnsafePath):
        safe_object_path(hostile, "private")


def test_overlong_path_is_rejected():
    with pytest.raises(UnsafePath):
        safe_object_path("a/" * 400 + "x.html")


def test_deeply_nested_path_is_rejected():
    with pytest.raises(UnsafePath):
        safe_object_path("/".join(["a"] * 40) + "/x.html")
