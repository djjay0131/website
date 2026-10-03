# Handoff — `site`, Wave 0c (branding)

Stream: `site`
Wave: 0c — branding
Branch: `feat/branding`
Date: 2026-10-02
Contract: `llm/sprints/2026-09-hub/contracts/site-wave-0c.md`
Design authority: `llm/specs/2026-10-01-branding-design.md` (approved D14)
Decision: `llm/governance/adr/0015-branding-no-portrait-band-and-mark-rule.md`
Plan: `llm/plans/2026-09-19-branding-plan.md` (§2–§7, §11)

## Summary

Wave 0c is implemented and green locally. The maroon band header (no VT mark,
affiliation as plain text), the three-column data-driven footer, the new home
page (identity + three tenet cards + Recent + Ways in), the shared
`SiteBand`/`SiteFooter` components imported by **both** layouts, the new tokens,
the portrait removal and the generated `og:image` card, the SectionIndex card
treatment, `/signin/` chrome minus nav, and the `/p/**` Members band are all in.
Amendment 6 (`---` → em dash in project names, Projects title "Projects") is done.

Verified locally from `site/` on 2026-10-02:

- `npm test` — **295 passed, 1 skipped** (23 files). The two new/amended guards
  (`tokens.test.ts` band/VT positive tests, `private-structure.test.ts` shared
  chrome block, `sync-content.test.ts` "NO portrait") are included.
- `npm run contrast` — **56 pairs, 0 below AA.**
- `npm run build:public` — 26 pages; `og-card.png` generated; **no
  `photo_jason_1.jpeg` in `dist-public`**; default `og:image` =
  `https://jason.cusati.us/og-card.png`.
- `npm run check:no-private-in-public` — PASS (4 private items, 162 files).
- `npm run check:publish-allowlist` — PASS (14 entries, 0 conflicts, 0 stale).
- `npm run build:private` — 5 pages, 4 private items, 89 files.
- `npm run check:private-links` — PASS (8 pages; 84 outbound anchors allowed).
- `node ~/code/agentic-governance/plugin/scripts/governance-checks.mjs --layout`
  — **4 of 4 checks passed** (governance-links, adr-index, adr-status, layout).

**One deviation from the spec's literal hex, flagged for the owner/ADR:** the
spec says `--vt-orange-text: #c64600`. On `--color-bg` that measures **4.48:1**,
0.02 below AA, so the contract's "zero below AA" cannot hold with it. I used the
nearest same-family darkening, **`#c34600` (4.57:1)**, and the token comment
records the reason. See Open questions #1. This is the only place the build
departs from a named value in the spec.

## What changed (by file)

**Tokens / colour (spec §5, ADR-0015 decisions 2 & 4)**

- `site/src/styles/tokens.css` — added the fixed band primitives `--vt-band`
  `#861f41`, `--vt-on-band` `#ffffff`, `--vt-rule` `#e5751f` and
  `--vt-orange-text`; added the site tokens `--color-band`, `--color-on-band`,
  `--rule-orange` pointing at the fixed ramp (not overridden in the dark block,
  so they do not flip); dark theme flips only `--vt-orange-text` to
  `var(--vt-orange)`; **removed `--tracker-petrol`** (light + dark) and updated
  the mapping comment. `--tracker-petrol-soft` remains (still in the palette
  list; not removed by the spec).
- `site/src/styles/tokens.test.ts` — dropped `petrol` from `TRACKER_PALETTE`
  (assertion kept), widened the carve-out **by name** with `color-band`,
  `color-on-band`, `rule-orange`, `vt-orange-text`, and replaced the positive
  test with `VT_RAMP`-based checks that every brand token resolves to the VT
  ramp in both themes.
- `site/scripts/contrast.mjs` — added `["color-on-band","color-band"]` and
  `["vt-orange-text","color-bg"]`; noted the accent rows' former
  `tracker-petrol` source.

**Shared chrome (spec §3, §7; ADR-0015 decision 5)**

- `site/src/components/SiteBand.astro` **(new)** — full-width maroon band,
  Spectral-600 wordmark, Plex Sans 0.8rem "Virginia Tech" affiliation, primary
  nav right, current section underlined in `--rule-orange`, 4px orange rule,
  one-row scrollable nav under 600px, secondary nav in a `<details>` "More" under
  700px (no JS). **Carries no navigation**: `nav`/`secondaryNav` arrive as props;
  a `band-actions` slot carries the private sign-out.
- `site/src/components/SiteFooter.astro` **(new)** — three columns on
  `--color-surface` with a maroon top rule; column 1 contact + Sign in, column 2
  Elsewhere (inline SVG icon + label, `rel="me noopener"`), column 3 This site
  (nav + Privacy/Email policy/RSS placeholder/Built from source); bottom row ©,
  provenance, `build-info.json` short SHA linked to its commit. **No hard-coded
  navigation.**
- `site/src/components/SiteIcon.astro` **(new)** — inline, in-repo SVG icons
  (github, linkedin, rss, mail). No icon font, no CDN.
