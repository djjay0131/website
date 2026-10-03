# Handoff — `Dissenter`, Wave 5 (Phase 6: polish — search, feed, redirects, Pages retirement)

Agent: Dissenter (independent; authored nothing in this wave)
Contract: `llm/sprints/2026-09-hub/contracts/phase-6-review-contracts.md` (Dissenter)
Seams: `llm/sprints/2026-09-hub/contracts/phase-6-seams.md` (SEAM-P1…P7)
Design authority: `llm/specs/2026-09-10-research-hub-design.md` §11; ADR-0005; ADR-0016; ADR-0020
Roadmap: `llm/master-roadmap.md` §`phase-6-polish` (`:421-464`); Checkpoint 7 in
`llm/sprints/2026-09-hub/STATE.md` (`:3399-3414`)
Hub repo: `/home/djjay/code/website` · branch `feat/phase-6` · HEAD reviewed `1cecb35`
Issue: `hub-006`

## Summary

I read the review contract, the seams, ADR-0020, the roadmap `phase-6-polish` scope/acceptance/
Checkpoint 7, the two wave-5 stream handoffs (`site-wave-5.md`, `infra-wave-5.md`), the site and
infra wave-5 contracts, and the code the wave lands: `check-no-private-in-public.mjs`,
`demo-leak-check.mjs`, `generate-redirect-stubs.mjs`, `public-feed.mjs`, `rss.xml.ts`, the
committed redirect map and allowlist, and `.github/workflows/build.yml`. I also ran read-only
probes (`npm run check:no-private-in-public`, `npm run redirects:check`, a gzip read of a real
`.pf_fragment`, `file` on the generated stubs, and a parse of `dist-public/rss.xml`). I wrote no
file but this one, modified no tracked file, and made no git/gh/cloud mutation.

**I raise six objections; four block.** D1: the wave leaves `redirects:check` unwired although
ADR-0020 decision 4 and Checkpoint 7 item 6 both require it as a CI step, and the committed map
is provably stale — so the guard the phase depends on does not exist. D2: file-shaped legacy URLs
(`.pdf`, `.json`, `.xml`, `.png`, `.svg`, `.ico`, `robots.txt`) are emitted as HTML meta-refresh
stubs at paths GitHub Pages will serve with the extension's content type, and one of them
(`/pdfs/academic.pdf`) is a Phase 1 smoke route — so "every entry forwards" and the smoke-test
acceptance are false for file routes. D3: the leak check's PASS banner claims contents coverage
of "any file" while the real Pagefind index payload (`.pf_fragment` / `.pf_meta`, gzip) is not
content-scanned and the demo never plants into it, so Checkpoint 7 item 5's "shown failing …
into each derived output" is not met for the search index. D4: the public stubs artifact
enumerates the private fellowship path by design and the leak check is path-blind, while
ADR-0020's "it was already public" premise is asserted, not verified anywhere in the repo.

Objection table. "Block?" means block the Wave 5 exit / Phase 6 close.

| # | Objection (claim) | Confidence | Block? |
|---|---|---|---|
| **D1** | `redirects:check` is absent from CI despite ADR-0020 decision 4 and Checkpoint 7 item 6; the map is currently red (6 routes missing) | High (reproduced) | **Yes** |
| **D2** | File-shaped URL stubs are HTML at extension paths; Pages serves them with the wrong MIME, so they cannot meta-refresh; the smoke test does not probe them | High (reproduced) | **Yes** |
| **D3** | The Pagefind index payload is not content-scanned; the PASS banner overclaims; the demo plants only into `pagefind-entry.json` | High (reproduced) | **Yes (checkpoint proof)** |
| **D4** | The stubs artifact publicly names the private fellowship path; the check ignores paths; ADR-0020's premise is unverified | High | **Yes (record/ADR premise)** |
| **D5** | The RSS feed is a satellite-manifest feed (4 items) while its description promises research/writing; first-party digests are absent | High (reproduced) | No (record/fix) |
| **D6** | "Pages retired" is a redefinition; the environment/host remain and only 2 of 57 entries are live-probed | High | No (record; overlaps D1/D2) |

