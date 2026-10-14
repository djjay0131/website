# ADR-0024: One CV section — five public documents, six variants, per-variant visibility

Status: Accepted
Date: 2026-10-14

## Context

The hub carried two CV sections, `/cv/` and `/resumes/`, both linked in the
footer, fed by four `cv` variants (`academic`, `anthropic-fellow`,
`research-professional`, `sde-long`). The split was historical: `/cv/<variant>`
rendered the HTML CV and `/resumes/` listed the same variants under a second
heading, so the same four documents appeared twice under two names.

Owner decision **D22** (2026-10-14) replaces that with one section and a fixed
set of documents:

| slug | label | page budget | source | visibility |
|---|---|---|---|---|
| `one-page` | One-page résumé | exactly 1 page | new | public |
| `research-2p` | Research résumé (2 pages) | ≤ 2 pages | trimmed from `research-professional` | public |
| `professional-2p` | Professional résumé (2 pages) | ≤ 2 pages | trimmed from `sde-long` | public |
| `research-full` | Full research CV | no limit | today's `academic` | public |
| `professional-full` | Full professional résumé | no limit | today's `sde-long` | public |
| `anthropic-fellow` | Anthropic Fellow CV | as today | unchanged | **private** |

`research-professional` is retired as a slug; its content became `research-2p`.

Two things had to be settled to implement this without weakening a boundary:

1. **Where the grouping metadata lives.** The hub needs to group the documents
   (Research vs Professional, one-page vs two-page vs full) without parsing
   human titles. The natural home is the manifest, but
   `contract/manifest.schema.json` is `additionalProperties: false` at every
   level with **no extension field**, so adding per-item fields is a breaking
   `v1`→`v2` contract change shared with the family site and every satellite.
2. **Who decides visibility per variant.** `tools/manifest.py` hard-coded
   `VISIBILITY = "public"` for every item. ADR-0016 says the manifest's
   `visibility` is a satellite *request* and the hub's allowlist is the
   decision; a per-variant request requires the satellite to state it.

## Decision

1. **One section.** `/cv/` is the only CV section. `/resumes/` is removed and
   301-redirects to `/cv/`; the "Resumes" navigation entry is removed.

2. **Grouping metadata lives in the `cv-data` payload, not the manifest.** Each
   variant selector gains `track: research|professional|both` and
   `length: one-page|two-page|full`. The `cv-data` `schema_version` moves from
   `"1"` to `"2"` (ADR-0009), and the hub's claim table accepts both `"1"` and
   `"2"` so a build succeeds on either side of the rollout. **The publish
   contract is unchanged** (`contract/publish@v1`; the manifest schema is not
   touched). This is the option that keeps the contract frozen; the manifest
   route was rejected as a contract change.

3. **Per-variant visibility.** Each selector also gains
   `visibility: public|private`, defaulting to **`private`** (ADR-0016).
   `tools/manifest.py` reads it for each PDF item instead of a constant; the
   shared `cv-data` payload item stays `public`. The hub's committed
   `site/publish-allowlist.json` remains the authority: an item is public only
   when the manifest requests it **and** the allowlist names it. The Fellow CV
   is `private` in both places.

4. **Page budgets are enforced in CI.** `tools/page_budget.py` counts the built
   PDF and fails when `length: one-page` is not exactly 1 page or a
   `length: two-page` exceeds 2; `publish` depends on the check, so an
   over-length variant cannot deploy. The budget is read from the selector, so
   there is no second list to drift.

5. **Old URLs redirect with 301.** `/resumes/**` and the retired slugs
   (`/cv/academic`, `/cv/research-professional`, `/cv/sde-long`, and their PDFs)
   301 to their replacements in `firebase.json`. `redirects:check` is wired
   into CI, closing the gap ADR-0020 decision 4 recorded as DEFERRED.

6. **Annotations apply to the CV HTML views** as to other public items (D20).

## Rationale

