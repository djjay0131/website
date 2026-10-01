# Handoff — `site`, Wave 1

Agent: site (executed by the Lead Architect in the OpenCode session; see Assumptions)
Contract: `llm/sprints/2026-09-hub/contracts/site-wave-1.md`
Wave: 1 · Issue: #72

## Summary

Finished the Wave 1 site stream that died on a provider billing error. `kgis` is
declared-but-not-required; `/projects/` lists manifest items (and omits a private one);
the public `html` frame and its payload staging exist and are exercised by the committed
fixture; `npm audit` is wired into CI report-only with a recorded baseline. The WIP commit
`9e7408a` was reviewed and dispositioned below. Full suite: 263 passed, 1 skipped. Both
builds green under `npm run content:fixture`; leak check green.

## The WIP commit `9e7408a` — keep / discard

| File | Verdict | Why |
|---|---|---|
| `site/astro.config.mjs` — `publicBuild()` import + integration | **KEEP** | The intent was right; it was broken only because `scripts/public-build.mjs` did not exist. That module now exists (item 3), so the import resolves and the build passes. |
| `site/src/content.config.test.ts` — expects `kgis` in `EXPECTED_SOURCES` | **KEEP** | Correct expectation; the missing production change was the stream's, not the test's. `EXPECTED_SOURCES` now carries `kgis`. |
| `site/scripts/check-no-private-in-public.test.ts` — expects `construction-ai-proposal/cost-model-draft` | **DISCARD the source, keep the intent** | `construction-ai-proposal` is Wave 4 and has no fixture; asserting it here fails. The intent — a PRIVATE `projects` item the public index must leave out — is kept by planting `phd-milestones/internal-notes` (`section: projects`, `visibility: private`) in the committed fixture instead. |

No production work in `9e7408a` was deleted; only the premature fixture source was changed.

## What changed

- `src/lib/hub-content.mjs` — `kgis` in `EXPECTED_SOURCES`, `required: false`, `since:
  "Wave 1 (satellite 3)"`, with the bootstrap reasoning.
- `src/lib/frame-content.mjs` (new) — the shared, public-safe frame model: `routeFor`,
  `payloadUrlFor`, `PAYLOAD_ROOT`, `findUnservablePaths`, `GATE_SEGMENT_PATTERN`,
  `stagingPlanFor`, and `collectPublicItems`. One declaration for both outputs.
- `src-private/lib/private-content.mjs` — now a thin re-export of `frame-content.mjs`.
  The private build's import path is unchanged, so `private-structure.test.ts`'s one-way
  arrow still holds: nothing under `src/**` imports anything under `src-private/**`.
- `src/pages/projects/index.astro` — lists the CV pool's projects **and** every public
  `section: projects` manifest item, from the manifest alone.
- `src/pages/[section]/[source]/[slug].astro` (new) — the public frame; iframes the
  staged payload; `cv` excluded (its items render at `/cv/`, `/resumes/`).
- `scripts/public-build.mjs` (new) — stages the payload of every public html/bundle item.
- `src-private/lib/private-content.mjs` staging — a root-level `index.html` now stages the
  whole prefix (a built site's folder), not the single file.
- `.github/workflows/build.yml`, `scripts/check-npm-audit.mjs` (new),
  `audit-baseline.json` (new) — report-only audit (#56/#59).
- `fixtures/content/sources/kgis/**` (new) and a private `projects` fixture item.

## The prefix-root staging rule (item 3)

The real satellite's `kgis-docs` item has `path: index.html`, so its containing directory
is the source prefix root. Two different rules apply:

- **Named subdirectory** (e.g. `phd-milestones` `site/index.html`): stage the directory,
  but skip any `.html` no surviving item declares — a withdrawn document's bytes must not
  travel (ADR-0010 decision 1).
- **Prefix root** (e.g. `kgis` `index.html`): stage the whole subtree, including sibling
  pages and assets. `path` names the built site's entry point, not the only document, and
  withdrawal is removing the item, which removes the subtree.

Both are exercised by tests; the private fixtures still prove the named-directory filter.

## Validation (verbatim)

```
$ npm test
 Test Files  20 passed (20)
      Tests  263 passed | 1 skipped (264)

$ npm run content:fixture && npm run build:public
[hub-public-build] staged 3 payload file(s) for 1 public framed item(s)
[build] 27 page(s) built

$ grep -o 'href="/projects/kgis/kgis-docs/"' dist-public/projects/index.html
href="/projects/kgis/kgis-docs/"

$ npm run check:no-private-in-public
check:no-private-in-public: 3 private item(s) to look for in dist-public
check:no-private-in-public: PASS — ... (163 files scanned)

$ npm run build:private
[hub-private-build] staged 4 payload file(s) for 3 private item(s)
[hub-private-build] checked 87 emitted path(s) against the gate's allowlist (SD-7)
```

## Assumptions

- The contract names a `site` sub-agent; the environment is OpenCode, the stream's own
  author had died, and the Lead Architect completed the work directly. The independent
  adversarial and review roles below are what preserve the separation of duties, not the
  authorship of the implementation.
- The `kgis` fixture is invented; the real manifest lives in `agentic-kgis` and its
  `path: index.html` is what drove the prefix-root rule.

## Recommendations

1. After the first verified `kgis` publish, flip `required: true` in `EXPECTED_SOURCES`
   and update the `content.config.test.ts` expectation. Do not flip it before.
2. The audit step is report-only by design. Make it fail on a DELTA against
   `audit-baseline.json` only if the owner wants audit to block merges (#59).

## Alternatives considered

- Put the frame helpers in `src-private/lib/private-content.mjs` and import them from the
  public build — rejected: violates the one-way structural guarantee.
- Duplicate the staging plan in `public-build.mjs` — rejected: two declarations of the one
  fact (route/payload/staging) that must not drift between outputs.
- Change the `kgis` manifest `format` to `bundle` — rejected: the manifest is the
  satellite's, the owner's decision record says `html`, and the hub must serve what the
  contract calls `html`.

## Risks

- The prefix-root rule stages sibling `.html` pages of a folder site without the withdrawn-
  document filter. For a single-item built site this is correct; for a multi-item source
  with a root-level html item it would re-stage a withdrawn page. No such source exists
  today, and ADR candidate below removes the ambiguity.

## Open questions

- Should `format: html` declare its asset set (removing the directory guesswork)? Same
  question the private stream raised; still an ADR candidate.

## Related docs

- `docs/satellites.md` §Formats — what `html` means to a publisher
- `llm/governance/adr/0005-two-output-build-with-leak-check.md`
- `llm/governance/adr/0010-withdrawal-semantics.md`
- `llm/governance/adr/0011-two-srcdirs-not-a-visibility-filter.md`
- `llm/sprints/2026-09-hub/STATE.md` §Wave 1

## ADR candidates

- `html`/`bundle` items declare their asset set, so staging needs no directory heuristic.
- `frame-content.mjs` as the shared frame model for both outputs.
