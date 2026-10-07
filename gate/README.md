# `gate/` — the hub gate

A FastAPI service on Cloud Run (`hub-gate`, `us-east1`, min-instances 0) that
puts the milestone tracker and the committee dossier behind sign-in, and serves
revocable share links to individual items.
Design authority: `llm/specs/2026-09-10-research-hub-design.md` §6;
decision: `llm/governance/adr/0004-private-area-cloud-run-gate-behind-hosting.md`.

## What it does — and what it deliberately does not

The gate implements §6 responsibilities 1–4, and only those:

| Route | Purpose |
|---|---|
| `POST /session` | Verify a Firebase ID token, mint a 14-day session cookie |
| `POST /session/end` | Sign out: clear `__session`. Origin-checked; identical whether or not a session existed |
| `GET /p/{path}` | Verify the session, check the allowlist, stream the object |
| `POST /share` | **Owner only**, origin-checked. Mint a token for one `(section, source, slug)`; body `{section, source, slug, entry, expires_in_days}`; returns `{token, expires_at, url}`. `entry` names the item's document relative to `_doc/` and defaults to `index.html` when omitted; it is validated with the same segment allowlist as a served path. `expires_in_days` is capped at 30; a bad item, entry or expiry is 400, a non-owner is 403 |
| `GET /share` | **Owner only**. List active shares. Never returns a full token — a short display id (`id`) plus `section`, `source`, `slug`, `entry`, `created_by`, `expires_at` |
| `DELETE /share/{token}` | **Owner only**, origin-checked. Revoke. Idempotent |
| `GET /s/{token}/{path}` | **No session.** Serve the token's one item's file inside that item's `<section>/<source>/<slug>/_doc/` prefix — the item-scoped document namespace, never the member frame. The empty path serves the stored `entry` (`_doc/<entry>`); a non-empty path resolves inside the prefix. Unknown, expired and revoked are all 404; a path that leaves the prefix is 404 |
| `POST /annotations` | **Member**, origin-checked. Body `{section, source, slug, selector, position, quote, comment, intent, tags}`; returns `{id, created}`. `member` is taken from the verified session, never the body. 400 malformed, 403 signed-out/non-member |
| `GET /annotations` | **Member.** Default: the caller's own notes. `?scope=all` is **owner only** and returns every note, with the owning member; a non-owner asking for all is refused (403), not downgraded. Supports `?intent=` and `?source=&slug=` filters (validated with the same segment allowlist) |
| `DELETE /annotations/{id}` | **Member or owner**, origin-checked. A member deletes only their own; the owner may delete any. 404 unknown id, 403 a member deleting another's |
| `GET /_health` | Deploy verification; reveals nothing. **Not** `/healthz`: that path never reaches the container on Cloud Run (Google's frontend answers it), verified at Checkpoint 4. |

`tests/test_scope.py` asserts the route table exactly, so a new route cannot
appear without a test and a README entry.

## Sharing

A share is one item by `(section, source, slug)`, stored at Firestore
`shares/{token}` with `{section, source, slug, entry, exp, revoked, created_by,
created_at}` (SEAM-S1; Lead Architect rulings 1 and 7). The private build
addresses an item's *member frame* at `<section>/<source>/<slug>/`
(`site/src/lib/frame-content.mjs: routeFor`, e.g.
`phd/phd-milestones/committee-dossier/`), but that directory carries the
members' navigation and absolute `/p/...` links, not the item's bytes. The
item's self-contained, item-scoped document copy is staged at
`<section>/<source>/<slug>/_doc/`, so that is where a token is pointed (SEAM-S1,
amended 2026-10-03); the full triple is stored and the gate cannot derive the
section from the bucket. `entry` is the item's document filename **relative to
`_doc/`** (`committee.html`, `anthropic-fellow.pdf`, possibly several segments
such as `site/index.html`); `GET /s/{token}/` serves `_doc/<entry>`, so a `pdf`
item is returned as a PDF rather than as `index.html` (SEAM-S1, amended again
2026-10-03). `entry` defaults to `index.html` when the mint body omits it, and
is validated with the same segment allowlist and prefix containment as any
served path, so it cannot escape `_doc/`. The token is the document id, minted
with `secrets.token_urlsafe(32)` — 256 bits. `exp` is computed server-side and
the client may ask for at most 30 days.

Minting, listing and revoking are **owner only**: a verified email that is still
on the allowlist **and** whose member document carries `role: owner`
(`members.is_owner`). Mint and revoke are state-changing and therefore carry the
same allowed-origin check as `/session/end`; listing is a read and does not.

`GET /s/**` needs no session and no origin check, and the handler never reads
the cookie and never calls `set_cookie` — a share link is opened in a fresh
browser. Authorisation is the token plus its stored item prefix
(`<section>/<source>/<slug>/_doc/`), and the served path is resolved with the
same allowlist and containment logic `/p/**` uses
(`safe_object_path(path, prefix)`), so a share cannot leave its own item
(SEAM-S8); the member frame and `_payload/**` sit outside that prefix and are
unreachable. The token root (the empty path) serves the stored `entry` at
`_doc/<entry>`; every other path resolves inside the prefix as before. An
unknown, expired or revoked token is a 404, never a 403, so the gate does not
confirm a token exists.

## Annotations

A note is a member's durable anchor on a quote inside one private item, stored
at Firestore `annotations/{id}` with `{id, member, section, source, slug,
selector, position, quote, comment, intent, tags, created, updated}`
(AN-STORE, issue #107). `selector` is a W3C `TextQuoteSelector`
(`exact`/`prefix`/`suffix`, the durable anchor); `position` is an optional
`TextPositionSelector` (`start`/`end`, the fallback). `quote` is a convenience
copy of `selector.exact`. Item identity uses the shares' segment allowlist:
`section`/`source` single safe segments, `slug` one or more. Bounds: `exact`
1–2000, `prefix`/`suffix` 0–64, `comment` 0–5000, `tags` ≤ 10 × ≤ 40,
`intent` in `{paper, experiment, brainstorm, question}` (default `question`).

Membership only (owner or member) is enough to write and read one's own notes.
`POST` and `DELETE` are state-changing and carry the same allowed-origin check
as the share routes; `GET` is a read and does not. `member` is taken from the
verified session — a client-supplied `member` cannot forge authorship.
`?scope=all` is **owner only** and is the export data source (`export-notes.mjs`
applies `site/notes-routing.json`; the gate does no rendering or routing); a
non-owner asking for all is refused, never silently downgraded to their own
rows. No quote, comment, title, selector or object path is ever logged — the
lines name the note by a short id and the author by email only.

**One deliberate `X-Frame-Options` exception.** The capture island reads the
selection from the item payload iframe at `/p/_payload/<source>/<path>`, same
origin as the frame, so a **served** private payload document
(`_payload/**` after the private prefix) is sent `X-Frame-Options: SAMEORIGIN`
instead of `DENY` (AN-CAP 3 / AN-GUARD-8). The decision is made on the served
object name, so a 404, a refusal or any non-`_payload` response keeps `DENY`.
There is no CSP `frame-ancestors` to change.

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

**It is Origin-checked, against a set the request cannot influence.**
`SameSite=Lax` is not a CSRF defence for this: Lax still sends the cookie on a
top-level POST that a cross-site page triggers. The gate compares `Origin`
against `GATE_ALLOWED_ORIGINS` and refuses anything else, including a POST with
no `Origin` at all.

The set is **configured, not derived**. An earlier version built it from the
`Host` and `X-Forwarded-Host` headers of the request being checked — so both
sides of the comparison came from the caller, and three spellings of a forged
sign-out were demonstrated over real HTTP. On the direct `*.run.app` URL the
invoker is `allUsers`, so the caller controls every header and that check was
worth nothing there. The reasoning behind it was that a configured list is a
fourth place to keep in step and the first to go stale fails closed on the real
domain; the trade is backwards. Failing closed on sign-out is a visible
nuisance a member can work around by clearing cookies. Failing open is silent.

Because the invoker is `allUsers`, the variable must name **both** origins the
gate answers on — the site's domain and the service's own `*.run.app` URL.
**Unset means every sign-out is refused**, with an `event=misconfigured` line at
boot and `reason=no_allowed_origins_configured` on each refusal. There is no
fallback to header comparison, because a fallback is the same defect under a
better name; `gate.yml`'s deploy smoke test asserts a same-origin sign-out
returns 200, so an unset variable fails the deploy rather than quietly
disarming the check.

A forged sign-out is only a nuisance; the check lives here because Phase 4's
mint and revoke need the same one and the stakes there are not a nuisance.

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
non-member, expired, traversal and missing-object outcomes, and
`tests/test_shares.py` makes the same assertion for every `/s/**` and
`/share/**` outcome (A7).

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

## Client telemetry, and why its values are scrubbed twice

`POST /client-events` is unauthenticated **by design** and stays that way: it
exists to receive a report from a browser that has *failed* to obtain a session,
so requiring a credential would defeat it (ADR-0013). Its protections are caps
and scrubbing rather than identity.

`_clean_client_value()` strips non-printable characters, so no caller can forge
a separate log *line*. That was not enough. Both log-based metrics in
`infra/monitoring.tf` match a **substring of `textPayload` anywhere in the
line**, so a value of `event=deny` inside an ordinary field made the denials
metric count a denial that never happened — demonstrated against production. So
a client-supplied string may not contain the gate's own `event=` grammar
anywhere: the trace id, the event name, the field names and the field values are
all checked.

Such a report is **not dropped**. Dropping it silently is the same blindness
this endpoint exists to end, and it would tell the caller which payloads vanish.
It is counted, reclassified so the caller cannot choose which metric its report
lands in, and emitted with the offending text neutralised:

```
INFO gate event=client_grammar_rejected trace=t-1 smuggled=1 reported=probe note=event-deny
```

`smuggled=` is the count, `reported=` is what the caller called it, and the line
matches neither metric filter. A steady trickle is browser noise; a sustained
stream is someone working on the metrics.

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
| `GATE_SHARES_COLLECTION` | `shares` | Firestore collection holding share tokens |
| `GATE_ANNOTATIONS_COLLECTION` | `annotations` | Firestore collection holding annotations |
| `GATE_SHARE_BASE_URL` | *(empty — relative URL)* | Absolute origin for a minted share URL. Empty returns `/s/{token}/` |
| `GATE_SESSION_DAYS` | `14` | Session lifetime; 14 is Firebase's maximum |
| `GATE_CHECK_REVOKED` | `true` | Check revocation on every request |
| `GATE_LOG_OBJECT_PATHS` | `false` | Log object paths (a private slug) |
| `GATE_ALLOWED_ORIGINS` | *(empty — sign-out refuses everything)* | Comma-separated `https://host[:port]` origins the CSRF check accepts. Must name the site domain **and** the service's `*.run.app` URL |

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
