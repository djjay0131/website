# Research Hub — Completion Brief (OpenCode orchestration)

Status: Active · 2026-10-01 · Owner: Jason Cusati (`djjay@vt.edu`)
Location: `llm/plans/2026-10-01-completion-brief.md` — control plane. Commit this file on the
first record PR so every contract can cite it by path (closes audit finding B-7/R-5).

You are the **Lead Architect** for sprint `2026-09-hub` in `djjay0131/website`, running in
OpenCode on the owner's WSL checkout at `/mnt/c/code/website`. Your job is to carry the
roadmap (`llm/master-roadmap.md`) to the end of Phase 6 without stopping for the owner,
except at the hard stops in §9. The owner will test the result. He is not watching.

---

## 1. How you operate here

**Governance.** This repository runs under agentic-governance (canon v0.9, pinned in
`.github/workflows/ci.yml`; checkout at `~/code/agentic-governance`; the installed plugin under
`~/.claude/plugins/`). It binds you exactly as it bound Claude Code: `CLAUDE.md`/`AGENTS.md`
(the two-plane layout), `llm/governance/governance-delta.md` (principles, review questions,
check command), the Definition of Done, L0/L1/L2/L3 levels, bounded contracts before every
agent launch, handoffs after, STATE.md after every unit. Run
`node ~/code/agentic-governance/plugin/scripts/governance-checks.mjs --layout` before every PR.

**Skills and agents.** The owner's skills and agents are authored for Claude Code but are
plain Markdown; use them as instructions. Discover them with
`find ~/.claude /mnt/c/code/website/.claude ~/code/agentic-governance ~/code/agentic-research -name SKILL.md -o -name '*.agent.md' -o -path '*/agents/*.md' 2>/dev/null`
and read the relevant `SKILL.md` or agent file before the task it covers. In particular:
agentic-governance's `establish`, `audit`, `review` and the Universal Bounded-Contract
Skeleton in `llm/governance/patterns/prompt-patterns.md`; Constellize's specialist personas
(`system-architect` for Terraform module review, `QA` for test plans, `feature:specify` for
new features) and Superpowers' `brainstorming`, `writing-plans`, `executing-plans`,
`systematic-debugging`, `test-driven-development` — wherever those skills say to write to
`docs/superpowers/**`, write to `llm/specs/` or `llm/plans/` instead (CLAUDE.md §Output-location
preferences). A skill's `/slash` invocation is not available to you; its SKILL.md is.

**Sub-agents.** Use OpenCode's agent/task mechanism to launch every stream, reviewer, tester
and adversary below as its own sub-agent with its contract as the prompt. Sub-agents **write
files and report**; they make no git, `gh`, `gcloud`, `terraform` or `firebase` mutation. You
alone stage, commit, push, open PRs, merge, apply. Commit as `Jason Cusati <djjay@vt.edu>`.
Do not relaunch a stream whose handoff exists; read it.

**Records.** Contracts → `llm/sprints/2026-09-hub/contracts/<agent>-<wave>.md`. Handoffs →
`handoffs/<agent>-<wave>.md` (Summary · Assumptions · Recommendations · Alternatives · Risks ·
Open questions · Related docs · ADR candidates). STATE.md § per wave. Memory bank at each wave
close. Roadmap boxes flip only on live evidence, citing it.

## 2. Owner decisions on the record (do not re-ask)

