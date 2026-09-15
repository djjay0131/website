# ADR-0003: Keep Astro, with React islands for interactive widgets

Status: Accepted
Date: 2026-09-14

## Context

`website` is already Astro (v6). The hub renders documents from a typed
manifest with occasional interactive widgets — the first planned one is the
Shares page (Phase 4). It will be maintained by one person after 2027.

## Decision

Keep Astro. Use content collections to turn the manifest contract into a
validated schema, and React islands for interactive widgets. Ship zero
JavaScript by default and produce static output (design doc §5). React is
added as a dependency when the first island is built, not before.

## Rationale

Content collections map directly onto the publishing contract (ADR-0002);
islands allow widgets in React, which the owner knows; static output cannot
break at request time, which is both a maintenance property and principle 4
(§12.4); and it is the current stack, so the decision is to keep it rather
than to adopt it.

## Alternatives Considered

### Next.js

The right choice if the hub becomes an application. It will not (§1: "It is
not … an application"). It brings a server runtime the public path must not
have.

### Hugo

Fast and static, but no component model for widgets.

### Vue / Nuxt

A learning curve with no gain over the current stack.

### Eleventy

Untyped collections: the manifest contract could not be enforced at build.

### FastAPI + Jinja for the public site

Runtime rendering on the public path, which violates §12.4. FastAPI is the
gate only (ADR-0004).

## Consequences

### Positive

- No framework migration.
- Typed collections enforce the contract at build.
- Static output cannot fail at request time.

### Negative / Tradeoffs

- Astro major-version upgrades are the standing maintenance cost.
- The two-output build (ADR-0005) doubles build time.
- React enters the dependency tree in Phase 4.

### Risks

- An island that fetches private data at runtime would reintroduce execution on
  the public path. This ADR therefore adds a constraint the design doc does not
  state, derived from §12.4: islands in the public build may call only the
  gate, and only for the member or share tiers. It is an ADR candidate in its
  own right (what public-build islands may call at runtime).

## Impacted Areas

- [ ] Product
- [ ] Domain model
- [ ] Data architecture
- [ ] AI architecture
- [ ] Domain-specific systems (see governance delta)
- [ ] Integrations
- [x] UX
- [ ] Security/privacy
- [x] Implementation
- [ ] Documentation

## Related Documents

- `llm/specs/2026-09-10-research-hub-design.md` §1, §4, §5, §12.4

## Related Issues / PRs

- #7 — hub-000: Adopt agentic-governance and record hub design
- PR #9 — Phase 0; merging it accepts this ADR

## Supersedes

None.

## Superseded By

None.
