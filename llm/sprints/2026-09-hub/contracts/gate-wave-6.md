# Contract — `gate`, Wave 6 (annotations)

Status: Issued
Date: 2026-10-07
Owner: Lead Architect
Stream: `gate` (`gate/**`, `.github/workflows/gate.yml`)
Issue: #107
Branch: `feat/annotations`
Seams: `llm/sprints/2026-09-hub/contracts/wave-6-annotations-seams.md`
Design: ADR-0021; ADR-0018 (the shares pattern); issue #107

## Purpose

Implement the annotation store and its four routes, copying the shares pattern
exactly (validation, origin check, no-store, owner/member re-check, no private
material in logs), plus the one header change the capture island needs.

## Scope

- `gate/app/**` (new `annotations.py`; routes and helpers in `main.py`;
  `config.py` if a collection name is added)
- `gate/tests/**`
- `gate/README.md` route table
- `gate/app/main.py`: the private `_payload/**` `X-Frame-Options` change below

Do NOT touch `site/**`, `firebase.json`, `infra/**` — other streams own those.

## Requirements

1. **Store (AN-STORE).** New `gate/app/annotations.py`, mirroring `shares.py`:
   an `Annotation` dataclass, an `AnnotationStore` Protocol, a
   `FirestoreAnnotationStore` (collection `annotations`, project-wide
   `datastore.user` already held per ADR-0018), and a `StaticAnnotationStore`
   test double. `id = secrets.token_urlsafe(16)`. Fields exactly as AN-STORE.
   `_annotation_from_document` refuses a malformed row rather than defaulting.
2. **Validation.** `section`/`source` single safe segments, `slug` one or more,
   all via the existing `safe_prefix`/`_checked_segments` allowlist. `intent` in
   `{paper, experiment, brainstorm, question}`. `exact` 1–2000, `prefix`/`suffix`
   0–64, `comment` 0–5000, `tags` ≤10 × ≤40 chars. `position` optional and, if
   present, integer `start`/`end` with `0 <= start <= end`. A `bool` is not an
   int. Reject unknown selector `type` values.
3. **`POST /annotations`** (member, origin-checked): store with
   `member = principal.email` (never from the body); return `{id, created}`;
   403 signed-out/non-member; 400 malformed. Body cap like `MAX_SHARE_BODY_BYTES`.
4. **`GET /annotations`** (member): default the caller's own rows; `?scope=all`
   is **owner-only** (a non-owner asking for all is refused, not silently
   downgraded to own). Return row fields but never another member's email to a
   non-owner. Support `?intent=` and `?source=&slug=` filters (applied in
   Python, like `list_active`).
5. **`DELETE /annotations/{id}`** (member or owner, origin-checked): a member
   deletes only their own; the owner may delete any. 404 unknown id; 403 a
   member deleting another's. Idempotent-in-effect like shares.
6. **Export data source (AN-EXPORT).** No gate-side rendering or routing: the
   owner-only `GET /annotations?scope=all` is the export data source. The site
   stream's `export-notes.mjs` applies `site/notes-routing.json`. The gate must
   therefore return every field a note needs to be rendered (item identity,
   quote, comment, intent, tags, created, and the owning member to the owner).
   The cross-repository write and its credential are out of scope and blocked.
7. **Header change (AN-CAP 3).** In the `security_headers` middleware, serve
   private payload documents — the served object path begins with
   `_payload/` (after the private prefix) — with
   `X-Frame-Options: SAMEORIGIN`; every other response keeps `DENY`. There is no
   CSP `frame-ancestors` to change. Add a test for both branches.
8. **Logging.** No quote, comment, title, selector or object path in any log
   line. Log `event=… scope=annotation action=… id=<short> by=<email>` only.
   Add a log-scrape test that plants a distinctive quote and comment and asserts
   they do not appear in captured logs.
9. **Tests (pytest).** Create/read/delete; non-owner cannot read all; a member
   cannot read or delete another's; signed-out/non-member 403 on both
   transports; origin check on POST/DELETE; every response `private, no-store`;
   malformed fields refused; the `X-Frame-Options` SAMEORIGIN branch for
   `_payload/` and DENY elsewhere; export renders and routes, skips `question`.

## Evidence

`cd gate && .venv/bin/python -m pytest -q` green with the new tests named; ruff
clean (`ruff check gate` if configured); the route table updated.

## Exit

Routes and store implemented and unit-tested; `gate.yml` unchanged unless a test
requires a change. Report as `handoffs/gate-wave-6.md`.

## Out of scope

The site island and My notes page; `firebase.json`; any credential or
cross-repository write; a `PATCH` route (orphan state is computed at read in
v1).
