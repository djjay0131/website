# Contract: Infrastructure Implementation Engineer — Phase 2

Status: Active
Last updated: 2026-09-16
Owner: Chief Architect (Lead Architect)

Instance of the Universal Bounded-Contract Skeleton (agentic-governance
`llm/governance/patterns/prompt-patterns.md`, Pattern 2 Implementation), carrying
every element of `llm/governance/project-operating-system.md` §Agent Assignment
Contract. `<canon checkout>` is the path declared in
`llm/governance/governance-delta.md` §Canon Location.

```text
ROLE: You are the Infrastructure Implementation Engineer (Specialist 2) for sprint
  2026-09-hub, Phase 2 — Publishing contract (issue #16), working in
  djjay0131/website on branch feat/publishing-contract.

OBJECTIVE: One reviewed `terraform apply` creates a content bucket and a publishing
  identity for `cv` that can write only under sources/cv/, cannot enumerate anything
  else in the bucket, and holds no key and no GitHub credential — and adding the next
  satellite is one map entry, not a new module.

REQUIRED READING (before writing anything):
  1. llm/sprints/2026-09-hub/STATE.md — especially §Constraints discovered, which
     records the four primary-source findings that bind your design.
  2. llm/sprints/2026-09-hub/contracts/phase-2-seams.md — BINDING. SEAM-2, SEAM-3,
     SEAM-4 (the hub's read access), SEAM-6, SEAM-7 are yours.
  3. llm/governance/adr/0007-hub-polls-content-bucket-no-satellite-github-credential.md
     — decisions 3, 4, 5, 7, 8 are yours to implement. Read the Risks too.
  4. llm/governance/adr/0008-manifest-data-format-hub-renders-cv.md §Decision 6 —
     cv is PUBLIC and its default branch is `master`.
  5. llm/specs/2026-09-10-research-hub-design.md §8, §11, §12.
  6. llm/master-roadmap.md §phase-2-contract
  7. infra/** as it stands — especially wif.tf, whose shared-pool invariant comment
     is the reason ADR-0007 decision 5 gives satellites their own pool; deploy.tf for
     the house style of justifying every role; and README.md.
  8. Issue #16 (`gh issue view 16`).
  9. <canon checkout>/llm/governance/definition-of-done.md §Implementation Work

REQUIRED SKILLS/WORKFLOWS: Superpowers and Constellize are not installed; do not
  invoke them. Do not invoke any /governance:* skill.

FILE CONTRACT:
  - You may create/edit ONLY:
      infra/**
      llm/sprints/2026-09-hub/handoffs/infra-phase-2.md
  - Do not modify: site/**, contract/**, .github/** (the site stream owns
    build.yml this phase), docs/**, firebase.json, .gitignore, CLAUDE.md, AGENTS.md,
    .claude/**, or anything in llm/ apart from your handoff. Do not touch the cv
    repository. If you find a defect in a file you don't own, REPORT it.
  - Do not edit infra/budget.tf except to add a comment. The budget and its
    prevent_destroy guard are protected by a required CI check.

DELIVERABLES:
  D1 infra/storage.tf — the content bucket.
     - uniform_bucket_level_access = true. REQUIRED: an IAM condition does not apply
       without it, so the whole prefix boundary silently fails if this is off.
     - public_access_prevention = "enforced".
     - versioning enabled — ADR-0007 accepts that a satellite can delete its own
       objects, and versioning is what makes that recoverable.
     - Location: var.region (us-east1). force_destroy stays false.
     - Name it from a variable with the project id as the default stem, since bucket
       names are globally unique; do not hardcode.
     - A lifecycle rule for noncurrent versions, if you can justify one against the
       $5 budget. Say what you chose and why.
  D2 infra/satellites.tf — the publishing identities, written as a MAP over
     satellites (for_each), not as one-off resources for cv. Adding phd-milestones in
     Phase 3 must be one map entry. Per satellite:
     - a service account;
     - a WIF provider in a NEW pool `satellites`, separate from the hub's
       `github-actions` pool (ADR-0007 decision 5; wif.tf explains why the pool is
       the trust boundary). Admit only that repository, matched on immutable
       repository_id AND repository_owner_id AND name, refusing pull_request_target,
       exactly as the hub's provider does;
     - a workloadIdentityUser binding admitting only that satellite's default branch
       ref — for cv that is refs/heads/master, NOT main;
     - a conditional binding on the bucket granting D3's custom role, with
       condition:
         resource.type == 'storage.googleapis.com/Object' &&
         resource.name.startsWith('projects/_/buckets/<bucket>/objects/sources/<source>/')
     cv's values: repository djjay0131/cv, repository_id 1211056144,
     repository_owner_id 5666389, default branch master, source "cv".
  D3 A project custom role (google_project_iam_custom_role) containing EXACTLY:
       storage.objects.create, storage.objects.delete, storage.objects.get
     and nothing else. Comment each permission with why it is needed and why `list`
     is absent, citing ADR-0007. This is the single most important file in your
     scope: `storage.objects.list` cannot be restricted by prefix, so granting it
     would let cv enumerate every other source's object names — in Phase 3, private
     phd-milestones items. `delete` is present because replacing an object needs
     create AND delete and roles/storage.objectCreator cannot overwrite.
     Note the custom-role soft-delete caveat in the provider docs and pick a
     deletion_policy deliberately.
  D4 The hub's read access: grant the existing hub_deploy service account
     roles/storage.objectViewer on the content bucket, unconditioned — the hub owns
     the bucket and must list and read every prefix to sync it (SEAM-4). Explain in a
     comment why the hub's grant is unconditioned while a satellite's is not.
  D5 Outputs: content_bucket_name (and anything else the site and satellite streams
     need as GitHub Actions variables), plus an updated github_actions_variables map
     including GCP_CONTENT_BUCKET and the satellite publish SA / provider values the
     cv repository will need.
  D6 infra/README.md updated: what Phase 2 adds; the exact manual steps in order,
     each with its command and expected result — apply, set the new Actions
     variables in BOTH repositories, and how to verify the prefix boundary; the
     revised monthly cost with sources; rollback.
  D7 Handoff at llm/sprints/2026-09-hub/handoffs/infra-phase-2.md: Summary ·
     Assumptions · Recommendations · Alternatives considered · Risks · Open questions
     · Related docs · ADR candidates — plus exactly what this apply creates, as a
     resource list, and a written procedure the owner can run at Checkpoint 3 to
     prove the three roadmap security criteria:
       (i)  cv's identity cannot write outside sources/cv/;
       (ii) cv's identity cannot LIST the bucket;
       (iii) a republish of an unchanged cv succeeds (overwrite works).

VALIDATION — run and report results verbatim:
  - From infra/: terraform fmt -check -recursive; terraform init -backend=false;
    terraform validate.
  - NEVER run terraform plan or apply, or any command that creates, changes or reads
    a cloud resource. There are no credentials for this project in your environment
    and none may be created. Checkpoint 3 is where cloud verification happens.

DEFINITION OF DONE: <canon checkout>/llm/governance/definition-of-done.md
  §Implementation Work, plus each roadmap Phase 2 acceptance criterion in your scope,
  named in the handoff as met locally with evidence, or verifiable only at
  Checkpoint 3.

CONSTRAINTS:
  - Sprint scope boundary: Phase 2 only. NOT in this phase: the private bucket,
    Artifact Registry, Cloud Run, Identity Platform, Firestore, the gate, any
    phd-milestones identity (roadmap "Not in this phase"; Phase 3 owns them).
  - WIF only. A JSON key, a key file or a secret credential of any kind => STOP and
    report (design doc §12.2).
  - Never grant a satellite storage.objects.list, under any role, conditioned or not.
    If you conclude the design needs it, STOP and report — do not widen it.
  - Do not weaken or remove the budget or its prevent_destroy guard (§12.6).
  - Every cloud resource Phase 2 uses is declared in infra/ or listed as a manual
    step (§12.5).
  - If a change would contradict an Accepted ADR, STOP and report.
  - Uncertain classification => semantic => human review.

OPEN QUESTIONS TO ANSWER:
  (a) Should the satellites pool's providers be one per satellite, or one provider
      with a condition admitting several repositories? Recommend, with the
      cybersquatting and blast-radius reasoning from wif.tf.
  (b) What does the $5 budget look like with a content bucket and hourly polling?
      Show the arithmetic and the source for each rate.

ADR CANDIDATES TO IDENTIFY: bucket lifecycle and retention policy; the remote state
  backend (still outstanding from Phase 1); whether satellites should ever be able to
  delete (versioning is the current mitigation).

GIT: NEVER run git or gh mutations; read-only git and gh are allowed. The Lead
  Architect commits.

FINAL REPORT: files delivered; validation results verbatim; the resource list this
  apply creates; each acceptance criterion met or deferred to Checkpoint 3; seam
  issues found; open questions.
```
