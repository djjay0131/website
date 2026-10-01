# Handoff — `Dissenter`, Wave 1

Agent: Dissenter (independent; authored nothing in this wave)
Contract: `llm/sprints/2026-09-hub/contracts/dissenter-wave-1.md`
Wave: 1 · Issue: #72
Repo: `/home/djjay/code/website` · branch `feat/satellite-kgis` · HEAD reviewed: `283de67`
Base: `main` (`c02596d`) · Review surface: the Wave 1 **record PR**

## Summary

I read the contract, the site handoff, the Red Team and Chief Reviewer handoffs, STATE
§Wave 1, the governance delta, the completion brief, `hub-content.mjs`, `frame-content.mjs`,
the fixtures and the tests. I ran local read-only commands only; I made no git/gh/cloud
mutation and wrote no file but this one. All fixtures I quote are invented.

**I raise eight objections.** One is a record blocker: **the revision under review
(`283de67`) does not contain the dispositions STATE and the handoffs already claim.** The
fixes for the Chief Reviewer's two *Fix now* findings, and the STATE correction of the
`#54` overstatement, exist **only in the working tree** — `git status` shows
`.github/workflows/build.yml`, `llm/sprints/2026-09-hub/STATE.md` and
`site/scripts/check-npm-audit.mjs` modified but uncommitted. `git show HEAD:…STATE.md` still
reads *"already fixed on main … verified this wave"* and `git show HEAD:…check-npm-audit.mjs`
still has the `--report` exit-2 path the reviewer reproduced. A record PR cut at `283de67`
would ship the state the Chief Reviewer already refused.

The other seven are record/robustness findings, each with a settling test, none a live
private-content exposure. The strongest are: the prefix-root staging re-stages a withdrawn
sibling document in violation of ADR-0010 decision 1 (reproduced, no test covers it); and
`kgis required: false` has no detector for the forgotten flip, so a vanished `kgis` prefix is
a silent no-op (reproduced).

Objection table. "Block?" means block the record PR.

| # | Objection (claim) | Confidence | Block? |
|---|---|---|---|
| **D1** | `283de67` does not contain the dispositions the wave says it does; the CR fixes are uncommitted | High | **Yes** |
| **D2** | Prefix-root staging re-stages a withdrawn sibling `.html`, violating ADR-0010 dec. 1 | High | No (Fix later + test) |
| **D3** | `kgis required:false` has no detector for the forgotten flip; a vanished `kgis` prefix is a silent no-op | High | No (require a flip trigger) |
| **D4** | `/projects/` cites D7 as sanctioning the two-authority merge; D7 is silent on composition | High that D7 is wrong; low that the merge is unauthorised | No (fix citation) |
| **D5** | The index filters on manifest `visibility`, not the hub allowlist D8 declares as the authority | Medium | No (Wave 0b must re-point) |
| **D6** | The audit baseline mixes units: `counts.high=4` (packages) vs 2 accepted advisories; "four accepted findings" is wrong. A fresh-id same-package advisory **is** caught | High | No |
| **D7** | The private `projects` fixture sits in an all-private source, so the index test cannot separate item-level from source-level filtering | Medium | No |
| **D8** | The site contract's FILE CONTRACT forbids `.github/workflows/**` while its own ITEM 4 mandates a `build.yml` edit; the wave resolved the conflict silently | High | No (record the conflict) |

Separately, the brief-tracking claim is **verified true** (see Assumptions).

---

## Objections

### D1 — The revision under review does not contain the dispositions the record claims · BLOCK

**Claim.** The wave says it corrected STATE for `#54` (site handoff, site-wave-1 §WIP; STATE
§Wave 1 "CR-2") and fixed the report-only audit's ability to fail the build ("CR-1"). Neither
is in `283de67`. They are uncommitted working-tree edits. `git log --oneline -1` is `283de67`;
`git status --porcelain` lists ` M .github/workflows/build.yml`, ` M
llm/sprints/2026-09-hub/STATE.md`, ` M site/scripts/check-npm-audit.mjs`.

**Why it matters.** The Chief Reviewer's verdict at `283de67` is **Request changes** on
exactly these two points (F1, F2). The record PR is meant to be the thing that closes that
verdict. At HEAD it does not: the tree asserts a correction it does not carry, and the audit
step still exits 2 on a run/parse failure in the deploying `build` job. A reviewer (or a
future reader) checking the merged tree against the handoff finds the handoff false. This is
the same class of overstatement the Chief Reviewer flagged as F1, one level up: the record,
not just the prose.

