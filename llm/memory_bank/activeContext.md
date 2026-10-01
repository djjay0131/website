# Active Context

Status: Active
Last updated: 2026-10-01
Owner: Chief Architect

What belongs here: the current focus, the current stop point, and next steps —
what a contributor needs to pick up work today.

## Current position

- **Phases 0–3 are merged and deployed.** `main` is at `693da98`.
- **Wave 0 merged 2026-09-23** (#45, #48, #65, #53, #67, #47; close-out #68). Applied
  from `feat/infra-wave-0` at `63fc0d3` before merge, under owner decision D9. Sign-out
  is live; the gate runs on the narrowed `gateSessionMinter` role; `roles/editor` is
  empty project-wide.
- **A1 proven live 2026-09-23** (#69): the owner signed in, the gate minted a session
  under the narrowed role, and both private documents were served.
- **Emblem home page live** from #71 (2026-09-25).
- **Licensing declined the Virginia Tech marks** (owner, 2026-09-24). What it decided:
  no VT mark is served anywhere; the home page uses an original emblem; #60 (the VT
  logo files) is closed; #70 (badge concepts, which use the marks) stays a draft and
  unserved.
- **Satellites run #72 opened 2026-09-25** — satellite 3 `kgis`, then satellite 4
  `agentic-kg-research`. State as of 2026-10-01: the four `kgis` cloud resources are
  applied and committed on `feat/satellite-kgis`; the satellite's repository variables
  are set; the boundary proofs are being recorded; nothing has been published and the
  hub-side PR is not open.
- **Wave 0b (#46)**, private by default, is not started.

## Stop point

Satellites run #72, Wave 1 (`kgis`), before its first real publish: the prefix
boundary must be recorded in STATE first.

## Next

1. **#72 Wave 1** — record the `kgis` and `phd-milestones` boundary proofs, finish the
   site stream, switch `agentic-kgis` to publish on push, first publish, Live Prober,
   close-out.
2. **#72 Wave 2** — `agentic-kg-research` as a private item for the team.
3. **Wave 0b (#46).**

## What only the owner can do

- **Name the team for the private area** (D12, design doc §10 Q4 amended): who joins
  `djjay@vt.edu` and `cbrown@vt.edu` on the allowlist, keyed by the email each signs in
  with. Wave 2's onboarding step waits on it.
- **One non-member sign-in** closes A3 and the non-member half of A4. `djjay0131@gmail.com`
  is deliberately not a member, so signing in as it should get the "not shared with
  you" page.
- **The alert-channel verification link** — four policies are enabled and deliver
  nothing until it is clicked.

## Decisions on record

- Owner decisions D1–D9: `llm/sprints/2026-09-hub/STATE.md` §Decisions. D9 (apply before
  merge) broke the Wave 0 deadlock.
- Design doc §10: **Q1** domain — the hub is at `jason.cusati.us` (ADR-0006). **Q2** GCP
  project `cusati-hub` (410552878319). **Q3** share links wanted (D2). **Q4** members
  seeded, two: `djjay@vt.edu` (owner), `cbrown@vt.edu` (D3). **Q5** the app lives under
  `site/` (ADR-0001). **Q6** satellite order: `agentic-kgis` 3, `agentic-kg-research` 4
  (D10, owner, 2026-09-25, #72).
- ADRs 0001–0014, all Accepted: `llm/governance/adr/`. The most recent: ADR-0012
  (dev-staging in a separate project), ADR-0013 (the unauthenticated client-telemetry
  endpoint), ADR-0014 (satellites call the contract at a moving `v1` tag).
- Roadmap: `llm/master-roadmap.md`.

## Open

- Brief / design-doc / canon conflicts K1–K12 (`STATE.md`). K13 is closed by ADR-0007.

## Governance adoption

- 2026-09-14: adopted agentic-governance **v0.9** (canon `VERSION` 0.9.0; the pin moved
  from 0.8.3 by PR #22, and `.github/workflows/ci.yml` pins canon at `851a50a`) via
  `/governance:establish` — issue #7.
- Governance delta: `llm/governance/governance-delta.md`. Steward merge authority:
  INACTIVE.
