# Handoff — `gate`, Wave 3 (Phase 4 sharing)

Status: Delivered
Date: 2026-10-03
Stream: `gate` (`gate/**`)
Issue: `hub-004`
Branch: `feat/sharing`
Contract: `llm/sprints/2026-09-hub/contracts/gate-wave-3.md`
Seams: `llm/sprints/2026-09-hub/contracts/phase-4-seams.md`

## Summary

Phase 4 requirement 1–8 are implemented and unit-tested. An owner mints a
`secrets.token_urlsafe(32)` token for one `(source, slug)`, a signed-out browser
can read only that item's files through `GET /s/{token}/{path}`, and the owner
can list and revoke. The token is the Firestore document id; expiry is
server-side and capped at 30 days; every `/s/**` and `/share/**` response is
`Cache-Control: private, no-store` (closes A7's `/s/**` half).

`cd gate && pytest` → **396 passed**, ruff clean, `ruff format --check` clean.

**One seam-level defect is reported, not papered over** (Open questions #1): the
seam stores only `(source, slug)`, but the real private build routes an item to
`<section>/<source>/<slug>/` (`site/src/lib/frame-content.mjs: routeFor`) and the
bucket holds that full path. The gate cannot derive `section`, so serving
currently resolves `<source>/<slug>` and will 404 against the real bucket until
the seam is amended.

## What changed

- **`gate/app/shares.py` (new).** `Share` dataclass; `ShareStore` Protocol;
  `FirestoreShareStore` (lazy client, mirrors `members.py`) and
  `StaticShareStore` (test double). `mint_token()` and `expiry_from_days()`
  enforce `expires_in_days ∈ [1, 30]`. `Share.is_active()` is the single
  revoked/expired decision.
- **`gate/app/members.py`.** Added `is_owner(email)` to the Protocol, the
  Firestore implementation (`role == "owner"` on the member document), and
  `StaticMemberDirectory(owners=...)`. Owner is D3's `role: owner`; existence of
  the document is still membership, now with the role consulted.
- **`gate/app/serve.py`.** Extracted `_checked_segments()` from
  `safe_object_path()` and added `safe_prefix()` for an item's relative
  namespace. Serving a share calls `safe_object_path(path, prefix)` — the same
  allowlist and prefix-containment check `/p/**` uses (SEAM-S8). No behaviour
  change to `/p/**`; all existing path tests still pass.
- **`gate/app/config.py`.** `shares_collection` (`GATE_SHARES_COLLECTION`,
  default `shares`) and `share_base_url` (`GATE_SHARE_BASE_URL`, default empty →
  a relative `/s/{token}/` URL).
- **`gate/app/main.py`.** `Dependencies.shares`, production wiring, the four
  routes, and helpers (`_refuse_cross_origin`, `_read_small_body`,
  `_share_payload`, `_valid_days`, `_is_owner`, `_share_item_prefix`,
  `_share_url`, `_short_share_id`). Module docstring updated to four
  responsibilities.
- **`gate/tests/conftest.py`.** Owner/non-owner members, `other_member_session`,
  `shares` fixture, and share-layout objects in `PRIVATE_OBJECTS`.
- **`gate/tests/test_shares.py` (new).** 106 cases (30 functions × parametrize
  and the two-transport fixture) covering contract §8.
- **`gate/tests/test_scope.py`.** Route-table assertion updated to the Phase 4
  table; the Phase 3 "shares must not exist" assertions removed (they now
  contradict the phase).
- **`gate/README.md`.** Route table, a Sharing section, the caching note and the
  two new environment variables.

No `site/**`, `firebase.json`, `infra/**`, `.github/**` or `llm/**` (other than
this handoff) was touched.

## Routes added

| Route | Auth | Behaviour |
|---|---|---|
| `POST /share` | owner, origin | `{source, slug, expires_in_days}` → `{token, expires_at, url}`; 400 bad input, 403 non-owner/unauthenticated, 413 oversized body. Mints for any well-formed item (the gate cannot enumerate) and lets serving 404 |
| `GET /share` | owner | Active shares only. Returns `id` (first 12 chars), `source`, `slug`, `created_by`, `expires_at`; never the full token |
| `DELETE /share/{token}` | owner, origin | Sets `revoked: true`; idempotent (unknown token still 200) |
| `GET /s/{token}/{path:path}` | none | Serves the token's one item inside its prefix; unknown/expired/revoked/corrupt all 404 with the generic body; never reads a cookie and never sets one |

`GET /s/{token}/` (empty path) serves the item's `index.html` entry document.

## Test transcript

```
$ cd gate && .venv/bin/pytest
396 passed, 2 warnings in 2.45s

$ .venv/bin/pytest tests/test_shares.py --collect-only -q
106 tests collected

$ .venv/bin/ruff check .
All checks passed!

$ .venv/bin/ruff format --check .
20 files already formatted
```

Contract §8 coverage in `tests/test_shares.py`:

- mint/verify and serving the item signed-out; directory → `index.html`;
  subpath `Content-Type`;
- non-owner member 403 (mint, list, revoke); anonymous 403; non-owner cannot
  revoke another's live grant;
- cross-origin mint/revoke 403; unset-allowlist mint/revoke 403;
- unknown, expired and revoked tokens 404; revoked-minted share 404; revoke
  idempotent;
- traversal (`%2e%2e%2f`, `..%2f`, `%2f`, `%5c`, `%00`, nested) 404 with **zero
  bucket lookups**; raw spellings refused by `safe_object_path(path, prefix)`; a
  second item is unreachable; a valid `/p/` object outside the prefix 404s and
  the fetch is proven to have the prefix applied;
- token entropy (5 unique tokens, ≥ 32 chars, URL-safe); 30-day cap accepted;
  16 bad-input cases are 400; malformed body not echoed;
- every `/s/**` and `/share/**` outcome `private, no-store` and never
  `public`/`s-maxage` (served, unknown, expired, traversal, missing, mint,
  mint-refused, list, list-refused, revoke, revoke-refused);
- list hides the full token and omits expired/revoked rows;
- `/s/**` sets no cookie, with or without a member session presented.

The suite uses only in-memory doubles (`StaticShareStore`, `StaticMemberDirectory`,
`FakeStore`, `FakeVerifier`); no Firestore, no credentials.

## Open questions

1. **SEAM-S1 omits the item's `section`, so the item prefix cannot address the
   real private build.** Evidence: `frame-content.mjs: routeFor()` is
   `<section>/<source>/<slug>/` (e.g. `phd/phd-milestones/committee-dossier/`),
   and `site/dist-private/` contains exactly that path, while the share stores
   only `{source, slug}` and the gate has `storage.objects.get` only (no `list`,
   so it cannot discover the section). This stream resolves
   `<source>/<slug>` — the binding schema — and all tests are internally
   consistent, but live acceptance (SEAM-S7) will 404 until one of these is
   true: (a) the stored row/schema gains `section` (or a resolved object
   `prefix`), or (b) the private build flattens item folders to
   `<source>/<slug>/`. I did not change the binding schema. **Needs a Lead
   Architect ruling before Checkpoint 5.**
2. **Listing hides the token but revoke takes it.** `GET /share` returns only a
   12-char `id` (contract requirement 3), while `DELETE /share/{token}` needs
   the full token. The Shares page must therefore retain the token from the mint
   response to revoke that share, or the API needs a revoke-by-`id` route. Not
   resolved here; the contract names both behaviours.
3. **`id` is a token prefix.** The 12-char display id is real token material.
   It is not the credential (43 chars total), but if the owner UI is ever
   rendered where an attacker can read it, it narrows the search. Alternative:
   a keyed hash. Flagged rather than changed, because the contract says "short
   id".
4. **IAM.** `FirestoreShareStore` writes; the runtime SA currently holds
   `datastore.viewer` only (SEAM-S5). Infra must widen to a write role on
   `shares/` — `roles/datastore.user` at project scope is the pragmatic grant,
   and SEAM-S5 asks infra to record the choice.
5. **Hosting rewrites.** `firebase.json` still lacks `/share/**` and `/s/**`
   (SEAM-S4; the site stream owns it). Without them the routes answer only on
   `*.run.app`.
6. **Token collision on overwrite.** `create()` uses Firestore `set`, so a
   (2⁻²⁵⁶) token collision would replace an existing share. Not defended beyond
   token size.

## ADR candidates

- **The item identity is `(source, slug)` but its object prefix is not.** The
  seam and the build disagree about what a share addresses; whichever fix is
  chosen (store `section`/`prefix`, or flatten the private layout) is a decision
  worth recording, because it crosses the gate, site and infra streams.
- **Owner = member document with `role: owner`, re-checked per request.** This
  is the first place the role field has operational meaning; the "membership is
  existence, role is authority" split could be stated once.
- **A share list that must not reveal the credential.** The display-id/revoke
  tension above is the general problem of an owner UI over an unguessable
  secret: either the UI keeps the token from the mint, or the API grows a
  revoke-by-display-id route whose authorisation is the owner session, not the
  secret. Decide before the Shares page ships.
- **`private, no-store` for `/s/**`.** A public share link deliberately does not
  cache; that is counter-intuitive enough to be a decision, not a default.

## Related docs

- `llm/sprints/2026-09-hub/contracts/phase-4-seams.md` (SEAM-S1..S8)
- `llm/sprints/2026-09-hub/contracts/gate-wave-3.md`
- `llm/specs/2026-09-10-research-hub-design.md` §6 responsibility 4, §7, §11
- `llm/master-roadmap.md` §phase-4-sharing (A7's `/s/**` half)
- `site/src/lib/frame-content.mjs` (`routeFor`, `payloadUrlFor`)
- `gate/app/shares.py`, `gate/app/main.py`, `gate/tests/test_shares.py`
