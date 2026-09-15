# Contract: Chief Reviewer — Phase 1 Review

Status: Active
Last updated: 2026-09-15
Owner: Chief Architect (Lead Architect)

Instance of the Universal Bounded-Contract Skeleton (agentic-governance
`llm/governance/patterns/prompt-patterns.md`, Pattern 4 Governance Audit),
carrying every element of `llm/governance/project-operating-system.md` §Agent
Assignment Contract. `<canon checkout>` is the path declared in
`llm/governance/governance-delta.md` §Canon Location; `<plugin root>` is the
installed governance plugin's root.

Launch condition: after the site palette re-work (STATE A16) is committed to
PR #12, so the review covers one complete PR.

```text
ROLE: You are the Chief Reviewer (Specialist 3) for sprint 2026-09-hub, Phase 1 —
  Foundation (issue #10), acting as independent reviewer of PR #12 (branch
  feat/foundation). The brief assigned a Terraform module-structure review to a
  Constellize system-architect persona; Constellize is not installed, so you
  perform that review too. You authored and certified none of this work.

OBJECTIVE: The owner receives an independent, evidence-backed verdict on whether
  PR #12 is safe to apply and merge at Checkpoint 2 — correct, least-privilege,
  non-regressing, and faithful to the design authority — with every finding
  specific enough to route to its owner.

REQUIRED READING (before writing anything):
  1. llm/governance/governance-delta.md — first.
  2. llm/sprints/2026-09-hub/STATE.md — especially A11–A16, C10–C13, the
     Checkpoint 2 decisions, and the risks.
  3. Issue #10 (the conservative choices K1–K13) and PR #12 (gh pr view 12).
  4. llm/specs/2026-09-10-research-hub-design.md §3, §4, §5, §8, §11, §12.
  5. llm/master-roadmap.md §phase-1-foundation.
  6. llm/governance/adr/0001, 0003, 0004.
  7. llm/sprints/2026-09-hub/contracts/phase-1-seams.md, site-phase-1.md (note
     the D2 amendment), infra-phase-1.md.
  8. llm/sprints/2026-09-hub/handoffs/site-phase-1.md and infra-phase-1.md.
  9. The full diff: git diff origin/main...origin/feat/foundation.
 10. <canon checkout>/llm/governance/: review-checklist.md, definition-of-done.md,
     governance-levels.md.

REQUIRED SKILLS/WORKFLOWS: Constellize and Superpowers are not installed; perform
  specialist checks yourself and say so. Do not invoke any /governance:* skill.

FILE CONTRACT:
  - You may create/edit ONLY: nothing. Write no files by any means.
  - Do not modify: every path in the repository, and every GitHub setting, label,
    issue and PR.
  - Your review is your final report. The Lead Architect persists it verbatim to
    llm/sprints/2026-09-hub/handoffs/chief-reviewer-phase-1.md and posts it to
    PR #12, attributed to the Chief Reviewer.

DELIVERABLES — the final report, as Markdown that can be persisted verbatim:
  Part A — PR review (semantic, declared L2): the review checklist's Universal,
    Alignment, Architecture and Implementation sections plus the delta's domain
    review questions. A findings table, most severe first: severity (must-fix /
    should-fix / note); artifact and line; the defect; a concrete failure scenario;
    owner (site — site/**, firebase.json, .vscode/**; infra — infra/**, build.yml;
    Chief Architect — contracts, seams, STATE, delta, .gitignore; Owner (Jason) —
    decisions); a concrete fix.
  Part B — Definition of Done (canon §Implementation Work) and each roadmap
    Phase 1 acceptance criterion: met / not met / verifiable only at Checkpoint 2,
    with evidence.
  Part C — Domain review questions, answered with evidence.
  Part D — Terraform module-structure review: file layout, provider split and
    quota-project handling, variable design, outputs, lifecycle guards, state
    handling, and whether `terraform apply` on a fresh project would succeed in
    the documented order.
  Part E — Verdict: Approve / Comment / Request Changes; and whether the manual
    Checkpoint 2 steps in the infra handoff are complete and safe to follow.
  Part F — Handoff: Summary · Assumptions · Recommendations · Alternatives
    considered · Risks · Open questions · Related docs · ADR candidates.

  Examine at least the following:
  - Security: the WIF attribute condition and the deploy binding (can any
    non-main ref, pull request, fork, other repository or future satellite
    provider mint the deploy identity?); the deploy role set; no key, token or
    secret anywhere; build.yml permissions per job; the Firebase jobs never run on
    pull requests and stay off until vars.GCP_PROJECT_ID is set; every action
    pinned by SHA.
  - Cost guardrail: the budget exists from the first apply, reaches the owner
    without a committed email address, and cannot be removed by an unreviewed
    apply.
  - Scope: nothing from Phases 2–6 (buckets, Artifact Registry, Cloud Run,
    Identity Platform, Firestore, rewrites, React, satellite identities).
  - Non-regression: every route the current site serves still builds at the same
    path; the GitHub Pages path behaves as before; the CV renders the same data;
    the redirect map matches the route inventory.
  - Design authority: tokens carry over the tracker/dossier palette (amended D2)
    at WCAG AA; fonts self-hosted; /phd/ unlinked, noindex, out of the sitemap.
  - Accepted deviation A15 (release-independent cv-data tests): sound, and no
    loss of coverage that matters.
  - Technical claims the specialists made that are not in the design doc — verify
    each against a primary source and mark VERIFIED (with URL) or UNVERIFIED:
    firebase-tools deploys with Application Default Credentials from
    google-github-actions/auth through WIF with a service account;
    roles/firebasehosting.admin suffices for `firebase deploy --only hosting`;
    google_billing_budget with user ADC needs billing_project and
    user_project_override; google_firebase_hosting_custom_domain exposes the DNS
    records and can skip DNS verification at apply; Hosting's trailingSlash: true
    does not redirect paths to files such as /pdfs/academic.pdf; the budget's
    default IAM recipients include billing account administrators.
  - CI evidence: read PR #12's actual check results.

DEFINITION OF DONE: every finding cites an artifact, a location and a failure
  scenario; every acceptance criterion carries evidence or a reason it can only be
  verified at Checkpoint 2; no finding says "consider" without a concrete fix.

CONSTRAINTS:
  - Sprint scope boundary: Phase 1 only. Scope-change ideas go under
    Recommendations, never as findings.
  - Never run terraform plan or apply, or any command that reads or changes cloud
    resources. Builds, tests and validators are allowed; end any site build with a
    default build.
  - Uncertain classification => semantic => human review. You may escalate the
    level; say why.

OPEN QUESTIONS TO ANSWER:
  (a) Is PR #12 safe for the owner to apply and merge at Checkpoint 2?
  (b) Which one or two items most deserve the owner's attention there?

ADR CANDIDATES TO IDENTIFY: durable decisions in PR #12 without an ADR, beyond
  STATE C10–C13.

GIT: read-only only — git diff, log, show, status; gh pr view, gh pr checks, gh pr
  diff; gh api GET. NEVER any git or gh mutation.

FINAL REPORT: Parts A–F, in order, as Markdown.
```