---

## Objections

### D1 — `redirects:check` is unwired, contradicting ADR-0020 and Checkpoint 7 · BLOCK

**Claim.** The wave's own design authority and checkpoint require `redirects:check` to be a CI
step, and it is not in any workflow:

- ADR-0020 decision 4 (Accepted): *"**`redirects:check` becomes a required CI step**, so the
  committed map cannot drift from the route inventory."*
  (`llm/governance/adr/0020-pages-retirement-with-redirect-stubs.md:38-39`)
- `infra-wave-5.md` contract item 4: *"`npm run redirects:check` becomes a step that fails the
  build on drift."* (`contracts/infra-wave-5.md:25-30`)
- Checkpoint 7, defined before the phase: *"6. `redirects:check` is a required CI step."*
  (`STATE.md:3414`); scope: *"wire `redirects:check`."* (`STATE.md:3422-3423`)
- The implementation deliberately does not: `infra-wave-5.md:25-26` and `:160-195` say it was
  "left unwired (task item 4 overrides contract item 4)."

The claimed override is not in the control plane. A grep of `llm/` finds the phrase
"task item 4" only in the infra handoff itself; the site and infra contracts, `STATE.md`, and
ADR-0020 all point the other way. An Accepted ADR decision cannot be silently overridden by an
unrecorded "task item"; it must be amended or superseded (or an ADR written to defer it). As it
stands, the roadmap/checkpoint text and the workflow disagree, and the record does not reconcile
them.

Worse, the map is not merely unguarded — it is already wrong. `npm run redirects:check` exits 1:

```
inventory: 48 routes; committed map: 57 entries
routes missing from redirects/github-pages.json:
  /_payload/kgis/
  /_payload/kgis/assets/style.css
  /_payload/kgis/manifest.json
  /projects/fixture-one/
  /projects/fixture-two/
  /projects/kgis/kgis-docs/
```

So the acceptance criterion *"Every entry in the Phase 1 redirect map forwards"* is only half the
property; the complementary *"the map covers every route that must forward"* is known-false and
the guard that would say so is switched off.

**Evidence (reproduced).**
```
$ grep -n "redirects:check" .github/workflows/build.yml     # (no match)
$ cd site && npm run redirects:check ; echo EXIT=$?          # EXIT=1, output above
```
Sources: ADR-0020 `:38-39`; `STATE.md:3399-3423`; `contracts/infra-wave-5.md:25-30`;
`.github/workflows/build.yml:1089-1139, 1226-1244`.

**Settling act.** One of: (a) wire `redirects:check` green — regenerate
`site/redirects/github-pages.json` against the current inventory and make
`route-inventory.mjs` exclude the hub-internal `_payload/` prefix (the site handoff already
prescribes both), then add the step to `build`; or (b) amend ADR-0020 and Checkpoint 7 to record
the deferral as a decision with an owner and a date, and state that Phase 6 does not satisfy its
own checkpoint item 6. Regenerating the map is a real content-owner action, so (b) may be the
honest path — but the record must say so.

**Why it blocks.** A phase cannot be declared accepted against a checkpoint
(`STATE.md:3414`) whose item is not met, and the ADR it rests on (`ADR-0020` decision 4) is
contradicted by the shipped workflow with no amending ADR.

---

### D2 — File-shaped legacy URL stubs cannot forward under GitHub Pages MIME · BLOCK