- `site/src/lib/footer.mjs` **(new)** — reads `src/data/footer.json` (resolved
  against `process.cwd()`; the `import.meta.url` trap that fails a prerender
  build), resolves Elsewhere handles from `cv-data` `meta.contact` (never
  hard-coded), and reads `public/build-info.json` for the short SHA.
- `site/src/layouts/Base.astro` — imports both shared components; `meta.name`
  wordmark; `hideNav` prop for `/signin/`; default `og:image` is now
  `${base}og-card.png`; builds the public and footer nav and the footer data.
- `site/src-private/layouts/PrivateBase.astro` — imports the **same** two
  components from `../../src/components/`; `membersTag="Members"`, the private
  navigation as a prop, and the sign-out button in `band-actions`. Public links
  in the private footer point at the **canonical origin** (absolute outbound
  anchors) so `check:private-links` stays green.
- `site/scripts/private-structure.test.ts` — extended with a "shared band and
  footer are safe for both builds" block (components exist under
  `src/components/`, both layouts import them, the private→public arrow is the
  only direction, the components import nothing private and hard-code no nav).
  The existing import-direction guarantee is unchanged.

**Home page (spec §2)**

- `site/src/pages/index.astro` — identity block (`h1` name, role line from
  `footer.json`, academic summary from `cv-data`, thin maroon rule, no portrait,
  no emblem); "What I'm working on" three tenet cards from
  `research-portfolio.json`; "Recent" — five most recent items from
  `getCollection("sources", … data.effective_visibility === "public")` (**never a
  manifest's raw `visibility`**); "Ways in" four links (Research, Projects,
  Writing, CV at `/cv/`).

**Data (spec §9)**

- `site/src/data/footer.json` **(new)** — role line, department, university,
  Elsewhere templates (`{handle}` filled from `cv-data`), provenance, repository,
  draft markers.
- `site/src/data/research-portfolio.json` **(new)** — three tenets and their
  projects per plan §11, with `public` flags and `inferred`/`draft`/`note`
  markers on the four inferred mappings and the owner-supplied gaps.

**Portrait removal + OG card (Amendment 4; spec §6/§9)**

- `site/src/lib/hub-content.mjs` — removed `CV_PHOTO_REL`/`CV_PHOTO_PATH`;
  `PUBLIC_PHOTO_PATH` is now only the stale path to delete, never a destination.
- `site/scripts/stage-public-assets.mjs` — removed the photo-copy block; keeps
  deleting a stale `public/photo_jason_1.jpeg`.
- `site/scripts/public-build.mjs` — `astro:config:setup` deletes a stale public
  portrait so a bare `astro build` cannot republish it.
- `site/scripts/sync-content.test.ts` — amended to assert the photo is **not**
  staged and is removed when stale.
- `site/scripts/og-card.mjs` **(new)** — Astro integration that draws the
  1200×630 card (name, title, maroon band, orange rule, **no portrait**) and
  writes `public/og-card.svg` + `public/og-card.png` (sharp, an Astro dep).
- `site/astro.config.mjs` — adds `ogCard()` to the **public** integrations.
- `site/scripts/site-routes.mjs` — `CI_PUBLIC_FILES` is now
  `["build-info.json", "og-card.png"]` (photo dropped, card added).
- `site/redirects/github-pages.json` — regenerated (46 entries; photo gone,
  card in).
- `site/src/pages/cv/[variant].astro` — removed the portrait from the Person
  JSON-LD `image`; CV rendering otherwise unchanged.
- `.gitignore` — ignores the generated `site/public/og-card.png` / `.svg`.

**Rest of the site (spec §6)**

- `site/src/layouts/SectionIndex.astro` — Spectral-italic lede and card items.
- `site/src/pages/signin/index.astro` — `hideNav`; band + footer, no navigation.
- `ItemPage.astro` already sits inside `Base` chrome (no change needed).

**Amendment 6**

- `site/src/lib/cv-data.ts` — `normalizeProjectName()` maps `\s*---\s*` to
  `" — "` at `loadContentPool`, the one point both the Projects index and the CV
  pages read project names from. Projects page title is already "Projects"
  (`site/src/pages/projects/index.astro`).

## Owner drafts to confirm (I did not invent facts)

1. **Role line** (footer.json, `draft: true`): `PhD student, Computer Science,
   Virginia Tech · Software engineer`.
2. **Department** (`draft: true`): `Department of Computer Science, Virginia
   Tech`.
3. **Elsewhere** (`draft: true`): GitHub and LinkedIn only, handles read from
   `cv-data` `meta.contact`; Scholar and ORCID omitted until handles exist.
4. **Tenet cards** (`research-portfolio.json`): Knowledge Graphs, Agentic
   Software Engineering, AI Safety; goals/statuses quoted from plan §11.
   Four *(inferred — confirm)* project→repo mappings are flagged `inferred`, and
   Baseball.AI / the ecology project / MATS / VTTSI / AI-aware architecture carry
   `draft`/`note` for the missing goal, status or location. **No project `href`
   is invented**: `href` is `null` except the on-site SoA digest link, so the
   cards name public projects and link only the one confirmed page.
