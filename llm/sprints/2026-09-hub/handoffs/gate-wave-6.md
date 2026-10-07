# Handoff — `gate`, Wave 6 (annotations)

Stream: `gate` (`gate/**`, `.github/workflows/gate.yml`)
Issue: #107 · Branch: `feat/annotations` · Date: 2026-10-07
Contract: `contracts/gate-wave-6.md` · Seams: `contracts/wave-6-annotations-seams.md`
Status: complete, suite green.

## Summary

Implemented the annotation store, its three routes, and the one capture-island
header change the wave needs. Copied the shares pattern for validation, origin
checks, `private, no-store`, per-request owner/member re-checks and log
discipline.

Files changed (all in stream scope):

- **new** `gate/app/annotations.py` — `Annotation`, `TextQuoteSelector`,
  `TextPositionSelector`, `AnnotationStore` Protocol,
  `FirestoreAnnotationStore` (collection `annotations`), `StaticAnnotationStore`,
  `new_annotation_id()` (`secrets.token_urlsafe(16)`), and
  `_annotation_from_document()` which refuses a malformed row rather than
  defaulting.
- `gate/app/config.py` — `Settings.annotations_collection` (default
  `annotations`) read from `GATE_ANNOTATIONS_COLLECTION`.
- `gate/app/main.py` — `Dependencies.annotations`; `FirestoreAnnotationStore`
  wired in `build_dependencies`; `MAX_ANNOTATION_BODY_BYTES = 16384`; the three
  routes and validation helpers; the `security_headers` middleware change.
- `gate/tests/conftest.py` — `annotations` fixture; `Dependencies` wiring.
- **new** `gate/tests/test_annotations.py` — 155 passing cases.
- `gate/tests/test_headers.py` — the `_payload/**` `SAMEORIGIN`/`DENY` tests.
- `gate/tests/test_scope.py` — exact route table updated.
- `gate/README.md` — route table, an Annotations section, config var.

### New routes

| Route | Auth | Notes |
|---|---|---|
| `POST /annotations` | member, origin-checked | body as AN-ROUTES → `{id, created}` (200); `member` from the verified session, never the body; 400 malformed, 403 signed-out/non-member |
| `GET /annotations` | member | default own rows; `?scope=all` owner-only (403 if not owner, never downgraded); `?intent=`/`?source=`/`?slug=` filters applied in Python; unknown scope 400 |
| `DELETE /annotations/{annotation_id}` | member or owner, origin-checked | member deletes only their own (403 otherwise); owner deletes any; 404 unknown id |

### Header change (AN-CAP 3)

`serve_private` records the **served object name** on
`request.state.served_object_name` only on the 200 path (after a successful
`safe_object_path` + bucket fetch). The `security_headers` middleware, after
`call_next`, sends `X-Frame-Options: SAMEORIGIN` iff that name, with the
configured private prefix stripped, is `_payload` or begins `_payload/`
(`_is_payload_object`). Every other response — including a 404, a signed-out or
non-member refusal on a `_payload` path, a traversal, and every non-`/p` route —
keeps `DENY`. The check is on the served name, so the `/p/_payload/...` request
shape is handled by construction and no path is validated twice.

### Evidence

- `cd gate && .venv/bin/python -m pytest` → **624 passed**, 2 warnings
  (baseline before this wave: 455 passed; +169 cases, 155 of them in
  `test_annotations.py`).
- `.venv/bin/ruff check .` → All checks passed.
- `.venv/bin/ruff format --check .` → 22 files already formatted.
- `gate.yml` unchanged.

## Assumptions

1. **`member` is stored normalised** (`normalise_email(principal.email)`), per
   AN-STORE's "normalised (lowercased) email", rather than the raw
   `principal.email` in the task text. For every lowercased Firebase address
   they are identical; normalising keeps `list_for`/delete comparisons exact.
2. **`intent` defaults to `question` when the key is absent** (AN-CAP 4's chip
   default and the safe default: `question` never exports); a present but
   non-string or out-of-enum value is 400.
3. **`quote` is a convenience copy of `selector.exact`.** A body that supplies a
   `quote` differing from `selector.exact`, and a stored row where they differ,
   are both refused — the two cannot disagree in the store.
