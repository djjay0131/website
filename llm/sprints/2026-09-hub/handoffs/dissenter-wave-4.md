# Handoff — `Dissenter`, Wave 4 (Phase 5 satellite `construction-ai`)

Agent: Dissenter (independent; authored nothing in this wave)
Contract: `llm/sprints/2026-09-hub/contracts/dissenter-wave-4.md`
Seams: `llm/sprints/2026-09-hub/contracts/phase-5-seams.md` (SEAM-C1…C6)
Design authority: `llm/specs/2026-09-10-research-hub-design.md` §2, §4, §5, §11, §12; ADR-0016
Roadmap: `llm/master-roadmap.md` §`phase-5-satellites` (scope, acceptance, Checkpoint 6)
Hub repo: `/home/djjay/code/website` · branch `feat/construction-ai` · HEAD reviewed `834465f`
Satellite: `/home/djjay/code/construction-ai-proposal` · branch `feat/hub-publish` · HEAD `5201b47`
Issue: `hub-005`

## Summary

I read the contract, the seams, the roadmap `phase-5-satellites` scope/acceptance/checkpoint,
design doc §2/§4/§5/§11/§12, ADR-0016, the two wave-4 stream handoffs, the satellite
`manifest.json` / `publish-hub.yml` / `tools/build-site.mjs`, and the hub modules the wave
lands against (`hub-content.mjs`, `frame-content.mjs`, `public-build.mjs`,
`check-no-private-in-public.mjs`, `check-publish-allowlist.mjs`, `infra/variables.tf`,
`infra/satellites.tf`, `contract/manifest.schema.json`, `contract/validate-manifest.mjs`,
`site/src/pages/projects/index.astro`). I wrote no file but this one, modified no tracked
file, made no git/gh/cloud mutation, and ran only read-only local commands plus throwaway
probes under `/tmp/opencode/`.

**I raise eight objections.** Three block: **D1**, SEAM-C4's stated go-public path is wrong
and, followed literally, fails the hub build; **D2**, the satellite-roster authority (design
doc §2/§11, governance delta) is stale and the ADR D4/D10 promised for it does not exist,
while this wave ships satellite #5; **D3**, Phase 5's own scope and acceptance criteria demand
a *public* project page, which SEAM-C4 deliberately does not ship, so the phase cannot be
closed by this wave and the roadmap contradicts itself.

The other five are record/robustness findings: the source key is bent to an internal
service-account limit with no ADR or mapping (D4); prefix-root `html` staging publishes the
hub's own `manifest.json` and any undeclared root file (D5); the prefix-root choice makes
"public page + private PDF" impossible — `mixedSourceError` throws (D6); "private" is a
hub-rendering label over a public repository whose PDF is already published (D7); and the hub
would serve a `main.pdf` that is stale by weeks (D8).

Objection table. "Block?" means block the Wave 4 exit/merge.

