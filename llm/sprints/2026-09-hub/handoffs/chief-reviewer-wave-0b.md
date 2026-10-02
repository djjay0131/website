# Handoff — Chief Reviewer, Wave 0b (private by default)

Stream: Chief Reviewer (authored nothing in this wave; this handoff is its only write)
Wave: 0b — private by default (D8); PR #86
Branch: `feat/private-by-default` (HEAD `c4d376d`)
Date: 2026-10-02
Contract: `llm/sprints/2026-09-hub/contracts/chief-reviewer-wave-0b.md`
Seams: `llm/sprints/2026-09-hub/contracts/private-by-default-seams.md` (SEAM-B1…B9)
ADR: `llm/governance/adr/0016-private-by-default-publish-allowlist.md`

**FINAL VERDICT: Approve.** Both *Fix now* findings from the first pass are closed
on the committed tree; the A5 "Fix later / owner decision" disposition is now
recorded, specific, and sound. **No security property blocks merge.**
**Governance level: L2** (confirmed).

Rebuttal-round evidence: `git status --short` is clean; HEAD is `c4d376d`
("adversarial round — fixes, dispositions, records"). `npm test` from `site/`:
**291 passed, 1 skipped (23 files)** — re-run on the committed tree. No astro
build run; no tracked file edited by this stream except this handoff.

---

## Closure of the two Fix-now findings

### F1 — round fixes were uncommitted. **CLOSED.**

`c4d376d` commits all four working-tree edits plus the records. `git show --stat
c4d376d` lists `docs/satellites.md`, `llm/governance/adr/0016-…md`,
`llm/sprints/2026-09-hub/STATE.md`,
`llm/sprints/2026-09-hub/contracts/private-by-default-seams.md`,
`site/scripts/check-publish-allowlist.mjs`,
`site/src/pages/projects/index.astro`, and the five
`handoffs/*-wave-0b.md`. `git status --short` is empty. Each fix is present as
committed content:

- Dissenter 4 — `::warning` on a deploy-mode stale entry:
  `check-publish-allowlist.mjs:154-159`, guarded by `GITHUB_ACTIONS === "true"`.
- Stale comment — `projects/index.astro:22-25` now states `collectPublicItems`
  consumes effective visibility; no claim to read raw `visibility`.
- Dissenter 1/3 — ADR-0016 decision 1 and `docs/satellites.md` (de-allowlisting
  demotes, does not withdraw). Verified both committed (not working-tree only).

### F2 — A5 residual was not in the durable record. **CLOSED.**

