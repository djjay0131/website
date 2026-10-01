# Handoff — `Chief Reviewer`, Wave 1

Agent: Chief Reviewer (independent; authored nothing in this wave; fixes nothing)
Contract: `llm/sprints/2026-09-hub/contracts/chief-reviewer-wave-1.md`
Wave: 1 · Issue: #72 · Branch: `feat/satellite-kgis` · HEAD reviewed: `283de67`
Base: `main` (`c02596d`) · Review PR: the Wave 1 **record PR** (not the live-exit PR)
Repo: `/home/djjay/code/website`

## Summary

**Verdict: Request changes.** Two *Fix now* findings — both small, neither a data
exposure — and the remainder Fix later / Note. The code is sound where it matters most
(private default, untrusted-manifest escaping, the one-way structural arrow, the
prefix-root staging rule, the report-only audit's *happy path*), the handoffs are unusually
honest, and STATE correctly records that Wave 1's live exit is **not** met. I independently
re-ran the suites and reproduced the key behaviours rather than trusting the handoffs.

The decisive issues are record and robustness, not design:

1. **F1 — STATE still records #54 as "already fixed" and does not carry the Red Team's
   correction.** `STATE.md:2586` says `#54 … is already fixed on main … verified this wave,
   not re-implemented`, and `:2635` says `#54 verified fixed`. The Red Team disproved that
   completeness (split key/value `{event: deny}` forged the metric) and commit `283de67`
   then fixed it. The correction lives only in that commit's message, the code comment, and
   `red-team-wave-1.md`; the sprint record itself is stale and wrong about a security fix.
   This is exactly the overstatement the review is required to catch.
2. **F2 — the audit step can fail the build, contrary to its own contract and comment.**
   `site/audit-baseline.json`/`check-npm-audit.mjs --report` is **not** unconditionally
   non-blocking: if `npm audit` cannot run or parse, or the baseline is unreadable, the
   script exits **2**, and the step sits in the `build` job, which deploys on `main`.
   Reproduced: `env PATH=/nonexistent node scripts/check-npm-audit.mjs --report` → `EXIT=2`.
   The contract (`site-wave-1.md` item 4) says it "must NOT be able to fail the build yet".

The most interesting security residual — the Red Team's Attack 4, where an
entity/zero-width/JSON-escaped private title evades the leak check — is **real and
unfixed**, but it is latent (no route emits a private title today) and I classify it Fix
later, provided the check's stated LIMITS are corrected so the guarantee is not overstated.
I reproduced it: a title with `&#111;` for `o` passes `check:no-private-in-public` (`EXIT=0`).

The wave's exit criteria are honestly **not** met: no `kgis` live publish, no owner
sign-in for A3/A4, `agentic-kgis` repo variables unset, `docs-publish.yml` still gated,
`kgis` still `required: false`, Checkpoint 4 not passed. None of that blocks this record PR;
all of it is stated.

## Question-by-question

### Q1 — `frame-content.mjs` refactor and the one-way arrow; `kgis` declared-not-required

**The structural guarantee is preserved.** `site/src/lib/frame-content.mjs` is public-safe
by construction (it never mentions "private"); `site/src-private/lib/private-content.mjs`
is now a six-name re-export (`private-content.mjs:17-24`) whose import arrow points
`src-private → src`. `scripts/private-structure.test.ts` still pins the forbidden direction
("no file under src/ imports src-private/, private-content or the private build",
`private-structure.test.ts:98-105`) and passes in my run (21 files, 271 passed / 1 skipped).
The refactor moved the shared facts *out of* `src-private`, which if anything strengthens
the stated property ("all private code lives outside the public source root"), since the
staging model is no longer private code at all.

**`required: false` is correct, not convenient.** The bootstrap reasoning is the
`phd-milestones` precedent and the transport fact in `hub-content.mjs:241-249`: PR runs
carry `refs/pull/<n>/merge` and the deploy binding admits only `refs/heads/main`, so every
PR build takes the `cv`-only fallback; a `required: true` source absent from that tree
fails every PR build. That is ADR-0010 decision 4's amendment, not a convenience. The
fixture-side change is honest: `content.config.test.ts:229-241` pins `kgis.required ===
false` *and* that a two-source tree is not a fault, so the eventual flip is a deliberate
test edit. Residual (Note): nothing forces the flip after the first publish; the
Dissenter's own contract asked what happens if it is forgotten. A settling test would be a
CI check that fails when `kgis` has published but `required` is still false.

### Q2 — untrusted manifest strings in `/projects/`; leak coverage of a private `projects` item

**Rendering is safe.** `/projects/` builds its satellite rows from `collectPublicItems`
(`projects/index.astro:25-47`) as **plain text** (`summary`, not `summaryHtml`); the only
`set:html` on that page path is `SectionIndex.astro:78` fed by `summaryHtml`, which the
index populates **only** from the first-party CV pool (`mdToHtml(p.summary)`,
`projects/index.astro:34`). Manifest `title`, `source`, `format` land in text nodes;
Astro auto-escapes them. The frame page (`[section]/[source]/[slug].astro`) passes
`title`/`description` to `Base.astro`, whose only `set:html` is `jsonLd`
(`Base.astro:84-85`), and the frame never passes `jsonLd`. I did not need to trust the
Security Tester here: the shape is closed, and its Check 2 transcript matches.

**The leak check does cover a private `projects` item.** The fixture
`phd-milestones/internal-notes` is `section: projects`, `visibility: private`
(`fixtures/content/sources/phd-milestones/manifest.json`). My run:
`check:no-private-in-public: 3 private item(s) … PASS … (163 files scanned)`, and
`dist-public/projects/index.html` lists `/projects/kgis/kgis-docs/` and contains **no**
trace of `internal-notes`, `Internal Project Notes`, or `phd-milestones`. So the same
section is both excluded from the index and covered by the check — the right pairing.

Caveat (Fix later): `collectPublicItems` deliberately does **not** validate manifests
(`frame-content.mjs:222-227`), so the index can read a malformed manifest. It is safe
because the content loader validates the same manifests in the same build and fails before
deploy, and because Astro escapes the interpolations — but the index's safety rests on the
loader running, not on its own input handling.

### Q3 — prefix-root staging rule and its residual

The rule is correct for a built site and is stated where it belongs. In
`stagingPlanFor` (`frame-content.mjs:151-170`): a `dir` of `.`/`""` is the source prefix
root → `root: true` → the **whole subtree** travels with no withdrawn-document filter,
because `path: index.html` names a folder's entry point (MkDocs `index.html` with sibling
pages/assets); a named subdirectory stages that directory **and** skips `.html`/`.htm` no
surviving item declares (ADR-0010 decision 1). Both arms are exercised by
`frame-content.test.ts` (prefix-root sibling stylesheet; containment under `..`), and the
private fixtures still prove the named-directory filter. The `mixedSourceError`
fail-closed guard now uses the **same** predicate (`public-build.mjs:44-50`, `dirname ===
"."`), which I verified catches `./index.html` — the Red Team's 1c bypass — and returns
`null` for `site/index.html`.

