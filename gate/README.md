# `gate/` — the hub gate

A FastAPI service on Cloud Run (`hub-gate`, `us-east1`, min-instances 0) that
puts the milestone tracker and the committee dossier behind sign-in.
Design authority: `llm/specs/2026-09-10-research-hub-design.md` §6;
decision: `llm/governance/adr/0004-private-area-cloud-run-gate-behind-hosting.md`.

## What it does — and what it deliberately does not

Phase 3 builds §6 responsibilities 1–3, and only those:

| Route | Purpose |
|---|---|
| `POST /session` | Verify a Firebase ID token, mint a 14-day session cookie |
| `POST /session/end` | Sign out: clear `__session`. Origin-checked; identical whether or not a session existed |
| `GET /p/{path}` | Verify the session, check the allowlist, stream the object |
| `GET /_health` | Deploy verification; reveals nothing. **Not** `/healthz`: that path never reaches the container on Cloud Run (Google's frontend answers it), verified at Checkpoint 4. |

Share links — §6 responsibility 4, `/s/**` and `/share/**` — are **Phase 4**.
They are absent rather than stubbed, and `tests/test_scope.py` fails if a route
for them appears, because a half-built share route that answers at all is a way
to reach private bytes without a session.

## The two things most likely to make a correct-looking gate wrong

Both come from ADR-0004, and both are why this service has the tests it has.

**1. The session cookie is named `__session`.** Firebase Hosting forwards only
that cookie to a Cloud Run rewrite and strips every other one. Any other name
gives a gate that passes every direct test and fails only through Hosting — and
the failure reads as a session bug, not a naming bug. The name is a constant in
`app/config.py` and is deliberately *not* configurable by environment variable.

**2. The Cloud Run invoker is `allUsers`, deliberately.** Authorisation is
application-level, so the service's `*.run.app` URL is reachable by anyone.
Every authorisation test therefore runs twice — see `tests/conftest.py`
`request_headers()`, which sends each case both as Hosting would deliver it
(every cookie but `__session` stripped) and as a direct request. A check that
holds only behind Hosting is not a check.

## Signing out

`POST /session/end` clears `__session`. Before it existed there was no way out
of a 14-day `HttpOnly` session — only the browser could forget it — so a member
on a shared machine could not end their own session (STATE, SD-4).

Three things about it are easy to get wrong, and each has a test in
`tests/test_signout.py`:

**The clear must match the mint attribute for attribute.** A browser keys a
cookie on name, domain and path, so a `Set-Cookie` that differs in `Path`, or
that omits `Secure`, `HttpOnly` or `SameSite`, can be stored as a *second*
cookie and leave the session exactly where it was. The response still says 200
and the log still says the member signed out. `app/main.py` defines the
attributes once, in `SESSION_COOKIE_ATTRS`, and both paths use it; the test
parses both headers and compares them anyway.

**It is Origin-checked.** `SameSite=Lax` is not a CSRF defence for this: Lax
still sends the cookie on a top-level POST that a cross-site page triggers. The
gate compares `Origin` against the host the request was addressed to (`Host`,
or `X-Forwarded-Host`) and refuses anything else, including a POST with no
`Origin` at all. Nothing is configured, so the same code is right on the site's
domain and on the service's own `*.run.app` URL. A forged sign-out is only a
nuisance; the check lives here because Phase 4's mint and revoke need the same
one and the stakes there are not a nuisance.

**It answers identically whether or not a session existed.** It never reads the
cookie — no verification, no lookup, nothing to time — so it is not an
existence oracle, which is the rule `/p/**` already follows.

It does **not** revoke the session server-side. Clearing the cookie ends the
session in that browser; "sign out everywhere" needs the uid, which needs the
cookie verified, which is work done for an anonymous caller. That belongs with
Phase 4's session work, where `GATE_CHECK_REVOKED` already makes revocation
bite on every request.

A client calls it same-origin, which is what makes the browser send `Origin`:

```js
await fetch("/session/end", { method: "POST", credentials: "same-origin" });
```

`/session/end` needs a Firebase Hosting rewrite to reach the gate through the
site's domain, in the same shape as `/session`.

## Caching

Every response carries `Cache-Control: private, no-store`, applied by
middleware after the route has run so no framework or file-serving default can
leave a cacheable header behind. Hosting's CDN caches a rewrite response only
if the gate itself sends `public` or `s-maxage`; `tests/test_headers.py`
asserts that no `/p/**` response ever does, across served, signed-out,
non-member, expired, traversal and missing-object outcomes.

## Path safety

The private bucket's namespace is **flat**, so a crafted path is a literal
object name, not a filesystem walk. `app/serve.py` therefore applies an
allowlist rather than a blocklist: a path is refused unless every segment
matches `[A-Za-z0-9._-]+`. `..`, encoded and double-encoded `..`, absolute
paths, backslashes, NUL and control characters are refused as a consequence of
that rule rather than as a list of spellings someone has to keep complete.
Validation happens *after* authentication and authorisation, so an anonymous
caller never reaches it and never causes a bucket lookup.

## What it never says

No response body names a private item, echoes the requested path, or varies
with what exists in the bucket. Signed-out and non-member refusals are
byte-identical for a real path and an imaginary one, so the gate cannot be used
to enumerate what is behind it. Object paths stay out of logs unless
`GATE_LOG_OBJECT_PATHS` is set, because an object path under `/p/**` *is* a
private slug and Cloud Logging has a wider audience than the allowlist.

## Configuration

Set by Cloud Run; the infra stream owns the service's env block.

| Variable | Default | Meaning |
|---|---|---|
| `GATE_PRIVATE_BUCKET` | *(required)* | The private bucket the gate reads |
| `GOOGLE_CLOUD_PROJECT` | *(from metadata)* | Project for Firebase/Firestore |
| `GATE_PRIVATE_PREFIX` | *(empty)* | Optional prefix within the bucket |
| `GATE_MEMBERS_COLLECTION` | `members` | Firestore allowlist collection |
| `GATE_SESSION_DAYS` | `14` | Session lifetime; 14 is Firebase's maximum |
| `GATE_CHECK_REVOKED` | `true` | Check revocation on every request |
| `GATE_LOG_OBJECT_PATHS` | `false` | Log object paths (a private slug) |

There is **no credential to configure**. The gate runs as its own service
account and obtains tokens from the metadata server through Application Default
Credentials. A key file anywhere here is a review failure (design doc §12.2).

## Developing

System Python is 3.8 on the development workstation; the gate targets **3.12**.

```sh
uv venv --python 3.12 .venv && . .venv/bin/activate
uv pip install --require-hashes --no-deps -r requirements-dev.txt
ruff check . && ruff format --check . && pytest
```

`requirements.txt` (runtime) and `requirements-dev.txt` (runtime plus test
tooling) are compiled from `pyproject.toml` with hashes:

```sh
uv pip compile pyproject.toml --generate-hashes -o requirements.txt
uv pip compile pyproject.toml --extra dev --generate-hashes -o requirements-dev.txt
```

The image installs with `--require-hashes --no-deps`, so nothing enters the
container that is not named and checksummed in this repository. The base image
is pinned by digest as well as tag, for the same reason `ci.yml` pins actions.

The test suite runs entirely against in-memory fakes: there are no cloud
credentials in the development environment and none may be created.