**Evidence that settles it (already run).**

```
$ git status --porcelain
 M .github/workflows/build.yml
 M llm/sprints/2026-09-hub/STATE.md
 M site/scripts/check-npm-audit.mjs
?? llm/sprints/2026-09-hub/handoffs/{chief-reviewer,red-team,regression-tester,security-tester,skeptic-verifier}-wave-1.md

$ git show HEAD:llm/sprints/2026-09-hub/STATE.md | sed -n '2586,2587p'
- #54 (forgeable metrics) is already fixed on `main` (`3f1a58a`, `_neutralise_grammar`) and
  the gate suite is green; verified this wave, not re-implemented.

$ git show HEAD:site/scripts/check-npm-audit.mjs | sed -n '95,112p'
  ... process.exit(2);   # twice, and no `report` guard
```

**Settling test / action.** Commit (or fold into the record commit) the three edits and the
five evidence handoffs, then re-run the Chief Reviewer's repro
`env PATH=/nonexistent node scripts/check-npm-audit.mjs --report` → must be `EXIT=0`; and
`git show HEAD:…STATE.md` must carry the correction. The record PR must be cut from a tree
where `git status --porcelain` is clean of these files.

**Confidence: high. Would block the record PR** until the tree and the record agree.

---

### D2 — Prefix-root staging re-stages a withdrawn sibling document, violating ADR-0010 decision 1 · Fix later

**Claim.** `stagingPlanFor` skips the withdrawn-document filter whenever the item's directory
is the source prefix root (`frame-content.mjs:166`, guard `!root && PAGE_EXTENSIONS…`). That
is correct for a *single-document* built site, but for any source that also has a **sibling
root-level page that the manifest no longer lists**, the withdrawn page is copied into the
output. ADR-0010 decision 1 says an item absent from the manifest is *"not rendered, not
staged, and not served — regardless of whether its bytes are still present."* The rule
contradicts the ADR in exactly that case.

