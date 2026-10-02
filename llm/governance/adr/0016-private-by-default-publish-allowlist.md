# ADR-0016: Private by default — the hub's publish allowlist is the authority

Status: Accepted
Date: 2026-10-02

## Context

Design doc §4–§5 treated a satellite's manifest `visibility` field as the
publication decision. Phase 2/3 code implemented that directly: an item with
`visibility: public` was rendered by the public build, and only `visibility:
private` items were withheld. The leak check likewise built its private set from
the manifests alone.

That is the wrong trust direction for a system whose §12.3 non-negotiable says
**satellites are untrusted**. Under the old rule a satellite could make its own
content public by asserting it, which is exactly the trust the non-negotiable
says the hub does not extend. It also produced a concrete live exposure:
`cv/anthropic-fellow` was published with `visibility: public` and served at
`/pdfs/anthropic-fellow.pdf` and `/cv/anthropic-fellow/` on every origin that
served the site, including the GitHub Pages mirror (STATE finding A-6).

Owner decision **D8** (2026-09-18) settled the model:

> An item is public only if **both** its satellite manifest says
> `visibility: public` **and** the hub's committed publish allowlist names its
> `(source, slug)`. Everything else renders only in the private build, behind
> sign-in. The manifest's `visibility` becomes a *request*; the hub is the
> authority.

Wave 0b's seams (`llm/sprints/2026-09-hub/contracts/private-by-default-seams.md`)
fixed the interfaces. This ADR records the decision durably, as D8 requires, and
amends design doc §4 and §5.

## Decision

1. **`visibility` is a request; `site/publish-allowlist.json` is the decision.**
   An item is public only when the manifest says `public` AND the allowlist
   contains its `(source, slug)`. First-party hub pages use `source: "hub"` and
   their route path as the slug, so one file covers both.

2. **Effective visibility is computed in exactly one place.**
   `effectiveVisibility()` in `site/src/lib/hub-content.mjs` is the only code
   that combines the two inputs. The collection loader, the section indexes, the
   CV pages, the staging plans and the leak check all read from it; none may
   re-read `item.visibility`. Two sources of truth about one property is the
   failure shape ADR-0011 already removed at the router level, and the allowlist
   must not reintroduce it at a higher level.

3. **The public build stores only effectively-public items; the private build
   stores every item.** The shared collection loader (`src/content.config.ts`,
   re-exported by `src-private/content.config.ts`) tags every entry with
   `effective_visibility` and, in the public output, omits the rest. The private
   output renders public and private items alike in one place (SEAM-B4).

4. **The leak check's private set is every non-allowlisted item**, not only the
   items whose manifest says `private` (SEAM-B6). This is a strictly larger and
   more correct set; it is what catches `cv/anthropic-fellow`.

5. **A build-time guard owns the allowlist's own integrity (SEAM-B5).**
   Condition A — an allowlist entry naming an item whose manifest says `private`
   — is always a hard failure: the allowlist decides what *becomes* public, never
   what stops being private. Condition B — an entry naming a `(source, slug)` the
   tree does not carry — fails on the hub's pull requests but only warns on the
   deploy build, so a satellite's ordinary slug rename cannot halt deploy or the
   withdrawal path (`private-sync` `needs: build-firebase`). A whole absent
   source prefix is not condition B; the expected-source check (ADR-0010
   decision 4) owns it.

6. **No schema change (SEAM-B7).** `visibility` keeps its values and meaning; only
   who decides changes. Changing the schema would require every satellite to move
   in step for no gain.

7. **`cv-data` is filtered at render time.** The shared CV payload carries every
   variant definition, including the private fellowship variant, so allowlisting
   the `cv/cv-data` item does not by itself keep the variant out. The CV pages
   list only variants whose `cv` PDF item is effectively public, and the leak
   check proves the residue absent (SEAM-B3).

## Rationale

The whole point of the manifest contract is that the hub owns the public
decision and satellites own their content. The old rule had it backwards and the
cost was a live leak on five origins. Making publication a small, visible,
reviewable diff in one committed hub file is also good bookkeeping: "make this
public" should never be a side effect of a satellite content change.

Keeping the private set computed in one place, and widening the leak check to
match, is what makes the guarantee structural rather than conventional.

## Alternatives Considered

### Keep the manifest as the authority and remove the bad item

Rejected. It leaves every future satellite able to publish by assertion, and
re-trusts an untrusted input.

### Filter only at render time, leaving `visibility` raw in the collection

Rejected. Every consumer that forgot to call `effectiveVisibility()` would leak,
and the leak check would still check the wrong set. Storing effective visibility
in the collection makes forgetting impossible for page code.

### Make a stale allowlist entry always a hard failure

Rejected (Dissenter objection 3, accepted before implementation). It hands a
satellite a kill switch on the hub's deploy and on withdrawal. See decision 5.

## Consequences

### Positive

- A satellite can no longer publish by assertion.
- `cv/anthropic-fellow` is private everywhere the allowlist governs, and the
  leak check now looks for it.
- Publication is a one-file, L0-shaped diff.

### Negative / Tradeoffs

- A first publish is private until the owner adds an allowlist entry. This is
  deliberate friction on the only action that changes what the world sees.
- The private area now duplicates public items for members (SEAM-B4). That is the
  intended "members see everything" behaviour, at the cost of a larger private
  sync.

### Risks

- **The allowlist is now the security boundary.** Its guard and the leak check
  are the enforcement. The Skeptic Verifier's Wave 0b job is to show a wrong
  entry actually turns them red.
- **The GitHub Pages mirror is not retired until Phase 6.** The allowlist governs
  the `dist-public` build both hosts consume, so a redeploy removes the
  fellowship CV from Pages too; a historical URL there becomes 404 (never 200).
  The Firebase origin redirects it to `/signin/`.

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

- `llm/sprints/2026-09-hub/contracts/private-by-default-seams.md` — SEAM-B1…B9
- `llm/specs/2026-09-10-research-hub-design.md` §4, §5, §12.3 — amended here
- `llm/governance/adr/0005-two-output-build-with-leak-check.md`
- `llm/governance/adr/0010-withdrawal-semantics.md` — the withdrawal path decision 5 protects
- `llm/governance/adr/0011-two-srcdirs-not-a-visibility-filter.md` — the model this extends
- `docs/satellites.md` — the satellite-facing statement that `visibility` is a request

## Related Issues / PRs

- #46 — hub-008: Wave 0b, private by default
- The `feat/private-by-default` PR this ADR lands in

## Supersedes

None. It amends design doc §4 and §5 rather than superseding an ADR.

## Superseded By

None.
