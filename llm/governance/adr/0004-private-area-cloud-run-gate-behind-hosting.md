# ADR-0004: Private area via a Cloud Run gate behind Hosting rewrites

Status: Accepted
Date: 2026-09-14

## Context

The access model has three tiers — public, member, shared (design doc §7).
One domain serves both areas (§3), the public site stays static (§12.4), and
the run rate must stay within a $5 budget (§8, §12.6).

## Decision

1. **Gate.** One FastAPI service, `hub-gate`, on Cloud Run in `us-east1`
   (minimum 0 instances, design doc §6; maximum 3, orchestration brief §4
   Phase 3), reached through Firebase Hosting rewrites
   for `/p/**`, `/s/**`, `/session` and `/share/**` (§6, §8).
2. **Sessions.** Firebase Auth (Google and email-link sign-in) issues an ID
   token; `POST /session` verifies it with the Firebase Admin SDK and mints a
   14-day session cookie (`HttpOnly`, `Secure`, `SameSite=Lax`).
3. **Allowlist.** Firestore `members/{email}`; members with `role: owner` manage
   members and shares.
4. **Serving.** The gate's service account is the private bucket's only
   reader. Responses carry `Cache-Control: private, no-store`.
5. **Share links.** Random tokens in Firestore `shares/{token}`, scoped to one
   slug, expiring and revocable (Phase 4; §10 Q3 may still cut them).

## Rationale

A small, testable service scales to zero and costs nothing at rest. It keeps
the public path static while one domain serves both areas, and it supports all
three tiers, including anonymous per-link sharing.

## Alternatives Considered

### Identity-Aware Proxy (IAP)

No authentication code to own. IAP can be enabled directly on a Cloud Run
service with no load balancer to provision (Google Cloud, "Configure IAP for
Cloud Run"), so cost is not the reason to reject it; only the older
load-balancer setup carries a standing forwarding-rule charge (about $18 a
month, over the $5 budget). It is rejected because it admits only
authenticated principals, so it cannot provide §7's Shared tier: an anonymous,
expiring, single-document link. Whether an IAP-protected service can sit
behind a Firebase Hosting rewrite is unverified.

### Allowlist only, without share links

A smaller gate and a smaller attack surface. But it drops the mission's
"private items can be shared with specific people" for anyone without an
account. §10 Q3 keeps this alternative open for the owner.

## Consequences

### Positive

- Near-zero cost at rest; one domain; the public site stays static.
- The security-critical code is small enough to read in one sitting and has a
  required test list (§6).

### Negative / Tradeoffs

- The owner maintains authentication code: session minting, path-traversal
  rejection, token handling.
- A cold start of about one second on first request.

### Risks

- **Firebase Hosting forwards only the cookie named `__session`** to a Cloud Run
  rewrite and strips all others (Firebase, "Manage cache behavior"). The gate's
  session cookie must use that name, or sessions silently fail behind Hosting
  while working when the service is called directly. This is a binding
  constraint on Phase 3.
- **The invoker is `allUsers`** because authentication is at the application
  level (§8), so the service's `*.run.app` URL is reachable without going
  through Hosting. Every check must hold on direct requests; nothing may rely on
  a header or path shape that only Hosting adds.
- **CDN caching of private responses.** Firebase Hosting marks dynamic
  (rewrite) responses `Cache-Control: private` by default and varies on
  `Cookie` and `Authorization` (Firebase, "Manage cache behavior"), so the CDN
  caches a gate response only if the gate itself sends `public` or `s-maxage`.
  The risk is a framework or file-serving default that does. Every `/p/**` and
  `/s/**` response sets `Cache-Control: private, no-store` (§6), and a test
  asserts that none carries `public` or `s-maxage`; a regression leaks private
  content to other visitors.

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
- [ ] Documentation

## Related Documents

- `llm/specs/2026-09-10-research-hub-design.md` §3, §6, §7, §8, §10 (Q3, Q4), §12.4, §12.6
- `llm/plans/2026-09-10-research-hub-orchestration-brief.md` §4 Phase 3 (instance limit)

## Related Issues / PRs

- #7 — hub-000: Adopt agentic-governance and record hub design
- PR #9 — Phase 0; merging it accepts this ADR

## Supersedes

None.

## Superseded By

None.