D1 go for Phases 4–6 · D2 share links wanted (Q3) · D3 members `djjay@vt.edu` (owner) and
`cbrown@vt.edu` (Q4) · D4 satellites: `agentic-kgis` as `kgis`, then `agentic-kg-research`,
then `construction-ai-proposal`; `agentic-kg` optional (Q6) · D5 merge + apply authority,
gated by §7 · D6 Phases 4–6 each close with a checkpoint you define before the phase · D7
`research` and `projects` stay separate sections · D8 private by default — the hub's committed
allowlist decides publicness; day-one public: `cv/academic`, `cv/research-professional`,
`cv/sde-long`, `cv/cv-data`, `kgis/kgis-docs`, the first-party soa-agentic-se digests;
`cv/anthropic-fellow` private; everything else private until allowlisted · D9 apply before
merge is allowed when a security check is fixed only by the apply · D10–D12 as recorded in
STATE for the satellites run · **D13 (2026-10-01):** Licensing declined the VT marks; no VT
logo or HokieBird is ever served; the original emblem (#71) is the site mark · **D14
(2026-10-01):** the branding plan is approved as design authority for Wave 0c — turn
`llm/plans/…branding` content below into `llm/specs/2026-10-01-branding-design.md` plus one
ADR before building.

## 3. Where things stand (verify, then proceed)

`main` ≥ `c02596d`. Phases 0–3 merged and deployed; Wave 0 merged 2026-09-23; A1 proven;
emblem home page live (#71); repository hygiene and memory sync merged (#73).

**Wave 1 (`kgis`, #72) is half done and the half that matters is live:**
- `terraform apply` for the `kgis` roster entry **already ran**: four resources exist in the
  project (SA, `github-kgis` provider, impersonation binding, prefix-conditioned bucket
  binding). The entry is committed on `feat/satellite-kgis` at `a68feea`. **A plan from `main`
  would destroy them — never plan or apply from a branch that lacks `a68feea`.**
- Boundary proofs for `kgis` and A13 for `phd-milestones`: 24 of 25 executed and passed, one
  did not execute (STATE §"Wave 1 (#72) boundary proofs"). Finish the 25th.
- The `site` stream died on a provider billing error and left **uncommitted** edits in
  `site/astro.config.mjs` and `site/scripts/check-no-private-in-public.test.ts` on
  `feat/satellite-kgis`. Read the diff first; keep what is correct, discard what is not, and
  say which in STATE. Then complete the stream: `kgis` in `EXPECTED_SOURCES` (`required:
  false` until first publish), the `/projects/` index listing manifest items, the `html` frame
  for a non-`cv` source.
- Not yet done: variables on `agentic-kgis`, un-gating `docs-publish.yml`, first publish, live
  verification, `required: true`, the Phase 3 bookkeeping (A3/A4, Checkpoint 4 record).

Open issues that are yours: #46 (Wave 0b), #52/#51/#50 (Phase 3 bookkeeping), #54 (forgeable
metrics), #56 + #59 (npm audit: 4 high via `@grpc/grpc-js` through `firebase`; wire audit into
CI), #57, #61, #62, #63, #42 (backlog), #21.

## 4. Wave sequence

Run serially. Each wave: contracts → streams (parallel where scopes are disjoint) → adversarial
round → security gate → Chief Reviewer → merge/apply per §7 → live verification → STATE,
roadmap, memory bank.

| Wave | Issue | Ships | Exit |
|---|---|---|---|
| **1** | #72 | `kgis` live at `/projects/kgis/kgis-docs/`; a docs push propagates with no hub commit | Phase 5 criterion 1 ticked; Checkpoint 4 recorded PASSED (A3/A4 via a non-member sign-in, A13 complete); #50/#51/#52 closed or deferred with reason |
| **2** | `hub-010` | `agentic-kg-research` as private satellite 4 (`section: research`, one `html` item, Quarto `_site/`) under `/p/`; team members from D12 seeded (owner runs the seed script — post the command, continue) | Signed-in member sees it; signed-out gets the gate 404; `dist-public` carries no trace; private-sync delete list verified empty on first multi-source run |
| **0b** | #46 | Private by default: `site/publish-allowlist.json`, effective visibility in `hub-content.mjs`, private build renders every section, `cv-data` residue check, leak check over all non-allowlisted items, `/pdfs/anthropic-fellow.pdf` and its historical URLs → sign-in or 410 | Three CVs public, fellowship CV absent signed-out and present signed-in; kgis and digests public; Red Team allowlist-bypass attacks all refused |
| **0c** | `hub-brand` | Branding: maroon band header with "Virginia Tech" affiliation text (no mark), three-column footer with Elsewhere links from `site/src/data/footer.json`, home page = identity block + three tenet cards (Knowledge Graphs · Agentic SE · AI Safety, projects beneath) from `site/src/data/research-portfolio.json` + Recent list + Ways in; shared band/footer components used by both `Base.astro` and `PrivateBase.astro`; new tokens `--color-band`, `--color-on-band`, `--rule-orange`, `--vt-orange-text` with `tokens.test.ts` carve-out widened by name and `contrast.mjs` pairs added; `--tracker-petrol` removed; Projects titles stop rendering literal `---` | Contrast suite 0 below AA; a11y pass; every page incl. `/signin/` and one `/p/**` page shows the chrome; OG card has no portrait |
| **3** | `hub-004` | Phase 4 sharing: `POST /share`, `GET /share` (owner), `DELETE /share/{token}`, `GET /s/{token}/{path}`; tokens ≥128 bits, one slug, expiry and revocation server-side, origin check, `private, no-store`; Shares page as a React island in the private build only; A7 closes here | Real 14-day share minted by the owner identity via the API, opened signed-out, revoked, re-tested |
| **4** | `hub-005` | Phase 5 remainder: `construction-ai-proposal` as satellite 5 (private until allowlisted; `format: pdf` + `html` from its README), project index from manifests; reverse-leg proofs from every public identity against every private prefix | Two satellites update from their own pushes; index lists them without hand entries |
| **5** | `hub-006` | Phase 6: Pagefind over `dist-public` only, RSS, OG images, leak check extended to all four; Pages retirement per ADR (meta-refresh stubs for the redirect map, `404.html` mapping, delete the full-site Pages job); docs updated | Every redirect-map entry lands on its target; search index/RSS/OG contain no private slug or title; Governance Audit across Phases 0–6 recorded |

Hardening rides where it fits: #54 and #59/#56 in Wave 1's record PR (audit in CI with
`--omit=dev`, metrics endpoint bound by origin + a shared secret or dropped), #62 and #57 in
Wave 0b, #61 and #63 in Wave 5. ADR-0012 (dev-staging as a separate project) stays Proposed
unless the owner says otherwise.

