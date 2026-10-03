# Research Hub — Completion Report

Status: Delivered
Date: 2026-10-03
Owner: Lead Architect
Sprint: `2026-09-hub` · Brief: `llm/plans/2026-10-01-completion-brief.md`

This is the final report the completion brief §8 requires: what is live at which
URLs, each roadmap criterion with its evidence, the audit result, open issues by
wave, the hard-stop items awaiting the owner with exact commands, cost at zero
traffic, and what the Red Team would try next.

---

## 1. What is live

Canonical host `https://jason.cusati.us` (Firebase Hosting; `research.cusati.us`
301s to it).

| Surface | Evidence (2026-10-03) |
|---|---|
| Public site | `/`, `/cv/academic/`, `/projects/kgis/kgis-docs/`, `/research/soa-agentic-se/…` **200** |
| Private area | `/p/` signed-out **404** (uniform); signed-in members read `/p/**` (Checkpoint 4 record) |
| Sharing (Wave 3) | `/share` **403** `private, no-store`; `/s/unknown-token/` **404** `private, no-store`; `/s/{token}/` serves the item's `_doc/` document |
| Satellite 5 (Wave 4) | `sources/construction-ai/` publishes 3 objects; private bucket carries both items; public carries no trace |
| Search (Wave 5) | `/search/` **200**; `/pagefind/pagefind-entry.json` **200** |
| RSS (Wave 5) | `/rss.xml` **200** `application/xml`, 0 private traces |
| `404.html` (Wave 5) | `/404.html` **200** |
| Pages mirror retired | `https://djjay0131.github.io/website/` **200** with `<title>Redirecting</title>` (stub), no site pages |

Satellites live: `cv` (PDFs + `cv-data`), `phd-milestones`, `kgis`
(`/projects/kgis/kgis-docs/`, first publish propagated with no `website` commit),
`agentic-kg-research` (private), `construction-ai` (private items).

## 2. Roadmap criteria, with evidence

Phases 0–3 (Checkpoints 1–4) are recorded passed in STATE. Phase 4 (Wave 3)
closes A7/#51 — live: `/s/**` is `private, no-store`. Phase 5's first satellite
criterion is ticked on the `kgis` live transcript. Phase 5's
`construction-ai` public-page criterion is **DEFERRED** (items are private until
the owner allowlists; satellite visibility flip + republish is the second step),
recorded in STATE and ADR-0019. **Phase 6 (Wave 5) is merged and live** for
search, RSS, OG (the existing public-only card), the `404.html`, and stubs-only
Pages; `redirects:check` is **DEFERRED** (ADR-0020 decision 4 as amended) and
file-shaped forwarding is browser-dependent, so those roadmap boxes stay
unchecked.

No roadmap box is ticked without live evidence; the roadmap is the record.

## 3. Security gate result

- **Wave 3:** Security Tester **0 FAIL** (two rounds); Red Team 0 unhandled
  BYPASS; Skeptic 0 un-failable guards after hardening. Gate SA now
  `datastore.user` (ADR-0018); Firestore deny-all released.
- **Wave 4:** Security Tester **0 FAIL**. The Red Team's content-sync path
  traversal (a satellite could create `sources/<key>/../../…` and overwrite hub
  build files) was **found and fixed** (`sync-content.sh` realpath containment),
  re-verified closed. Leak-check FP-2 (source name colliding with the CV's own
  `construction-ai` project) fixed.
- **Wave 5:** Security Tester **0 FAIL** (two rounds). Red Team B1–B5 closed
  (stub traversal, index-scope no-op, Pagefind gzip payload scanning, file-shaped
  URLs); R2-b open redirect fixed. Residuals recorded: a corrupt
  `.pf_meta`/`.pf_index` falls back to path-only; a private title <8 chars is not
  a needle; `redirects:check` unwired.

Canon non-negotiables: no private content in the public output (leak check red→
green, demo names 10 planted outputs); satellites are untrusted (prefix IAM,
boundary proofs, no `list`); no keys anywhere; WIF pinned by repository id +
owner id + name + ref.

## 4. Governance Audit across Phases 0–6