**Why it matters.** The handoff discloses the residual ("for a multi-item source with a
root-level html item it would re-stage a withdrawn page") but argues "withdrawal is removing
the item, which removes the subtree." That argument only holds when the subtree *is* the
item. It is false for a sibling page, which is a separate document. The harm today is a
*public* page republished after withdrawal (kgis is public); for a future **private** source
with a root-level html item it is a private withdrawn page still served to signed-in members
— the precise failure decision 1 was written to prevent, and `mixedSourceError` does not
catch it because a uniformly-private source is not "mixed." Wave 4's `construction-ai-proposal`
ships `format: pdf + html` from its README (brief §4), so the multi-item case is on the
roadmap, not hypothetical.

**Evidence that settles it (reproduced).**

```
$ D=$(mktemp -d …)   # sources/rootsite/{index.html, old-withdrawn.html, style.css}
$ node --input-type=module -e 'import {stagingPlanFor} from "./src/lib/frame-content.mjs";
  console.log(stagingPlanFor(process.argv[1]+"/sources",
    [{source:"rootsite",slug:"docs",section:"projects",format:"html",path:"index.html"}]))' "$D"
[ { "from": ".../index.html",         "to": "_payload/rootsite/index.html" },
  { "from": ".../old-withdrawn.html", "to": "_payload/rootsite/old-withdrawn.html" },
  { "from": ".../style.css",          "to": "_payload/rootsite/style.css" } ]
```

`old-withdrawn.html` is declared by no item and is staged anyway. `frame-content.test.ts`
exercises the prefix root only for the *positive* case (entry document + sibling stylesheet);
it has **no** withdrawal case at the root.

**Settling test.** Add a fixture source with two root-level `format: html` items where one is
withdrawn (removed from `items`), and assert `stagingPlanFor` **omits** the withdrawn one.
That test fails today. The fix is not obvious (the rule cannot tell a built site's linked
page from a withdrawn page without an asset/document declaration), which is why the ADR
candidate below is the real resolution.

**Confidence: high. Would not block the record PR** (no such source exists today; the
residual is disclosed; the current harm is public-only), **provided** the record does not
assert decision 1 is fully honoured at the root and the ADR candidate is filed.

---

### D3 — `kgis required:false` has no detector for the forgotten flip · Fix later

**Claim.** ADR-0010 decision 4's amendment calls the post-publish flip "a checkpoint action,
not an optional tidy-up," because a source left at `false` makes a vanished prefix
undetectable — C27. But nothing in the system detects that the flip was forgotten. There is
no test, no CI step, and no state that distinguishes "declared, not yet published" from
"published, flip forgotten." `findMissingExpectedSources` filters on `entry.required`
(`hub-content.mjs:221`), so a `kgis` prefix that disappears **after** its first publish still
produces zero faults.

**Why it matters.** The failure is silent by construction. The one source for which C27 was
written (`phd-milestones`) was flipped manually; the second source relies on the same human
step, and the completion brief routes it to the owner ("first publish, live verification,
`required: true`", brief §3), where it can be dropped. `required:false` therefore conflates
at least three states: not-yet-published, published-but-forgotten, and intentionally optional.
A separate "declared but unverified" state (with an expiry or a publish-detection trigger)
would make the forgotten flip a reportable condition rather than a silent one.

**Evidence that settles it (reproduced).**

```
$ node --input-type=module -e 'import {findMissingExpectedSources} from "./site/src/lib/hub-content.mjs";
  console.log(JSON.stringify(findMissingExpectedSources(["cv","phd-milestones"]), null, 2))'
[]        # kgis absent after publishing: NOT a fault
$ node --input-type=module -e 'import {EXPECTED_SOURCES} from "./site/src/lib/hub-content.mjs";
  console.log(EXPECTED_SOURCES.find(e=>e.source==="kgis").required)'
false
```

**Settling test / action.** A check (test or CI step) that fails when a declared source is
**present** in a complete synced tree while its `required` is `false` — i.e., "you have
published; flip it" — or a third `status` value. The existing fixture cannot settle it
because the fixture tree always lacks `kgis`; the real settling evidence is a live probe after
the first publish (`npm run content:sync` from `main`, then assert no `required:false` source
is present). Until then the honest record is «`required:false` is a *bootstrap* state with no
detector», not «the flip is tracked».

**Confidence: high. Would not block the record PR** — `required:false` is correct today per
ADR-0010 dec. 4 — but I would require the flip trigger to be a named issue/check before the
wave is called done.

---

### D4 — `/projects/` cites D7 as sanctioning the two-authority merge; D7 does not · Fix citation

**Claim.** `projects/index.astro:9` says *"The Projects index has two sources, both
first-class (D7, Wave 1)."* D7 does not sanction merging the CV data pool with the satellite
manifest stream on one page. D7 is:

> **`research` and `projects` stay separate sections.** The owner considered merging them and
> declined; the section enum is unchanged. The Projects page title … becomes **"Projects"**.
> Research keeps the digests. — `STATE.md:490`, decision D7

That is a statement about **section separation**, not page composition or source authority.
Design §4 (`:113-126`) fixes the section enum and the html route shape
`/<section>/<source>/<slug>/`; it says nothing about a page drawing from two authorities. The
actual sanction for ITEM 2 is the `site-wave-1.md` contract (§ITEM 2) and the roadmap's Phase
5 acceptance ("project index | Self-updating projects section"), not D7.

**Why it matters.** The merge keeps `research` and `projects` separate, so it is not
*contrary* to D7 — but a code comment naming D7 as the authority is a mis-citation that will
survive into the design record. A future reader who trusts it may treat D7 as licensing any
cross-authority page, including one that *does* blend `research` and `projects` (which the
owner explicitly declined). Existing precedent (STATE S-3) shows the project has already had
to escalate a "does D7 cover this?" question; a wrong citation makes the next one harder.

**Settling evidence.** The D7 quote above; `projects/index.astro:9`; design §4 `:113-126`;
roadmap/design `:362`. The settling act is a one-line correction: attribute the merge to the
contract/roadmap, and confirm with the owner only if a page is ever proposed that crosses the
`research`/`projects` boundary.

**Confidence: high that D7 is not the authority; low that the merge is unauthorised** (the
contract authorises it). **Would not block the record PR.**

---

### D5 — The index filters on manifest visibility, not the allowlist the hub declares as authority · Fix later

**Claim.** `collectPublicItems` decides publicness with `if (item?.visibility !== "public")
continue` (`frame-content.mjs:256`). But decision **D8** makes the manifest's `visibility` a
*request* and the hub's committed publish allowlist the **authority**: *"An item is public only
if both its satellite manifest says `visibility: public` and the hub's committed publish
allowlist names its `(source, slug)`. … The manifest's `visibility` becomes a request; the hub
is the authority"* (`STATE.md:491`). The `/projects/` index is therefore built on the request,
not the authority.

**Why it matters.** Today the only manifest-public framed item is `kgis/kgis-docs`, which is on
D8's day-one allowlist, so nothing is wrong yet. But Wave 0b (`#46`) is the wave that
*implements* D8's allowlist, and it is sequenced **after** this record PR. When it lands, a
manifest-public item that is **not** allowlisted must not appear publicly — the index's filter
will list it. Unless Wave 0b is required to re-point the index at effective visibility, the
"signed-in only" guarantee will have an index-shaped hole. This is the concrete way the
Wave 1 merge of "two authorities" bites.

**Settling test.** A test that plants a manifest-`public`, `section: projects` item absent
from the (future) publish allowlist and asserts it does **not** appear on `/projects/`. Under
today's code that test fails — the item appears — which is the point: it pins the requirement
on Wave 0b. Until the allowlist exists, the honest record is that Wave 1 lists on manifest
visibility and Wave 0b owns the re-point.

**Confidence: medium.** It is a forward-compatibility requirement, not a live defect.
**Would not block the record PR**, but the Wave 0b contract should name it.

---

### D6 — The audit baseline mixes counting units; the "four accepted findings" record is wrong, but a fresh-id advisory does not hide · Record fix

**Claim.** `audit-baseline.json` records `"counts": { "high": 4 }` but `accepted` has **2**
entries. STATE §Wave 1 says *"The four accepted `@grpc/grpc-js` findings carry a reachability
argument."* There are four *vulnerable package entries* and two *unique advisories*:
`@firebase/firestore`, `@firebase/firestore-compat`, `@grpc/grpc-js` and `firebase` are the
package keys; the only advisory objects are the two `@grpc/grpc-js` GHSAs. Nothing reconciles
`counts` with `accepted`.

**Why it matters — and why the "could a new advisory hide?" worry is *not* realised.** The
guard's gate is advisory-level (`classify()`/`collectAdvisories`), so a genuinely new advisory
on the same package with a fresh id **is** caught (probed below). The defect is the *record*:
"four accepted findings" overstates the reasoning actually written down by two, and the
permanent 4-vs-2 mismatch can normalise "four highs are accepted" prose against a baseline
that reasoned about two. Which unit the baseline counts is genuinely ambiguous between its
`counts` field and its `accepted` array.

**Evidence (reproduced).**

```
$ node --input-type=module -e 'import {classify} from "./scripts/check-npm-audit.mjs"; …'
baseline.accepted.length = 2
baseline.counts = {"critical":0,"high":4}
audit metadata.vulnerabilities = {"info":0,"low":0,"moderate":0,"high":4,"critical":0,"total":4}
unique advisories = 2 [ 'GHSA-f596-whhp-79r4', 'GHSA-m9gg-hp2v-232j' ]
known = 2  novel = 0
with fresh-id same-package advisory -> novel = ["GHSA-brand-new-9999"]   # NOT hidden
```

**Settling test / action.** Either assert `counts.high === accepted.length` in
`check-npm-audit.test.ts` (this fails today, forcing the units to agree), or change the record
to "two accepted advisories across four packages" and add a test that a fresh-id advisory on
an accepted package is `novel` (it passes, and pins it). The id-reuse/severity-escalation
residual is the Red Team's F5 and is already recorded; it is *not* this objection.

**Confidence: high on the unit/record mismatch; high that fresh-id advisories do not hide.
Would not block.**

---

### D7 — The private `projects` fixture is all-private, so the index test cannot separate item-level from source-level filtering · Test-coverage gap

**Claim.** The WIP's `construction-ai-proposal/cost-model-draft` fixture was discarded for
`phd-milestones/internal-notes` — an item inside an **all-private** source. The index test
(`frame-content.test.ts:66-72`) asserts `internal-notes` is absent from
`collectPublicItems(FIXTURE_SOURCES, {section:"projects"})`. That assertion is satisfied by an
item-level filter **or** by a source-level filter that drops `phd-milestones` entirely, and the
fixture cannot tell the two apart. The discarded `construction-ai-proposal` was a differently
shaped source and would have discriminated better.

**Why it matters.** The contract's stated intent is "a private `projects` item the public index
must omit." An all-private source is the easy case; the load-bearing case for an
"untrusted, per-item visibility" model is a **mixed-visibility** source where the public item
must appear and the private one must not. The test is not useless — deleting the visibility
filter makes `internal-notes` appear and the test fails — but it does not prove the filter is
per item, which is the property the model depends on.

**Settling test.** Add a public source (or a test-local tree) containing one **public** and one
**private** `section: projects` item, both in a *named subdirectory* (so `mixedSourceError`
does not fire), and assert only the public one is listed. Note the structural constraint that
made the discarded source attractive: a private item in `kgis` would trip `mixedSourceError`
because `kgis` has a prefix-root item, so a realistic mixed fixture must use a named
subdirectory for both.

**Confidence: medium. Would not block the record PR** — the production filter is correct and
the obvious break is caught — but the fixture should be strengthened.

---

### D8 — The site contract's file boundary contradicts its own ITEM 4, and the wave resolved it silently · Record the conflict

**Claim.** `site-wave-1.md` FILE CONTRACT (`:47-51`) says *"You may modify, and nothing else:
`site/**`. Do not modify: … `.github/workflows/**` …"*. Its own ITEM 4 (`:90-96`) mandates
adding a report-only audit step **to `build.yml`** — a `.github/workflows/**` file. The wave
modified `build.yml` (`bf396a6`). One of the two clauses had to lose, and nothing in the wave
record says which, or why the file contract was overridden.

**Why it matters.** A bounded contract whose file boundary contradicts a required deliverable
is not bounded. A future wave that treats the file contract as binding would refuse a mandated
change; a future wave that treats item text as license could justify unrelated workflow edits.
The conflict is invisible unless someone compares the two clauses, and the record treats the
`build.yml` change as routine. (The same contract-forbids-`gate/**` question attaches to the
`#54` fix folded into `283de67`; that one is at least routed by brief §4, and the Chief
Reviewer raised it as F10.)

**Evidence.** `site-wave-1.md:47-51` vs `:90-96`; `git diff main...HEAD --stat --
.github/workflows/build.yml` is non-empty; `git log main...HEAD -- .github/workflows/build.yml`
→ `bf396a6`.

**Settling act.** State the precedence in this wave's record (item text governs the named
deliverable; the file list is otherwise binding), or amend the contract's file contract in
Wave 2. This is a process record item, not a code change.

**Confidence: high. Would not block the record PR.**

---

## Assumptions

- "The revision under review" is `283de67`, the HEAD the Chief Reviewer reviewed and the SHA
  the dissenter contract names. The working tree is **dirty** at the time of writing (the
  three uncommitted CR fixes); that dirt is the subject of D1, and I did not create or touch
  it.
- **The completion-brief claim is verified true.** `git ls-files
  llm/plans/2026-10-01-completion-brief.md` returns the path and `git diff --name-only
  main...HEAD -- …` lists it: it is tracked on this branch and in the PR range, not merely
  assumed. (Two nits worth a later edit: the brief's line 8 names the owner path as
  `/mnt/c/code/website`, while this checkout is `/home/djjay/code/website`; and its §3 says the
  WIP left *uncommitted* edits in `site/astro.config.mjs` and
  `check-no-private-in-public.test.ts`, whereas the WIP is committed as `9e7408a`. Neither
  changes the claim that the brief is tracked.)
- All private strings I quoted are the committed `(fixture)` values; I read no production
  private content.
- The two builds, the leak check and the suites are as reported by the Chief Reviewer at
  `283de67`; I did not re-run the full deployments (no cloud, per the no-mutation rule).
- The record PR is the merge gate under review; the Chief Reviewer's Request-changes verdict
  is still standing at HEAD (`283de67`) and is rebutted only by committing D1's edits.

## Recommendations

1. **D1 (blocker):** commit the three CR edits and the five untracked evidence handoffs before
   opening/readying the record PR, then re-run the Chief Reviewer's `--report` repro and
   confirm `git show HEAD:…STATE.md` carries the `#54` correction.
2. **D3:** file the missing flip trigger as a named check/issue — fail when a complete tree
   contains a `required:false` source, or add a third "declared-but-unverified" state with an
   expiry.
3. **D2:** add the withdrawn-sibling-at-root test and file the "declare the asset/document
   set" ADR candidate; do not claim decision 1 is fully honoured at the prefix root until then.
4. **D4/D5:** correct the `projects/index.astro:9` citation from D7 to the contract/roadmap;
   make Wave 0b (`#46`) own re-pointing the index at effective (allowlisted) visibility.
5. **D6:** reconcile the baseline's unit (`counts.high === accepted.length` as a test, or
   reword the record to "two advisories across four packages").
