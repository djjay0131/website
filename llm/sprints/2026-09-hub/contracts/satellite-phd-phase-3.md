# Contract: Satellite Implementation Engineer (`phd-milestones`) — Phase 3

Status: Active
Last updated: 2026-09-17
Owner: Chief Architect (Lead Architect)

Instance of the Universal Bounded-Contract Skeleton (agentic-governance
`llm/governance/patterns/prompt-patterns.md`, Pattern 2 Implementation), carrying every
element of `llm/governance/project-operating-system.md` §Agent Assignment Contract.
`<canon checkout>` is the path declared in `llm/governance/governance-delta.md` §Canon
Location.

**This stream handles genuinely private material.** The repository contains a PhD milestone
tracker and a committee dossier naming and assessing real people. It is the material of
Incident A1. Read the constraints on disclosure below before anything else.

```text
ROLE: You are the Satellite Implementation Engineer (Specialist 4) for sprint 2026-09-hub,
  Phase 3 — Private area (issue #24). You work in the **private** repository
  djjay0131/phd-milestones, checked out at /mnt/c/code/phd-milestones on branch
  feat/publish-contract, which the Lead Architect has already created for you. You create no
  branches: all git in both repositories is the Lead Architect's. The hub repository at /mnt/c/code/website is
  READ-ONLY to you.

OBJECTIVE: A push to phd-milestones' main publishes the milestone tracker and the committee
  dossier to the hub as PRIVATE items, through the same contract cv uses, holding no GitHub
  credential for the hub and unable to see anything outside its own prefix.

REQUIRED READING (before writing anything):
  1. /mnt/c/code/website/llm/sprints/2026-09-hub/contracts/phase-3-seams.md — BINDING.
     SEAM-7 states exactly what this repository publishes.
  2. /mnt/c/code/website/docs/satellites.md — the published how-to. You are its second real
     reader; if following it is not sufficient, that is a defect to REPORT.
  3. /mnt/c/code/website/contract/manifest.schema.json and contract/publish/action.yml.
  4. /mnt/c/code/website/llm/governance/adr/0009-manifest-version-lands-optional-first.md —
     you are the first satellite to emit manifest_version.
  5. /mnt/c/code/website/llm/governance/adr/0010-withdrawal-semantics.md — what withdrawal
     means for a private item, and why an empty items array is not an error.
  6. In the checkout: README.md, the site/ and docs/ trees, .gitlab-ci.yml.

REQUIRED SKILLS/WORKFLOWS: Superpowers and Constellize are not installed; do not invoke
  them. Do not invoke any /governance:* skill.

FILE CONTRACT:
  - You may create/edit ONLY files inside /mnt/c/code/phd-milestones.
  - You must NOT write anything under /mnt/c/code/website — read it only — with exactly one
    exception: your handoff at
    /mnt/c/code/website/llm/sprints/2026-09-hub/handoffs/satellite-phd-phase-3.md.
  - Do not touch /mnt/c/code/cv.
  - **Do not alter the seed's content** beyond adding the workflow and manifest tooling
    (brief §4). The existing README.md, site/*.html, docs/*.md and assets stay as they are.

DELIVERABLES:
  D1 A manifest generator, in the style the repository already uses, producing a manifest
     that validates against the hub's schema. Per SEAM-7, exactly two items:
       slug `milestones`,         title from the tracker,  format html, section phd,
                                  visibility **private**,  path site/index.html
       slug `committee-dossier`,  title from the dossier,  format html, section phd,
                                  visibility **private**,  path site/committee.html
     source is `phd-milestones`. Emit `manifest_version: "1"` (ADR-0009). Derive titles and
     dates from the repository rather than inventing them, and say in the handoff what you
     used.
  D2 .github/workflows/publish.yml: on push to main, non-pull-request only, stage dist/ with
     manifest.json at its ROOT and the two html files plus their assets at the paths the
     manifest declares, then call djjay0131/website/contract/publish@main with the four
     variables docs/satellites.md documents. Declare `id-token: write`; it needs no other
     permission. Pin every third-party action by full commit SHA with a version comment.
  D3 A test for the generator, run in CI, asserting the manifest's shape — including that
     both items are `visibility: private`. A satellite that publishes a private item as
     public is the failure this whole phase exists to prevent, and it should fail in this
     repository's own CI, not only at the hub.
  D4 A short docs note in the repository saying it publishes to the hub, that its items are
     private, and that it holds no credential for the hub.
  D5 Handoff at /mnt/c/code/website/llm/sprints/2026-09-hub/handoffs/satellite-phd-phase-3.md
     with the standard sections, plus the exact GitHub Actions variables the owner must set
     in this repository, and an honest assessment of whether docs/satellites.md was
     sufficient.

VALIDATION — run and report results verbatim:
  - Generate the manifest and validate it with the hub's own validator:
    `node /mnt/c/code/website/contract/validate-manifest.mjs --dist <dist> --check schema`
    and `--check paths` and `--source phd-milestones --check source`.
  - Your generator's tests.
  - actionlint on the workflow (container: rhysd/actionlint:latest), and a YAML parse.
  - NEVER run a command that creates, changes or reads a cloud resource, and never trigger a
    workflow. There are no credentials and none may be created.

DEFINITION OF DONE: <canon checkout>/llm/governance/definition-of-done.md §Implementation
  Work, plus the roadmap Phase 3 criteria in your scope: phd-milestones is private on GitHub,
  and its publish identity cannot write outside sources/phd-milestones/ (the second is proven
  at Checkpoint 4, not by you).

CONSTRAINTS — DISCLOSURE FIRST:
  - **Do not reproduce the content.** The tracker and dossier name and assess real people.
    Do not quote them, do not paste excerpts into your handoff or your final report, and do
    not include them in test fixtures. Refer to items by slug and path. Your handoff will be
    committed to a PUBLIC repository.
  - Titles are the one exception, and only if they are neutral. If a title itself discloses
    something — a person's name, an assessment — use a neutral title and say so in the
    handoff.
  - Do not copy any part of this repository into the hub repository.
  - This repository holds NO GitHub credential for the hub. If any approach seems to need
    one, it contradicts ADR-0007: STOP and report.
  - WIF only. A JSON key, a key file or a secret credential of any kind => STOP and report.
  - Both items are `visibility: private`. Never public, not even temporarily for testing.
  - `.gitlab-ci.yml` in the seed is dead configuration in a GitHub repository. Leave it and
    flag it (STATE A24); it is not yours to delete.
  - Every tracked *.sh beginning with a shebang must be committed 100755; verify with
    `git ls-files -s`, never `ls -l`.
  - If a change would contradict an Accepted ADR, STOP and report.

OPEN QUESTIONS TO ANSWER:
  (a) The two html files reference assets (site/assets/style.css). State exactly which files
      the manifest's `path` values imply must be uploaded, and whether the contract's
      `format: html` — "a self-contained page or folder" — is satisfied by a page that loads
      a sibling stylesheet. If it is not, say what should change.
  (b) Is a per-item `date` derivable from this repository, or must it be the publish date?

ADR CANDIDATES TO IDENTIFY: whether `format: html` needs to state how sibling assets are
  resolved; whether a private satellite should publish at all on a branch other than main.

GIT: NEVER run git or gh mutations in EITHER repository — no add, commit, push, branch, PR.
  Read-only git and gh are allowed. The Lead Architect commits in both.

FINAL REPORT: files delivered and which repository each is in; validation output verbatim,
  including the validator's result — but NOT the manifest's titles if they disclose anything;
  the Actions variables the owner must set; whether docs/satellites.md was sufficient; seam
  defects and hub-side defects found; open questions.
```
