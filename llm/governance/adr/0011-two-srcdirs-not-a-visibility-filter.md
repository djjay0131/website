# ADR-0011: The private build is a second `srcDir`, not a visibility filter

Status: Accepted
Date: 2026-09-17

## Context

Design doc §5 requirement 4 specifies the two-output build as "`HUB_OUTPUT=public|private`
that **filters collections by visibility**, run twice in CI". ADR-0005 accepted that shape.

Phase 3 implemented something different and stronger. `site/astro.config.mjs` sets
`srcDir: isPrivate ? './src-private' : './src'`. Astro routes exactly one directory —
`<srcDir>/pages` — so the public build is never shown the private pages at all.

The site stream's contract asked for "a structural guarantee, not a convention", and this is
the answer it arrived at. The Chief Reviewer's Phase 3 report raised the gap as BLOCKING
B-2: the decision is durable, it departs from the letter of a rank-2 document, and it lived
only in a config comment and a test file.

## Decision

1. **The private build uses its own `srcDir` (`site/src-private`).** The public build never
   resolves a private route, because the router is never given the files.

2. **This supersedes §5 requirement 4's "filters collections by visibility" wording**, which
   is hereby amended. The `HUB_OUTPUT=public|private` variable and the two-runs-in-CI shape
   are unchanged; only the mechanism is.

3. **The structure is pinned by tests, in two halves.** `site/scripts/private-structure.test.ts`
   asserts the arrangement *and* the module graph: no file the public build compiles may
   import `src-private/`, `private-content`, `private-build` or `PrivateBase`.

## Rationale

A filter is a convention. Every future page that lists content must remember to apply it, and
the failure mode of forgetting is a private title on a public page — a leak with no matching
path, which is the class ADR-0005 exists to catch. A separate `srcDir` is a property of the
router: there is no filter to forget, because there is nothing to filter.

The module-graph half is the part a filter could never provide. A filter operates on
collection entries at render time; it says nothing about a public page that `import`s a
private helper and pulls private titles in through the module graph rather than through the
router. Decision 3's second assertion closes that path, and it has no equivalent in the
filter design.

The implementation is better than the specification. The reason this ADR exists is not to
change it but to record it, so that a future contributor "simplifying" toward the design
document's literal wording understands they would be demolishing a guarantee rather than
tidying an implementation detail.

## Alternatives Considered

### Filter collections by visibility, as §5 requirement 4 specifies

The specified design, and simpler: one source tree, one `pages` directory.

Rejected. It makes the guarantee a convention enforced by every author of every future page,
and it cannot close the module-graph path at all. The failure is silent and lands on private
material.

### Keep the implementation and amend §5 without an ADR

Cheaper by one file.

Rejected. The reasoning — why structure beats filtering, and what the module-graph half buys
— is the part worth keeping, and a design-document edit has nowhere to put it. An ADR is the
right home; §5 now points here.

### Two separate Astro projects

Total isolation, at the cost of duplicating layouts, styles and config.

Rejected. The two outputs deliberately share a design system and a content pipeline. The
`srcDir` split already achieves router isolation without duplicating everything upstream of it.

## Consequences

### Positive

- A public page cannot render a private item by construction, not by discipline.
- The module-graph path is closed, which a visibility filter could not do.
- The decision is now discoverable from the ADR index rather than from a config comment.

### Negative / Tradeoffs

- Two `pages` trees mean genuinely shared routes would have to be duplicated or factored into
  a shared module. Today nothing is shared, and the private area is deliberately small.
- A contributor expecting the design document's filter will be briefly surprised. That is
  what this ADR is for.

### Risks

- **The tests are the enforcement.** If `private-structure.test.ts` is deleted to make a
  change pass, the guarantee goes with it silently. The test's own header says so; this ADR
  is the second copy of that warning, in a place the test cannot delete.

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

- `llm/governance/adr/0005-two-output-build-with-leak-check.md` — the two-output build this refines
- `llm/specs/2026-09-10-research-hub-design.md` §5 requirement 4 — amended by decision 2
- `llm/sprints/2026-09-hub/contracts/phase-3-seams.md` — SEAM-4
- `llm/sprints/2026-09-hub/handoffs/chief-reviewer-phase-3.md` — finding B-2

## Related Issues / PRs

- #24 — hub-003: Phase 3 — Private area
- #25 — the PR this ADR lands in

## Supersedes

None. It amends design doc §5 requirement 4 rather than superseding an ADR.

## Superseded By

None.
