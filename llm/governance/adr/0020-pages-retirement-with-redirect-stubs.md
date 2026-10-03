# ADR-0020: Retire the full-site Pages deployment, keeping redirect stubs

Status: Accepted
Date: 2026-10-03

## Context

ADR-0001 decision 4 moved hosting to Firebase and said GitHub Pages would be
"retired in Phase 6 with redirects from `djjay0131.github.io/website`". Roadmap
O6 noted the tension and left the mechanism to "this phase's own ADR": redirects
must be *served* by something, and retiring Pages removes the only host serving
`djjay0131.github.io/website/**`. The older site's inbound links must keep working
(`site/redirects/github-pages.json`, 55 entries), and no private content may be
served publicly.

Two facts make the resolution concrete:

- GitHub Pages serves whatever `actions/deploy-pages` publishes to the
  `github-pages` environment. It cannot rewrite or redirect on its own.
- Firebase Hosting already serves `404.html` if present, and can serve
  meta-refresh stubs as static files.

## Decision

1. **The full public site stops being published to Pages.** The `build` job no
   longer uploads `site/dist-public` as the Pages artifact. `djjay0131.github.io/website/`
   no longer serves the site's pages.
2. **Pages is retained as a stubs-only deployment.** A generated artifact
   containing, for every entry in `site/redirects/github-pages.json`, a static
   meta-refresh stub at `/website/<from>` that forwards to
   `https://jason.cusati.us/<to>`, plus a `404.html` that forwards an unknown
   `/website/**` path to the equivalent canonical path. `actions/deploy-pages`
   publishes **only** that artifact. This satisfies both "Pages no longer serves
   the site's own pages" and "every redirect-map entry forwards".
3. **The canonical `404.html` is also shipped by Firebase.** The same generated
   mapping page is placed at the public root so Hosting serves it for unknown
   paths; it must contain no private slug.
4. **`redirects:check` becomes a required CI step**, so the committed map cannot
   drift from the route inventory.

## Rationale

The brief itself specifies this shape ("meta-refresh stubs for the redirect map,
`404.html` mapping, delete the full-site Pages job"). It is the only mechanism
that keeps old inbound links working without continuing to publish the site (or
its private-adjacent assets) on a second host. Meta-refresh is a static file, so
the stubs artifact has no build of the site in it.

## Alternatives Considered

- **Delete `actions/deploy-pages` entirely.** Rejected: every
  `djjay0131.github.io/website/**` link would return GitHub's 404, failing the
  roadmap's redirect criteria.
- **HTTP 301 redirects at the Pages host.** Rejected: GitHub Pages cannot
  redirect; only static files are served.
- **Keep the full site on Pages until DNS-level redirects are possible.**
  Rejected: it keeps a second public copy of the site and its assets, contrary to
  ADR-0001 decision 4 and the private-by-default model.

## Consequences

### Positive

- Old URLs keep forwarding; the canonical host is the only place the site is
  served.
- The stubs artifact is tiny and contains no site content.

### Negative / Tradeoffs

- Pages remains a deployment (of stubs). "Retired" means "no longer serves the
  site", not "the deployment is deleted"; the `github-pages` environment stays.
- A meta-refresh stub is a client-side redirect; a crawler that does not follow
  meta-refresh sees the stub. Recorded; acceptable for legacy inbound links.

### Risks

- A stub must never name a private item. The map includes the private fellowship
  paths; their stubs forward to the canonical URL, which Firebase then 302s to
  `/signin/`. The stub text names only the path, which is already public in the
  old map.

## Impacted Areas

- [ ] Product
- [ ] Domain model
- [ ] Data architecture
- [ ] AI architecture
- [ ] Domain-specific systems (see governance delta)
- [x] Integrations
- [ ] UX
- [x] Security/privacy
- [x] Implementation
- [x] Documentation

## Related Documents

- `llm/governance/adr/0001-promote-website-to-hub-on-firebase-hosting.md` — decision 4
- `llm/governance/adr/0016-private-by-default-publish-allowlist.md` — the Pages mirror note
- `llm/master-roadmap.md` — O6, `phase-6-polish`
- `site/redirects/github-pages.json`, `site/scripts/generate-redirect-map.mjs`
- `.github/workflows/build.yml`

## Related Issues / PRs

- `hub-006` — Wave 5, Phase 6

## Supersedes

None.

## Superseded By

None.
