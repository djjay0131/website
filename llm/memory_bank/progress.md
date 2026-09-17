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
- Governance adopted (agentic-governance v0.9, canon `VERSION` 0.9.0); `main` requires `governance-checks` and
  `budget-guard` (since 2026-09-15).
- ADRs 0001–0011 Accepted; master roadmap in force.
- **The CV is published through the contract.** `cv` pushes to its own `master`, its publish
  job uploads to `gs://cusati-hub-content/sources/cv/` over Workload Identity Federation
  holding no GitHub credential for this repository, and the hub polls that bucket, builds and
  deploys. Live: `build-info.json` reports `content_source: bucket`.
- The Phase 2 cloud foundation is **applied and verified live**: content bucket
  `cusati-hub-content` with uniform bucket-level access, public access prevention enforced,
  versioning and 7-day soft delete; a `satellitePublisher` custom role holding exactly
  `storage.objects.create`, `.delete` and `.get`; a `satellites` Workload Identity pool
  separate from the hub's; and `cv`'s keyless publishing identity. The prefix boundary is
  **proven, not assumed** — the satellite could create, overwrite, read and delete inside
  `sources/cv/` and was refused every write outside it and every list, including of its own
  prefix (`STATE.md` §Checkpoint 3).
- `/email/` and `/privacy/` are live, in the owner's supplied wording (PR #15).

## In review

- **PR #25** — Phase 3, the private area (issue #24, branch `feat/private-area`). All four
  streams landed: `gate/` (the FastAPI Cloud Run gate), `infra/` (private bucket, gate
  identity, Cloud Run, Artifact Registry, Identity Platform, Firestore), `site/` (the
  two-output build, the leak check, the sign-in page, the destructive private sync) and the
  `phd-milestones` satellite. Chief Reviewer verdict: **Request changes** — two documentary
  findings (B-1, B-2), both since fixed; nothing in Parts A–C blocking. Governance audit:
  **DRIFTING**, no blocking finding.
- Nothing in Phase 3 has touched a cloud resource. Every live verification is Checkpoint 4.

## What is left

- **Checkpoint 4**: the first `terraform apply` for Phase 3, the gate's first deploy, the
  `firebase.json` rewrites (which cannot land before the Cloud Run service exists), the
  satellite's first publish, and the first real run of the private sync's bucket driver.
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

- 2026-09-14: adopted agentic-governance v0.9 (canon 0.9.0; pin moved by PR #22) — issue #7. Delta:
  `llm/governance/governance-delta.md`.