The section split was two names for one thing; collapsing it makes the CV a
single, honest index. Grouping belongs with the variant definitions because
those already travel in the `cv-data` payload the hub renders, and putting it
in the manifest would have forced the one change D22's own instructions say to
stop before — a breaking contract bump — for metadata no satellite other than
`cv` has any use for. Versioning the payload keeps the contract untouched and
follows ADR-0009 exactly.

Making visibility a per-variant field, default private, removes the last
hard-coded `public` from the satellite while leaving ADR-0016's authority
intact: the allowlist still decides. The page budget is a property of the
document the owner asked for, so it is enforced against the built PDF rather
than trusted.

## Alternatives Considered

### Put `track`/`length` in the manifest (contract `v2`)

The owner's first instinct, and the cleanest conceptually. Rejected because the
manifest schema is closed with no extension field: it needs a breaking `v2`
shared with the family site and every satellite, for two fields only `cv` uses.
The `cv-data` payload is already satellite-versioned and already reached the hub
under a `data` claim, so it is the lower-blast-radius home.

### Derive the grouping in the hub from the known slugs

Keep the metadata out of the satellite entirely and hard-code the five slugs in
the hub. Rejected: it puts CV content structure in the hub, contradicts the
"hub renders, satellite owns content" split, and would need a hub edit for every
future document.

### Keep `/cv/` and `/resumes/` and just tidy the links

Rejected by D22: the owner wants one section.

## Consequences

### Positive

- One CV section; one place to find every document.
- The publish contract is unchanged; no satellite or the family site moves.
- Visibility is stated per variant and defaults private.
- Page budgets are checked against the built artifact, so "2 pages" is a fact,
  not a label.

### Negative / Tradeoffs

- `cv-data` `schema_version` must be bumped again for any future selector-shape
  change, with a matching hub change (the normal ADR-0009 cost).
- The hub accepts `"1"` and `"2"` indefinitely; tightening to `"2"` only is a
  later cleanup once no `"1"` payload can appear.

### Risks

- **Merge order — the satellite merges first.** The hub's own CI builds the CV
  from the `cv` GitHub release (a pull request cannot read the bucket), and its
  committed allowlist names the five new slugs; until the satellite publishes
  them the hub PR's `check-publish-allowlist` fails on stale entries. So the
  satellite merges, publishes `schema_version "2"` and the new variants, the hub
  PR then builds against them and goes green, and the hub merges immediately
  after. Between the two merges the deployed hub may build red (its old claim
  table does not know `"2"`); a failed build does not undeploy, so the site
  keeps serving. The hub claim table accepts **both** `"1"` and `"2"`, so once
  the hub PR is deployed either payload builds.
- **A page-count display that silently drifts.** The hub counts pages with a
  small dependency-free reader (`site/src/lib/pdf-pages.mjs`); the satellite CI
  check is the authority on the budget. A PDF the reader cannot parse undercounts
  rather than miscounts; the CI check is what fails a real overflow.

### Known residual

The allowlist binds a name, not bytes (ADR-0016 residual). Consolidation does
not change that; the Fellow CV is private by name and request, not by content
hash.

## Impacted Areas

- [x] Product
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

- `llm/governance/adr/0016-private-by-default-publish-allowlist.md` — the visibility model this extends
- `llm/governance/adr/0009-manifest-version-lands-optional-first.md` — payload vs envelope versioning
- `llm/governance/adr/0008-manifest-data-format-hub-renders-cv.md` — the `cv-data` claim
- `llm/governance/adr/0020-pages-retirement-with-redirect-stubs.md` — decision 4, the redirect-map CI gap closed here
- `llm/governance/adr/0021-annotations-private-item-notes.md` — annotations (D20)
- `contract/manifest.schema.json` — the closed schema that made the manifest route a contract change
- `site/scripts/site-routes.mjs`, `firebase.json` — the redirect surface

## Related Issues / PRs

- Owner decision **D22** (2026-10-14), recorded in `llm/sprints/2026-09-hub/STATE.md`
- The `cv` satellite PR that ships the six variants and the page-budget check

## Supersedes

None. It amends the section set the design doc and roadmap described for the CV.

## Superseded By

None.
