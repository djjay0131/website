# Handoff — Chief Reviewer, Wave 0c (branding)

Stream: Chief Reviewer (authored nothing in this wave; this handoff is its only write)
Wave: 0c — branding (spec §2–§11, ADR-0015); PR #91
Branch: `feat/branding` (HEAD `ec0dcb1`)
Date: 2026-10-03
Contract: `llm/sprints/2026-09-hub/contracts/chief-reviewer-wave-0c.md`
Spec: `llm/specs/2026-10-01-branding-design.md`
ADR: `llm/governance/adr/0015-branding-no-portrait-band-and-mark-rule.md`

**FINAL VERDICT: Comment.** Approved-with-comments: nothing present in the
committed tree blocks merge, but six *Fix later* items remain, three of them
guards the wave's own Skeptic Verifier demonstrated cannot fail. No *Fix now*.
**Governance level: L2** (confirmed).

Read-only. `git status --short` shows only the two untracked adversarial
handoffs (`red-team-wave-0c.md`, `skeptic-verifier-wave-0c.md`) and no tracked
edit by me. `npm test` from `site/`: **295 passed, 1 skipped (23 files)**.
`npm run contrast`: **56 pairs, 0 below AA**. No astro build, no source edit,
no git/cloud mutation. I inspected the existing `dist-public`/`dist-private`
that the Skeptic left in place; I did not rebuild them.

---

## The two prior blockers are closed

- **a11y band focus ring (light theme).** Present. `SiteBand.astro:183-185`
  (`:focus-visible { outline-color: var(--color-on-band) }`) is more specific
  than the global `:focus-visible` (`Base.astro:182-185`), and the built CSS
  carries it: `site-band[data-astro-cid] [data-astro-cid]:focus-visible{
  outline-color:var(--color-on-band)}` in `dist-public/_astro/*.css`. White on
  maroon = 9.19:1.
- **a11y private print.** Present. `PrivateBase.astro:242-246` hides
  `.site-band, .site-footer, .skip-link`; the built private CSS is
  `@media print{.site-band,.site-footer,.skip-link{display:none}...}`.
- **Redirect-map regression.** Restored. `site/redirects/github-pages.json` now
  has **55** entries = `main`'s 53 **+ 2** `og-card` routes; the 12 real
  `/website/projects/*` routes are back and there are **zero** `fixture-*`
  entries (`git diff main...feat/branding` on the file is +8 lines only). The
  guard gap that let a fixture build commit it remains (Dissenter 1): the
  static-only `route-inventory.test.ts:98-109` cannot see content-derived
  routes; the real-build check is opt-in (`:116-122`) and `Must NOT touch`
  forbids the CI edit — a *Fix later*, below.

---

## The seven questions

1. **Spec §2–§11 and ADR-0015.** Substantially satisfied. Home (§2), band (§3),
   footer (§4), tokens (§5), rest-of-site (§6), shared chrome (§7), test changes
   (§8), data files (§9), portfolio (§10) and Amendment 6 (§11) are all present.
   Two named unmet points: `--vt-orange-text` has **no consumer** (spec §5's
   stated orange-text/underline purpose is unrealized), and `/research/`
   **flattens the tenets** so the AI-Safety question never appears (spec §10
   makes the portfolio the tenet→projects→digests structure). Both Fix later.
2. **Shared chrome.** Yes, truly shared and navigation-free. Both
   `Base.astro:15-16` and `PrivateBase.astro:22-23` import the same
   `src/components/SiteBand.astro` / `SiteFooter.astro`; every link arrives as
   a prop, and the components import nothing private, read no collection and
   hard-code no root-absolute link. `private-structure.test.ts` remains a
   structural guarantee: the original srcDir/one-way-import blocks
   (`:53-115`) are intact, and the Wave 0c block (`:127-167`) **extends** them.
3. **Tokens.** Correct. `--color-band/--color-on-band/--rule-orange` are
   declared in `:root` (`tokens.css:118-120`) and **not overridden** in the dark
   block, so they are theme-invariant; they are pinned **by name** in `VT_RAMP`
   (`tokens.test.ts:63-66`) with the positive test at `:115-128`.
   `--tracker-petrol` is gone from `tokens.css` (only `petrol-soft` remains,
   `:70,:157`, which the spec keeps); the verbatim assertion is amended, not
   deleted (`TRACKER_PALETTE` drops `petrol`, test at `:89-96`). The carve-out is
   widened **by name** (`:45-53`). One caveat, a Note: the four new names are not
   in `TOKEN_SOURCES` (`contrast.mjs:47-60`), so those carve-out entries are
   inert; the positive VT-ramp test is what actually guards them.
