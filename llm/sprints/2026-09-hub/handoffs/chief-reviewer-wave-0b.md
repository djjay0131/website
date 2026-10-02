# Handoff — Chief Reviewer, Wave 0b (private by default)

Stream: Chief Reviewer (authored nothing in this wave; this handoff is its only write)
Wave: 0b — private by default (D8); PR #86
Branch: `feat/private-by-default`
Date: 2026-10-02
Contract: `llm/sprints/2026-09-hub/contracts/chief-reviewer-wave-0b.md`
Seams: `llm/sprints/2026-09-hub/contracts/private-by-default-seams.md` (SEAM-B1…B9)
ADR: `llm/governance/adr/0016-private-by-default-publish-allowlist.md`

**Verdict: Request changes** — two *Fix now* findings (uncommitted round fixes; the
A5 residual is not in the durable record). Both are documentary/mechanical. **No
security property in the shipped code is blocking**, and the core mechanism is
sound. **Governance level: L2** (confirmed).

`npm test` from `site/`: **291 passed, 1 skipped (23 files)** — matches the
handoff. No astro build run; no tracked file edited.

---

## The seven questions

### 1. Does the implementation satisfy D8 and SEAM-B1…B9? Name any unmet seam.

**Substantially yes.** D8's two-input test is implemented and enforced:
`effectiveVisibility()` (`hub-content.mjs:477-480`), the loader's public-omission /
private-tagging (`content.config.ts:405-436`), the condition-A throw
(`content.config.ts:415-420`), and the guard/staging/leak consumers all read it.

Seam by seam:

| Seam | Status | Evidence |
|---|---|---|
| B1 allowlist file/shape/L0 | **Met, with the claim qualified** (see Q6) | `site/publish-allowlist.json` (14 entries); `parsePublishAllowlist` `hub-content.mjs:386-438` |
| B2 one computation | **Met** | `effectiveVisibility()` `hub-content.mjs:477`; consumers below (Q2) |
| B3 `cv-data` residue | **Outcome met; demonstration partial** | render filter `cv/index.astro:15-20`, `resumes/index.astro:12-17`, `cv/[variant].astro:15-21`; Red Team A6 / Skeptic Demo 1 |
| B4 two builds | **Met** | public loader omits non-public `content.config.ts:420`; private loader stores all, skips `data` from staging `private-build.mjs:73-79`; private routes `src-private/pages/index.astro:13`, `[...itemPath].astro:14` |
| B5 guard A/B | **Met**; job named | `check-publish-allowlist.mjs:88-93,133-162`; wired `build.yml:1106-1109` and `:1235-1238` (Q4) |
| B6 widened private set | **Met for satellite items; hub pages not representable** | `check-no-private-in-public.mjs:139-173` (Q3, Q6) |
| B7 docs, no schema change | **Met** | `contract/README.md`, `docs/satellites.md`; `contract/manifest.schema.json` untouched in the diff |
| B8 ownership | **One cross-owner edit** (Q7 Note) | `.github/workflows/build.yml` (infra-owned) edited in this branch |
| B9 red-team targets | **Attacked; A5 is the one bypass** | `red-team-wave-0b.md` (Q7) |

**Unmet/qualified seams:** SEAM-B6's phrase "first-party hub pages included" is not
implemented (hub pages have no manifest; `collectPrivateItems` requires one,
`check-no-private-in-public.mjs:151-152`). SEAM-B1's "the only way to make
something public" is not literally true for committed first-party routes.
SEAM-B3's literal marker demonstration is only partially satisfiable (below).
These are all *dispositioned* — see Q6.

### 2. Is effective visibility computed in exactly one place, and does any public consumer still read raw `item.visibility` for a public decision?

**Yes.** `effectiveVisibility()` (`hub-content.mjs:477-480`) is the sole
combination of request and allowlist. A grep of `site/src/{pages,components,layouts,private}`
finds exactly one visibility read for a public decision —
`data.effective_visibility === "public"` at `[section]/[source]/[slug].astro:26` —
plus the private build's `format !== "data"` filters (which are not visibility
decisions). Every other public consumer routes through the same function:
`collectPublicItems` (`frame-content.mjs:264-265`, used by `projects/index.astro:35`,
the CV indexes and `cv/[variant].astro`), `public-build.mjs:97-100`,
`stage-public-assets.mjs:49,75`, `private-build.mjs:74`, and
`check-no-private-in-public.mjs:161`. No consumer re-derives, and none reads the
raw field. The Dissenter reached the same conclusion and explicitly accepted
`collectPublicItems` as a second *consumption* path, not a second computation.

