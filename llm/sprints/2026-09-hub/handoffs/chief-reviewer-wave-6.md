# Handoff — Chief Reviewer, Wave 6 (annotations, #107)

Stream: Chief Reviewer (authored nothing in this wave; this handoff is its only write)
Wave: 6 — annotations (`hub-006`)
Branch: `feat/annotations`, HEAD `1ea4d3d` (base `main` `4f33edc`)
Date: 2026-10-07
Contract: `llm/sprints/2026-09-hub/contracts/chief-reviewer-wave-6.md`
Seams: `llm/sprints/2026-09-hub/contracts/wave-6-annotations-seams.md` (AN-CAP, AN-STORE, AN-ROUTES, AN-GUARD, AN-IAM, AN-USE, AN-EXPORT, AN-LEAK, AN-REWRITES, AN-ADVERSARIAL)
Design authority: issue #107; ADR-0021 (Accepted); ADR-0022 (Proposed); ADR-0016/0017/0018

**VERDICT: Request changes — two must-fix.**
1. **The owner-read model (ADR-0021 decision 8) is an unresolved owner
   confirmation, and the wave is not mergeable until it is confirmed or
   narrowed.** ADR-0021 itself says the decision was "taken without the owner
   and is surfaced for confirmation"; a real non-owner member (`cbrown@vt.edu`)
   is seeded, so this realizes a third-party privacy decision on merge. This is
   the Dissenter's D1 block.
2. **The §7 record conditions are not in the branch at review time.** STATE,
   the roadmap and the memory bank are unchanged, and the PR body could not be
   observed to carry the Governance-Level and Data/Security/Privacy sections.
   The task states the Lead Architect is landing these in the same PR; they must
   be present before merge.

Everything security-relevant passes independent reproduction: no cross-member
read/delete, `member` from the session, every response `private, no-store`, the
DELETE id is safe, `X-Frame-Options` is confined to a served `_payload/**`, the
capture surface is private-build-only, the leak check is non-vacuous, and the
export Markdown is injection-safe after the round-2 fix. All four Red Team
round-1 bypasses and all four round-2 residuals are closed in `1ea4d3d`.

**Governance level: L2 — confirmed** (implementation L2 + an ADR L1; highest
touched is L2; Firestore role unchanged per ADR-0021 decision 4; no L3). The
owner-read decision 8 is a privacy call the owner could elect to treat at L3;
I do not unilaterally escalate the wave, because its basis (implementation +
ADR, role unchanged) supports L2 and the privacy call is recorded for the owner
in the ADR. AI may escalate up, never down; this is a deliberate non-escalation
with the reason stated.

Read-only. I wrote no tracked file but this one and ran no git/gh mutation. I
ran `git diff/stat/log/show`, the targeted gate suites, the targeted site suites,
and small scratch probes under `/tmp/opencode/`. No credential was created and
no remote was contacted.

---

## What I verified rather than accepted

- **The gate routes are exactly AN-ROUTES.** `POST /annotations`
  (`gate/app/main.py:748`), `GET /annotations` (`:787`), `DELETE
  /annotations/{annotation_id}` (`:827`); `test_scope.py` pins the route table to
  exactly `/annotations` and `/annotations/{annotation_id}`. There is no
  `POST /annotations/export` and no GET-by-id.
- **`member` is always the session identity, never the body.** POST derives
  `member = normalise_email(principal.email) or principal.email` (main.py:773-776)
  and the body key is not read. My probe posted `member="djjay@vt.edu"` as
  `cbrown`: the stored row is `cbrown@vt.edu`, and it appears only under
  `cbrown` in `GET` and under the owner's `scope=all`.
- **Cross-member isolation is real, on both transports.** Probe (hosting +
  direct): a non-owner's default `GET` returns only its own row; `?scope=all`
  is `403` (refused, not downgraded); deleting another's id is `403` with the row
  intact; the owner's `?scope=all` sees both members and may delete any. The
  member filter is `list_for` (annotations.py:301-311) plus a per-request
  `_is_member`/`_is_owner` re-check (main.py:1163-1170, 1148-1160).
- **Every annotation response is `private, no-store`.** The `security_headers`
  middleware (main.py:335-353) overwrites `Cache-Control` after every response,
  success and refusal alike; the probe showed `private, no-store` on create,
  list, scope-refused, delete, delete-unknown, signed-out and cross-origin
  responses, with no `public`/`s-maxage`.
