# Handoff — `infra`/CI, Wave 5 (Phase 6)

Status: Delivered
Date: 2026-10-03
Stream: `infra` (`.github/workflows/build.yml` only)
Branch: `feat/phase-6`
Contract: `llm/sprints/2026-09-hub/contracts/infra-wave-5.md`
Seams: `llm/sprints/2026-09-hub/contracts/phase-6-seams.md` (SEAM-P2, P5, P6); ADR-0020
Issue: `hub-006`

## Summary

Wired the site stream's two new scripts into CI and retired the full-site GitHub
Pages upload per ADR-0020. `npm run search:index` now runs in both build variants
after the Astro build and before the leak check and uploads; `npm run
redirects:stubs` now generates the stubs-only Pages artifact (and the canonical
`404.html` for Firebase) before the leak check. The `build` job uploads **only**
`site/dist-redirects` to Pages; `deploy` still runs `actions/deploy-pages` and
the `github-pages` environment, now serving stubs + `404.html`. The Pages
`smoke-test` was rewritten to assert retirement (root is a stub, a stub forwards)
instead of checking site routes; live-site route checks live in `firebase-smoke-test`
against the Firebase host, and the `check` job's deployed-fingerprint default was
moved off Pages to the Firebase host.

`redirects:check` was **deliberately left unwired** (task item 4 overrides
contract item 4): it still exits 1 on pre-existing map staleness. See the
follow-up section.

One file changed: `.github/workflows/build.yml` (`git diff --stat`:
`1 file changed, 80 insertions(+), 31 deletions(-)`). Nothing committed.
`site/**`, `firebase.json`, `infra/**`, and the other workflows were not touched.

## Before / after step lists (exact)

### `build` (Pages variant)

| # | Before | After |
|---|--------|-------|
| 1-10 | checkout, Node, install, audit, auth, sync bucket, fetch cv, record build info, test, **Build Astro** | unchanged |
| 11 | — | **Build the search index** (`npm run search:index`) |
| 12 | Check smoke-test routes exist | Check smoke-test routes exist |
| 13 | — | **Generate the redirect stubs artifact** (`npm run redirects:stubs`) |
| 14 | Check no private content reached the public build | Check no private content reached the public build |
| 15 | Check the publish allowlist | Check the publish allowlist |
| 16 | Upload Pages artifact → `site/dist-public` | **Upload the redirect stubs to Pages → `site/dist-redirects`** |

### `build-firebase`

| # | Before | After |
|---|--------|-------|
| 1-9 | checkout, Node, install, auth, sync bucket, fetch cv, record build info, test, **Build Astro** | unchanged |
| 10 | — | **Build the search index** (`npm run search:index`) |
| 11 | — | **Generate the canonical 404 page** (`npm run redirects:stubs`, writes `dist-public/404.html`) |
| 12 | Check smoke-test routes exist | Check smoke-test routes exist |
| 13 | Build Astro (private output) | Build Astro (private output) |
| 14 | Check private links | Check private links |
| 15 | Check no private content reached the public build | Check no private content reached the public build |
| 16 | Check the publish allowlist | Check the publish allowlist |
| 17 | Upload Firebase Hosting artifact (`dist-public`) | Upload Firebase Hosting artifact (`dist-public`, now incl. `pagefind/` + `404.html`) |
| 18 | Upload private output | Upload private output |

`redirects:stubs` was added to `build-firebase` even though the task named only
the Pages upload: the same generator is what writes `dist-public/404.html`
(SEAM-P5 / ADR-0020 decision 3), and without it the `firebase-hosting` artifact
would ship no 404 page. It also gives the `build-firebase` leak check its
`--stubs dist-redirects` coverage.

### `deploy`

Same action, same `github-pages` environment, same permissions. Step name changed
`Deploy to GitHub Pages` → `Deploy the redirect stubs to GitHub Pages`; it now
publishes the `dist-redirects` artifact `build` uploaded, so Pages serves stubs
and `404.html` only.

### `smoke-test`

| Before | After |
|--------|-------|
| Wait for Pages propagation | unchanged |
| Smoke test live routes on `https://djjay0131.github.io/website` | **Verify the retired Pages root serves a redirect stub, not the site** (asserts `<title>Redirecting</title>` + `url=https://jason.cusati.us/`) |
| Verify non-empty body on key routes (Pages) | **Verify a redirect stub forwards to the canonical host** (`/website/cv/academic/` → `https://jason.cusati.us/cv/academic/`) |

The old live-route/body checks are not lost: `firebase-smoke-test` already requests
the same `SMOKE_ROUTES` and body sizes against the Firebase host
(`vars.SITE_URL` or `https://<GCP_PROJECT_ID>.web.app`), which is now the host
that serves the site. That is the "repoint to the Firebase host where
appropriate": the live-site responsibility moves to `firebase-smoke-test`; the
Pages job verifies retirement.

### `check` — deployed-fingerprint default

```diff
- SITE_URL: ${{ vars.SITE_URL }}          # comment: else from GitHub Pages
+ SITE_URL: ${{ vars.SITE_URL }}
+ GCP_PROJECT_ID: ${{ vars.GCP_PROJECT_ID }}
...
- DEPLOYED_SITE="${SITE_URL:-https://djjay0131.github.io/website}"
+ DEPLOYED_SITE="${SITE_URL:-https://${GCP_PROJECT_ID}.web.app}"
```

This mirrors `firebase-smoke-test`'s host resolution exactly. `DEPLOYED_SITE` is
only evaluated on `schedule` events; pushes/PRs exit to `changed=true` before it.