6. **D7:** strengthen the fixture with a mixed-visibility, named-subdirectory source.
7. **D8:** record which clause (file contract vs ITEM 4) governs `.github/workflows/**`.

## Alternatives considered

- **Blocking on D2 (withdrawn sibling re-staged).** Rejected: no source triggers it today,
  the handoff discloses it, and the current harm is republishing a withdrawn *public* page,
  not exposing private bytes. Blocking would overstate an unreachable case; requiring the test
  and the ADR candidate is proportionate.
- **Blocking on D5 (index vs allowlist).** Rejected: D8's allowlist does not exist until Wave
  0b, and no non-allowlisted public item exists today. It is a Wave 0b requirement, recorded
  rather than blocked.
- **Treating D6's "could an advisory hide?" as realised.** Rejected on evidence: a fresh-id
  advisory on an accepted package is reported `novel`. I record the unit/record defect instead
  of an unfounded hiding claim, because an objection without a settling test is noise.
- **Calling D1 a documentation nit rather than a blocker.** Rejected: the record PR is the
  artifact that rebuts a Request-changes verdict, and at HEAD it rebuts nothing. The mismatch
  is the same overstatement the review was convened to catch.

## Risks

- **High (record):** if the record PR is cut at `283de67`, the merged tree contradicts its own
  handoff on `#54` and the audit's non-blocking claim, re-shipping the two *Fix now* findings.
