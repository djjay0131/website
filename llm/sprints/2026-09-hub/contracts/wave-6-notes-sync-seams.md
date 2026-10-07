# Wave 6 notes-sync seams — the gate commits annotations to a `notes` branch

Status: Active
Issued: 2026-10-07
Owner: Lead Architect
Issue: #107
Branch: `feat/annotations-sync`
Owner decision: **D18 (2026-10-07)** — Option A GitHub App; the gate commits on
save; owner-triggered workflow rejected.

Design authority: **ADR-0022 (amended, Accepted)**. A specialist who believes a
seam is wrong reports it and stops.

---

## AN-SYNC-1 — Trigger and debounce

- On a successful `POST /annotations` and on `DELETE /annotations/{id}`, **after
  the Firestore write succeeds**, enqueue an export job for the item.
- A job's `not_before` is `now + debounce` (default **45s**, configurable
  `GATE_NOTES_EXPORT_DEBOUNCE_SECONDS` inside 30–60). Repeated writes to the same
  item within the window **coalesce**: one job per item, `not_before` refreshed,
  and the file is regenerated from Firestore at drain time (so no note content is
  carried in the job).
- A delete is a **soft delete**: the annotation row gains `deleted: true` and
  `deleted_at`, `GET /annotations` excludes it, and the renderer emits a
  **tombstone** line. A deleted annotation is never hard-removed.

## AN-SYNC-2 — Queue (Firestore `notes_export/{job}`)

`job` is `sha256(section + "/" + source + "/" + slug)` (a stable, safe document
id). Fields:

```
{ section, source, slug, not_before: Timestamp, attempts: int,
  next_attempt: Timestamp, last_error: string|null,
  dead_lettered: bool, dead_lettered_at: Timestamp|null,
  updated_at: Timestamp }
```

- `due(now)` returns jobs with `dead_lettered == false` and `next_attempt <= now`.
- On success: delete the job (its work is now in the repo).
- On failure: `attempts += 1`, `next_attempt = now + backoff(attempts)`,
  `last_error = <short, sanitized reason>`. When `now - first_attempt >= 24h`
  (or `attempts` exceeds the cap), set `dead_lettered = true` — **never delete
  the job**, so the failure stays visible.
- `backoff(n)` = `min(60 * 2**(n-1), 3600)` seconds, deterministic and unit-tested.

## AN-SYNC-3 — The `notes` branch and layout

- Target branch **`notes`**, never `main`. If it does not exist, create it once
  from the repository default branch's HEAD.
- File path **`notes/<source>/<slug>.md`**; one file per annotated item.
- **Append-only in effect:** the file is regenerated from Firestore each time, so
  it always reflects the current non-`question` entries in chronological order,
  with tombstones for deleted entries. A regeneration that equals the existing
  content performs **no commit** (idempotent).
- Entries carry: intent, quote, comment, deep link, qualified id, member,
  timestamp; a tombstone carries the original fields it still has plus a
  `_(deleted <timestamp>)_` line.
- An item with mixed non-`question` intents writes one file per destination repo
  it touches.

## AN-SYNC-4 — GitHub App client and credential

- `GitHubAppClient` (Protocol, fake-able): `installation_token()`,
  `default_branch(repo)`, `head_sha(repo, ref)`, `create_branch(repo, branch,
  sha)`, `get_file(repo, path, ref) -> (content, sha)|None`,
  `put_file(repo, path, ref, content, message, sha)`.
- Production client mints an RS256 App JWT (iss=App id, iat, exp ≤10 min) with
  `pyjwt`, exchanges it at `POST /app/installations/{id}/access_tokens` for a
  **≤1h installation token**, and uses `requests`. It is lazy-imported so tests
  run with no network and no key.
- The App private key is read from **Secret Manager** `notes-export-app-key`
  (project from `GOOGLE_CLOUD_PROJECT`) via the REST API using ADC
  (`google.auth` + `requests`) — **no new dependency**.
- Configuration: `GATE_NOTES_APP_ID`, `GATE_NOTES_INSTALLATION_ID`,
  `GATE_NOTES_SECRET_NAME` (default `notes-export-app-key`),
  `GATE_NOTES_EXPORT_ENABLED` (default off). **Unconfigured ⇒ the whole subsystem
  is dormant: enqueue is a no-op and the routes behave exactly as before.**

## AN-SYNC-5 — Backoff / dead-letter / visibility

- ≥24h of retries with exponential backoff (AN-SYNC-2).
- Dead-letter is a Firestore flag. **My notes must show it:** `GET /annotations`
  includes, per item, `export: {state: "pending"|"dead_letter", error?}` derived
  from the queue. No token, key or repo content is ever in that field.

## AN-SYNC-6 — Security

- Token/key never logged and never in a response body.
- Commit message and path are built from the validated
  `section/source/slug` only; **note content never reaches either**.
- Content rendered exactly as the site renderer (HTML + Markdown link/image/code
  escaping; user lines blockquoted).
- A drain failure logs a status class, never a credential or a private passage.

## AN-SYNC-7 — Adversarial targets

1. A member causing a write to a repository they should not reach (routing is
   fixed server-side; the member controls only note content and item identity).
2. Token exfiltration via an error message or a log line.
3. Commit-message or path injection from note content.
4. Oversized or binary payloads (caps; non-text rejected).
5. A retry storm / unbounded queue growth; duplicate commits; a commit to `main`.

## AN-SYNC-8 — Owner hard stops

1. Create the GitHub App, install on exactly the two repos (Contents: write),
   report App id + installation id.
2. `gcloud secrets create notes-export-app-key` + add version (exact command
   printed in the handoff/PR).

Terraform for the Secret Manager accessor binding and the gate route config
follows; plan must be adds only.
