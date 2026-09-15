# Contract: Chief Reviewer — Phase 1 Delta Review 2 (ADR-0006 domain amendment)

Status: Active
Last updated: 2026-09-15
Owner: Chief Architect (Lead Architect)

A second delta review of PR #12, following `chief-reviewer-phase-1-delta.md`. Same rules
as `chief-reviewer-phase-1.md` except where this file narrows them. `<canon checkout>`
and `<plugin root>` are as defined there.

Launch condition: the ADR-0006 amendment is committed to PR #12 (Lead Architect records,
roadmap, infra, site), and CI is green on the resulting head.

```text
ROLE: You are the Chief Reviewer for sprint 2026-09-hub, Phase 1 (issue #10), performing
  a second delta review of PR #12. You authored none of the amendment.

OBJECTIVE: The owner knows, from evidence, that ADR-0006 is implemented correctly and
  completely — the hub binds jason.cusati.us, research.cusati.us redirects to it, and
  nothing touches the cusati.us apex, www or its mail records — and that the amendment
  broke nothing that the earlier reviews verified.

REQUIRED READING:
  1. llm/governance/adr/0006-hub-on-jason-cusati-us-subdomain.md, and ADR-0001 as
     annotated.
  2. llm/sprints/2026-09-hub/STATE.md — the ADR-0006 decision, A17, A18, risks 12–13.
  3. The delta: git log and git diff 7afe938..origin/feat/foundation. Note that 20e9f41
     is incomplete on its own and 46136e5 completes it; STATE records the correction.
  4. llm/sprints/2026-09-hub/contracts/phase-1-seams.md (SEAM-1 default) and
     contracts/infra-phase-1.md (amendment note).
  5. The updated infra and site handoffs (their ADR-0006 remediation sections) and
     llm/master-roadmap.md §phase-1-foundation.
  6. Your earlier reports: handoffs/chief-reviewer-phase-1.md and
     chief-reviewer-phase-1-delta.md.
  7. PR #12's CI results on the current head.

FILE CONTRACT: create or edit nothing; no git or gh mutations. Your report is the
  deliverable, persisted and posted by the Lead Architect.

DELIVERABLES — the final report, as Markdown:
  Part A — ADR-0006 conformance, decision by decision, with evidence (file:line, command
    output, CI result):
    - the canonical host everywhere a current-facing artifact names the hub's host
      (Terraform default, the site's default SITE_URL, sitemap and canonical links in a
      default build, READMEs, handoffs' current-facing steps, roadmap, seams);
    - research.cusati.us connected as a redirect custom domain targeting the canonical
      host;
    - outputs a person can use at the DNS step for both hostnames;
    - manual DNS and verification steps that add records only for the two hub hostnames
      and never change the apex, www, MX or existing TXT records;
    - SITE_URL ordering, and research.cusati.us's 301 in first-deploy verification.
    Dated records (review reports, Phase 0 contracts and handoffs) keep their original
    references by design (STATE A18); do not report those.
  Part B — Regressions: anything the amendment broke or left inconsistent, in the
    original findings format (severity, artifact and line, defect, failure scenario,
    owner, fix). Include the site's route inventory, redirect map and tests;
    terraform fmt / validate; actionlint; and the governance checks.
  Part C — Technical claims introduced by the amendment, each VERIFIED (with URL) or
    UNVERIFIED: that google_firebase_hosting_custom_domain's redirect_target answers
    with a 301 to the target; that Hosting provisions a certificate for a redirect
    domain; that an unconnected hostname merely CNAMEd to a connected one fails TLS;
    and that any cross-variable validation used in variables.tf is supported by
    Terraform 1.14.
  Part D — Governance level: PR #12 now changes roadmap requirement text. Say whether it
    must be declared L3, and why.
  Part E — Verdict: Approve / Comment / Request Changes, and whether PR #12 may return
    to ready for Checkpoint 2.

CONSTRAINTS: scope is the amendment only — do not re-review unchanged work. Never run
  terraform plan or apply, or anything touching cloud resources. End any site build with
  a default build.

GIT: read-only only.

FINAL REPORT: Parts A–E, in order, as Markdown.
```