### 3. Is the leak check's widened private set correct, and is the short-source-name carve-out justified and bounded?

**Correct.** `collectPrivateItems` selects `effectiveVisibility(...) === "private"`
over every manifest item, so it is exactly "every manifest item not effectively
public" — it now includes `cv/anthropic-fellow` (test:
`check-no-private-in-public.test.ts:38-56`). The carve-out is justified and
bounded: `SOURCE_MIN_LENGTH = 4` (`check-no-private-in-public.mjs:98`) drops only
the *bare* `source` needle for names shorter than 4 chars; the item's
`qualified-id`, `slug`, `route` and `payload-path` needles still apply
(`needlesFor`, `:180-212`). Today only `cv` (length 2) is affected, and a bare
`cv` needle would delimiter-match every `/cv/…` link in a clean build. Skeptic
Demo 5 shows both directions: a clean `cv`-bearing page passes, while
`cv/anthropic-fellow` is caught by qualified-id/route/slug. Bounded and
evidence-backed.

### 4. Is condition B's context-dependence implemented as SEAM-B5's amendment specifies, and is the evaluating job named?

**Yes.** `evaluateAllowlist` (`check-publish-allowlist.mjs:88-93`) fails on a
conflict in either mode and on a stale entry only in `pr` mode; the CLI emits a
hard error in `pr` and a loud warning + `::warning` annotation in `deploy`
(`:133-162`). It is wired into **both** build jobs with the mode chosen from the
event: `build` (GitHub Pages) `build.yml:1106-1109` and `build-firebase`
`:1235-1238`. The evaluating job is named in the handoff (Assumption 3) and,
critically, `private-sync` declares `needs: build-firebase`
(`build.yml:1424-1425`), so because deploy mode warns-and-exits-0, a satellite
rename cannot halt deploy **or** withdrawal. The SEAM-B5 amendment's coupling is
therefore exact, not approximate. Skeptic Demo 4 records `pr` exit 1 / `deploy`
exit 0 with `::warning`.

### 5. Does the ADR accurately record the decision, and do design doc §4/§5 point at it? Does `docs/satellites.md` / `contract/README.md` tell a satellite the truth?

