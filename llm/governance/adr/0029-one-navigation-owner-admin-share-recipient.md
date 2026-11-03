# ADR-0029: One navigation, owner administration, and the share-recipient view

Status: Accepted
Date: 2026-11-03

## Context

The private area grew a second front door. `/p/` still rendered the pre-D25
"Shared with you" landing, `/p/projects/` was the real Projects index, the
members' band carried its own "Private navigation" menu and a "Members" tag, and
a separate "Shares" page managed bearer links. Jason will present this site to
collaborators, so the structure has to be explainable from the outside: one
navigation, one Projects address, and a clear administrative surface.

The site also lacks an owner UI for the access model that already exists in
Firestore (`members/{email}`, `access_policy/current`), for share links beyond a
single page, for publish status, and for the audit trail. Those operations are
currently only reachable through `infra/scripts/access.py` and
`infra/scripts/calendar_events.py`. Finally, a share recipient sees a bare item
document with no attribution or expiry, and there is no public explanation of
how the site is built, used or published.

## Decision

1. **Signing in augments the existing site navigation; it does not create a
   second menu.** The private build renders the normal band. Inside the private
   area `Projects` points at `/p/projects/`, and `Calendar` and `Notes` are
   added to the same list. `Admin` is added only after a server-side owner
   check; it is never present in a non-owner's rendered navigation. The
   "Members" tag and the "Private navigation" label are removed.
2. **`/p/projects/` is the one Projects URL.** `/p/` redirects to it, and the
   pre-D25 item route `/p/<section>/<source>/<slug>/` redirects to the project
   route `/p/projects/<source>/<slug>/`. The redirect pages are static and are
   reached only after the gate's normal access decision, so they are not an
   existence oracle.
3. **Depth is breadcrumbs.** The in-project secondary navigation is removed
   because it duplicates the breadcrumb. The project home page lists the
   project's pages; every page keeps breadcrumbs and previous/next links.
4. **Administration is owner-only and server-enforced.** The gate serves
   `/p/admin/` after an owner check and owns an `/admin/*` API for members,
   groups, per-project/source/item access rules, share links, sync status and
   the change log. Every write is audited (`access_audit`, `calendar_audit`, and
   `share_audit`), every state-changing request is origin-checked, a non-owner
   gets the same 404 as a missing private path, and the owner cannot remove their
   own owner role. The admin page itself is fetched from the private bucket only
   after the owner check and is absent from `_hub/catalog.json`, so it cannot be
   enumerated.
5. **A share link is the only place "Shared with you" appears.** The owner sees
   a "Share this page" control on private item pages. The recipient sees that one
   item with a small banner naming Jason and the expiry. Minting and revoking a
   share append a `share_audit` record.
6. **About this site is public and names no private content.** `/about/site/`
   and two sub-pages describe the build, the member experience and the
   publishing/privacy model. Their text joins the leak-check's needle set. Any
   screenshots are generated from synthetic fixtures.

## Rationale

The navigation problem is caused by treating "signed in" as a different site.
It is not: it is the same site with more entries. Rendering one band and adding
entries keeps the public and private surfaces recognisably the same property,
and makes the presentation story simple.

Administration belongs in the gate because that is where the access decision is
made. Putting it in a static private page would render it for every member, and
putting it outside the gate would create a second authorisation path. The
Firestore documents and audit shape already exist, so the admin API is a second
client of the same model rather than a second model.

## Alternatives Considered

### Alternative 1: Keep a separate members' header

Rejected by the owner: signed-in navigation should add to the main menu, not
create a new one. A separate header also forces every collaborator to learn two
layouts.

### Alternative 2: Gate-only admin UI with no static page

Rejected: the page is a substantial form-heavy interface, and building it in the
Astro private build keeps the normal band, footer and styles while the gate
still decides whether the object is served. The object is deliberately absent
from the catalog, so the gate route is the only way to reach it.

### Alternative 3: Make `/p/projects/` and `/p/` both valid landing pages

Rejected: two front doors is the reported problem. One canonical URL plus a
redirect is the smallest correct fix.

### Alternative 4: Show share attribution by serving the raw document unchanged

Rejected: the recipient would have no attribution or expiry. The gate injects a
banner into HTML documents and wraps PDFs in a banner page; the document bytes
are unchanged apart from the injected banner.

## Consequences

### Positive

- One navigation, one Projects URL, and breadcrumb depth that matches the
  owner's presentation goal.
- The owner can change members, groups and access rules from the site, with the
  same Firestore model and audit trail as the scripts.
- Share recipients get attribution and expiry without learning any other item.
- The public About pages make the system explainable without exposing private
  names.

### Negative / Tradeoffs

- The gate gains write access to `members/`, `access_policy/` and audit
  collections. Its existing project-wide `datastore.user` grant already covers
  them; the route-level owner check and audit are the new controls.
- A static redirect page costs one extra request on legacy URLs.
- HTML share documents receive injected markup; the banner is fixed and
  server-generated, never sourced from the document.

### Risks

- An admin route that forgets the owner check would be a privilege escalation.
  Every admin test asserts the non-owner 404 and the audit record.
- A redirect that names a private slug could be an oracle. The redirect target
  is the project route, reached only after the normal access decision; a
  signed-out request still gets the styled 404.
- Injected share markup could break an unusual document. Only HTML content
  types are modified, and the injection falls back to the original bytes when no
  body is found.

## Impacted Areas

- [x] Product
- [x] Domain model
- [x] Data architecture
- [ ] AI architecture
- [ ] Domain-specific systems (see governance delta)
- [x] Integrations
- [x] UX
- [x] Security/privacy
- [x] Implementation
- [x] Documentation

## Related Documents

- `site/src-private/layouts/PrivateBase.astro`
- `site/src-private/pages/projects/index.astro`
- `gate/app/main.py`
- `gate/app/admin.py`
- `gate/app/shares.py`
- `infra/scripts/access.py`
- `llm/governance/adr/0025-roles-groups-private-access.md`
- `llm/governance/adr/0026-project-sections-inline-private-content.md`

## Related Issues / PRs

D32 (2026-11-03).

## Supersedes

None.

## Superseded By

None.
