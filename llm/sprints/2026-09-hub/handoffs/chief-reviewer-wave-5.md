# Handoff — Chief Reviewer, Wave 5 (Phase 6: search, feed, stubs, Pages retirement)

Stream: Chief Reviewer (authored nothing in this wave; this handoff is its only write)
Wave: 5 — Phase 6 (`hub-006`)
Hub PR: `djjay0131/website#99`, branch `feat/phase-6`, HEAD `72dea41` (base `main` `b6abd7f`)
Date: 2026-10-03
Contract: `llm/sprints/2026-09-hub/contracts/phase-6-review-contracts.md` §Chief Reviewer
Seams: `llm/sprints/2026-09-hub/contracts/phase-6-seams.md` (SEAM-P1…P7)
Design authority: design doc §11 Phase 6; ADR-0005 (derived outputs public-only); ADR-0020
Brief: `llm/plans/2026-10-01-completion-brief.md` §6 (security gate), §7 (merge conditions), §8 (recording)

**VERDICT: Request changes — one record must-fix (PR body not on the template / no
Governance-Level declaration / no Data-Security-Privacy section, a §7 merge condition);
the code, seams, design content and the recorded deferrals are otherwise sound and
honest. Governance level: L2** (confirmed; mixed L1 ADR amendment + L2 CI/site/security,
classified at the highest; no L3).

Read-only. Working tree clean; I wrote no tracked file but this one, ran no git/cloud
mutation, and ran only `gh pr view/checks`, `git diff/show`, `npm test`, the governance
`--layout` check, and the build/leak pipeline. The deferrals the branch records are
**honest**: `redirects:check` is DEFERRED via the ADR-0020 amendment, every
`phase-6-polish` checkbox and both Checkpoint 7 boxes stay `[ ]`, and STATE says so.

---

## What I verified rather than accepted

- **Scope is clean.** `git diff --stat main...HEAD` touches only `.github/workflows/build.yml`,
  `llm/**` (ADR, contracts, handoffs, STATE) and `site/**`. **No `firebase.json`, no
  `infra/**`** (Security Tester Check 5 byte-equality holds). The site contract's "do not
  touch `.github/`/`firebase.json`" and the infra contract's "do not touch `site/**`"
  are both honored: infra changed only `build.yml`; site changed no workflow.
- **ADR-0005 public-only derived outputs hold.** RSS (`site/src/pages/rss.xml.ts:17-28`)
  is built from `collectPublicItems` (effective visibility = manifest request AND the
  committed allowlist), so it is public-only by construction; Pagefind runs over
  `dist-public` in both build jobs (`build.yml:1096,1231`); `search.astro` and
  `rss.xml.ts` live under `src/pages/`, and the private build uses `src-private`, so
  neither can be emitted privately. **I reproduced the private build:** `pagefind`,
  `rss.xml`, `404.html`, `search` all absent from `dist-private`.
- **ADR-0020 shape holds in `build.yml`.** `upload-pages-artifact` points at
  `site/dist-redirects` (`build.yml:1137-1139`); `deploy` keeps `actions/deploy-pages`
  and the `github-pages` environment (`:1320`); the `build-firebase` job still uploads
  `dist-public` (now incl. `pagefind/` + `404.html`) to Firebase (`:1286,1404`).
- **The leak check covers the named derived outputs.** `npm run check:no-private-in-public`
  → **PASS, exit 0** (209 `dist-public` + 42 `dist-redirects` files); the run reports
  `og-card (2), search-text (10), rss (1), sitemap (2)`. `npm run demo:leak-check` →
  inner check exit 1 and **all 10** planted outputs named. Decompressed `.pf_*` payloads
  are now contents-scanned.
- **The stubs artifact is stubs + `404.html` only.** I reproduced `redirects:stubs`:
  **42 files, all `html`; 41 meta-refresh stubs + `404.html`**; no
  `dist-redirects/pdfs/academic.pdf`, no `build-info.json` (file-shaped routes go
  through the `404.html` map per Dissenter D2).
- **The final commit's fix is real and tested.** `render404` now normalises every `to`
  to a rooted canonical path (`generate-redirect-stubs.mjs:183-195`); I injected
  `to: "@evil.example"`, `//evil.example/y`, `javascript:alert(1)` and got
  `/@evil.example`, `/evil.example/y`, `/javascript:alert(1)` — no unrooted authority.
  `npm test` → **30 files, 404 passed | 1 skipped (405)**. Governance `--layout` →
  **4 of 4 pass**. `gh pr checks 99` → every non-deploy job PASS; `mergeStateStatus: CLEAN`.
- **The roadmap is not falsely ticked.** `llm/master-roadmap.md` is **unchanged** by the
  PR; §`phase-6-polish` scope/acceptance (`:425-441`) and both closing-checkpoint boxes
  (`:462-463`) remain `[ ]`. STATE `### Roadmap criteria — honest state` (`:3467-3472`)
  says `redirects:check` is "Not ticked … (deferred)" and "**Checkpoint 7 is not recorded
  passed.**"
- **The `redirects:check` deferral is a recorded decision, not a handoff aside.**
  ADR-0020 decision 4 carries the dated amendment "**DEFERRED, not met**" with the reason
  and the close-out plan (`0020-pages-retirement-with-redirect-stubs.md:41-50`).

## Must-fix

1. **The PR body is not on the repository template, so a §7 merge condition is unmet.**
   `pull_request_template.md` requires the Governance Level block first and the
   **Data, Security and Privacy Impact** section answered. PR #99's body is 8 lines and
   contains **none** of `Governance Level`, `Data, Security`, `Memory Bank` or
   `Related ADRs` (verified: 0 matching markers), and no level is declared in the body
   (only the `gov-L2` label). Replace the body with the template, Governance Level first,
   and answer the §Domain Review Questions. This is a record defect only — the underlying
   content is fine — but §7 names it explicitly.

