# Active Context

Status: Draft
Last updated: 2026-09-16
Owner: Chief Architect

What belongs here: the current focus, the current stop point, and next steps —
what a contributor needs to pick up work today.

## Current position

- Sprint `2026-09-hub`: **Phase 2 — Publishing contract is in progress** (issue #16, draft
  PR #17, branch `feat/publishing-contract`, owner's go 2026-09-16).
- Phase 1 — Foundation is complete. PR #12 merged 2026-09-15; Checkpoint 2 verified live the
  same day. The Email and Privacy pages merged (PR #15) and are live at `/email/` and
  `/privacy/`.
- The hub is live at **https://jason.cusati.us** on Firebase Hosting, deployed from `main`
  through Workload Identity Federation; `https://research.cusati.us` 301-redirects to it
  (paths preserved). GitHub Pages still serves until Phase 6.
- **Stop point:** Checkpoint 3. Agents do not merge; the owner applies Terraform, sets the
  new Actions variables, merges the hub PR and then the `cv` PR.
- Orchestration state: `llm/sprints/2026-09-hub/STATE.md`.

## Decisions on record

- Q1 — domain `cusati.us`, **amended by ADR-0006:** the hub is at `jason.cusati.us`
  (canonical); `research.cusati.us` redirects to it; `cusati.us` and `www` are reserved
  for a family site.
- Q2 — GCP project `cusati-hub` (number 410552878319) on the owner's personal account,
  created 2026-09-15, billing linked (Blaze).
- Q5 — the Astro app moves under `site/`: proposed in ADR-0001, approved by
  merging PR #9.
- ADRs 0001–0008: `llm/governance/adr/`. ADR-0007 settles how a publish reaches the hub —
  the hub polls the content bucket and no satellite holds a GitHub credential for `website`,
  closing the contradiction ADR-0002 left open. ADR-0008 adds the `data` format and corrects
  design doc §2: `cv` is public, default branch `master`.
- Roadmap: `llm/master-roadmap.md`.

## Open

- Design doc §10 Q3, Q4, Q6.
- **ADR-0008 needs the owner's eye at Checkpoint 3.** It amends design doc §4 to add a `data`
  format, knowingly weakening §3's "the hub never needs to know how a satellite built its
  output" for that one format, because the CV is data the hub renders rather than a document
  `cv` renders. The alternative preserving §3 completely is costed in the ADR.
- Design doc §10 Q3, Q4, Q6.
- Brief / design-doc / canon conflicts K1–K12 (`STATE.md`). K13 is closed by ADR-0007.
- Brief / design-doc / canon conflicts K1–K13 (`STATE.md`).

## Governance adoption

- 2026-09-14: adopted agentic-governance **v0.8** (canon `VERSION` 0.8.3) via
  `/governance:establish` — issue #7, branch `gov/establish-hub`.
- Governance delta: `llm/governance/governance-delta.md`. Steward merge
  authority: INACTIVE.
