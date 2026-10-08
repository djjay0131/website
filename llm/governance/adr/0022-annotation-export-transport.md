# ADR-0022: Annotation export transport — the gate commits to a `notes` branch

Status: Proposed
Date: 2026-10-07 (amended 2026-10-07 on owner decision D18)

## Context

> **Status note (2026-10-07).** The `Status:` line stays `Proposed` in this
> change because the repository's `adr-status` check requires a status flip to be
> a status-line-only (L0) change, and this change amends the body (a semantic
> change). D18 has accepted this ADR; the `Proposed → Accepted` flip, with the
> index row, is a separate mechanical follow-up.

Issue #107 and ADR-0021 route notes by intent into two GitHub repositories —
`djjay0131/soa-agentic-se` (`paper`) and `djjay0131/agentic-kg-research`
(`experiment`, `brainstorm`) — as Markdown under `notes/`. `question` notes stay
in My notes and are not exported.

The first draft of this ADR proposed an owner-triggered GitHub Actions workflow
and left the credential open. **Owner decision D18 (2026-10-07) settles both:**
Option A (a GitHub App) is confirmed, the owner-triggered workflow is **rejected**,
and the transport is **the gate commits on save** — notes reach the repository in
(debounced) real time with no manual step.

## Decision

### 1. Credential — a GitHub App (Option A)

- The owner creates a GitHub App and installs it on **only**
  `djjay0131/soa-agentic-se` and `djjay0131/agentic-kg-research`.
- Repository permission: **Contents: Read and write only.** Pull-requests write
  is **not** needed: the gate commits to a branch, it does not open a PR, and the
  owner merges `notes` into `main` when he likes.
- The App private key is stored once in **Secret Manager** in `cusati-hub` as the
  secret **`notes-export-app-key`** (owner creates it; exact command in the
  handoff). The gate runtime service account `hub-gate` is granted
  `roles/secretmanager.secretAccessor` on that secret by Terraform.
- The gate mints a **short-lived (≤1 hour) installation token server-side** from
  the private key. **The browser never sees any GitHub credential, and no GitHub
  Actions secret is used.**

### 2. Transport — the gate commits on save, debounced and retried

- On a successful `POST /annotations` **and** `DELETE /annotations/{id}`,
  **after the Firestore write succeeds**, the gate enqueues a repository write
  for that item.
- A **debounce of 30–60 seconds** (configurable) coalesces rapid highlights on
  the same item into **one commit**.
- A **retry queue** with **exponential backoff** keeps retrying for **at least
  24 hours**. On exhaustion the job is **dead-lettered in Firestore** with a flag
  surfaced on **My notes**. **Firestore remains the source of truth**; the
  repository catches up after any GitHub outage.
- Firestore is the durable queue (`notes_export/{job}`), so retries survive a
  Cloud Run instance being recycled. A background worker drains due jobs while an
  instance is warm, and every gate request opportunistically kicks a drain.
  (Draining under genuinely zero traffic is a recorded limitation — see Risks.)

### 3. Target — a long-lived `notes` branch, never `main`

- Each destination repository gets a branch **`notes`**, created **once from the
  repository's default branch** if it does not exist. The gate **never commits to
  `main`**.
- Layout: **`notes/<source>/<slug>.md`** — **one file per annotated item**,
  entries appended in **chronological order**. Each entry carries the **intent,
  the quoted passage, the comment, the deep link, the qualified item id, the
  member and the timestamp**.
- A **delete removes the entry and records a tombstone line** in the file (the
  entry is emitted as a tombstone with its timestamp, never silently dropped).
- An item whose notes carry mixed non-`question` intents writes one file per
  destination it touches; `question` entries are never written to a repository.

### 4. Routing — unchanged

`site/notes-routing.json` is the authority: `paper → djjay0131/soa-agentic-se`,
`experiment` and `brainstorm → djjay0131/agentic-kg-research`, `question → null`
(My notes only). The gate reads the routing it is configured with (routing is
passed to the gate as JSON; the site file remains the single source, shipped to
the gate as configuration).

### 5. Owner hard stops (credential creation)

Two owner steps, and only two, gate the live enablement:

1. Create the GitHub App, install it on exactly the two repositories with
   **Contents: Read and write**, and report the **App id** and **installation
   id**.
2. Run `gcloud secrets create notes-export-app-key` (exact command in the
   handoff) and add the private key as a secret version.

Terraform for the Secret Manager accessor binding and the gate route config
follows those steps; the plan must be **adds only**.

### 6. Security

- The private key and installation token are read/held only server-side, never
  logged, and never returned to a client. Error messages surface a status, never
  a token or the key.
- The commit message and the file path are built from the **validated item
  identity only** (`section`/`source`/`slug`), never from note content, so
  neither can be injected.
- Note content is escaped for Markdown exactly as the local renderer does, so a
  quote or comment cannot inject links, images, code or block structure.

## Consequences

### Positive

- Notes reach the two repositories with no manual step, in near real time.
- The owner reviews and merges the `notes` branch on their own schedule.
- Short-lived, installation-scoped tokens; no long-lived token in Actions.

### Negative / Tradeoffs

- The gate now holds a write credential to two repositories (a new blast radius),
  bounded by the App installation and a one-hour token.
- The gate gains a background worker and a Firestore queue collection.
- A `notes` branch can drift from what the owner last merged; that is intended.

### Risks

- **Zero-traffic drain.** With `min-instances=0`, a pending retry is processed
  when the service is next exercised. Firestore holds the work, so nothing is
  lost; a Cloud Scheduler ping (or `min-instances=1`) is the follow-up if
  guaranteed drain under zero traffic is required. Recorded, not hidden.
- **A GitHub outage longer than the retry window** dead-letters the job; the
  flag on My notes makes it visible and the owner can re-trigger by editing.
- **A compromised gate image** could write to the two repositories' `notes`
  branches; contents are Markdown and the branch is never `main`.

## Impacted Areas

- [ ] Product
- [ ] Domain model
- [x] Data architecture
- [ ] AI architecture
- [ ] Domain-specific systems (see governance delta)
- [x] Integrations
- [x] UX
- [x] Security/privacy
- [x] Implementation
- [x] Documentation

## Related Documents

- `llm/governance/adr/0021-annotations-private-item-notes.md`
- `llm/sprints/2026-09-hub/contracts/wave-6-notes-sync-seams.md`
- `llm/sprints/2026-09-hub/contracts/gate-wave-6-notes-sync.md`
- `llm/sprints/2026-09-hub/contracts/infra-wave-6-notes-sync.md`
- `site/notes-routing.json`

## Related Issues / PRs

- #107 — annotate the literature
- Owner decision **D18** (2026-10-07)

## Supersedes

None. It amends the ADR-0022 first draft (Proposed → Accepted) on D18.

## Superseded By

None.