4. **`#c34600` departure.** Sound and honest. Measured on `--color-bg`
   `#f4f5f1`: `#c64600` = **4.484** (below AA), `#c34600` = **4.570**,
   `#e5751f` = **2.781**. The pattern matches the existing
   `--color-muted`/`--color-caution` departures, and the amendment is carried in
   **both** places — spec §5 and ADR-0015 decision 2 — as an explicit open owner
   question. No pretence that `#c64600` was met.
5. **Portrait.** Gone from the public output, kept for the CV PDFs. No
   `photo_jason_1.jpeg` by path or bytes under `dist-public`; the Person JSON-LD
   `image` is removed (`cv/[variant].astro:40`); staging deletes a stale copy
   (`stage-public-assets.mjs:57`) and the public build deletes one again at
   `config:setup` (`public-build.mjs:77-83`); `og:image` is the generated
   `og-card.png` (`Base.astro:48`), which contains no `<image>`. The CV PDFs are
   copied byte-for-byte and no PDF-byte code changed, so the embed is preserved
   **by construction**; it is **not demonstrable here** — the fixture PDFs are
   607–620-byte text placeholders (Red Team A2, "NOT VERIFIABLE").
6. **`research-portfolio.json` vs D15.** Mostly consistent, with one real gap.
   Owner-confirmed content is correctly un-flagged — role/department per
   D15(1), the seven Elsewhere links per D15(2), Baseball.AI's "Private — in
   progress." per D15(3) — because D15 confirmed them; no handle or URL is
   invented (`footer.mjs:47-56`). But D15(3) says "Research.AI `agentic-kg` +
   **Denario**" and "Traffic.AI VTTSI + **`vttsi-*`**", and the unread `repo`
   field holds only `"agentic-kg"` (`research-portfolio.json:14`) and `"vttsi"`
   (`:38`); Denario appears nowhere, and `repo` is not in the spec §10 shape and
   has no reader. The commit/STATE claim "D15 applied" is therefore larger than
   the artifact. Fix later.
7. **Findings / level.** Below. **L2** confirmed (site implementation against
   an already-approved spec/ADR; no governance-policy change).

---

## Findings

### Fix now

None. Every requirement in the site contract's "Evidence required" holds on the
committed tree: 295/1-skipped tests, contrast 56/0, `check:no-private-in-public`
PASS, `og:image` = `og-card.png` with no portrait, no off-origin sub-resource
(Red Team 0 BYPASS), `private-structure.test.ts` green. Nothing I found is a
present defect in a built artifact.

### Fix later

1. **No guard that `--tracker-petrol` is absent** (Skeptic Demo 3a).
   `tokens.test.ts:89-96` iterates `TRACKER_PALETTE` and asserts each listed
   colour is present, but never that no extra `--tracker-*` declaration exists,
   so re-adding `--tracker-petrol: #326a64;` leaves `npm test` green. Add a test
   that collects every `--tracker-\w+` declaration in `tokens.css` and asserts
   the key set equals the palette (which keeps `petrol-soft`, not `petrol`).
   Contract conformity is met (`petrol` is removed); this is the regression lock.
2. **A portrait pre-seeded in `dist-public` is not refused** (Skeptic Demo 4).
   The build deletes `public/photo_jason_1.jpeg` before Astro copies `public/`
   (`public-build.mjs:77-83`), but nothing asserts on the output: a portrait
   planted directly in `dist-public` survives `check:no-private-in-public` and
   `npm test` (both PASS, file still present). Add a forbidden-output-path /
   "no portrait-named file" assertion to the leak check or an output test.
3. **The OG no-portrait property has no test** (Skeptic Demo 5).
   `renderOgCardSvg({ name, title, affiliation })` (`og-card.mjs:36-48`) cannot
   draw a portrait but silently ignores `portrait`/`image` keys, and no test
   exercises it; the no-portrait property rests on the single `Base.astro:48`
   default plus manual grep. Add a unit test on the generated SVG (no `<image>`,
   no `photo_jason`).
4. **Dead `repo` field; D15 mappings under-represented** (Dissenter 2).
   `repo` is not in the spec §10 shape and has no reader anywhere in
   `site/src`/`site/src-private`; it holds one home where D15 names two
   (`research-portfolio.json:14,38`; `STATE.md:498`). Either model
   `repos: string[]` and consume it, or drop the field and correct the record.
