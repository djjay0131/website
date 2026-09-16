# Governance Delta: website (Research Hub)

Status: Draft
Last updated: 2026-09-15
Governance: agentic-governance v0.8

This file localizes the canonical governance in
[`agentic-governance`](https://github.com/djjay0131/agentic-governance) for
this project. Canonical docs defer to this file wherever project specifics
are needed. Keep it short — durable design content belongs in the
design-authority document and ADRs, not here. This file declares project
facts, never policy; changing it is semantic (L1) and it is permanently
deny-listed from the L0 fast track.

## Mission

A personal research site, owned outright by Jason (personal GitHub,
personal Google Cloud, personal domain), that publishes content produced
in many repositories and many formats into one site with a public face and
a gated private area. Private items can be shared with specific people. It
must outlive the PhD.

It is not: a CMS, a blog engine, an application, or a place where content
is authored. Content is authored in satellites; the hub renders it.

## Design-Authority Document

`llm/specs/2026-09-10-research-hub-design.md` — rank 2 of the design authority
hierarchy. The orchestration brief
(`llm/plans/2026-09-10-research-hub-orchestration-brief.md`) is an execution
plan beneath it: it sequences the work and does not re-decide the design.
Where the two disagree, the design document wins.

## Project Principles

1. **No private content in public output.** Build-time check, bucket IAM
   test, both on every deploy.
2. **No long-lived cloud keys.** WIF only. A JSON key file anywhere in a
   repo or in GitHub secrets is a review failure.
3. **Satellites are untrusted.** A satellite can publish only under its own
   prefix; it can never affect another source or the hub's code.
4. **Static public site.** Nothing on the public path executes at request
   time.
5. **Owner can rebuild from the repo.** Terraform + Actions + this
   document are sufficient to recreate the system in a fresh GCP project.
6. **Cost guardrail stays on.** The budget alert is never removed.

Verbatim from the design-authority document §12.

## Domain Review Questions

- Does this change put any private-visibility item on the public path?
- Does this change introduce a long-lived credential?
- Can a satellite affect anything outside its prefix?

## Repository Layout

The paths this repo binds. The canon prescribes the shape
(agentic-governance `llm/governance/project-operating-system.md`
§Repository Areas); this block binds it here, so nothing downstream
hardcodes a path.

- Governance directory: `llm/governance/`
- ADR directory: `llm/governance/adr/`
- Spec directory: `llm/specs/`
- Sprints directory: `llm/sprints/`
- Plans directory: `llm/plans/`
- Memory-bank path: `llm/memory_bank/`

Slots deliberately not declared. There is no repo-local constitution: the
canonical executive charters apply unchanged. There is no feature catalog:
scope is tracked by the roadmap and the design-authority document. The
artifacts directory is not declared **yet**. The design document places the
data plane at `docs/` (satellite how-to, published views), but no data-plane
content exists today, and `--layout` fails any declared path that does not
exist. It is declared in the same PR that creates its first content, planned
for Phase 2 with the satellite how-to. Until then the checker's data-plane
scan still runs against its canonical default `docs/`, so control-plane
content placed there fails the check today, and `CLAUDE.md` already names
`docs/` as the data plane.

Paths outside the slot table, intentionally: the current Astro application
(`src/`, `public/`, `scripts/`, `astro.config.mjs`, `package.json`), which
ADR-0001 moves under `site/` in Phase 1; and the target-state application
directories `site/`, `gate/`, `contract/`, `infra/` and the tool-contract file
`firebase.json`, each created in the phase that first needs it.

## Roadmap

Path: `llm/master-roadmap.md`

## Canon Location

- Canon checkout: `~/code/agentic-governance`
- Canon repository: `https://github.com/djjay0131/agentic-governance`
- Plugin registered: `repo` (`.claude/settings.json`, by git URL). On a machine
  that has not yet accepted the `agentic-governance` marketplace the
  declaration is inert until a human accepts it.

Skills and agents running as the installed plugin resolve canon from
`${CLAUDE_PLUGIN_ROOT}/..` and need none of this. CI does not use the
checkout either: `.github/workflows/ci.yml` fetches canon itself, pinned by
commit SHA.

**Which pin binds.** The CI pin is binding: `.github/workflows/ci.yml` checks
out canon at a fixed commit SHA, and that is what runs on every pull request.
The installed plugin auto-updates on workstations (`autoUpdate` in
`.claude/settings.json`), so a local session can run a newer canon than CI.
When the two disagree, CI's result is authoritative. Bumping the CI SHA is an L2
pull request that also updates this file's `Governance:` line.

## Governance Check Command

With the plugin loaded:

`node "${CLAUDE_PLUGIN_ROOT}/scripts/governance-checks.mjs" --layout`

From a plain shell, the same script under the `Canon checkout` declared in
§Canon Location, with the same `--layout` flag. Run from the repository root.
The delta and ADR directory sit at the checker's default paths, so no
`--delta` or `--adr-dir` flag is needed. `.github/workflows/ci.yml` runs this
check on every push to `main` and every pull request. Cited by L0 fast-track
condition 9 (agentic-governance `llm/governance/l0-fast-track.md`).

## L0 Path Allowlist

The fenced block below is an instance of the canonical rule set in
agentic-governance `llm/governance/l0-fast-track.md` §Template Allowlist,
which also defines the block grammar and the diff shapes (§L0 Path
Allowlist). The check command parses **this** block, not that one, and
reads it from `origin/main`, never from a PR's tree. It is inert while
§Steward Activation Status is INACTIVE.

```l0-allowlist
# Instance of agentic-governance `llm/governance/l0-fast-track.md`
# §Template Allowlist — the source of this rule set and its grammar.
allow llm/memory_bank/** path-only
allow llm/governance/adr/README.md index-table-rows
allow llm/governance/adr/[0-9][0-9][0-9][0-9]-*.md status-line-only
allow llm/master-roadmap.md checkbox-only
allow llm/** link-target-only
allow docs/** link-target-only
deny src/**
deny scripts/**
deny public/**
deny site/**
deny gate/**
deny contract/**
deny infra/**
deny firebase.json
deny .github/**
deny llm/governance/governance-delta.md
deny llm/governance/adr/0000-template.md
```

The application, infrastructure and contract trees are denied beyond the
template's `src/` and `scripts/` because every one of them is executable or
deploys something, and `contract/` is the interface satellites trust.

## Platform Enforcement Reality

Verified against the GitHub API on 2026-09-14, not assumed.

- **Before adoption:** `main` had no branch protection
  (`gh api repos/djjay0131/website/branches/main/protection` returned 404
  "Branch not protected") and no rulesets.
- **Branch protection on `main`: configured 2026-09-14, partial.** Pull
  requests are required, stale reviews dismiss, conversation resolution is
  required, and force pushes and deletions are blocked. But
  `required_approving_review_count` is **0**, code-owner review is **off**,
  and `enforce_admins` is **off**. The owner chose to mirror
  agentic-governance's own settings. Consequence: the owner's token can
  bypass the PR requirement, and every agent session uses the owner's token,
  so an agent can too. The gate binds ordinary flow; it does not bind the
  token.
- **Required status checks: enabled 2026-09-15.** The `ci.yml`
  `governance-checks` job is a required context on `main`, non-strict (a PR need
  not be rebased onto the newest `main` to merge), added after its first green run
  on `main`. A PR whose governance checks fail cannot be merged. Since 2026-09-15, `build.yml`'s
  `budget-guard` job is a second required context, on the owner's decision, so a PR
  that removes the budget or its `prevent_destroy` guard cannot be merged. `build.yml`
  (build and unit tests) also runs on pull requests and is not required.
- **Repository:** public, user-owned (no organization), single collaborator
  (`djjay0131`). Branch protection is available on this plan.
- **Token/identity model:** all agent sessions authenticate as `djjay0131`
  with the owner's token. Chief Architect, Chief Reviewer, Chief Product
  Officer, Repository Steward and every specialist are procedural roles, not
  distinct identities, and the platform cannot tell them apart. The rule that
  sub-agents make no git or gh mutations is procedural.
- **CODEOWNERS:** present (`* @djjay0131`), not enforced.
- **Hardening path:**
  - Add `governance-checks` as a required status check. **Done 2026-09-15.**
  - `enforce_admins` on. Not taken — the owner's choice on 2026-09-14,
    keeping the single maintainer's emergency path.
  - Required approvals ≥ 1. **Blocked:** a single-maintainer repo cannot
    supply a second approver until a second human or a distinct machine
    identity exists.

## Steward Activation Status

Status: INACTIVE

Steward merge authority ships inert (agentic-governance
`llm/governance/l0-fast-track.md` §Per-Repo Activation) and has not been
activated here. Activation would need an activation ADR and a human-approved,
human-merged activation PR; neither exists. It is also blocked in substance by
the identity model above: a steward merge would be indistinguishable from an
owner merge.

- Activation ADR: none
- Activation PR: none

## Milestone Labels

From the design-authority document §11. Installed 2026-09-14 and verified
present.

- `phase-0-establish`
- `phase-1-foundation`
- `phase-2-contract`
- `phase-3-private-area`
- `phase-4-sharing`
- `phase-5-satellites`
- `phase-6-polish`

## Special Labels

None beyond the canonical set. The canonical taxonomy
(agentic-governance `llm/governance/labels.md`), including `gov-L0`…`gov-L3`,
was installed 2026-09-14 and verified present. GitHub's default labels were
kept. `ci-failure` is created on demand by `build.yml` and is not part of the
taxonomy.

## Constitution Adjustments

None.

## Related Repos

Authority flows one way on each edge: canon to this delta; this repo's
publishing contract to its satellites. No satellite has write access to this
repository (principle 3), and nothing here depends on how a satellite builds.

| Repo | Relationship | Phase |
|---|---|---|
| `agentic-governance` | Canon. Binding pin: CI at SHA `5689b69` (v0.8.3); the plugin auto-updates locally (§Canon Location). | — |
| `cv` | Satellite #1, public items. Private repo, public output. Today consumed ad hoc via release download in `build.yml`; formalized under the manifest contract. | 2 |
| `phd-milestones` | Satellite #2, private items: milestone tracker, committee dossier. To be created as a private repo from the handoff tarball. | 3 |
| `agentic-kg` | Satellite #3, project page (public), optional private notes. | 5 |
| `construction-ai-proposal` | Satellite #4, project page (public). | 5 |
| `agentic-research` | Not a satellite. Academic-writing tooling; not used in Phases 0–3. | — |