**Claim.** The map has 18 file-shaped entries (`.pdf`, `.json`, `.xml`, `.png`, `.svg`, `.ico`,
`robots.txt`). The generator writes an HTML meta-refresh document at each exact path, e.g.
`dist-redirects/pdfs/academic.pdf` is an HTML document. GitHub Pages serves static files with a
content type derived from the file extension (`application/pdf`, `application/json`,
`application/xml`/`text/xml`, `image/png`, `image/svg+xml`, `image/x-icon`, `text/plain`). A
browser that receives HTML bytes under `Content-Type: application/pdf` does not parse them as
HTML and therefore never executes `<meta http-equiv="refresh">`; it shows a broken/empty PDF
viewer or downloads the file. The redirect does not happen in the browser (nor for a
crawler/browser-equivalent probe, which is what Checkpoint 7 item 1 demands).

This collides with two acceptance criteria directly:

- Roadmap acceptance: *"Opening each Phase 1 smoke-test route under
  `https://djjay0131.github.io/website` lands the browser on the matching `jason.cusati.us`
  URL."* `SMOKE_ROUTES` includes `/pdfs/academic.pdf` (`site/scripts/site-routes.mjs:33`), a
  file-shaped route; its stub is served as a PDF.
- Checkpoint 7 item 1: *"Every entry in `site/redirects/github-pages.json` forwards … (each
  entry)."* Fifteen-plus of the 57 entries are file-shaped.

The site handoff already noticed this and filed it as a *residual* ("A stub for a file-shaped
legacy URL … contains HTML at that exact path, so GitHub Pages will serve it with the extension's
content type. … Worth a smoke check on the infra side." `site-wave-5.md:215-220`). But the infra
smoke-test was not extended to cover it: it probes only `/website/` and `/website/cv/academic/`,
both directory-shaped (`build.yml:1319-1349`). So the known-broken class is untested and the
acceptance is asserted on two of 57 entries.

**Evidence (reproduced).**
```
$ cd site && file dist-redirects/pdfs/academic.pdf dist-redirects/build-info.json \
      dist-redirects/sitemap-0.xml dist-redirects/robots.txt
dist-redirects/pdfs/academic.pdf: HTML document, ASCII text
dist-redirects/build-info.json:   HTML document, ASCII text
dist-redirects/sitemap-0.xml:     HTML document, ASCII text
dist-redirects/robots.txt:        HTML document, ASCII text
$ head -c 200 dist-redirects/pdfs/academic.pdf
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="robots" content="noindex">
<meta http-equiv="refresh" content="0; url=https://jason.cusati.us/pdfs/academic.pdf">
```
Sources: `site/redirects/github-pages.json:7,35-77,203-205,219-225`;
`site/scripts/generate-redirect-stubs.mjs:62-74,86-102`; `site/scripts/site-routes.mjs:27-35`;
`.github/workflows/build.yml:1319-1349`.

**Settling act.** After the next deploy, `curl -sI
https://djjay0131.github.io/website/pdfs/academic.pdf` and observe the `Content-Type`; then open
the URL in a browser or a meta-refresh-following probe and observe whether it lands on
`https://jason.cusati.us/pdfs/academic.pdf`. If it does not (expected), either change the
mechanism for file routes (e.g. a directory-wrapped stub is impossible for a file URL on Pages;
a real HTTP redirect is not available; a small HTML-with-JS at a directory is not the same URL)
or amend the roadmap/checkpoint to scope "every entry" to directory-shaped routes and record the
file routes as unfixable on Pages. At minimum, add a live probe for one file-shaped entry so the
gap is measured rather than assumed.

**Why it blocks.** The wave's central deliverable is "the old URL forwards" (roadmap Ships,
`:423`). For roughly a third of the map — including a named Phase 1 smoke route — it does not,
and nothing in CI measures it.

---

### D3 — The Pagefind index payload is outside the contents scan; PASS and the demo overclaim · BLOCK (checkpoint proof)

**Claim.** SEAM-P6/Checkpoint 7 claim the leak check "covers the search index" and is "shown
failing when a private slug and title are planted … into each derived output." The shipped check
does not content-scan the actual index payload, and the demo does not plant into it.

