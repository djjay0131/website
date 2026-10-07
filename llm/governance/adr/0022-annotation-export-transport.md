# ADR-0022: Annotation export transport (Proposed — owner decision required)

Status: Proposed
Date: 2026-10-07

> **HARD STOP (§9 of the completion brief).** No credential, secret, GitHub
> App, personal access token, or cross-repository IAM is created until the owner
> chooses the mechanism below. v1 ships annotation capture, the store, My notes
> and the credential-free export render (`POST /annotations/export`). The
> automated cross-repository pull request waits for this decision.

## Context

Issue #107 and ADR-0021 route notes by intent into two GitHub repositories —
`djjay0131/soa-agentic-se` (`paper`) and `djjay0131/agentic-kg-research`
(`experiment`, `brainstorm`) — as Markdown under `notes/`, delivered **as a PR,
never a push**. `question` notes stay in My notes and are not exported.

The exporter must be able to, on the owner's trigger:

1. read the owner's notes (or the owner's export render) from the site/gate;
2. create a branch and a commit in one of the two target repositories; and
3. open a pull request against that repository's default branch.

This is a write into two repositories the hub does not own, using a credential.
D17 makes the credential a hard stop: the mechanism must be approved before it
exists.

**A clarification on "WIF".** Workload Identity Federation authenticates a
GitHub Actions run *to Google Cloud*. It does not authenticate a Google Cloud
tool *to GitHub*, and it cannot grant GitHub repository write. The cross-repo
half therefore cannot be WIF; the realistic mechanisms are a GitHub App or a
fine-grained token, both of which are ordinary GitHub credentials. WIF remains
relevant only for the GCP side if the export were moved to Cloud Run, which this
ADR does not propose.

## Proposed decision (for the owner to accept or change)

**Recommended — Option A: a GitHub App owned by the owner.**

- The owner creates a GitHub App under their account and installs it on
  **only** `djjay0131/soa-agentic-se` and `djjay0131/agentic-kg-research`.
- Repository permissions: **Contents: Read and write** and **Pull requests:
  Read and write**. Nothing else (no Actions, no Issues, no administration).
- The app's private key is stored once as a repository secret in
  `djjay0131/website` (e.g. `NOTES_EXPORT_APP_KEY`), with the app id and
  installation id as variables.
- A GitHub Actions workflow in `website`, owner-triggered
  (`workflow_dispatch`), mints a **short-lived (≤1 hour) installation token**
  at run time, renders the notes via the gate export endpoint, pushes one branch
  per target repository and opens a PR. Tokens are never written to disk or
  logged.
- The installation is limited to the two repositories by GitHub, so a
  compromised workflow cannot reach any third repository.

**Alternative — Option B: a fine-grained personal access token.**

- A fine-grained PAT scoped to the two repositories only, with Contents: write
  and Pull requests: write, expiring (e.g. 90 days), stored as a `website`
  repository secret.
- Simpler to set up; the tradeoff is a longer-lived bearer credential tied to
  the owner's account, no per-installation scoping beyond the two repos, and a
  manual rotation calendar.

**Alternative — Option C: a dedicated `research-notes` satellite.**

- Notes are pushed to a new private repository the hub owns (a PR there), and
  the paper/experiment repos consume them by reference. Rejected unless the
  owner prefers it: it does not put the passage where the paper work can cite
  it directly, which is the point of issue #107.

## What the owner must decide

1. **Mechanism:** A (GitHub App — recommended), B (fine-grained PAT), or C
   (dedicated satellite).
2. If **A**: create the app, install it on the two repositories with exactly
   Contents + Pull requests write, and place the private key as a `website`
   repository secret (the Lead Architect will post the exact steps and names).
3. If **B**: mint the fine-grained PAT with the two repositories and the two
   permissions, and place it as a `website` repository secret.
4. Confirm the routing in `site/notes-routing.json` (`paper →
   soa-agentic-se/notes`; `experiment`, `brainstorm → agentic-kg-research/notes`;
   `question → My notes only`).

Until the decision, the export endpoint returns the rendered Markdown bundle so
the owner can copy it out by hand; no cross-repository write occurs.

## Consequences (once accepted)

### Positive

- Notes become citable material in the paper/experiment repositories with no
  manual copy step.
- Option A gives short-lived, installation-scoped credentials.

### Negative / Tradeoffs

- One more credential class exists, and it can write to two repositories. The
  scoping (app installation or fine-grained PAT) is the control.
- An export run is owner-triggered in v1, so notes are as fresh as the last run.

### Risks

- A leaked export credential could push to the two target repositories. Option A
  bounds this to those two repositories and a one-hour token; the PR-only rule
  means a bad export is reviewed, not merged silently.

## Impacted Areas

- [ ] Product
- [ ] Domain model
- [ ] Data architecture
- [ ] AI architecture
- [ ] Domain-specific systems (see governance delta)
- [x] Integrations
- [ ] UX
- [x] Security/privacy
- [ ] Implementation
- [x] Documentation

## Related Documents

- `llm/governance/adr/0021-annotations-private-item-notes.md`
- `llm/sprints/2026-09-hub/contracts/wave-6-annotations-seams.md` — AN-EXPORT
- `site/notes-routing.json`

## Related Issues / PRs

- #107 — annotate the literature
- Wave 6, annotations (owner decision D17)

## Supersedes

None.

## Superseded By

None.