- **The DELETE id is safe after the round-2 fix.** `_ANNOTATION_ID_PATTERN`
  (main.py:172) is `\A[A-Za-z0-9_-]{1,64}\Z`; `_valid_annotation_id`
  (main.py:1418) gates the path segment before any lookup or log line, and the
  refusal line is value-free (`reason=invalid_id`). I re-derived in Python that
  `abc\n` no longer matches `\A…\Z` (the R2-01 hole), and the probe drove
  `DELETE /annotations/event=deny` and `/annotations/abc%0a` to `404` with no
  `event=` substring and no second physical line.
- **`X-Frame-Options` is confined to a served `_payload/**`.** The decision keys
  on `request.state.served_object_name` (main.py:544), set only on the successful
  `serve_private` 200 path; `_is_payload_object` (main.py:1173) strips the
  private prefix and requires the first segment to be `_payload`. Probe:
  `/p/_payload/…` served → `200 SAMEORIGIN`; `/p/<item>` → `200 DENY`; payload
  miss → `404 DENY`; signed-out payload → `404 DENY`; `/annotations` → `DENY`.
- **The capture surface is private-build-only.** `srcDir` switches to
  `./src-private` for the private build (`site/astro.config.mjs:51`);
  `wave-6-structure.test.ts` asserts no `src/**` file imports the island or the
  logic, that `/notes/` routes only from the private tree, and (conditionally on
  a build) that `dist-public` carries no notes page, no needle and no island
  chunk. I ran the structure suite green; I did **not** rebuild the two dists.
- **The leak check is non-vacuous.** My probe planted `/p/notes`,
  `DATA-ANNOTATION-FRAME`, `&#47;annotations` and `.data-annotation-frame{}` into
  a temp dist and `findAnnotationLeaks` named all four; the citation key
  `tan-2024-llm-data-annotation-survey` stayed green (the documented
  left-boundary narrow, `check-no-private-in-public.mjs:293,312`).