- The real Pagefind index stores page text in the gzip `.pf_*` files. Reading one real fragment:
  keys are `['url','content','word_count','filters','meta','anchors']`, and `content` is the
  extracted page text (for `/research/`, ~hundreds of chars). So a private title/summary inside
  an index payload is invisible to the byte grep.
- `.pf_index`, `.pf_fragment`, `.pf_meta` are declared `BINARY_EXTENSIONS` and skipped by
  `isTextFile` (`check-no-private-in-public.mjs:144,308-325,375`).
- The "compensating control", `checkSearchIndexScope` (`:467-524`), inspects only each
  fragment's `url` (`fragmentUrls`, `:442-446`); it never reads `content`. It proves the index
  names public, existing URLs — not that the text it stores is public.
- `demo:leak-check` plants the private title only into `pagefind/pagefind-entry.json`, a text
  file, and explicitly notes the gzip `.pf_*` "are the documented binary limit and are not used
  for the plant" (`demo-leak-check.mjs:23-24,127-139`). It never plants into a real fragment's
  `content`.
- Yet the CLI's success banner prints: *"no private slug, route, payload path, title or summary
  appears in any path or **any file's contents** under dist-public"*
  (`check-no-private-in-public.mjs:729-735`) — with no binary caveat. The comment header
  documents the limit; the output a CI reader sees does not.

**Evidence (reproduced).**
```
$ node -e 'const fs=require("fs"),z=require("zlib");const d="site/dist-public/pagefind/fragment";
  const f=fs.readdirSync(d).find(x=>x.endsWith(".pf_fragment"));
  const j=JSON.parse(z.gunzipSync(fs.readFileSync(d+"/"+f)).toString().replace(/^pagefind_dcd/,""));
  console.log(Object.keys(j)); console.log("url=",j.url); console.log("content=",j.content.slice(0,80));'
[ 'url', 'content', 'word_count', 'filters', 'meta', 'anchors' ]
url= /research/
content= Skip to main content Fixture PersonVirginia Tech. Research. Working projects grouped…
$ cd site && npm run check:no-private-in-public | tail -2
check:no-private-in-public: PASS — no private slug, route, payload path, title or summary
appears in any path or any file's contents under dist-public and no private title or summary
appears in any stub under dist-redirects (210 file(s) scanned in dist-public, 58 in dist-redirects).
```
Sources: `check-no-private-in-public.mjs:144,308-325,375,442-446,467-524,729-735`;
`demo-leak-check.mjs:23-24,123-139`; `STATE.md:3411-3413`.

**Settling act.** Plant the private title into a real `.pf_fragment`'s `content` (gzip the JSON,
write it into the scratch copy's `pagefind/fragment/`), run the check, and show whether it is
named. It will not be. Then either extend `checkSearchIndexScope` (or `findLeaks`) to decompress
and needle-scan fragment/index `content`, or change the PASS banner and Checkpoint 7 item 5 to
state explicitly that the search-index *payload* is URL-scoped, not content-scanned, and that the
demo covers only `pagefind-entry.json`.

**Why it blocks the checkpoint claim.** Checkpoint 7 item 5 is a claim about a *deliberate
failing run* over each derived output. The search index is the one derived output whose payload
is not exercised by that run, and the printed PASS asserts the opposite. A checkpoint recorded
"passed" on this evidence would overstate what was proven.

---

### D4 — The stubs artifact publicly enumerates a private path; the check is blind to it by design · BLOCK (record / ADR premise)

**Claim.** `cv/anthropic-fellow` is effectively private — its manifest says `visibility: public`
but the committed allowlist omits it (`site/src/content/sources/cv/manifest.json:24-31`;
`site/publish-allowlist.json`), which is exactly ADR-0016's content-only-private case. The
committed redirect map nevertheless names its legacy paths:

```
site/redirects/github-pages.json:19   "/website/cv/anthropic-fellow/"   -> "/cv/anthropic-fellow/"
site/redirects/github-pages.json:67   "/website/pdfs/anthropic-fellow.pdf" -> "/pdfs/anthropic-fellow.pdf"
```

