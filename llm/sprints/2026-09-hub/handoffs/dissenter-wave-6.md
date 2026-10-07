# Handoff — `Dissenter`, Wave 6 (annotations)

Agent: Dissenter (independent; authored nothing in this wave)
Contract: `llm/sprints/2026-09-hub/contracts/dissenter-wave-6.md`
Seams: `llm/sprints/2026-09-hub/contracts/wave-6-annotations-seams.md`
Design authority: ADR-0021 (Accepted), ADR-0022 (Proposed), issue #107
Repo: `/home/djjay/code/website` · branch `feat/annotations` · HEAD reviewed:
`e44a7b7` (`feat(wave-6): annotation store, capture island, My notes, export
renderer`)
Issue: #107

## Summary

I read the contract, both seam files, ADR-0021/0022, both wave contracts, the
three handoffs, and the implemented code: `gate/app/{annotations,main,members,
config}.py`, `gate/tests/{test_annotations,test_headers,conftest}.py`,
`firebase.json`, `site/notes-routing.json`,
`site/src-private/lib/annotations.mjs`, `site/src-private/components/
{AnnotationsIsland,NotesIsland}.tsx`, `site/src-private/pages/{notes,[...itemPath]}
.astro`, `site/scripts/export-notes.mjs`, `site/src/lib/frame-content.mjs`, the
pre-wave `main.py` (via `git show e44a7b7^`), `infra/scripts/seed-members.sh`,
and `CLAUDE.md`. I ran read-only commands only; I wrote no file but this one and
modified no tracked file; no git/gh write command was run.

**I raise seven objections. One would block: D1** — the owner can read every
member's notes, and the design has no member notice or consent decision, in a
private area that *already has a non-owner member* (`cbrown@vt.edu`). A
"members read only their own, the owner reads all" model is a third-party
privacy decision that has never been put to the member.

The other six are a security change whose rationale and evidence are
under-stated and which is in fact a latent defect fix (D2), an Accepted-ADR
interface (`POST /annotations/export`) that silently does not exist so v1's
downstream goal is only reachable by hand-copy (D3), `intent` overloaded as the
routing key (D4), two incompatible meanings of "orphan" across the two surfaces
(D5), an item-scoped list filter that cannot filter by `section` (D6), and the
un-decided governance plane of `site/notes-routing.json` (D7).

Objection table. "Block?" means block the Wave 6 exit/merge.

| # | Objection (claim) | Severity | Block? |
|---|---|---|---|
| **D1** | Owner reads every member's notes; no notice/consent decision exists and a real non-owner member is seeded | should be fixed before ship | **Yes** |
| **D2** | The `X-Frame-Options: SAMEORIGIN` change is a large, security-relevant change with no ADR, no `frame-ancestors`, and no browser evidence; it is also a fix for a `DENY`-broken iframe that predates the wave, undocumented as such | should-fix | No |
| **D3** | ADR-0021 dec. 3/6 and seams AN-EXPORT promise `POST /annotations/export` ships credential-free; no such route exists and v1 delivery is a hand-run Node script, the "copy it out by hand" ADR-0022 defers | should-fix | No |
| **D4** | `intent` is both the semantic record and the routing key; re-routing existing notes requires mutating their meaning and has no migration path | should-fix | No |
| **D5** | "orphan" means "quote no longer resolves" in the capture panel and "item not in this build" in My notes; the seam's My-notes promise is unmet | should-fix | No |
| **D6** | The list filter has no `section`, so an item panel is scoped by `(source, slug)` alone and collides across sections | note | No |
| **D7** | `site/notes-routing.json` has no Q1/Q2 plane determination; the site contract says the gate is configured from it but the gate never receives it | note | No |

---

## Objections

### D1 — The owner reads every member's notes with no notice or consent · BLOCK

**Claim.** The seam fixes the trust model as "members may read only their own;
the owner may read and delete all" (`wave-6-annotations-seams.md` AN-STORE,
AN-ROUTES) and implements it: `GET /annotations?scope=all` returns
`deps.annotations.list_all()` for the owner (`gate/app/main.py:784-791`), and
`_annotation_row` returns every field including `member` to the owner. Nothing
in the design tells a member that the owner can read their notes, and nothing
asks the member to consent. A note is *private data about private content*,
authored in a private area whose entire promise (ADR-0016, ADR-0004) is that
access is gated. A member writing a `brainstorm` or `question` note has no way
to know it is readable by the owner, and the design never makes that decision
explicitly — it treats owner-read-all as an implementation detail of export.

