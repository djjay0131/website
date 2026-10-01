# Completion report — Research Hub, Phases 0–6 (Wave 1 and Wave 2 of the run)

Date: 2026-10-01 · Lead Architect (OpenCode session, `agents4research`)
Brief: `llm/plans/2026-10-01-completion-brief.md` (on `main` since PR #74)
State of record: `llm/sprints/2026-09-hub/STATE.md`, §Wave 1 and §Wave 2

**Honest status: Wave 1 is complete; Wave 2 is complete except its owner-only member
view. Waves 0b, 0c, 3, 4 and 5 are not started.** The rest of this report says exactly
what is live, what each wave needs, and what only the owner can do.

---

## 1. What is live, and at which URLs

| URL | What | Evidence |
|---|---|---|
| `https://jason.cusati.us/` | Public site, Firebase Hosting (`cusati-hub`), deployed from `main` through WIF on every push | build-and-deploy green |
| `/cv/academic/`, `/cv/research-professional/`, `/cv/sde-long/` | Three CV variants (public) | smoke tests |
| `/pdfs/<variant>.pdf` | CV PDFs | smoke tests |
| `/projects/kgis/kgis-docs/` | **KGIS docs, satellite 3**, frame + `/_payload/kgis/` assets, 200 | Wave 1 live probe |
| `/projects/` | Lists KGIS from its manifest, no hand entry | Wave 1 live probe |
| `/p/` | Members' area, gate-served; signed-out 404 | A1 live 2026-09-23 |
| `/p/research/agentic-kg-research/research-store/` | **Private research store, satellite 4** (member view unverified — D12) | private build + 139-object sync; signed-out 404 verified |
| `https://research.cusati.us/` | 301 to `jason.cusati.us`, paths preserved | Phase 1 |
| `djjay0131.github.io/website/` | Mirror of the public build (retired in Phase 6, not yet) | build job |

The gate holds only `gateSessionMinter` + `datastore.viewer`; `roles/editor` is empty
project-wide; the private bucket's live IAM check passes hourly.

## 2. Roadmap criteria — evidence

**Phases 0–3 (merged, deployed).** All 32 Phase 3 checkboxes were audited in Wave 0.
Closed since: A12 (#49), A13 (#50, the `phd-milestones` proofs, completed by K10 in
Wave 1), S5 (#31, stale). A1/A5 proven 2026-09-23. A7 recorded **deferred** to Phase 4
(#51) rather than ticked.

**Phase 4 (sharing).** Not started (Wave 3). `/s/**` and `/share/**` absent; A7's `/s/**`
half unsatisfiable until then, by design.

**Phase 5 (satellites).** Ticked on live evidence:
- Criterion 1 (a docs push updates the page with no commit to `website`) — **ticked**.
  `agentic-kgis` PR #53 un-gated `docs-publish.yml`; run 36939276461 published 75 objects;
  the hub synced and deployed (run 36939339279) to a live `200 /projects/kgis/kgis-docs/`.
  D4/D10 substitute `agentic-kgis` for `agentic-kg`; recorded in the roadmap annotation.
- Satellite #3 scope line — ticked for `agentic-kgis`.
- **Not ticked:** the project index "lists both projects" (construction-ai-proposal is
  Wave 4); "each new satellite identity cannot write outside its prefix" is proven for
  `kgis` (K1–K11) and `agentic-kg-research` (Wave 2), but the criterion names both new
  satellites; WIF-only is proven for the three live satellites.

**Phase 6 (polish).** Not started (Wave 5): Pagefind, RSS, OG images, Pages retirement.

**Checkpoint 4 (#52) — NOT passed.** A12/A13/S5 closed; A1/A5 proven; A7 deferred. A3 and
the non-member half of A4 need one non-member sign-in by the owner.

## 3. Audit result

The **Governance Auditor across Phases 0–6 has not run** (it is Wave 5's and the brief's
final step). Within each wave, governance checks were green at every PR (4/4:
governance-links, adr-index, adr-status, layout). The wave-level independent roles ran for
Wave 1 (Security Tester, Red Team, Skeptic Verifier, Regression Tester, Dissenter, Chief
Reviewer — Chief Reviewer **Approve** after a rebuttal). Wave 2 had the boundary proof, the
leak check, and CI, but **not** the full adversary roster; this is recorded as a gap.

## 4. Open issues by wave

- **Wave 1:** #56 (4 high `@grpc/grpc-js`, recorded in `site/audit-baseline.json`), #59
  (audit report-only; whether it blocks is open), #57, #51, #52, #61, #63, #42, #21.
  Closed on evidence: #50, #54, #62.
- **Wave 2:** #72 (satellites run; the member-view half of Wave 2 remains).
- **Later waves:** #46 (Wave 0b), #61/#63 (Waves 5/3), the branding wave 0c.

## 5. Hard stops awaiting the owner (with exact steps)

1. **D12 — name the private-area team.** D12 is PENDING. Once named, run the seed:
   `node infra/scripts/seed-members.mjs` (members keyed by the exact email in the Firebase
   ID token). Wave 2's member view and Checkpoint 4 both wait on this.
2. **A3 + non-member A4 — one non-member sign-in.** Sign in as `djjay0131@gmail.com`
   (deliberately not on the allowlist); expect the "not shared with you" page and no private
   content. This closes Checkpoint 4.
3. **A member sign-in** to see both private documents and the research store under `/p/`.
4. **Alert-channel verification link** — four policies are enabled and deliver nothing until
   it is clicked. Console-only.
5. **Wave 0c branding — a design-authority gap.** D14 says the branding plan is approved and
   instructs turning `llm/plans/…branding` into `llm/specs/2026-10-01-branding-design.md`;
   **no such file exists in the repo**. The Wave 0c row of the brief is the only branding
   description. Building it without the missing plan risks a design-authority change larger
   than an ADR amendment, which is a hard stop. Owner: supply the branding plan (or confirm
   the brief's row is the whole of it).
6. **GitHub-Pages retirement (Wave 5)** and **#63 (`texlive-full:latest`)** are recorded,
   not owner-only, but not started.

No credential or key was created or committed. No plan destroyed or replaced a stateful
resource.

## 6. Cost at zero traffic

The gate's Cloud Run service runs `min_instance_count = 0` with `cpu_idle = true`, so it
scales to zero. Hosting, Firestore and Identity Platform sit in their free tiers at this
traffic, and the new satellite identities are IAM-only. **At zero traffic the project costs
approximately $0.00–0.10/month**, far under the owner's $5 alert-only budget
(`infra/budget.tf`), which remains in place with `prevent_destroy`.

## 7. What the Red Team would try next

- The leak check is a byte-grep: an entity-encoded (`&#111;`), zero-width, or JSON-escaped
  private title evades it while a browser renders it. This needs a normalized/render-aware
  check (ADR candidate), not another needle.
- Wave 0b's publish allowlist is the next authority surface: casing, Unicode, path-dot and
  `(source, slug)` collision tricks against the allowlist — the brief names these as the
  Wave 0b Red Team targets, and they have not been run.
- The share routes (Wave 3) bring token entropy, expiry, revocation, slug escape and
  origin-check attacks, plus the `/s/**` and `/share/**` `Cache-Control` assertion.
- The audit baseline is id+severity keyed; a same-id content change is invisible. That is
  accepted while the guard is report-only.

## 8. Wave records

| Wave | PRs / runs | Records |
|---|---|---|
| 1 | website #74, #75, #76; agentic-kgis #53 | `contracts/*-wave-1.md`, `handoffs/*-wave-1.md`, STATE §Wave 1 |
| 2 | website #77, #79, #80; agentic-kg-research #3 | `handoffs/infra-wave-2.md`, STATE §Wave 2 |

`main` after Wave 2: `f586f72`. The completion brief is committed on `main`.