| Area | Result |
|---|---|
| Two-plane layout (`--layout`) | **4/4 PASS** on every record PR |
| ADR index / status | consistent (0001–0020, all Accepted) |
| Contracts before agents; handoffs after | present for every wave (`contracts/*-wave-*.md`, `handoffs/*-wave-*.md`) |
| STATE after every unit | maintained; Wave 3/4/5 sections appended |
| Memory bank at wave close | updated (Waves 3–5) |
| Merge/apply under §8 | Wave 3/4/5 merged with checks green, Security 0 FAIL, Skeptic no un-failable guard, Chief Reviewer Comment/Approve; Wave 3 infra and Wave 4 infra applied with a clean second plan |
| Roadmap boxes on live evidence | honoured; deferrals recorded rather than ticked |
| Deviations recorded | direct-to-main record push (c1cd3ea) recorded and corrected via `record/wave-3` |

**Audit finding for the owner:** the run brief's §8 conditions are enforced from
the prompt, not a repository document (Chief Reviewer B-7 / Governance Auditor
R-5). They are transcribed into STATE's "standing gap" section. Recommended as a
repository document.

## 5. Open issues by wave

- **Wave 1:** #61 (Hosting null-byte 500), #59/#56 (npm audit report-only),
  #57, #63, #42, #21.
- **Wave 3:** revoke-by-display-id (fix-later); a render-aware leak check.
- **Wave 4:** a public page + private PDF from one prefix root is not possible
  without restructuring (D6); `main.pdf` currency (D8); roster-validation
  coverage gap (not invoked in CI).
- **Wave 5:** `redirects:check` regeneration/wiring (deferred); a static guard
  for the CI step wiring (Skeptic G2); RSS scope limited to manifest items (D5);
  the `404.html` mapper names the historical private fellowship path (D4).

## 6. Hard-stop items awaiting the owner (exact commands)

1. **Wave 3 live share acceptance (SEAM-S7).** Sign in as `djjay@vt.edu` (VT Google
   or email link) and:
   ```
   curl -X POST https://jason.cusati.us/share -H 'Content-Type: application/json' \
     -b <owner-cookie> \
     -d '{"section":"phd","source":"phd-milestones","slug":"committee-dossier","entry":"committee.html","expires_in_days":14}'
   ```
   Open the returned `url` signed-out in a fresh browser; then
   `curl -X DELETE https://jason.cusati.us/share/<token> -b <owner-cookie>`.
2. **Firestore member seed (§9, owner-run).** `node infra/scripts/seed-members.mjs`
   (per the Phase 3 seed). D12 is answered: `djjay@vt.edu`, `cbrown@vt.edu`.
3. **Make `construction-ai` public (optional).** Flip the `html` item's
   `visibility` to `public` in the satellite manifest and republish, then add
   `("construction-ai","construction-ai-site")` to `site/publish-allowlist.json`.
4. **Alert-channel verification** (console): four policies deliver nothing until
   the channel is verified.
5. **Google sign-in** is configured; email-link remains the primary route.

## 7. Cost at zero traffic

Cloud Run `hub-gate` is `min-instances=0` (cold start ≈1 s); Hosting and Firestore
are within free/scale-to-zero tiers; the budget guard is green with a $5 guard and
**no budget alert or increase** was triggered during this run. No new resource was
added beyond the two satellite roster entries and the one IAM role change.

## 8. What the Red Team would try next

- Forge `event=` log lines through the share/RSS/Pagefind paths.
- Poison the committed redirect map to turn the `404.html` mapper into an open
  redirect (R2-b fixed; retry variants).
- Index a private route with Pagefind (scope assertion now blocks `/p/`).
- A `<8`-character private title (a stated needle limit) and a raw-HTML
  `dist-public` write.
- Reach a satellite sibling prefix through a crafted object name (Wave 4 fixed
  the sync reader; retry the IAM condition).
- The GitHub Pages stubs as an injected-content vector.

## 9. Honest limitations of this run

Wave 5 is merged with `redirects:check` deferred and Checkpoint 7 **not recorded
passed**; the roadmap's Phase 6 redirect criteria stay unchecked until the map is
regenerated from real content and the file-shaped forwarding is browser-verified.
The owner's Wave 3 live mint is still pending. Everything claimed live above was
probed on 2026-10-03.
