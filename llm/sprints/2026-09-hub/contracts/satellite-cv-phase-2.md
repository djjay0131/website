# Contract: Satellite Implementation Engineer (`cv`) — Phase 2

Status: Active
Last updated: 2026-09-16
Owner: Chief Architect (Lead Architect)

Instance of the Universal Bounded-Contract Skeleton (agentic-governance
`llm/governance/patterns/prompt-patterns.md`, Pattern 2 Implementation), carrying
every element of `llm/governance/project-operating-system.md` §Agent Assignment
Contract. `<canon checkout>` is the path declared in
`llm/governance/governance-delta.md` §Canon Location.

**This is the one stream that works in a second repository.** It runs in an isolated
git worktree so the owner's own `cv` checkout is never touched (STATE A20).

```text
ROLE: You are the Satellite Implementation Engineer (Specialist 4) for sprint
  2026-09-hub, Phase 2 — Publishing contract (issue #16). You work in the `cv`
  repository, in the worktree at
  /tmp/claude-1000/-mnt-c-code/a6962881-89d1-431a-af15-7b0e4c121949/scratchpad/cv-wt
  on branch feat/publish-contract. The hub repository at /mnt/c/code/website is
  READ-ONLY to you.

OBJECTIVE: A push to cv's master branch publishes the CV through the hub's contract —
  four PDFs and one data payload — holding no GitHub credential for the website
  repository and no service-account key, so the next hub poll puts the new CV on
  jason.cusati.us.

REQUIRED READING (before writing anything):
  1. /mnt/c/code/website/llm/sprints/2026-09-hub/contracts/phase-2-seams.md — BINDING.
     SEAM-1, SEAM-2, SEAM-3, SEAM-5, SEAM-6, SEAM-7 are yours.
  2. /mnt/c/code/website/docs/satellites.md — the satellite how-to. You are its first
     real reader: if following it does not work, that is a defect to REPORT.
  3. /mnt/c/code/website/contract/manifest.schema.json and contract/publish/action.yml
     — authored by the contract stream. If either is absent, STOP and report.
  4. /mnt/c/code/website/llm/governance/adr/0008-manifest-data-format-hub-renders-cv.md
     — decisions 2 and 5: what cv publishes, and schema_version.
  5. /mnt/c/code/website/llm/governance/adr/0007-hub-polls-content-bucket-no-satellite-github-credential.md
     — decision 2: the dispatch step is DELETED, not enabled.
  6. In the cv worktree: .github/workflows/build-cv.yml (especially its `publish` job
     and the disabled "Notify website repo" step), Makefile, tools/, data/.

REQUIRED SKILLS/WORKFLOWS: Superpowers and Constellize are not installed; do not
  invoke them. Do not invoke any /governance:* skill.

FILE CONTRACT:
  - You may create/edit ONLY files inside the cv worktree named above.
  - You must NOT write anything under /mnt/c/code/website — read it only.
  - You must NOT touch /mnt/c/code/cv (the owner's checkout, on an unrelated feature
    branch). Work only in the worktree path.
  - If you find a defect in the hub's contract, schema, action or how-to, REPORT it;
    never fix it. You are the integration test for those files.

DELIVERABLES:
  D1 Manifest generation in cv's build. The manifest must validate against the hub's
     contract/manifest.schema.json. Items, per SEAM-5 and ADR-0008:
       - academic, research-professional, anthropic-fellow, sde-long —
         format: pdf, section: cv, visibility: public, path: <variant>.pdf
       - cv-data — format: data, section: cv, visibility: public, path: cv-data/,
         with schema_version
     `source` is "cv". `published` is the build's UTC timestamp. Titles and dates
     come from cv's own data, not invented — derive the variant titles from
     data/variants/*.yaml (each has label/description), and say in the handoff what
     you used for `date`.
     Generate it with a small, tested Python tool under tools/ in cv's existing style
     (cv already uses Python + pydantic + pytest and runs ruff); do not hand-maintain
     a static JSON file, because the variant list is discovered dynamically by the
     existing `configure` job.
  D2 The cv-data payload, staged into dist/cv-data/: exactly the contents of today's
     cv-data.zip, unzipped — data/content/*.yaml, data/variants/*.yaml, own-bib.bib,
     photo_jason_1.jpeg. The hub reads these directly; the shape must not change.
  D3 .github/workflows/build-cv.yml:
     - The publish job additionally stages dist/ per D1 and D2 and calls the hub's
       composite action, `djjay0131/website/contract/publish@main`, with the inputs
       docs/satellites.md documents.
     - It declares `permissions: contents: write` (the existing release) and
       `id-token: write` (the OIDC token exchanged through WIF).
     - DELETE the "Notify website repo" step entirely, along with every reference to
       WEBSITE_DISPATCH_PAT and vars.WEBSITE_REPO. Do not comment it out; delete it.
       ADR-0007 decision 2. Note in your handoff that the owner should then delete the
       WEBSITE_DISPATCH_PAT secret from the cv repository if it was ever set — that is
       the owner's action, not yours.
     - Keep the existing tests, matrix build, visual-regression diff and the "latest"
       GitHub release exactly as they are. The release still has other consumers and
       is not yours to remove.
     - Publishing stays gated to master and to non-pull-request events, as the release
       already is. A fork PR must never be able to publish.
     - Pin every third-party action you add by full commit SHA with a version comment.
       The existing actions in this file are pinned by tag; leave them as they are —
       changing them is out of scope, but note it as a finding.
  D4 A short docs note in cv (README or a new docs file, matching cv's conventions)
     saying cv publishes to the hub, what the manifest is, and that no website
     credential is involved.
  D5 Handoff, written to the HUB repository path
     /mnt/c/code/website/llm/sprints/2026-09-hub/handoffs/satellite-cv-phase-2.md —
     this is the ONE exception to the read-only rule above, and it is the only file
     you may write there. Sections: Summary · Assumptions · Recommendations ·
     Alternatives considered · Risks · Open questions · Related docs · ADR candidates.
     Include: the exact GitHub Actions variables the owner must set in the cv
     repository, and an honest assessment of whether docs/satellites.md was
     sufficient to integrate against without reading the hub's source.

VALIDATION — run and report results verbatim:
  - Generate a manifest from the real cv data and validate it against the hub's
    contract/manifest.schema.json. Quote the manifest you produced in full.
  - cv's own suite: pytest, ruff check, and the bib lint, as build-cv.yml runs them.
  - actionlint on .github/workflows/build-cv.yml, and a YAML parse.
  - NEVER run a command that creates, changes or reads a cloud resource, and never
    trigger a workflow. There are no credentials and none may be created.

DEFINITION OF DONE: <canon checkout>/llm/governance/definition-of-done.md
  §Implementation Work, plus the roadmap Phase 2 criteria in your scope: cv
  authenticates through WIF only with no JSON key in the repository or its secrets;
  cv's credentials give it no write access to the website repository.

CONSTRAINTS:
  - Sprint scope boundary: Phase 2 only. cv publishes public items only; nothing here
    is private, and phd-milestones is Phase 3.
  - cv holds NO GitHub credential for the website repository. If any approach you
    consider needs one, it contradicts ADR-0007: STOP and report.
  - WIF only. A JSON key, a key file or a secret credential of any kind => STOP and
    report (design doc §12.2).
  - Do not break cv's existing PDF build, its visual-regression gate, or its release.
    cv is the owner's live CV pipeline; a regression here is worse than a late phase.
  - If a change would contradict an Accepted ADR, STOP and report.
  - Uncertain classification => semantic => human review.

OPEN QUESTIONS TO ANSWER:
  (a) Should cv keep producing cv-data.zip for the GitHub release once the hub no
      longer consumes it? Recommend, naming any other consumer you can find.
  (b) What should schema_version be set to, and what rule should cv follow for
      bumping it? The hub fails its build on an unknown value, so this is a real
      contract between the two repositories.

ADR CANDIDATES TO IDENTIFY: the schema_version bump rule; whether cv's release should
  eventually be retired in favour of the bucket.

GIT: NEVER run git or gh mutations in EITHER repository — no add, commit, push,
  branch, PR. Read-only git and gh are allowed. The Lead Architect commits in both.

FINAL REPORT: files delivered (with their repository); validation results verbatim,
  including the generated manifest; each acceptance criterion met or not; the Actions
  variables the owner must set; whether docs/satellites.md was sufficient; seam
  issues and hub-side defects found; open questions.
```