4. **`prefix`/`suffix` default to `""`** and are bounded at 64 (contract/AN-STORE
   bound wins over AN-CAP 5's "up to 32").
5. **`POST` returns 200** (matching `POST /share`), with `{id, created}`.
6. **`DELETE` is not idempotent against an unknown id** — the contract says 404
   unknown id, so this deliberately differs from `DELETE /share/{token}` (which
   is 200). Re-deleting a row just deleted is also 404.
7. Gate-side export **rendering/routing is out of scope** (AN-EXPORT, task step
   5): `GET /annotations?scope=all` is the data source; `export-notes.mjs` owns
   rendering and `notes-routing.json`. No export test lives in `gate/`.

## Recommendations

- The site stream should treat `comment`/`quote` as untrusted free text and must
  escape them when rendering My notes / the capture panel and when writing
  exported Markdown (Red Team targets 2 and 6). The gate returns JSON with
  item-identity segments already confined to `[A-Za-z0-9._-]`, but it does not
  and cannot sanitise free text for an HTML/Markdown sink.
- Add `GATE_ANNOTATIONS_COLLECTION` to the Cloud Run env block only if a future
  tenant wants a non-default collection; the default makes it optional.
- The `infra` stream still records AN-IAM (no new binding; 0/0/0 plan) as a
  comment in `infra/gate.tf`.

## Alternatives

- **Path-derived header check in the middleware** (call `safe_object_path` on
  the request path) was rejected: it duplicates validation, can raise for
  non-`/p` requests, and would grant `SAMEORIGIN` to a 404 on a `_payload`
  shape. Recording the actually-served name in the route is narrower and only
  fires on a 200.
- **Flattening selector/position into scalar dataclass fields** was rejected in
  favour of nested `TextQuoteSelector`/`TextPositionSelector`, which keeps the
  persisted shape and the response shape the same and makes the parser's
  type/order refusal explicit.
- **`list_for` filtering in Python** (as `list_active` filters expiry) was not
  needed: equality on `member` uses Firestore's automatic single-field index.
  The `intent`/`source`/`slug` filters are applied in Python at the route.

## Risks

- **Free-text XSS and export injection** are owned by the site stream; the gate
  only bounds and stores the text (see Recommendations).
- **`scope=all` is the export data source.** If the owner membership check ever
  regresses, every note on every item leaks in one request. It is re-checked
  per request via `_is_owner` (verified + still on allowlist + `role: owner`),
  not trusted from the session, and covered by the refused-not-downgraded test.
- **Cross-member read** is defended by `list_for` scoping and per-request
  identity; the tests assert a non-owner cannot see another's quote by id or in
  the response body.
- The `_payload` exception widens framing for one namespace only; the served-name
  check and the `DENY`-on-refusal tests constrain it.

## Open questions

1. **`?scope=` default and value set.** I accept `all` and `own` (plus absent →
   own) and 400 anything else. If the site island sends no `scope` for its own
   notes (expected), nothing changes. Should an explicit `?scope=own` by a
   non-owner be the only accepted spelling, or should a future `?section=` filter
   be added? (Contract lists only intent/source/slug, so I added none.)
2. **`quote` echo.** Is the island expected to send `quote` at all? It is
   accepted, must equal `selector.exact` if present, and is otherwise ignored in
   favour of `selector.exact`. If the island omits it, no change is needed.
3. **Row shape for a non-owner.** `member` is always present in a row; for a
   non-owner it is necessarily their own address (rows are scoped by
   `list_for`). If the owner-only export contract wants the field *absent* for
   non-owners, that is a one-line change.

## Related docs

- `llm/sprints/2026-09-hub/contracts/gate-wave-6.md`
- `llm/sprints/2026-09-hub/contracts/wave-6-annotations-seams.md` (AN-STORE,
  AN-ROUTES, AN-GUARD, AN-IAM, AN-CAP 3, AN-EXPORT)
- ADR-0016 (private by default), ADR-0017/0018 (shares pattern), ADR-0021
  (annotations), ADR-0022 (Proposed — export credential)
- `gate/README.md` (route table + Annotations section)

## ADR candidates

- **Exact-name framing exception.** The `X-Frame-Options: SAMEORIGIN` for
  `_payload/**` is a deliberate, security-reviewed widening of the gate's
  `DENY` policy. Worth an ADR note (or an addendum to ADR-0021) recording that
  the exception keys on the *served* object name, not the request path, and
  never applies to a refusal.
- **Annotation row shape + `question` non-export.** The `quote == exact`
  invariant, the normalised `member`, and `question → null` routing are
  decisions a future maintainer will otherwise re-litigate.
