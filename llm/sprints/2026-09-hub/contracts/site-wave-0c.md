# Contract — `site`, Wave 0c (branding)

Status: Issued
Date: 2026-10-02
Owner: Lead Architect
Stream: `site`
Issue: `hub-brand`
Branch: `feat/branding`
Design authority: `llm/specs/2026-10-01-branding-design.md` (approved D14)
Decisions: ADR-0015; plan `llm/plans/2026-09-19-branding-plan.md`

## Purpose

Turn the branding spec into the live chrome: a maroon band header with the
"Virginia Tech" affiliation as plain text (no mark), a three-column footer, a
structured home page (identity block, three tenet cards, Recent, Ways in), the
new tokens, and shared band/footer components used by both layouts. No portrait.

The design spec and ADR-0015 are already on `main`; this stream starts at the
build, not the spec. Where the spec is silent, the plan informs; where the owner
has not supplied wording, the stream drafts from the plan and marks it
`"draft"` so the owner can edit — it does **not** invent facts (no fake handles,
no fake statuses).

## Scope — paths this stream may touch

- `site/src/styles/tokens.css`, `site/src/styles/tokens.test.ts`
- `site/scripts/contrast.mjs`
- `site/src/components/` (new: `SiteBand.astro`, `SiteFooter.astro`, icons)
- `site/src/layouts/Base.astro`, `site/src-private/layouts/PrivateBase.astro`
- `site/src/pages/index.astro`, `site/src/layouts/SectionIndex.astro`,
  `site/src/layouts/ItemPage.astro`, `site/src/pages/signin/index.astro`
- `site/src/data/footer.json`, `site/src/data/research-portfolio.json` (new)
- `site/astro.config.mjs` / OG-card generation for the default `og:image`
- `site/scripts/private-structure.test.ts` (extend, do not weaken)
- `site/scripts/stage-public-assets.mjs` + `hub-content.mjs` + `sync-content.test.ts`
  (stop staging the portrait to `dist-public`; Amendment 4)
- `site/src/pages/projects/index.astro` and `cv-data.ts` (Amendment 6: literal
  `---` in project titles → em dash; page title already "Projects")

## Must NOT touch

- `contract/**`, `gate/**`, `infra/**`, `.github/workflows/**`
- The allowlist / effective-visibility model from Wave 0b
- The CV rendering logic beyond the Amendment 6 normalisation

## Requirements (normative: the spec wins)

1. **Tokens (spec §5, ADR-0015 decisions 2 and 4).** Add `--color-band`,
   `--color-on-band`, `--rule-orange`, `--vt-orange-text` (`#c64600`). The band
   colours do **not** flip with the theme. Remove `--tracker-petrol`.
   `tokens.test.ts`: amend the verbatim list to drop `--tracker-petrol` (do not
   delete the assertion); widen the tracker-mapping carve-out **by name** for the
   four new tokens; add a positive test that each resolves to the `--vt-*` ramp.
   `contrast.mjs`: add `on-band`/`band` and `vt-orange-text`/`bg` text pairs; the
   suite must stay at zero below AA.
2. **Header band (spec §3).** Full-width maroon band; white wordmark "Jason
   Cusati" (Spectral 600) with "Virginia Tech" beneath in Plex Sans 0.8rem as
   plain affiliation text; primary nav right; 4px orange rule beneath. Current
   section underlined in orange. Mobile: one-row scrollable list, no hamburger
   JS. Secondary nav (Papers, Resumes) folds to "More" disclosure / footer.
3. **Footer (spec §4).** Three columns on `--color-surface` with a maroon top
   rule, collapsing to one on mobile. Column 1 Jason Cusati (department,
   university, email, Sign in); column 2 Elsewhere (icon + label, `rel="me"`,
   `rel="noopener"`, inline SVG only); column 3 This site (nav + Privacy, Email
   policy, RSS placeholder, "Built from source"). Bottom row: © year, provenance
   line, `build-info.json` short SHA linked to its commit.
4. **Home page (spec §2).** Identity block (`h1` name, drafted role line, the
   **academic** summary from `cv-data`, thin maroon rule, no portrait); "What I'm
   working on" three tenet cards from `research-portfolio.json`; "Recent" — five
   most recent effectively-public items across all sections (consume the Wave 0b
   allowlist-aware collection; never a manifest's raw visibility); "Ways in" —
   four links (Research, Projects, Writing, CV at `/cv/`).
5. **Shared chrome (spec §7, ADR-0015 decision 5).** `SiteBand` and `SiteFooter`
   under `src/components/`, imported by **both** `Base.astro` and
   `PrivateBase.astro`; the components carry **no navigation** (pass nav in as a
   prop). `private-structure.test.ts` is extended to allow/assert the shared
   components, not weakened.
6. **Data files (spec §9).** `footer.json` holds role line, department, Elsewhere
   links, provenance lines. `research-portfolio.json` holds the three tenets and
   their projects per plan §11, with `public` flags; inferred mappings marked.
7. **Portrait removal (Amendment 4).** Stop staging `public/photo_jason_1.jpeg`
   into `dist-public`; amend `PUBLIC_PHOTO_PATH` handling and its test;
   `og:image` default is the generated card (name, title, maroon band, orange
   rule, no portrait).
8. **Rest of the site (spec §6).** `SectionIndex` gets h1 + Spectral-italic lede
   + cards; `ItemPage` sits inside the new chrome; CV variant pages chrome only;
   `/signin/` banner+footer minus nav; `/p/**` shared band/footer with a
   "Members" tag and private nav.
9. **Amendment 6.** Normalise the CV project names' `---` to an em dash in
   `cv-data.ts` (or ask `cv`), and confirm the Projects page title is "Projects".

## Owner-decision drafts (the owner edits; do not invent facts)

- Role: `PhD student, Computer Science, Virginia Tech · Software engineer`.
- Department: `Department of Computer Science, Virginia Tech`.
- Elsewhere: `github`/`linkedin` from `cv-data` meta; Scholar/ORCID omitted until
  the owner supplies handles. No invented URLs.
- Tenet cards: Knowledge Graphs, Agentic Software Engineering, AI Safety, from
  plan §11.

## Evidence required

`npm test` (includes `tokens.test.ts`, `contrast.mjs` stays 0 below AA); public
and private builds; `check:no-private-in-public`; `check:private-links`; the OG
card has no portrait; no request leaves the origin (fonts/icons/images
self-hosted); `private-structure.test.ts` green; `governance-checks --layout` 4/4.

## Exit

The home page matches spec §2 in both themes with no portrait; band and footer
match §3–§4 on every page including `/signin/` and one `/p/**` page; contrast
suite zero below AA; leak check green; `og:image` is the generated card; a11y
pass; Chief Reviewer approve. Nothing merges until the a11y + adversarial round.