5. **"Ways in" one-liners** (home page) are drafted from existing site copy.
6. **`--vt-orange-text`** — see Open question #1.
7. The **wordmark/affiliation/h1** use `cv-data` `meta.name` (the fixture build
   therefore shows "Fixture Person"; the live build shows the owner's name).

## Test/build transcript

```
$ npm test
 Test Files  23 passed (23)
      Tests  295 passed | 1 skipped (296)

$ npm run contrast
 56 pairs, 0 below AA

$ npm run build:public
 [hub-og-card] generated the default og:image (no portrait): public/og-card.png
 [hub-public-build] staged 3 payload file(s) for 1 public framed item(s)
 [build] 26 page(s) built

$ npm run check:no-private-in-public
 check:no-private-in-public: PASS — no private slug, source, route, payload path,
 title or summary appears ... (162 files scanned)

$ npm run check:publish-allowlist
 check:publish-allowlist: PASS (mode pr) — 14 entries, 0 conflicts, 0 stale.

$ npm run build:private
 [hub-private-build] wrote .hub-private-build.json: 4 private item(s), 89 file(s)

$ npm run check:private-links
 check:private-links: PASS — every link in 8 page(s) resolves under /p/ ...
 84 outbound anchor(s) allowed

$ node ~/code/agentic-governance/plugin/scripts/governance-checks.mjs --layout
 PASS governance-links / adr-index / adr-status / layout
 4 of 4 checks passed, 0 failed.

# portrait / og confirmations
$ ls dist-public/photo_jason_1.jpeg        -> No such file or directory
$ grep 'og:image' dist-public/index.html   -> content="https://jason.cusati.us/og-card.png"
$ grep tracker-petrol: src/styles/tokens.css -> (absent)
$ html probes: 3 tenet cards, 4 ways, 3 footer columns; /signin/ has no nav;
  dist-private shows >Members< and id="sign-out"
```

## Open questions

1. **`--vt-orange-text` hex.** The spec/ADR name `#c64600`, but it is 4.48:1 on
   `--color-bg`, below the suite's 4.5 threshold. I used `#c34600` (4.57:1), the
   nearest same-family darkening, with the original hex documented in
   `tokens.css`. Confirm the darkened value, or accept `#c64600` and relax the
   `vt-orange-text`/`bg` pair (which the contract forbids), or change the pair's
   ground. **This needs an owner/ADR call.**
2. **Project repositories and gaps.** `research-portfolio.json` waits on the
   four inferred mappings, Baseball.AI's goal/status, the ecology proposal's
   location, and public-card decisions for MATS/VTTSI/AI-aware architecture.
   Until then those cards carry names/notes and no links.
3. **Research index not yet driven by the portfolio.** Plan §3 says
   `research-portfolio.json` should also organise `/research/`; the contract's §2
   scope for this wave is the home cards, so `research/index.astro` still has its
   single hand-written item. Wiring it is a small follow-up.
4. **OG card raster font.** The card is drawn as SVG and rasterised with sharp at
   build time. It resolves fonts via the build host; CI (ubuntu-24.04) has a
   different serif/sans fallback than the owner's machine. The composition and
   colours are deterministic; the glyph shapes are not. Phase 6 (per-page OG
   images) is the natural place to pin a self-hosted font.
5. **`position: absolute` "More" disclosure** is a CSS dropdown inside the band;
   a11y round should confirm focus order and that `aria-current` inside a closed
   `<details>` is acceptable.

## ADR candidates

1. **AA adjustment for a named brand colour.** Record the rule used here (and
   already used by `--color-muted`/`--color-caution`): when a spec-named colour
   fails a checked pair, the site token carries the nearest same-family
   compliant value and the original stays in the comment. The `#c64600` →
   `#c34600` case is the precedent.
2. **Generated OG card format.** PNG-via-sharp at build time, generated into
   `public/` by an integration, treated as a pipeline-provided public file
   (`CI_PUBLIC_FILES`). Worth recording before Phase 6 generalises it to
   per-page cards.
3. **`research-portfolio.json` as owner-edited content.** The home cards are not
   manifest-driven; the leak check covers the public path, but a rule that this
   file must never name a non-public manifest item is a policy, not a check.

## Incomplete / not done

- **a11y pass and the adversarial (Red Team / Skeptic Verifier / Dissenter)
  round** are the wave's next gates per the contract's Exit; they have not run
  here. Nothing should merge before they do.
- `research/index.astro` portfolio wiring (Open question #3).

## Related docs

- `llm/sprints/2026-09-hub/contracts/site-wave-0c.md`
- `llm/specs/2026-10-01-branding-design.md`
- `llm/governance/adr/0015-branding-no-portrait-band-and-mark-rule.md`
- `llm/plans/2026-09-19-branding-plan.md` §2–§7, §11
- `llm/governance/adr/0005-two-output-build-with-leak-check.md`,
  `0011-two-srcdirs-not-a-visibility-filter.md`,
  `0016-private-by-default-publish-allowlist.md`
- `llm/sprints/2026-09-hub/handoffs/site-wave-0b.md` (the effective-visibility
  path the Recent block consumes)
