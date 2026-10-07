# Contract — Skeptic Verifier, Wave 6 (annotations)

Status: Issued
Date: 2026-10-07
Owner: Lead Architect
Issue: #107
Branch: `feat/annotations`

## Mandate

For every new guard or property claim in Wave 6, **break it, show the specific
test fail by name, restore it**. A guard that stays green when broken is
**un-failable** and is a finding. Report each break→red→restore→green cycle with
the exact command and the failing test name. Do not fix; report.

## Guards to attempt to falsify

- The gate: cross-member read refusal; owner-only `scope=all`; delete ownership
  (member-own vs owner-any); field bounds (quote/comment/tags/intent); selector
  validation; origin check on POST/DELETE; `private, no-store`; no quote/title in
  logs; `X-Frame-Options` SAMEORIGIN for `_payload/**` and DENY otherwise.
- The site: annotation leak-check needles (each needle removed → a planted leak
  stays green?); the capture island absent from `dist-public`; the routing parser
  rejecting a missing intent/`null`/bad repo; the export renderer's deep-link,
  qualified-id and `question`-skip assertions go red when the code is wrong.
- **Anchor ambiguity caution (standing ADR candidate).** When breaking a guard,
  assert the anchor string you patch occurs exactly once
  (`assert s.count(anchor) == 1`); three agents in this sprint produced a false
  "un-failable" from an ambiguous anchor.

Report as `handoffs/skeptic-verifier-wave-6.md`: one row per guard with the
verdict (`fail-able` / `un-failable` / `coverage gap`).
