# Contract: Site Implementation Engineer — Phase 1

Status: Active
Last updated: 2026-09-15
Owner: Chief Architect (Lead Architect)

Instance of the Universal Bounded-Contract Skeleton (agentic-governance
`llm/governance/patterns/prompt-patterns.md`, Pattern 2 Implementation), carrying
every element of `llm/governance/project-operating-system.md` §Agent Assignment
Contract. `<canon checkout>` is the path declared in
`llm/governance/governance-delta.md` §Canon Location.

```text
ROLE: You are the Site Implementation Engineer (Specialist 1) for sprint
  2026-09-hub, Phase 1 — Foundation (issue #10), working in djjay0131/website on
  branch feat/foundation.

OBJECTIVE: The Astro site under site/ builds for the new host at base path "/"
  with the Research Hub design system, layouts and section shells — without
  regressing any route the current site serves — and still builds for GitHub
  Pages.

REQUIRED READING (before writing anything):
  1. llm/sprints/2026-09-hub/STATE.md
  2. llm/sprints/2026-09-hub/contracts/phase-1-seams.md — binding interfaces.
  3. llm/master-roadmap.md §phase-1-foundation
  4. llm/governance/adr/0001-promote-website-to-hub-on-firebase-hosting.md and
     0003-keep-astro-with-react-islands.md
  5. llm/specs/2026-09-10-research-hub-design.md §4 (the section set), §5
     (frontend and design system), §8 (firebase.json), §12.
  6. Issue #10 (`gh issue view 10`).
  7. The site as it is now: site/astro.config.mjs, site/src/layouts/Base.astro,
     site/src/pages/**, site/src/lib/**, site/scripts/*.sh, site/package.json,
     .vscode/**, and .github/workflows/build.yml (read-only: learn what CI does
     with the site today; you do not edit it).
  8. <canon checkout>/llm/governance/definition-of-done.md §Implementation Work

REQUIRED SKILLS/WORKFLOWS: Superpowers and Constellize are not installed in this
  environment; do not invoke them. Do not invoke any /governance:* skill.

FILE CONTRACT:
  - You may create/edit ONLY:
      site/**
      firebase.json (create, at the repository root)
      .vscode/**
      llm/sprints/2026-09-hub/handoffs/site-phase-1.md
  - Do not modify: every other path — infra/**, .github/** (build.yml and ci.yml
    included), .gitignore, CLAUDE.md, AGENTS.md, CONTRIBUTING.md, .claude/**, and
    llm/** apart from your handoff. Do not modify or delete the local CV data
    under site/data/ (gitignored). Do not create gate/, contract/ or infra/. If
    you find a defect in a file you don't own, REPORT it; never fix it.

DELIVERABLES:
  D1 Host-agnostic URLs (SEAM-1). site/astro.config.mjs reads SITE_URL and
     SITE_BASE with the SEAM-1 defaults; outDir is dist-public; static output,
     no adapter. The existing `redirects` targets are expressed relative to the
     configured base — no literal "/website/". Every internal link and asset
     reference goes through the configured base. After a default build,
     searching site/dist-public for "/website/" finds nothing.
  D2 Design system (design doc §5). site/src/styles/tokens.css: Spectral
     (display), IBM Plex Sans (body), IBM Plex Mono (metadata); petrol accent
     #0F5C5A; brass for caution and clay for risk; complete light and dark
     palettes as CSS custom properties, switched by prefers-color-scheme with no
     JavaScript (ADR-0003). The design doc gives no hex values for brass and
     clay: choose them, keep body text and links at WCAG AA contrast (at least
     4.5:1) in both themes, and record every value and ratio in the handoff.
     Fonts are self-hosted (npm packages or files under site/) — never loaded
     from a third-party CDN at runtime. Base.astro's ad hoc palette is replaced
     by the tokens.
  D3 Layouts. site/src/layouts/Base.astro (chrome, navigation, footer, tokens),
     SectionIndex.astro (a section landing: title, lede, item list) and
     ItemPage.astro (one item: title, date and metadata, body, back link).
     Existing pages render inside Base.
  D4 Section shells — research, projects, writing, cv, phd (design doc §4).
     - Every existing route keeps its URL and content: /, /research/** (including
       the soa-agentic-se tracks), /projects/, /projects/[slug], /cv/[variant],
       /papers/, /resumes/.
     - New shells where none exist: /writing/ and /phd/ as empty-state pages on
       SectionIndex, and /cv/ as an index of the CV variants if absent.
     - The public navigation links research, projects, writing and cv, and keeps
       papers and resumes reachable. It never links phd. /phd/ carries
       <meta name="robots" content="noindex"> and is excluded from the sitemap.
     - No private content anywhere. The phd shell is an empty state.
  D5 firebase.json (SEAM-3), including deliberate cleanUrls / trailingSlash
     settings such that every route in D6's inventory resolves at the new host
     (a redirect to a canonical form is acceptable; a 404 is not). Document the
     resulting URL behavior.
  D6 Redirect map (SEAM-6). site/redirects/github-pages.json, generated — not
     hand-typed — by a script under site/scripts/ that inventories every route
     the Pages-variant build serves: every generated page, the asset paths the
     smoke test uses (for example /pdfs/academic.pdf), and every Astro
     `redirects` source. A test fails if the map misses an inventoried route.
  D7 CV data (SEAM-2). site/scripts/fetch-data.sh reproduces exactly what
     build.yml's inline "Fetch CV data and PDF" step produces, relative to site/,
     runnable from site/ with GH_TOKEN set. site/scripts/sync-local-data.sh works
     from its new location. .vscode/ configuration paths follow the move.
  D8 site/README.md replaces the Astro starter README: the SEAM-1 build interface,
     environment variables, data fetch and local development.
  D9 Handoff at llm/sprints/2026-09-hub/handoffs/site-phase-1.md: Summary ·
     Assumptions · Recommendations · Alternatives considered · Risks · Open
     questions · Related docs · ADR candidates — plus a Validation section with
     every command run and its result, the route-inventory count, the token
     values and contrast ratios, and the firebase.json URL behavior.

VALIDATION — run from site/ and report the results verbatim:
  - npm ci; npm test; npm run build (defaults); then search site/dist-public for
    "/website/" (must find nothing).
  - SITE_URL=https://djjay0131.github.io SITE_BASE=/website/ npm run build (must
    succeed — it is the Pages build).
  - npx astro check (report the result; fix errors you introduced; list, don't
    fix, errors that predate you).
  - Baseline: one test already fails locally —
    cv-data.test.ts > resolveVariant > "resolves academic variant with correct
    section order" (education length 4, expected 3). The local CV data is newer
    than the cv release CI tests against, and the test passes in CI. Do not
    modify that test or the CV data. Any other failing test is yours.
  - End with a default build, so site/dist-public reflects the default build.

DEFINITION OF DONE: <canon checkout>/llm/governance/definition-of-done.md
  §Implementation Work, plus each roadmap Phase 1 acceptance criterion in your
  scope, named in the handoff as either met (with evidence) or verifiable only at
  Checkpoint 2.

CONSTRAINTS:
  - Sprint scope boundary: Phase 1 only. NOT in scope: content collections or the
    manifest schema (Phase 2); the private build or HUB_OUTPUT (Phase 3);
    sign-in; gate rewrites; React (ADR-0003); search, RSS or OG images (Phase 6);
    serving the redirects (Phase 6).
  - The CV renders the same data as today. Do not change CV rendering logic
    beyond what the base path and layout migration require.
  - The seams are fixed by phase-1-seams.md. If one is wrong or insufficient,
    report it.
  - If a change would contradict an Accepted ADR, STOP and report.
  - No secrets, keys or tokens in any file.
  - Uncertain classification => semantic => human review.

OPEN QUESTIONS TO ANSWER:
  (a) Does any existing route change URL or disappear? (Expected: none.)
  (b) Which design doc §5 details did you have to decide yourself?

ADR CANDIDATES TO IDENTIFY: for example font hosting, theme switching, and the
  canonical URL form.

GIT: NEVER run git or gh mutations; read-only git and gh are allowed. The Lead
  Architect commits.

FINAL REPORT: the structured result requested at launch — files changed,
  validation results, acceptance-criteria status, open questions, seam issues.
```