Residuals, both stated rather than hidden:
- **Stated in code and handoff:** at the prefix root, a withdrawn **public** page's bytes
  are re-staged (the filter does not apply); withdrawal there is removing the item. The
  dangerous mixed-visibility case is now blocked by `mixedSourceError`. Non-document assets
  of a withdrawn item are also indistinguishable from shared assets (`frame-content.mjs:118-121`).
- **Stated by the Security Tester (Risk, low):** the prefix-root walk copies
  `manifest.json` into `_payload/<source>/`. For a pure-public source this is harmless; for
  a mixed source it is now unreachable (fail-closed), and the leak check reads contents.

### Q4 — audit non-blocking / baseline-as-decision / #54 regression test

- **`--report` is non-blocking only while the audit runs.** `check-npm-audit.mjs:146`
  is `process.exit(report || novel.length === 0 ? 0 : 1)`, and I confirmed
  `--report` → 0 on the real audit. **But** lines 96-101 (`npm audit` did not return JSON)
  and 104-110 (baseline unreadable) `process.exit(2)`, and I reproduced `EXIT=2` with a
  broken `PATH`; the step (`build.yml:994-1002`) is in the `build` job, which runs the
  deploy. This contradicts the step comment "It MUST NOT fail this job" and the contract's
  item 4. **F2.**