**Why this is a design objection, not a nit.** The private area is not
single-user: `infra/scripts/seed-members.sh` seeds `cbrown@vt.edu` as a
"Committee member" alongside the owner. So the owner-reads-all scope affects a
real third party. The consent decision is irreversible in the direction that
matters: once notes are written, a later "the owner can read these" notice
cannot un-tell the member what they assumed when they wrote them. The
alternatives that were not considered: (a) an in-product notice at first note
("Notes are private to you; the owner can read them for export") with an
explicit acknowledgement; (b) scoping My notes and export to the owner's *own*
notes in v1 and deferring cross-member read to an owner decision; or (c) a
per-note visibility flag. The design took (implicit owner-read-all) without
recording any of them.

**Evidence that would settle it.** An owner decision (a D-number) on the
member-facing notice/consent, plus a test asserting the notice is shown before
the first note; or a written determination that non-owner members are never
expected, contradicting `seed-members.sh`. Absent one of those, the design ships
a third-party privacy decision that was never made.

### D2 — The `SAMEORIGIN` change is under-argued, un-evidenced, and is really a latent-defect fix · should-fix

**Claim.** The seam's own question — "does the iframe capture make v1 a large
security change (a header relaxation) that deserves its own ADR?" — is answered
"no" by omission. The change keys on the *served* object name
(`gate/app/main.py:330-341`, `_is_payload_object` at `:1151-1165`), which is the
right narrow shape, but:

1. **It has no ADR.** ADR-0021 records it as one line under "Risks"
   (`:121-123`); both wave handoffs list "an ADR note" as an *unknown* candidate
   (`gate-wave-6.md` ADR candidates; `site-wave-6.md`). A deliberate widening of
   the gate's universal `DENY` is exactly the class of first-order security
   decision ADR-0016/0017/0018 exist to record. The seam itself said the change
   is "the Security Tester's to pass or veto" — there is no Security Tester
   handoff in this wave.
2. **The trust boundary is unstated.** `_payload/**` is satellite-authored HTML
   served same-origin with the gate session cookie. `SAMEORIGIN` newly permits
   *any* same-origin document to frame it. That does not widen confidentiality
   (a same-origin script could already `fetch` the bytes), but the design never
   writes down whether payload HTML is trusted or untrusted, so a reader cannot
   evaluate the clickjacking delta. `X-Frame-Options` is also deprecated in
   favour of CSP `frame-ancestors`; the gate sets no CSP (verified: `main.py`
   sets only `Cache-Control`, `Vary`, `nosniff`, `Referrer-Policy`, XFO).
3. **It is a fix, not a new exception.** Before this commit, `security_headers`
   set `X-Frame-Options: DENY` on *every* response (`git show e44a7b7^:gate/app/
   main.py`, line 299). The private item iframe has carried a `/p/_payload/...`
   `src` since Phase 3 (`site/src-private/pages/[...itemPath].astro:49-54`,
   `frame-content.mjs:103-105`, `SITE_BASE=/p/` at `site/package.json:26`). Under
   `DENY` a browser blocks that iframe regardless of same-origin, so the member
   item frames have likely never rendered their payload; the pre-wave test even
   pinned `x-frame-options: DENY` as a *positive* (`git show e44a7b7^:gate/tests/
   test_headers.py`), and the Wave 3 red team recorded it as a win
   (`red-team-wave-3-round2.md:206`). Wave 6 silently makes that iframe work
   again but documents the change only as a new "deliberate exception", never as
   a fix for a broken headline feature.
4. **No browser evidence exists.** There is no Playwright/puppeteer/e2e suite
   (`site/package.json`), so nothing in the wave shows the capture island ever
   reads a real same-origin selection in a real browser; the evidence is
   unit/build-level only. The seam's "re-anchoring" and "selection" claims rest
   on that un-run path.

