# Contract — Chief Reviewer, Wave 0c (branding)

Status: Issued
Date: 2026-10-02
Stream: Chief Reviewer (authors nothing in the wave it reviews)
Branch: `feat/branding` (PR #91)
Handoff: `llm/sprints/2026-09-hub/handoffs/chief-reviewer-wave-0c.md`

## Purpose

Review PR #91 against the branding spec, ADR-0015 and the site contract. Author
nothing; your only write is your handoff. Verdict Approve / Comment / Request
changes.

## Read

- `llm/specs/2026-10-01-branding-design.md` (design authority), ADR-0015
- `llm/sprints/2026-09-hub/contracts/site-wave-0c.md`; `handoffs/site-wave-0c.md`
- the a11y/adversarial handoffs for this wave
- `git diff main...feat/branding`

## Questions

1. Does the implementation satisfy spec §2–§11 and ADR-0015? Name any unmet
   requirement.
2. Is the shared chrome (SiteBand/SiteFooter) truly shared and navigation-free,
   and does `private-structure.test.ts` remain a structural guarantee?
3. Are the token changes correct: band tokens theme-invariant and pinned by name,
   `--tracker-petrol` removed, the carve-out widened not loosened?
4. Is the `--vt-orange-text` #c34600 departure from #c64600 sound, and is the
   spec amendment honest?
5. Is the portrait fully gone from the public output while the CV PDFs keep it?
6. Is `research-portfolio.json` consistent with D15, and is any owner-drafted
   wording presented as fact without a flag where it should be flagged?
7. Any must-fix / should-fix / note. Confirm the governance level (expect L2).

## Exit

Verdict with findings classified Fix now / Fix later / Note, each citing file:line
or a test. No source edits.
