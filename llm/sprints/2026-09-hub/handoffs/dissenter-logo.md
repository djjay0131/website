# Handoff — `Dissenter`, L1 follow-up wave "logo" (owner decision D16)

Agent: Dissenter (independent; authored nothing in this wave)
Contract: `llm/sprints/2026-09-hub/contracts/logo-wave.md`
Design authority: `llm/specs/2026-10-01-branding-design.md` (amended 2026-10-04); ADR-0015 (amended 2026-10-04)
Decision: D16 (`STATE.md` 2026-10-04); related D13
Hub repo: `/home/djjay/code/website` · branch `feat/logo` · HEAD reviewed `e79f0d8` (`main` `9bd10ed`)
Commits: `6174699` (code), `e79f0d8` (records)

## Summary

I read the contract, the amended ADR-0015 and branding spec, `STATE.md` D13/D16, the completion
brief §9 hard stops, the two commits and the full `main...feat/logo` diff, and the relevant code:
`SiteBand.astro`, `index.astro`, `Base.astro`, `tokens.css`, `contrast.mjs`, `og-card.mjs` and its
test, `astro.config.mjs`, `site-routes.mjs`, `route-inventory.mjs`, `generate-redirect-map.mjs`,
`public-build.mjs`, the committed redirect map, and `gate/app/serve.py`. I ran read-only probes:
`npm test` (30 files, 403 passed / 2 skipped), `npm run contrast` (56 pairs, 0 below AA),
`npm run redirects:check`, a band-emblem coverage pass over `dist-public`/`dist-private`, a
`sharp` read of the three raster assets, a contrast computation of the emblem colours, and a
`git ls-tree` of PR #70's source assets. **I could not view the images themselves** (the model
cannot take image input); every claim about what a PNG depicts is therefore flagged as needing a
human/visual check. I wrote no tracked file but this one and made no git/gh/cloud mutation.

**I raise seven objections; two block.** S1: none of the three new behaviours is pinned by any
test, and the one tool the contract cites for the contrast claim does not test the emblem pair —
which directly defeats the contract's exit condition "Skeptic no un-failable guard". S2: the
generated `og-card` is still built, served and asserted as "the default `og:image`" by three
source comments and a test, so requirement 4 ("no existing source of truth is left contradicted")
is not met — and cannot be met inside the wave's declared scope. S3–S7 are record/quality
findings, not merge blockers.

Objection table. "Block?" means block the merge under the completion brief §7 (required checks,
Skeptic "no un-failable guard", requirement 4 conformance).

| # | Objection (claim) | Confidence | Block? |
|---|---|---|---|
| **S1** | The three new surfaces (emblem presence/alt, badge hero, emblem OG default) are unguarded; `contrast.mjs` omits the emblem pair and is not in CI | High (reproduced) | **Yes** |
| **S2** | `og-card` remains generated/served/pinned, and code+test comments still call it "the default `og:image`"; requirement 4 is unachievable within scope | High (reproduced) | **Yes (record/scope)** |
| **S3** | The trademark caveat names only the HokieBird while PR #70's own README says every badge uses "the Virginia Tech mark **and** the HokieBird likeness"; ADR-0015 decision 3's permission precondition is knowingly unmet | Medium (needs visual check) | No (owner authority) — blocks the *record* |
| **S4** | The emblem contrast claim is nominally true (3.0166:1) but describes a **0.6 px** ring and an exempt logo; "3.02:1" implies more headroom than exists | High (computed) | No |
| **S5** | The OG default is a 1200×1200 square, transparent-cornered PNG replacing a 1200×630 card, with no `og:image:width/height/alt`; 1.91:1 consumers crop it | High (verified asset) | No (owner decision; record the consequence) |
| **S6** | The `-2x` justification ("must satisfy the gate's segment allowlist") is a category error: the gate guards `/p/**` private object paths only; no site-side filename guard exists | High (verified) | No |
| **S7** | The manual redirect-map edit is correct but unverified by CI; `redirects:check` (the only coverage check) is absent from every workflow and currently exits 1 | High (reproduced) | No (pre-existing) |

---

## Objections

### S1 — No test pins the new behaviour; the cited contrast tool does not cover the emblem · BLOCK

