# Research Hub — Branding Design (design authority for Wave 0c)

Status: Approved for Wave 0c (D14, 2026-10-01) — §9 owner decisions pending confirmation
Date: 2026-10-01
Owner: Jason Cusati (`djjay@vt.edu`)
Source plan: `llm/plans/2026-09-19-branding-plan.md` (approved as design authority by D14)
Decision record: `llm/governance/adr/0015-branding-no-portrait-band-and-mark-rule.md`

This spec turns the plan's §2–§7 and §11 into normative design authority for Wave 0c, and
folds in the plan's own readiness review (§10, six amendments). Where this spec and the plan
disagree, this spec wins; where this spec is silent, the plan informs. §9's owner decisions
and §11's *(inferred — confirm)* items are **not guessed here** — they are listed in
§Owner decisions and must be confirmed at spec review before the build stream starts.

## 1. Direction

The site is the public face of a PhD researcher at Virginia Tech with an engineering
career behind him. The first screen must say: name, what the research is, that it is at VT,
and where to go next. Art direction stays what Phase 1 set — Spectral display, IBM Plex Sans
body, IBM Plex Mono metadata, VT maroon/orange, light and dark — with a proper header band,
a real footer, and a structured home page. **No portrait anywhere on the public site**; the
photo remains available to the CV PDFs that already embed it. Tone: institutional, calm,
text-led.

## 2. Home page (`site/src/pages/index.astro`)

Top to bottom, standard content width:

1. **Identity block.** `Jason Cusati` as `h1`; a one-line role beneath in Plex Sans; then a
   two-to-three-sentence **research** statement sourced from the academic summary in
   `cv-data` (not the industry one). No photo. A thin maroon rule closes the block. The role
   line is owner-supplied (§Owner decisions) and lives in `site/src/data/footer.json`
   (Amendment 3), not `cv-data`.
2. **What I'm working on.** Three tenet cards — Knowledge Graphs, Agentic Software
   Engineering, AI Safety — each a one-sentence question and the named projects under it as
   compact links. Driven by `site/src/data/research-portfolio.json` (§Portfolio).
3. **Recent.** A dated list of the five most recent **public, allowlisted** items across all
   sections. This is the one home-page block that reads the content collection; it must
   consume the **effective (allowlisted) visibility** that Wave 0b introduces, never a
   manifest's raw `visibility`.
4. **Ways in.** Four large links mirroring the primary nav — Research, Projects, Writing, CV
   — each with a one-line description. The CV link points at `/cv/`.

All four blocks are static build-time output on the public path; no new content source is
introduced.

## 3. Header band

A full-width band, not the current transparent bar.

- Light theme: Chicago Maroon `#861f41` background, white wordmark and links, a 4px Burnt
  Orange `#e5751f` rule beneath. Dark theme: the band stays maroon, the rule stays orange —
  the one element that does not swap accent with the theme. White-on-maroon is 8.4:1.
- Left: the wordmark `Jason Cusati` in Spectral 600; beneath it, Plex Sans 0.8rem,
  `Virginia Tech` as **plain affiliation text, not a logo**.
- Right: the primary nav (Research, Projects, Writing, CV), current section underlined in
  orange. The secondary nav (Papers, Resumes) folds into a "More" disclosure on narrow
  screens and into the footer on all screens. Mobile: one-row scrollable list, **no
  hamburger JavaScript**.

**The VT mark.** No VT logo or HokieBird is served until permission is on the record
(licensing@vt.edu; the marks are registered, a personal site is not an authorized use).
Wave 0c ships without the mark (plan path 2): affiliation text, the colours, and no mark.
If the owner later secures permission, the mark is added by ADR amendment and placed left
of the wordmark at cap height.

## 4. Footer

Traditional three-column footer on a `--color-surface` band with a maroon top rule,
collapsing to one column on mobile. Data-driven from `cv-data` `meta.contact` plus
`site/src/data/footer.json`.

- **Column 1 — Jason Cusati.** Department and university as text, optional mailing line,
  email, and the `Sign in` link (kept).
- **Column 2 — Elsewhere.** GitHub, LinkedIn, and the owner's confirmed set (Scholar, ORCID,
  socials). Icon (inline SVG in-repo, never a font or CDN) plus text label; `rel="me"` on
  each, `rel="noopener"` on all.
- **Column 3 — This site.** Research, Projects, Writing, CV, Papers, Resumes, RSS (Phase 6),
  Privacy, Email policy, and a "Built from source" link to the `website` repository.