**Evidence that would settle it.** A short ADR (or an ADR-0021 addendum) that
(a) records the served-name rule and why `SAMEORIGIN` rather than a CSP
`frame-ancestors` allowlist, (b) states the payload trust boundary and the
clickjacking delta, and (c) records the pre-wave `DENY` breakage as the actual
motivation; plus one browser-level test that a signed-in member can select text
inside `/p/_payload/...` and save a note, and that a cross-origin page still
cannot frame it.

### D3 — The promised credential-free export endpoint does not exist; v1's downstream goal is hand-copy · should-fix

**Claim.** ADR-0021 decision 3 lists `POST /annotations/export` as a live gate
route (`:41-44`) and decision 6 says "v1 ships the credential-free render
(`POST /annotations/export`)" (`:61-63`); the seam repeats it: "only `POST
/annotations/export` (credential-free rendering) ships in v1"
(`wave-6-annotations-seams.md:152-153`). No such route exists — `grep
'/annotations/export'` over `gate/` returns nothing, the gate route table has
three routes, and `gate-wave-6.md`/the gate contract explicitly move rendering
to the site. Instead, `site/scripts/export-notes.mjs` is a Node script the owner
runs locally against a JSON file they fetched by hand (`:194-201`), and with no
credential it prints the ADR-0022 stop. That is precisely the "the owner can
copy it out by hand" fallback ADR-0022 defers — and it is the *same* weakness
ADR-0021 used to reject browser-local notes: "a note that lives only in one
browser is not [downstream use], and it cannot be exported" (`:79-82`). v1
therefore ships a store whose only path to the paper/experiment is a manual
copy, while an Accepted ADR claims an endpoint that would have made it
reproducible.

This also undercuts the reason `scope=all` exists: an owner-only read of every
member's notes (D1) was justified as the export data source, yet no shipped
code consumes it automatically. The two wave contracts resolved the seam/ADR
contradiction silently; ADR-0021 was never amended.

**Evidence that would settle it.** Either the route exists (`POST
/annotations/export` in `gate/app/main.py` with a credential-free test), or an
amended ADR-0021 that strikes the endpoint from decisions 3/6 and records that
v1 export is a local renderer, with the owner's acceptance that downstream
delivery is manual until ADR-0022 is decided.

### D4 — `intent` is both the semantic record and the routing key, with no migration path · should-fix

**Claim.** ADR-0021 makes `intent` a first-class *semantic* field (`:24-25`) and
in the same breath the *operational* routing key (`decision 5`, `:54-59`):
`site/notes-routing.json` maps each intent to a repo/dir and `routeNote` renders
by it (`annotations.mjs:730-736`). These are two different lifetimes: the meaning
of a note ("this is a paper thought") is immutable history; its destination
("this repo, this directory") is operational and will change — a repo split, a
route consolidation, or a decision that `brainstorm` should land in
`soa-agentic-se` after all. The only way to re-route an existing note is to
rewrite `intent`, which changes the note's user-visible chip and its meaning.
There is no `route`/`target` field on the row, no per-note override, and no
migration story. The alternative not considered: keep `intent` semantic and add
an operational destination (a routing-table key or a stored `route` defaulted at
creation), so "what this note is" and "where this note goes" can change
independently.

**Evidence that would settle it.** A worked re-routing scenario (move
`brainstorm` to a new repo) and the migration that does not mutate any note's
`intent`; or a written decision that intent is the *only* dimension and routes
are immutable, making the coupling intentional.

### D5 — "orphan" means two different things on the two surfaces · should-fix

**Claim.** AN-CAP 6 defines orphan as "a stored note whose `exact` no longer
resolves in the current document" (`:52-55`), and AN-USE promises My notes has
"an orphan badge for notes that no longer anchor" (`:135`). The capture island
implements that definition (`resolveAnchor`, `annotations.mjs:334-376`;
`AnnotationsIsland.tsx:298-302`). My notes cannot — it has no item text — so it
badges a note orphan when its *item is not in this build*
(`isOrphanNote`, `annotations.mjs:639-643`; `NotesIsland.tsx:89`). The same badge
therefore means "your quote was republished away" on one surface and "this item
was withdrawn" on the other. Because v1 deliberately writes no `orphan` flag
back (AN-OUT-OF-V1), the two surfaces can disagree indefinitely with no field
to reconcile them, and the seam's My-notes wording is not met by the shipped
code. The alternative not considered: persist the flag at capture/read time
(`updated`/`anchor_state`) or rename the My-notes badge to what it actually
means ("unknown item") so the word is not overloaded.