**Claim.** The contract's Requirements 1–3 assert emblem presence on every page and both themes,
an exact `alt`, a badge hero, and an emblem OG default; its Evidence list requires `npm test` and
`npm run contrast`; and its Exit requires the Skeptic to show "no un-failable guard", with the
Skeptic explicitly told to break "the emblem alt text, and the OG default" and "the gate-segment
guard on the badge filename" (`logo-wave.md:55-67,69-74,76-82`). In fact **no test references any
of it**, and the contrast tool does not include the emblem pair:

- `npm test` is green (403 passed / 2 skipped) but a repo-wide search for
  `emblem|badge|identity-badge|research-emblem|og:image` in `*.test.ts` finds exactly one hit:
  `site/scripts/og-card.test.ts:4`, a stale comment that still calls the generated card the
  default. There is no component render test, no build-output assertion, no snapshot.
- `npm run contrast` reports "56 pairs, 0 below AA" and passes, but `TEXT_PAIRS`
  (`contrast.mjs:17-37`) never names the emblem's burnt-orange ring against `--color-band`. The
  suite's only brand-band row is `["color-on-band","color-band"]` (white-on-maroon, 9.19:1).
- Neither `npm run contrast` nor `redirects:check` appears in any workflow
  (`grep` over `.github/workflows/` finds only `npm test`, `check:smoke-routes`,
  `redirects:stubs`, `check:no-private-in-public`). So the contrast claim is not even run by CI.

The practical effect: revert `SiteBand.astro`, `index.astro` and `Base.astro` to `main` and
`npm test` stays green. The Exit condition "Skeptic no un-failable guard" is unsatisfiable as
written — two of the four named Skeptic targets have nothing to break.

**Severity.** Blocking. A wave whose purpose is restoring a mark and a hero, and which requires
the Skeptic to prove it cannot be silently reverted, currently can be.

**Evidence that would settle it.**
- A build-output test (e.g. extending `public-build.test.ts` or a new `logo-wave.test.ts`) that
  parses every `dist-public/**/*.html` and asserts exactly one `img[src$="research-emblem.svg"]`
  with `alt="Jason Cusati research emblem"`, and that `dist-public/index.html` carries the badge
  `src`+`srcset` with no `loading="lazy"` and `<meta property="og:image" … research-emblem.png>`.
- Add the pair `["vt-orange","vt-band"]` (or literal `#e5751f`/`#861f41`) to a non-text group in
  `contrast.mjs`, assert ≥ 3.0, and wire `npm run contrast` into `build.yml`.
- Skeptic demonstrates red: on a scratch branch, delete the emblem `<img>`, change the OG default
  back to `og-card.png`, and show each new assertion failing — then restore.

---

### S2 — `og-card` is dead-but-served and still asserted as the default; requirement 4 cannot be met in scope · BLOCK (record/scope)

**Claim.** The contract freezes `og-card.mjs` behaviour (`logo-wave.md:33-34`) and Requirement 4
says "no existing source of truth is left contradicted" (`logo-wave.md:51-53`). But the generated
card is still wired, still served, and still described as the default in three places and a test:

- `astro.config.mjs:41,68` still registers `ogCard()` for the public build, so every public build
  regenerates `public/og-card.{png,svg}` and Astro copies them into `dist-public`. They are also
  copied into `dist-private` because they sit in `public/`. `dist-public/og-card.png` and
  `dist-public/og-card.svg` are present and served; **no HTML references them** (`grep -rl "og-card"
  dist-public --include=*.html` → none). It is an orphan served URL.
- `og-card.mjs:1` — "THE DEFAULT og:image IS A GENERATED CARD (ADR-0015 decision 1; spec §6/§9)".
- `og-card.test.ts:4` — "The default og:image is a generated card with NO portrait (ADR-0015
  decision 1; spec §6/§9)."
- `site-routes.mjs:39-42` — "og-card.png … it replaces the portrait as the default og:image —
  Amendment 4, ADR-0015", and it is still in `CI_PUBLIC_FILES`.