5. **`--vt-orange-text` is a dead token** (a11y obs. 3; Dissenter 5). Grep for
   `var(--vt-orange-text)` in components is **zero**; only `tokens.css`,
   `tokens.test.ts` and `contrast.mjs` reference it. The `#e5751f`-fails case it
   was added for (spec §5) is the band's current-section underline, which uses
   `--rule-orange` (`SiteBand.astro:172-177`, 3.02:1 on maroon — fine as
   non-text). Either wire the token where orange text/underline appears, or
   record why it is intentionally latent.
6. **`/research/` loses the tenet structure, so AI Safety is invisible there**
   (Dissenter 6). `research/index.astro:12-21` flat-maps projects and emits no
   tenet; AI Safety has `projects: []` (`research-portfolio.json:75-81`), so its
   question and cross-reference appear only on the home page while the index
   lede promises grouping "by the research question they answer." Spec §10/plan
   §11 make the portfolio the index's organising structure. Render tenet
   headings (with an "open question" state for a project-less tenet), or say the
   index lists projects only.
7. **The fixture-redirect guard is still absent** (Dissenter 1). The map is
   restored, but nothing prevents the next fixture build from recomitting one:
   `route-inventory.test.ts:98-109` is static-only and the build-backed check is
   opt-in (`:116-122`). `Must NOT touch` bars the CI change this wave, so carry
   it to the next / an infra stream: regenerate from synced content, and gate
   `redirects:generate --check` in CI.

### Note

8. **The four new carve-out entries are inert.** `color-band`, `color-on-band`,
   `rule-orange`, `vt-orange-text` are absent from `TOKEN_SOURCES`, so
   `BRAND_ACCENT_TOKENS.has()` never sees them (`tokens.test.ts:102-103`);
   removing them changes nothing (Skeptic Demo 3c). The `VT_RAMP` positive test
   is the actual guard. Harmless, but the list overstates what it exempts.
9. **"D15 applied" overclaims in the commit/STATE.** Commit `4ae1b7e` and the
   handoff name Denario, but the artifact does not carry it (Finding 4). The
   rendered cards are owner-confirmed, so this is a record-truth note.
10. **A private repo's name is published with `"public": true`** (Dissenter 3).
    `baseball-ai` is not synced and not on the allowlist, so
    `check-no-private-in-public` has nothing to compare and passes; but D15(3)
    authorises the name-only card, so there is no leak. The `public` flag means
    "show on the site," not manifest `visibility`; document that in the file.
11. **The footer top rule stays `--color-band` in both themes**
    (`SiteFooter.astro:105`), deliberately: spec §4 says "a maroon top rule."
    In-page accents were otherwise made theme-aware in `ec0dcb1`
    (`index.astro:145,164`; `SectionIndex.astro:135` now use `--color-accent`).
    Non-text; keep the spec-literal choice.
12. **`/phd/` and four legacy research routes also carry `noindex`** beyond
    `/signin/` (Red Team observation). Broader than the contract's sentence but
    not a spec violation; confirm intended.
13. **`dist-private` contains a copy of `og-card.png`/`.svg`** (both builds copy
    `public/`). Same-origin, no portrait, no private title, unreferenced —
    harmless.
14. **CV-embed half of the portrait claim is untestable here** (Red Team A2).
    Preserved by construction; flag the live check (real CV PDFs) as an
    outstanding pre-merge/post-merge probe.

---

## Verdict

**Comment.** The wave satisfies spec §2–§11 and ADR-0015 in substance; the two
prior blockers (band focus ring, private print) are fixed and verified in the
built CSS, and the redirect-map regression is restored (55 entries, 12 real
project routes, 0 fixture entries). `npm test` is 295 passed / 1 skipped,
contrast is 56/0, and the Red Team found 0 BYPASS. No *Fix now*: nothing present
blocks merge. The seven *Fix later* items are regression guards the build paths
already hold against (petrol absent, portrait absent, OG no-portrait, fixture
redirect), plus one dead token, one dead data field that under-represents D15,
and the flattened `/research/` tenet structure; they should land before Phase 4,
not gate this wave's merge. **L2** confirmed.

## Related docs

- `llm/sprints/2026-09-hub/contracts/chief-reviewer-wave-0c.md`
- `llm/sprints/2026-09-hub/contracts/site-wave-0c.md`
- `llm/specs/2026-10-01-branding-design.md`, ADR-0015
- `llm/sprints/2026-09-hub/handoffs/{site,a11y-tester,dissenter,red-team,skeptic-verifier}-wave-0c.md`
- `site/src/data/research-portfolio.json`, `site/src/styles/tokens.{css,test.ts}`,
  `site/scripts/private-structure.test.ts`, `site/redirects/github-pages.json`
- PR: https://github.com/djjay0131/website/pull/91
