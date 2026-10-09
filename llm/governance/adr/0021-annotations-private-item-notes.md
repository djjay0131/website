# ADR-0021: Annotations are member-private, item-anchored notes routed by intent

Status: Accepted
Date: 2026-10-07 (amended 2026-10-09 on D20)

> **D20 amendment (2026-10-09) — annotations follow the member, not the page.**
> The body below is amended in place; the Status line stays `Accepted` because
> this is a semantic body change, not a status flip. Owner decision D20, after
> testing annotation live, changed the SCOPE and the CAPTURE UX of this ADR:
>
> 1. **Any signed-in member annotates any item they can read — public items
>    included.** Wave 6 mounted the capture island only under `/p/` (private
>    build). The island now also mounts on public item pages (the public framed
>    item route, `layouts/ItemPage.astro` for CV project pages, and the
>    research/paper pages). Gating is unchanged and stays server-side: the
>    island asks the gate, and a `GET /annotations` **403 makes the island render
>    nothing**, so a signed-out visitor sees no toolbar, list or count. The
>    public build carries the island's CODE, never annotation CONTENT: the mount
>    root is empty and hidden, and no note, quote, member or count is inlined
>    into the public HTML or the Pagefind index.
> 2. **One island, two targets.** The capture island takes its target from either
>    `iframe[data-annotation-frame]` (framed payload items, as before) or the
>    page's own content root (`main`/`article`) on pages that inline the item.
>    The same W3C selector/text-index code drives both, so an item republished by
>    a satellite re-anchors either way.
> 3. **Item identity is the item's, not the pane's.** Every note still carries
>    `{section, source, slug}`. A satellite item takes that triple from its
>    manifest on BOTH routes, so a note made on the public route and one made
>    under `/p/` for the same item are the same item. A first-party hub page
>    (research digest, paper, CV project) is not in any manifest, so it gets a
>    stable identity from its base-relative route: `source: "hub"` (the same
>    pseudo-source ADR-0016 already uses) and the path as the slug. This is
>    ADR-0021 decision 1, amended.
> 4. **Feedback (capture UX).** The toolbar is anchored NEXT TO the selection and
>    clamped to the viewport, never fixed to the bottom of the window; the
>    painted highlight is collapsed-in immediately after save (so the browser's
>    selection overlay cannot hide it) with a higher opacity that reads on white
>    and in dark mode, and a brief non-blocking "Saved · <intent>" toast with
>    **Undo**; the intent chip is in the one-click toolbar and remembers the
>    member's last choice LOCALLY (`localStorage`, never sent to the server); the
>    default is the last used intent, else **`paper`** — never a silent
>    `question`, which is the one intent that never exports (decision 5); the
>    "Notes on this item" list is a sticky side panel on wide screens and a
>    toggle on narrow ones; and `selectionchange` (debounced) is listened to as
>    well as `mouseup`/`keyup` so touch works.
> 5. **Scope guards are unchanged.** Members-only server checks (`_is_member` /
>    `_is_owner`), `private, no-store`, no quotes/titles in logs, owner-only
>    delete of others' notes, and the leak check's refusal of the private My
>    notes route. The AN-LEAK needles change shape (see decision 12) because the
>    island's own `/annotations` endpoint and `data-annotation-*` DOM hooks are
>    now ALLOWED public tooling.
>
> The notes-sync pipeline (ADR-0022; D18/D19) is untouched by D20: it consumes
> the same rows regardless of the item's visibility, and routes by `intent`.

## Context

Issue #107 asks for reading-time annotation on the research items the hub
serves: select text, highlight or comment, and route the note somewhere the
paper/experiment/brainstorm work can use. Wave 6 scoped this to the private
items; **D20 widens it to every item a member can read, public included.** The
private area already provides session-gated access to private items (ADR-0004),
an item-scoped `_doc/` model and a Firestore store pattern for shares (ADR-0017,
ADR-0018), and a private-by-default publish decision (ADR-0016). This ADR fixes
the annotation model so the gate, site and infra streams share one interface.

The reportable facts that shape it:

- An annotation is **private data about private content**. It must never reach
  `dist-public`, the search index, RSS, OG or any log line, and it is scoped to
  a member (members may read only their own; the owner may enumerate and delete
  any, but reads only their own — decision 8).
- An annotation must survive a satellite republishing an item. Byte offsets do
  not; the item's text does. That is the W3C Web Annotation `TextQuoteSelector`
  with a `TextPositionSelector` fallback.
- The point of a note is downstream, so `intent` (`paper`, `experiment`,
  `brainstorm`, `question`) is a first-class field and export routes by it.

## Decision

1. **An annotation is one row of `annotations/{id}`** owned by the member who
   wrote it: `{id, member, section, source, slug, selector, position, quote,
   comment, intent, tags, created, updated}`. No item title is copied into the
   row. The gate mints `id` with `secrets.token_urlsafe(16)` and stores
   `member` from the verified session, never from the request body. **The
   identity is `{section, source, slug}` and it comes from the ITEM, never from
   the route or the pane** (D20): a satellite item uses its manifest triple on
   both the public route and `/p/`, and a first-party hub page uses
   `source: "hub"` with its base-relative path as the slug. Two notes for the
   same item are therefore the same item however the page was reached.

