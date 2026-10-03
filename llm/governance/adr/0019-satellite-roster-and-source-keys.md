# ADR-0019: Satellite roster and source keys — kgis #3, agentic-kg-research #4, construction-ai #5

Status: Accepted
Date: 2026-10-03

## Context

Design doc §2 (the repo table) and §11 (the phase table) named `agentic-kg` as
satellite #3 and `construction-ai-proposal` as satellite #4. Owner decisions
D4/D10 changed the order: `agentic-kgis` substituted for `agentic-kg` as
satellite #3 (its website content already existed), and `agentic-kg-research` was
added as satellite #4 (private, for the team). Wave 4 adds
`construction-ai-proposal` as the fifth. The design doc was never amended to
match, and no ADR recorded the roster change — so a reader of the design authority
would get the wrong order and not know `agentic-kg-research` exists.

A second question surfaced in Wave 4: the **source key** (the name a satellite
publishes under, the bucket prefix `sources/<key>/`, and the WIF provider/SA
stem) is independent of the repository name. The `infra` roster validates
`length(source) <= 22`, because the service-account id is `publish-<key>` and a
GCP service-account id is at most 30 characters. `construction-ai-proposal` is
24, so `publish-construction-ai-proposal` would be 32 and invalid.

## Decision

1. **The roster is:** `cv` #1, `phd-milestones` #2, `agentic-kgis` (source
   `kgis`) #3, `agentic-kg-research` #4, `construction-ai-proposal` (source
   `construction-ai`) #5. `agentic-kg` is later/optional. Design doc §2 and §11
   are amended to this.
2. **The source key is independent of the repository name** and is chosen to
   satisfy the platform's length limits, exactly as `kgis` already is. The Wave 4
   key is `construction-ai`; the repo stays `djjay0131/construction-ai-proposal`.
   Each satellite's key is the single name used for its manifest `source`, its
   bucket prefix, its WIF provider (`github-<key>`) and its SA
   (`publish-<key>`).
3. **Visibility is a property of the items, not the satellite.** A satellite may
   be a public GitHub repository while publishing private hub items
   (`construction-ai`), or private while publishing at least one private item
   (`agentic-kg-research`). The hub's private boundary governs **serving**, not
   the secrecy of content already public in the satellite's own repository;
   D8/ADR-0016 must not be read as concealing a PDF that is public on GitHub.

## Rationale

The design doc is the design authority; leaving the roster stale is the same
class of error ADR-0016 and ADR-0008 each corrected. Recording the key-naming rule
stops the next satellite from rediscovering the 30-character SA limit by a failed
plan.

## Alternatives Considered

- **Keep the repo name as the key and shorten the SA stem another way.**
  Rejected: no truncation fallback exists, and a divergent SA stem would break the
  one-name invariant the roster relies on.
- **Name the key `construction-ai-proposal` and relax the 22-char validation.**
  Rejected: the limit is the platform's, not ours.

## Consequences

### Positive

- Design doc §2/§11 match the live roster; the key rule is explicit.
- The secrecy-vs-serving distinction is stated so D8 is not over-claimed.

### Negative / Tradeoffs

- A reader must know that a source key may differ from the repository name.
  Mitigated by the `infra` roster comments and `docs/satellites.md`.

### Risks

- `construction-ai`'s items are `visibility: private` but the PDF is public on
  GitHub. This is recorded, not hidden; the hub's private boundary is about
  serving, not secrecy.

## Impacted Areas

- [ ] Product
- [x] Domain model
- [ ] Data architecture
- [ ] AI architecture
- [ ] Domain-specific systems (see governance delta)
- [x] Integrations
- [ ] UX
- [x] Security/privacy
- [x] Implementation
- [x] Documentation

## Related Documents

- `llm/specs/2026-09-10-research-hub-design.md` §2, §11 — amended here
- `llm/governance/adr/0016-private-by-default-publish-allowlist.md`
- `llm/sprints/2026-09-hub/contracts/phase-5-seams.md` — SEAM-C1..C6
- `infra/satellites.tf`, `infra/variables.tf`

## Related Issues / PRs

- `hub-005` — Wave 4, Phase 5 satellites

## Supersedes

None.

## Superseded By

None.
