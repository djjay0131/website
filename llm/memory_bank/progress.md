# Progress

Status: Draft
Last updated: 2026-09-15
Owner: Chief Architect

What belongs here: what works, what is left, and known issues — recorded against
merged reality, not plans.

## What works

- The current site builds and deploys to GitHub Pages (`build.yml`).
- Governance adopted (agentic-governance v0.8): PR #9, merged 2026-09-15.
- `main` is branch-protected: PR required, and `governance-checks` is a required
  status check (since 2026-09-15).
- ADRs 0001–0005 Accepted; master roadmap in force.

## Pending merge

None from Phase 0.

## What is left

- Phases 1–6 of `llm/master-roadmap.md`. Phase 1 is in progress (issue #10).

## Known issues

- ADR-0002's dispatch step contradicts its own no-write-access decision; a
  follow-up ADR must settle it before Phase 2.
- Brief and design-doc conflicts K1–K13 (`llm/sprints/2026-09-hub/STATE.md`).
- Incident A1 (`STATE.md`): a removal request for GitHub's cached views is an
  outstanding owner action.

## Governance adoption

- 2026-09-14: adopted agentic-governance v0.8 — issue #7. Delta:
  `llm/governance/governance-delta.md`.