- **The export Markdown is injection-safe after `1ea4d3d`.** `oneLine`
  (`export-notes.mjs:67`) collapses `created`/`id`/`repo`/`dir`/qualified-id to
  one line and `escapeMarkdownText` (`` `*_[\]! ``) plus a blockquoted
  quote/comment neutralise links, images, `javascript:`/`data:` URLs, fences and
  heading/list starts (RT6-06, R2-02). My probe rendered a crafted note and got
  no unquoted top-level block; `question` was skipped and a multi-segment slug
  (`research/soa-agentic-se`) now writes as nested directories (R2-09).
- **No credential, no remote.** `export-notes.mjs` has no `process.env`, no
  `fetch`/network, no `child_process`; ADR-0022 names a secret *name* placeholder
  only, no value. A repo-wide high-signal secret grep over the changed non-`llm`
  files is clean.
- **ADR-0021 matches the shipped code.** Decisions 3/6 correctly place rendering
  in `site/scripts/export-notes.mjs` and drop the phantom gate endpoint;
  decisions 7-10 record the header change (including that it is a pre-wave
  `DENY`-frame defect fix), the owner-read judgement, the known limits
  (intent=routing key, two meanings of orphan, no `section` filter, no persisted
  orphan flag) and the `site/notes-routing.json` Q2 plane. The ADR index lists
  0021 Accepted and 0022 Proposed (`adr/README.md`).
- **Scope.** `git diff --stat main...feat/annotations` touches only `firebase.json`
  (root), `gate/**`, `infra/**`, `site/**` and `llm/**`. Gate touched no `site/**`
  or `firebase.json`; infra touched only `gate.tf` (15 comment lines) and
  `README.md`; `.github/workflows/gate.yml` and `contract/**` are unchanged.

## Must-fix

1. **Resolve the owner-read decision before merge (ADR-0021 decision 8; Dissenter
   D1).** `GET /annotations?scope=all` lets the owner read every member's notes.
   ADR-0021 decision 8 records this as taken **without** the owner, "surfaced for
   confirmation", and offers the narrowing (ids-only metadata + an owner
   delete-only path). The members are owner-seeded but not owner-only — `cbrown@vt.edu`
   ("Committee member") is seeded (`infra/scripts/seed-members.sh:30`), so this is
   a third-party privacy decision that becomes real at merge and cannot be
   un-told afterwards. **Settled by** an owner decision (a D-number) confirming
   decision 8, or by narrowing `scope=all`/export and re-running the gate tests.
   Until then the code is correct to its stated model but the model is unconfirmed.

2. **Land the §7 merge-condition record in this PR.** (a) `llm/sprints/2026-09-hub/STATE.md`,
   `llm/master-roadmap.md` and `llm/memory_bank/*` are **unchanged** at `1ea4d3d`
   (STATE/memory last touched 2026-10-04, before Waves 3-6; no annotation or
   wave-6 entry). The task says the Lead Architect is updating them in the same
   PR — they must be present, with honest counts, before merge. (b) No PR was
   observable at review time, so the PR body's required **Governance Level**
   declaration and **Data, Security and Privacy Impact** section
   (`.github/pull_request_template.md:7,59`) could not be verified; §7 names both
   a merge condition (the Wave 5 precedent was a must-fix for exactly this).
   Either point the review at the PR and paste the body, or fold the declaration
   into STATE.

## Should-fix

3. **The phantom `POST /annotations/export` survives in three control-plane
   documents after the ADR-0021 half-fix.** ADR-0021 was corrected (decision 3/6
   now name the site renderer), but ADR-0022 still says v1 ships "the
   credential-free export render (`POST /annotations/export`)"
   (`0022-annotation-export-transport.md:9`, and "the export endpoint returns the
   rendered Markdown bundle" at `:85`); the seams AN-EXPORT still say "only
   `POST /annotations/export` (credential-free rendering) ships in v1"
   (`wave-6-annotations-seams.md:153`); and the shipped `infra/gate.tf:182`
   comment repeats it. The endpoint does not exist (gate contract requirement 6
   moves rendering to the site). Reconcile the ADR-0022 wording, amend the seam,
   and fix the Terraform comment so the design authority does not contradict the
   code — the same class the Wave 5 review ranked should-fix.

4. **The site contract's file path and consumer claim are wrong.** `site-wave-6.md`
   Scope says `site/firebase.json`, but no such file exists and the deployed
   config is repo-root `/firebase.json` (its own requirement 5 says `firebase.json`;
   `private-structure.test.ts` already reads `../firebase.json`). And requirement 1
   says of `site/notes-routing.json` "the gate receives it as JSON" — the gate
   never receives it; only `export-notes.mjs` reads it (ADR-0021 decision 10 now
   states the Q2 plane). Add dated corrections or fix the contract text.

5. **Close the Skeptic's three coverage gaps.** f-1: removing the `/p/notes`
   needle reds only the declaration test — no committed test plants a `/p/notes`
   leak (the detector works; the committed coverage is the gap). f-2: the routing
   missing-intent branch's message is not pinned (the property still holds). f-3:
   the export `question`-skip assertion is regex-masked by the routing data's
   `null` route. Add a planted `/p/notes` case and pin the exact reasons.

6. **The Security Tester record self-contradicts.** The title line reads
   "Security Tester, Wave 6 (annotations) — VETO" while the status line and the
   table say "8/8 PASS, no veto" (`security-tester-wave-6.md:1,3`). Correct the
   title so the merged record is not read as a veto.

## Notes / minor

- **R2-04 (delete existence oracle).** A member deleting another's id gets `403`
  (exists) vs `404` (unknown). With 22-char `token_urlsafe(16)` (128 bits) this is
  brute-force infeasible; recorded, not a defect.
- **`_payload` is not reserved as an item segment (Red Team O1).** A note may be
  created with `source="_payload"`; identity `section/source/slug` is disjoint
  from the payload namespace, so no traversal or served overlap — benign.
- **D5/D6 recorded in ADR-0021 decision 9.** "Orphan" means "quote no longer
  resolves" in the capture panel and "item absent from the build" in My notes;
  the list filter is `(source, slug)` with no `section`. Both are recorded, not
  hidden; the capture-panel scope uses `(source, slug)`, own-notes only.
- **No browser/e2e evidence for the capture path (D2.4).** The AN-CAP claims rest
  on unit/build evidence; the `SAMEORIGIN` branch is verified in gate unit probes,
  but no automated browser test selects text inside `/p/_payload/…` and saves a
  note. Recorded as a residual with its settling evidence.
- **Interface choices not fixed in an ADR.** The list response key (`annotations`
  from the gate; the site tolerates `notes`/`annotations`/bare array) and the
  export file layout are gate/site agreements with no ADR, as both handoffs'
  ADR-candidate sections note.
- **`POST` returns 200 and `DELETE` unknown is 404** — deliberate; the 404
  differs from `DELETE /share/{token}` (200) per gate contract requirement 5.
- **infra 0/0/0 plan accepted on evidence, not reproduced here.** The
  `git diff` is comment-only (no resource/variable/output line changed); I could
  not run `terraform plan` (no state/GCP in this environment). The handoff's
  saved plan and exit 0 are the evidence.

## Scope check (`git diff --stat main...feat/annotations`)

| Changed file | Clause |
|---|---|
| `gate/app/{annotations,main,config}.py`, `gate/tests/**`, `gate/README.md` | gate-wave-6 Scope + Requirements 1-9 |
| `site/src-private/**`, `site/notes-routing.json`, `site/scripts/export-notes.mjs`, `site/scripts/*.test.ts`, `site/scripts/check-no-private-in-public.mjs` | site-wave-6 Scope + Requirements 1-8 |
| `firebase.json` (root) | AN-REWRITES; site-wave-6 requirement 5 (`firebase.json`) — the Scope's `site/firebase.json` is a typo, see should-fix 4 |
| `infra/gate.tf`, `infra/README.md` | infra-wave-6 Scope + Requirements 1-3 |
| `llm/governance/adr/0021,0022`, `adr/README.md` | the wave's ADRs (control plane) |
| `llm/sprints/**/contracts/*`, `handoffs/*` | governance records (Lead Architect / reviewers) |

No changed file falls outside a contract's intent; the only path mismatch is the
`firebase.json` typo above. `gate.yml` and `contract/**` are untouched.

## UNVERIFIABLE (and what would settle each)

- **PR body template compliance** (Governance Level, Data/Security/Privacy,
  Memory Bank) — no PR observable. **Settled by** `gh pr view` on the wave PR and
  pasting the body, or folding it into STATE.
- **STATE/roadmap/memory-bank updates** — absent at `1ea4d3d`; expected in the
  same PR. **Settled by** those files appearing with honest counts before merge.
- **`terraform plan` no-op** — no state/GCP here. **Settled by** the saved
  `-detailed-exitcode` plan already in `infra-wave-6.md` (accepted as evidence).
- **The two builds** (`dist-public` has no annotation surface; `dist-private`
  emits `/p/notes/` and the island) — I ran the structure tests, not the builds.
  **Settled by** `npm run build:public` / `build:private` + the leak check, per
  `site-wave-6.md:85-100`.
- **Live browser capture and re-anchor** — no e2e suite. **Settled by** one
  browser-level test that a signed-in member selects text in `/p/_payload/…` and
  saves a note.
- **Governance `--layout` 4/4** — not re-run (canon checkout). **Settled by**
  `governance-checks.mjs --layout`.

## Verdict summary

- **Approve?** No. **Comment?** No. **Request changes** — must-fix 1 (owner
  confirmation of ADR-0021 decision 8) and must-fix 2 (land STATE/roadmap/memory
  bank and the PR-body declarations), with should-fix 3-6 for the control-plane
  reconciliation and test-coverage gaps.
- No scope violation, no credential, no surviving security bypass; the code is
  sound to its stated model. The block is the unresolved owner privacy decision
  and the missing §7 record, both of which ADR-0021 and the task anticipate.

## Related docs

- `llm/sprints/2026-09-hub/contracts/chief-reviewer-wave-6.md`,
  `contracts/wave-6-annotations-seams.md`, `contracts/{gate,site,infra}-wave-6.md`
- `llm/sprints/2026-09-hub/handoffs/{gate,site,infra,red-team,dissenter,skeptic-verifier,security-tester,regression-tester}-wave-6.md`
- `llm/governance/adr/0021-annotations-private-item-notes.md`,
  `adr/0022-annotation-export-transport.md`,
  `adr/0016-private-by-default-publish-allowlist.md`,
  `adr/0017-shares-serve-the-item-document.md`,
  `adr/0018-gate-firestore-share-role-is-project-wide.md`
- `.github/pull_request_template.md` §§Governance Level, Data-Security-Privacy
- `gate/app/main.py`, `gate/app/annotations.py`, `gate/tests/{test_annotations,test_headers,test_scope}.py`
- `site/src-private/**`, `site/notes-routing.json`, `site/scripts/export-notes.mjs`,
  `site/scripts/check-no-private-in-public.mjs`, `firebase.json`, `infra/gate.tf`
- `llm/sprints/2026-09-hub/STATE.md`, `llm/master-roadmap.md`, `llm/memory_bank/`
