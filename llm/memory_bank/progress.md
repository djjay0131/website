# Progress

Status: Draft
Last updated: 2026-09-15
Owner: Chief Architect

What belongs here: what works, what is left, and known issues — recorded against
merged reality, not plans.

## What works

- **https://jason.cusati.us** serves the site from Firebase Hosting (project `cusati-hub`),
  deployed on every push to `main` through WIF; no service-account keys exist.
- `https://research.cusati.us` 301-redirects to it, preserving paths.
- GitHub Pages (`djjay0131.github.io/website/`) still serves the same build until Phase 6.
- Terraform in `infra/` declares every Phase 1 cloud resource; the owner's $5 budget alert
  is live and guarded in CI.
- Governance adopted (agentic-governance v0.8); `main` requires `governance-checks`.
- ADRs 0001–0006 Accepted; master roadmap in force.

## Pending merge

None.

## What is left

- Phases 2–6 of `llm/master-roadmap.md`, starting with Phase 2 on the owner's go.
- Email and Privacy pages at `/email/` and `/privacy/` (#13), in progress.

## Known issues

- ADR-0002's dispatch step contradicts its own no-write-access decision; a follow-up ADR
  must settle it before Phase 2.
- Brief and design-doc conflicts K1–K13 (`llm/sprints/2026-09-hub/STATE.md`).
- Redirect-domain duplicate validation ignores case and trailing dots (STATE C17).

## Governance adoption

- 2026-09-14: adopted agentic-governance v0.8 — issue #7. Delta:
  `llm/governance/governance-delta.md`.
