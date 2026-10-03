# ADR-0017: Share links serve the item's document, not the member frame

Status: Accepted
Date: 2026-10-03

## Context

Design doc §6 responsibility 4 says a share grants read access to "that one
slug's files" without a session. SEAM-S1 first mapped a token to the private
build's item address, `<section>/<source>/<slug>/`. The Dissenter's Wave 3
review (D1) found that this address holds the **hub's member frame**, not the
item's bytes:

- the frame carries the members' navigation — every private item's title;
- it links absolutely to `/p/_payload/<source>/<path>` and `/p/_astro/…`.

A share holder is signed out (`GET /s/**` takes no session, SEAM-S3), so the
frame renders empty and, worse, names the whole private item list to a holder
authorised for exactly one item. Serving it was wrong on privacy and function
alike. A second gap appeared when the fix renamed the item document to
`index.html`: a `pdf` item then served `text/html` over PDF bytes.

## Decision

1. **A share serves an item-scoped document namespace, `_doc/`.** The private
   build stages, for every effectively-private item, a self-contained copy of
   the item's document and its non-document assets under
   `<section>/<source>/<slug>/_doc/`. A document declared by **another** item of
   the same source is excluded, so one token reaches one item. `_doc` is a
   reserved hub segment; a manifest `source`/`slug` may not be `_doc`.

2. **The row carries `entry`.** `POST /share {section, source, slug, entry,
   expires_in_days}` stores `entry`, the item document's filename relative to
   `_doc/` (`basename(path)`; e.g. `committee.html`, `anthropic-fellow.pdf`).
   `GET /s/{token}/` serves `_doc/<entry>`; `GET /s/{token}/<sub>` serves
   `_doc/<sub>`. `entry` defaults to `index.html` when omitted and is validated
   with the same segment allowlist and prefix containment as any served path.

3. **The member frame is unchanged.** `<section>/<source>/<slug>/index.html` and
   `_payload/<source>/…` remain for signed-in members exactly as they were. The
   `_doc/` tree is additive and is never the frame.

## Rationale

The design doc's "one document" (roadmap §phase-4-sharing) is the unit a share
can safely expose: it is item-scoped, self-contained, and carries no hub chrome
or navigation. The parenthesised requirement — "serves that one slug's files" —
is satisfied by the `_doc/` copy, while the member frame keeps its browsing role
behind sign-in.

## Alternatives Considered

### Serve the member frame and strip its navigation

Rejected. The frame is a static Astro page; the nav is server-rendered HTML, and
the payload lives outside the item prefix. Stripping it in the gate means
HTML-rewriting bytes the gate is built to stream, and the absolute `/p/` links
would still 404 for a share holder.

### Rename the item's document to `index.html`

Rejected (found in implementation). It mangles a `pdf`: the gate streams
`_doc/index.html` as `text/html`. `entry` keeps the real filename and content
type.

### Flatten the private layout so `<section>/<source>/<slug>/` holds the payload

Rejected. It would change the members' area and the `_payload` model that
Wave 0b/0c verified live, for no benefit over an additive namespace.

## Consequences

### Positive

- A share holder sees the document and nothing else; no private title leaks.
- `pdf`, `html` and `bundle` items share correctly, each with its own content
  type.
- The member experience is untouched.

### Negative / Tradeoffs

- The private build emits an item-scoped copy in addition to the member
  `_payload/` tree, and the private sync uploads more objects.
- A multi-page built site shared as one item loses pages declared as separate
  items (they are excluded to keep a token item-scoped). A residual from C28:
  the manifest does not declare an item's asset/page set.

### Risks

- The `_doc` copy is a second place an item's bytes are staged. A future change
  to `stagingPlanFor` must keep both in step; a unit test covers the item-scoped
  plan against the phd fixture.

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

- `llm/sprints/2026-09-hub/contracts/phase-4-seams.md` — SEAM-S1 (amended)
- `llm/specs/2026-09-10-research-hub-design.md` §6 responsibility 4, §11 — amended here
- `llm/governance/adr/0010-withdrawal-semantics.md`
- `llm/governance/adr/0016-private-by-default-publish-allowlist.md`

## Related Issues / PRs

- `hub-004` — Wave 3, Phase 4 sharing

## Supersedes

None.

## Superseded By

None.