**Yes**, with one working-tree-only caveat (see Fix now #1). ADR-0016 decisions
1–7 record the two-input rule, single computation, two builds, widened leak set,
A/B guard, no schema change, and the render-time `cv-data` filter. Design doc §4
is amended at `llm/specs/2026-09-10-research-hub-design.md` ("`visibility` is a
**request**…", added 2026-10-02) and §5 at the build description ("filters on
**effective** visibility…"). `contract/README.md`'s `visibility` row and
`docs/satellites.md` §Private items now state the request/decision split, the
two-step publish, and (in the working tree) that an allowlist entry can never
make a `private` item public. A satellite reading either doc learns the truth:
its `public` request renders behind sign-in until the owner allowlists it. The
hub-declarative and de-allowlisting reconciliations (Dissenter 1 and 3) are
present in ADR-0016 and `docs/satellites.md` but **only as uncommitted edits**.

### 6. Are the `hub/*` entries a gap between the seam's wording and the code? Is that dispositioned, not hidden?

**Yes, it is a real gap, and it is dispositioned — but not in the committed
branch and not in the seam text.** The code does not consume `hub/*`:
`findStaleAllowlistEntries` returns `false` for `HUB_SOURCE`
(`hub-content.mjs:534-535`), and `collectPrivateItems` only enumerates sources
with a `manifest.json` (`check-no-private-in-public.mjs:151-152`), so a
first-party page can never enter the leak check's private set. SEAM-B6 says the
set includes first-party pages; it cannot. The day-one allowlist confirms the
entries are declarative: it names only the research digests and omits `/`,
`/cv/`, `/resumes/`, `/privacy/`, `/signin/`.

Disposition: ADR-0016 decision 1 (working tree) states plainly that `hub/*`
entries are "declarative, not enforcing", that no satellite can author a
first-party page (ADR-0011's structural guarantee), and that a route guard is an
ADR candidate. The `site` handoff carries the same as Assumption 1 /
Recommendation 1 / ADR candidate 1. So it is disclosed, not hidden. Residual
debt: (a) it is uncommitted, and (b) `private-by-default-seams.md` SEAM-B6 still
says "first-party hub pages included" with no amendment pointer — the ADR
reconciles the decision but leaves the binding seam internally contradictory.

### 7. Any must-fix, should-fix or note. Grade governance level.

See Findings. **Governance level: L2 confirmed.** The PR changes who decides what
is public (design doc §4/§5 amended, ADR-0016 added, ADR-0011's model extended),
which is a semantic security/privacy change; the allowlist file is L0-*shaped*
to edit but the PR is mixed and classifies at its highest level. L0/L1
classification would be wrong.

---

## Verification of the Lead Architect's dispositions

**Red Team A5 — allowlist binds a name, not bytes — classified Fix later / owner
decision. Disposition: DEFENSIBLE as to the code; NOT yet discharged as a
disposition.** The bypass is real and deterministic (`red-team-wave-0b.md`
A5/A5b): `publicAssetPathFor()` gates on `(source, slug)` (`hub-content.mjs:106-114`)
but `stage-public-assets.mjs:75-82` names the destination from the slug and
copies bytes from the satellite's `path`, so a hostile `cv` manifest serves the
fellowship PDF at `/pdfs/academic.pdf` with every guard green.

Fix-later is the correct *classification* because:
- SEAM-B1 defines the entry as a `(source, slug)` pair; D8's "item" is a name.
  The code faithfully implements the seam. A5 does not violate the literal rule
  (`cv/academic` is allowlisted and `public`); it exploits that a name does not
  bind content.
- It is a pre-existing content-integrity gap: a satellite was always trusted for
  the bytes behind a public name. Closing it needs content digests in the
  manifest contract — barred by SEAM-B7's "no schema change" — or SEAM-B3
  option 2 in the `cv` satellite, which the site contract forbids it from
  touching. No pure allowlist code change binds bytes; a slug/path equivalence
  check is defeated by simply renaming the file.
- SEAM-B9 #3 and the exit criteria are about the hub's own build not rendering
  the variant, which holds (Red Team A6; Skeptic Demo 1).

But the disposition is **incomplete**: the Red Team explicitly required the
residual be recorded and an owner decision tracked, and ADR-0016's Risks section
mentions only the Pages mirror — neither HEAD nor the working tree contains any
name-vs-bytes/substitution/could-not-verify-bytes note (verified: `grep` for
`byte|A5|substitut|digest|hostile` finds nothing in the ADR). ADR-0016 also
states "the allowlist is now the security boundary"; shipping that next to an
unrecorded bypass is exactly the false-assurance shape this repository's ADRs
warn against. **The code fix is Fix later; the durable recording is Fix now.**

**Dissenter 1 (hub/\\* declarative) and 3 (de-allowlisting demotes, not
withdraws) — reconciled in ADR-0016/docs. SOUND**, and accurate to the code:
`private-build.mjs:73-79` renders every non-`data` item regardless of
visibility, so de-listing leaves the item members-only. Both texts are correct —
but uncommitted (Fix now #1).

**Dissenter 4 (deploy warning) — fixed with a `::warning` annotation. SOUND.**
`check-publish-allowlist.mjs:154-159` emits
`::warning title=Stale publish allowlist entry::…` when `GITHUB_ACTIONS=true`,
which meets SEAM-B5's "must not decay into ignore". Uncommitted, and **no
automated test asserts it** (Skeptic Demo 4 records it manually) — see Note.

**Security Tester 0 FAIL / stale `projects/index.astro` comment fixed.** Both
verified: the six-check gate is green, and the comment now reads that
`collectPublicItems` consumes effective visibility (`projects/index.astro:22-25`).
That edit is also uncommitted.

---

## Findings

### Fix now

1. **The adversarial round's fixes are uncommitted; PR #86's HEAD does not
   contain them.** `git status --short` shows `M docs/satellites.md`,
   `M llm/governance/adr/0016-…md`, `M site/scripts/check-publish-allowlist.mjs`,
   `M site/src/pages/projects/index.astro`; `git diff main...HEAD` contains none
   of them. Merging the branch now would silently drop the Dissenter 1/3
   reconciliations, the Dissenter 4 `::warning`, and the stale-comment fix —
   i.e. the merge would not match this review. Commit them into the branch and
   re-run `npm test` before merge.

2. **Record the A5 residual durably before merge.** ADR-0016 (Risks) and/or a
   tracking issue must state that the allowlist binds `(source, slug)`, not
   bytes; that a hostile satellite can substitute content onto an allowlisted
   slug; and that this is an accepted residual pending content digests or
   SEAM-B3 option 2 — and the owner decision must be attributed, not inferred.
   Live verification and the merge record must not claim the PDF interiors are
   protected by D8. Evidence: `red-team-wave-0b.md` Finding 1; absence of any
   such text in ADR-0016.

### Fix later

3. **A5 code — name-vs-bytes** (see disposition above). Owner decision; the fix
   belongs in the manifest contract (content hashes) or the `cv` satellite
   (SEAM-B3 option 2).

4. **Render-aware leak check (SEAM-B3 detection-coverage limit).** The Skeptic
   could not make an *arbitrary* marker inside the fellowship variant fail the
   grep, for two reasons: the render filter keeps the payload out of
   `dist-public` (`public-build.mjs:26,109-113`), and `needlesFor` has no needle
   for a private variant's own prose (`check-no-private-in-public.mjs:180-212`).
   The outcome holds today, but if the filter regresses that class of private
   residue would publish silently. Already carried as ADR candidate 2. Evidence:
   `skeptic-verifier-wave-0b.md` "Guards that could not be made to fail".

5. **Raw consumers trust unvalidated manifest JSON** (Red Team A4·4c):
   `collectPublicItems`, `public-build.mjs`, `stage-public-assets.mjs` and the
   leak check parse `manifest.json` directly and never check the slug pattern; a
   `hub`-named satellite with slug `research/soa-agentic-se` is treated as
   allowlisted-public by `effectiveVisibility()`. Not exploitable today (the Zod
   loader runs in every build), but it is a single point of failure for a future
   consumer. Consider a shared `isSafeItem()` guard.

6. **First-party route guard** (the SEAM-B1/B6 gap in Q6). ADR candidate 1 /
   `site` handoff Recommendation 1; do it before Wave 5's Pagefind/RSS work.

### Note

7. **SEAM-B8 ownership.** `.github/workflows/build.yml` is `infra`-owned per the
   seam table, but this branch edits it (mode wiring + the cv fingerprint hash,
   `build.yml:192-206,1106-1109,1235-1238`). `site-wave-0b.md` req 4 authorises
   the wiring but its Scope does not list the file. Reconcile: either add
   `build.yml` to this wave's site scope or attribute the edit to `infra` (and
   amend the seam table).

8. **SEAM-B6 text is left contradictory.** ADR-0016 reconciles "first-party hub
   pages included", but the seam file (`private-by-default-seams.md:172-175`) is
   unamended. Add a one-line amendment pointer so a future agent reading the
   binding seam does not believe hub pages are in the leak check's private set.

9. **The `::warning` has no test.** Dissenter 4's evidence explicitly suggested a
   test asserting `::warning` in deploy mode; the fix is manual-verification
   only.

10. **Historical Pages URL is 404, not 410/sign-in** (Dissenter 5). Permitted by
    SEAM-B9's recorded-residual clause and recorded in ADR-0016 Risks and the
    `site` handoff; the live post-merge probe remains outstanding and belongs in
    the merge record.

11. **De-allowlisting demotes; a public item is then served at two URLs**
    (public route and private route). Now stated in ADR-0016 and
    `docs/satellites.md` (working tree). Accurate; keep it.

---

## Verdict

**Request changes.** The D8 mechanism, the single computation, the widened leak
set, the A/B guard and its job wiring, and the documentation are correct, and
the security gate is green with 291 tests passing. The two blocking items are
documentary/mechanical: **commit the round's fixes into PR #86** and **record the
A5 name-vs-bytes residual + owner decision in the durable record**. The A5 code
change itself is soundly deferred as Fix later / owner decision. No security
property in the shipped code blocks merge.

## Related docs

- `llm/sprints/2026-09-hub/contracts/chief-reviewer-wave-0b.md`
- `llm/sprints/2026-09-hub/contracts/private-by-default-seams.md`
- `llm/sprints/2026-09-hub/contracts/site-wave-0b.md`
- `llm/sprints/2026-09-hub/handoffs/site-wave-0b.md`,
  `handoffs/{red-team,dissenter,skeptic-verifier,security-tester}-wave-0b.md`
- `llm/governance/adr/0016-private-by-default-publish-allowlist.md`
- PR: https://github.com/djjay0131/website/pull/86
