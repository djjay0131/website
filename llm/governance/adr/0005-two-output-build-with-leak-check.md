# ADR-0005: Two-output build with a leak check

Status: Accepted
Date: 2026-09-14

## Context

The public site must never contain private content (§12.1), the public path
must stay static (§12.4), and one source tree should produce both areas
(design doc §5).

## Decision

1. `astro build` runs twice in CI with `HUB_OUTPUT=public` and
   `HUB_OUTPUT=private`, filtering collections by `visibility`, to produce
   `site/dist-public` (deployed to Firebase Hosting) and `site/dist-private`
   (synced to the private bucket).
2. A post-build leak check loads every manifest, collects every
   `visibility: private` slug, and fails the job if any path under
   `site/dist-public` matches.
3. The bucket IAM test runs on every deploy alongside it (§12.1 requires
   both).
4. Private navigation exists only in the private build.

## Rationale

Private content is structurally absent from the public artifact rather than
filtered at request time, and the guarantee is a mechanical CI check rather
than a convention.

## Alternatives Considered

### A single build with runtime filtering

One artifact, with private items withheld at request time. Either the private
bytes ship inside the artifact deployed to the public CDN, or the public path
executes at request time. The first violates §12.1, the second §12.4.

### Separate repositories or projects for public and private

Stronger isolation. But it duplicates the chrome, navigation and design
system, and contradicts one hub (§1).

## Consequences

### Positive

- The public artifact cannot contain what the build never put in it.
- The check is mechanical and runs on every deploy.

### Negative / Tradeoffs

- Build time roughly doubles.
- Every build-time output generated from collections must be produced from the
  public build only: sitemap, RSS, search index, OG images.

### Risks

- **The leak check is necessary, not sufficient.** It matches slugs and paths.
  Private text quoted into a public page, a renamed PDF, or a private title in
  the sitemap, RSS feed, search index (Phase 6) or an OG image would pass it.
  The exact matching rules and every derived output they cover must be defined
  when the check is built in Phase 3 — ADR candidate.
- **Where the check lives is ambiguous.** The brief names
  `scripts/check-no-private-in-public.mjs` while scoping the site specialist to
  `site/**`; the Phase 3 contract must settle the path.

## Impacted Areas

- [ ] Product
- [ ] Domain model
- [x] Data architecture
- [ ] AI architecture
- [ ] Domain-specific systems (see governance delta)
- [ ] Integrations
- [ ] UX
- [x] Security/privacy
- [x] Implementation
- [ ] Documentation

## Related Documents

- `llm/specs/2026-09-10-research-hub-design.md` §1, §3, §5, §12.1, §12.4
- ADR-0003 (static output), ADR-0004 (the private area this build feeds)

## Related Issues / PRs

- #7 — hub-000: Adopt agentic-governance and record hub design

## Supersedes

None.

## Superseded By

None.
