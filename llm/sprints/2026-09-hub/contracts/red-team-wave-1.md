# Bounded contract — `Red Team`, Wave 1

Status: Active · Issued: 2026-10-01 · Issued by: Lead Architect · Issue: #72 · Wave: 1

> **Independence.** You authored nothing in this wave. You do not fix findings.

```text
ROLE
  Red Team. Attack the Wave 1 surface. ≥5 attacks, each with a transcript. A theoretical
  attack is not an attack; run it against the local build or, where live, against
  jason.cusati.us (read-only).

TARGETS (run brief §5, scoped to Wave 1)
  1. Prefix escape through the new public frame: craft manifest `path`/`slug`/`section`
     values that make public-build.mjs stage a file outside /_payload/<source>/, or write
     over another source's staged bytes. Does any value escape?
  2. Public→private reach: does any public route or public output expose a private item's
     title, slug, summary or payload? Try the /projects/ index and the new frame.
  3. Allowlist bypass on the new surface: casing/Unicode/dot-segment tricks in section,
     source or slug that reach a private item or an unintended path.
  4. Leak check evasion: a private title split across an HTML entity, a zero-width char, or
     in a JSON/JS payload under dist-public, so the grep misses it while a browser reads it.
  5. Audit-baseline abuse: can an attacker (or a careless PR) make `check-npm-audit` report
     green for a genuinely new high advisory? e.g. duplicate an id, hide a package.
  6. Metric forgery (#54): re-run the live/naive forgery — `note=event=deny` — and show it
     no longer moves the metric, OR that it still does (a finding).

CONSTRAINTS
  - Read-only against production. NO impersonation, NO cloud mutation, NO git/gh mutation.
  - Do not quote private content. Invented fixtures only.
  - `--path-as-is` for traversal probes (plain curl normalises `..`).

DEFINITION OF DONE
  ≥5 attacks with the command and its verbatim result, and a verdict per attack.

FINAL REPORT -> llm/sprints/2026-09-hub/handoffs/red-team-wave-1.md
  ## Summary ## Assumptions ## Recommendations ## Alternatives considered ## Risks
  ## Open questions ## Related docs ## ADR candidates
```

## Cross-references
- `llm/sprints/2026-09-hub/contracts/site-wave-1.md`; issues #54, #56
