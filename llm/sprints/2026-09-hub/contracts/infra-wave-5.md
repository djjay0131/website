# Contract — `infra`/CI, Wave 5 (Phase 6)

Status: Issued · Date: 2026-10-03 · Branch: `feat/phase-6`
Stream: `infra` (`.github/workflows/build.yml`, `ci.yml` if needed) · Issue: `hub-006`
Seams: `contracts/phase-6-seams.md` (SEAM-P2, P5, P6); ADR-0020

## Requirements

1. **Pagefind runs in both build variants (SEAM-P2).** After `npm run build` and
   before the leak check and artifact uploads, run `npm run search:index` (or the
   site stream's script) in both the `build` (Pages variant) and `build-firebase`
   jobs. The index lands in `site/dist-public/pagefind/` and travels with the
   firebase-hosting artifact.
2. **Retire the full-site Pages upload (SEAM-P5, ADR-0020).** Stop uploading
   `site/dist-public` as the Pages artifact. Instead, after generating
   `site/dist-redirects/` (the site stream's generator), upload **only**
   `site/dist-redirects` to Pages. The `deploy` job keeps
   `actions/deploy-pages` and the `github-pages` environment; it now serves stubs
   and `404.html` only. `upload-pages-artifact` must point at the stubs dir.
3. **Smoke tests and defaults.** Repoint the `deploy`-dependent `smoke-test` and
   the `check` job's `DEPLOYED_SITE` default away from the full Pages site. Add a
   smoke probe that a redirect stub forwards and that
   `djjay0131.github.io/website/` no longer serves a site page (it serves the
   stub/404).
4. **Wire `redirects:check` and the stub generation into CI (SEAM-P6).**
   `npm run redirects:check` becomes a step that fails the build on drift, and
   the stub generator runs before the Pages upload. Consider promoting
   `redirects:check` (and the new derived-output leak self-test) to required
   checks only after a green run on `main` — record, do not change branch
   protection yourself.
5. **Notify jobs.** Remove `deploy`/`smoke-test` from the `notify-*` `needs`
   lists only if they are removed; since they remain (stubs), keep them but
   verify the dependency graph has no dangling `needs`.
6. Every action SHA-pinned; no new unpinned action. `actionlint` clean.

Do not touch `site/**` source (the site stream owns it) except to call its
scripts. Record the exact before/after step list.
