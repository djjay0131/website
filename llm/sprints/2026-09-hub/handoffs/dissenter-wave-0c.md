# Handoff — Dissenter, Wave 0c (branding)

Stream: Dissenter (adversary; authors no source, fixes nothing)
Wave: 0c — branding
Branch: `feat/branding` (PR #91)
Contract: `llm/sprints/2026-09-hub/contracts/dissenter-wave-0c.md`
Date: 2026-10-03

Read: the contract; `llm/specs/2026-10-01-branding-design.md`; ADR-0015;
D15 and the Wave 0c entry in `llm/sprints/2026-09-hub/STATE.md`;
`handoffs/site-wave-0c.md`; plan §2–§7/§11; `git diff main...feat/branding`
(37 files, +2091/−400). Ran `npm test` from `site/`: **295 passed, 1 skipped**,
matching the handoff. Ran no astro build (shared `dist-*`); the one build-shaped
command I ran, `generate-redirect-map.mjs --check --dist dist-public`, only
inventories an existing directory and does not build.

These are design objections, not fixes. Each states the claim, severity, whether
it blocks the merge, and the evidence that would settle it.

## Summary

The direction is coherent and most of the wave is sound: the portrait is gone
from every public path, the band/footer are genuinely shared by both layouts
without carrying navigation, the token carve-out is widened by name with a
positive replacement test, and the updated project-title normalisation is a real
fix. The dissent is not with the look. It is with three things the look rides on:
a **committed generated artifact regressed to fixture data** (blocks), an
**owner decision (D15) that the shipped data does not actually contain**, and a
**guard gap the spec says is closed** because the new home/research content lives
in a hand-maintained file the leak check cannot see. Two smaller defects concern
the dark theme and the `--vt-orange-text` token.

Only objection 1 blocks. Objections 2–6 are should-fix before the wave is called
done; 5 additionally requires an ADR amendment so the decision record is not
false.

## Objections

### 1. `site/redirects/github-pages.json` was regenerated from fixture content: it drops 12 real legacy project redirects and encodes fixture pages

**Claim.** Commit `f8476ff` ("Wave 0c chrome, home page, tokens and data")
overwrites the committed SEAM-6 redirect map with one produced from a **fixture**
build. The handoff states it was "regenerated (46 entries; photo gone, card in)"
(`handoffs/site-wave-0c.md:135-136`) and separately admits the local build showed
"Fixture Person" because the real synced CV data was absent
(`handoffs/site-wave-0c.md:171-172`). The map consequently contains
`/website/projects/fixture-one/` and `/website/projects/fixture-two/` — URLs that
will never exist in production — and `_payload/kgis/` entries from the fixture
payload.

What was lost. `main` maps 12 real project routes; the branch maps none of them:

```
main:   /website/projects/agentic-kg/  construction-ai/  insurance-schema-framework/
        llm-coding-assistant/  llm-data-importer/  mrs-cloud-architecture/  nfl-ml/
        remote-robotics-control/  security-classifier/  sentiment-yelp/  vttsi/
        vvuq-beam-solver/
branch: /website/projects/  fixture-one/  fixture-two/  kgis/kgis-docs/
```

**Severity: High.** It is a release-integrity regression in a file the repository
records as the Pages redirect source (served in Phase 6). The suite cannot catch
it: `route-inventory.test.ts:89-109` checks the committed map only against
*static* routes (`routesFromPagesDir` + `routesFromPublicDir` + legacy/smoke/CI),
so content-derived project routes are invisible to it and the fixture map passes
(`npm test` green). The opt-in `REDIRECT_MAP_CHECK_BUILD=1` case against a real
build would fail, but it is off by default (`route-inventory.test.ts:111-122`),
and no `.github/workflows/` job regenerates or checks the map.

**Blocks the merge? Yes.** Acceptable dispositions: (a) regenerate from a
checkout with the real synced content and commit that map, or (b) explicitly
quarantine the generated file from the branch (revert to `main`) and add the
regeneration/`--check` step to CI so fixture builds can never commit one.

**Evidence that would settle it.** Run `npm run redirects:generate` with the real
content present and diff against `main`; or run
`REDIRECT_MAP_CHECK_BUILD=1 npm test` after a real public build and show
`findUncovered` empty. Either would show whether the 12 project routes reappear
and the fixture ones vanish.

### 2. D15's owner-confirmed repo mappings are not stored anywhere, and `repo` is a dead field

**Claim.** D15 (STATE 2026-10-02) confirms "Research.AI `agentic-kg` + Denario" and
"Traffic.AI VTTSI + `vttsi-*`", and the D15 commit message repeats
"Research.AI = agentic-kg + Denario; Traffic.AI = VTTSI/vttsi-*". The shipped
`site/src/data/research-portfolio.json` contains `"repo": "agentic-kg"` (line 14)
and `"repo": "vttsi"` (line 38) — no Denario, no `cs6604-trafficsafety`, no
`vttsi-*`, and no `construction-ai-proposal` despite plan §11 naming
`construction-ai` and `construction-ai-proposal` together. The strings `denario`,
`vttsi-`, and `cs6604` appear nowhere under `site/src` or `site/src-private`.

Worse, the field cannot carry them and nothing reads it: `repo` is not part of the
spec §10 JSON shape (`{name, goal, status, href, public}`), and a search for
`.repo` / `project.repo` across `site/src` and `site/src-private` returns no
reader. So the D15 mappings that do fit in one string are inert, and the ones that
do not are silently discarded while the file is presented as "D15 applied".

**Severity: High** (owner-confirmed content silently lost in the artifact whose
only job is to hold it; a future reader will believe each project has one home).

**Blocks the merge? No, provided the wave is not described as "D15 applied" until
it is.** It should either (a) model multiple homes (`repos: string[]`, matching
D15/plan §11 and the spec shape if `repo` is dropped) and actually consume it, or
(b) record a decision that only one home per project is shown and update D15's
text to say so.

**Evidence that would settle it.** The owner confirms, per project, which repos
are the intended "home(s)" and whether the card must show them. A check that
asserts `JSON.stringify(portfolio)` contains each D15-named repo would then be
possible.

### 3. The hand-maintained portfolio is outside the leak-check's model, so the spec's "the leak check covers it anyway" is false

**Claim.** Spec §10 justifies the owner-edited file with "the home page never
lists a private item by accident; the leak check covers it anyway." It does not.
`check-no-private-in-public.mjs` builds its private set from synced manifests /
the allowlist; `baseball-ai` is not a synced source and not on the allowlist
(`site/publish-allowlist.json` names only `cv`, `kgis`, the `hub` digests — 14
entries), so the private repo "Baseball.AI" is publishable to `dist-public` as
inert text with no item for the checker to compare against. `research-portfolio.json`
also sets `"public": true` for `baseball-ai` (line 31). The distinction
(`public` = "show on the site" vs `visibility` = "manifest request") is real but
undocumented in the file, and the handoff's own ADR candidate 3 concedes the rule
is "a policy, not a check" (`handoffs/site-wave-0c.md:251-253`).

**Severity: Medium-High.** No leak exists today — D15 authorises the name-only
Baseball.AI card — but the one claim that makes an owner-edited public file safe
is untrue, so the next private project added to the file has no guard.

**Blocks the merge? No.** It is a governance/assurance gap, not a present leak.

**Evidence that would settle it.** A test that asserts every portfolio project's
`repo` is either absent from the manifest-private set or on the allowlist, run
against the current file and against a deliberately-private fixture project
(expect red). That is the "leak check covers it" proof the spec claims.

### 4. In-page accents borrow the theme-invariant `--color-band`, so they disappear in dark mode

**Claim.** The band's maroon is intentionally fixed (ADR-0015 decision 2), but
the wave also uses `--color-band` for elements **on the page**, where the theme
does flip. In dark mode that maroon sits on a near-black ground:

| use | selector | measured contrast |
| --- | --- | --- |
| identity rule (spec §2: "a thin maroon rule closes the block") | `site/src/pages/index.astro:143-148` | **2.02:1** on `--color-bg` |
| tenet card top border | `site/src/pages/index.astro:161-167` | **1.82:1** on `--color-surface` |
| SectionIndex card left border | `site/src/layouts/SectionIndex.astro:131-136` | **1.82:1** |
| footer top rule | `site/src/components/SiteFooter.astro:104-105` | **1.82:1** |

The token's own comment says why maroon is unusable on this ground: "Chicago
Maroon at #861f41 is very nearly black against this ground — it fails AA as text
and reads as a smudge" (`site/src/styles/tokens.css:163-166`). The spec asked for
a *maroon* rule, so the author followed it literally; the omission is that the
spec's dark theme never considered it. The accent family already solves this —
`--color-accent` flips to burnt orange in dark — and the card/identity structure
loses its only accent when it does not use it.

**Severity: Medium** (the home identity block and section cards lose their
designed accent in half the themes; non-text borders are decorative, so this is a
composition defect, not a hard WCAG failure).

**Blocks the merge? No.**

**Evidence that would settle it.** A dark-mode screenshot of `/`, `/research/`
and the footer next to the light ones, plus the numbers above. The owner then
decides between `--color-accent`, a dedicated theme-flipping rule token, or
accepting a deliberately flat dark treatment.

### 5. `--vt-orange-text` has no consumer, and the spec's unilateral hex change leaves ADR-0015 stating a value the site does not use

**Claim.** Spec §5 adds `--vt-orange-text` "for orange text and the
light-theme underline where #e5751f fails AA." In the shipped tree the token is
referenced only by `tokens.css` itself, `tokens.test.ts`, and `contrast.mjs` — no
component reads it. The band's current-section underline, the obvious candidate,
uses `--rule-orange` (#e5751f), which measures **3.02:1** on maroon
(`SiteBand.astro:169-177`) — the failing case the token was created to fix. The
result is a token that exists solely to satisfy a test pair. Separately, ADR-0015
decision 2 still specifies `#c64600` while `tokens.css:108` and the spec's inline
amendment say `#c34600`; the spec was edited by the build stream ("Amended
2026-10-02 (Wave 0c build)") and the ADR was not. It is the same owner, so this is
dispose-not-dispute, but the durable decision record is currently false.

**Severity: Medium** (dead token; ADR/spec/code disagree; the a11y problem the
token names is unproven against any real use).

**Blocks the merge? No.** But either use the token where orange text/underline
actually appears, or record why it is intentionally latent, and amend ADR-0015 to
the chosen hex in the same change (or revert the token to `#c64600` and let the
pair read 4.48:1, which the contract forbids).

**Evidence that would settle it.** A grep for `var(--vt-orange-text)` in a
component (currently zero), plus the owner's hex call. `npm run contrast` already
prints both ratios.

### 6. AI Safety is a project-less card on the home page, and `/research/` drops the tenet entirely

**Claim.** D15 deliberately leaves AI Safety as "question only,
Traffic.AI cross-reference as text" (STATE D15(4)), so the empty home card is
authorised. But spec §2.2 makes each card "a one-sentence question and the named
projects under it," and spec §10/plan §11 make the portfolio "the organising
structure of the `/research/` index (tenet → projects → digests)." Because
`site/src/pages/research/index.astro:12-21` flattens projects and never emits a
tenet, and because AI Safety's `projects` is `[]`, the AI Safety question and its
cross-reference appear on the home page and **never** on `/research/`. The index
lede ("Working projects grouped by the research question they answer") then
promises a grouping that has silently lost one of the three questions.

**Severity: Low-Medium** (D15 authorises the empty home card; the index loss is
an unstated side-effect of D15).

**Blocks the merge? No.**

**Evidence that would settle it.** Render `/research/` and confirm no AI Safety
heading/question; the owner decides whether the index should carry tenet headings
(with an "open question" state for a project-less tenet) or whether its ledger
should say only projects are listed.

## What I did not object to and why

- **The portrait is gone (contract candidate 1).** ADR-0015 decision 1 and the
  owner's default (no About page) settle it; the CV PDFs keep the photo, the
  CAV/JSON-LD `image` was removed (`site/src/pages/cv/[variant].astro:40`), and
  staging plus `public-build.mjs` both delete a stale copy, with tests. Text-led
  is coherent for a researcher's institutional hub; the OG card replaces the
  preview function. Not a defect.
- **The band is theme-invariant (candidate 2), as a band.** It is the explicit
  brand decision, white-on-maroon is 8.39:1 in both themes, and the contrast pair
  is checked. I object only to reusing that fixed token for in-page accents
  (objection 4), not to the band itself.
- **Owner wording is now live as fact (candidate 3).** D15 confirms the role
  line, department, and all six Elsewhere links; `footer.json` is the right home;
  handles still come from `cv-data` rather than being hard-coded
  (`site/src/lib/footer.mjs:47-56`). The remaining owner-data concern is the
  portfolio mappings, which is objection 2, not the footer.
- **No VT mark without permission (ADR-0015 decision 3).** Licensing declined
  (D13); affiliation is plain text.
- **`research-portfolio.json` is hand-maintained (candidate 4), as such.** I
  agree a non-manifest source is correct here; the objection is the missing guard
  (objection 3), not the choice.
- **The `#c34600` AA trade (candidate 6) as a value.** The arithmetic is
  right (4.57:1 vs 4.48:1) and the pattern matches `--color-muted` /
  `--color-caution`. The objection is procedural (ADR not amended) and the dead
  consumer, folded into objection 5.
- **Shared chrome, private-nav separation, and the `private-structure` extension.**
  The band/footer take navigation as props and import nothing private; the test
  was extended, not weakened. Sound.
- **`--tracker-petrol` removal** and the amended verbatim assertion. Matches ADR
  decision 4.

## Related docs

- `llm/sprints/2026-09-hub/contracts/dissenter-wave-0c.md`
- `llm/specs/2026-10-01-branding-design.md`
- `llm/governance/adr/0015-branding-no-portrait-band-and-mark-rule.md`
- `llm/plans/2026-09-19-branding-plan.md` §11
- `llm/sprints/2026-09-hub/STATE.md` D15
- `llm/sprints/2026-09-hub/handoffs/site-wave-0c.md`
- `site/src/data/research-portfolio.json`, `site/src/data/footer.json`
- `site/redirects/github-pages.json`, `site/scripts/route-inventory.test.ts`
