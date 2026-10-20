# ADR-0026: Private projects are site sections, with sanitised inline content

Status: Accepted
Date: 2026-10-20
Amends: ADR-0025 decision 7 (no embedded private items)

## Context

D24 de-framed private items but left the members' area as one flat list of
links, and each item page only linked the satellite document top-level. The
owner's D25 brief is explicit: each private project should be a mini-site or
section inside the main site, with its own navigation, and the document should
render inline in the normal layout -- not in an iframe and not as a bare
link-out. The members' landing also stops being "Shared with you" and becomes
**Projects**, one card per project.

Two constraints remain unchanged from ADR-0025: the repository is public, so no
private item key, source name, group name or email may be committed; and a
viewer must never see a project or page they cannot open, in static HTML, cards
or navigation.

## Decision

1. **Projects are grouped by satellite source.** The members' landing lists one
   card per source the viewer can open, with the derived project title, the
   first page's summary, page count and last-updated date. CV items are not
   projects. Cards and sub-navigation are built from `GET /private/items`, which
   the gate already filters, so no static HTML carries another member's
   catalogue.

2. **Two route shapes, both gated by the same item rule.** The canonical
   project route is `/p/projects/<source>/<slug>/`; the project section is
   `/p/projects/<source>/`. The pre-D25 route `/p/<section>/<source>/<slug>/`
   **keeps working and renders the same inline section**; it is not removed or
   redirected away. This does not move private content out from under `/p/`,
   and it needs no Hosting rewrite or public-build change.

3. **The catalog maps pages, not just payloads.** `_hub/catalog.json` maps each
   item page object (both route shapes) and each project section page object to
   the item key(s) it represents. The gate therefore keeps its normal object
   rule: an unmapped page 404s, and a project section is readable only by a
   member who may read at least one page in it. `projects/index.html` is a
   member page with no item metadata; it is safe for any signed-in member.

4. **Shared chrome is member-only, not public.** The private site's emblem,
   badges, favicons and compiled `_astro/**` assets are served to any signed-in
   member, because they are shared by every private page and cannot be
   item-mapped. This is a fixed allowlist of chrome prefixes, not a wildcard:
   `_payload/**`, `_doc/**` and item pages still resolve through the catalog.
   Signed-out callers never reach the rule.

5. **Inline content is sanitised and scoped.** The private build reads the
   satellite document at build time. Scripts, frames, objects, forms and event
   handlers are removed; `javascript:` navigation is removed; ids are prefixed
   so they cannot collide with site ids. Satellite CSS is wrapped in CSS
   `@scope` rooted at the document wrapper, with `position: fixed`, `z-index`
   and `@import` neutralised. A browser without `@scope` ignores the satellite
   CSS rather than applying it globally, which fails safe. CSP and the gate's
   response headers are unchanged; there is no iframe, so no framing exception
   is introduced.

6. **Satellites are unchanged.** No manifest field is added. Page order is the
   manifest's item order, which is already versioned by the manifest. A future
   optional navigation hint would require an ADR and a manifest version; D25
   derives labels from the existing title and slug.

7. **Notes return.** The shared annotation mount is restored on inline project
   pages, with the item identity taken from the manifest item, not the route.

## Consequences

- The private area is navigable as sections rather than a flat list.
- The gate's item rule remains the only access decision; a stale catalog can
  change what exists, never who may read it.
- A satellite document that depends on JavaScript (for example an interactive
  form) loses that behaviour inline. Its original document remains available
  from a small fallback link and at its gated payload URL.
- The project title is derived from item titles; a source with unrelated titles
  falls back to a humanised source key. A satellite that wants a precise project
  name would need the optional, versioned hint this ADR defers.