| # | Objection (claim) | Confidence | Block? |
|---|---|---|---|
| **D1** | SEAM-C4's "turn public with an allowlist edit" is false: the manifest says `private`, so allowlisting the slugs leaves them private and **fails** SEAM-B5 condition A | High (reproduced) | **Yes** |
| **D2** | Satellite-roster authority is stale; the D4/D10 ADR that was to amend design §2/§11 does not exist; `agentic-kg-research` (#4) is absent from the control plane; this wave ships #5 | High | **Yes (record)** |
| **D3** | Phase 5 scope (line 381) and acceptance (line 387) require a **public** project page; SEAM-C4 ships private-only; Checkpoint 6 (line 411) says private-only. Unsatisfiable + internally contradictory, unrecorded | High | **Yes (exit claim)** |
| **D4** | Source key `construction-ai` is bent to the `publish-<key>` SA 30-char limit; the public contract id is decoupled from the repo with no ADR/mapping; `kgis` is not a precedent for a length truncation | High | No (record/ADR) |
| **D5** | Prefix-root `html` staging copies the whole prefix, incl. the hub's `manifest.json`; the manifest-as-authority is bypassed for undeclared root files | High (reproduced) | No (fix-later + test) |
| **D6** | Both items at the prefix root makes "public project page + private proposal" impossible: `mixedSourceError` throws; the wave records no such constraint | High (reproduced) | No (record) |
| **D7** | "Private" items live in a **public** repo; the PDF is world-readable and already published by Pages. The record never states private ≠ confidential | High | No (record/owner) |
| **D8** | The hub copies the committed root `main.pdf`, which no workflow keeps in sync with `proposal/main.tex`; it is weeks stale | High | No (fix or record) |

---

## Objections

### D1 — SEAM-C4's go-public path is wrong and fail-closed · BLOCK

**Claim.** SEAM-C4 says: *"Both items declare `visibility: private` and are **not** added to
`site/publish-allowlist.json` in this wave. … Turning them public is a later, owner-driven L0
allowlist edit (ADR-0016)."* The satellite handoff and the infra handoff repeat the same
one-file mental model. It is false. Effective visibility is a conjunction: an item is public
only when the **manifest says `public`** *and* the allowlist names it (`hub-content.mjs:479-482`).
These items' manifest says `private`. Therefore:

1. Adding `construction-ai/construction-ai-site` to the allowlist changes nothing —
   `effectiveVisibility(...)` still returns `"private"`; and
2. Adding it is itself a **hard build failure**: SEAM-B5 condition A
   (`findAllowlistConflicts`, `hub-content.mjs:495-510`) refuses any allowlist entry naming a
   `visibility: private` item, and `check-publish-allowlist.mjs` exits 1. The satellite handoff's
   *"nothing appears in the public index until an owner-driven allowlist edit"* tells the owner to
   do the one thing that breaks the hub build.

To publish, the owner must **also** edit the satellite `manifest.json` (flip both items to
`public`) and republish, then add the allowlist entries. That is a satellite change plus a hub
change, not a hub-only allowlist edit — and it means the go-public action is *not* entirely
under the hub's control, which is the opposite of the trust story ADR-0016 tells.

**Evidence (reproduced).**

```
$ node /tmp/opencode/probe5.mjs
effectiveVisibility(private item, allowlisted): private
conflicts: [ "the allowlist names (\"construction-ai\", \"construction-ai-site\"), but that
  item's manifest says visibility: private. ... Remove the entry, or ask the satellite to
  publish it as public." ]
```

Sources: `site/src/lib/hub-content.mjs:479-482,495-510`;
`site/scripts/check-publish-allowlist.mjs:9-13`; `site/publish-allowlist.json` (neither
`construction-ai` slug present); satellite `manifest.json:12,23`.

**Settling act.** Correct SEAM-C4, the satellite handoff and the infra handoff to state the
two-sided path (manifest `public` + allowlist), and record that an allowlist entry for a
`private` item fails the hub build. If the intended model really is "hub decides alone", the
manifest items must be authored `public` from the start (and allowed to sit private only via
the allowlist), not authored `private`.

**Why it blocks.** A documented operational step that fails the build (and a trust-direction
claim that is backwards) is a record defect of exactly the kind prior waves blocked on. No code
change is required if the record is corrected and the eventual path is stated honestly.

---

### D2 — Satellite-roster authority is stale; the promised ADR does not exist · BLOCK (record)

**Claim.** The control plane still describes a different roster than the one that exists, and
this wave adds a satellite without reconciling it:

- Design doc §2 (`:45-46`): `agentic-kg` is "Satellite #3", `construction-ai-proposal` is
  "Satellite #4". No amendment note (unlike the `cv` correction at `:43`, which carries one).
- Design doc §11 (`:381`): Phase 5 = *"`agentic-kg`, `construction-ai-proposal` as satellites"*.
- Governance delta §Related Repos (`:276-277`): lists `agentic-kg` as Satellite #3 and
  `construction-ai-proposal` as Satellite #4; it does not list `kgis`, `agentic-kg-research`,
  or `construction-ai`.
- Roadmap (`:380-381`): `agentic-kg` #3 (annotated as substituted by `kgis`); `construction-ai-proposal`
  as **#4**.
- The actual roster in `infra/variables.tf`: `cv`, `phd-milestones`, `kgis` (#3),
  `agentic-kg-research` (#4, added 2026-10-01), `construction-ai` (#5). Infra's own comments
  call this entry "Satellite 5".
- `agentic-kg-research` — the real #4 — appears **nowhere** in `llm/governance/` or
  `llm/specs/`; a grep of both returns nothing.

D4/D10 say the substitution/order is *"Recorded as an ADR amending design doc §2 and §11"*
(STATE `:487`; roadmap `:480`). No such ADR exists: the ADR index runs 0001–0018 and every
title is accounted for (`ls llm/governance/adr/`), and none concerns the satellite roster,
the `kgis` substitution, or the D10 order. The design doc is unamended. This is the same
class prior dissenters blocked on (Wave 3 D2; design doc §8 documents the failure verbatim:
*"an ADR that says it amends design authority has not amended anything until the edit is made,
and nothing mechanically checks the difference"*).

**Evidence.**

```
$ ls llm/governance/adr/
0000-template.md … 0018-gate-firestore-share-role-is-project-wide.md   # no roster ADR
$ grep -rn "agentic-kg-research" llm/governance/ llm/specs/            # (no output)
$ sed -n '45,46p' llm/specs/2026-09-10-research-hub-design.md
| `agentic-kg` | Jason | Satellite #3 … |
| `construction-ai-proposal` | Jason | Satellite #4: project page (public). |
```

**Settling act.** Write the missing ADR (amending §2, §11 and the delta's Related Repos for
D4/D10), then update §2, §11 and the delta. Record the source-key↔repo mapping (D4) in the
same place. After that, the roadmap's `#4` wording can be corrected to `#5` (or to "the next
satellite", keyed to the roster).

**Why it blocks.** The wave ships a fifth satellite while the authority says it is the fourth
and cannot name the real fourth. This is a source-of-truth defect, not a nit.

---

### D3 — Phase 5's acceptance demands a public project page; the wave ships private-only · BLOCK (exit claim)

**Claim.** The roadmap's `phase-5-satellites` scope and acceptance were not amended to match
the private-by-default decision, and they now contradict the wave and the roadmap's own
Checkpoint 6:

- Scope (`:381`): *"`construction-ai-proposal` as satellite #4, with a **public project page**
  (§2, §11)"*.
- Acceptance (`:387`): *"A change pushed to `construction-ai-proposal`, with no commit to
  `website`, updates its project page on `jason.cusati.us`"*.
- Checkpoint 6 (`:411-413`): *"a push to `construction-ai-proposal` updates its page **in the
  private build only**, since per the private-by-default decision its items are not
  allowlisted — so the live proof is a signed-in probe plus a signed-out probe that finds
  nothing."*
- SEAM-C4: both items `private`, **not** allowlisted; the public index/leak check carry no trace.

No public project page is delivered, and none can be by a satellite push: the projects index
lists only effectively-public items (`frame-content.mjs:418`; `projects/index.astro:35-38`),
and going public needs a `website` commit (the allowlist) — which contradicts the criterion's
"with no commit to `website`". The criterion as written is unsatisfiable under ADR-0016
regardless of this wave.

**Evidence (reproduced).**

```
$ node /tmp/opencode/probe3.mjs
allowlist entries: 14
projects items with current allowlist: []        # construction-ai absent from /projects/
projects items if BOTH new slugs were allowlisted: []   # still absent — manifest says private (D1)
```

Sources: roadmap `:381,:387,:411-413`; `frame-content.mjs:393-432`; `projects/index.astro:35-38`;
`site/dist-public` contains no `construction-ai` byte (grep empty); `site/dist-private` likewise
(the source has not published).

**Settling act.** Amend the roadmap scope/acceptance to the private-only reading Checkpoint 6
already records (or amend Checkpoint 6 to require an owner allowlist and drop "no commit to
`website`"), and state plainly that Wave 4 does not close the Phase 5 acceptance criterion for
`construction-ai` — only its publish and roster. A `roadmap-truth`-style verdict on the two
lines is the natural home.

**Why it blocks the exit.** A checkpoint that records "Phase 5 acceptance criteria verified"
against `:387` would be false. The wave may merge; the phase may not be declared closed on
these criteria without the amendment.

---

### D4 — The source key is bent to an internal service-account limit, unmapped and unjustified · Record / ADR

**Claim.** SEAM-C1 picks `source: construction-ai` because `publish-construction-ai-proposal`
would be 32 characters and a GCP service-account id is at most 30. The arithmetic is right
(confirmed: 8 + 24 = 32), and `infra/variables.tf:238` enforces `length(source) <= 22`. But
the seam fixes the *public* contract identifier to an *internal resource-naming* constraint
and inverts the dependency:

- The manifest schema allows `source` up to 39 characters
  (`contract/manifest.schema.json:17`), so `construction-ai-proposal` is contract-valid. The
  hub contract is not the binding constraint; the SA id is.
- The source name is the satellite's public handle: bucket prefix, manifest `source`, allowlist
  key, future `EXPECTED_SOURCES` entry, and the docs a satellite author reads. The SA id is
  hub-internal. A cleaner design would keep `source = construction-ai-proposal` and let the
  **SA id** differ (a `service_account_id` override, or a derived short name) — a one-field
  change in `infra/satellites.tf`.
- No artifact records the mapping from `sources/construction-ai/` to
  `djjay0131/construction-ai-proposal` except a comment in `infra/variables.tf`. A hub operator
  allowlisting `construction-ai/...`, or a reader of the manifest, has no machine-readable link
  to the repository.
- SEAM-C1 cites `kgis` (for repo `agentic-kgis`) as precedent, but `kgis` was a **repo
  substitution** under D4/D10, not a length truncation. It does not govern this case; the
  length rule is new and will recur for any repo name > 22 characters.

**Evidence.** `infra/variables.tf:238-240,246-248`; `contract/manifest.schema.json:14-18`;
`python3 -c` arithmetic above; `grep -rn "construction-ai-proposal" infra/` → only
`variables.tf` (repository field) and `README.md`; no ADR.

**Settling act.** One of: (a) add a `service_account_id` override field so `source` stays
faithful to the repo name; or (b) write an ADR recording "source key ≠ repo name; the key is
chosen to satisfy `publish-<key> <= 30`, the mapping lives in `infra/variables.tf`", plus the
key↔repo mapping in the roster record (folds into D2's ADR). Non-blocking, but the design
flaw should not ship unrecorded.

---

### D5 — Prefix-root `html` staging republishes the hub's own manifest and undeclared root files · Fix later + test

**Claim.** The `html` item's `path` is `index.html`, i.e. the source prefix root, so
`stagingPlanFor` treats it as a built site and stages the **whole prefix subtree** with the
withdrawn-document filter disabled (`frame-content.mjs:163-179,186`). In the synced tree the
prefix root also holds the hub's `manifest.json` (the hub syncs all `sources/**` objects). So
once the item is allowlisted, the public payload will contain `_payload/construction-ai/manifest.json`
and any other file the satellite drops at its dist root, whether or not the manifest names it.
That bypasses the schema's own statement that *"The manifest is the authority on what exists"*
and ADR-0010 decision 1. The leak check will not name these: its needles are declared **private**
items (`check-no-private-in-public.mjs:139-173`), not undeclared files.

`kgis` already ships a root `index.html` (its fixture manifest: `path: "index.html"`), so this is
pre-existing; `construction-ai` adds a **second** root item (`main.pdf`), making the two-item
root the live case. This is Wave 1 D2's ADR candidate ("declare the asset/document set") arriving
on the roadmap.

**Evidence (reproduced).**

```
$ node /tmp/opencode/probe2.mjs
real synced prefix files: [ 'index.html', 'main.pdf', 'manifest.json' ]
stagingPlanFor (HTML item at root) stages the WHOLE prefix:
[ '_payload/construction-ai/index.html',
  '_payload/construction-ai/main.pdf',
  '_payload/construction-ai/manifest.json' ]
```

**Settling test.** A fixture source with a root-level `format: html` item plus an undeclared
root file; assert `stagingPlanFor` omits the undeclared file, or that the manifest declares its
asset set. Fails today. Non-blocking while both items stay private (nothing is staged), but it
becomes a published-output property the moment the item is allowlisted.

---

### D6 — Both items at the prefix root makes "public page + private PDF" impossible · Record

**Claim.** SEAM-C2 puts `main.pdf` and `index.html` at the prefix root. The design/roadmap
word is a public **project page**; the natural owner action is to publish the page and keep the
proposal PDF private. That action is impossible without restructuring, because
`mixedSourceError` fires on a source with a private item *and* a public root-framed item and
the public build throws (`public-build.mjs:38-60,114-119`). The owner's only options are
"both public", "both private", or "move the html into a named subdirectory / split the source".
The wave records none of this; SEAM-C4 presents "both items" as one privacy unit but does not
say the unit is forced by the staging model.

**Evidence (reproduced).**

```
$ node /tmp/opencode/probe2.mjs
mixedSourceError: both private (current): null
mixedSourceError: html public, pdf private:
"source \"construction-ai\" mixes visibility: it has a private item AND a public html/bundle
 item whose path sits at the prefix root (e.g. \"index.html\"), which stages the WHOLE source
 prefix into the public build. … Fail closed: give the framed item a declared asset set, give
 it a named subdirectory, or split the source …"
```

**Settling act.** Record in SEAM-C4/Satellite handoff that the prefix-root layout forces the two
items to share visibility (or requires a named subdirectory). If the owner wants an independent
"public page, private PDF", the satellite should move `index.html` under a named folder now,
before first publish, so the later allowlist is a real choice. Non-blocking, but it changes what
the owner can do and is currently undocumented.

---

### D7 — "Private" is a hub-rendering label over a public repository · Record / owner

**Claim.** Both items are declared `visibility: private`, and the records speak of the private
boundary, but the source repository is public (`infra-wave-4.md`: `private:false`, read live),
`main.pdf` and `manifest.json` are committed there, and the pre-existing
`build-and-publish-pdf.yml` deploys the same proposal to GitHub Pages at
`https://djjay0131.github.io/construction-ai-proposal/` and a Release. "Private" here means
*not on the hub's public site until allowlisted*, not *confidential*. A reader of the manifest,
the roadmap's "private" language, or ADR-0016 could infer confidentiality that does not hold.

The **hub's** boundary does hold: `site/dist-public` contains no `construction-ai` byte
(verified), and the leak check would catch a staged private item. The issue is semantics and
expectation, not a hub leak.

**Evidence.** `infra-wave-4.md:81-83` (`private:false`); satellite `manifest.json` items
`visibility: private`; `build-and-publish-pdf.yml` Pages/Release steps; `git ls-files` shows
`main.pdf` committed; `grep -rl construction-ai site/dist-public` empty.

**Settling act.** Ask the owner whether the proposal is confidential. If it is, the current
setup is wrong before the hub is in the picture (the public repo and Pages site are the
exposure) and the wave should not describe it as private. If it is merely "not-yet-published",
record that "private = not on the public hub", and note the Pages workflow still publishes it.
Non-blocking for the hub, but the record must not imply secrecy.

---

### D8 — The hub serves a stale committed `main.pdf` that no workflow refreshes · Fix or record

**Claim.** `publish-hub.yml` copies the committed **root** `main.pdf`. The repo's build
workflow, `build-and-publish-pdf.yml`, compiles `proposal/main.tex` and copies the result to
`proposal/…`, `public/…` and a Release — it never writes the root `main.pdf`. So the root copy
is a manual snapshot and has drifted: it was last committed 2026-01-18, while
`proposal/main.tex` last changed 2026-02-28. The hub will publish a proposal PDF older than the
proposal source. The satellite handoff calls this "pre-existing"; it becomes user-visible to
the hub only now.

**Evidence.**

```
$ git log -1 --format='%ci %h %s' -- main.pdf        # 2026-01-18 fa7a3c3
$ git log -1 --format='%ci %h %s' -- proposal/main.tex  # 2026-02-28 7982f9e
$ ls proposal/main.pdf                                # absent — built in CI, never committed
```

**Settling test.** Build `proposal/main.tex` and diff the PDF against root `main.pdf`; or
compare root `main.pdf` bytes to the latest Pages artifact. **Settling act.** Have
`publish-hub.yml` rebuild `proposal/main.tex` (as the other workflow already does) and copy
that into the dist, or have the build workflow commit the root `main.pdf`. Non-blocking, but
the hub should not launch serving a stale artifact.

---

## Assumptions

- "The wave" is hub HEAD `834465f` on `feat/construction-ai` and satellite HEAD `5201b47` on
  `feat/hub-publish`. The hub working tree was clean for tracked files when I began and
  finished; I created no tracked-file change (my handoff is a new untracked file). Other
  wave-4 agents may have been writing their own handoffs concurrently; I read none of them.
- D1's probes use the **real** hub modules (`hub-content.mjs`, `frame-content.mjs`,
  `public-build.mjs`) and a throwaway `/tmp/opencode` synced tree containing exactly the
  satellite's dist (`index.html`, `main.pdf`, `manifest.json`); the allowlist is the committed
  `site/publish-allowlist.json`.
- The live publish has not happened and the identity is not applied in this wave, so the
  Boundary Tester's prefix proof is out of scope here; I did not touch cloud.
- I did not weigh the red team / security / boundary / skeptic findings; this is an independent
  read.

## Recommendations

1. **D1 (block):** correct SEAM-C4, the satellite handoff and the infra handoff — go-public is
   `manifest → public` **plus** `allowlist entry`, and an allowlist entry on a `private` item
   fails the build. State it as the two-sided step it is.
2. **D2 (block, record):** write the D4/D10 ADR, amend design doc §2/§11 and the governance
   delta's Related Repos, correct the roadmap's "#4" to the real roster, and record the
   source-key↔repo mapping.
3. **D3 (block the exit claim):** amend the roadmap scope/acceptance to the private-only
   reading, or amend Checkpoint 6; record that Wave 4 does not close `:387` for
   `construction-ai`.
4. **D4:** decouple the source key from the SA id, or write the truncation ADR + mapping.
5. **D5:** add the undeclared-root-file staging test; carry Wave 1 D2's "declare the asset set"
   ADR candidate forward.
6. **D6:** record the forced shared-visibility constraint, and let the owner choose a named
   subdirectory before first publish if an independent "public page, private PDF" is wanted.
7. **D7:** get the owner's confidentiality call and make the record state "private = not on the
   public hub".
8. **D8:** rebuild `proposal/main.tex` in `publish-hub.yml`, or commit the root `main.pdf` from
   the build workflow.

## Alternatives considered

- **Not blocking on D1 (treat it as doc wording).** Rejected: the wording is the operational
  instruction, and following it fails the build and inverts the trust story the wave rests on.
- **Treating D2 as pre-existing and out of scope.** Rejected: D10's `agentic-kg-research`
  landed 2026-10-01 and this wave is the first to add a satellite since; the wave's own records
  use "#5", so it cannot ship without the roster authority it contradicts.
- **Blocking on D5/D6 (prefix-root staging/mixed visibility).** Rejected as blockers: both are
  inert while the items stay private, and D6 is fail-closed. Requiring the record and the test
  is proportionate; the ADR candidate already exists from Wave 1.
- **Blocking on D7 (public repo).** Rejected: the hub boundary verified clean and the exposure
  (public repo, Pages) predates the wave. The defect is the unstated meaning of "private".

## Risks

- **High (record):** the documented go-public step fails the hub build and misstates who decides
  publication (D1); the roster authority and its promised ADR are missing while a fifth satellite
  ships (D2); Phase 5's acceptance cannot be met and the roadmap contradicts itself (D3).
- **Medium (future):** the source key will diverge from the repo for every >22-char name, with no
  mapping or ADR (D4).
- **Medium (on allowlist):** the public payload will contain the hub's `manifest.json` and any
  undeclared root file (D5); the owner cannot publish the page without the PDF (D6).
- **Low/Medium:** "private" may be read as confidential when the repo and Pages are public (D7);
  the hub may serve a stale `main.pdf` (D8).

## Open questions

- Does the owner want the proposal PDF public at all, or only the generated project page? (D3,
  D6, D7.)
- Is `construction-ai` meant to be a permanent source key, or a truncated alias? (D4.)
- Which authority governs when roadmap scope/acceptance and the phase's Checkpoint disagree —
  the checkpoint, the scope, or an owner amendment? (D3.)
- Should the root `main.pdf` be rebuilt at publish time rather than copied? (D8.)

## Related docs

- `llm/sprints/2026-09-hub/contracts/dissenter-wave-4.md`
- `llm/sprints/2026-09-hub/contracts/phase-5-seams.md` (SEAM-C1…C6)
- `llm/sprints/2026-09-hub/handoffs/{infra,satellite-construction}-wave-4.md`
- `llm/master-roadmap.md` §`phase-5-satellites` (`:365-418`, esp. `:381,:387,:411-413`)
- `llm/specs/2026-09-10-research-hub-design.md` §2 (`:38-51`), §4 (`:86-156`), §11 (`:372-382`),
  §12 (`:384-396`)
- `llm/governance/adr/0016-private-by-default-publish-allowlist.md`; `llm/governance/adr/0007`,
  `0010`
- `llm/governance/governance-delta.md` §Related Repos (`:265-278`)
- `contract/manifest.schema.json`, `contract/validate-manifest.mjs`
- `infra/variables.tf` (`satellites`), `infra/satellites.tf`
- `site/src/lib/hub-content.mjs`, `site/src/lib/frame-content.mjs`,
  `site/scripts/public-build.mjs`, `site/scripts/check-publish-allowlist.mjs`,
  `site/scripts/check-no-private-in-public.mjs`, `site/src/pages/projects/index.astro`,
  `site/publish-allowlist.json`
- `djjay0131/construction-ai-proposal`: `manifest.json`, `.github/workflows/publish-hub.yml`,
  `.github/workflows/build-and-publish-pdf.yml`, `tools/build-site.mjs`, `README.md`, `main.pdf`

## ADR candidates

- **Source key and service-account id are independent.** The manifest `source` is a public
  contract identifier; the SA id is internal. Derive or override the SA id so a repo name need
  not be truncated, and record the key↔repo mapping when they differ (D4; folds into D2's ADR).
- **The satellite roster is amended in the authority when it changes.** Writing `agentic-kgis`
  / `agentic-kg-research` / `construction-ai` into `infra/` without amending design §2/§11 and
  the delta repeats the §8 failure; the D4/D10 ADR must exist (D2).
- **Going public is two-sided and the record must say so.** `visibility` is the satellite's
  request; the allowlist is the hub's decision; an entry on a `private` item fails the build.
  No "allowlist alone" language (D1).
- **A prefix-root framed item may not republish undeclared root files.** Extend Wave 1 D2's
  "declare the asset/document set" candidate: the manifest should name every served document,
  or root framing should be disallowed (D5).
