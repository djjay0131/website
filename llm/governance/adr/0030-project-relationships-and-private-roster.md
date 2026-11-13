# ADR-0030: Project relationships (parent and related) and a private satellite roster

Status: Accepted
Date: 2026-11-13
Builds on: ADR-0009 (manifest envelope versions), ADR-0019 (satellite roster and
source keys), ADR-0025 (roles, groups and the Firestore access policy), ADR-0026
(private projects as site sections), ADR-0027 (private calendar)

## Context

The owner asked for a members' project space that groups several related
projects: a parent space with one project space per child, linked to it, plus
links to related existing projects.

Two gaps stood in the way.

1. **The hub had no relationship between projects.** ADR-0026 derives one flat
   project per satellite source from the viewer's own `/private/items`
   response. Nothing let one project name another as its parent or as related.
2. **A satellite's repository name is committed to this public repository.** It
   appears in `infra/variables.tf` and, for private satellites, in the leak
   check's source-identity needles (ADR-0019 amendment of 2026-10-13). For work
   under double-anonymous review, a descriptive repository name in a public file
   can state that the owner has submitted that work.

A relationship must also obey ADR-0026's rule: a viewer who cannot open a project
must not learn that it exists, what it is called, or that it is related to
anything.

## Decision

1. **Manifest envelope version 3 adds an optional `project` object**:
   `{ "parent"?: <source key>, "related"?: [<source key>, …≤10] }`.
   - A manifest carrying `project` must declare `manifest_version: "3"`.
   - `deadlines` stays valid in version 3; ADR-0027's rule becomes "2 or 3".
   - Contract rules: no self-reference, and a related key may not repeat or
     equal the parent. They are enforced in `contract/validate-manifest.mjs` and
     mirrored in `site/src/content.config.ts`.
   - Version 1 and 2 manifests stay valid unchanged.
   - The hub advances the publish action's `v1` tag only after this lands.
     Until then, a version 3 manifest fails the satellite's own validation,
     which fails safe.

2. **Relationships ride on items and are pruned at the gate.**
   - The private build copies `parent` and `related` onto each of the source's
     catalog items. When there are none, nothing is added, so existing catalogs
     are byte-identical.
   - The gate parses the fields strictly: source-key shape, no
     self-reference, no duplicates, at most ten related keys. A malformed value
     fails the catalog closed.
   - **`/private/items` removes every `parent` and `related` key whose source
     has no item in that same response.** A key the viewer cannot open never
     leaves the server.
   - Nothing about a relationship is in static HTML. Parent breadcrumbs and the
     "Projects in this space" and "Related projects" lists are filled
     client-side from the pruned response.

3. **A relationship is shown only when the viewer can open both projects.**
   - Server-side, this is item 2's pruning. The client applies the same rule
     again as defence in depth: a child whose parent is not in the response
     stays a top-level card, and an unopenable related key is dropped.
   - Nesting is one level deep. A project that itself sits under a visible
     parent is never treated as a parent, and a self-parent is ignored.
   - Naming a project grants nothing. Access is still decided per item by the
     Firestore policy (ADR-0025).

4. **A private roster keeps sensitive repository names out of this repository.**
   - `var.private_satellites` has the same shape and validations as
     `var.satellites`. It is merged into `local.all_satellites`, which every
     per-satellite resource and output iterates.
   - A key present in both maps **fails validation**, because `merge()` would
     otherwise silently re-point a committed satellite at another repository.
   - The variable has **no default**: a plan without the roster fails at input
     instead of planning the destruction of those satellites. CI's targeted
     apply passes an explicit empty map.
   - Values come from `infra/private-satellites.auto.tfvars`, which is
     gitignored and exists only on the owner's machine.
   - Such satellites take **opaque source keys** (`qx-*`) that carry no venue,
     topic or count. Only the keys are committed, as leak-check identity
     needles. Repository names and titles are not committed; titles and
     summaries stay covered by the manifest-derived item needles at build time.
   - The private build's Repository card reads the private roster when it is
     present (owner builds) and is absent in CI builds.

5. **Private satellites use distinctive slugs.** A generic slug such as
   `overview` is also an item needle and collides with public prose (found in
   this ADR's fixture run). Slugs are prefixed with the source key, as an
   existing private satellite already did.

## Rationale

- Pruning at the gate uses the one place where access is already enforced, so a
  member's browser never holds a key it could not follow.
- Opaque keys plus a gitignored roster are the smallest change that keeps
  Terraform the single source of truth for publishing identities. The WIF
  condition still matches the immutable numeric repository ID, owner ID and
  repository name.

## Alternatives Considered

- **One satellite with a page per child.** One Terraform entry and no hub change.
  Rejected by the owner: each child should be its own project space, published
  from its own repository.
- **Commit the repository names.** Rejected for work under double-anonymous
  review.
- **A relationship map in the private build's static output.** Rejected: members
  without access would learn the keys and titles of projects they cannot open
  (ADR-0026).
- **Client-side filtering only.** Rejected after review: the response itself
  would carry unopenable keys, readable in developer tools.

## Consequences

### Positive

- A parent project is one card on the Projects landing, listing the child
  projects the viewer can open. Each child links back to it.
- No repository name or title for private-roster satellites is committed.

### Negative / Tradeoffs

- The private roster is not in version control. If it is lost, it must be
  rebuilt from the GitHub API (repository IDs and default branches). Its contents
  are recorded only in the owner's private notes.
- Every untargeted plan needs the roster file present.
- CI builds show no Repository card for private-roster sources.
- The `v1` publish-action tag must be advanced deliberately (ADR-0014) before
  satellites can publish version 3 manifests.
