# Wave 3 seams — Phase 4 sharing

Status: Active
Issued: 2026-10-02
Owner: Lead Architect
Issue: `hub-004`
Branch: `feat/sharing`

Design authority: `llm/specs/2026-09-10-research-hub-design.md` §6 responsibility 4
and §11 Phase 4; owner decision D2 (§10 Q3 — share links are wanted). These seams
fix the interfaces before any stream starts; a specialist who believes a seam is
wrong reports it and stops.

## SEAM-S1 — What a share is

A share names **one item** by `(source, slug)` and grants read access to that
item's files for a bounded time. Firestore `shares/{token}`:

```
{ source: string, slug: string, exp: Timestamp, revoked: boolean,
  created_by: string, created_at: Timestamp }
```

- **Token**: `secrets.token_urlsafe(32)` (256 bits of entropy; the brief requires
  ≥128). The token is the Firestore document id.
- **exp** is server-side and is the authority; `expires_in_days` caps at 30.
- **One slug per token.** A token can never address a second item.
- The design doc §6 says `{slug}`; this seam adds `source` because the hub's items
  are keyed `(source, slug)` (Wave 0b) and two sources may share a slug. Recorded
  as an ADR candidate, not a schema change.

## SEAM-S2 — Routes

| Route | Auth | Behaviour |
|---|---|---|
| `POST /share` | owner only | body `{source, slug, expires_in_days}` → `{token, expires_at, url}`. 404 if the item is not effectively private; 400 on bad input; 403 for a non-owner. |
| `GET /share` | owner only | list active shares (`token` never returned in full; return a short id + metadata) |
| `DELETE /share/{token}` | owner only | set `revoked: true`; idempotent |
| `GET /s/{token}/{path:path}` | none | serve the token's item's file at `path`, only inside that item's prefix; expired/revoked/unknown → 404 |

The brief also names `GET /s/{token}/` (no path) → the item's entry document.

## SEAM-S3 — Origin and caching

- `POST /share` and `DELETE /share/**` are state-changing: enforce the existing
  allowed-origin check (same as `/session/end`).
- `GET /s/**` is opened in a fresh browser; it needs no session and no origin
  check, but it must not set cookies or accept credentials.
- **Every `/s/**` and `/share/**` response carries `Cache-Control: private,
  no-store`.** A7 closes here (roadmap Phase 3 criterion 7).

## SEAM-S4 — Hosting rewrites

`firebase.json` gains `/share/**` and `/s/**` rewrites to `hub-gate` (site owns
`firebase.json`). `/share/**` covers POST/GET/DELETE under the Hosting rewrite;
`/s/**` the public share view.

## SEAM-S5 — Firestore

- `shares/{token}` is server-only: the released rules stay deny-all, so the Web
  SDK cannot read `shares/` (the existing security-gate line).
- The gate's runtime SA needs read/write on `shares/` only; it must not gain
  broader Firestore rights (it currently holds `datastore.viewer`; a share store
  needs a write role — infra/gate owner decides and records it).

## SEAM-S6 — The Shares page

A React island (ADR-0003) **in the private build only**: lists active shares
(fetched from `GET /share`) and revokes one (`DELETE /share/{token}`). It is owner
UI; a non-owner member must not see the mint/revoke controls. `/p/**` already
carries the members' chrome.

## SEAM-S7 — Owner acceptance (live)

A real 14-day share minted by the owner identity via the API, opened signed-out in
a fresh browser, revoked, and re-tested (brief Wave 3 exit). The harness cannot
mint as the owner; the owner does this step.

## SEAM-S8 — Red Team targets

Token entropy; slug escape (`../`, encoded dots, a second slug); non-owner
mint/revoke; expired/revoked serving; `public`/`s-maxage` on any `/s/**` or
`/share/**` response; the Web SDK reading `shares/`.