The stubs generator reproduces both paths in a **public** artifact (`generate-redirect-stubs.mjs`,
uploaded to Pages at `build.yml:1136-1139`), and `renderStub` writes the canonical target
containing the private path into the body and the `<link rel=canonical>`
(`generate-redirect-stubs.mjs:86-102`). So `https://djjay0131.github.io/website/**` remains a
public, crawlable enumeration of which legacy slugs are private. The leak check deliberately does
not flag this: `findRedirectStubLeaks` filters needles to `title`/`summary` only
(`check-no-private-in-public.mjs:539-570`), and its header calls the omitted path
"ADR-0020-accepted."

ADR-0020 justifies this with a factual premise: *"The map includes the private fellowship paths;
their stubs forward to the canonical URL … The stub text names only the path, which is already
public in the old map."* (`ADR-0020:77-81`). That premise is plausible but **unverified in this
repo**: nothing records that the pre-hub `djjay0131.github.io/website` actually served
`/website/cv/anthropic-fellow/` and `/website/pdfs/anthropic-fellow.pdf`. The map was generated in
Phase 1 from a route inventory, and the current Pages-variant fixture build does **not** emit
either route (they appear in `redirects:check`'s "entries with no route in this build"). If the
old site never served them (or served them only after the hub migration), the stub is a new
public disclosure of a now-private item on a second host, not a preserved legacy URL.

There is a second, structural gap: the stubs artifact is a *whole channel* the needle check
cannot see. If a future map entry's `to` were edited to contain a private title/slug that is not
also a `title`/`summary`, the guard passes. The check covers the public `dist-public` tree with
path+content needles but the stubs tree with title/summary needles only.

**Evidence.** Map `:19,:67-68`; allowlist (no `anthropic-fellow`); `cv/manifest.json:24-31`;
`generate-redirect-stubs.mjs:86-102,163-187`; `check-no-private-in-public.mjs:539-570`;
`npm run redirects:check` "entries with no route in this build" listing `/website/cv/anthropic-fellow/`
and `/website/pdfs/anthropic-fellow.pdf`.

**Settling act.** Verify the premise: check the pre-hub Pages site's history (the old repo's
committed routes, a Wayback capture, or the live URL before this deploy) that
`/website/cv/anthropic-fellow/` was publicly served; record the result in ADR-0020 or the
handoff. If it was, ADR-0020's rationale stands and the residual is accepted; if it was not, the
entry must be removed from the map (and the stub not generated), or the owner must sign off on
re-exposing the slug. Separately, decide whether the stubs channel should get the full needle set
or an explicit written exemption.

**Why it blocks (record).** ADR-0020's own Context says *"no private content may be served
publicly."* The artifact the wave ships serves the private slug publicly. That may be acceptable
under the ADR's "already public" carve-out, but only once the carve-out is true and on the
record — today it is an assumption carrying a phase's privacy claim.

---

### D5 — The RSS feed is a satellite-manifest feed, not the site feed its description advertises · Record / fix

**Claim.** `rss.xml` contains **4** items, all manifest items:

```
$ node -e '…parse dist-public/rss.xml…'
feed items: 4
 - https://jason.cusati.us/projects/kgis/kgis-docs/
 - https://jason.cusati.us/cv/academic/
 - https://jason.cusati.us/cv/research-professional/
 - https://jason.cusati.us/cv/sde-long/
```

