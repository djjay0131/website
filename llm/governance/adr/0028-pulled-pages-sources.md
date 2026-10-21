# ADR-0028: Pull public Pages sources into the private build

Status: Accepted
Date: 2026-10-21

## Context

An owner project sometimes already has a public GitHub Pages site and no
satellite publishing identity. The eBay eRUPT proposal (`chbrown13/ebay_erupt_2027`)
is the first: Chris Brown owns it, Jason is a collaborator without admin, and
the project is being revised this week. Jason wants it inside his Projects
space for convenience. Asking Chris to add a workflow or change repository
visibility is out of scope, and a new WIF identity, service account and Terraform
entry would be infrastructure for a read-only public input.

The hub already has the pieces needed to render a private project: the private
Astro build, the sanitiser, the catalog, the gate's item policy and the
destructive private sync. What it lacks is a way to admit a **public Pages
repository** without pretending it is a satellite.

## Decision

1. **A pulled source is not a satellite.** It has no WIF provider, service
   account, bucket write grant, Terraform entry or publish action. The hub pulls
   the public repository itself.
2. **The pull runs only in the private build job**, after `dist-public` has
   already been built. It copies the repository's configured Pages directory
   into `site/src/content/sources/<source>/` and generates a normal v1 manifest
   with every item forced to `visibility: private` and a project section.
   The existing private build, catalog, sanitiser and private sync then treat it
   exactly like a private satellite source.
3. **The declaration is `site/pulled-sources.json`**, a small committed config
   naming the public repository, branch, Pages path, item titles/slugs/order and
   an optional repository note. It is not a second manifest contract.
4. **No credential is used for the pull.** The repository is public and read
   with `git` over HTTPS. The only cloud credential remains the existing
   `hub-deploy` identity in `private-sync`, which already has the private-bucket
   permissions; no new IAM is created.
5. **The last good copy is kept.** The pull validates file types, file count,
   total size and every referenced page before replacing its work tree. A fetch
   or validation failure reuses the cached copy and warns; with no copy the build
   fails, so the destructive private sync cannot silently withdraw the project.
6. **The public build never sees it.** The pull is after `npm run build` in the
   Firebase job, and the leak check, allowlist check and signed-out 404 all run
   afterwards with the pulled manifest in the tree. A pulled item is never added
   to `site/publish-allowlist.json`.
7. **Access is the normal Firestore item policy.** A pulled source is granted by
   source rule and member group like any private project; the manifest has no
   `access` field.

## Rationale

This keeps the trust boundary where it already is. The pulled repository is
untrusted input: its HTML goes through the same sanitiser, scripts and frames are
removed, asset URLs are rewritten to the gated payload tree, and the gate makes
the access decision from Firestore. The hub does not need to trust the source
repository, and the source repository does not need a credential for the hub.

It also avoids permanent infrastructure for a temporary convenience. Removing a
pulled source later is deleting a config row (and its private bucket objects via
the normal sync), not revoking an identity.

## Alternatives Considered

- **Make it satellite 7 with Terraform, WIF and a publish workflow.** Rejected:
  it requires changes in a repository Jason does not administer, plus a new
  identity and apply for a public read-only input.
- **Fork or copy the repository under `djjay0131`.** Rejected by the owner: it
  would create a second source of truth while Chris and Jason revise the proposal.
- **Fetch at request time in the gate.** Rejected: it would put an external
  network dependency in the serving path and bypass the build-time sanitiser,
  catalog and leak check.
- **Write the pulled tree directly to the content bucket.** Rejected: the hub's
  deploy identity is read-only on the content bucket; widening it would cross the
  satellite prefix boundary. Pulling during the private build needs no write.

## Consequences

### Positive

- A public Pages project appears in Projects with no satellite onboarding.
- The existing private renderer, access policy, leak guards and sync semantics
  apply unchanged.
- A failed upstream fetch degrades to the last good copy instead of a withdrawal.

### Negative / Tradeoffs

- The hub build fetches a public repository; a new upstream commit wakes the
  hourly build through the pulled-source fingerprint.
- The source is only as fresh as the build; the page says edits appear within
  the hour.
- The repository remains public. Pulling it into a private hub page does not make
  the upstream repository private.

### Risks

- A malicious or compromised public repository could ship hostile HTML; the
  sanitiser and size limits are the boundary, and are covered by tests.
- A persistent pull failure leaves the last good copy visible; that is preferred
  to deleting the project, and the workflow warns on every stale reuse.

## Impacted Areas

- [x] Product
- [x] Domain model
- [ ] Data architecture
- [ ] AI architecture
- [ ] Domain-specific systems
- [x] Integrations
- [x] Security/privacy
- [x] Implementation
- [x] Documentation

## Related Documents

- `site/pulled-sources.json`
- `site/scripts/pull-sources.mjs`
- `site/src-private/lib/inline-content.mjs` (the sanitiser)
- `site/src-private/lib/repositories.mjs`
- `llm/governance/adr/0026-project-sections-inline-private-content.md`
- `llm/governance/adr/0025-roles-groups-private-access.md`
- `llm/governance/adr/0010-withdrawal-semantics.md`

## Related Issues / PRs

D28-B (2026-10-21).

## Supersedes

None.

## Superseded By

None.
