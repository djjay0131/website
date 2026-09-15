# Active Context

Status: Draft
Last updated: 2026-09-15
Owner: Chief Architect

What belongs here: the current focus, the current stop point, and next steps —
what a contributor needs to pick up work today.

## Current position

- Sprint `2026-09-hub`, **Phase 1 — Foundation**, in progress: issue #10, branch
  `feat/foundation`.
- Phase 0 merged via PR #9 on 2026-09-15. The merge was executed by the Lead
  Architect on the owner's explicit instruction, recorded on PR #9.
- **Next stop point: Checkpoint 2.** The owner creates the GCP project, enables
  Blaze, runs `terraform apply`, adds DNS records and merges.
- Live orchestration state: `llm/sprints/2026-09-hub/STATE.md` (on the active
  sprint branch until it merges).

## Decisions on record

- Q1 — domain `cusati.us`, **amended by ADR-0006:** the hub is at `jason.cusati.us`
  (canonical); `research.cusati.us` redirects to it; `cusati.us` and `www` are reserved
  for a family site.
- Q2 — a new GCP project on the owner's personal account (intended id
  `cusati-hub`).
- Q5 — the Astro app moves under `site/`: proposed in ADR-0001, approved by
  merging PR #9.
- ADRs 0001–0006: `llm/governance/adr/`.
- Roadmap: `llm/master-roadmap.md`.

## Open

- Design doc §10 Q3, Q4, Q6.
- Brief / design-doc / canon conflicts K1–K13 (`STATE.md`): not ruled on
  individually; Phase 1 takes the conservative choice for each (issue #10).

## Governance adoption

- 2026-09-14: adopted agentic-governance **v0.8** (canon `VERSION` 0.8.3) via
  `/governance:establish` — issue #7, branch `gov/establish-hub`.
- Governance delta: `llm/governance/governance-delta.md`. Steward merge
  authority: INACTIVE.
