# ADR-0002: Satellites publish to a content bucket and notify the hub by dispatch

Status: Accepted
Date: 2026-09-14

## Context

Content is authored in many repositories and formats (design doc §1, §2); the
hub renders it and must never need to know how a satellite built its output
(§3). Satellites are untrusted (§12.3), private content must never enter a
repository that could become public (§3, §12.1), and no long-lived cloud keys
are allowed (§12.2).

Today `website` pulls `cv` itself: it downloads `cv`'s latest release at build
time and polls hourly to notice new releases.

## Decision

A satellite publishes a finished `dist/` plus a `manifest.json`; that is the
entire interface (§4).

1. A reusable composite action published from the hub
   (`contract/publish/action.yml`) validates the manifest against
   `contract/manifest.schema.json`, uploads to
   `gs://<content-bucket>/sources/<source>/` using Workload Identity
   Federation, and fires `repository_dispatch` (`event_type: publish`) at the
   hub.
2. Each satellite has its own service account, scoped by IAM conditions to its
   own bucket prefix. No satellite has write access to the hub repository.
3. The hub build syncs the bucket, then builds. The manifest schema is mirrored
   field for field as the Astro content-collection schema, and both ends
   validate against it.
4. `section` and `format` are fixed sets declared in the hub (§4).

## Rationale

It is the only option of the three in which a satellite's blast radius ends at
its own prefix, private bytes never touch git, and no credential outlives a
workflow run. It also replaces hourly polling with an event.

## Alternatives Considered

### Satellites commit into the hub

Satellites push or open PRs with built output into `website`. This gives
satellites write access to hub code (violates §12.3), sends private content
through a repository that could become public (violates §3 and §12.1), and
fills hub history with build artifacts.

### The hub pulls satellites at build

The current `cv` pattern, generalized. The hub needs read credentials for
every satellite including private ones — per-repo deploy keys or a long-lived
token (in tension with §12.2) — and must know each satellite's build and
release shape (violates §3). Rebuilds still need polling.

## Consequences

### Positive

- Satellites deploy independently and in any format the hub supports.
- Private items move bucket → build → private bucket and never enter git.
- One versioned interface, validated at both ends.

### Negative / Tradeoffs

- Infrastructure per satellite: a WIF provider entry, a service account and a
  prefix IAM condition.
- `cv` must migrate from release download to the contract (Phase 2), and its
  public URLs must be preserved or redirected.
- The content bucket becomes the store of published content. Rebuilding from
  the repository (§12.5) recreates the system but not the content: each
  satellite must republish. Bucket versioning mitigates loss, not recreation.

### Risks

- **The dispatch credential is unspecified.** `repository_dispatch` is a GitHub
  API call and needs a GitHub-side credential; a GCP service account cannot
  hold GitHub permissions, although the brief assigns "dispatch permission" to
  satellite service accounts. A fine-grained personal access token stored in
  each satellite would be a long-lived credential (domain review question 2).
  A GitHub App installation token, or the publish action's own token scoped
  to dispatch only, avoids that. It must be decided before Phase 2
  implementation — ADR candidate.
- A malformed or malicious manifest. Mitigation: validation in the action and
  again in the hub build; `slug` is unique within `source`; `path` is relative
  to `dist/` and must not escape it.

## Impacted Areas

- [ ] Product
- [ ] Domain model
- [x] Data architecture
- [ ] AI architecture
- [ ] Domain-specific systems (see governance delta)
- [x] Integrations
- [ ] UX
- [x] Security/privacy
- [x] Implementation
- [x] Documentation

## Related Documents

- `llm/specs/2026-09-10-research-hub-design.md` §2, §3, §4, §8, §12.1–§12.3, §12.5

## Related Issues / PRs

- #7 — hub-000: Adopt agentic-governance and record hub design

## Supersedes

None.

## Superseded By

None.
