# Contract — `gate`, Wave 6 notes-sync (D18)

Status: Issued
Date: 2026-10-07
Owner: Lead Architect
Stream: `gate` (`gate/**`, `.github/workflows/gate.yml`)
Issue: #107
Branch: `feat/annotations-sync`
Seams: `contracts/wave-6-notes-sync-seams.md`
Design: ADR-0022 (amended, Accepted)

## Purpose

Make the gate commit annotations to a long-lived `notes` branch in each
destination repository, on save, debounced and retried — no owner-triggered
workflow, no GitHub Actions secret, no credential in the browser.

## Scope

- `gate/app/notes_sync.py` (new), `gate/app/annotations.py` (soft delete),
  `gate/app/main.py` (enqueue + drain kick + export state in the list),
  `gate/app/config.py`, `gate/tests/**`, `gate/README.md`
- `.github/workflows/gate.yml` only if a test needs it

Do NOT touch `site/**` or `infra/**`.

## Requirements

1. **Soft delete (AN-SYNC-1).** `DELETE /annotations/{id}` marks the row
   `deleted: true, deleted_at`; `GET`/`list_for` exclude deleted; the export
   renderer includes tombstones.
2. **Queue (AN-SYNC-2).** Firestore `notes_export/{sha256(section/source/slug)}`
   with the seam's fields. `enqueue`, `due`, `success`, `retry`, `dead_letter`.
   Backoff `min(60*2**(n-1), 3600)`; dead-letter at ≥24h; jobs are never deleted
   while dead-lettered.
3. **Renderer.** Pure `render_item_markdown(entries, item, routing)` → the file
   text: entries chronological, each with intent/quote/comment/deep link/
   qualified id/member/timestamp; tombstones; Markdown/HTML escaping identical in
   spirit to `site/scripts/export-notes.mjs`. Unit-tested without a network.
4. **GitHub App client (AN-SYNC-4).** A `GitHubAppClient` Protocol plus a real
   client (lazy `jwt`/`requests`) and a static fake. RS256 App JWT (`iss`,
   `iat`, `exp` ≤10 min) → installation token (≤1h); branch create; file
   get/put. Secret Manager read via REST + ADC (`google.auth` + `requests`).
   **No new dependency.**
5. **Orchestrator.** `NotesSync.drain(now)` claims due jobs (one at a time;
   idempotent), groups an item's annotations by destination repo, skips if the
   regenerated content equals the existing file (no commit), creates `notes`
   from the default branch once, and on error schedules a retry / dead-letter.
6. **Wiring.** Enqueue on create and delete after the Firestore write; kick a
   drain (non-blocking) on each request; a startup background loop drains while
   warm. **Disabled unless `GATE_NOTES_EXPORT_ENABLED` and the App id /
   installation id are configured** — a dormant gate behaves exactly as before.
7. **Visibility (AN-SYNC-5).** `GET /annotations` includes per-item
   `export: {state, error?}` from the queue, for My notes.
8. **Security (AN-SYNC-6).** No token/key in logs or bodies; path and commit
   message from validated identity only; caps on content sizes.
9. **Tests (pytest).** Debounce/coalesce; backoff sequence; dead-letter at 24h;
   branch creation once from default; append + tombstone; no-op on unchanged
   content; routing per intent incl. mixed; disabled mode; token/key never in
   logs; path/message injection refused; oversized content refused; cross-member
   cannot affect another's export beyond their own note.

## Evidence

`cd gate && .venv/bin/python -m pytest -q` green with the new tests; ruff clean.

## Exit

`handoffs/gate-wave-6-notes-sync.md`. No credential and no apply in this stream.