## Should-fix

2. **Two Active seams now contradict the shipped behaviour.**
   `phase-6-seams.md` SEAM-P5 (`:49-54`) says the generator emits "one meta-refresh stub
   per entry"; the hardening (Dissenter D2) emits per-path stubs only for HTML-navigable
   entries and routes file-shaped URLs through `404.html`. SEAM-P6 (`:63`) says
   "`redirects:check` is wired into CI"; it is deliberately unwired (D1), and ADR-0020
   decision 4 was amended to say so. STATE records both deviations, but the seams were not
   amended and remain the wave's stated design authority. Amend SEAM-P5/P6, or add dated
   correction notes, so the control plane does not contradict itself.
3. **The independent verdicts predate the final HEADs (the Wave 4 #3 class).** The Skeptic
   Verifier and Dissenter reviewed `1cecb35`; the Security Tester and Red Team round 2
   reviewed `dac8a76`; the R2-b fix and the extra test landed in `72dea41`. No reviewer
   independently re-ran against `72dea41`, and the Skeptic's one reported **un-failable
   guard** (stub `escapeHtml`, G0) was fixed in `dac8a76` but never re-verified by the
   Skeptic. The builder's own mutation evidence (`site-wave-5-hardening.md`) covers
   G0/B5/B4/B1–B3/D2/D3 and I reproduced the leak check, the private-build absence, the
   42-file artifact and the R2-b normalisation — so §7's "no un-failable guard" and the
   Security Tester's "0 FAIL" hold **on reproduced evidence, not on a verifier report at
   HEAD**. Either obtain a scoped re-run over `72dea41`, or add the explicit dated note
   Wave 4 used, so the §7 condition is met against the merged commit.
4. **STATE's test count is stale by one.** `STATE.md:3435` says "`site` **403 passed |
   1 skipped**"; the R2-b test in `72dea41` makes HEAD **404 passed | 1 skipped**. The PR
   body repeats 403. One-line correction.

## Notes / minor

- **D4 (the stubs host names `/website/cv/anthropic-fellow/`).** Accepted by ADR-0020
  decision 5/Risks; note that the committed `redirects/github-pages.json` is itself a
  **public** repo file, so the slug is already public and the stubs host is not a new
  disclosure. The ADR's factual premise ("it was already public in the old site") is still
  not verified in-repo; record the check or the owner's sign-off if the record is to stand
  on it.
- **Residuals recorded honestly** and matching the handoffs: B6 (<8-char private title is
  not a needle), R2-a (corrupt `.pf_meta`/`.pf_index` falls back to path-only), the PNG
  OG card is path-only, D5 (RSS is a satellite-manifest feed while its description reads
  site-wide), D6 ("retired" means Pages no longer serves the site, not that the
  environment is deleted), and the `check-no-private-in-public` PASS banner still says
  "any file's contents" without the binary caveat the header documents.
- **Memory bank not updated for Wave 5** (last entry is Wave 4 close, `2459ca7`). Expected
  to be a wave-close artifact after merge, not a defect in a not-yet-merged build PR.
- **No `site`/`infra` wave-5 scope violation; no misplaced control-plane artifact.**
  Wave 5 `site: 404 passed` now includes the R2-b test, so the hardening's `403` figure is
  likewise superseded.

## UNVERIFIABLE (with the evidence that would settle each)

- **File-shaped forwarding live.** Dissenter D2's MIME claim (Pages serves
  `pdfs/academic.pdf` as `application/pdf`, so the `404.html` map cannot fire) is not
  reproduced locally. **Settled by** `curl -sI
  https://djjay0131.github.io/website/pdfs/academic.pdf` after the next `deploy` plus a
  meta-refresh-following probe, and by extending `smoke-test` to one file-shaped entry.
- **Pages retirement and the two smoke probes.** Not observable pre-merge (Pages still
  serves the full site). **Settled by** the post-merge `smoke-test` on
  `djjay0131.github.io/website/`.
- **Every redirect-map entry forwarding.** Checkpoint 7 item 1; only two directory-shaped
  entries are probed in CI. **Settled by** a script over all 57 entries, or a recorded
  reason the sample suffices.
- **`redirects:check` green and required.** **Settled by** regenerating the map from real
  content, excluding `_payload/**` in `route-inventory.mjs`, then wiring and promoting the
  step (the plan in the ADR amendment and `infra-wave-5.md:183-195`).

## Related docs

- `llm/sprints/2026-09-hub/contracts/phase-6-review-contracts.md`,
  `contracts/phase-6-seams.md`, `contracts/{site,infra}-wave-5.md`
- `handoffs/site-wave-5.md`, `site-wave-5-hardening.md`, `infra-wave-5.md`,
  `red-team-wave-5.md`, `security-tester-wave-5.md`, `skeptic-verifier-wave-5.md`,
  `dissenter-wave-5.md`
- `llm/governance/adr/0020-pages-retirement-with-redirect-stubs.md`,
  `adr/0005-two-output-build-with-leak-check.md`
- `llm/master-roadmap.md` §`phase-6-polish` (`:421-464`);
  `llm/sprints/2026-09-hub/STATE.md` §Wave 5 (`:3393-3477`)
- `llm/plans/2026-10-01-completion-brief.md` §6/§7/§8;
  `.github/pull_request_template.md`
- `.github/workflows/build.yml`; `site/scripts/{generate-redirect-stubs,check-no-private-in-public}.mjs`;
  `site/src/pages/{search.astro,rss.xml.ts}`; `site/src/lib/{canonical-url,public-feed}.mjs`
- PR: https://github.com/djjay0131/website/pull/99