2. **Anchoring is by quote, with a position fallback.** The `selector` is a
   `TextQuoteSelector` (`exact`, `prefix`, `suffix`); `position` is a
   `TextPositionSelector` (`start`, `end`) or null. A note whose `exact` no
   longer resolves is marked **orphan** and is always listed and exported; it is
   never deleted. v1 computes orphan state at read time.

3. **The gate is the only writer, as with shares.** `POST /annotations`,
   `GET /annotations` and `DELETE /annotations/{id}` live in the gate.
   State-changing routes carry the allowed-origin check. Every response is
   `private, no-store` (the shared middleware). `GET` returns the caller's own
   rows; `?scope=all` is owner-only. A member deletes only their own; the owner
   deletes any. Quotes, comments and titles are never logged. The export reads
   the owner-only `GET /annotations?scope=all`; there is no separate gate export
   endpoint (the renderer is `site/scripts/export-notes.mjs`, decision 6).
   **D20: the capture island is a client of these routes on BOTH outputs, and
   never an authority.** It sends no `member`, and a `GET /annotations` **403
   (no session, or no write capability) makes the island render nothing**. The
   gate read capability (`_is_member`) and the write capability are the same
   server-side checks Wave 6 shipped; D20 changes where the island is mounted,
   not who may read or write.

4. **No new Firestore IAM.** ADR-0018's project-wide `roles/datastore.user` on
   `hub-gate` already covers `annotations/`; Firestore cannot scope a role to a
   collection. The collection discipline is the code, and the released rules
   stay deny-all. No binding is added.

5. **Intent routes the export, and routing is owner-editable.**
   `site/notes-routing.json` maps `paper → soa-agentic-se/notes`,
   `experiment` and `brainstorm → agentic-kg-research/notes`, and `question →
   null` (My notes only). Markdown per note carries the item qualified id, a
   deep link and the quoted passage. Delivery is **always a PR, never a
   push**, and only into those two repositories.

6. **The export transport is not created here.** The transport and its
   credential are ADR-0022 (Proposed). v1 ships the credential-free renderer
   `site/scripts/export-notes.mjs` (fed by the owner-only
   `GET /annotations?scope=all`, writing local Markdown and contacting no
   remote); the automated cross-repository PR waits for the owner.

7. **The capture island takes one of two targets, and one header changes (D20).**
   A framed item renders in a same-origin `<iframe data-annotation-frame>` at
   `_payload/<source>/<path>`; the island reads that frame's DOM. A page that
   inlines the item (a first-party research/paper page or a CV project page) has
   no frame, so the island indexes the page's own `main`/`article` content root.
   The same selector construction and quote-fallback run on both. For the framed
   case, pre-Wave-6 the gate sent `X-Frame-Options: DENY` on every response, so
   the frame could not render; Wave 6 fixed that latent defect, not a new
   weakening. The gate sends `SAMEORIGIN` for a **served private payload
   document** only (the object name, after the private prefix, begins `_payload/`,
   set only on a successful serve); every other `/p/**` response — frames,
   refusals, misses, traversals, non-`/p` routes — keeps `DENY`. There is no CSP
   `frame-ancestors` to change. Whether this should instead be a CSP with
   `frame-ancestors 'self'` is a follow-up; the Security Tester owns passing or
   vetoing the change. On the public output the frame and the inline root are
   both public; nothing about the member or their notes is in the document the
   island indexes.

8. **The owner may enumerate and delete any note, but does not read another
   member's note content.** `?scope=all` is owner-only and returns the metadata
   needed to moderate (id, member, item, intent, dates); it **redacts** quote,
   comment, selector and tags for every row the owner did not write (the owner's
   own rows keep their content). This is the privacy-preserving default chosen
   when the Dissenter (Wave 6 D1) and the Chief Reviewer (must-fix 1) raised
   that a real non-owner member (`cbrown@vt.edu`) is seeded. It is a decision
   taken without the owner and flagged for confirmation; the owner can widen it
   only with the member's consent, which would be its own decision. The export
   therefore covers the owner's own notes in v1 (see decision 6).

9. **Known limits, recorded rather than hidden.** `intent` is both a note's
   meaning and its export route, so re-routing an existing note means editing
   its `intent` (no separate `route` field or migration in v1). "Orphan" means
   the quote no longer resolves in the item (capture) and, separately, the item
   is absent from this build (My notes); the two are distinct states. A list
   filter is by `(source, slug)`, which is the item key; `section` is not a
   filter because `(source, slug)` is unique across the hub.

10. **`site/notes-routing.json` is a site feature config** (the owner's chosen
    path), read by the export renderer; it is not governance policy and does not
    belong in `llm/` (Q2).

11. **Not in v1.** PDF annotation; sharing notes between members; Hypothes.is
    integration. **Public annotations ARE in scope since D20** — an annotation is
    still private data about content a member can read, and "public" describes
    the ITEM, never the note. A note on a public item is private to its member
    exactly as a note on a private item is.

