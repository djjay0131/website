# Contract: Infrastructure Implementation Engineer — Phase 3

Status: Active
Last updated: 2026-09-17
Owner: Chief Architect (Lead Architect)

Instance of the Universal Bounded-Contract Skeleton (agentic-governance
`llm/governance/patterns/prompt-patterns.md`, Pattern 2 Implementation), carrying every
element of `llm/governance/project-operating-system.md` §Agent Assignment Contract.
`<canon checkout>` is the path declared in `llm/governance/governance-delta.md` §Canon
Location.

```text
ROLE: You are the Infrastructure Implementation Engineer (Specialist 2) for sprint
  2026-09-hub, Phase 3 — Private area (issue #24), working in djjay0131/website on branch
  feat/private-area.

OBJECTIVE: One reviewed `terraform apply` creates the private area's cloud foundation — a
  private bucket only the gate can read, the gate's runtime identity, Cloud Run, Artifact
  Registry, Identity Platform and Firestore — and adds phd-milestones as a satellite with
  the same prefix boundary cv already has, as one map entry.

REQUIRED READING (before writing anything):
  1. llm/sprints/2026-09-hub/STATE.md — especially §Constraints discovered, which records
     what Phase 2 learned the hard way about IAM conditions and bucket-level permissions.
  2. llm/sprints/2026-09-hub/contracts/phase-3-seams.md — BINDING. SEAM-1, SEAM-3, SEAM-5,
     SEAM-6, SEAM-7, SEAM-8, SEAM-9 are yours.
  3. llm/governance/adr/0004-private-area-cloud-run-gate-behind-hosting.md — the gate's
     invoker is allUsers, deliberately. Do not "fix" that with Cloud Run IAM.
  4. llm/governance/adr/0007-hub-polls-content-bucket-no-satellite-github-credential.md —
     decisions 4 and 5. The satellite shape is established; you are generalising it, not
     redesigning it.
  5. llm/governance/adr/0010-withdrawal-semantics.md — decision 5 drives what the hub's
     identity needs on the private bucket, and it conflicts with a roadmap criterion. See
     OPEN QUESTIONS (a).
  6. llm/specs/2026-09-10-research-hub-design.md §6, §8, §12.
  7. llm/master-roadmap.md §phase-3-private-area
  8. infra/** as it stands — storage.tf, satellites.tf, satellite-role.tf, deploy.tf,
     wif.tf, budget.tf and README.md. Match their house style: every role justified in a
     comment, with a citation, and every deliberate omission stated.
  9. Issue #24 (`gh issue view 24`).
  10. <canon checkout>/llm/governance/definition-of-done.md §Implementation Work

REQUIRED SKILLS/WORKFLOWS: Superpowers and Constellize are not installed; do not invoke
  them. Do not invoke any /governance:* skill.

FILE CONTRACT:
  - You may create/edit ONLY:
      infra/**
      llm/sprints/2026-09-hub/handoffs/infra-phase-3.md
  - Do not modify: gate/**, site/**, contract/**, .github/** (gate.yml belongs to the gate
    stream, build.yml to the site stream), firebase.json, docs/**, CLAUDE.md, AGENTS.md,
    .claude/**, or anything in llm/ apart from your handoff. Do not touch the cv or
    phd-milestones repositories. If you find a defect in a file you don't own, REPORT it.
  - Do not edit infra/budget.tf except to add a comment. The budget and its prevent_destroy
    guard are protected by a required CI check.

DELIVERABLES:
  D1 The private bucket. uniform_bucket_level_access = true — without it every IAM condition
     in this module stops applying and the boundary fails OPEN with no error anywhere.
     public_access_prevention = "enforced", versioning on, force_destroy false, and a soft
     delete policy. It is never public, never fronted by Hosting.
  D2 The gate's runtime service account, with the MINIMUM it needs: read the private bucket,
     read and write Firestore, and verify Firebase ID tokens / mint session cookies. Name
     each role and cite why. State explicitly what you did NOT grant and why — the deploy.tf
     precedent. The gate holds no key: it runs as this identity on Cloud Run.
  D3 Cloud Run service `hub-gate` in us-east1, min-instances 0, invoker allUsers (ADR-0004 —
     authorisation is application-level and must hold on the direct *.run.app URL).
  D4 Artifact Registry for the gate image, keeping the last 5 (§8; roadmap R-A4).
  D5 Identity Platform with Google and email-link sign-in enabled (§8).
  D6 Firestore in Native mode (§8).
  D7 phd-milestones as satellite #2: ONE entry in var.satellites, no new module. Its values:
     repository djjay0131/phd-milestones, repository_id 1373915518, repository_owner_id
     5666389, default_branch **main** (note: cv is master; this is why the field is per
     entry). It gets the same three-permission custom role, the same prefix-conditioned
     binding, and the same separate satellites pool. It must hold no storage.objects.list —
     here that would let it enumerate every other source, and it is the phase where the
     reverse would expose private object names.
  D8 The bucket IAM test the roadmap requires on every deploy: it fails if the private
     bucket grants public access, or any reader other than the gate's service account. Write
     it so it can run in CI without cloud credentials where possible, or state plainly that
     it requires them and belongs in the deploy path.
  D9 infra/README.md updated: what Phase 3 adds; the manual steps in order with expected
     output; the revised cost with sources; rollback; and the Checkpoint 4 verification
     procedure, including how to prove the private bucket has exactly one reader.
  D10 Handoff at llm/sprints/2026-09-hub/handoffs/infra-phase-3.md with the standard
     sections, plus the exact resource list this apply creates and the IAM the gate stream
     should expect.

VALIDATION — run and report results verbatim:
  - From infra/: terraform fmt -check -recursive; terraform init -backend=false; validate.
    terraform is not on the WSL PATH; Phase 2 ran it via the hashicorp/terraform:1.14.0
    container with the repo mounted. Reuse that.
  - NEVER run terraform plan or apply, or any command that creates, changes or reads a
    cloud resource. There are no credentials in your environment and none may be created.

DEFINITION OF DONE: <canon checkout>/llm/governance/definition-of-done.md §Implementation
  Work, plus each roadmap Phase 3 acceptance criterion in your scope, named in the handoff
  as met locally with evidence or verifiable only at Checkpoint 4.

CONSTRAINTS:
  - Sprint scope boundary: Phase 3 only. No share infrastructure, no member-management, no
    search. Phase 4 owns shares.
  - Never grant any satellite storage.objects.list, under any role, conditioned or not. If
    you conclude the design needs it, STOP and report.
  - uniform_bucket_level_access = true on every bucket carrying a conditioned binding.
  - WIF only. A JSON key, a key file or a secret credential of any kind => STOP and report.
  - Do not weaken or remove the budget or its prevent_destroy guard.
  - Adding phd-milestones must touch satellites.tf's resource blocks NOT AT ALL. If it does,
    the Phase 2 for_each design failed and that is a finding worth reporting.
  - If a change would contradict an Accepted ADR, STOP and report.
  - Uncertain classification => semantic => human review.

OPEN QUESTIONS TO ANSWER:
  (a) **The conflict you must resolve.** The roadmap's bucket IAM test fails if the private
      bucket has "any reader other than the gate's service account". But ADR-0010 decision 5
      makes the hub's deploy identity sync dist-private DESTRUCTIVELY, which needs list and
      delete there — and list is a read. So either the hub's identity is a reader (and the
      criterion is too strict as written), or the sync cannot prune (and ADR-0010 decision 5
      is unimplementable). Recommend, with the exact grant, and say which document should
      change. Do not quietly widen the grant and leave the criterion contradicted.
  (b) Identity Platform and Firestore both have one-way or hard-to-reverse setup steps. What
      exactly cannot be Terraformed, and what does the owner have to do by hand?

ADR CANDIDATES TO IDENTIFY: the resolution to (a); Firestore location, which is permanent;
  whether the gate should have its own WIF pool as satellites do.

GIT: NEVER run git or gh mutations; read-only git and gh are allowed. The Lead Architect
  commits.

FINAL REPORT: files delivered; validation output verbatim; the resource list this apply
  creates; your answer to (a) with the recommended grant; each acceptance criterion met or
  deferred to Checkpoint 4; seam defects found; open questions.
```
