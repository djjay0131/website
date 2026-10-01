# Bounded contract — `Regression Tester`, Wave 1

Status: Active · Issued: 2026-10-01 · Issued by: Lead Architect · Issue: #72 · Wave: 1

> **Independence.** You authored nothing in this wave.

```text
ROLE
  Regression Tester. Prove Wave 1 did not break what already worked. Read-only.

WHAT TO CHECK
  1. Both builds still produce the same public routes they did before: run
     content:fixture + build:public and build:private; compare the page set against the
     pre-wave expectations (27 public pages incl. /projects/kgis/kgis-docs/, 4 private incl.
     the new private projects item). List any route added or removed.
  2. The private frame and payload URLs still carry /p/ (issue #27): check:private-links.
  3. The CV pages, /resumes/, /pdfs/ still resolve: check:smoke-routes.
  4. The private-structure import-direction test still holds.
  5. The gate suite is unchanged and green.
  6. No tracked file lost or gained its executable bit: `git ls-files -s | grep 100755`
     before/after (never trust `ls -l` on this mount).

CONSTRAINTS
  - NO git/gh/cloud mutation. Builds/tests only.
  - Report deltas, not "all green": a route that silently vanished is the finding.

DEFINITION OF DONE
  A delta table: artifact | before | after | verdict. Explicit "no regressions" only with
  the before/after evidence.

FINAL REPORT -> llm/sprints/2026-09-hub/handoffs/regression-tester-wave-1.md
  ## Summary ## Assumptions ## Recommendations ## Alternatives considered ## Risks
  ## Open questions ## Related docs ## ADR candidates
```

## Cross-references
- `llm/sprints/2026-09-hub/contracts/site-wave-1.md`