- **Medium (post-publish):** a vanished `kgis` prefix is undetected while `required:false`
  (D3); the flip depends on a human step routed to the owner.
- **Medium (future):** withdrawn root-level documents are re-served for any multi-item
  prefix-root source (D2); for a private source this is the decision-1 failure, not a public
  page.
- **Medium (Wave 0b):** the index lists manifest-public items ahead of the hub allowlist that
  D8 declares as the authority (D5).
- **Low (record):** "four accepted findings" vs two reasoned advisories (D6); the D7
  mis-citation (D4); the all-private fixture's blind spot (D7); the unrecorded file-contract
  conflict (D8).

## Open questions

- Is `required:false` a *bootstrap* state or a permanent *optional* state? If a source can be
  permanently optional, the current single boolean cannot express the difference (D3).
- Does D7 or D8 sanction the two-authority `/projects/` composition, or is the only authority
  the roadmap's Phase 5 acceptance? The owner should confirm if a cross-section page is ever
  proposed (D4).
- At the prefix root, is removal-of-item sufficient withdrawal for a *sibling* page, or must
  the manifest name every served document (D2)?
- Which clause governs when a contract's FILE CONTRACT and its ITEM list disagree (D8)?
- Was the discarded `construction-ai-proposal` fixture the intended mixed-visibility
  discriminator, and should Wave 0b's allowlist-test reuse that shape (D7)?

