# Active Context

Status: Active
Last updated: 2026-10-07
Owner: Chief Architect

What belongs here: the current focus, the current stop point, and next steps —
what a contributor needs to pick up work today.

## Current position

- **Phases 0–3 are merged and deployed.** `main` is at `a930718` (after PR #75).
- **Wave 0 merged 2026-09-23** (#45, #48, #65, #53, #67, #47; close-out #68). Applied
  from `feat/infra-wave-0` at `63fc0d3` before merge, under owner decision D9. Sign-out
  is live; the gate runs on the narrowed `gateSessionMinter` role; `roles/editor` is
  empty project-wide.
- **A1 proven live 2026-09-23** (#69): the owner signed in, the gate minted a session
  under the narrowed role, and both private documents were served.
- **Emblem home page live** from #71 (2026-09-25). **Licensing declined the VT marks**
  (owner, 2026-09-24): no VT mark is served; #60 is closed; #70 stays a draft.
- **Satellites run #72** — satellite 3 `kgis`, then satellite 4 `agentic-kg-research`.
  - **Wave 1 (`kgis`) is DONE 2026-10-01.** The site stream was finished and the
    record PR #74 merged; the completion brief is on `main`. K10, the 25th boundary
    proof, passed. The Red Team found (and the wave fixed) an incomplete #54 metric
    fix, a `./index.html` guard miss, a staging source-escape and an audit
    severity-escalation gap; Chief Reviewer **Approve**. `agentic-kgis` PR #53
    un-gated `docs-publish.yml`; the first publish (75 objects) propagated to a live
    `https://jason.cusati.us/projects/kgis/kgis-docs/` with no commit to `website`.
    `kgis` is now `required: true` (PR #75). **Phase 5 criterion 1 is ticked.**
  - **Wave 2 (`agentic-kg-research`, private) is DONE 2026-10-01, except the member view.**
    Infra PR #77 provisioned satellite 4 (two applies: a 32-char display-name limit, then
    clean); the boundary proof passed including the reverse legs; the satellite (#3)
    published 61 objects; the hub syncs it into the private bucket with no `dist-public`
    trace (private-sync 139 uploaded, 0 deleted). The new leak-check false positive FP-1
    (a bare `index.html` payload path) was found by CI and fixed in PR #79. **The member
    view is owner-blocked on D12** (the team is unnamed), so the Firestore seed has not run.
- **Checkpoint 4 (#52) is PASSED (2026-10-02).** The owner signed in as `family@cusati.us`
  (not on the allowlist) and was refused at session exchange (`event=deny reason=not_a_member`,
  the "nothing has been shared with you" page), and as `djjay@vt.edu` and read the private
  area. A3 + the non-member half of A4 proven; A12/A13/S5 closed, A1/A5 proven, A7 deferred.
- **Wave 2's research store is reachable to the member** (route, payload and index entry in
  the private bucket) but was not the page the member opened; one click on
  `https://jason.cusati.us/p/research/agentic-kg-research/research-store/` closes it.
- **Wave 0b (#46) is DONE and LIVE 2026-10-02** (PRs #86, #88, #89; merge `ebf777d`).
  `site/publish-allowlist.json` is the authority; `effectiveVisibility()` is the one
  computation; the public build stores only effectively-public items; the members'
  area lists every item (private framed under `/p/`, public linked to their public
  URL); the leak check's private set is every non-allowlisted item;
  `check-publish-allowlist` is wired into both build jobs. `cv/anthropic-fellow` is
  gone from `dist-public`; Firebase 302s its historical URLs to `/signin/`. Adversarial
  round run (Red Team 1 bypass dispositioned, Skeptic/Security/Chief Reviewer green).
  Verified live on both hosts; one owner sign-in click outstanding. **A5 residual
  (allowlist binds a name, not bytes) is a recorded owner decision.**
- **Wave 0c (branding) is DONE and LIVE 2026-10-02** (PR #91, merge `beb7301`).
  Maroon band + "Virginia Tech" text (no mark), three-column footer with 7
  `rel="me"` profiles (GitHub, LinkedIn, Scholar, ORCID, X, Bluesky, Mastodon),
  portfolio-driven home and research index, generated `og-card.png`, no portrait
  (`/photo_jason_1.jpeg` 404). D15 wording applied; spec §5 and ADR-0015 amended
  (`--vt-orange-text` `#c34600`). a11y + adversarial round run; Security gate
  GREEN; Chief Reviewer Comment.

- **Wave 3 (`hub-004`, Phase 4 sharing) is implemented and in PR #93** (2026-10-03).
  `POST /share`, `GET /share`, `DELETE /share/{token}`, `GET /s/{token}/{path}`; the
  owner Shares React island in the private build; `roles/datastore.user` for the
  gate's share store. Two adversarial rounds + a test-hardening round: Red Team 0
  bypass, Security Tester 0 FAIL, Skeptic 0 un-failable guards, Chief Reviewer
  Comment. **The share serves `<section>/<source>/<slug>/_doc/<entry>`, not the
  member frame** (ADR-0017). Owner live mint (SEAM-S7) pending.

- **Wave 4 (`hub-005`, Phase 5) is DONE 2026-10-03** (hub PRs #95, #97; satellite
  PR #11). The `construction-ai` source (key, not repo name — SEAM-C1) is
  provisioned and boundary-proven; the satellite publishes two `visibility:
  private` items (proposal PDF + generated overview). The manifest-driven project
  index needed no site change. A pre-existing content-sync path-traversal bypass
  was found and fixed. The leak check false-positived on the new source key
  colliding with the owner's public CV project `construction-ai` (FP-2) and was
  fixed. **The roadmap public-page criterion is deferred/partial** (items are
  private until the owner allowlists, D8).

- **Wave 5 (`hub-006`, Phase 6) is merged 2026-10-03** (PR #99). Pagefind search,
  `rss.xml`, redirect stubs + `404.html`, and stubs-only Pages retirement
  (ADR-0020) are live. **Checkpoint 7 is not recorded passed**:
  `redirects:check` is deferred (map staleness) and file-shaped forwarding is
  browser-dependent. Final report at `handoffs/completion-final.md`.

- **L1 follow-up "logo" (owner decision D16, 2026-10-04) is implemented and in PR**
  (branch `feat/logo`). The research emblem returns to the shared site band (linked,
  40px in a 44px hit target, every page, both themes) and is again the default
  `og:image`; the owner's `vt-badge-hokiebird-laptop-tower-research-today.png` is the
  home hero where the portrait used to be. D16 records the owner's caveat **verbatim**;
  ADR-0015 decisions 1/3 and branding spec §3/§6 are amended. Site checks, leak check,
  a11y (0 FAIL), Security Tester (0 FAIL), Dissenter (2 blocking, fixed) and Skeptic
   (0 un-failable, residual partial coverage recorded) ran; Chief Reviewer **Comment**.
   **PR #70 stays a draft; the other seven badges are not added.**

- **Wave 6 (`#107`, annotations) is implemented and in PR** (branch `feat/annotations`,
  owner decision **D17**, 2026-10-07). Private reading-time notes: a capture island on
  `html`/`bundle` private item frames (select → Highlight/Comment, intent chip), a gate
  store and routes (`POST/GET/DELETE /annotations`, owner-only `?scope=all`), My notes at
  `/p/notes/`, intent routing in `site/notes-routing.json`, and a credential-free export
  renderer. Two adversarial rounds (Red Team 8 bypasses found and closed; Security Tester
  0 FAIL; Regression 0; Dissenter/Skeptic dispositioned); Chief Reviewer Request changes →
  all must-fixes resolved. The `X-Frame-Options: SAMEORIGIN` change is confined
  to served `_payload/**` and fixes a pre-existing latent defect (the item iframe
  was `DENY`-blocked).

- **Wave 6b (notes sync, owner decision D18, 2026-10-07) is implemented** (branch
  `feat/annotations-sync`; ADR-0022 amended). **Option A (a GitHub App) confirmed;
  the owner-triggered workflow rejected; the gate commits on save.** A Firestore
  export queue (30–60s debounce, coalesced), exponential backoff, dead-letter at
  ≥24h with a flag on My notes, soft-delete tombstones, a long-lived `notes`
  branch created once from the default and never `main`, Markdown/intent routing,
  and a GitHub App client (short-lived installation token; Secret Manager read).
  **Dormant until configured.** gate 652 passed; Security 0 FAIL; Regression 0;
  Red Team two rounds (all bypasses closed). **The only remaining work is the two
  owner hard stops** (create the App on the two repos with Contents:write and
  report the ids; `gcloud secrets create notes-export-app-key` + add the key),
  then a `terraform apply` (adds only) with the App id/installation id and
  `notes_export_enabled=true`.

## Stop point

Wave 6 is merged. Wave 6b is implemented, reviewed and ready to merge; its only
outstanding work is the two owner hard stops above, plus the Wave 6 owner steps
(the live sign-in check and confirming the narrowed owner-read default). Earlier
deferrals stand: Wave 3's share mint, the Firestore member seed, and Wave 5's
`redirects:check`.

## Next

1. **Wave 6b owner steps:** create the GitHub App on the two repos (Contents:
   write) and report the App id + installation id; `gcloud secrets create
   notes-export-app-key` and add the key; then `terraform apply` (adds only) and
   the first live commit.
2. **Wave 6 steps:** sign in and exercise capture + My notes; confirm or widen
   the narrowed owner-read default.
2. **Owner steps carried:** Wave 3's 14-day share mint (SEAM-S7); the Firestore member
   seed; decide whether to flip `construction-ai` public.
3. **Wave 5 follow-up:** regenerate `site/redirects/github-pages.json` from real
   content (exclude `_payload/**` from `route-inventory.mjs`), wire
   `redirects:check`, browser-verify file-shaped forwarding, then record
   Checkpoint 7 passed.

## What only the owner can do

- **Wave 3 live acceptance (SEAM-S7):** mint a real 14-day share as `djjay@vt.edu`,
  open it signed-out in a fresh browser, revoke it, re-test. Exact command in
  `STATE.md` §Wave 3.
- **Run the Firestore member seed** (D12 is answered; the list is the D3 pair
  `djjay@vt.edu` and `cbrown@vt.edu`): the seed itself is owner-run per §9. Then one
  click on `https://jason.cusati.us/p/research/agentic-kg-research/research-store/`
  closes Wave 2's member view.
- **One non-member sign-in** closes A3 and the non-member half of A4. `djjay0131@gmail.com`
  is deliberately not a member, so signing in as it should get the "not shared with
  you" page.
- **The alert-channel verification link** — four policies are enabled and deliver
  nothing until it is clicked.
- **Wave 6b:** complete the two hard stops — create the GitHub App on the two
  repos with Contents:write and report the App id + installation id, and run
  `gcloud secrets create notes-export-app-key` + add the private key — then the
  gate commits annotations to the `notes` branch. **Wave 6:** sign in as
  `djjay@vt.edu`, select text on a private item, and open
  `https://jason.cusati.us/p/notes/`.

## Decisions on record

- Owner decisions D1–D9: `llm/sprints/2026-09-hub/STATE.md` §Decisions. D9 (apply before
  merge) broke the Wave 0 deadlock.
- Design doc §10: **Q1** domain — the hub is at `jason.cusati.us` (ADR-0006). **Q2** GCP
  project `cusati-hub` (410552878319). **Q3** share links wanted (D2). **Q4** members
  seeded, two: `djjay@vt.edu` (owner), `cbrown@vt.edu` (D3). **Q5** the app lives under
  `site/` (ADR-0001). **Q6** satellite order: `agentic-kgis` 3, `agentic-kg-research` 4
  (D10, owner, 2026-09-25, #72).
- ADRs 0001–0022: `llm/governance/adr/`. The most recent: ADR-0016
  (private by default — the publish allowlist is the authority; amends design doc
  §4–§5), ADR-0017 (share links serve the item's document under an item-scoped
  `_doc/` namespace), ADR-0018 (the gate's share store uses a project-wide
  Firestore role), ADR-0021 (annotations are private, item-anchored notes routed
  by intent — Accepted), ADR-0022 (annotation export transport — **Proposed**,
  owner decision required).
- **D12 is answered (owner, 2026-10-02):** the private-area team is the D3 pair; the
  Firestore seed is owner-run.
- Roadmap: `llm/master-roadmap.md`.

## Open

- Brief / design-doc / canon conflicts K1–K12 (`STATE.md`). K13 is closed by ADR-0007.

## Governance adoption

- 2026-09-14: adopted agentic-governance **v0.9** (canon `VERSION` 0.9.0; the pin moved
  from 0.8.3 by PR #22, and `.github/workflows/ci.yml` pins canon at `851a50a`) via
  `/governance:establish` — issue #7.
- Governance delta: `llm/governance/governance-delta.md`. Steward merge authority:
  INACTIVE.
