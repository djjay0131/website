# Progress

Status: Draft
Last updated: 2026-09-14
Owner: Chief Architect

What belongs here: what works, what is left, and known issues — recorded against
merged reality, not plans.

## What works

- The current site builds and deploys to GitHub Pages (`build.yml`).
- `main` is branch-protected (PR required); the `governance-checks` CI job runs
  on every PR.

## Pending merge (PR #9)

- Governance adoption (agentic-governance v0.8), ADRs 0001–0005, the master
  roadmap. Roadmap checkboxes flip only after merge.

## What is left

- Phases 1–6 of `llm/master-roadmap.md`.

## Known issues

- ADR-0002's dispatch step contradicts its own no-write-access decision; a
  follow-up ADR must settle it before Phase 2.
- Brief and design-doc conflicts K1–K13 (`llm/sprints/2026-09-hub/STATE.md`).

## Governance adoption

- 2026-09-14: adopted agentic-governance v0.8 — issue #7. Delta:
  `llm/governance/governance-delta.md`.
