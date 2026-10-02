# Handoff — `site` (and `contract` docs), Wave 0b

Stream: `site` + the `contract` documentation half
Wave: 0b — private by default (D8)
Branch: `feat/private-by-default`
Date: 2026-10-02
Contract: `llm/sprints/2026-09-hub/contracts/site-wave-0b.md`
Seams: `llm/sprints/2026-09-hub/contracts/private-by-default-seams.md`

## Summary

Implemented D8: the committed `site/publish-allowlist.json` is now the hub's
authority on publication. `effectiveVisibility()` in `site/src/lib/hub-content.mjs`
combines the manifest request with the allowlist in one place; the collection
loader stores only effectively-public items in the public build and every item in
the private build; the leak check treats every non-allowlisted item as private;
and a new guard enforces the allowlist's own integrity. `cv/anthropic-fellow`,
which was publicly served on five origins, is now absent from `dist-public` and
its historical Firebase URLs redirect to `/signin/`.

Verified locally (2026-10-02): `npm test` 291 passed / 1 skipped; public build 26
pages; leak check PASS with 4 private items; allowlist guard PASS; private build 9
pages (`privateItemCount: 4`, `renderedItemCount: 8`); `check:private-links`,
`contrast` (52 pairs, 0 below AA), `demo:leak-check` and
`governance-checks --layout` all green.

**CI found a real leak the local run could not, and it is the wave's best evidence.**
On the first PR run both build jobs failed `check:no-private-in-public` on the
CI-generated `build-info.json`, whose cv-release fingerprint listed every release
asset — including `anthropic-fellow.pdf`. Fixed in `e360ce4`: the fingerprint is
now a SHA-256 over the sorted asset list, so change detection is unchanged and no
item is named. All PR checks then passed. PR: #86 (draft; not to merge before the
adversarial round, security gate and live verification).

## Assumptions

1. **The first-party `hub` entries are documentation, not enforcement.** The
   seams' SEAM-B1 says first-party pages use `source: "hub"`; the public research
   digests are entered. But first-party pages are compiled from committed
   `src/pages`, so no satellite can introduce one and there is no manifest item
   to filter or stage. The `hub` entries are therefore exempt from the stale
   check and are not consumed by the leak check. A route-level guard ("every
   emitted first-party route is allowlisted") is an ADR candidate, not built.
2. **`README`/`visibility` wording is the `contract` stream's.** Updated
   `docs/satellites.md` and `contract/README.md` directly; `contract/manifest.schema.json`
   is untouched (SEAM-B7).
3. **`check-publish-allowlist` mode is chosen from the workflow event** in both
   build jobs: `pull_request` → `pr` (hard-fail stale), otherwise `deploy`
   (warn). This answers SEAM-B5's open "which job evaluates the allowlist": it
   runs in both build jobs, so the deploy coupling is exact.
4. **Private build renders public items too** (SEAM-B4). To keep sync-private's
   P5 meaningful, the receipt's `privateItemCount` counts effectively-private
   items and `renderedItemCount` counts everything staged.

## Recommendations

1. **Add the first-party route guard** described in Assumption 1 before Wave 5's
   Pagefind/RSS work, so a new public page must be allowlisted too.
2. **Have the Skeptic Verifier plant a marker in the fellowship variant** and show
   the leak check catch it (SEAM-B3 explicitly requires this demonstration).
3. **Red Team the allowlist** on casing, Unicode, added path segments and a
   duplicate-slug rename; the schema patterns reject all of these today, but the
   transcripts belong in the wave record.

## Alternatives

- **Split `cv-data` in the `cv` satellite** instead of filtering at render time
  (SEAM-B3 option 2). Rejected: it is a satellite round-trip and a schema-bump
  negotiation for a one-file fix, and the hub already owns the render.
- **Keep the bare source needle for `cv`.** Rejected: it fails a clean build on
  `/cv/…` links; a guard that cries wolf is removed within a week.

## Risks

- **The Pages mirror is not retired until Phase 6.** The allowlist governs the
  `dist-public` build both hosts consume, so a redeploy removes the fellowship CV
  there too; a *historical* Pages URL becomes 404 (never 200). The Firebase origin
  redirects to `/signin/`. Silence about the Pages residual is not acceptable;
  this paragraph is the record.
- **Large private sync.** Members now see public items staged into the private
  bucket. Intended (SEAM-B4), but it grows the bucket and the sync.

## Open questions

1. Should the private area list public items? SEAM-B4 says yes; if the owner
   would rather the members' area show only what is not public, the private
   loader and pages are the two places to change.
2. Is a 302-to-`/signin/` acceptable for the historical PDF on Firebase, or does
   the owner want a true 410 (needs Hosting config the current deploy does not
   have)?

## Related docs

- `llm/sprints/2026-09-hub/contracts/private-by-default-seams.md`
- `llm/governance/adr/0016-private-by-default-publish-allowlist.md`
- `llm/sprints/2026-09-hub/STATE.md` §Wave 0b
- `docs/satellites.md` §Private items, `contract/README.md` field table

## ADR candidates

1. **A first-party route allowlist** (Assumption 1 / Recommendation 1).
2. **A render-aware leak check** — the Wave 1 Red Team's entity-encoded title and
   Wave 2's FP-1 both point at the grep's limits (carried forward, unchanged).
