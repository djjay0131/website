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

1. **Store (SEAM-S1).** Firestore `shares/{token}` with `{source, slug, exp,
   revoked, created_by, created_at}`. Token `secrets.token_urlsafe(32)`.
   `expires_in_days` ∈ [1,30]. One slug per token.
2. **Mint `POST /share`** (owner only): validate `(source, slug)` against the
   private content the gate can see (a manifest read or a config; if the gate
   cannot enumerate items, mint for a well-formed `(source, slug)` and let
   serving 404); 403 for non-owner; 400 for bad input; return
   `{token, expires_at, url}`. Enforce the allowed-origin check.
3. **List `GET /share`** (owner only): active shares, never returning a full
   token (return a short id + `created_by`, `exp`, `slug`).
4. **Revoke `DELETE /share/{token}`** (owner only): set `revoked: true`,
   idempotent, origin check.
5. **Serve `GET /s/{token}/{path:path}`** (no session): resolve the token; reject
   unknown/expired/revoked with 404 (never 403, so a token's existence is not
   confirmed); resolve the path **inside the token's item prefix only**, reusing
   the existing path-allowlist and prefix-containment logic (SEAM-S8); stream
   bytes with correct `Content-Type`.
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