ADR-0016 gains **"Known residual — the allowlist binds a name, not bytes"**, which
is not a bare assertion. It: states the exact attack (`cv` points the allowlisted
`academic` item's `path` at `anthropic-fellow.pdf`); classifies it as
**pre-existing** (before D8 a satellite could publish anything by assertion; the
allowlist was never a content-integrity mechanism because the manifest contract
carries no hashes and SEAM-B7 forbids a schema change); explains why a **name/path
guard does not close it** (a satellite can serve different bytes at the same
path); names the two real fixes (**SEAM-B3 option 2** in the `cv` satellite, or an
**ADR for a content-digest binding**); marks it **owner decision required**; and
binds the documentation rule: *"Until one lands, D8 must not be described as
protecting the contents of an allowlisted item, only its identity."*
`STATE.md` §Wave 0b carries an "Adversarial round" summary and a **Dispositions**
table entry: "A5 … Fix later, High; owner decision required… Recorded in ADR-0016
'Known residual'." That is adequate recording: it names the decision, its owner,
its two exits, and the truthfulness constraint — it cannot be mistaken for
protection of the PDF interiors.

The first pass's Note that SEAM-B1/B6 contradicted the code is also addressed:
SEAM-B1 (amended 2026-10-02) says `hub/*` is declarative and "the only way to
publish" is literal for satellite items; SEAM-B6 (amended 2026-10-02) says
"first-party hub pages included" is not representable because the check operates on
manifest items. The binding seam is no longer internally contradictory.

---

## The seven questions (final)

1. **D8 / SEAM-B1…B9.** Satisfied. D8's two-input test is enforced at
   `hub-content.mjs:477-480`, `content.config.ts:405-436`, and the guard/staging/leak
   consumers. No unmet seam remains: B1 and B6 are now amended to match the code;
   B3's outcome holds, its marker demonstration is partial by nature (below); B8 is
   a Note, not a code defect.
2. **One computation.** Yes — `effectiveVisibility()` is the sole combination; the
   only public-decision visibility read in page code is
   `data.effective_visibility === "public"` (`[section]/[source]/[slug].astro:26`);
   every other consumer routes through the same function.
3. **Widened private set / carve-out.** Correct (`check-no-private-in-public.mjs:161`);
   the `SOURCE_MIN_LENGTH = 4` carve-out (`:98`, applied `:191`) is justified
   (bare `cv` matches every `/cv/…` link) and bounded (only `cv` today; qualified-id,
   route, payload-path needles still bind; Skeptic Demo 5).
4. **Condition B and the job.** As amended: `pr` hard-fails, `deploy` warns and
   continues (`check-publish-allowlist.mjs:88-93,133-162`), wired in both build jobs
   (`build.yml:1106-1109`, `:1235-1238`), and since `private-sync needs:
   build-firebase` (`:1424-1425`) the withdrawal coupling is exact.
5. **ADR / design §4-§5 / satellite docs.** Accurate and committed: ADR-0016
   decisions 1–7 plus the Known-residual section; design doc §4/§5 amended to point
   at it; `contract/README.md` and `docs/satellites.md` tell a satellite that
   `visibility` is a request and the allowlist the decision.
6. **`hub/*` gap.** Real, disclosed, now reconciled in ADR-0016 decision 1 and the
   SEAM-B1 amendment — not hidden.
7. **Findings / level.** See below. **L2** confirmed (security/privacy semantics;
   design doc §4/§5 amended; ADR-0016 added).

---

## Remaining findings

### Fix later

1. **A5 code — the allowlist binds a name, not bytes** (High). Owner decision
   required. Exit: SEAM-B3 option 2 in the `cv` satellite, or an ADR for a
   content-digest binding. Recorded (ADR-0016 "Known residual"; STATE Dispositions).
   Evidence: `red-team-wave-0b.md` A5/A5b; `stage-public-assets.mjs:75-82` copies
   from `item.path` while `publicAssetPathFor()` gates on `(source, slug)`
   (`hub-content.mjs:106-114`).
2. **Raw consumers trust unvalidated manifest JSON** (Red Team A4·4c). Not
   exploitable today (the Zod loader runs in every build) but a single point of
   failure for Wave 5's RSS/search/OG. Add a shared pattern guard. Evidence:
   `collectPublicItems` / `public-build.mjs` / `stage-public-assets.mjs` /
   `check-no-private-in-public.mjs` parse manifests directly.
3. **Render-aware leak check** (Skeptic Verifier). An arbitrary non-manifest-derived
   marker is not a needle, so if the render filter ever regressed that class of
   private residue would publish silently. ADR candidate 2, carried from Waves 1–2.
   Evidence: `check-no-private-in-public.mjs:180-212`;
   `skeptic-verifier-wave-0b.md` "Guards that could not be made to fail".
4. **First-party route guard.** SEAM-B1's "only the allowlisted can be public" is
   structural, not checked, for committed `src/pages/**`. ADR candidate; do before
   Wave 5. Evidence: `hub-content.mjs:534-535`;
   `check-no-private-in-public.mjs:151-152`.

### Note

5. **SEAM-B8 ownership.** `.github/workflows/build.yml` is `infra`-owned (seams
   `:208`) but edited in this branch (`build.yml:192-206,1106-1109,1235-1238`), and
   `site-wave-0b.md`'s scope does not list it. Req 4 authorises the wiring, so this
   is bookkeeping: add the file to this wave's site scope or attribute the edit to
   `infra` and amend the seam table. Unchanged since the first pass.
6. **The `::warning` has no automated test.** Dissenter 4 suggested one; the fix is
   manual-verification only (`skeptic-verifier-wave-0b.md` Demo 4). Committed,
   behaves correctly.
7. **Historical Pages URL is 404, not 410/sign-in** (Dissenter 5). Permitted by
   SEAM-B9's recorded-residual clause and recorded in ADR-0016 Risks, STATE and the
   `site` handoff; the post-merge live probe remains outstanding.
8. **De-allowlisting demotes; a de-listed public item is then served at two URLs**
   (public route and private route). Now stated in ADR-0016 decision 1 and
   `docs/satellites.md`. Accurate; keep it.
9. **No signal for a manifest-`public` item the allowlist omits** (Dissenter 2).
   Dispositioned Note/by-design in STATE: a `--pending` warning is optional and
   would warn forever on `anthropic-fellow`.

---

## Verdict

**Approve.** The two *Fix now* findings are closed on `c4d376d`: the round's fixes
are committed and the A5 residual is recorded in ADR-0016 (with its owner decision,
its two exits, and the constraint that D8 not be described as protecting an
allowlisted item's contents) and tabulated in STATE. The D8 mechanism is correct,
security gate is GREEN with 0 FAIL, and `npm test` is 291 passed / 1 skipped on the
committed tree. Remaining items are **Fix later** (A5 code, raw-consumer guard,
render-aware leak check, first-party route guard) and **Note** (SEAM-B8 ownership,
untested `::warning`, Pages 404 residual, dual-URL semantics, no public-request
signal). Nothing remaining blocks merge; the owner decision on A5 does not block
Wave 0b because D8's claim is now correctly scoped to item identity, and the
pre-merge gate is complete once live verification on both hosts records the
fellowship CV absent signed-out / present signed-in.

## Related docs

- `llm/sprints/2026-09-hub/contracts/chief-reviewer-wave-0b.md`
- `llm/sprints/2026-09-hub/contracts/private-by-default-seams.md`
- `llm/sprints/2026-09-hub/contracts/site-wave-0b.md`
- `llm/sprints/2026-09-hub/handoffs/site-wave-0b.md`,
  `handoffs/{red-team,dissenter,skeptic-verifier,security-tester}-wave-0b.md`
- `llm/governance/adr/0016-private-by-default-publish-allowlist.md`
- PR: https://github.com/djjay0131/website/pull/86