- **Bottom row.** © year; one provenance line ("Content published from satellite
  repositories through a signed manifest contract"); the `build-info.json` short SHA as a
  monospace link to its commit.

## 5. Tokens, type and colour

- Keep Spectral / Plex Sans / Plex Mono. Do **not** add VT brand typefaces.
- Add VT's darkened burnt orange as `--vt-orange-text`, for orange text and the
  light-theme underline where `#e5751f` fails AA.

  > Amended 2026-10-02 (Wave 0c build). The token holds **`#c34600`**, not the
  > `#c64600` first specified: measured against `--color-bg`, `#c64600` is 4.48:1
  > — 0.02 below AA — and this spec requires the contrast suite at zero below AA.
  > `#c34600` is the nearest same-family darkening that passes (4.57:1), exactly
  > as `--color-muted` and `--color-caution` already depart from their tracker
  > values. The owner may prefer the branded `#c64600` and accept the 4.48:1; that
  > is an open question, not a defect.
- Add `--color-band`, `--color-on-band`, `--rule-orange` so the bands and rule are tokens,
  not literals.
- **Remove `--tracker-petrol`** (it paints nothing; only a test pinned it).
- `site/scripts/contrast.mjs` gains the `on-band`/`band` and `vt-orange-text`/`bg` pairs (its
  `TEXT_PAIRS` list is hand-enumerated) and must stay at **zero below AA**.

## 6. The rest of the site

- `SectionIndex.astro`: same identity treatment — `h1`, Spectral-italic lede, cards.
- `ItemPage.astro`: the new banner and footer around the same thin frame, so framed
  satellite content (e.g. KGIS docs) sits inside the chrome.
- CV variant pages: chrome only, content unchanged.
- `/signin/` and the "not shared with you" page: banner and footer, **minus the nav**.
- The private build (`/p/**`): the same band and footer, a discreet "Members" tag in the
  band, and the private navigation.
- `og:image`: the default stops being the portrait in this wave — a generated card (name,
  title, maroon band, orange rule, no portrait).

## 7. Shared chrome (readiness Amendment 1)

There are **two** layouts, and both must show the same band and footer:
`site/src/layouts/Base.astro` (public) and `site/src-private/layouts/PrivateBase.astro`
(private; it deliberately does not import `Base.astro` because the public nav 404s under
`/p/`). The band and footer are therefore extracted into **shared components under
`site/src/components/`** that both layouts import, keeping the two navigations separate.
`site/scripts/private-structure.test.ts` polices what `src-private` may import: the shared
components must live where that test allows, and the test is **extended, not weakened**, to
cover them.

## 8. Test changes (readiness Amendment 2)

`site/src/tokens.test.ts` binds two assertions that the new tokens break as written:

- "carries over the tracker palette verbatim" — amend the verbatim list to drop
  `--tracker-petrol` rather than delete the assertion.
- "maps each site token onto its tracker colour" — widen the carve-out **by name** for
  `--color-band`, `--color-on-band`, `--rule-orange`, `--vt-orange-text`, and add a positive
  test that each resolves to the `--vt-*` ramp.

The Skeptic Verifier's job this wave is to show a **wrong band colour** actually turns these
red.

## 9. Data files (readiness Amendments 3 and 4)

- `site/src/data/footer.json` — everything the footer and identity block need that
  `cv-data` does not carry: role line, department, Elsewhere links, provenance lines. Hub
  file, no satellite round-trip, no schema bump.
- `site/src/data/research-portfolio.json` — the portfolio (§Portfolio).
- **Portrait removal is two places, not one.** Setting `meta.include_photo` false removes the
  hero image, but the build still stages `public/photo_jason_1.jpeg` and `Base.astro` used it
  as the default `og:image`. The `site` stream must: stop staging the photo to `dist-public`
  and amend the `PUBLIC_PHOTO_PATH` handling and its test; change the `og:image` default to
  the generated card; and the Red Team greps `dist-public` for the filename. The CV PDFs the
  owner already ships keep the photo.

## 10. Portfolio content (`research-portfolio.json`)

Three tenets, each a standing question, each with projects carrying a goal, a status and a
home. Content is the plan's §11. The JSON shape:

```json
{
  "tenets": [
    {
      "id": "knowledge-graphs",
      "title": "Knowledge Graphs for decision-making and provenance with AI",
      "question": "…",
      "projects": [
        { "name": "Research.AI", "goal": "…", "status": "…", "href": "…", "public": true }
      ]
    }
  ]
}
```

The plan's §11 marks four project→repo mappings and several statuses *(inferred — confirm)*;
those are **owner confirmations before the file is authored** (§Owner decisions). The file is
owner-edited, not manifest-driven, so the home page never lists a private item by accident;
the leak check covers it anyway.

## 11. Sequencing and the projects defect

- **Wave 0c runs after Wave 0b** (readiness Amendment 5): the Recent block and the cards read
  the allowlisted item set, which does not exist until 0b lands.
- **Projects rendering defect** (Amendment 6): live titles show literal `---` because the CV
  data spells an em-dash as three hyphens and headings are not Markdown-rendered. The `site`
  stream normalises in `cv-data.ts` or asks `cv` to write the character; the page title
  becomes "Projects" (§2.7, D7).

## Owner decisions required before the build stream starts (plan §9)

1. The one-line role under the name, and whether/how the department is named.
2. The Elsewhere links and handles (GitHub and LinkedIn known; Scholar/ORCID/socials?).
3. VT Licensing: ask (path 1) or ship without the mark (path 2)? **Default: path 2.**
4. The three card titles and one-liners (the harness may draft; owner edits).
5. Any About page to hold the portrait/biography? **Default: no.**
6. The four *(inferred)* project→repo mappings and the missing goals/statuses in §11.

## Exit criteria (plan §8)

Home page matches §2 in both themes with no portrait; header and footer match §3–§4 on every
page including `/signin/` and one signed-in `/p/**` page; contrast suite zero below AA;
leak check green; `og:image` no longer the portrait; `tokens.test.ts` amended with positive
replacements; a11y pass; Chief Reviewer approve.

## Cross-references

- `llm/plans/2026-09-19-branding-plan.md` — the approved source plan
- `llm/governance/adr/0015-branding-no-portrait-band-and-mark-rule.md`
- `llm/governance/adr/0005-two-output-build-with-leak-check.md`, `0011`
- `llm/sprints/2026-09-hub/STATE.md` D13, D14; §Repository hygiene, 2026-10
