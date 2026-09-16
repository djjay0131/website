# Progress

Status: Draft
Last updated: 2026-09-16
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
- Governance adopted (agentic-governance v0.8); `main` requires `governance-checks` and
  `budget-guard` (since 2026-09-15).
- ADRs 0001–0008 Accepted; master roadmap in force.
- `/email/` and `/privacy/` are live, in the owner's supplied wording (PR #15).

## Pending merge

- **PR #17 (draft)** — Phase 2, publishing contract. ADR-0007, ADR-0008, design doc §2/§3/§4
  amendments and the sprint's bounded contracts are committed; the four implementation
  streams are in flight.

## What is left

- Phase 2 implementation: `contract/`, `infra/`, `site/` and the `cv` publish workflow,
  then Checkpoint 3.
- Phases 3–6 of `llm/master-roadmap.md`.

## Known issues

- ~~ADR-0002's dispatch step contradicts its own no-write-access decision~~ — **resolved
  2026-09-16 by ADR-0007** (the hub polls; no satellite holds a GitHub credential).
- A satellite identity must never hold `storage.objects.list`: that permission cannot be
  restricted to a prefix, so it would expose every other source's object names. Recorded in
  `STATE.md` §Constraints discovered because it binds Phase 3 as well.
- Brief and design-doc conflicts K1–K12 (`llm/sprints/2026-09-hub/STATE.md`); K13 closed.
- Redirect-domain duplicate validation ignores case and trailing dots (STATE C17).
- Incident A1 (`STATE.md`): the owner closed the action and declined the GitHub purge request;
  the residual exposure remains — the commit is still retrievable by SHA.

## Governance adoption

- 2026-09-14: adopted agentic-governance v0.8 — issue #7. Delta:
  `llm/governance/governance-delta.md`.