## Related docs

- `llm/sprints/2026-09-hub/contracts/dissenter-wave-1.md`
- `llm/sprints/2026-09-hub/contracts/site-wave-1.md`
- `llm/sprints/2026-09-hub/handoffs/{site,red-team,chief-reviewer}-wave-1.md`
- `llm/sprints/2026-09-hub/STATE.md` §Wave 1 (`:2558`), D7 (`:490`), D8 (`:491`)
- `llm/plans/2026-10-01-completion-brief.md` §3, §4, §7
- `llm/governance/governance-delta.md` §Project Principles, §Platform Enforcement Reality
- `llm/governance/adr/0010-withdrawal-semantics.md` decisions 1 and 4
- `llm/specs/2026-09-10-research-hub-design.md` §4 (`:113-126`), §11 (`:362`)
- `site/src/lib/hub-content.mjs`, `site/src/lib/frame-content.mjs`,
  `site/scripts/check-npm-audit.mjs`, `site/audit-baseline.json`,
  `site/src/pages/projects/index.astro`
- issues #54, #56, #59, #46

## ADR candidates

- **The declared-source state machine has three states, not two:** expected-and-required,
  expected-but-unverified (with an expiry or publish-detection trigger), and retired. Closes
  D3's "forgotten flip" hole and makes C27 detectable for every source, not just the one that
  happened to be flipped by hand.
- **A served document is named by the manifest, even at the prefix root.** Either the manifest
  declares each document of a built site, or `format: html`/`bundle` declares its
  document/asset set, so withdrawal is decidable without a directory heuristic. Reconciles the
  prefix-root rule with ADR-0010 decision 1 (D2; extends the site stream's own candidate).
- **The hub's publish allowlist (D8) is the sole authority for public *listing* as well as
  public *serving*;** section indexes consume effective visibility, never raw manifest
  visibility (D5).
- **A bounded contract's file boundary and its required items are checked for contradiction
  before the contract is issued** (D8) — a process guard, not a design decision.
