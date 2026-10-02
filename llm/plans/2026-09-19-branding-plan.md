# Research Hub — Branding and Look-and-Feel Plan

Status: Approved by the owner as design authority for Wave 0c (D14, 2026-10-01) · Written 2026-09-19 · Committed 2026-10-02
Location: `llm/plans/2026-09-19-branding-plan.md` — control plane. The Wave 0c `design-spec` stream turns §2–§7 and §11 into `llm/specs/…-branding-design.md` plus one ADR before anything builds; §9's open decisions and §11's *(inferred — confirm)* items are answered by the owner in that spec's review, not guessed.

This plan becomes design authority once approved: the harness turns it into
`llm/specs/2026-09-19-branding-design.md` plus one ADR, and executes it as **Wave 0c** of the
run-to-completion prompt (after private-by-default, before Phase 4), so every later page is built
on the new chrome rather than retrofitted.

## 1. What is there today (observed on the live site, 2026-09-19)

The home page is a CV hero: a round portrait, the name, the *industry* summary paragraph
("Results-oriented technical executive…"), three text links (email, GitHub, LinkedIn), and three
buttons (View CV, Download PDF, Papers). Below that the page is empty to the footer. The header is
the name as a wordmark, six nav links, and the VT maroon-over-orange rule. The footer is two
lines: the copyright and the Sign in link.

Three things follow from that. The page says "résumé", not "research hub": the summary is the
industry one, and nothing on it mentions Virginia Tech, the PhD, or what the research is about.
The photo is the only visual element, so removing it leaves a bare page unless something replaces
its job of anchoring the layout. And the footer carries none of the information a visitor looks
for at the bottom of an academic site — affiliation, contact, links, the site's own provenance.

Two constraints are already on the record and this plan respects both. Every asset is
self-hosted; nothing loads from a CDN (Base.astro). And the VT logos and HokieBird are trademarks:
`brand.vt.edu` permits download only by authorized employees or with approval from the Office of
Licensing and Trademarks (STATE, 2026-09-17). Colours are not trademarks; the marks are.

## 2. Direction

The site is the public face of a PhD researcher at Virginia Tech who also has an engineering
career behind him. The home page should read that way in the first screen: name, what the
research is, that it is at VT, and where to go next. The design language stays what Phase 1 set
— Spectral display, IBM Plex Sans body, IBM Plex Mono for metadata, the VT maroon/orange accent
family, light and dark — and gets a proper header band, a real footer, and a home page with
structure. No portrait anywhere on the public site; the photo stays available to the CV PDFs
that already include it.

Tone: institutional, calm, text-led. VT's own sites are a good reference for the header/footer
shape (a dark band, white wordmark, a thin orange rule) without copying their markup or marks.

## 3. Home page

Top to bottom, on the standard content width:

**Identity block.** `Jason Cusati` as an h1 with a one-line role beneath it in Plex Sans:
"PhD student, Computer Science, Virginia Tech · Software engineer" (exact wording is the owner's;
it should be sourced from the CV data's `meta` so it is not hand-maintained). Then a two- or
three-sentence *research* statement, sourced from the academic summary in `cv-data`, not the
industry one. No photo. A thin maroon rule closes the block.

**What I'm working on.** Three *tenet* cards — Knowledge Graphs, Agentic Software Engineering,
AI Safety — each with a one-sentence statement of the question it asks and, beneath it, the named
projects under that tenet as compact links (the KG card lists Research.AI, Construction.AI,
Baseball.AI, Traffic.AI and the planned ecology project). The full portfolio, with each project's
goal and status, is §11 of this plan and becomes `site/src/data/research-portfolio.json`, which
drives both these cards and the Research section index. It is owner-edited, not manifest-driven,
so the home page never lists a private item by accident; the leak check covers it anyway.

**Recent.** A short dated list (five items) of the most recent public items across all sections,
generated from the allowlisted manifests. This is the one place the home page proves the site is
alive.

**Ways in.** A row of four large links mirroring the primary nav: Research, Projects, Writing,
CV — each with a one-line description. This replaces the three buttons. The CV entry points at
`/cv/` (the variant chooser), not at one variant.

Everything above is static and builds from data the hub already has, so it is on the public path
(§12.4) and needs no new content source.

## 4. Header (banner)

A full-width band, not the current transparent bar. In light theme: Chicago Maroon `#861f41`
background, white wordmark and links, a 4px Burnt Orange `#e5751f` rule beneath. In dark theme:
the band stays maroon (it is the brand, and white-on-maroon is 8.4:1), the rule stays orange. This
is the one element that does not swap accent with the theme, and `tokens.test.ts`'s accent pin
must be extended to allow it explicitly rather than loosened.

Left: the wordmark "Jason Cusati" in Spectral 600, and beneath it in Plex Sans 0.8rem
"Virginia Tech" as plain text (this is the affiliation line, not a logo). Right: the primary nav
(Research, Projects, Writing, CV) with the current section underlined in orange; the secondary
nav (Papers, Resumes) folds into a "More" disclosure on narrow screens and into the footer on all
screens. On mobile the nav collapses to a single-row scrollable list; no hamburger JavaScript.

**About the VT logo.** The owner asked for VT logos in the banner. The plan does **not** place the
VT logo or the HokieBird until permission is on the record, because the existing STATE entry is
correct: they are registered marks, and a personal site is not an authorized use. Two paths:

1. *Ask.* Email the Office of Licensing and Trademarks (`licensing@vt.edu` is the published
   contact) describing the site as a current student's academic portfolio and asking whether the
   university wordmark or the "VT" monogram may appear in the header with an affiliation line.
   If approved, the mark goes in the header left of the wordmark, sized to the cap height, with
   the approval recorded in `llm/governance/adr/`. The harness cannot do this; it is an owner
   action and a hard-stop item.
2. *Don't wait.* Ship the banner with the affiliation text, the colours, and an
   orange "VT"-style monogram of the owner's own initials — or simply no mark. The colours
   already make the association unmistakably.

The plan ships path 2 now and swaps in the mark if path 1 succeeds. Either way, the department
name and a link to the owner's VT profile or the department site belong in the footer, which
needs no permission.

## 5. Footer

A traditional three-column footer on a `--color-surface` band with a maroon top rule, collapsing
to one column on mobile. Content is data-driven from `cv-data` `meta.contact` plus a small
`site/src/data/footer.json` for anything the CV does not carry.

Column 1 — *Jason Cusati*: department and university as text, a mailing line if wanted, the
email address, and the "Sign in" link (kept, per the disclosure decision on record).

Column 2 — *Elsewhere*: GitHub, LinkedIn, Google Scholar, ORCID, and whichever social accounts
the owner names (see §9). Each is an icon plus a text label; icons are inline SVG in the repo,
not a font or a CDN. `rel="me"` on each for IndieWeb verification, `rel="noopener"` on all.

Column 3 — *This site*: Research, Projects, Writing, CV, Papers, Resumes, RSS (Phase 6),
Privacy, Email policy, and a "Built from source" line linking to the `website` repository.

Bottom row: © year, "Content published from satellite repositories through a signed manifest
contract" (one line of provenance, because that is the point of the system), and the build
identifier already served in `build-info.json` as a monospace short SHA linking to the commit.

## 6. Tokens, type and colour

Keep Spectral / Plex Sans / Plex Mono. Do **not** add VT's brand typefaces: they are the
university's identity system, the current three are already self-hosted and licensed, and mixing
five families reads as noise. Add `#c64600`, VT's own darkened orange, as `--vt-orange-text` so
orange can carry text and the underline in the light theme where `#e5751f` fails AA at 3:1; the
contrast suite (`site/scripts/contrast.mjs`) gains the new pairs and must stay at zero below AA.
Remove `--tracker-petrol`, which paints nothing and exists only because a test pins it; the test
changes with it in the same PR.

Add a `--color-band` and `--color-on-band` pair for the header and footer bands, and a
`--rule-orange` for the 4px rule, so the bands are tokens rather than literals.

## 7. The rest of the site, for consistency

Section index pages get the same identity treatment as the home page: an h1, a lede in Spectral
italic, and cards instead of a bare list. Item pages (the `format: html` frame that wraps
satellite content like the KGIS docs) get the new banner and footer around the same thin frame so
embedded sites sit inside the chrome without fighting it. The CV variant pages are left as they
are apart from the chrome. The sign-in and "not shared with you" pages get the banner and footer
too, minus the nav, so a member sees the same site on both sides of the gate. The private build
(`/p/**`) renders the same chrome with a discreet "Members" tag in the band and the private
navigation.

OG images (Phase 6) follow the same rules: name, title, maroon band, orange rule, no portrait.
The current default `og:image` is the portrait; it changes in this wave to a generated card, so
link previews stop showing the face before Phase 6 arrives.

## 8. Execution — Wave 0c in the run-to-completion prompt

Branch `feat/branding`, issue `hub-brand`. Streams and contracts:

- **`design-spec`** (control plane): writes `llm/specs/2026-09-19-branding-design.md` from this
  plan and an ADR recording the no-portrait decision, the band colours, the no-logo-without-
  permission rule, and the removal of `--tracker-petrol`. Nothing builds until the spec is in.
- **`site`**: tokens, `Base.astro` header and footer, `index.astro`, `SectionIndex.astro`,
  `ItemPage.astro`, the two data files, inline SVG icons, the OG card generator, and the
  `tokens.test.ts` and `contrast.mjs` updates. It may not touch the CV rendering or
  `hub-content.mjs` beyond reading the allowlisted item list for the Recent block.
- **`a11y-tester`**: keyboard order, skip link, focus rings on the band, `aria-current`, contrast
  in both themes, reduced-motion (there should be no motion to reduce), 320px layout, print
  stylesheet still hiding the chrome.
- **Red Team** for this wave: the Recent block and the home cards must never surface a
  non-allowlisted item; the OG card must never carry a private title; no request leaves the
  origin (fonts, icons, images all self-hosted — prove with a network capture).
- **Dissenter**: argues for keeping the photo somewhere (an About page?) and for the logo path;
  the Lead Architect records the disposition.

Exit: the live home page matches §3 in both themes with no portrait; header and footer match
§4–§5 on every page including `/signin/` and one `/p/**` page signed in; contrast suite green;
leak check green; `og:image` no longer the portrait; Chief Reviewer approve.

## 9. Decisions the owner makes before this wave runs

1. The one-line role under the name, and whether the department is named (which department).
2. Which links go in the Elsewhere column. Known: GitHub, LinkedIn. Likely: Google Scholar,
   ORCID. Unknown: X/Bluesky/Mastodon, YouTube, anything else — and the handles.
3. Whether to ask VT Licensing for the mark (path 1), or ship without it (path 2). Default: 2.
4. The three "working on" cards' titles and one-liners (the harness can draft; the owner edits).
5. Whether an About page should exist to hold the portrait and a longer biography. Default: no
   page; the CV carries the biography.

## 10. Readiness review (2026-09-19)

Reviewed against `main` at `f98a928` with a clean install, a fixture-content public build, the
full test suite, the contrast suite and the leak check. Verdict: **ready, with six amendments**,
and it must run **after** Wave 0b (private by default), not before.

**Baseline is green.** `npm ci` on Node 22.22; `HUB_OUTPUT=public astro build` produces 26 pages
in 3.5s; `vitest` 199 passed, 1 skipped, across 16 files; `contrast.mjs` reports 52 pairs, 0
below AA; the leak check scans 157 files and passes. Nothing is broken that the branding wave
would have to fix first.

**Amendment 1 — there are two chromes, not one.** The private build does not use `Base.astro`.
`src-private/layouts/PrivateBase.astro` is a deliberate sibling (its comment explains why: the
public nav 404s inside `/p/`), with its own header ("Members' area", a "Private · shared with
you" badge), its own footer ("Not for redistribution") and its own font imports. §7's "same
chrome on both sides of the gate" therefore means extracting the band and footer into shared
components under `src/components/` that both layouts import, keeping the two layouts' navigation
separate. `private-structure.test.ts` polices what `src-private` may import; the shared
components must live where that test allows, and the test is extended, not weakened.

**Amendment 2 — `tokens.test.ts` will reject the new tokens as written.** Two assertions bind:
"carries over the tracker palette verbatim" blocks removing `--tracker-petrol`, and "maps each
site token onto its tracker colour, departing only for AA" fails any new `--color-*` token that
does not resolve to a tracker value, with a carve-out exactly three tokens wide
(`color-accent`, `color-link`, `color-focus`). The band tokens (`--color-band`,
`--color-on-band`, `--rule-orange`, `--vt-orange-text`) need the carve-out widened by name in
the same PR, with a positive test that each resolves to the `--vt-*` ramp; and dropping
`--tracker-petrol` means amending the verbatim list rather than deleting the assertion. The
`TEXT_PAIRS` list in `contrast.mjs` is enumerated by hand, so `on-band`/`band` and
`vt-orange-text`/`bg` pairs are added there or they are never checked.

**Amendment 3 — the CV data does not carry what the footer and identity block need.**
`meta.yaml` has `name`, `contact.{email, linkedin, github}`, `photo`, `include_photo`,
`name_variants`. There is no role line, department, Scholar, ORCID or social handles, and the
summaries are exactly two (`academic`, `industry`). Two choices: extend `cv-data` in the `cv`
repo (a satellite change, a data-schema bump the hub must claim per ADR-0008) or keep it all in
`site/src/data/footer.json` and `home.json` in the hub. The plan should pick the hub file for
everything that is not already in `cv-data`: it needs no satellite round-trip and no schema
bump, and the owner edits one file.

**Amendment 4 — the portrait leaves in two places, not one.** The home page reads
`meta.include_photo`; setting it false in `cv` removes the hero image but the build still stages
`public/photo_jason_1.jpeg` (`sync-content.test.ts` asserts it does) and `Base.astro` uses it as
the default `og:image`. Removing the face means: stop staging the photo to `dist-public`
(amend `PUBLIC_PHOTO_PATH` handling and its test), change the `og:image` default to the
generated card, and have the Red Team grep `dist-public` for the filename. The CV variant pages
that embed the photo keep it only if the owner says so — today the PDFs carry it regardless.

**Amendment 5 — sequencing.** Today's fixture build stages `public/pdfs/anthropic-fellow.pdf`
into the public output, which is exactly what Wave 0b changes. The Recent list and the
"working on" cards on the new home page read the allowlisted item set, which does not exist
until Wave 0b lands. Branding is therefore Wave 0c, after 0b, as the plan already places it —
this review confirms the dependency is real, not nominal.

**Amendment 6 — the projects page has a rendering defect worth fixing in passing.** The live
titles show literal `---` ("Multi Robot System --- Cloud + Edge Architecture") because the CV
data's project names carry an em-dash spelled as three hyphens and headings are not run through
the Markdown renderer that fixes the summaries. It is a data-or-render question; the `site`
stream resolves it either by normalising in `cv-data.ts` or by asking `cv` to write the
character. Also the page title "Selected Projects & Research" is the §2.7 fix already assigned.

Nothing else in the plan is contradicted by the code. The contrast and token tests are the right
kind of guard and the plan should keep leaning on them; the Skeptic Verifier's job in this wave
is to show that a wrong band colour actually turns them red.

## 11. Research portfolio — what "What I'm working on" actually contains

Three tenets, each a standing research question; projects sit under a tenet and carry a goal, a
status and a home. This is the content of `site/src/data/research-portfolio.json` and the
organising structure of the `/research/` index (tenet → projects → digests), replacing today's
single hand-written entry. Sources: the live Projects page (owner's own wording), the repos'
READMEs and design docs, and the owner's statement of 2026-09-19. Where a mapping from a
project name to a repository is my inference rather than the owner's words, it is marked
*(inferred — confirm)*.

### Tenet 1 — Knowledge Graphs for decision-making and provenance with AI

*The question:* how a knowledge graph can organise information so that AI-assisted decisions
carry their provenance — every answer traceable to evidence, every uncertain extraction kept out
of the canonical graph until it is curated.

The shared substrate is **KGIS + KGCS** (`agentic-kgis`, `agentic-kgcs`): a deterministic,
evidence-first ingestion platform whose only write surface is a candidate ledger, and a curation
service that resolves, merges and commits. Ingestion never writes a graph; curation decides what
becomes canonical; runs are replayable. The domain projects below are its adopters — each is
both a real application and a test of whether the substrate is reusable across domains.

- **Research.AI** — *(inferred — confirm: `agentic-kg` + the Denario integration)*. "Agentic
  Knowledge Graphs for Research Progression": an orchestrated Navigator / Extractor /
  Continuation agent system building an LLM-curated research KG — problems, assumptions,
  constraints, evidence spans, datasets, metrics — as the provenance substrate for
  research-assistant responses. Status: staging on Cloud Run; approaching the experimental
  comparison against LLM-generated graphs. Goal: show that a curated, provenance-bearing
  research graph gives better-grounded answers than an LLM's own recall. Related: the VT PhD
  qualifier ("Agentic AI for Autonomous Research"), the Amazon–VT CFP proposal, the Springer
  chapter on governed agentic research.
- **Construction.AI** — `construction-ai` and `construction-ai-proposal`. LLM- and KG-backed
  material take-off from architectural drawings (DWG / DXF / PDF → geometry → JSON take-off with
  OR-Tools cut-list optimisation, backed by a Neo4j LLM-curated KG). Phase 1 MVP on Cloud Run;
  Phase 5 adds a VVUQ layer for engineering-simulation reproducibility (extends the
  Euler–Bernoulli beam VVUQ paper, AOE/CS/ME 6444). Goal: a take-off whose every quantity is
  traceable to a drawing element and whose simulation inputs carry quantified uncertainty.
- **Baseball.AI** — *(inferred — confirm: `baseball-ai`, private)*. The KGIS docs name a
  "baseball analytics app" as an adopter. Goal and status: owner to supply one sentence each.
- **Traffic.AI** — *(inferred — confirm: VTTSI, `cs6604-trafficsafety`, the `vttsi-*` repos,
  and the KG-RTSI digital-twin proposals)*. "LLM-Adaptive Intersection Safety Scoring":
  provenance-tracked evidence ingestion (NWS weather, VDOT/511 cameras) → deterministic RT-SI
  and MCDM baselines → Claude adaptive adjustment with grounding guardrails and deterministic
  fallback → honest-null ablation evaluation. Two proposals extend it: a Traffic Safety KG +
  Digital Twin with LangGraph-orchestrated agents and explainable index generation, and a
  V&V digital-twin semester project (CTM dynamics, EKF state estimation, Lyapunov stability,
  formal verification conditions, UQ). Goal: a real-time safety index that can explain itself
  and degrade deterministically when the model is wrong.
- **Ecology project (insects and weeds) — planned, with a collaborator at UCSB.** Not started;
  a proposal exists but was not found in the personal Drive, Gmail or any reachable GitHub
  repository — **owner to supply its location** so the goal can be stated in the proposal's own
  words. Placeholder card: name, "planned", one sentence, no link.

### Tenet 2 — Agentic software engineering

*The question:* what agentic development has actually built versus what it has measured, and
how to govern agents so their output is reviewable, reproducible and honest.

- **State of the art in agentic SE** (`soa-agentic-se`, private until publication). Taxonomy,
  evidence map and pilot experiment; two research tracks published as digests on this site —
  agentic harnesses (268-source store) and agent memory (with Atharva and Chris Brown). Goal:
  a defensible map of the field and a memory-evaluation method.
- **Agentic governance and agentic research** (`agentic-governance`, `agentic-research`):
  the operating system these projects run under — bounded contracts, ADRs, governance deltas,
  independent audit — and the installable scaffolding for paper and proposal repos. Goal:
  make governed, reproducible agent work the default rather than the exception; the Springer
  chapter proposal ("Governed Agentic Research", due 2026-10-23) is its written form.
- **AI-aware application architecture** — the three-layer hybrid (deterministic skeleton,
  adaptive agent-driven decision points, shared capability substrate). Design work, not yet a
  repository; listed as a thread, not a project card, unless the owner wants it shown.

### Tenet 3 — AI safety

*The question:* whether a model's stated reasoning is faithful to its computation, and how to
tell from the inside.

- **MATS 12 application — mechanistic interpretability** (`mats-12-application`): the J-Lens
  relational-binding experiment, submitted to Neel Nanda's stream (Winter 2026–27). Goal: a
  concrete, controlled result on relational binding; the literature scan covers CoT
  faithfulness and model biology. Public card only after the owner decides what of the
  application is public — default private.
- The VTTSI grounding-guardrail and honest-null work also belongs here as applied safety, and
  the card may cross-reference it.

### What the owner supplies before this becomes data

One sentence of goal and one of status for Baseball.AI; the location of the ecology proposal;
confirmation of the four *(inferred)* mappings; whether AI-aware architecture and the MATS work
get public cards; and the order the tenets appear in (default as above).
