# ADR-0008: The manifest gains a `data` format; the hub keeps rendering the CV

Status: Accepted
Date: 2026-09-16

## Context

Design doc §4 fixes the manifest's `format` at
`{md, mdx, html, pdf, bundle}`, and §3 states the hub "reads manifests; it never
needs to know how a satellite built its output." Every one of those five formats is
a **document the satellite renders**: the hub frames it, serves it, or indexes it.

The CV is not a document. It is **data**, and the hub renders it:

- Six hub pages import `site/src/lib/cv-data.ts` — `/`, `/cv/`, `/cv/[variant]`,
  `/resumes/`, `/projects/`, `/projects/[slug]`.
- `cv-data.ts` reads `data/content/*.yaml` (`meta`, `summaries`, `employment`,
  `education`, `projects`, `skills`, `misc`, `referees`), `data/variants/<name>.yaml`
  and `own-bib.bib`, and its own header says it "mirrors the logic of
  `cv/tools/resolver.py`, including the extended DSL: bullet filtering, role
  collapse, and skills item subsetting."
- `/cv/[variant]` composes that resolved data into the hub's `Base` layout with the
  hub's typography and a `schema.org/Person` JSON-LD block.

So the hub already knows a great deal about how `cv` structures its source, and the
roadmap requires that to continue: "Each `cv` URL that Phase 1 served still
resolves." Four variant pages, their PDFs, the projects pages and the home page all
render from this data.

That leaves Phase 2 with a contract its own proof case does not fit. Three ways
through, and none of them is neutral, so the choice is recorded here rather than
settled inside an implementation.

A second, smaller correction belongs with it. §2 records `cv` as "Jason (private) …
Private repo, public output — the proof case." `cv` is **public**
(`gh api repos/djjay0131/cv` → `"visibility": "public"`) and its default branch is
**`master`**, not `main`.

## Decision

1. **`format` gains a sixth member, `data`**, defined as: *a structured payload the
   hub renders with first-party code.* Design doc §4 is amended accordingly. The
   `section`, `visibility` and required-field rules are unchanged.

2. **`cv` publishes five items:** the four variant PDFs as `format: pdf`
   (`section: cv`, `visibility: public`), and one `format: data` item, slug
   `cv-data`, carrying `data/content/`, `data/variants/`, `own-bib.bib` and
   `photo_jason_1.jpeg` — exactly today's `cv-data.zip` payload, unzipped under the
   satellite's prefix.

3. **A `data` item is inert unless the hub claims it.** The hub declares the
   `(source, slug)` pairs it can render — in Phase 2, exactly `("cv", "cv-data")`.
   A `data` item the hub does not claim **fails the build** rather than being
   ignored, so the contract cannot silently accumulate payloads nothing renders.

4. **Every CV URL keeps its current shape and its current chrome.** `/cv/`,
   `/cv/<variant>`, `/resumes/`, `/projects/`, `/projects/<slug>`, `/` and
   `/pdfs/<variant>.pdf` render first-party from the published payload. No CV URL
   changes, so the roadmap's URL-preservation criterion is met by construction
   rather than by a redirect map.

5. **The coupling is named, versioned and bounded.** The `data` item carries a
   `schema_version`, and the hub fails the build on a version it does not
   understand. `cv-data.ts` mirroring `cv/tools/resolver.py` is recorded as a known,
   accepted coupling between exactly one source and the hub — not a property of the
   contract.

6. **§2 is corrected:** `cv` is a public repository whose default branch is
   `master`. Its WIF provider condition admits `refs/heads/master`. The "private
   repo, public output" framing is removed; `phd-milestones` (Phase 3) is the first
   genuinely private satellite, and the first real test of that property.

## Rationale

Amending §4 is the option that states what is actually true. The alternatives either
degrade the site or describe the system falsely.

`data` is a narrow addition, not an open door: decision 3 makes an unclaimed `data`
item a build failure, so the format cannot become a dumping ground for payloads with
no renderer. Decision 5 puts a version handshake on the one coupling that remains,
which is the part most likely to break silently — `cv` renaming a YAML key would
otherwise surface as a malformed CV page rather than a failed build.

Honesty matters more than tidiness here. §3's promise — the hub never needs to know
how a satellite built its output — holds for `md`, `mdx`, `html`, `pdf` and
`bundle`. It does **not** hold for `data`, and no wording makes it hold. Recording
that as a bounded, named exception is better than either pretending the CV is a
`bundle` or quietly weakening §3 for every format.