12. **The leak check changes shape (AN-LEAK, D20).** Wave 6 forbade four
    annotation strings in `dist-public` because the whole surface was
    private-only. Since D20 bundles the capture island into `dist-public`, the
    island's own `/annotations` endpoint and `data-annotation-*` DOM hooks are
    **allowed** public tooling, and only the private surface remains a needle:
    the member-only My notes route and the `hub:annotation:` data namespace.
    This is not a weakening of the content guarantee — the mount root is empty
    and hidden, note content is fetched at runtime, and a signed-out `GET
    /annotations` 403s — it is the removal of a needle that would now fail a
    correct build (the "guard that cries wolf" class). The allowed strings are
    pinned by a test so they cannot silently become leaks again.

## Rationale

The shares model is copied deliberately: one store per concern, owner/member
checks in the gate, origin-checked state changes, uniform caching headers, and a
collection whose discipline is code rather than IAM. Quote-anchoring is the only
model that survives republish, and the W3C selectors are the open standard for
it. Making `intent` a stored field rather than a tag keeps export routing a
data decision the owner can change without a code change.

**D20 — why the scope, not the model, changed.** The model was already right; the
owner's live test found that the feature was hard to reach (private items only),
hard to see (a bottom-of-window toolbar and a faint highlight hidden by the
browser's selection overlay), and easy to misfile (a silent `question` default
that never exports). Widening to "any item a member can read" makes the note a
property of the member's reading, not of the page they happened to be on; and
because the identity is the item's `{section, source, slug}`, the same note
follows the item across the public and `/p/` routes. The security posture is
unchanged: the gate is still the only authority, and a 403 still makes the island
invisible.

## Alternatives Considered

### Store annotations in the browser (localStorage/IndexedDB)

Rejected. The point is downstream use in the paper/experiment work; a note that
lives only in one browser is not that, and it cannot be exported.

### Host on Hypothes.is

Rejected (issue #107). Hosting private notes on a third party defeats the
private area. The model and anchoring algorithm are borrowed, not the hosting.

### Anchor by byte offset only

Rejected. A satellite republish shifts offsets and every note would orphan.

### A separate service or database for notes

Rejected. It is a second credential and surface for no gain; the gate already
holds exactly the required Firestore role.

## Consequences

### Positive

- Notes survive republishes (quote-anchored) and are usable downstream (intent
  + export).
- One store pattern, one set of guards, one place to review.
- Routing is a file the owner edits, not code.

### Negative / Tradeoffs

- `datastore.user` remains project-wide (accepted in ADR-0018); `annotations/`
  widens the blast radius of a compromised gate by one more collection.
- Orphan state is computed at read and not persisted in v1, so an "orphan" list
  is only as current as the last render.
- Storing no title means My notes maps identity to a display title from the
  build; a note for an item no longer in the build shows its qualified id.

### Risks

- A compromised gate image can read and write every member's notes. The gate is
  first-party and already reads the private bucket; the role is the narrowest
  predefined option that connects. Recorded, not hidden.
- The capture island depends on same-origin iframe DOM access; the gate must
  serve private `_payload/**` with `X-Frame-Options: SAMEORIGIN`. That header
  change is a security-gate item.
- **D20: the island CODE ships to the public internet.** A public visitor's
  browser downloads the endpoint path (`/annotations`), the DOM hooks and the
  intent vocabulary. None of that is a secret — the endpoint is member-gated and
  returns 403 signed out — but it does mean the public bundle advertises that the
  hub has annotations. Recorded deliberately. What does NOT ship is any note
  content, member identity or count, and the leak check refuses the private My
  notes route so the member area is never even named.
- **D20: the last-used intent is a browser-local preference, not a per-member
  server setting.** It is one enum word under `hub:annotation-intent`. On a
  shared browser profile it is visible to the next user of that profile; the
  island never has (and never sends) the member identity, so "per member" means
  "per browser" in v1. Recorded, not hidden.

## Impacted Areas

- [ ] Product
- [ ] Domain model
- [ ] Data architecture
- [ ] AI architecture
- [ ] Domain-specific systems (see governance delta)
- [x] Integrations
- [x] UX
- [x] Security/privacy
- [x] Implementation
- [x] Documentation

## Related Documents

- `llm/sprints/2026-09-hub/contracts/wave-6-annotations-seams.md`
- `llm/governance/adr/0016-private-by-default-publish-allowlist.md`
- `llm/governance/adr/0017-shares-serve-the-item-document.md`
- `llm/governance/adr/0018-gate-firestore-share-role-is-project-wide.md`
- `llm/governance/adr/0022-annotation-export-transport.md` (Proposed)
- `site/notes-routing.json`
- `site/src/lib/annotations.mjs` — the shared, public-safe pure logic (D20)
- `site/src/lib/annotations-island.ts` — the shared framework-free capture island (D20)
- `site/src/components/AnnotationsMount.astro` — the one mount used by both outputs (D20)

## Related Issues / PRs

- #107 — annotate the literature
- Wave 6, annotations (owner decision D17)
- **D20 (2026-10-09)** — annotations follow the member, not the page; Wave 7

## Supersedes

None.

## Superseded By

None.
