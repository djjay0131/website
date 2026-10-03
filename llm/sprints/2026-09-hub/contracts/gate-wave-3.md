# Contract — `gate`, Wave 3 (Phase 4 sharing)

Status: Issued
Date: 2026-10-02
Owner: Lead Architect
Stream: `gate` (`gate/**`, `.github/workflows/gate.yml`)
Issue: `hub-004`
Branch: `feat/sharing`
Seams: `llm/sprints/2026-09-hub/contracts/phase-4-seams.md`
Design: design doc §6 responsibility 4; roadmap §11 Phase 4

## Purpose

Implement share links: an owner mints a token for one `(source, slug)`, anyone
with the link reads that item's files until it expires or is revoked, and the
owner can list and revoke. Keep the gate small enough to read in one sitting.

## Scope

- `gate/app/**` (new `shares.py`, routes in `main.py`, config in `config.py`)
- `gate/tests/**`
- `gate/README.md` route table

Do NOT touch `site/**`, `firebase.json`, `infra/**`; those are other streams.

## Requirements (see the seams for the binding shape)

1. **Store (SEAM-S1).** Firestore `shares/{token}` with `{section, source,
   slug, entry, exp, revoked, created_by, created_at}`. Token
   `secrets.token_urlsafe(32)`. `expires_in_days` ∈ [1,30]. One slug per token.
   `entry` is the item's document filename relative to `_doc/`.
2. **Mint `POST /share`** (owner only): body `{section, source, slug, entry,
   expires_in_days}`. Validate `(section, source, slug, entry)` against the
   private content the gate can see (a manifest read or a config; if the gate
   cannot enumerate items, mint for a well-formed quad and let serving 404); 403
   for non-owner; 400 for bad input; return `{token, expires_at, url}`. Enforce
   the allowed-origin check. `entry` defaults to `index.html` when omitted, so the
   API stays usable without it and existing clients are not broken.
3. **List `GET /share`** (owner only): active shares, never returning a full
   token (return a short id + `created_by`, `exp`, `section`, `source`, `slug`,
   `entry`).
4. **Revoke `DELETE /share/{token}`** (owner only): set `revoked: true`,
   idempotent, origin check.
5. **Serve `GET /s/{token}/{path:path}`** (no session): resolve the token; reject
   unknown/expired/revoked with 404 (never 403, so a token's existence is not
   confirmed); resolve the path **inside the token's item prefix only** —
   `<section>/<source>/<slug>/_doc/`, built from the stored triple, with the empty
   path serving the stored `entry` (SEAM-S1, as amended 2026-10-03: the item's
   bytes live under `_doc/`, not the member frame) — reusing the existing
   path-allowlist and prefix-containment logic (SEAM-S8); stream bytes with
   correct `Content-Type` (so a `pdf` entry is served as a PDF, not HTML).
6. **Caching (SEAM-S3).** Every `/s/**` and `/share/**` response carries
   `Cache-Control: private, no-store`. Add a test.
7. **No credentials on `/s/**`**: accept no cookie/session; never mint one.
8. **Tests (pytest).** Mint/verify; non-owner 403; unknown/expired/revoked 404;
   slug escape (`../`, `%2e%2e`, a second slug, absolute) refused for `/s/**` and
   `/p/**`; token entropy; every response `private, no-store`; list hides tokens.

## Evidence

`cd gate && pytest` green; a manual note of the routes added; no secrets.

## Exit

Routes implemented and unit-tested; `gate.yml` unchanged unless a test needs it.
The owner's live mint/open/revoke (SEAM-S7) is a separate, owner-only step.

## Lead Architect rulings on the first stream's open questions (2026-10-03)

The `gate` stream delivered the routes correctly but reported six open questions.
These are the rulings; they bind the follow-up and every downstream stream.

1. **The item prefix gains `section` (SEAM-S1), and the served root is the
   item's `_doc/` namespace.** The store keeps `(section, source, slug)`;
   `_share_item_prefix` returns `<section>/<source>/<slug>/_doc`. The section is
   validated with the same segment
   allowlist as source/slug (`safe_prefix`), single segment for `section` and
   `source`, and is **not** restricted to a hardcoded enum — the gate cannot own
   the hub's section set, and an object that does not exist still 404s. This is
   the "store `section`/`prefix`" option (a) in the handoff; do not flatten the
   private layout.
2. **`GET /share` stays token-less.** The short display `id` is kept; the full
   token is returned only by the mint that created it. The owner UI (SEAM-S6)
   retains the token from the mint in the browser session and offers revoke for
   those rows, plus a paste-a-token/link revoke for shares the owner saved. This
   is a usability limit, not a security one, and is recorded as fix-later.
3. **The display `id` may remain a token prefix.** It is 12 characters against a
   43-character credential over an owner-only, `private, no-store` response. If
   the owner UI is ever exposed more widely, revisit with a keyed hash; recorded,
   not changed.
4. **IAM is the `infra` stream's** (SEAM-S5): the runtime SA moves from
   `roles/datastore.viewer` to a write-capable Firestore grant, recorded there.
5. **Rewrites are the `site` stream's** (SEAM-S4). Until they land the routes
   answer only on `*.run.app`; the Wave 3 merge carries both.
6. **Token collision on `set` is accepted**, defended only by 256-bit entropy.
   Recorded, not changed.
7. **`entry` names the item's document** (2026-10-03, site follow-up). Store it;
   mint accepts it (default `index.html` if absent, so the API and old clients
   keep working); list returns it; `GET /s/{token}/` serves `_doc/<entry>`. It is
   validated as a relative object path with the same segment allowlist and
   prefix containment as any served path, so it cannot escape `_doc/`. This is
   what lets a `pdf` item be shared as a PDF rather than as `index.html`.
