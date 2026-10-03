# Handoff — `site`, Wave 3 (Phase 4 sharing)

Status: Delivered
Date: 2026-10-03
Stream: `site` (`site/**`, `firebase.json`)
Issue: `hub-004`
Branch: `feat/sharing`
Contract: `llm/sprints/2026-09-hub/contracts/site-wave-3.md`
Seams: `llm/sprints/2026-09-hub/contracts/phase-4-seams.md` (SEAM-S4, SEAM-S6)

## Summary

The two sharing rewrites are wired to `hub-gate` and the owner-only Shares
island exists in the **private** build only. `GET /share` is the owner check:
403 hides every mint/revoke control; 200 lists active shares. The React
integration is mounted inside the `isPrivate` branch of `astro.config.mjs`, and
the public build ships no framework runtime — proved by build, not assertion.

The island keeps the minted token out of React state and the DOM: `POST /share`
returns the full token, the lib writes it to `sessionStorage` under the row's
short id and hands the component only the copyable URL. A listed row is revocable
while that retained token exists; otherwise the owner pastes the saved link and
the token is extracted and sent to `DELETE /share/{token}`. A token is never
logged and is sent nowhere else.

All required checks are green: `npm ci`, `npm test` (326 passed / 1 skipped),
both builds, the four `check:*` guards, and governance `--layout`.

## What changed

- **`firebase.json`** — appended two prefix rewrites, `/share/**` and `/s/**`,
  each `{serviceId: "hub-gate", region: "us-east1"}`, after the existing four.
  The four existing rewrites, the three anthropic redirects, the headers and
  `trailingSlash: true` are untouched (diff is additions only).
- **`site/package.json` / `site/package-lock.json`** — added
  `@astrojs/react@^7.0.0`, `react@^19.3.0`, `react-dom@^19.3.0` to
  `dependencies`, and `@types/react` / `@types/react-dom` to a new
  `devDependencies` (type declarations for the `.tsx` island; Astro's own
  `astro add react` does the same). Lockfile updated by `npm install`.
- **`site/astro.config.mjs`** — `import react from '@astrojs/react'`; the
  integration is `[react(), privateBuild()]` in the `isPrivate` branch and
  absent from the public branch. The import alone is inert.
- **`site/src-private/lib/shares.mjs`** (new) — all pure logic: endpoints,
  exact request inits, day validation, `status→UI` branch (`sharesView`),
  `idFromToken`/storage helpers, `tokenFromShareUrl`, and `listShares` /
  `mintShare` / `revokeShare` / `revokeSavedShare` / `revokeFromText` with
  injectable `fetch` and `sessionStorage`.
- **`site/src-private/components/SharesIsland.tsx`** (new) — thin React island;
  renders list, mint form and paste-revoke form from `sharesView`.
- **`site/src-private/pages/shares.astro`** (new) — static page at `/p/shares/`,
  reuses the members' nav and hydrates the island with `client:load`.
- **`site/src-private/layouts/PrivateBase.astro`** — appends a `Shares` entry
  (`${base}shares/`) to `bandNav`, so it appears on every `/p/**` page. No page
  or shared component was touched; `Base.astro` is untouched.
- **`site/scripts/private-structure.test.ts`** — new `describe` asserting
  `firebase.json` carries `/share/**` and `/s/**` to `hub-gate` (us-east1),
  keeps the existing six rewrites in order, and still publishes
  `site/dist-public` with `trailingSlash: true`.
- **`site/src-private/lib/shares.test.ts`** (new) — unit tests with `fetch` /
  `sessionStorage` doubles (see below).

**Deliberately not changed:** `gate/**`, `infra/**`, `.github/**`, `Base.astro`,
any shared `src/components/*`, and every existing rewrite. No credential was
created and no schema was touched.

## The island design (especially the revoke path)

Request shapes (`site/src-private/lib/shares.mjs`):

- list — `GET /share`, `{method:"GET", credentials:"same-origin"}`
- mint — `POST /share`, `{method:"POST", credentials:"same-origin",
  headers:{"Content-Type":"application/json"}, body: JSON of
  {section, source, slug, expires_in_days}}`
- revoke — `DELETE /share/{token}`, `{method:"DELETE", credentials:"same-origin"}`

All are bare same-origin paths (never a `*.run.app` URL, no `mode`); every call
carries `credentials:"same-origin"`.

Status branch: `listShares` returns `{ok:true, forbidden:true}` on 403.
`sharesView` maps that to `{kind:"forbidden", canMint:false, canRevoke:false}`,
so the component draws only the note "Only the owner manages shares." A 200 maps
to `{kind:"ready", canMint:true, canRevoke:true}`.

Revoke, the two paths:

1. **Retained token (same browser session).** `POST /share` returns
   `{token, expires_at, url}`. The lib derives the row id as `token[:12]`
   (matching the gate's `SHARE_ID_CHARS = 12`), stores the full token in
   `sessionStorage` under `hub:share-token:<id>`, and returns to the component
   only `{id, url, expiresAt}` — the token never enters React state or the DOM.
   For each listed row `canRevokeRow(row)` checks that store; if present, a
   `Revoke` button calls `revokeSavedShare(id)` → reads the token →
   `DELETE /share/{token}`, then forgets the retained copy.
2. **Paste a saved link.** `GET /share` never returns a full token (gate ruling
   2), so a share minted in another browser/session cannot be matched to a
   retained token. The row shows "paste link to revoke" and the paste form calls
   `revokeFromText`, which extracts the token from a `/s/<token>/…` URL, path or
   bare token and issues the same `DELETE`.

`sessionStorage` access is wrapped in try/catch, so a mint still succeeds in
private mode where storage throws; such a row simply falls to the paste path.

## Evidence (exact commands / counts)

All from `site/`, on `feat/sharing`:

```
$ npm ci
added 399 packages, and audited 400 packages in 16s   # 0 errors

$ npm test
Test Files  25 passed (25)
     Tests  326 passed | 1 skipped (327)

$ npm run build:public
[build] 26 page(s) built in 1.44s
[build] Complete!
# no dist-public/p, no dist-public/shares; grep for react runtime markers
# (react.element / react-dom / jsx-runtime) in dist-public => none

$ npm run build:private
/shares/index.html (+35ms)                  # file dist-private/shares/index.html == served /p/shares/
[hub-private-build] staged 5 payload file(s) for 4 private item(s)
[hub-private-build] checked 93 emitted path(s) against the gate's allowlist (SD-7)
[build] 6 page(s) built in 1.19s
# dist-private/_astro/ contains react.DJY1zw8Z.js and SharesIsland.BMhcWC-r.js
# every sampled private page carries href="/p/shares/" exactly once

$ npm run check:no-private-in-public
PASS — 4 private item(s) looked for, 162 files scanned, no leak

$ npm run check:publish-allowlist
PASS (mode pr) — 14 entries, 0 conflicts, 0 stale

$ npm run check:private-links
PASS — every link in 9 page(s) resolves under /p/; 130 outbound anchor(s) allowed

$ npm run check:smoke-routes
all 7 smoke routes present in dist-public

$ node ~/code/agentic-governance/plugin/scripts/governance-checks.mjs --layout
4 of 4 checks passed, 0 failed.   # governance-links, adr-index, adr-status, layout
```

`npm run check:npm-audit` is not in the contract's list but was run: the CI form
`node scripts/check-npm-audit.mjs --report` exits 0 (workflow `build.yml:1014`).
The non-`--report` local form now exits 1 on one NEW advisory,
`GHSA-ch52-4w7c-c8xp` / `http-cache-semantics`. That package is **byte-identical
at HEAD and after this change** (locked `4.2.0`, transitive via `astro@7.3.3`),
so it is not caused by this work; the advisory DB changed under a pre-existing
dependency.

## Assumptions

- The gate's amended `(section, source, slug)` shape is on the branch: the
  concurrent `gate-wave-3-section` working-tree change adds `section` to the
  `POST /share` body, the `GET /share` rows and `_share_item_prefix`. The island
  sends `section` and reads it, matching SEAM-S1's 2026-10-02 amendment.
- The private build serves at `/p/`, so `dist-private/shares/index.html` is
  `/p/shares/` on the gate.
- The row's short id is `token[:12]` (`SHARE_ID_CHARS = 12`), the only value
  `GET /share` exposes; the island re-derives it from the mint token.
- `@types/react`/`@types/react-dom` in `devDependencies` is the correct Astro
  setup and does not affect the `--omit=dev` audit set for the production deps.

## Risks

- **Duplicated id-derivation rule.** The island hard-codes `SHARE_ID_CHARS = 12`
  to key sessionStorage. If the gate changes that constant, retained tokens stop
  matching rows and every row silently falls back to paste-to-revoke. A return of
  `id` from `POST /share` would remove the coupling (open question).
- **Relative mint URL.** `POST /share` returns a relative `/s/<token>/` when
  `GATE_SHARE_BASE_URL` is unset; the island copies exactly what the gate
  returns. On the real deploy the owner must either configure that base or copy
  from an absolute context.
- **sessionStorage is session-scoped.** A minted token is revocable from the
  same tab until the session ends; anything older is revoke-by-paste by design.
- **Local audit delta** (above) is pre-existing and CI-report-only, but a reader
  running `check:npm-audit` locally will see it red.

## Open questions

- Should `POST /share` return the short `id` (and/or an absolute `url`) so the
  island need not mirror `SHARE_ID_CHARS`? Recorded as a seam nit for the gate.
- Should the island resolve the returned relative URL against `location.origin`
  before display, so the copied link is always absolute?
- SEAM-S7 (owner live mint/open/revoke against the deployed gate) is the owner's
  step and is not performed here.

## Related docs

- `llm/sprints/2026-09-hub/contracts/site-wave-3.md`
- `llm/sprints/2026-09-hub/contracts/phase-4-seams.md` (SEAM-S1, S2, S4, S6)
- `llm/sprints/2026-09-hub/handoffs/gate-wave-3-section.md` (the `section` shape)
- `llm/specs/2026-09-10-research-hub-design.md` §6 responsibility 4, §11 Phase 4
- `site/src-private/lib/signout.mjs` / `signout.test.ts` (the gate-call template)
- `site/scripts/private-structure.test.ts` (the structural guarantee)
