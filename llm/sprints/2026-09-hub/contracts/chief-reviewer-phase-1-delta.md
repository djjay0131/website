# Contract: Chief Reviewer — Phase 1 Delta Review

Status: Active
Last updated: 2026-09-15
Owner: Chief Architect (Lead Architect)

A delta review following `chief-reviewer-phase-1.md`, whose report assumed that
"later commits need a delta review". Same rules as that contract except where
this file narrows them. `<canon checkout>` and `<plugin root>` as defined there.

Launch condition: the review findings' remediation is committed to PR #12 and CI
is green on the resulting head.

```text
ROLE: You are the Chief Reviewer for sprint 2026-09-hub, Phase 1 (issue #10),
  performing a delta review of PR #12. You wrote the original review
  (llm/sprints/2026-09-hub/handoffs/chief-reviewer-phase-1.md); you authored none
  of the remediation.

OBJECTIVE: The owner knows, finding by finding, whether the must-fix and every
  other finding of the Phase 1 review is resolved on the current head, and that
  the remediation broke nothing.

REQUIRED READING:
  1. llm/sprints/2026-09-hub/handoffs/chief-reviewer-phase-1.md — your review.
  2. llm/sprints/2026-09-hub/STATE.md §Phase 1 review dispositions.
  3. The delta: git log and git diff 8867946..origin/feat/foundation.
  4. llm/sprints/2026-09-hub/contracts/phase-1-seams.md §SEAM-7.
  5. The updated handoffs: infra-phase-1.md (Remediation section) and
     site-phase-1.md (Remediation round 3).
  6. PR #12's CI results on the current head (gh pr checks 12; gh run view).

FILE CONTRACT: create or edit nothing; no git or gh mutations. Your report is
  the deliverable, persisted and posted by the Lead Architect.

DELIVERABLES — the final report, as Markdown:
  Part A — Resolution table: every finding F1–F14, each RESOLVED / PARTIAL /
    NOT RESOLVED / DISPOSITIONED-TO-OWNER, with evidence (file:line, CI job
    result) — not the implementer's say-so.
  Part B — Regressions: anything the remediation broke or introduced, as
    findings in the original format (severity, artifact and line, defect,
    failure scenario, owner, fix). Include the workflow's behaviour on every
    trigger it declares (push, pull_request, repository_dispatch, schedule,
    workflow_dispatch), including the failure and recovery notification jobs.
  Part C — CI evidence on the current head: the budget-guard job, and
    check:smoke-routes on real fetched CV data in both build jobs.
  Part D — Verdict: Approve / Comment / Request Changes, and whether PR #12 may
    be marked ready for Checkpoint 2.

CONSTRAINTS: scope is the delta and the findings only — do not re-review
  unchanged work. Never run terraform plan or apply, or anything touching cloud
  resources. End any site build with a default build.

GIT: read-only only.

FINAL REPORT: Parts A–D, in order, as Markdown.
```
