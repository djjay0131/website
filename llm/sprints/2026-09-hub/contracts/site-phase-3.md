# Contract: Site Implementation Engineer — Phase 3

Status: Active
Last updated: 2026-09-17
Owner: Chief Architect (Lead Architect)

Instance of the Universal Bounded-Contract Skeleton (agentic-governance
`llm/governance/patterns/prompt-patterns.md`, Pattern 2 Implementation), carrying every
element of `llm/governance/project-operating-system.md` §Agent Assignment Contract.
`<canon checkout>` is the path declared in `llm/governance/governance-delta.md` §Canon
Location.

```text
ROLE: You are the Site Implementation Engineer (Specialist 3) for sprint 2026-09-hub,
  Phase 3 — Private area (issue #24), working in djjay0131/website on branch
  feat/private-area.

OBJECTIVE: One source tree produces two outputs — a public site that provably contains no
  private item, and a private output the gate serves — and a member can sign in.

REQUIRED READING (before writing anything):
  1. llm/sprints/2026-09-hub/STATE.md
  2. llm/sprints/2026-09-hub/contracts/phase-3-seams.md — BINDING. SEAM-2, SEAM-4, SEAM-5,
     SEAM-6, SEAM-8, SEAM-9 are yours.
  3. llm/governance/adr/0005-two-output-build-with-leak-check.md — the whole ADR, including
     why the leak check greps CONTENTS as well as paths.
  4. llm/governance/adr/0010-withdrawal-semantics.md — decisions 3, 4 and 5 are yours.
  5. llm/governance/adr/0004-private-area-cloud-run-gate-behind-hosting.md §the `__session`
     constraint, which the sign-in page must respect.
  6. llm/specs/2026-09-10-research-hub-design.md §5, §6 responsibility 1, §9, §12.1.
  7. llm/master-roadmap.md §phase-3-private-area
  8. site/src/lib/hub-content.mjs, site/src/content.config.ts, site/scripts/sync-content.sh
     — the Phase 2 machinery you are extending, not replacing.
  9. Issue #24 (`gh issue view 24`).
  10. <canon checkout>/llm/governance/definition-of-done.md §Implementation Work

REQUIRED SKILLS/WORKFLOWS: Superpowers and Constellize are not installed; do not invoke
  them. Do not invoke any /governance:* skill.

FILE CONTRACT:
  - You may create/edit ONLY:
      site/**
      .github/workflows/build.yml
      llm/sprints/2026-09-hub/handoffs/site-phase-3.md
  - **firebase.json is NOT yours this phase.** See CONSTRAINTS.
  - Do not modify: gate/**, infra/**, contract/**, .github/workflows/ci.yml or gate.yml,
    docs/**, CLAUDE.md, AGENTS.md, .claude/**, or anything in llm/ apart from your handoff.
    Do not touch the cv or phd-milestones repositories. If you find a defect in a file you
    don't own, REPORT it; never fix it.

DELIVERABLES:
  D1 Two-output build. `HUB_OUTPUT=public` builds site/dist-public exactly as today;
     `HUB_OUTPUT=private` builds site/dist-private containing the private items and the
     navigation that reaches them. One source tree, one content collection, filtered by
     `visibility` (§5, ADR-0005). Default with the variable unset must remain the public
     build, so nothing about Phase 2's behaviour changes by accident.
  D2 site/scripts/check-no-private-in-public.mjs — the leak check (SEAM-4 settles its
     location). It loads every synced manifest, collects every private slug, and fails if a
     private slug appears in ANY path **or in any file's contents** under dist-public.
     Paths alone are insufficient — a private title rendered into a public index page is a
     leak with no matching path (ADR-0005; brief §4's path-only form was wrong, K11).
  D3 A deliberate demonstration that D2 fails. An acceptance criterion requires the check to
     be SHOWN failing when a private slug reaches dist-public. Provide a repeatable way to
     produce that (a test, or a documented one-line injection), and include its output in
     your handoff. A guard never seen to fail is not known to work.
  D4 The private sync, per ADR-0010 decision 5: dist-private is synced to the private
     bucket **destructively** — objects the current build did not produce are deleted, so a
     withdrawn private item stops being readable rather than lingering at its old path.
     This is the one place a build defect can delete data: it must not run unless the build
     succeeded and the manifests validated (ADR-0010 decision 3).
  D5 The expected-source set (ADR-0010 decision 4, closing C27): the hub declares which
     sources it expects, alongside CLAIMED_DATA_ITEMS in site/src/lib/hub-content.mjs. A
     declared source whose prefix is entirely absent fails the build. Add `phd-milestones`
     to it, and to the claim table only if it publishes a `data` item — it does not; its
     items are `format: html`.
  D6 A sign-in page at /signin: Firebase Web SDK, Google and email-link, posting the ID
     token to the gate's POST /session as {"idToken": "..."}. It is a PUBLIC page — it must
     name no private item and reveal nothing about what exists behind it. On a non-member
     sign-in the gate returns the "not shared with you" response; render it plainly.
  D7 `manifest_version` support (ADR-0009): accept it as an optional top-level string
     matching ^[0-9]+$, treat absent as "1", and FAIL the build on a value the hub does not
     know — the same shape as the existing schema_version check. Mirror it in the Zod schema
     field for field, and report to the Lead Architect that contract/manifest.schema.json
     needs the matching change, since contract/ is not yours.
  D8 build.yml: build both outputs, run the leak check between build and deploy, and sync
     dist-private to the private bucket on the deploy path only. Keep every Phase 1 and 2
     property: the Pages build and deploy, both smoke tests, budget-guard and its two
     invariant guards, the bucket/release fallback, SHA-pinned actions, least-privilege
     per-job permissions.
  D9 Handoff at llm/sprints/2026-09-hub/handoffs/site-phase-3.md with the standard sections,
     plus a statement of which routes exist in which output, and the leak check's failing
     demonstration.

VALIDATION — run and report results verbatim:
  - npm test; both builds; npm run check:smoke-routes on the public build.
  - The leak check passing on a clean build AND failing on the deliberate injection.
  - actionlint on build.yml, and a YAML parse.
  - NEVER run a command that creates, changes or reads a cloud resource. The private bucket
    does not exist yet; test the sync against a local fixture tree and say so.

DEFINITION OF DONE: <canon checkout>/llm/governance/definition-of-done.md §Implementation
  Work, plus each roadmap Phase 3 acceptance criterion in your scope.

CONSTRAINTS:
  - **Do not add the /p/** or /session rewrites to firebase.json in this PR.** Hosting
    rejects a configuration naming a Cloud Run service that does not exist (issue #10 K2,
    verified), and merging this PR triggers a Hosting deploy while `hub-gate` still does
    not exist — which would break the PUBLIC site's deploy, not just the private area. The
    rewrites land in a follow-up after the gate is deployed at Checkpoint 4. If you believe
    they must be in this PR, STOP and report.
  - No public page may list, link or name a private item. Private navigation exists only in
    the private build (ADR-0005).
  - The public build's behaviour must not change. Phase 2's routes, output and smoke checks
    stay exactly as they are.
  - WIF only. A JSON key, a key file or a secret credential of any kind => STOP and report.
  - Every tracked *.sh you add that begins with a shebang must be committed 100755. This
    machine reports every file as 0777; verify with `git ls-files -s`, never `ls -l`.
  - If a change would contradict an Accepted ADR, STOP and report.
  - Uncertain classification => semantic => human review.

OPEN QUESTIONS TO ANSWER:
  (a) Where should the private build's navigation live so that no fragment of it can reach
      the public build by accident? Recommend a structural guarantee, not a convention.
  (b) The destructive private sync is the sharpest tool in this repository. What additional
      precondition, beyond a successful build, would you require before it deletes anything?

ADR CANDIDATES TO IDENTIFY: the private-navigation structure from (a); whether dist-private
  should be content-addressed so a withdrawal is provable.

GIT: NEVER run git or gh mutations; read-only git and gh are allowed. The Lead Architect
  commits.

FINAL REPORT: files delivered; validation output verbatim including the leak check's
  deliberate failure; route-by-route statement of which output serves what; each acceptance
  criterion met or deferred; seam defects found; open questions.
```