All four statements are now false. The wave's declared scope
(`logo-wave.md:19-27`) does **not** include `site/scripts/og-card.mjs`, `og-card.test.ts`,
`site-routes.mjs` or `check-no-private-in-public.mjs`, so the contradiction cannot be fixed
without exceeding scope. Requirement 4 is therefore claimed but not delivered.

**Severity.** Blocking to the record/conformance claim (not to the rendered feature). Either the
scope must be widened and the comments corrected, or the wave must say plainly that a follow-up
owns it and that requirement 4 is only met for the ADR/spec/STATE, not for the source.

**Evidence that would settle it.**
- `grep -rn "default.*og:image\|default og:image" site/` and show no hit asserts the card.
- Decide and record: (a) remove the `ogCard()` integration and update `CI_PUBLIC_FILES`, the map,
  and `check-derived-outputs.test.ts`; or (b) keep it and file an issue, correcting the four
  comments now (a scope amendment), and state in STATE that requirement 4 is met except for those
  files.
- Optionally assert in the new logo test that no page's `<meta og:image>` is `og-card.png`, and
  that `/og-card.png` is not referenced by any page.

---

### S3 — The trademark caveat understates the scope, and the ADR's permission precondition is unmet · no block, record must be corrected

**Claim.** The D16 caveat, recorded verbatim in ADR-0015 (`0015…:86-89`) and STATE
(`STATE.md:501-510`), says only: *"the badge depicts the HokieBird, a VT trademark Licensing
declined…"* But PR #70's own README states: *"Every image uses the Virginia Tech mark **and** the
HokieBird likeness. Both are registered trademarks… The Office of Licensing and Trademarks
declined their use"* (`git show origin/assets/research-badges:site/src/assets/badges/README.md`).
The `vt-badge-hokiebird-laptop-tower-research-today` description there is "HokieBird at a laptop
with the tower behind" and does not separately name the VT logo, so whether this specific asset
embeds the registered VT mark as well as the bird **is not settled by the text and I could not
view the image**. If it does, the caveat names one declined mark while the asset carries two, and
the ADR/spec/STATE wording is incomplete.

Separately, ADR-0015 decision 3 provides the mechanism and its condition: *"Adding the mark later
is an ADR amendment, on evidence of permission (licensing@vt.edu)"* (`0015…:40-42`). D16 uses the
mechanism (an ADR amendment) but the condition is knowingly not met. The completion brief §9 lists
as a hard stop "a design-authority change larger than an ADR amendment"
(`llm/plans/2026-10-01-completion-brief.md:160-167`), and this repo's own precedent for
overriding design authority calls it a "§10 hard stop (design-authority change larger than an ADR
amendment)" (`STATE.md:2234-2237`). My reading: because the **owner himself** directed D16 and it
is recorded as an owner decision with dated amendments, it is within the owner's authority, not a
hard stop the agent must stop on — but that reasoning should be stated, and the level "L1"
(`logo-wave.md:1,8`) should be justified in the PR, since the wave amends design authority
(spec §3, §6) and knowingly accepts a trademark risk.

**Severity.** No block to merge (owner's own site, owner's decision). Blocking to the accuracy of
the record as written.

