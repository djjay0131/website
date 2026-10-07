# ADR-0021: Annotations are private, item-anchored notes routed by intent

Status: Accepted
Date: 2026-10-07

## Context

Issue #107 asks for reading-time annotation on the private research items the
hub serves: select text, highlight or comment, and route the note somewhere the
paper/experiment/brainstorm work can use. The private area already provides
session-gated access to private items (ADR-0004), an item-scoped `_doc/` model
and a Firestore store pattern for shares (ADR-0017, ADR-0018), and a
private-by-default publish decision (ADR-0016). This ADR fixes the annotation
model so the gate, site and infra streams share one interface.

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
   `member` from the verified session, never from the request body.

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

7. **The capture island reads the payload frame, and that one header changes.**
   The private item frame renders the item in a same-origin `<iframe>` at
   `/p/_payload/<source>/<path>`. Pre-Wave-6 the gate sent
   `X-Frame-Options: DENY` on every response, so that frame could not render;
   Wave 6 is where the latent defect is fixed, not a new weakening. The gate now
   sends `SAMEORIGIN` for a **served private payload document** only (the object
   name, after the private prefix, begins `_payload/`, set only on a successful
   serve); every other `/p/**` response — frames, refusals, misses, traversals,
   non-`/p` routes — keeps `DENY`. There is no CSP `frame-ancestors` to change.
   Whether this should instead be a CSP with `frame-ancestors 'self'` is a
   follow-up; the Security Tester owns passing or vetoing the change.

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

11. **Not in v1.** PDF annotation; public annotations; sharing notes between
    members; Hypothes.is integration.

## Rationale

The shares model is copied deliberately: one store per concern, owner/member
checks in the gate, origin-checked state changes, uniform caching headers, and a
collection whose discipline is code rather than IAM. Quote-anchoring is the only
model that survives republish, and the W3C selectors are the open standard for
it. Making `intent` a stored field rather than a tag keeps export routing a
data decision the owner can change without a code change.

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

## Related Issues / PRs

- #107 — annotate the literature
- Wave 6, annotations (owner decision D17)

## Supersedes

None.

## Superseded By

None.
