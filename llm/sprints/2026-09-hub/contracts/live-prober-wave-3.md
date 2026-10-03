# Contract — Live Prober, Wave 3 (Phase 4 sharing)

Status: Issued
Date: 2026-10-03
Owner: Lead Architect
Stream: Live Prober (read + write to `llm/sprints/2026-09-hub/handoffs/live-prober-wave-3.md` only)
Issue: `hub-004`

## Purpose

Verify Wave 3 against production **after it deploys**, through Hosting
(`https://jason.cusati.us`) and at `*.run.app`, by GET only. Serialise live
probes with other agents; filter logs by your own paths and timestamps.

## Checks

1. `/share` signed-out GET → gate refusal (403 or 404; record which) with
   `private, no-store`; must NOT be the static site's 404. Attribute by a
   matching container log line, not by body size (body size is path-dependent).
2. `/s/unknown-token/` → 404, `private, no-store`, uniform body, no cookie.
3. `/s/{token}/{traversal}` for `..`, `%2e%2e`, absolute → 404, on both
   transports; beat the `curl` client-side normalisation with `--path-as-is`.
4. `/p/` signed-out still 404; `/p/` signed-in unaffected (if a member session is
   unavailable, say NOT TESTED).
5. `firebase.json` rewrites live: `/share/**` and `/s/**` reach the gate, not the
   static host.
6. `build-info.json` reports the merged SHA and `content_source: bucket`.
7. The owner's mint/open/revoke (SEAM-S7) is **owner-only** and is NOT yours to
   run; record it PENDING and say so.

## Report

Table: probe, origin, HTTP status, key headers, the container log line that
attributes it, verdict. State every probe that could not run and why.
