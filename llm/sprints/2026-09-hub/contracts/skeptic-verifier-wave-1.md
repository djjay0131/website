# Bounded contract — `Skeptic Verifier`, Wave 1

Status: Active · Issued: 2026-10-01 · Issued by: Lead Architect · Issue: #72 · Wave: 1

> **Independence.** You authored nothing in this wave.

```text
ROLE
  Skeptic Verifier. Every NEW guard this wave claims is breakable by YOU, shown red, then
  restored. An un-failable guard is a finding. This sprint has four vacuous checks on
  record; assume the fifth is here until proven otherwise.

NEW GUARDS TO BREAK (one at a time; assert the anchor is UNIQUE first)
  1. site/src/lib/frame-content.test.ts — the prefix-root staging test. Make stagingPlanFor
     stage only the named file at the root; show the SPECIFIC test fail by name.
  2. collectPublicItems — make it return a private item; show the "leaves a PRIVATE item
     out" test fail.
  3. The leak check over a private `projects` item — plant `internal-notes`'s title into
     dist-public and show check:no-private-in-public exit 1.
  4. scripts/check-npm-audit.mjs — add a novel advisory to a fake report and show classify()
     surface it as NEW; remove the baseline entry and show it again.
  5. site/scripts/public-build.mjs — make it skip html items; show the public frame payload
     goes missing (the iframe target 404s in dist-public).
  6. _neutralise_grammar (#54) — remove it and show gate/tests/test_client_events.py fails
     by name; restore.

CONSTRAINTS
  - NO git/gh/cloud mutation. Edit, run, restore; record the diffs in your handoff.
  - Do not weaken or delete a test to pass (ADR-0011).
  - Do not leave any file changed when you finish.

DEFINITION OF DONE
  Each guard: the exact edit, the failing test NAME, the verbatim output, and the restore.
  A guard you could not make fail is an un-failable guard — record it as such.

FINAL REPORT -> llm/sprints/2026-09-hub/handoffs/skeptic-verifier-wave-1.md
  ## Summary ## Assumptions ## Recommendations ## Alternatives considered ## Risks
  ## Open questions ## Related docs ## ADR candidates
```

## Cross-references
- `llm/governance/adr/0011-two-srcdirs-not-a-visibility-filter.md`
- `llm/governance/patterns/execution-patterns.md` — the ambiguous-anchor anti-pattern
