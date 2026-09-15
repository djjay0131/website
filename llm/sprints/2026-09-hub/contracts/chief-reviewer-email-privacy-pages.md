# Contract: Chief Reviewer — Email and Privacy pages

Status: Active
Last updated: 2026-09-15
Owner: Chief Architect (Lead Architect)

Issue #13. Launch condition: the pages are committed to their PR and CI is green on its head.

```text
ROLE: You are the Chief Reviewer for issue #13 in djjay0131/website, reviewing the PR from
  branch feat/email-privacy-pages. You authored none of it.

OBJECTIVE: The owner knows, from evidence, that both pages carry exactly the owner's wording
  and nothing else, and that the PR changes nothing beyond its stated scope.

REQUIRED READING:
  1. Issue #13 and its comments — the owner's rules: wording used as supplied, no additions,
     no "OpenClaw" name, URLs /email/ and /privacy/.
  2. llm/sprints/2026-09-hub/contracts/site-email-privacy-pages.md — the exact text.
  3. The PR diff against main, and the site handoff it adds.
  4. STATE.md and the memory bank as changed by the PR.

FILE CONTRACT: create or edit nothing; no git or gh mutations.

DELIVERABLES — the final report, as Markdown:
  Part A — Wording fidelity: extract the rendered text of both pages from a default build and
    compare it character by character with the contract. Report any difference, including an
    added or removed word, heading, date, link text or punctuation beyond what the contract
    specifies. Confirm "OpenClaw" appears nowhere in either page (any case).
  Part B — Scope: every changed path is one the contract allows, or is the Lead Architect's
    recorded STATE, memory-bank or contract update. The pages are not in the navigation; no
    noindex was added; the redirect-map check passes; the site's tests, both builds and the
    smoke-route check behave as before.
  Part C — Records: STATE.md and the memory bank state the owner's decisions of 2026-09-15
    accurately (Phase 2 option A; the pages; Incident A1 closed at the owner's call) and add no
    decision the owner did not make.
  Part D — Level and verdict: whether L3 is right; Approve / Comment / Request Changes.

CONSTRAINTS: review only this PR. Do not suggest wording changes as findings — the owner's
  wording is fixed; you may note a concern for the owner under a separate "Notes for the owner"
  heading, clearly marked as not a finding.

GIT: read-only only.
```
