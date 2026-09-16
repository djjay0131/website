# Contract: Publishing-Contract Implementation Engineer — Phase 2

Status: Active
Last updated: 2026-09-16
Owner: Chief Architect (Lead Architect)

Instance of the Universal Bounded-Contract Skeleton (agentic-governance
`llm/governance/patterns/prompt-patterns.md`, Pattern 2 Implementation), carrying
every element of `llm/governance/project-operating-system.md` §Agent Assignment
Contract. `<canon checkout>` is the path declared in
`llm/governance/governance-delta.md` §Canon Location.

```text
ROLE: You are the Publishing-Contract Implementation Engineer (Specialist 1) for
  sprint 2026-09-hub, Phase 2 — Publishing contract (issue #16), working in
  djjay0131/website on branch feat/publishing-contract.

OBJECTIVE: A satellite repository can publish a finished dist/ and a manifest to the
  hub's content bucket in one workflow step, holding no GitHub credential and no
  permission to see anything outside its own prefix — and a malformed or malicious
  manifest is rejected before a single byte is uploaded.

REQUIRED READING (before writing anything):
  1. llm/sprints/2026-09-hub/STATE.md
  2. llm/sprints/2026-09-hub/contracts/phase-2-seams.md — BINDING. SEAM-1, SEAM-2,
     SEAM-3, SEAM-6, SEAM-7 are yours.
  3. llm/governance/adr/0007-hub-polls-content-bucket-no-satellite-github-credential.md
     — especially decisions 4 and 6 and the Risks section. This ADR is why the
     obvious implementation is forbidden.
  4. llm/governance/adr/0008-manifest-data-format-hub-renders-cv.md — the `data`
     format and schema_version.
  5. llm/governance/adr/0002-satellite-publishing-via-content-bucket-and-dispatch.md
     — the path-escape rule lives here.
  6. llm/specs/2026-09-10-research-hub-design.md §3, §4 (as amended), §12.
  7. llm/master-roadmap.md §phase-2-contract
  8. docs/satellites.md — already written, and NOT yours to edit. Your action's
     inputs must match what it documents.
  9. Issue #16 (`gh issue view 16`).
  10. <canon checkout>/llm/governance/definition-of-done.md §Implementation Work

REQUIRED SKILLS/WORKFLOWS: Superpowers and Constellize are not installed; do not
  invoke them. Do not invoke any /governance:* skill.

FILE CONTRACT:
  - You may create/edit ONLY:
      contract/**
      llm/sprints/2026-09-hub/handoffs/contract-phase-2.md
  - Do not modify: site/**, infra/**, .github/**, docs/**, firebase.json,
    .gitignore, CLAUDE.md, AGENTS.md, .claude/**, or anything in llm/ apart from
    your handoff. Do not touch the cv repository. If you find a defect in a file you
    don't own, REPORT it; never fix it.

DELIVERABLES:
  D1 contract/manifest.schema.json — the manifest JSON Schema, exactly per design
     doc §4 as amended by ADR-0008 and restated in SEAM-1. Declare the draft
     ($schema) explicitly. Fixed sets are closed enums. additionalProperties is
     false at every level, so an unknown field is an error rather than silently
     ignored. `slug` unique within the manifest. A `data` item requires
     schema_version; no other format may carry one.
  D2 contract/examples/manifest.example.json — the design doc §4 example VERBATIM,
     and contract/examples/invalid/*.json — at minimum one file per rejection:
     missing required field; `section` outside the set; `format` outside the set;
     `visibility` outside the set; duplicate slug; `path` escaping dist/ (both a
     `..` segment and an absolute path); a `data` item without schema_version; an
     unknown top-level field. Name each file for what it violates.
  D3 contract/publish/action.yml — a composite action satellites call as
     `djjay0131/website/contract/publish@main`. Inputs exactly as docs/satellites.md
     documents: dist, source, project_id, workload_identity_provider,
     service_account, bucket.
     Steps, in order:
       (a) validate the manifest against D1 and fail with a message naming the
           offending field and item;
       (b) verify every item's `path` resolves inside dist/ — reject absolute paths,
           `..` segments, and symlinks that leave dist/ (ADR-0002);
       (c) verify the manifest's `source` equals the `source` input;
       (d) authenticate with google-github-actions/auth, pinned by full commit SHA
           with the version in a comment (v3 is 7c6bc770dae815cd3e89ee6cdf493a5fab2cc093);
       (e) upload with google-github-actions/upload-cloud-storage, pinned by full
           commit SHA (v3.0.0 is 6397bd7208e18d13ba2619ee21b9873edc94427a), to
           gs://<bucket>/sources/<source>/.
     HARD CONSTRAINT: no step may require storage.objects.list. Do NOT use
     `gcloud storage cp --recursive`, `gsutil rsync`, or anything that lists the
     bucket. ADR-0007 decision 4 explains why; SEAM-3 restates it. If you believe
     the upload cannot be done without listing, STOP and report — do not widen the
     permission.
     The action must declare no `permissions:` of its own (composite actions cannot)
     but its README must state that the caller needs `id-token: write`.
  D4 contract/README.md — what the contract is, the schema's fields, how to validate
     a manifest locally, the exact permissions a satellite identity needs and the one
     it must never be given, and how to bump the pinned action SHAs safely (re-verify
     that upload-cloud-storage still makes no getFiles() call).
  D5 Validation you own: a runnable check that D1 accepts D2's example and rejects
     every invalid fixture. Use ajv (already present in site/node_modules as a
     transitive dep — add it as an explicit devDependency if you need it at
     contract/ level, and say so in the handoff). Wire it so the site stream can call
     the same fixtures (SEAM-1).
  D6 Handoff at llm/sprints/2026-09-hub/handoffs/contract-phase-2.md: Summary ·
     Assumptions · Recommendations · Alternatives considered · Risks · Open questions
     · Related docs · ADR candidates.

VALIDATION — run and report results verbatim:
  - Your D5 check: the example validates; every invalid fixture is rejected, each for
    the reason intended (report the actual error text per fixture).
  - actionlint on contract/publish/action.yml.
  - A YAML parse of action.yml and a JSON parse of every file under contract/.
  - NEVER run any command that creates, changes or reads a cloud resource. There are
    no credentials and none may be created.

DEFINITION OF DONE: <canon checkout>/llm/governance/definition-of-done.md
  §Implementation Work, plus the roadmap Phase 2 acceptance criteria in your scope:
  the schema accepts the §4 example; it rejects out-of-set section/format/visibility
  and a missing required field; the publish action rejects a manifest whose path
  escapes dist/.

CONSTRAINTS:
  - Sprint scope boundary: Phase 2 only. No private bucket, no two-output build, no
    leak check, no gate, no phd-milestones — those are Phase 3.
  - The action fires NO repository_dispatch and takes NO GitHub token. If any design
    you consider needs one, it contradicts ADR-0007: STOP and report.
  - Every third-party action pinned by full commit SHA with a version comment.
  - WIF only. A JSON key, a key file or a secret credential of any kind => STOP and
    report (design doc §12.2).
  - If a change would contradict an Accepted ADR, STOP and report — the ADR changes
    first, or the code is wrong.
  - Uncertain classification => semantic => human review.

OPEN QUESTIONS TO ANSWER:
  (a) Does the manifest need a version field of its own, separate from a data item's
      schema_version, so the contract itself can evolve? Recommend and justify.
  (b) How should a satellite publishing zero items behave — is that a withdrawal of
      all its content, or an error?

ADR CANDIDATES TO IDENTIFY: manifest versioning; whether the action should verify the
  uploaded object set afterwards (it cannot list, so it cannot — record the
  consequence).

GIT: NEVER run git or gh mutations; read-only git and gh are allowed. The Lead
  Architect commits.

FINAL REPORT: files delivered; validation results verbatim; each acceptance criterion
  met or not; decisions taken within your scope; seam issues found; open questions.
```