**Evidence that would settle it.** A test with a present-in-build item whose
stored quote is absent, asserting the badge appears on *both* surfaces under one
definition; or a seam amendment/rename establishing that "orphan" deliberately
means two things and documenting which surface owns which.

### D6 — The item list filter omits `section`, so a panel is not item-scoped · note

**Claim.** Item identity is the triple `(section, source, slug)` (AN-STORE), and
create stores all three — but the item panel fetches
`listAnnotations({ source, slug })` (`AnnotationsIsland.tsx:106-109`) and the
gate's filter parser accepts only `intent`/`source`/`slug`
(`main.py:1323-1352`, applied at `:800-806`); there is no `section` filter and
no client-side `section` narrowing (`annotationsView` takes `result.notes`
wholesale). If two items share a `source` and `slug` under different sections,
"Notes on this item" shows the other item's notes. The impact is confined to the
caller's own notes (the store is member-scoped), so this is correctness/UX, not
a cross-member leak. The contract's filter list is the source of the omission,
but the island's own item panel treats the list as item-scoped, so the two
disagree.

**Evidence that would settle it.** A `?section=` filter (with a test) or a
two-item fixture with a shared `(source, slug)` and different sections; or a
client-side `section` check proven by test.

### D7 — `site/notes-routing.json` has no plane determination and the gate never sees it · note

**Claim.** Per `CLAUDE.md` Q1/Q2 (`:44-70`), an artifact that governs repository
operation goes in `llm/`, a project/domain deliverable in `docs/`, and otherwise
"use the existing structure" or escalate. `site/notes-routing.json` is
owner-editable data that decides *where private notes are delivered* — arguably
operational — and no document states its plane or why `site/` is correct. It is
also not what the site contract says it is: requirement 1 claims "This file is
what the gate's export is configured from (the gate receives it as JSON)"
(`site-wave-6.md:42-45`), and ADR-0021 decision 5 calls it owner-editable
routing. In the implementation the gate never receives it; only the local Node
renderer reads it, and the gate has no routing concept at all. The file is
reviewable (it is in a PR-reviewed tree), but its ownership, plane, and
consumption contract are all unstated or wrong.

**Evidence that would settle it.** A Repository Steward / governance-delta
ruling naming the file's plane and owner, and correcting the site contract's
"the gate receives it" sentence (or a gate that actually consumes it).

---

## Questions from the contract, answered

- **Quote-anchoring enough?** The algorithm is sound (exact → context →
  position, never inventing an anchor), but the seam understates two things: the
  two surfaces disagree on what "orphan" means (D5), and there is no browser
  evidence the capture path works at all (D2.4). Reliability against republish
  is *unit*-demonstrated, not end-to-end.
- **Is `SAMEORIGIN` safe?** The served-name rule is the right narrow shape and
  `SAMEORIGIN` does not widen cross-origin framing. It is not a *new*
  confidentiality risk, but it is under-documented, uses a deprecated mechanism,
  and is really a fix for a `DENY`-broken iframe (D2).
- **Notes only in Firestore vs "used in the paper/experiment"?** Weak: the
  promised credential-free endpoint does not exist, so v1 downstream use is a
  hand-copy (D3).
- **Owner reads all — consent?** No notice, no consent, and a real non-owner
  member exists. **BLOCK** (D1).
- **Is `intent` the right routing key?** No; it couples immutable meaning to a
  mutable destination (D4).
- **Does `site/notes-routing.json` belong in the data plane?** Its plane is
  undecided and the contract's description of its consumer is wrong (D7).
- **Is the v1 scope cut tight?** PDF/public/sharing cuts are honestly recorded
  (AN-OUT-OF-V1), but the *security* change is not a scope cut and rode in
  without its own ADR (D2).

## Related docs

- `llm/sprints/2026-09-hub/contracts/wave-6-annotations-seams.md`
- `llm/sprints/2026-09-hub/contracts/{gate,site}-wave-6.md`
- `llm/governance/adr/0021-annotations-private-item-notes.md`
- `llm/governance/adr/0022-annotation-export-transport.md`
- `llm/sprints/2026-09-hub/handoffs/{gate,site,infra}-wave-6.md`
