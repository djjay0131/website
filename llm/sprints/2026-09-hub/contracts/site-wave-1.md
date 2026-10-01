# Bounded contract — `site`, Wave 1

Status: Active
Issued: 2026-10-01
Issued by: Lead Architect
Issue: #72 (hub-009, satellite 3 — `agentic-kgis` publishes as `kgis`)
Wave: 1 — finish the half-built site stream

---

```text
ROLE
  Site implementation specialist. The Wave 1 site stream died on a provider billing
  error and left partial work uncommitted on feat/satellite-kgis (now the WIP commit
  9e7408a). You finish it. You did not author the WIP; review it before trusting it.

OBJECTIVE
  1. Register `kgis` in EXPECTED_SOURCES as declared-but-NOT-required.
  2. Make the /projects/ index list items from the synced manifests, not only the CV's
     own projects.
  3. Add the public `html` FRAME for a non-`cv` source: a route that iframes an item's
     staged payload, and the public-build staging that puts the payload there.
  4. Keep or discard the WIP edits on the evidence, and say which in the handoff.

REQUIRED READING
  site/scripts/private-build.mjs            the private twin to copy the shape of
  site/src-private/pages/[...itemPath].astro the private frame
  site/src-private/lib/private-content.mjs  the staging plan and route/payload helpers
  site/src/lib/hub-content.mjs              EXPECTED_SOURCES, publicAssetPathFor
  site/src/pages/projects/index.astro       the index that must list manifest items
  site/astro.config.mjs                     the WIP added publicBuild() there
  llm/sprints/2026-09-hub/STATE.md          §Current position; §Wave 1 boundary proofs;
                                            §Repository hygiene, 2026-10
  docs/satellites.md §Formats               what `html` means to a publisher
  ~/code/agentic-kgis/docs-site/manifest.json  the real satellite-3 manifest

THE WIP COMMIT (9e7408a) — REVIEW, DO NOT TRUST
  * site/astro.config.mjs imports publicBuild from ./scripts/public-build.mjs, which DID
    NOT EXIST. Correct intent; the module must be written, not deleted (item 3).
  * site/src/content.config.test.ts expects `kgis` in EXPECTED_SOURCES. Correct; the
    production change was missing (item 1).
  * site/scripts/check-no-private-in-public.test.ts expected a private item under
    `construction-ai-proposal`. That satellite is Wave 4 and does not exist. The intent
    -- a private `projects` item the public index must omit -- is right; the source is
    wrong. Plant it under the existing private source instead, in the same style.

FILE CONTRACT
  You may modify, and nothing else:
      site/**
      .github/workflows/build.yml   (ITEM 4 only: the report-only audit step)
  Do not modify: infra/**, gate/**, contract/**, any other workflow, docs/**,
  firebase.json, or any other repository.

  AMENDED 2026-10-01, before merge, on the Wave 1 Dissenter's D8. The first draft
  forbade `.github/workflows/**` while ITEM 4 required the audit step in
  build.yml; the wave made that edit without reconciling the two. The allow is
  now explicit and scope-limited to the one workflow file ITEM 4 needs.

ITEM 1 — `kgis` IS EXPECTED BUT NOT REQUIRED
  Add to EXPECTED_SOURCES: source "kgis", required: false, since "Wave 1 (satellite 3)",
  with the same bootstrap reasoning phd-milestones began in. Fold a source into the
  required set only after a VERIFIED first publish. A required source that has never
  published fails every build whose tree lacks it, and the pull-request fallback tree
  always does (ADR-0010 decision 4's amendment).

ITEM 2 — THE /projects/ INDEX LISTS MANIFEST ITEMS
  Today /projects/ renders only the CV data pool's projects. It must also list every
  PUBLIC item whose manifest says `section: projects`, from the manifest alone, with no
  hand-maintained entry (roadmap Phase 5 acceptance). `cv` is excluded: its items are the
  CV variants, rendered by /cv/ and /resumes/ (ADR-0008).

  A private item in the `projects` section must NOT appear. Plant one in the committed
  fixture so the leak check and the index both prove it.

ITEM 3 — THE `html` FRAME FOR A NON-`cv` SOURCE
  A `format: html` item is served at /<section>/<source>/<slug>/ in a thin frame, its
  payload bytes staged verbatim under /_payload/<source>/... (docs/satellites.md). The
  private build already does this; the public build does not.

  * Write scripts/public-build.mjs (the WIP's missing import) to stage the payload of
    every public html/bundle item.
  * Add the public frame page. Its route shape must match the private one so the two
    have one definition, not two.
  * The staging plan and route/payload helpers are shared, public-safe facts. Put them
    where the public build may import them, and keep the one-way import arrow the
    structural test pins (scripts/private-structure.test.ts): nothing under src/**
    imports src-private/**, private-content, private-build or PrivateBase.

  THE PREFIX-ROOT CASE, which is the one that matters: the real satellite's item has
  `path: index.html` at the ROUTE ROOT of its prefix. `index.html` is a built site whose
  every sibling (assets/, other pages) must travel, or it renders unstyled with no error.
  Staging the named file alone is wrong THERE; the existing named-dir filter for
  withdrawn documents is wrong there too. Handle it deliberately and document which rule
  applies where.

ITEM 4 — HARDENING (#56, #59)
  `npm audit` is wired into NO workflow, so #56 recurs silently. Add a REPORT-ONLY audit
  step to build.yml plus a small checker and a recorded baseline
  (site/audit-baseline.json). It must NOT be able to fail the build yet: an audit goes red
  because the world changed, not because a PR did, and a blocking version gets suppressed
  (#59). The accepted findings need a reachability argument written as a checkable
  condition, not a version number alone.

TESTING — the standard
  Every NEW guard shown FAILING before passing: break, red, restore, green. Before breaking
  a string, assert it is UNIQUE (the anchor rule; this sprint patched the wrong occurrence
  three times). Do not weaken or delete a test to make a change pass (ADR-0011).

CONSTRAINTS
  - NO git, gh, gcloud, terraform or firebase mutations.
  - npm test green; `npm run build:private` and `npm run build:public` green under
    `npm run content:fixture`; `npm run check:no-private-in-public` green.
  - Do not quote private content. Use committed fixtures.
  - Every tracked *.sh with a shebang stays 100755 (verify with git ls-files -s).

DEFINITION OF DONE
  kgis declared-not-required; /projects/ lists manifest items and omits the private one;
  the public frame and its staging exist and are exercised by the committed fixture; the
  audit is wired non-blockingly with a baseline; the WIP is dispositioned. Full suite and
  both builds green.

FINAL REPORT -> llm/sprints/2026-09-hub/handoffs/site-wave-1.md
  ## Summary ## Assumptions ## Recommendations ## Alternatives considered ## Risks
  ## Open questions ## Related docs ## ADR candidates
  plus Validation with verbatim transcripts, the WIP keep/discard decision, and the
  break/restore pairs.
```

## Cross-references

- `llm/governance/adr/0005-two-output-build-with-leak-check.md`
- `llm/governance/adr/0010-withdrawal-semantics.md`
- `llm/governance/adr/0011-two-srcdirs-not-a-visibility-filter.md`
- `llm/sprints/2026-09-hub/STATE.md` — §Wave 1 (#72) boundary proofs; §Repository hygiene