- **The baseline is a written acceptance, not a suppression file.** `audit-baseline.json`
  carries a `$comment` with the reachability argument ("static build, no SSR, no Node server
  runtime, and no Firestore/gRPC calls at build or request time") and per-advisory `reason`
  fields, including that `npm audit fix --force` proposes a *downgrade*. The two entries are
  the two `@grpc/grpc-js` GHSAs behind `firebase`.
- **#54 has a regression test that fails by name.** `test_a_field_KEY_cannot_smuggle_the_denials_metric_trigger`
  (`gate/tests/test_client_events.py`, added in `283de67`) posts
  `fields: {event: "deny"}`; it was not present when the Red Team bypassed the value-only
  fix. The gate suite is **296 passed** in my run. The guard is load-bearing by
  construction (remove the assembled-pair neutralisation at `main.py:541-543` and the test's
  `"event=deny" not in written` assertion fails) — but see F3: no *independent* party has
  shown it red, because the Skeptic ran before this commit.

### Q5 — §7 merge conditions, itemised

See the table below. Short form: five hold, one partially holds, one is unverifiable here,
one (record completeness) needs the untracked handoffs staged.

### Q6 — overstatements in STATE and the handoffs

Handled in "Honesty audit" below. The material one is F1.

## Findings

| # | Class | Finding | Evidence that settles it |
|---|---|---|---|
| **F1** | **Fix now** | `STATE.md:2586`/`:2635` still assert #54 was already fixed and "verified this wave"; the Red Team disproved it and `283de67` fixed it. The sprint record does not record the correction. | Red Team Attack 6 transcript; `283de67` diff + commit message; `STATE.md:2586,2635`. Fix: amend the STATE Wave 1 section. |
| **F2** | **Fix now** | "Report-only" audit can fail the build job: `--report` exits 2 when `npm audit` cannot run/parse or the baseline is unreadable; the step is in the deploying `build` job. | `env PATH=/nonexistent node scripts/check-npm-audit.mjs --report` → `EXIT=2`; `check-npm-audit.mjs:96-110,146`; `build.yml:994-1002`. |
| F3 | Fix later | The two commits after the adversarial round (`4c6e2c5`, `283de67`) add/replace guards no independent party has broken; the Skeptic's contract guard #6 (#54) was explicitly **not** executed by the Skeptic. §7's "Skeptic Verifier no un-failable guard" therefore holds only for the reviewed revision. | `skeptic-verifier-wave-1.md:16-23` (admits #5/#6 not executed); its HEAD `4c6e2c5`; `283de67` adds `test_a_field_KEY…`, `mixedSourceError` `./`, `addFile` source guard, audit severity test. |
| F4 | Fix later | Leak check is evadable by an entity/zero-width/JSON-escaped private title, and its LIMITS list does not say so. | Red Team Attack 4; my repro: `<!-- Internal Project N&#111;tes (fixture) -->` → `check:no-private-in-public` `EXIT=0`; `needlesFor` (`check-no-private-in-public.mjs:157,174`) only adds an `htmlEscape` variant, never decodes. |
| F5 | Fix later | Audit baseline matching is still id-keyed beyond severity: a genuinely new advisory that reuses an accepted `id` (or a spoofed `via.url` ending in one) is "known", and an advisory named only as a `via` **string** is dropped. Latent until #59 graduates. | My probe: reused-id/different-package → `novel: []`; `via` string → `novel: []`; severity escalation → `novel: ["GHSA-m9gg-hp2v-232j"]` (fixed). `classify()` `check-npm-audit.mjs:69-82`. |
| F6 | Fix later | The Dissenter contract was authored but no `handoffs/dissenter-wave-1.md` exists; §5 requires ≥3 objections every wave. | `ls handoffs/*wave-1*`; `contracts/dissenter-wave-1.md`. |
| F7 | Fix later (record PR) | Four evidence handoffs are **untracked** and must be staged for the record PR, or the PR cites evidence that is not in the tree: `red-team`, `regression-tester`, `security-tester`, `skeptic-verifier`. | `git status --porcelain` → `?? …` for all four; STATE "handoffs land before the PR is marked ready". |
| F8 | Note | The prefix-root walk still enumerates a directory outside the tree when fed an unvalidated escaping `path` (the per-file `from` check drops each copy, so nothing is staged; and the schema/handler path is validated). Directory-listing side effect only. | My `stagingPlanFor` probes; `addFile` `from`-containment `frame-content.mjs:191`; Security Tester Check 3; Red Team 1b. |
| F9 | Note | Test totals differ across handoffs (263 / 268 / 271) because each ran at a different HEAD; only some handoffs state their HEAD. Not dishonest, but the site handoff's number has no HEAD attached. | site `bf396a6`; security `bf396a6`; red/skeptic `4c6e2c5`; regression `283de67`; my HEAD `283de67` = 271/1. |
| F10 | Note | `#54`'s fix is in `gate/**`, unchanged by this wave's original scope; the wave folded a fix into the record PR after the adversarial round. Correct to do, but it means "Wave 1 changed the gate" is now true and should be in the PR body. | `git diff main...HEAD -- gate/` is non-empty; `STATE.md:2631` still frames the adversarial round as pending. |

No finding is a *live* private-content exposure. No finding requires an apply.

## §7 merge conditions

| Condition | Holds? | Evidence |
|---|---|---|
| Required checks green | **Locally supported, unconfirmed on CI** | Required contexts are `governance-checks` and `budget-guard` (delta §Platform Enforcement Reality). Locally: governance `4 of 4 checks passed, 0 failed`; site `271 passed / 1 skipped`; gate `296 passed`; `build:public` 27 pages; `build:private` green; leak check PASS; executable bits untouched. No `gh` here, so CI run status is not verified. |
| Chief Reviewer approve/comment | **No — this report is Request changes** | F1, F2. |
| Security Tester zero FAIL | **Holds for the reviewed revision only** | `security-tester-wave-1.md`: PASS 7 · FAIL 0 · 8 out-of-scope at `bf396a6`. `4c6e2c5`/`283de67` post-date it. |
| Skeptic Verifier no un-failable guard | **Does not fully hold** | 6/6 breakable at `4c6e2c5`, but its contract's #54 guard was not executed (`skeptic-verifier-wave-1.md:16-25`) and `283de67`'s guards were never broken. F3. |
| Governance checks green | **Yes** | `node ~/code/agentic-governance/plugin/scripts/governance-checks.mjs --layout` → PASS links / adr-index / adr-status / layout, 4/4. |
| Brief committed | **Yes** | `llm/plans/2026-10-01-completion-brief.md` is in `git diff main...HEAD`. |
| PR body on template, Governance Level first, data/security/privacy answered | **Unverifiable here** | No PR body in the repo and no `gh`; must be checked on the PR itself. |
| Stateful-resource apply rule (no destroy/replace; the four live `kgis` resources safe) | **Yes, as a record condition** | No Terraform plan/apply this wave. The roster that owns the four live resources is on the branch (`variables.tf:185-192`, commit `a68feea`, an ancestor of HEAD), so once merged a plan from `main` includes rather than destroys them. Nothing in the diff touches stateful resources. |

Branch-protection caveat: `build.yml`'s `build` job is **not** a required check, so F2 does
not block the merge through branch protection; it fails the workflow and the deploy on
`main`. It is still a fix-now defect against the written contract.

## Honesty audit

- **WIP disposition — honest and consistent.** `STATE.md:2564-2570` and
  `site-wave-1.md:16-24` agree file-for-file; the instructive nuance ("DISCARD the source,
  keep the intent") is recorded in both, and the fixture source was moved to
  `phd-milestones/internal-notes` as the contract asked. No production WIP was deleted.
- **#54 "already fixed" — not honestly recorded in STATE.** It is corrected in the commit
  message, the code comment, and the Red Team handoff, but `STATE.md:2586` and `:2635` still
  claim it. F1. The handoff's "verified this wave" is therefore an overstatement: what was
  verified at `bf396a6` was the value-only neutralisation, which was incomplete.
- **"Verified" without evidence — none material.** The regression tester states its
  limitation (page counts reconstructed from source, not a `main` build). The Security
  Tester labels 8 §6 items OUT-OF-SCOPE rather than PASS. The Skeptic records two guards as
  unverified rather than passed. The Boundary Tester's K10 carries a validity control
  (CTRL-A 404), a scope control (CTRL-B 403) and a removal proof — a genuinely *proven*
  live result, though not re-runnable here without cloud impersonation.
- **`STATE.md` header staleness (Note).** The file still says "Last updated: 2026-09-16"
  while carrying 2026-10-01 sections; harmless but worth a bump at PR time.
- **Wave 1 exit is recorded as not met**, correctly and in the right places
  (`STATE.md:2622-2631`): no live publish, no owner sign-in for A3/A4, no repo variables,
  `docs-publish.yml` gated, `required: false`, Checkpoint 4 not passed. I confirm each is
  still true at `283de67`.

## Assumptions

- "Records mergeable" means the branch's tree plus the handoffs, with the four untracked
  handoffs staged; the Lead Architect stages/commits, not this reviewer.
- I treated `283de67` as the revision under review (HEAD); the handoffs at earlier SHAs are
  evidence about those revisions, not about HEAD.
- I did not re-run cloud/live proofs (K10, bucket IAM, sign-in): privilege and the no-
  mutation rule forbid it, so those rest on transcripts.
- Fixtures are invented; I read no production private content.

## Recommendations

1. **F1:** amend `STATE.md` §Wave 1 to record that #54's value-only fix was incomplete, that
   the Red Team's split key/value forged both metric triggers, and that `283de67` closed it
   with a named regression test. Drop "verified this wave, not re-implemented".
2. **F2:** make `main()` exit 0 under `--report` even on run/parse/baseline failure (print a
   warning and the raw stderr), so the step cannot fail the deploying `build` job.
3. **F3:** run a short Skeptic pass on `283de67` (break/restore the four new guards, plus the
   contract's #54 guard), or state explicitly that the wave accepts post-adversarial fixes
   on the strength of their tests alone.
4. **F4:** either add decoded / zero-width-stripped / JSON-unescaped title and summary
   needles, or add that limit to the file's LIMITS list so the guarantee is not overstated.
5. **F5:** if/when #59 graduates the audit, match on `(id, package, path)` and treat a
   `via` string or a metadata count with no advisory as a parse anomaly.
6. **F6/F7:** produce `dissenter-wave-1.md` (≥3 objections, each with a settling test) and
   stage all evidence handoffs with the record PR.
7. Flip `kgis` to `required: true` only after a verified first publish, with the
   `content.config.test.ts` edit (already pinned).

## Alternatives considered

- **Calling the leak-check evasion a Fix-now blocker.** Rejected: no public route emits a
  private title today, so it is a backstop gap, not a shipped leak; the honest move is to
  fix the *claim* (LIMITS) now and the needles later. Recorded as F4 rather than an
  unreachable fail.
- **Treating F2 as harmless because `build` is not a required check.** Rejected: the
  contract's words are "must NOT be able to fail the build", the failure mode is a
  registry/outage turning an unrelated push red, and the step gates the deploy.
- **Re-running the Skeptic's breaks myself.** Rejected: the reviewer fixes nothing and the
  role separation matters; I verified behaviour and left the break/restore to the Skeptic.

## Risks

- **Low, live:** none identified that puts private bytes on the public path. The two
  safety nets (schema validation at build, ADR-0005 leak check in the deploy path) both
  hold; the second has the entity-encoding gap (F4).
- **Medium, latent:** the `mixedSourceError` and leak check compose the way the Red Team
  said — a future route that emits a private title in an encoded spelling would pass the
  check. Closing F4 removes the composition.
- **Low, availability:** F2 can fail the `build` job (and thus a deploy) during a registry
  outage.
- **Process:** two commits landed after the adversarial round and before this review, so the
  formal §7 "Skeptic/Security on the reviewed revision" conditions are met only by
  inference. F3.

## Open questions

- Was the Dissenter deliberately dropped, or is `dissenter-wave-1.md` merely late? STATE and
  the handoff index are silent.
- Should the record PR carry the Red Team's *unfixed* findings (F4/F5) as committed known
  issues, or are they Wave 0b/Wave 5 work by the brief's routing (#62/#57 in 0b, #61/#63 in 5)?
- Does the contract intend the Skeptic's assignment list (which it executed) to supersede its
  own contract list (whose #5/#6 it skipped)? The handoff flags this and leaves it open.

## Related docs

- `llm/sprints/2026-09-hub/contracts/chief-reviewer-wave-1.md`
- `llm/sprints/2026-09-hub/contracts/site-wave-1.md`
- `llm/sprints/2026-09-hub/handoffs/site-wave-1.md`, `security-tester-wave-1.md`,
  `red-team-wave-1.md`, `skeptic-verifier-wave-1.md`, `regression-tester-wave-1.md`,
  `boundary-tester-wave-1.md`
- `llm/plans/2026-10-01-completion-brief.md` §5–§7
- `llm/sprints/2026-09-hub/STATE.md` §Wave 1 (boundary proofs; site stream; exit)
- `llm/governance/governance-delta.md`
- ADR-0005, ADR-0010, ADR-0011

## ADR candidates

- (Confirmed, from the Security Tester and Red Team) framed-item staging is containment- and
  `source`-checked at the output boundary, not only schema-checked at input — `283de67`
  begins this (`addFile` source guard); record it.
- (Confirmed) the prefix-root predicate has **one** declaration shared by the guard and the
  staging plan — `283de67` implements it (`dirname === "."` in both); record it.
- (New) the leak check's needle set is defined against decoded text, not raw bytes — or the
  encoded/zero-width/JSON spelling is an explicit, written limit.
- (New) a log-based metric trigger is matched against the **assembled** log line, not per
  field (`#54`; `main.py:541-543`).
- (From F6) the Dissenter's handoff is part of the wave's Definition of Done, not optional.

## Rebuttal review — 2026-10-01

Reviewer: Chief Reviewer (same independent role; authored none of the fixes)
Branch `feat/satellite-kgis` · original review at `283de67` · **re-verified at HEAD `12d2f48`**
Base `main` (`c02596d`) · Target: the Wave 1 record PR

### Summary

**Verdict: Approve. No remaining Fix-now finding.** Both original Fix-now findings are fixed
and verified at HEAD, the Red Team's four bypasses have real by-name regression tests that the
Skeptic re-verified, the Dissenter's blocker (D1) is resolved by committing the fixes, and the
previously-missing evidence handoffs are committed. The residual Fix-later items (F4 leak-check
encoding limit, F5 audit id-collision beyond severity, F8 directory-listing side effect) are
recorded and do not block the record PR. F3 (post-adversarial verification), F6 (missing
Dissenter) and F7 (untracked handoffs) are closed.

Approval is for the **code and records** of the record PR. It is not a statement that Wave 1's
**live exit** is met; that sequence remains the owner/satellite work STATE lists.

### F1 — STATE #54 correction: now honest

- `STATE.md` replaces the old "#54 … already fixed on main … verified this wave, not
  re-implemented" with a **CORRECTED** entry: main's `3f1a58a` neutralised each field KEY and
  VALUE; the Red Team disproved it (`{"event":"deny"}` joins to `event=deny`); fixed in this
  wave by neutralising the **assembled pair** (`gate/app/main.py`, `283de67`), with a
  regression test; and it states plainly **"the earlier 'verified fixed' line was wrong."**
- It adds a **Wave 1 adversarial-round dispositions table** (RT-1…RT-5, ST-1, CR-1, CR-2),
  each with a Fix-now/Fix-later disposition and the commit.
- Evidence: `git show HEAD:llm/sprints/2026-09-hub/STATE.md` carries the correction; the stale
  claim is gone. This is honest — it names the error in the first person and claims no more
  than was done.
- **Note (not blocking):** the RT-5 disposition says the leak check "already states the
  raw-text limit." The file's LIMITS list covers binary, metadata-less prose and prose slugs,
  and its header says it "greps bytes", but it does **not** enumerate the entity/zero-width/
  JSON-spelling gap specifically. The disposition is still honest because it says
  "Fix later — recorded, not fixed"; only that phrase is generous.

### F2 — report-only audit: fixed and independently reproduced

- `check-npm-audit.mjs` now funnels every inability-to-run path through
  `const fail = (message) => { console.error(message); process.exit(report ? 0 : 2); }`
  (parse failure and baseline-read failure both call it).
- `build.yml` adds `continue-on-error: true` to the audit step as belt-and-braces.
- Reproduced exactly as specified with a fake failing `npm`:
  - `PATH=/tmp/opencode/fakebin:$PATH node scripts/check-npm-audit.mjs --report` → **EXIT=0**
  - without `--report` → **EXIT=2**
- The contract's item 4 ("must NOT be able to fail the build yet") now holds on **every**
  path, including an audit that cannot run.

### Red Team's four fixes — real tests, verified by name

From `git show 283de67`, `git show bcb4470`, and the Skeptic's appended "Rebuttal round"
(`skeptic-verifier-wave-1.md:245-381`). Each guard was anchored uniquely, broken minimally,
shown red **by test name**, and restored:

| Guard | Test that fails when removed | Verified |
|---|---|---|
| #54 assembled-pair neutralisation | `test_a_field_KEY_cannot_smuggle_the_denials_metric_trigger` | gate, verbatim red transcript |
| `mixedSourceError` `./index.html` root | ``treats `./index.html` as root too, matching stagingPlanFor`` | site, red |
| `addFile` source-segment guard | `rejects a source that escapes the payload root` | site, red |
| audit severity escalation | `SHOWS RED when an accepted id is reported more severely` | site, red |
| `--report` hard exit-0 (`fail()`) | exit 2 under `--report` when `fail()` is broken (no Vitest name) | CLI, red |

All four test names exist at HEAD (grep-confirmed). My own HEAD run: site **271 passed / 1
skipped**; gate **296 passed**; `build:public` 27 pages and 3 payload files; `build:private`
green (87 paths checked); leak check PASS (163 files); governance **4/4 PASS**.

### Newly committed records

`git status --porcelain` is **clean**; eight Wave 1 handoffs are tracked, including
`dissenter-wave-1.md`, `red-team-wave-1.md`, `security-tester-wave-1.md`,
`regression-tester-wave-1.md`, `skeptic-verifier-wave-1.md` and this one.
`contracts/site-wave-1.md` FILE CONTRACT now allows `.github/workflows/build.yml` for ITEM 4
only (Dissenter D8); `projects/index.astro` cites the roadmap Phase-5 criterion and notes the
D8/allowlist deferral to Wave 0b (D4/D5); `audit-baseline.json` states package vs advisory
units (`high_packages: 4`, `unique_advisories: 2`, Dissenter D6). The Dissenter's D1 block —
that the CR fixes were uncommitted at `283de67` — is resolved: they are in `bcb4470`.

### Remaining findings (none Fix-now)

| # | Class | Status at HEAD |
|---|---|---|
| F4 | Fix later | Leak check still evades an entity/ZWSP/JSON-encoded private title; formally dispositioned RT-5 "recorded, not fixed". Latent; not a live exposure. |
| F5 | Fix later | Audit baseline still id-keyed beyond severity (reused-id/`via`-string cases); latent until #59 graduates. |
| F8 | Note | `stagingPlanFor` directory-listing side effect on a crafted, schema-unreachable `path`; nothing is staged. |
| n1 | Note | STATE RT-5 wording ("already states the raw-text limit") is slightly generous (F1 note). |
| n2 | Note | Dissenter D2 (prefix-root withdrawn sibling), D3 (forgotten `kgis` flip), D7 (all-private fixture) are correctly recorded as Fix later / ADR candidates, not silently closed. |

### §7 merge conditions at `12d2f48`

| Condition | State |
|---|---|
| Required checks green | **Holds locally** — governance 4/4; site 271/1; gate 296; both builds + leak check green. CI run status not verifiable here (no `gh`); no code now contradicts it. Confirm on the PR. |
| Chief Reviewer approve/comment | **Approve** (this rebuttal). |
| Security Tester zero FAIL | PASS 7 · FAIL 0 at `bf396a6`; the four fixes it informed are re-verified by the Skeptic at `bcb4470`. **Holds.** |
| Skeptic Verifier no un-failable guard | 6/6 first pass **plus 5/5 rebuttal**, break → red by name → restore. **Holds.** |
| Governance checks green | **Holds** (4/4 PASS). |
| Brief committed | **Holds** (`llm/plans/2026-10-01-completion-brief.md` in the tree). |
| PR body on template, Governance Level first, data/security/privacy answered | **Unverifiable here**; must be checked on the PR itself. |
| Stateful-resource apply rule (no destroy/replace; four live `kgis` resources safe) | **Holds** — no plan/apply this wave; roster `a68feea` is on-branch so a merged `main` includes rather than destroys them. |

### Wave 1 EXIT criteria still unmet — and correctly recorded as unmet

I confirm each at HEAD; none blocks the record PR:

- **No `kgis` live publish** — `/projects/kgis/kgis-docs/` is fixture-only; Phase 5 criterion 1 unchecked.
- **No owner sign-in for A3/A4** — the non-member half needs `djjay0131@gmail.com`; Checkpoint 4 not passed.
- **No apply this wave** — no Terraform plan/apply; `agentic-kgis` repo variables unset; `docs-publish.yml` still `workflow_dispatch`-gated.
- **`kgis` still `required: false`** — with no forgotten-flip detector (Dissenter D3, recorded).

`STATE.md` §Wave 1 exit (`:2622`+) and the five-line status record all of these, and the record
does not tick any criterion on inference. Verdict: **Approve.**

— Chief Reviewer, Wave 1, rebuttal round.
