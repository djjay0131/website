# ADR-0013: The gate exposes an unauthenticated client-telemetry endpoint

Status: Accepted
Date: 2026-09-19

## Context

Sign-in failures happen **in the browser, before any session exists**. Until 2026-09-18 they
were invisible: the owner reported that sign-in "does not work" and the only diagnostic
available was asking him to describe what he saw. The observability work added
`POST /client-events` so the sign-in page could report its own failures — a classified failure
class, a correlation id, and nothing else.

It was added without an ADR. The Wave 0 Security Tester made that check 7's **FAIL**: it is an
unauthenticated Cloud Run rewrite appearing in neither the design doc's §8 rewrite list nor the
orchestration contract's, with no decision authorising it. Design doc §12.4 constrains what may
sit on the public path, and a route nobody decided on is not covered by anything.

This ADR records the decision that was made implicitly, so it can be reviewed rather than
merely inherited.

## Decision

1. **`POST /client-events` is unauthenticated, deliberately, and stays so.** Authenticating it
   would defeat its only purpose: it exists to receive a report from a browser that has
   **failed** to obtain a session. A telemetry endpoint that requires the credential whose
   absence it reports is a contradiction.

2. **It is added to the design doc §8 rewrite list**, which currently names only `/p/**`,
   `/s/**`, `/session` and `/share/**`. The list is meant to be exhaustive; it was not.

3. **Its bounds are part of the decision, not implementation detail:** a 4 KB payload cap, at
   most 20 events per batch, a closed allowlist of permitted field names, and
   `_clean_client_value()` stripping non-printable characters so no caller can forge a
   *separate* log line.

4. **Client-supplied values may not contain the gate's own `event=` grammar** (issue #54). The
   log-based metrics match a substring of `textPayload` anywhere in the line, so without this
   an anonymous caller can place a metric's trigger inside an ordinary field value and make it
   count. This is the one bound that was missing and is being added.

5. **Rejected reports are counted and emitted under a distinct event class, never silently
   dropped.** A report discarded because it looked suspicious is the same blindness the
   endpoint exists to end, wearing a different costume.

## Rationale

The alternative to this endpoint is not "a safer endpoint". It is **no browser-side visibility
at all**, which is the state that let the gate's logging defect run for 48 hours across four
revisions while every test passed — because the tests supplied the handler production lacked
and uvicorn's own access lines made it look as though logging worked.

The endpoint's blast radius is bounded by what it can do: it writes a size-capped, field-capped,
character-scrubbed line to a log. It reads nothing, mints nothing, and touches no bucket and no
Firestore document.

## Alternatives Considered

### Authenticate it

Rejected as self-defeating, per decision 1. There is no credential available to a browser that
has just failed to sign in.

### Drop the endpoint and diagnose from server-side logs only

The gate already logs its own decisions, so a *refused* sign-in is visible. But the failures
that actually needed diagnosing were **client-side**: a provider not configured, an expired
link, a wrong-email mismatch. None of them reaches the gate at all. Server logs cannot record
an event that never arrived.

### Rate-limit or CAPTCHA it

Rejected for now, and worth revisiting. Cloud Run scales to zero and the endpoint writes only
log lines, so the cost of abuse is bounded by the $5 budget alert rather than unbounded. A rate
limit adds state to a service deliberately kept stateless. If forgery volume ever becomes a
problem in practice rather than in principle, this is the first thing to add.

### Sign the payload from the page

The signing key would be in client JavaScript, so it authenticates nothing. Recorded because it
looks like a solution.

## Consequences

### Positive

- Browser-side sign-in failures are visible at all, which they were not before.
- The endpoint's bounds are now written down and reviewable rather than implicit in code.
- Decision 4 closes a live forgery path found by the Red Team in production.

### Negative / Tradeoffs

- An unauthenticated write path on the public domain exists. It is the only one.
- Anyone can add noise to the gate's logs, within the size and field caps. Log volume counts
  against the Cloud Logging free tier, so sustained abuse has a cost — bounded by the budget
  alert, but not zero.

### Risks

- **Metric integrity was the real exposure, not confidentiality.** Before decision 4, an
  anonymous caller could inflate either log-based metric — training the owner to ignore alerts,
  or masking a real event in the noise. That the alert channel is *also* currently unverified
  (so all three policies deliver nothing) means this went unnoticed; fixing delivery without
  decision 4 would have turned a silent alerting path into a forgeable one.
- **The allowlist is the boundary.** If a future field is added to the permitted set without
  the same scrubbing and the same `event=` rejection, this reopens. The allowlist is the place
  to look when it does.

## Impacted Areas

- [ ] Product
- [ ] Domain model
- [ ] Data architecture
- [ ] AI architecture
- [ ] Domain-specific systems (see governance delta)
- [ ] Integrations
- [ ] UX
- [x] Security/privacy
- [x] Implementation
- [x] Documentation

## Related Documents

- `llm/specs/2026-09-10-research-hub-design.md` §8 (the rewrite list this amends), §12.4
- `llm/governance/adr/0004-private-area-cloud-run-gate-behind-hosting.md` — the gate and its
  `allUsers` invoker
- `llm/sprints/2026-09-hub/STATE.md` — §The gate's structured logging never worked in
  production (why the endpoint exists); §Wave 0 dispositions A-1 (the forgery)
- `llm/sprints/2026-09-hub/handoffs/security-wave-0.md` — check 7
- `llm/sprints/2026-09-hub/handoffs/red-team-wave-0.md` — target #4

## Related Issues / PRs

- #54 — metric forgery, which decision 4 closes
- #44 — hub-007: Wave 0

## Supersedes

None.

## Superseded By

None.