**Evidence that would settle it.**
- Visual inspection of
  `site/public/badges/vt-badge-hokiebird-laptop-tower-research-today-2x.png` (or the 1254×1254
  source on PR #70) for the VT wordmark/logo distinct from the HokieBird.
- If present, correct ADR-0015/§3/spec/D16 to name both declined marks; if absent, say so
  explicitly.
- Add one sentence to the amendment and STATE: D16 was owner-directed, so it is an owner exercise
  of design authority and expressly not a §9 agent hard stop; the ADR's permission precondition is
  knowingly unmet and no permission is claimed (the latter is already stated at `STATE.md:507-510`).

---

### S4 — The emblem contrast claim is nominally true but describes a 0.6 px ring and an exempt logo · no block

**Claim.** Requirement 1 says the emblem's rings "meet the AA non-text 3:1 threshold; burnt-orange
3.02:1" (`logo-wave.md:42-43`; `SiteBand.astro:42-47`). I recomputed with the repo's own
`contrastRatio`: `#e5751f` on `#861f41` = **3.0166:1** (a 0.0166, ~0.55 %, margin over 3.0),
`#fbfbf8` on `#861f41` = 8.861:1. The claim is arithmetically right but materially misleading:

- The SVG (`public/emblem/research-emblem.svg:11-14`) draws the orange ring between two maroon
  rings at radii 188→182 in a 400 viewBox. At the mandated 40 px render the orange ring is
  **0.6 px thick** (and the outer maroon ring 0.8 px); the white disc is 35.2 px across.
- WCAG 2.1 Understanding SC 1.4.11 warns expressly: computed values "should not be rounded"
  (2.999:1 fails) and, more on point, "particularly thin lines and shapes … may be rendered by
  user agents with a much fainter color than the actual color defined in the underlying CSS. …
  nominally passes … but … much lower contrast in practice." A 0.6 px 3.0166:1 rim is exactly the
  case the note tells authors to avoid.
- Logos are exempt from 1.4.11 under the essential exception; the exemption normatively carries
  over even when the logo is a link, though the Understanding recommends sufficient contrast as
  best practice. So the honest statement is "an exempt logo chosen with contrast that nominally
  passes", not "meets AA non-text 3:1". The robust number is the white disc (8.86:1).
- The dark theme is a **non-issue** and the record should say so: `--color-band` is deliberately
  not overridden (`tokens.css:115-120`), so the band is `#861f41` and the emblem is identical in
  both themes. No separate dark-theme contrast test is needed.

**Severity.** No block. The emblem remains perceptible via the white disc; the record overstates
the significance of the orange pair, and the cited tool (`contrast.mjs`) does not test it.

**Evidence that would settle it.**
- A zoomed render of the 40 px emblem at device pixel ratios 1–3, and a decision to either (a)
  thicken the orange ring / raise its contrast, or (b) record it as "thin decorative rim, logo
  exemption, white disc carries legibility".
- If kept as a claim, add the pair to `contrast.mjs` (see S1) and switch the wording from "meets
  AA non-text" to "exempt logo; nominal 3.02:1; white disc 8.86:1".

---

### S5 — The OG default is a square, transparent PNG where the card was 1200×630 · no block (record the consequence)

**Claim.** D16 restores `/emblem/research-emblem.png` as the default `og:image` (`Base.astro:48`).
That asset is **1200×1200, RGBA, transparent corners** (opaque circle centred), 190,461 bytes;
the card it replaced was 1200×630. Base.astro emits no `og:image:width`, `og:image:height` or
`og:image:alt` (it never did). Consequences the amendment does not acknowledge:

- `og:image` is consumed at ~1.91:1 by many unfurlers (Facebook, LinkedIn, Slack). A 1:1 image is
  letterboxed or centre-cropped; a centre-crop to 1200×630 removes roughly the top/bottom 285 px
  of a 1200 px image — which on this emblem is where the top arc (`RESEARCH TODAY · A BRIGHTER
  TOMORROW`, at viewBox y≈60) and the bottom caption (`EXPLORE · ANALYZE · IMPACT`, y≈346) sit.
  Those captions would be clipped in the large-card layout.
- Twitter uses `twitter:card = "summary"` (`Base.astro:114`), a square thumbnail, where 1:1 is
  fine — so the two consumers disagree.
- Transparency may composite unpredictably (dark corners on dark clients).

**Severity.** No block: the owner explicitly chose the emblem (`spec §6` amendment; ADR
amendment 1). But the record should state the shape change and its preview consequence, since the
amended spec still reasons that a generated card was the right OG artefact.

**Evidence that would settle it.**
- Run the deployed URLs (or the local PNG) through Facebook Sharing Debugger, LinkedIn Post
  Inspector and Slack unfurl, and record the actual crop.
- Decide: keep the square and add `og:image:width/height/alt`; or emit a 1200×630 derivative
  (emblem centred on maroon) for OG while keeping the emblem-marks the same. Either is a one-line
  derivative and does not touch the ADR decision.

---

### S6 — The `-2x` rationale is a category error; no filename guard exists for public assets · no block

**Claim.** Requirement 2 says "The filename must satisfy the gate's segment allowlist
`[A-Za-z0-9._-]` (so `-2x`, never `@2x`)" (`logo-wave.md:48-49`). That allowlist is
`gate/app/serve.py:23` (`_SEGMENT = re.compile(r"^[A-Za-z0-9._-]+$")`), used by
`_checked_segments` for **private `/p/**` object paths** in the private bucket. The badge is a
public asset served by Hosting; it never passes the gate. A repo search finds no `@2x`, no `2x`
and no segment regex anywhere under `site/scripts` or `site/src` — the site build enforces no
filename rule. The `-2x` choice is harmless and the redirect-map entries are consistent, but the
stated reason is not a guard, and the Skeptic cannot "break" it (the same misreading produces two
of the four Skeptic targets). (A defensible secondary reading is that every file staged into the
private bucket should have a gate-safe name, and `dist-private/badges/*` exists; but no check
enforces that either.)

**Severity.** No block. The rationale should be restated accurately or dropped; the outcome
(`-2x`, and `-2x` sorts before `.png` so the map stays sorted) is correct.

**Evidence that would settle it.**
- `grep -rn "2x\|A-Za-z0-9" site/scripts site/src` → no filename rule;
  `gate/app/serve.py:23,42-74` shows the allowlist's actual scope. Correct the contract sentence.

---

### S7 — The manual redirect-map edit is correct but unverified by CI · no block (pre-existing)

**Claim.** The two badge entries were hand-added (`site/redirects/github-pages.json:6-13`).
They are what `buildRedirectMap` would generate and they sort correctly, and
`npm run redirects:check` does **not** list them as missing. But the only tool that verifies map
*coverage* is `redirects:check`, and it is in no workflow (see S1); the contract's Evidence list
cites `redirects:stubs`, which merely generates stubs **from** the map and cannot detect a missing
entry. `redirects:check` currently exits 1 on this branch for unrelated, pre-existing reasons
(`/_payload/kgis/*`, `/projects/fixture-*`, `/projects/kgis/kgis-docs/`). So the manual edit is
correct on inspection but has no automated backstop and the wave's declared evidence does not
verify it.

**Severity.** No block (pre-existing; also the subject of `dissenter-wave-5.md` D1). Worth folding
into the same follow-up rather than pretending `redirects:stubs` proves coverage.

**Evidence that would settle it.** Run `npm run redirects:check` and show the badge routes are not
in the "missing" list (done — they are not), then either wire the check into CI or record that the
map is hand-maintained and why the badge entries were added manually rather than by
`redirects:generate`.

---

## Assumptions

- The built artefacts in `dist-public/` and `dist-private/` (17:53) correspond to `feat/logo`; I
  confirmed the emblem alt, badge src/srcset, OG meta and band-emblem coverage in them. If those
  outputs predate `e79f0d8`, the coverage figures could differ, but the source diff is
  unambiguous.
- The gate segment allowlist governs private `/p/**` object paths only; I read `serve.py` and
  `safe_object_path`/`safe_prefix` but did not run the gate.
- "Page" in the contract means a chrome-wrapped page, not a framed `_payload/` document or a
  legacy meta-refresh stub. Under that reading the emblem is on every real page (27/32 public;
  the 5 without are 1 `_payload` doc + 4 legacy redirect stubs; 6/12 private, the other 6 being
  `_payload`/`_doc` framed content).
- I did not fetch live URLs; all OG crop statements are about the published asset shape, not an
  observed unfurl.

## Recommendations

1. **Before merge:** add the three regression assertions (S1) and make them fail on a revert;
   wire `npm run contrast` into CI.
2. **Before merge or in the same PR:** correct the four "default og:image" statements (S2), or
   explicitly record requirement 4 as met only for the ADR/spec/STATE and file the follow-up.
3. **Correct the trademark caveat** to name what the asset actually depicts (S3), and add the
   owner-authority sentence; state the governance level in the PR.
4. **Restate the contrast claim** as "exempt logo, nominal 3.02:1, white disc 8.86:1, identical
   both themes" (S4).
5. **Record the OG shape consequence** and decide square-vs-1200×630 (S5).
6. **Fix the `-2x` rationale sentence** (S6) and the missing `redirects:check` (S7) as follow-ups.
7. Minor: the SVG is loaded via `<img>` (`SiteBand.astro:55-60`), which isolates it from page CSS
   and webfonts, so its Spectral/IBM Plex text falls back to Georgia/system-ui. If the emblem's
   typography is meant to be on-brand, use an inline SVG or embed the fonts. Also note two
   adjacent home links announce as "Jason Cusati research emblem" then "Jason Cusati Virginia
   Tech" — duplication, not a WCAG failure.

## Alternatives

- **Replace the emblem `<img>` with an inline SVG** (or a `<picture>`), which restores brand
  fonts, removes the extra HTTP request, and lets the decorative outer ring be tuned. Cost: the
  SVG carries a large embedded C2PA `<metadata>` blob; that should be stripped.
- **Make the emblem `aria-hidden` and keep only the wordmark as the home link** (or vice versa) to
  remove duplicate link announcements while still rendering the mark — but the contract requires a
  linked emblem, so this needs a contract amendment.
- **Keep the emblem OG but also ship a 1200×630 derivative** for 1.91:1 consumers.
- **Remove the `ogCard()` integration in this wave** and accept the scope change, rather than
  leaving a served orphan and four false comments.

## Risks

- A silent revert of the emblem/badge/OG is possible today (S1). Low likelihood, high consequence
  for a wave whose entire value is those three surfaces.
- If the served badge carries the registered VT mark in addition to the HokieBird, the record
  understates a live legal exposure the owner is accepting (S3). This is the highest-uncertainty
  item and the reason a human visual check is needed.
- Leaving `og-card` generated and served preserves a URL that no page names; a future `open()`
  crawler or a shared stale link will surface a card that contradicts the current design (S2).
- The orange rim is sub-pixel at 40 px and nominally passes by 0.55 %; anti-aliasing may render it
  invisible, leaving the mark as a white disc. Cosmetic, but the record should not claim more (S4).

## Open questions

1. Does the served badge depict the registered VT mark (wordmark/logo) as well as the HokieBird?
   (S3 — blocks an accurate record.)
2. Is D16 an L1 change or an L2 design-authority/legal-risk change under this repo's adopted
   levels? The contract says L1; the wave amends design authority and overrides ADR-0015 decision
   3. (The owner-directed nature, not the level, is what keeps it off the §9 hard-stop path.)
3. Is the square emblem OG acceptable, or should a 1200×630 derivative be emitted? (S5.)
4. Should `og-card` be removed (scope change) or kept with corrected comments + a follow-up? (S2.)
5. Should the duplicate home links be reduced to one? (Minor.)

## Related docs

- `llm/sprints/2026-09-hub/contracts/logo-wave.md`
- `llm/specs/2026-10-01-branding-design.md` (§3, §6 amendments)
- `llm/governance/adr/0015-branding-no-portrait-band-and-mark-rule.md` (decision 3; 2026-10-04 amendment)
- `llm/sprints/2026-09-hub/STATE.md` D13, D16; §ADR-0014 (design-authority override precedent)
- `llm/plans/2026-10-01-completion-brief.md` §7, §9
- PR #70 branch `origin/assets/research-badges`, `site/src/assets/badges/README.md`
- `llm/sprints/2026-09-hub/handoffs/dissenter-wave-5.md` (D1: `redirects:check` unwired)
- WCAG 2.1 Understanding SC 1.4.11 (thin-line/rounding note; logo exemption)

## ADR candidates

- **The emblem is the site mark; logos are exempt from 1.4.11, and thin decorative rims are not
  asserted as non-text contrast.** Records the correct standard for the band mark and stops future
  waves from re-deriving a 3:1 claim on a 0.6 px ring.
- **`og-card.mjs` is retired (or kept but not the default).** A one-line ADR that resolves the
  standing contradiction between ADR-0015 decision 1 and D16 and tells the next wave whether the
  generator, its test, `CI_PUBLIC_FILES` and the redirect-map entry may be deleted.
- **Owner-directed trademark exceptions are recorded as owner risk acceptance, not licensing
  permission.** Names the owner authority, requires the exact depicted marks to be listed, and
  states no permission is claimed. (Amends ADR-0015 decision 3's precondition language.)
