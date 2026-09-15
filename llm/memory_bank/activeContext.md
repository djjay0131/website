# Active Context

Status: Draft
Last updated: 2026-09-15
Owner: Chief Architect

What belongs here: the current focus, the current stop point, and next steps —
what a contributor needs to pick up work today.

## Current position

- Sprint `2026-09-hub`: **Phase 1 — Foundation is complete.** PR #12 merged 2026-09-15;
  Checkpoint 2 verified live the same day.
- The hub is live at **https://jason.cusati.us** on Firebase Hosting, deployed from `main`
  through Workload Identity Federation; `https://research.cusati.us` 301-redirects to it
  (paths preserved). GitHub Pages still serves until Phase 6.
- **Stop point:** no Phase 2 work, and no further page work beyond #13, without the owner's
  explicit go.
- Orchestration state: `llm/sprints/2026-09-hub/STATE.md`.

## Decisions on record

- Q1 — domain `cusati.us`, **amended by ADR-0006:** the hub is at `jason.cusati.us`
  (canonical); `research.cusati.us` redirects to it; `cusati.us` and `www` are reserved
  for a family site.
- Q2 — GCP project `cusati-hub` (number 410552878319) on the owner's personal account,
  created 2026-09-15, billing linked (Blaze).
- Q5 — the Astro app moves under `site/`: proposed in ADR-0001, approved by
  merging PR #9.
- ADRs 0001–0006: `llm/governance/adr/`.
- Roadmap: `llm/master-roadmap.md`.

## Open

- Design doc §10 Q3, Q4, Q6.
- Phase 2 publish notification decided: option A — the hub polls the content bucket;
  satellites hold no GitHub credential (owner, 2026-09-15). ADR to be written at Phase 2 start.
- Email and Privacy pages at `/email/` and `/privacy/` (#13): in progress, owner's wording as supplied.
- Brief / design-doc / canon conflicts K1–K13 (`STATE.md`).

## Governance adoption

- 2026-09-14: adopted agentic-governance **v0.8** (canon `VERSION` 0.8.3) via
  `/governance:establish` — issue #7, branch `gov/establish-hub`.
- Governance delta: `llm/governance/governance-delta.md`. Steward merge
  authority: INACTIVE.