`collectFeedItems` only emits items whose `feedPathFor` is non-null — framed `html`/`bundle`
items and `cv` PDFs (`public-feed.mjs:42-51,60-84`). All first-party content (the research
digests under `/research/**`, `/writing/`, `/papers/`, `/resumes/`, first-party project pages)
is not a manifest item and is structurally absent from the feed. Yet the feed's own description
is *"Research, projects, writing and CV updates published on jason.cusati.us."*
(`public-feed.mjs:33-34`). The roadmap acceptance ("The RSS feed validates and contains no
private item") is technically met — public-only by construction — but a reader/owner subscribing
expecting site-wide updates gets a satellite/cv-only feed, and the description overstates it.

**Evidence (reproduced).** `dist-public/rss.xml` item count and links above;
`public-feed.mjs:30,33-34,42-51,60-84`; `rss.xml.ts:17-28`.

**Settling act.** Decide the feed's contract: either (a) change the description to match (a
satellite-items feed), or (b) add first-party items (research/writing/papers) to
`collectFeedItems` with real dates, plus a test asserting the expected item set. Either way,
record which it is. Non-blocking for the privacy property.

---

### D6 — "Pages retired" is a redefinition; the host/environment remain and coverage is 2/57 · Record

**Claim.** ADR-0020 defines "retired" as "no longer serves the site" and keeps
`actions/deploy-pages`, the `github-pages` environment, and the `djjay0131.github.io/website`
host live as a stubs deployment (`ADR-0020:70-71`; `build.yml:1302-1315`). The roadmap scope
still says *"GitHub Pages retired as the site's host"* (`master-roadmap.md:431`) without recording
the ADR's narrowed meaning, so a reader can believe the Pages deployment is gone when it is not.

The live proof is thin: Checkpoint 7 item 1 asks for a "browser-equivalent probe of each entry,"
but the `smoke-test` job probes exactly two URLs (`build.yml:1319-1349`), and D2 shows at least
one class of entries (file-shaped) cannot forward. So neither the "each entry" breadth nor the
file-route depth is exercised in CI.

**Evidence.** `ADR-0020:70-73`; `.github/workflows/build.yml:1302-1349`; `master-roadmap.md:431`;
`STATE.md:3403-3406`.

**Settling act.** Amend the roadmap scope line (or an ADR note) to state the accepted meaning;
extend the live probe to all 57 entries (a script over the map) or record why only a sample is
probed. Fold the file-route gap into D2's settlement. Non-blocking on its own.

---

## Assumptions

- "The wave" is hub HEAD `1cecb35` on `feat/phase-6` (site `eb8328d`, infra `f8b38e9`). The
  working tree's only pending change at the time of writing is this new untracked handoff; I
  created no tracked-file change and ran no mutating command.
- My probes use the committed fixture (`site/src/content/sources/**` + `publish-allowlist.json`)
  and the local build outputs (`site/dist-public`, `site/dist-redirects`), which are gitignored.
  `npm run redirects:check` built the Pages variant into `node_modules/.cache` and removed it.
- I read only the two stream handoffs; other wave-5 agents (red team, skeptic, security, chief)
  may write concurrently and I read none of theirs. This is an independent read.
- D2's MIME claim assumes GitHub Pages' documented extension-based content types; I could not
  fetch the live host from here, so it is settled by a live `curl -I` after deploy (the settling
  act), not reproduced locally.

## Recommendations

1. **D1 (block):** wire `redirects:check` green (regenerate the map; exclude `_payload/`), or
   amend ADR-0020 decision 4 and Checkpoint 7 item 6 with an owner/date for the deferral.
2. **D2 (block):** live-probe a file-shaped stub; change the mechanism or amend the acceptance
   for file routes; add the probe to `smoke-test`.
3. **D3 (block the checkpoint proof):** either content-scan the decompressed `.pf_*` payload or
   correct the PASS banner and Checkpoint 7 item 5 to state the URL-only scope, and extend
   `demo:leak-check` to plant into a real fragment (expect red today).
4. **D4 (block record):** verify the old-Pages premise for `/website/cv/anthropic-fellow/` and
   `/website/pdfs/anthropic-fellow.pdf`; record the verdict against ADR-0020's carve-out.
5. **D5:** reconcile the RSS description with the actual item set (or broaden the feed) and test.
6. **D6:** record ADR-0020's meaning of "retired" where the roadmap uses the word; broaden the
   live probe to the full map.

## Alternatives considered

