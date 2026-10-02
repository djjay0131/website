# Handoff — Security Tester, Wave 0b (private by default)

Stream: Security Tester (owns the wave's gate; a single FAIL blocks)
Wave: 0b — private by default (D8); PR #86
Branch: `feat/private-by-default`
Date: 2026-10-02
Contract: `llm/sprints/2026-09-hub/contracts/security-tester-wave-0b.md`
Seams: `llm/sprints/2026-09-hub/contracts/private-by-default-seams.md` (SEAM-B1…B9)
ADR: `llm/governance/adr/0016-private-by-default-publish-allowlist.md`

## Summary

The Wave 0b security gate is **GREEN — zero FAIL**. All six scoped checks pass:
`cv/anthropic-fellow` leaves no trace in the public output (path, byte, sitemap,
build-info, page); the allowlist guard is correct in both modes and fails closed on
a malformed allowlist; no public consumer reads raw `visibility`; the historical
URLs are absent from the build and 302-configured in `firebase.json`; `firebase.json`
gains no function, no SSR and no rewrite, no secret, and the public site fetches
nothing off-origin; and the private build plus `check:private-links` pass.

Checks were run against the working tree, which carries three uncommitted
modifications inherited from the adversarial round (`docs/satellites.md`, ADR-0016,
and the `GITHUB_ACTIONS` warning annotation in `site/scripts/check-publish-allowlist.mjs`).
The committed `site/publish-allowlist.json` is byte-identical to `HEAD`
(sha256 `be524caf…c34ab`); nothing else tracked was modified by me.

One non-blocking observation, not a FAIL: `src/pages/projects/index.astro:22-26`
still carries a comment saying it reads the raw manifest `visibility` "because the
publish allowlist does not exist yet". The *code* on the same page already calls
`collectPublicItems()` (effective visibility). The comment is stale documentation;
the behaviour is correct.

## Gate table

| # | Check | Verdict | Evidence |
|---|---|---|---|
| 1 | No private content on the public path; guard provably live (red→green) | **PASS** | `npm run content:fixture` + `npm run build:public` (26 pages). `find dist-public -iname '*anthropic*'` → none; `grep -rIl anthropic-fellow dist-public` → none (exit 1); `grep -c anthropic dist-public/sitemap-0.xml` → 0; no `dist-public/build-info.json` (local build emits none) and CI generates it only from SHA-256 fingerprints (`build.yml:195-206`, `sync-content.sh:157`); no `/cv/anthropic-fellow/index.html`; `/cv/` and `/resumes/` link exactly `academic`, `research-professional`, `sde-long`. `npm run check:no-private-in-public` → PASS (4 private items, 161 files). Direct plant → check exit 1; remove → exit 0. `npm run demo:leak-check` → PASS (caught injected leak), exit 0. |
| 2 | Allowlist guard: condition A, condition B (both modes), malformed | **PASS** | Committed allowlist: `--mode pr` and `--mode deploy` → `PASS (14 entries, 0 conflicts, 0 stale)`. Condition A (entry names a manifest-`private` item) → `CONFLICT`, exit 1 in **both** modes. Condition B (stale `cv/no-such-item-renamed`, source present) → `pr` exit 1 (hard failure), `deploy` exit 0 with loud warning; under `GITHUB_ACTIONS=true` the deploy warning is an unsuppressible `::warning title=Stale publish allowlist entry::`. Malformed: bad JSON, `version: 2`, and invalid slug each exit 1 in `pr` (version also exit 1 in `deploy`); replacing the committed allowlist with `version: 2` makes `npm run build:public` **fail** (`PublishAllowlistError` from `content.config.ts:342`) rather than default. Targeted tests: 18/18 pass. |
| 3 | Effective visibility is the only authority | **PASS** | `grep -rIn visibility src/pages src/components src/layouts src-private/pages src-private/layouts src-private/lib` returns only comments plus `data.effective_visibility === "public"` at `src/pages/[section]/[source]/[slug].astro:26`. No consumer reads raw `item.visibility`/`data.visibility` for a public decision. `/projects/` (`projects/index.astro:36` → `collectPublicItems`) and the CV indexes (`cv/index.astro:15`, `resumes/index.astro:12`) all consume effective visibility via `frame-content.mjs:264` → `effectiveVisibility()`. The loader tags `effective_visibility` and public-store omits non-public (`content.config.ts:395,424-436`). See observation above re the stale comment. |
| 4 | Historical URLs not emitted; `firebase.json` 302s them | **PASS** | `dist-public/cv/anthropic-fellow`, `dist-public/cv/anthropic-fellow/index.html`, `dist-public/pdfs/anthropic-fellow.pdf` all absent; no anthropic path or sitemap entry. Config assertion (live probe is out of scope, Lead Architect post-merge): the three redirect rules `/pdfs/anthropic-fellow.pdf`, `/cv/anthropic-fellow`, `/cv/anthropic-fellow/**` each present with `destination: /signin/`, `type: 302`; no anthropic redirect with a wrong target/type. Branch diff adds only this `redirects` array. |
| 5 | Supply chain / config unchanged | **PASS** | `git diff main...HEAD -- firebase.json` adds only the `redirects` array; `functions` key absent; `rewrites` unchanged at 4 (`hub-gate` only, no SSR); `astro.config.mjs:47` `output: 'static'`; no secret-like string in `firebase.json`; branch-diff additions contain no new external origin or credential (matches are docs and the literal test slug `"secret"`). Scan of all 161 `dist-public` HTML files for off-origin sub-resource loads (`script/link/img/iframe/source/video/audio/font`) → **0**; the site self-hosts. |
| 6 | Private build still serves members | **PASS** | `npm run build:private` (`HUB_OUTPUT=private SITE_BASE=/p/`) → 9 pages, 98 files; receipt `.hub-private-build.json`: `privateItemCount: 4`, `renderedItemCount: 8`, items include `cv/anthropic-fellow` and the three `phd-milestones` items; receipt written last. `npm run check:private-links` → PASS (13 pages, no off-origin sub-resource, none escaping `/p/`, each link resolves). Full suite: `npm test` → 291 passed, 1 skipped. |

## Red → green transcript

The guard was proved live two ways. First the repo's own deliberate failing run
(injects into a throwaway copy; the real `dist-public` is never modified):

```
$ npm run demo:leak-check
demo:leak-check: injected two deliberate leaks into a COPY of the public build
  item:      cv/anthropic-fellow
  contents:  index.html  +=  <a href="/cv/cv/anthropic-fellow/">Fellowship CV (fixture)</a>
  path:      cv/cv/anthropic-fellow/index.html  (created)
check:no-private-in-public: 5 LEAK(S) of private content into …/dist-public:
  cv/cv/anthropic-fellow/index.html  path: slug of cv/anthropic-fellow — "anthropic-fellow"
  index.html  contents: qualified-id of cv/anthropic-fellow — "cv/anthropic-fellow"
  index.html  contents: slug of cv/anthropic-fellow — "anthropic-fellow"
  index.html  contents: route of cv/anthropic-fellow — "/cv/cv/anthropic-fellow/"
  index.html  contents: title of cv/anthropic-fellow — "Fellowship CV (fixture)"
demo:leak-check: the check exited 1 (1 means it caught the leak).
demo:leak-check: PASS — the guard failed on the injected leak … Real dist-public never modified.
```

Second, a direct plant into the real `dist-public`, then restore:

```
$ find dist-public/cv/anthropic-fellow
dist-public/cv/anthropic-fellow/index.html          # planted: title + slug + /pdfs link
$ npm run check:no-private-in-public ; echo CHECK_EXIT=$?
check:no-private-in-public: 3 LEAK(S) of private content into dist-public:
  cv/anthropic-fellow/index.html  path: slug of cv/anthropic-fellow — "anthropic-fellow"
  cv/anthropic-fellow/index.html  contents: slug of cv/anthropic-fellow — "anthropic-fellow"
  cv/anthropic-fellow/index.html  contents: title of cv/anthropic-fellow — "Fellowship CV (fixture)"
CHECK_EXIT=1

$ rm -rf dist-public/cv/anthropic-fellow
$ npm run check:no-private-in-public ; echo CHECK_EXIT=$?
check:no-private-in-public: PASS — no private slug, source, route, payload path, title or summary
appears in any path or any file's contents under dist-public (161 files scanned).
CHECK_EXIT=0
```

## Out-of-scope §6 lines, stated explicitly

The run brief §6 gate is broader than Wave 0b can turn red. Wave 0b touches only
`site/**` (plus `firebase.json`) and changes no identity, IAM, gate, Firestore or
budget surface. The following §6 lines are therefore **out of scope for this wave**,
not omitted:

- **Private bucket IAM** — "exactly two principals, UBLA + PAP, anonymous GET
  refused" — infra/`gate`, unchanged here (owned by the Boundary Tester).
- **Gate behaviour** — signed-out/non-member refusal on both transports with
  identical status, `private, no-store` under `/p/`, `/s/`, `/share`, `__session`
  cookie flags, traversal suite — `gate` stream, untouched by Wave 0b.
- **Shares** — entropy, expiry, revocation, slug escape, non-owner 403, origin
  check — Wave 3 (`hub-004`), not built yet.
- **Identity/WIF** — no keys anywhere, numeric-id + ref pinning, separate satellite
  pool, no `list` on any satellite role, gate SA scopes, public deploy identity
  holds no private-bucket permission — infra, unchanged.
- **Firestore** — deny-all rules stay released; `members/` and `shares/` unreadable
  from the Web SDK — infra, unchanged.
- **Supply chain, beyond static config** — every action SHA-pinned across satellite
  repos, `npm audit --omit=dev` and `pip-audit` clean of high/critical in CI — other
  waves/#56/#59; check 5 covers only the `firebase.json`/static-site portion.
- **Budget guard green** — infra, unchanged.
- **Logging** — `event=` classes reach Cloud Logging, no secret in any log line —
  `gate`/infra, unchanged by Wave 0b.
- **Repos confirmed private by API** — infra, unchanged.

Also out of scope and explicitly deferred: the **live host probe**. Check 4 asserts
the config only; the live 302 behaviour on `jason.cusati.us` (and the historical
GitHub Pages URL becoming 404, never 200) is the Lead Architect's post-merge step
per SEAM-B9 and the contract.

## Restore evidence

- Pre-state and post-state are identical. `git status --short` before and after:

```
 M docs/satellites.md
 M llm/governance/adr/0016-private-by-default-publish-allowlist.md
 M site/scripts/check-publish-allowlist.mjs
?? llm/sprints/2026-09-hub/handoffs/dissenter-wave-0b.md
?? llm/sprints/2026-09-hub/handoffs/red-team-wave-0b.md
?? llm/sprints/2026-09-hub/handoffs/skeptic-verifier-wave-0b.md
```

The three `M` files and the three untracked handoffs are the adversarial round's,
present **before** this run; the security-tester handoff (this file) is the only
addition.

- Temporary plant in `dist-public`: removed (`test -e dist-public/cv/anthropic-fellow`
  → absent); restored check is green.
- Temporary malformed `site/publish-allowlist.json` (build-failure proof): restored
  from backup; sha256 `be524caf378fe8d3a42e6717552e6bdc68e8f41ea304be17c24931794b2c34ab`,
  identical to the pre-run value, and `git diff --stat site/publish-allowlist.json`
  is empty.
- `git diff --stat firebase.json` is empty (no edit by me).
- Build outputs (`dist-public`, `dist-private`, `site/src/content/sources`,
  `site/public/pdfs/`) are gitignored; they were rebuilt, not committed.

## Related docs

- Contract: `llm/sprints/2026-09-hub/contracts/security-tester-wave-0b.md`
- Seams: `llm/sprints/2026-09-hub/contracts/private-by-default-seams.md`
- ADR-0016: `llm/governance/adr/0016-private-by-default-publish-allowlist.md`
- Brief §6–§7: `llm/plans/2026-10-01-completion-brief.md`
- Implementation handoff: `llm/sprints/2026-09-hub/handoffs/site-wave-0b.md`
- Adversarial inputs: `handoffs/{red-team,dissenter,skeptic-verifier}-wave-0b.md`
- Fix that closed the CI build-info leak: commit `e360ce4`
- PR: https://github.com/djjay0131/website/pull/86