## 5. Roster (one bounded contract each, per wave)

Builders: `infra` (`infra/**`, `build.yml`, `ci.yml`), `site` (`site/**`, `firebase.json`),
`gate` (`gate/**`, `gate.yml`), `contract` (`contract/**`, `docs/satellites.md`), and one
`satellite-<name>` per satellite repo (that repo only). Adversaries, every wave, with quotas
and no fixing: **Red Team** (≥5 attacks with transcripts; targets per wave: prefix escape,
public→private prefix reach, allowlist bypass by casing/Unicode/path, share-token and slug
escape, private title in index/search/OG), **Dissenter** (≥3 objections with the evidence that
would settle each), **Skeptic Verifier** (break every new guard, show red, restore). Testers:
**Security Tester** (owns §6; a single FAIL blocks), **Boundary Tester**, **Live Prober** (verifies
only against `jason.cusati.us`, through Hosting and at `run.app`), **Regression Tester**.
Reviewers: **Chief Reviewer** per PR, **Governance Auditor** per wave and across Phases 0–6 at
the end. Reviewers author nothing in the wave they review. A wave with zero *Fix now* findings is
relaunched once; two rebuttal rounds maximum, then you decide and record it.

## 6. Security gate (Security Tester, every wave, all must pass)

No private content on the public path (plant and prove red); private bucket exactly two
principals, UBLA + PAP, anonymous GET refused; gate refuses signed-out and non-member on both
transports with identical status, `private, no-store` everywhere under `/p/`, `/s/`, `/share`,
`__session` cookie flags, traversal suite; shares: entropy, expiry, revocation, slug escape,
non-owner 403, origin check; identity: no keys anywhere, numeric-id + ref pinning on every WIF
binding, separate satellite pool, no `list` on any satellite role, gate SA holds only
`gateSessionMinter` + `datastore.viewer`, public deploy identity holds no private-bucket
permission; Firestore deny-all rules stay released across applies, `members/` and `shares/`
unreadable from the Web SDK; supply chain: every action SHA-pinned across all satellite repos,
`npm audit --omit=dev` and `pip-audit` clean of high/critical **in CI**; static public site
(`firebase.json`: no functions, no SSR, only the known rewrites); budget guard green; logging:
`event=` classes still reach Cloud Logging, no secret in any log line; repos: private ones
confirmed private by API.

## 7. Merge and apply

Merge when: required checks green; Chief Reviewer approve/comment; Security Tester zero FAIL
(D9 exception: a FAIL fixed by this PR's own apply blocks the *next* wave until verified live);
Skeptic Verifier reports no un-failable guard; governance checks green; PR body on the template
with Governance Level first and the data/security/privacy section answered. Apply when: it
follows a merged PR (or D9); the saved plan shows **no destroy or replace of a stateful
resource** — buckets, Firestore DB, Identity Platform config, ruleset/release pair, service
accounts, WIF pools/providers, budget, and the four live `kgis` resources; plan summary pasted
into STATE before, result after, second plan clean. Cloud Run deploys only through `gate.yml`.

## 8. Recording and reporting

STATE.md after every unit; five-line status (State · What to review · What only the owner can do
· Open questions · Governance) at every wave boundary; memory bank at each wave close. Final
report `handoffs/completion-final.md`: what is live at which URLs, every roadmap criterion with
its evidence, the audit result, open issues by wave, hard-stop items awaiting the owner with
exact commands, cost at zero traffic, and what the Red Team would try next.

## 9. Hard stops (stop that path, post the exact owner steps, continue elsewhere)

A credential or key would be created or committed · a plan with destroy/replace of anything in
§7 · budget above $5 at zero traffic · console-only work (OAuth, DNS, alert-channel
verification) · the Firestore member seed (owner runs it) · a design-authority change larger
than an ADR amendment (the §4 example fixture rewording stays untouched) · private material
appearing anywhere public · a satellite's content files needing renaming to satisfy the gate's
segment allowlist · a change to `contract/manifest.schema.json`.

Begin by reading STATE.md §Current position, §"Wave 1 (#72) boundary proofs" and
§"Repository hygiene, 2026-10", then the uncommitted diff on `feat/satellite-kgis`. Then §3.