- **Treating D1 as a pure bookkeeping nit.** Rejected: it is an Accepted-ADR decision plus a
  checkpoint item that is not met, and the underlying map is known-red — the exact class prior
  dissenters blocked on.
- **Treating D2 as already-recorded (site handoff residual).** Rejected: recording a known
  failure as "worth a smoke check" is not the same as probing it or amending the criterion it
  contradicts; the wave still claims "every entry forwards."
- **Calling D3 a false positive because "dist-public is clean so the index must be."** Rejected:
  that is the control claim, not the proof; the check cannot see the payload, the demo does not
  exercise it, and the banner states otherwise.
- **Blocking on D4 as a new leak.** Softened to a block on the record: ADR-0020 plausibly
  covers it via the old-map carve-out, but the premise is unverified and the channel is
  exempted from the needle set.

## Risks

- **High (exit):** the phase closes against Checkpoint 7 item 6 while the required CI step is
  absent and the map is stale (D1); a third of the redirect map cannot forward on Pages,
  including a smoke route (D2).
- **Medium (privacy proof):** the leak check's PASS and Checkpoint 7 item 5 overstate
  search-index coverage; a private string in the index payload would pass (D3).
- **Medium (record):** the stubs host publicly enumerates a private slug on an unverified
  premise, and the stubs channel is exempt from content needles (D4).
- **Low/Medium:** the RSS feed under-delivers vs its description (D5); "retired" is redefined
  without amending the roadmap (D6).

## Open questions

- Does an unrecorded "task item 4" have authority to override an Accepted ADR decision and a
  checkpoint item, or must ADR-0020 be amended? (D1.)
- What is the intended behaviour for file-shaped legacy URLs on a host that cannot redirect and
  sets MIME by extension? (D2.)
- Is "the leak check covers the search index" meant to include the index payload's contents, or
  only its URLs? (D3.)
- Did the pre-hub Pages site actually serve the private fellowship paths? (D4.)
- Is `rss.xml` a site feed or a satellite-items feed? (D5.)

## Related docs

- `llm/sprints/2026-09-hub/contracts/phase-6-review-contracts.md` (Dissenter)
- `llm/sprints/2026-09-hub/contracts/phase-6-seams.md` (SEAM-P1…P7)
- `llm/sprints/2026-09-hub/contracts/{site,infra}-wave-5.md`
- `llm/sprints/2026-09-hub/handoffs/{site,infra}-wave-5.md`
- `llm/governance/adr/0020-pages-retirement-with-redirect-stubs.md` (`:38-39,70-81`)
- `llm/governance/adr/0005-two-output-build-with-leak-check.md`, `0016-private-by-default-publish-allowlist.md`
- `llm/master-roadmap.md` §`phase-6-polish` (`:421-464`)
- `llm/sprints/2026-09-hub/STATE.md` Checkpoint 7 (`:3399-3428`), U-7 (`:931`)
- `site/scripts/{check-no-private-in-public,demo-leak-check,generate-redirect-stubs,generate-redirect-map,site-routes,route-inventory}.mjs`
- `site/src/lib/public-feed.mjs`, `site/src/pages/rss.xml.ts`, `site/redirects/github-pages.json`,
  `site/publish-allowlist.json`, `site/src/content/sources/{cv,phd-milestones}/manifest.json`
- `.github/workflows/build.yml` (`:1080-1139,1226-1244,1302-1349`)

## ADR candidates

- **File-shaped legacy URLs on Pages are not forwardable by meta-refresh.** State the accepted
  behaviour (or exclude them) and how they are probed (D2).
- **The leak check's binary limit is part of its contract, and the PASS banner must state it.**
  Name which derived outputs are URL-scoped vs content-scanned (D3).
- **The redirect-stub channel is exempt from content needles by ADR-0020.** Record the exemption,
  its premise (old URLs were public), and the owner sign-off (D4).
- **`redirects:check` requiredness is a checkpoint item; deferral is a recorded decision, not a
  handoff aside** (D1).