## Dependency graph (dry reasoning)

No job was added or removed; `needs` edges are unchanged.

```
check → build → deploy → smoke-test
check → build-firebase → firebase-deploy → firebase-smoke-test
                       → private-sync
budget-guard            → notify-failure / notify-recovery
deploy-tools            (independent)
private-bucket-live-iam (independent)
leak-check-self-test    (independent; !schedule)
```

`notify-failure` and `notify-recovery` needs remain
`[check, budget-guard, build, deploy, smoke-test, build-firebase, firebase-deploy,
firebase-smoke-test, private-sync, private-bucket-live-iam]` — every name resolves
(verified below), so there are no dangling `needs`. `notify-recovery` still gates
on `needs.smoke-test.result == 'success'`, which now means "the stub deployment
succeeded", the correct post-retirement condition.

Artifact flow: `build` → `github-pages` (dist-redirects) → `deploy`;
`build-firebase` → `firebase-hosting` (dist-public incl. pagefind + 404) →
`firebase-deploy`, and → `hub-private` → `private-sync`.

## Verification

- **Actionlint 1.7.7** (downloaded to `/tmp/opencode/actionlint`, since it was not
  installed): `actionlint -color .github/workflows/build.yml` → **exit 0**. No
  shellcheck installed; actionlint ran its built-in rules.
- **YAML parse** (`python3 -c 'yaml.safe_load'`): OK. All 14 jobs present; all
  `needs` resolve; 28 `uses:` all SHA-pinned — 0 unpinned.
- **`bash -n`**: every `run` block without a `${{ }}` expression was extracted and
  checked — **60 checked, 0 failed** (2 blocks containing `${{ }}` skipped;
  GitHub substitutes those before the shell sees them).
- **Script names confirmed by execution**, from `site/`:
  ```
  $ npm run search:index
  Finished in 0.094 seconds          # dist-public/pagefind/ written
  $ npm run redirects:stubs
  redirects:stubs: wrote 57 stub(s) + 404.html to dist-redirects/
  redirects:stubs: also wrote 404.html into dist-public/ (Firebase serves it)
  ```
  And the exact strings the smoke probes match, against the generated artifact:
  ```
  $ grep -o 'url=https://jason.cusati.us/cv/academic/' dist-redirects/cv/academic/index.html
  url=https://jason.cusati.us/cv/academic/
  $ grep -o '<title>Redirecting</title>' dist-redirects/index.html
  <title>Redirecting</title>
  $ grep -o 'url=https://jason.cusati.us/' dist-redirects/index.html
  url=https://jason.cusati.us/
  ```
  (`dist-redirects/` and `dist-public/404.html` are build outputs; both are
  gitignored, so `git status` still shows only `build.yml` modified by this
  stream.)

## `redirects:check` — follow-up (NOT wired, deliberately)

`npm run redirects:check` is **not** a step in this workflow. The task (item 4)
overrides contract item 4's "becomes a required CI step": the script currently
exits 1 for pre-existing map staleness, documented in
`handoffs/site-wave-5.md` §"Hard problem":

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

The committed map was generated against a real CV build; the local tree is the
fixture, and the map predates the Wave 1 `kgis` source. This failure predates
this wave (`handoffs/site-astro-upgrade.md` §8) and `redirects:check` appears in
no workflow today.

**Follow-up for a content-holding owner (before it can be required):**

1. Regenerate `site/redirects/github-pages.json` from the real content so the
   inventory matches.
2. Make `route-inventory.mjs` exclude `_payload/` from its route set (it already
   excludes `_astro/`); `_payload/` is a hub-internal namespace the old Pages
   site never served.
3. Only then add `npm run redirects:check` as a step (in `build`, before the
   stubs upload) and consider promoting it to a required check — do not change
   branch protection from this stream.

This wave adds no new missing route: the two routes the site stream added
(`/rss.xml`, `/search/`) are covered by the committed map.

## Notes / residual

- `leak-check-self-test` is untouched. It still builds a Pages-shaped tree
  (`SITE_URL=https://djjay0131.github.io`, `SITE_BASE=/website/`), deploys
  nothing, and runs `demo:leak-check`; the demo generates its own stub directory
  and tolerates a missing Pagefind index, so it needs neither new script.
- The `build` job still builds and tests the Pages variant (`SITE_URL` /
  `SITE_BASE` unchanged) and still runs `check:smoke-routes`; only the upload
  target changed. `search:index` there exists to exercise the leak check's
  derived-output coverage, not to ship a Pages index.
- `check:no-private-in-public` already passes `--stubs dist-redirects`, so
  running `redirects:stubs` before it in both build jobs gives the title/summary
  stub scan real input (it would otherwise warn and skip).
- Nothing relies on `build-firebase` to write stubs Pages uses; the two hosts'
  artifacts are independent.
- `redirects:check` remains the one Phase 6 acceptance item intentionally left
  red/unwired; flagged, not fixed, per the task's explicit instruction.

## Related docs

- `.github/workflows/build.yml`
- `llm/sprints/2026-09-hub/contracts/infra-wave-5.md`
- `llm/sprints/2026-09-hub/contracts/phase-6-seams.md` (SEAM-P2, P5, P6)
- `llm/governance/adr/0020-pages-retirement-with-redirect-stubs.md`
- `llm/sprints/2026-09-hub/handoffs/site-wave-5.md` (`search:index`,
  `redirects:stubs`, the `redirects:check` staleness)