## Alternatives Considered

### `cv` renders its own HTML and publishes `format: html`

`cv` grows a web renderer beside its LaTeX one and publishes finished pages; the hub
serves them verbatim in a thin frame, exactly as §4 describes for `html`.

Rejected. It is the only option that honours §3 completely, and it costs the most.
The CV pages lose the hub's layout, typography and `schema.org/Person` JSON-LD, or
`cv` must duplicate the hub's design system and keep it in step — the coupling
inverted, not removed. `cv` would need a second renderer and a second visual
regression suite next to the LaTeX one it already maintains. `/cv/<variant>` becomes
a framed foreign page rather than a page of the site. The variant-index and
`/resumes/` pages, which are hub-authored views over variant metadata, have no
natural home at all.

### Publish the payload as `format: bundle`

Use the existing `bundle` format for the data zip and let the hub reach inside it.

Rejected. §4 defines `bundle` as a "Built app folder" that the hub "serves folder
as-is under slug" — which is precisely what the hub must *not* do with this payload.
The hub would still parse `cv`'s internals, so the coupling is identical; the only
difference is that the manifest would now misdescribe it, and there would be no
version handshake and no way to tell a renderable payload from a servable one.

### The hub keeps downloading the `cv` GitHub release

Leave `site/scripts/fetch-data.sh` in place and bring only the PDFs through the
contract.

Rejected. It leaves the proof case half outside the contract it is meant to prove,
keeps the hub holding `cv`-specific release knowledge (§3), and keeps a GitHub
release in the publish path that Phase 3's private satellite cannot use. Phase 2's
stated purpose is that the CV is published *through the contract*.

### Move CV rendering into `cv` as a satellite of the hub's design system

Publish the hub's tokens and layouts as a package `cv` consumes.

Rejected. It inverts the dependency the architecture is built on — the hub would
become a library its satellites build against, which contradicts §3 and makes every
hub design change a coordinated multi-repository release.

## Consequences

### Positive

- The CV is published through the contract, with no URL changes and no visual change.
- The contract describes the system accurately, including the part that does not fit
  the clean story.
- A schema change in `cv` fails the hub build loudly instead of producing a subtly
  wrong CV page.
- `fetch-data.sh`, the `cv`-specific release download, leaves the hub build.

### Negative / Tradeoffs

- §3's independence property now has a named exception. `data` items couple one
  source to first-party hub code, and that coupling is real maintenance: a change to
  `cv/tools/schema.py` may require a matching change to `site/src/lib/cv-data.ts`.
- The hub carries a renderer per `data` source. This is acceptable for one; it would
  not be acceptable for many, and the review bar on a second `data` source should be
  high.
- The fixed format set is no longer purely "documents", so §4's format table needs a
  row that behaves unlike the others.

### Risks

- **Schema drift between `cv` and the hub.** Mitigated by `schema_version` and a
  build failure on an unknown value, but the version must actually be bumped when the
  shape changes — a discipline in `cv`, not something the hub can enforce.
- **`data` becomes the default for anything awkward.** Mitigated by decision 3
  (unclaimed data items fail the build) and by requiring an ADR before a second
  `data` source. Worth re-examining at Phase 5, when `agentic-kg` and
  `construction-ai-proposal` arrive.
- **The exception could be read as licence to weaken §3 generally.** It is not: the
  other five formats are unchanged, and the hub still needs no knowledge of how any
  satellite *built* its output — only, for `data` alone, of how one satellite
  *structures* it.

## Impacted Areas

- [ ] Product
- [x] Domain model
- [x] Data architecture
- [ ] AI architecture
- [ ] Domain-specific systems (see governance delta)
- [x] Integrations
- [ ] UX
- [ ] Security/privacy
- [x] Implementation
- [x] Documentation

## Related Documents

- `llm/specs/2026-09-10-research-hub-design.md` §2 (corrected), §3, §4 (amended), §11
- `llm/governance/adr/0002-satellite-publishing-via-content-bucket-and-dispatch.md`
- `llm/governance/adr/0007-hub-polls-content-bucket-no-satellite-github-credential.md`
- `site/src/lib/cv-data.ts`, `site/src/pages/cv/[variant].astro`,
  `site/scripts/fetch-data.sh` — the coupling this ADR bounds
- `llm/master-roadmap.md` §phase-2-contract — the URL-preservation criterion

## Related Issues / PRs

- #16 — hub-002: Phase 2 — Publishing contract

## Supersedes

None.

## Superseded By

None.
