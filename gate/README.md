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
| `GET /p/{path}` | Verify the session, check the allowlist, stream the object |
| `GET /healthz` | Deploy verification; reveals nothing |

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
