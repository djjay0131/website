# Handoff: Chief Reviewer — Phase 3 (Private area) and the Governance Audit across Phases 0–3

Status: Delivered
Last updated: 2026-09-17
Owner: Chief Reviewer (persisted verbatim by the Lead Architect, per STATE A8)

The report below is the Chief Reviewer's deliverable, persisted **verbatim**. The Lead
Architect's dispositions are recorded separately in `llm/sprints/2026-09-hub/STATE.md`
under the Phase 3 review dispositions section; nothing in this file has been edited to
reflect them.

---

# Chief Reviewer — Phase 3 (Private area), PR #25, and the Governance Audit across Phases 0–3

**Reviewer:** Chief Reviewer · **Date:** 2026-09-17 · **Branch:** `feat/private-area` @ `28c6dc1` · **Satellite:** `djjay0131/phd-milestones` @ `feat/publish-contract` (`433057a`)
**Verdict: Request changes** — two blocking items, both documentary, both minutes of work. **No security property is blocking.**

**How I worked.** I verified from code and configuration, not from the ADRs or the handoffs, all of which assert the conclusions. Where I could execute something, I executed it: the public build, the private build, the leak check on a clean build, the deliberate failing demonstration, the destructive sync against a local destination (including a real withdrawal), the gate's 204-test suite on Python 3.12, `npm test`, `terraform fmt -check`/`validate` and `actionlint` in their containers, and the credential-free private-bucket check. Results are quoted below.

**What I could not verify.** `gh` is not on this machine's PATH. I could not read PR #25's body, labels or draft state; issues #24 and #26; the `delete_branch_on_merge` setting; the PR-to-branch mapping the stale-branch check requires; or whether `phd-milestones` is private on GitHub. Each is named at the point it matters. No cloud resource was created, changed or read.

---

## Part A — Is private material actually private?

**A1. No private item reaches `dist-public`; the leak check greps contents as well as paths; the failing demonstration exists and actually fails. — PASS, verified by execution.**

`site/scripts/check-no-private-in-public.mjs:265–317` walks every file under `dist-public` and matches in two passes: path segments (lines 275–292) and file contents (lines 294–314). Needle kinds are declared at `:157–179` — qualified-id, route, payload-path, source, slug, title, summary, each title/summary also HTML-escaped. That is materially wider than design doc §5's "greps `public/` for any private slug", and it is the right call: a private title rendered into a public index is a leak with no matching path.

I ran it. On a clean build with the fixture's two private items loaded:

```
check:no-private-in-public: 2 private item(s) to look for in dist-public
PASS — no private slug, source, route, payload path, title or summary appears
in any path or any file's contents under dist-public (155 files scanned).
```

Then the deliberate failing run, `npm run demo:leak-check`:

```
9 LEAK(S) of private content into .../dist-public
  index.html  contents: qualified-id …  slug …  route …  source …  title …
  phd/phd-milestones/milestones/index.html  path: slug …  path: source …
the check exited 1 (1 means it caught the leak)
demo:leak-check: PASS
```

**Five of the nine hits are content-only, in `index.html`, with no matching path at all.** That is the class a path-only check misses, and it is the disagreement ADR-0005 settled against orchestration brief §4 (K11) on reasoning alone. It now has evidence I generated myself, not a handoff assertion.

Two properties I checked specifically because they are where this kind of guard usually fails:

- **It does not cry wolf.** The bare slug and source are matched only when delimiter-bounded on both sides (`:198–215`). The live public page `/research/soa-agentic-se/agentic-memory/sources/` contains the word "milestones" in ordinary prose, and the real private slug is `milestones`. A naive substring search would fail every clean build, and a guard that fails clean builds is switched off within a week. My clean run above used the *real* slugs and passed — empirical proof the bounding works.
- **It says so when it proves nothing.** With no private items published the run prints "this run proves nothing" and exits 0 (`:368–376`) rather than a reassuring PASS. That is the correct shape.

Stated limits (`:66–73`) are honest and complete: binary files are matched by path only, so a private title baked into an OG image would pass; private text quoted without its slug, title or summary would pass. ADR-0005's Risks asked for exactly this to be written down in Phase 3, and it has been.

**A2. No public page lists, links or names a private item; private navigation cannot reach the public build by construction. — PASS, and the construction is genuinely structural.**

`site/astro.config.mjs:48` sets `srcDir: isPrivate ? './src-private' : './src'`. Astro routes exactly one directory, `<srcDir>/pages`, so the public build is never shown `src-private/pages/**`. This is not a filter that someone must remember to apply; the router is never given the files. `site/scripts/private-structure.test.ts` pins both halves — the arrangement itself (`:53–83`) and, more importantly, the **module-graph** half (`:85–105`): no file the public build compiles may import `src-private/`, `private-content`, `private-build` or `PrivateBase`. Without that second half a public page could pull private titles in through an import rather than through the router.

I confirmed independently that **no page under `site/src/` calls `getCollection` or `getEntry` at all** — grep returns nothing. The public site does not read the content collection, so there is no filter to get wrong. `site/src/pages/phd/index.astro` is an empty section shell, noindex, out of the sitemap and unlinked from navigation. `site/src/pages/signin/index.astro` reads no collection and names nothing (asserted at `private-structure.test.ts:107–114`).

The site stream's own most valuable find is in `site/src/lib/hub-content.mjs:103–109`. `publicAssetPathFor()` now tests `item?.visibility !== "public"` **first**. Previously it returned non-null only for `source === "cv" && format === "pdf"`, so a private item could not be staged into `site/public/` — but only as a side effect of which satellites happened to exist. The guarantee depended on a fact that stopped being true the moment `phd-milestones` was added. Asking the visibility question directly is the correct fix and I would have raised it had they not.

**A3. The private bucket carries exactly two principals and no others. — PASS in configuration; the live half is a Checkpoint 4 obligation, and one claim about it is currently false (see SHOULD-FIX 2).**

`infra/private-bucket.tf:79–81`: `uniform_bucket_level_access = true`, `public_access_prevention = "enforced"`, `force_destroy = false`, plus versioning, a 7-day soft delete and three lifecycle rules that touch `ARCHIVED` state only. UBLA is the setting that fails **open** — without it every IAM condition in the module is inert and object ACLs return, with nothing erroring anywhere — and it is present, commented as such, and asserted mechanically.

The two bindings, `:193–214`, use custom roles rather than predefined ones, and the permission lists in `infra/private-roles.tf` are exactly:

| Principal | Role | Permissions |
|---|---|---|
| `hub-gate` runtime SA | `privateObjectReader` (`:49–69`) | `storage.objects.get` — and nothing else |
| `hub-deploy` | `privateSyncWriter` (`:120–140`) | `create`, `delete`, `get`, `list`, on this bucket only |

**Not `roles/storage.objectViewer` for the gate.** That is the single most important line in the infra stream's work and it is correct: `objectViewer` carries `storage.objects.list`, and in this bucket the object names *are* private material — they disclose before a byte is read. This is ADR-0007 decision 4's reasoning applied where the consequence is worst. The gate's code matches: `gate/app/serve.py:150–173` uses `client.bucket(...)` and `get_blob(name)` and never enumerates; the comment at `:145–147` notes `bucket()` constructs a reference without a metadata read, so the identity needs no `storage.buckets.get` either.

**On the closed question.** The contract told me not to re-litigate whether `hub-deploy` may hold `list`, but to judge whether the resolution is right. **It is right.** The reasoning that convinces me is not the one most often given. It is not that `hub-deploy` already reads the private source bytes under `sources/phd-milestones/` — true, but that is an argument about what is *already* lost, not about what is *correct*. It is that the replacement invariant is strictly stronger as a test. "No reader other than X" is a negative over an open set and is unfalsifiable by inspection; "exactly these two members in exactly these two roles, and nothing else" is an equality, and an equality catches a *third* binding that the negative formulation would have to be rewritten to notice. `infra/scripts/check_private_bucket_config.py:91–109` implements precisely that equality against the Terraform, and `infra/scripts/check-private-bucket-iam.sh:118–131` implements it against the live policy. The roadmap criterion and SEAM-1 were amended to match; ADR-0010 stands. That is the right direction of amendment.

I ran the credential-free half:

```
$ python3 infra/scripts/check_private_bucket_config.py
OK: private bucket declares uniform bucket-level access and enforced public access
prevention, names no anonymous principal, and carries exactly two bindings --
the gate (storage.objects.get) and the hub's sync (create/delete/get/list).   exit 0
```

And `terraform fmt -check -recursive` → exit 0; `terraform validate` → `Success! The configuration is valid.`

Two residuals, both correctly surfaced by the infra stream rather than hidden:

- **Project-level `legacyObjectReader` is granted to `projectViewer` automatically by Cloud Storage on every bucket.** Any principal with project Viewer can read every private object. Today that is only the owner. This was accepted at Checkpoint 3 for public content; on a bucket holding the committee dossier it needs an explicit owner decision. `check-private-bucket-iam.sh:134–143` **prints** these rather than filtering them away, which is the right handling.
- **A withdrawn item's bytes survive as noncurrent generations for up to 30 days.** The gate addresses objects by name and never by generation, so a withdrawn path 404s — but the bytes are recoverable by the owner. That is the deliberate trade ADR-0010's Risks require (a destructive sync needs a recovery path). It is documented at `infra/private-bucket.tf:116–125`. It should be an owner decision, not a discovery.

**A4. The gate refuses signed-out and non-member requests, including on the direct `*.run.app` URL. — PASS, and this is the best-tested property in the phase.**

The invoker is `allUsers` by design (`infra/gate.tf:257–263`), correctly, with a comment telling future readers not to "fix" it. The proof that every check holds on a direct request is `gate/tests/conftest.py:164–180`: a `transport` fixture parameterised `["hosting", "direct"]` runs **every** authorisation test twice, and the `hosting` variant strips every cookie except `__session` exactly as Firebase Hosting does. A gate that named its cookie anything else would pass every `direct` case and fail every `hosting` one — the ADR-0004 failure made visible in CI instead of at Checkpoint 4.

Ordering in `gate/app/main.py:221–264` is right and it matters: identity → membership → path validation → bucket. An unauthenticated caller never reaches the path validator and never causes a bucket lookup, and the tests assert `store.fetches == []` to prove it (`test_serve.py:37, 63, 82, 91, 98`; `test_paths.py:100`). `test_serve.py:47–54` and `:66–72` byte-compare the refusal for a real path against an imaginary one — so the refusal cannot be used as an existence oracle. `test_serve.py:101–111` confirms a valid session under a different cookie name is refused when sent directly.

I ran the suite:

```
$ uv run --python 3.12 --with-requirements requirements-dev.txt --no-project pytest -q
204 passed  (2 third-party deprecation warnings)
```

`.github/workflows/gate.yml:208–216` additionally curls the deployed revision's `*.run.app` URL on every deploy and fails if a signed-out `/p/` returns 200 — the roadmap's direct-URL criterion asserted continuously rather than once at a checkpoint. That is better than the criterion asks for.

**A5. Every `/p/**` response carries `Cache-Control: private, no-store`; none carries `public` or `s-maxage`. — PASS.**

`gate/app/main.py:116–124` applies the header in middleware **after** the route has run, so no framework or file-serving default can leave a cacheable header behind. That placement is the whole defence, and the placement is correct. `gate/tests/test_headers.py:43–61` asserts it across seven outcome classes — served, signed-out, non-member, expired, traversal, missing object, asset — and separately asserts the absence of `public` and `s-maxage` rather than only the presence of the right string. `Vary: Cookie`, `nosniff`, `Referrer-Policy: no-referrer` and `X-Frame-Options: DENY` are set alongside.

**A6. The session cookie is named `__session`. — PASS.**

`gate/app/config.py:20` — a module constant, deliberately **not** environment-configurable, with the reason in the comment: an env var would make it possible to deploy a gate that passes every direct test and fails only through Hosting. `test_session.py:26–38` asserts both the constant and the emitted `Set-Cookie` prefix; `:41–52` asserts `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/` and `Max-Age=1209600`.

**A7. No private slug, path or title in any log line, error body or stack trace returned to an unauthenticated caller. — PASS.**

Every body the gate can return is a static constant in `gate/app/pages.py`; none echoes a path, a request body or an exception message. Three handlers replace framework defaults (`main.py:131–148`), including `RequestValidationError` — FastAPI's default 422 body includes the offending input, which for `POST /session` would be an ID token, and `:137–142` replaces it wholesale. `test_session.py:111–121` proves a token-shaped string in malformed JSON is not echoed. `test_serve.py:53–64` proves an exception's message and traceback never reach the caller. `_log_path` (`main.py:85–93`) keeps object paths out of logs unless deliberately enabled, because an object path under `/p/**` *is* a private slug and Cloud Logging has a wider audience than the allowlist.

One thing to record, not a failure of A7: the gate **does** log the email address of anyone who signs in and is refused (`main.py:194`) and of every member access (`:215`, `:257`). That is authenticated-caller data, not a private-slug leak, and it is exactly STATE's open C31 — whether any record of who read what should exist at all, given the material. It is a privacy decision, not an engineering one, and it belongs to the owner.

**Part A conclusion: none of A1–A7 fails. Nothing in Part A is blocking.**

---

## Part B — The satellite boundary, now that it guards something private

**PASS on everything verifiable without cloud access, and the boundary generalised rather than being special-cased for `cv`.**

The strongest evidence is the shape of the diff. `phd-milestones` was added as **one entry in `var.satellites`** (`infra/variables.tf:170–175`) and `infra/satellites.tf` **did not change by a character**. The `for_each` design from Phase 2 exists to make that true, and it did.

- **No `storage.objects.list` by any path.** `infra/satellite-role.tf` grants exactly `storage.objects.create`, `.delete`, `.get`. This is asserted mechanically on every run by `build.yml:363–390`, which parses the permission list and fails if it is not exactly those three. The satellite holds no project-level role: its only grant is the conditioned bucket binding at `satellites.tf:161–176`.
- **The prefix condition ends in a trailing slash.** `satellites.tf:173`: `resource.name.startsWith('projects/_/buckets/<bucket>/objects/sources/${each.key}/')`. The trailing slash is what stops a source named `cv-other` from matching `cv`, and Checkpoint 3 proved that empirically (probe 5 → 403).
- **Uniform bucket-level access is on for the content bucket.** `infra/storage.tf:87`, asserted by the same `build.yml` guard at `:369–376`. Without it every prefix condition is inert and the boundary fails open with no error anywhere.
- **The satellite holds no GitHub credential for the hub.** `phd-milestones/.github/workflows/publish.yml` declares `permissions: contents: read` at workflow level and adds only `id-token: write` on the publish job (`:42–47`). There is no `repository_dispatch`, no PAT, no `credentials_json`, and no key file. A grep across the satellite's workflows and docs returns only prose saying those things must not exist.
- **Admission is decided twice.** The provider condition (`satellites.tf:92–97`) pins `repository_id`, `repository_owner_id` and `repository` name, and refuses `pull_request_target`; the impersonation binding (`:132–138`) pins `repository_id/refs/heads/<default_branch>`. For `phd-milestones` that is `1373915518` and `main` — note `cv` is `master`, which is why the field is per-entry. A pull-request run carries `refs/pull/<n>/merge` and fails the second gate.
- **The satellite enforces its own visibility.** `phd-milestones/tools/generate-manifest.mjs:46` makes `VISIBILITY = "private"` a module constant, never a parameter, asserted on the way out by `assertPrivate()` (`:197–206`) and again by the test suite, which `publish.yml:64` and the satellite's own `ci.yml` both run. A public item from that repository fails in its own CI before any upload. That is the right place for the check — the hub's leak check is a backstop, not the satellite's permission to be careless.
- **The generator does not leak into CI logs.** `:277–285` prints slug, visibility, path and date, and deliberately never a title or any page text.

**One thing I cannot verify and the owner must confirm:** that `phd-milestones` is **private on GitHub**. It needs `gh`, which I do not have. Roadmap acceptance criterion 13 depends on it and the satellite's own handoff asks for it to be confirmed rather than assumed. If it is public, everything above is irrelevant — the material is simply published.

**Also unverifiable here:** the recorded prefix-boundary test for `phd-milestones` (criterion 13's second half). The Phase 2 procedure in `infra/README.md` and the infra handoff extends to it correctly, including the reverse leg run **as `cv`** — the direction where a defect would let a public satellite reach private source material. That leg did not exist at Checkpoint 3 because there was no private prefix to reach. It must be run at Checkpoint 4.

---

## Part C — Withdrawal (ADR-0010), which is new and sharp

I did not take this one on the handoffs. I executed it.

**Is it gated so it cannot run on an empty or unvalidated build? — YES, at four independent layers, and I tripped three of them deliberately.**

`site/scripts/sync-private.mjs:101–160` implements six preconditions, each a refusal rather than a warning. The one that carries ADR-0010 decision 3 is **P2, the build receipt**: `site/scripts/private-build.mjs:119–138` writes `.hub-private-build.json` **last**, after payload staging and after the SD-7 path check, so its presence is proof the build reached the end rather than an assumption that it did. A build that throws leaves no receipt, and a sync that finds no receipt deletes nothing.

Executed, against a local destination:

```
P2  (receipt removed)  → "P2 FAILED: … carries no build receipt … ADR-0010 decision 3
                          requires the build to have succeeded before anything is deleted;
                          this is that gate."   nothing deleted
P6  (build producing 1 file vs 80 at destination)
                       → "P6 FAILED: this sync would delete 79 of 80 object(s) (98.8%),
                          which exceeds the ceiling of 34.0%"   nothing deleted
                          destination file count after the refused sync: 80
```

P6, the deletion ceiling, is the site stream's own answer to "what else, before it deletes", and it is a good one. Withdrawing one item deletes a handful of objects; a build defect deletes nearly all of them, and **proportion is the only signal in this system that separates the two**. Two further properties are right: the sync is **dry-run by default** (`:307–313`), and it **uploads before deleting** (`:315–319`), so an interrupted run leaves the destination a superset of the truth rather than a subset — a stale extra object is a bug, a missing one is an outage.

At the workflow level, `private-sync` (`build.yml:877`) `needs: build-firebase`, so it cannot start unless the content synced, every manifest validated, the expected-source check passed, both builds succeeded and the leak check passed. It also runs the dry run first as a separate step (`:919–923`) so every intended deletion is in the log before anything is removed.

**Is the empty-items vs missing-manifest distinction implemented as decided? — YES.**

`site/src/content.config.ts:113–119` throws `HubContentError` when a source's prefix holds objects but no `manifest.json`. An empty `items` array parses cleanly and simply renders nothing. The two states stay distinguishable at the fingerprint level too: `build.yml:177–188` falls back only when the bucket fingerprint is literally `empty` — no objects at all — while a vanished manifest leaves objects behind and still fails.

**Does a withdrawn private item actually stop being readable rather than merely stop being linked? — YES. I withdrew one and watched it disappear.**

I dropped `committee-dossier` from the synced manifest (the gitignored copy; the tracked fixture was untouched and the tree is clean), rebuilt, and re-synced into the already-populated destination:

```
build:private → staged 2 payload file(s) for 1 private item(s)
                receipt: privateItemCount 1, fileCount 78
  route  dist-private/phd/phd-milestones/committee-dossier/  → gone
  payload dist-private/_payload/.../site/committee.html      → gone
  sibling dist-private/_payload/.../site/assets/style.css    → correctly KEPT

sync → 78 object(s) to upload, 2 to DELETE
       DELETE _payload/phd-milestones/site/committee.html
       DELETE phd/phd-milestones/committee-dossier/index.html
  withdrawn page at its old path → deleted
  withdrawn payload             → deleted
```

That is ADR-0010 decision 5 doing exactly what it claims, end to end. The subtle part is `site/src-private/lib/private-content.mjs:121–164`: staging takes the item's **containing directory** (because an HTML page is not self-contained — these two load a sibling stylesheet) but **excludes any `.html` file no surviving item declares**. Without that exclusion a plain directory copy would re-publish the very document someone withdrew, since a satellite cannot prune its own prefix. The stated residual — a withdrawn item's non-document assets are not distinguishable from shared ones and are still staged — is real, correctly scoped (they carry no item prose), and correctly logged as an ADR candidate.

**Is the expected-source set real? — YES, but its protection is currently switched off for the source that needs it.**

`findMissingExpectedSources` (`site/src/lib/hub-content.mjs:197–210`) is genuinely wired: `content.config.ts:339–344` calls it inside `loadSources()` and throws. `EXPECTED_SOURCES` (`:171–188`) declares `cv` as `required: true` and `phd-milestones` as `required: false`.

The `required` flag is the right fix. ADR-0010 decision 4 taken literally would fail **every** build from the day it landed, because a source must be declared before it can publish and `phd-milestones` cannot publish until Checkpoint 4. A guard that fails every build is deleted within a day. But be clear about what follows: **until someone flips that flag, C27 is not closed for the only source it was written for.** The protection against "the private source's whole prefix vanished" is inert exactly where it matters. The flip is marked with a `>>> CHECKPOINT 4 ACTION` banner in the source and recorded in STATE, and that is about as much as code can do — but it is a single un-enforced checklist item guarding a silent failure, and it belongs on the Checkpoint 4 list in the owner's hands, not only in a comment.

**The gap you asked me to judge: the bucket driver has never been executed.**

`sync-private.mjs:223–277` carries its own warning: "this path has NEVER been run." That is accurate and correctly disclosed. What it means for confidence in ADR-0010 decision 5 — the one place a build defect can delete data — is this, precisely:

**Every decision is verified; the transport is not.** The split in that file is deliberate and it is the right split. `assertBuildIsSyncable`, `planSync` and `checkDeletionCeiling` — which decide *whether* to delete and *what* to delete — are driver-independent pure functions, and I executed all of them, including the refusals. The two drivers differ only in how they list, put and delete. So the residual risk is **not** "the sync might decide to delete the wrong thing". It is narrower and it is one-directional in a useful way:

- `list()` (`:236–252`) paginates via `nextPageToken` and filters directory-placeholder names. **If it under-reports** — a pagination bug, a transient partial page — the plan simply deletes less than it should: a stale object survives. Bad, not catastrophic.
- **The dangerous failure would be `list()` over-reporting**, and it structurally cannot: it returns only names the API gave it, and every name absent from the source set becomes a delete. There is no path by which it invents an object.
- `remove()` (`:267–275`) treats 404 as success, which is correct for an idempotent prune.
- The realistic first-run failures are therefore **loud**: a 403 (the role is wrong), a 401 (the token did not mint), or a malformed URL — each raises `PrivateSyncError` and fails the job. None of them silently deletes.

So my confidence in decision 5 is **high on the decision logic and moderate on first execution**, and the mitigations that matter are already in place: versioning, a 7-day soft delete, 30-day noncurrent retention, and the dry-run step that prints every intended deletion to the log *before* the apply step runs.

**The check the owner should run at Checkpoint 4, in this order:** after the first successful `private-sync`, read the job log's dry-run output and confirm the delete list is empty on a first publish into an empty bucket; then withdraw one item deliberately in `phd-milestones`, let it publish, and confirm the *next* run's dry run names exactly that item's objects and no others **before** the apply step touches anything. That single exercise converts the unexercised HTTP from an assumption into evidence, and it is cheap because the bucket will hold almost nothing at that point. Do not skip straight to trusting it on a full bucket.

---

## Part D — Scope and phase boundary

**PASS.**

- **No shares, no `/s/**`, no `/share/**`.** `gate/tests/test_scope.py:19–22` asserts the declared route set is exactly `{"/session", "/p/{path:path}", "/healthz"}` and fails if a share route appears — including as a stub. `:25–42` confirms `/s/…`, `/share`, `/members` and `/admin` all 404. Absent rather than stubbed is the right choice: a half-built share route that answers at all is a way to reach private bytes without a session.
- **No member-management interface, no search.** Confirmed by the same route assertion and by `gate/app/members.py`, which contains no write of any kind — only `.document(key).get()`.
- **The public site's behaviour is unchanged from Phase 2.** My own public build produced 26 pages; `npm test` → **177 passed, 1 skipped, 14 files**; `check:smoke-routes` unchanged; the sitemap excludes `/signin/` (`site/scripts/site-routes.mjs:16` adds `signin` to `NOINDEX_SECTIONS`, keeping `sitemap-index.xml` byte-identical to Phase 2). The only added route is `/signin/`, which is public by design and names nothing.
- **`firebase.json` carries no `/p/**` or `/session` rewrites.** Verified directly — the file contains only `hosting.public`, `ignore`, `cleanUrls`, `trailingSlash` and two security headers. This is correct and important: Hosting rejects a configuration naming a Cloud Run service that does not exist, so merging with them would break the **public** deploy, not merely the private area.
- **The follow-up is recorded** in four places: STATE §Follow-ups ("firebase.json rewrites are deliberately absent from this PR"), `contracts/site-phase-3.md:105–109`, `infra/outputs.tf:178–180` (`gate_service_name`'s description), and a `>>> NOT YET WIRED` banner in `site/src/pages/signin/index.astro:26–31`. That is more than adequate traceability.

One scope observation, non-blocking: **SEAM-8 assigns `contract/**` to "nobody this phase — report defects, do not edit", and `contract/` was edited** — `manifest.schema.json`, `README.md`, `test/validate.test.mjs` and a new invalid fixture. These are the Lead Architect's ADR-0009 governance wave (commit `9888daa`), landed before the streams launched, and SEAM-8's last row reserves `llm/**` and `docs/**` to the Lead Architect. The intent was plainly "no *stream* edits contract/", and no stream did. Worth one word in the seam so the next reader does not have to reconstruct it.

---

## Part E — Governance

**Level declaration: L3 is correct.** The PR touches production code, infrastructure and CI (L2), ADRs and design-authority-adjacent seams (L1), **and** it amends a roadmap acceptance criterion and implements an access policy over personal data (L3). Canon classifies a mixed PR at the highest level touched, and canon permits AI roles to escalate up and never down. L3 stands. Nothing operational turns on it — L1, L2 and L3 are all human-reviewed and owner-merged — but the declaration is right.

**ADR form and indexing: clean.** ADR-0009 and ADR-0010 both carry Status, Date, Context, Decision, Rationale, Alternatives Considered, Consequences (positive, tradeoffs, risks), Impacted Areas, Related Documents, Related Issues, Supersedes and Superseded By. The index at `llm/governance/adr/README.md:15–24` matches every file's `Status:` line, numbering is contiguous 0001–0010 with no gaps, and the template is correctly excluded. `governance-checks --layout` passes 4 of 4.

**ADR quality: high, and ADR-0010 in particular is the kind of ADR this hierarchy exists for.** Its Rationale names the pair that matters — decisions 2 and 3 are only defensible together — and says why: collapsing them would let a failed sync silently empty the private area while the system reported success. Its Risks section names decision 5 as "the one place in this system where a build defect can remove data, and it should be reviewed with that in mind." It was, and it holds.

**Commit hygiene: good.** Seven commits on the branch, each with an issue reference and a substantive subject line, scoped per stream (governance wave, satellite, gate, integration). No secrets, no key files, no Terraform state and no machine paths are tracked: `git ls-files infra` shows `terraform.tfstate`, `terraform.tfstate.backup`, `tfplan` and `terraform.tfvars` are all **untracked** — only `terraform.tfvars.example` is committed. `gate/.pytest_cache` and `gate/.ruff_cache` are untracked. Every tracked shebang-bearing `*.sh` is `100755`, including `infra/scripts/check-private-bucket-iam.sh` — **the infra handoff's "owner action required before commit" is already done**, and that handoff line is stale.

**Durable decisions captured as ADRs: mostly, with real debt.** The four handoffs propose seventeen ADR candidates between them. Most are correctly parked. Three are decisions that have *already been made and applied* and are therefore not candidates but omissions: the private bucket's two-principal reader set (applied to the roadmap and SEAM-1 — see BLOCKING 1); the uniform-404 refusal shape (STATE C29, a genuinely good piece of reasoning about existence oracles that currently lives only in a status file); and the srcDir structural guarantee (see BLOCKING 2).

Full findings, most severe first, follow the audit section.

---

## The Governance Audit — Phases 0–3, against canon v0.9.0

Instrument: `agentic-governance` `plugin/skills/audit/SKILL.md` at v0.9.0 / `851a50a` — the release that added check 8 (stale branches) and the `delete_branch_on_merge` assertion. The repo's CI pin (`.github/workflows/ci.yml:37`) is that exact SHA, and canon's `VERSION` is `0.9.0`, so the pin that binds and the instrument I ran are the same.

**Verdict: DRIFTING.** No blocking audit finding. The drift is concentrated in one place — the artifacts that record reality have fallen behind the reality they record.

| # | Check | Result |
|---|---|---|
| 1 | Adoption + version | **PASS.** Delta complete, no placeholders; all v0.2+ and v0.3+ fields present. Delta pins v0.9; canon `VERSION` 0.9.0; CI pin matches. No drift between delta and canon. |
| 2 | ADR health | **PASS with two notes.** All ten ADRs well-formed; index matches; no gaps. **Note:** ADR-0006↔0001 is marked in both directions, correctly. ADR-0007 reverses ADR-0002's dispatch mechanism, but ADR-0002 is still `Accepted` with empty Supersedes/Superseded By, and its index title still reads "…and notify the hub by dispatch" — a reader landing on ADR-0002 is told something the system no longer does. |
| 3 | Workflow compliance | **PASS.** `git log --first-parent` on `origin/main` since the 2026-09-14 adoption date is entirely PR merges (#23, #20, #22, #17, #15, #14, #12, #11, #9, #8). No direct commits to `main` post-adoption. Pre-adoption direct commits are grandfathered. |
| 4 | Governance levels | **UNVERIFIABLE.** Requires reading PR bodies and labels. Report on request with the PR text supplied. |
| 5 | L0 allowlist + steward activation | **PASS on activation** — delta shows INACTIVE with no activation ADR and no activation PR, correctly, and it is additionally blocked in substance by the single-token identity model. **Allowlist: see audit finding A-2.** The fenced block parses, every `allow` carries a valid shape, the globs are well-formed, and the instance is a faithful superset of canon's Template Allowlist. |
| 6 | Governance checks | **PASS.** Run from the repo root against the pinned canon: `PASS governance-links / adr-index / adr-status / layout — 4 of 4 passed, 0 failed`, exit 0. Default mode 3 of 3. The declared command resolves and runs. |
| 7 | GitHub surface | **PARTLY UNVERIFIABLE.** Branch protection, label taxonomy and `delete_branch_on_merge` need `gh`. The delta's §Platform Enforcement Reality records all three honestly — including the uncomfortable parts (0 required approvals, `enforce_admins` off, one shared owner token, "the gate binds ordinary flow; it does not bind the token") — dated and re-verified. Canon asks for honesty where protection cannot be achieved, and this is the most honest such section I have audited. `delete_branch_on_merge` is recorded TRUE, verified 2026-09-16; I could not re-verify it this session. |
| 8 | Stale branches | **REPORT ONLY — see audit finding A-1.** |
| 9 | Memory-bank currency | **FAIL — see audit finding A-3.** |
| 10 | Control-plane content under the artifacts tree | **PASS.** `docs/` holds exactly one file, `docs/satellites.md`, which is a genuine data-plane how-to. No ADRs, no delta, no `*-design.md`, no plans, no memory-bank files, and **no `docs/superpowers/**` path of any kind** — the `CLAUDE.md` output-location override is being honoured. |
| 11 | Undeclared layout paths | **PASS.** All seven declared slots resolve; `--layout` passes. `site/`, `gate/`, `contract/`, `infra/` and `firebase.json` are explicitly placed outside the slot table on purpose (delta `:84–88`) and all now exist. **Note:** that same paragraph still calls `src/`, `public/`, `scripts/`, `astro.config.mjs` and `package.json` "the current Astro application" at repo root; ADR-0001 moved all of them under `site/` in Phase 1, so the sentence is stale prose. |
| 12 | Documentation standards | **PASS with one note.** Every major control-plane doc carries Status, Last updated and Owner, with statuses from the canonical vocabulary. `llm/memory_bank/projectbrief.md` is still the establish-time stub and says so. |

### Audit finding A-1 — stale branches (report only; no deletion recommended)

Canon check 8 requires classification **by PR**, never by commits, because a squash-merged branch always looks unmerged. I cannot query PRs without `gh`, so the right-hand column below is inferred from first-parent merge subjects on `origin/main` and is **not** a classification. I make no deletion recommendation for any branch.

| Branch | Remote? | Last commit | Inferred | Canon class |
|---|---|---|---|---|
| `feat/private-area` | yes | 2026-09-17 | PR #24/#25, live | live — say nothing |
| `admin/phase-2-closeout` | yes | 2026-09-16 | merged as #23 | candidate for cleanup |
| `fix/content-bootstrap` | yes | 2026-09-16 | merged as #20 | candidate for cleanup |
| `feat/publishing-contract` | local only (upstream gone) | 2026-09-16 | merged as #17 | already deleted remotely |
| `feat/email-privacy-pages` | local only (upstream gone) | 2026-09-15 | merged as #15 | already deleted remotely |
| `fix/education-pool-count` | local only (upstream gone) | 2026-08-03 | no merge subject; local ahead 3 | **needs a PR query** |
| `fix/derive-education-assertion` | yes | 2026-08-17 | no merge subject; ahead 4 | **needs a PR query** |
| `origin/fellowship-sprint-notebook` | remote only | 2026-07-19 | no merge subject; ahead 1 | **needs a PR query** |
| `handoff/research-hub` | **never pushed** | 2026-09-10 | no PR ever | **never recommend deleting** |

Two points the owner should not skim. First, that `admin/phase-2-closeout` and `fix/content-bootstrap` still exist remotely after their PRs merged is worth checking against `delete_branch_on_merge = true` — either the setting regressed, or those PRs were merged in a way that bypassed it. Second, **`handoff/research-hub` must not be deleted.** It exists only locally, it is the only copy of its commit, and STATE §Follow-ups says to keep it because it holds the SHA the Incident A1 purge request would need. Canon's rule that a branch with no PR is never recommended for deletion is exactly right here.

### Audit finding A-2 — the L0 allowlist has drifted from the tree

The block at delta `:136–156` is grammatically valid and its effect is safe — canon treats an unlisted path as failing the fast track, so nothing is silently permitted. But three of its `deny` lines now guard paths that **no longer exist**: `deny src/**`, `deny scripts/**` and `deny public/**` were written before ADR-0001 moved the Astro application under `site/`. The real trees are `site/src/**`, `site/scripts/**`, `site/public/**` and `infra/scripts/**`, all covered by the `site/` and `infra/` denies, so there is no hole — but a reader auditing the block cannot tell the vestigial lines from the live ones.

Separately, four governance-bearing root files are covered by **no rule at all**: `CLAUDE.md` (which carries the two-plane routing rule and the output-location override), `AGENTS.md`, `CONTRIBUTING.md` and `.gitignore`. `.gitignore` deserves particular mention: it is what keeps `site/dist-public`, `site/dist-private` and the synced content tree out of git, so a change to it interacts directly with the ADR-0005/ADR-0010 story. Canon's unconditional deny list covers role charters by category; making it mechanical here costs four lines.

### Audit finding A-3 — the memory bank does not know Phase 3 exists, and some of what it does say is wrong

`git diff --name-only origin/main...feat/private-area | grep memory_bank` returns **zero files**. A PR that adds two ADRs, a Cloud Run service, five Terraform files, a second build output and a destructive sync leaves the memory bank untouched. Canon's Definition of Done §Implementation Work requires "Memory bank is updated if the project state changed", and §Merge Readiness requires memory-bank needs addressed.

I accept that this repo has an established and reasonable pattern — Phases 0 and 1 landed bookkeeping as a separate L0 PR after merge — and that pattern is fine. What is not fine is that the bank currently contains statements that are **false about already-merged reality**, independently of Phase 3:

- `progress.md:35–42` still lists Phase 2 as "Pending merge — PR #17"; #17 merged 2026-09-16 (`ee81929`). `progress.md:50–54` still lists "Phase 2 implementation … then Checkpoint 3" under *What is left*. Meanwhile `activeContext.md:12–15` says Phase 2 is COMPLETE and Checkpoint 3 passed. The bank contradicts itself.
- `activeContext.md:61`, `progress.md:18` and `:70`, and `projectbrief.md:14` all record governance adoption at **v0.8 / canon 0.8.3**. The delta and CI pin **v0.9.0**. The bank is the rank-1 artifact in this repo's authority hierarchy and it names the wrong canon version.
- `activeContext.md:43` and `progress.md:20` say "ADRs 0001–0008"; 0009 and 0010 are Accepted.
- `progress.md:43–48` still flags `WEBSITE_DISPATCH_PAT` as a live finding without recording that the repository half was remediated on 2026-09-16 and only the token revocation remains outstanding.

A contributor picking up work today from the memory bank would be misinformed on four counts. That is the failure the memory bank exists to prevent.

---

## Findings

### BLOCKING

**B-1. The design-authority document still says the gate's service account is the private bucket's only reader. The shipped configuration says otherwise, and every downstream artifact was amended except the source.**
`llm/specs/2026-09-10-research-hub-design.md:175` — "Gate service account is the bucket's only reader."
`infra/private-bucket.tf:193–214` binds **two** principals.

The roadmap's acceptance criterion 10 was amended in place and dated 2026-09-17; SEAM-1 was amended and dated; ADR-0010 was written and Accepted. §6 was not touched. This is the one artifact in the chain that outranks the others, and it is the one left contradicted.

*Failure scenario, and it is not hypothetical — it is the shape of this sprint's recurring defect.* A Phase 4 contributor implementing share links reads §6 as design authority (the document's own header instructs agents to "implement against this document and do not re-litigate it"), finds "the bucket's only reader", and either (a) writes a contract clause or a CI assertion enforcing a single reader, which will fail against the applied configuration and read as an infrastructure defect rather than a stale document, or (b) proposes revoking `hub-deploy`'s binding to restore the stated invariant, which would silently disable withdrawal — decision 5 becomes unimplementable and a withdrawn dossier stays served at its old path. The system would report success. That is precisely the failure ADR-0010's Rationale calls "a privacy failure wearing the costume of a stale page."

The precedent is already set in this repository and it is a good one: **ADR-0008 amended design doc §2 and §4 and said so, and ADR-0006 amended ADR-0001 with the cross-reference recorded in both directions.** ADR-0010 amends §6 in substance and does not say so.

*Required:* amend §6 requirement 4 to the two-principal form, with a dated amendment note citing ADR-0010 decision 5 and SEAM-1, in the same style as ADR-0008's amendment of §4; and add §6 to ADR-0010's Related Documents as amended. Two edits, both textual.

**B-2. The structural guarantee that makes A2 true is a deviation from design authority that no ADR records.**
`llm/specs/2026-09-10-research-hub-design.md` §5 requirement 4 specifies `HUB_OUTPUT=public|private` as a variable "that **filters collections by visibility**, run twice in CI."
`site/astro.config.mjs:48` implements something different and stronger: two `srcDir`s, so the public build never resolves the private pages at all.

I want to be unambiguous: **the implementation is better than the specification, and I am not asking for it to be changed.** A filter is a convention that every future page must remember to apply; a separate `srcDir` is a property of the router. That is exactly what the site contract's open question (a) asked for — "a structural guarantee, not a convention" — and the answer is right.

But it is a durable architectural decision, it departs from the letter of a rank-2 document, and it currently exists only as a comment in a config file and a test file. The site stream's own handoff lists it as an ADR candidate. My charter forbids accepting undocumented architectural decisions, and the Universal review criterion "no undocumented durable decisions" applies to every semantic PR.

*Failure scenario.* A future contributor consolidating the two builds — a reasonable-sounding simplification, "one source tree, one pages directory, filter by visibility, as §5 says" — would be *implementing the design document correctly* and would silently demolish the structural guarantee. `private-structure.test.ts` would fail, and the natural reading of that failure is "this test is enforcing an implementation detail the design doc does not require"; the test's own header anticipates this ("If someone deletes this test to make a change pass, that is the signal"). A test comment is not design authority. An ADR is.

*Required:* one short ADR recording the two-`srcDir` structure as the decision that implements §5 requirement 4, naming the filter alternative and why it was rejected, and noting that it also closes the module-graph path (which a filter never could). It can be four paragraphs. Alternatively, amend §5 and cross-reference — but an ADR is the better home, because the reasoning is worth keeping.

### SHOULD-FIX

**S-1. Nothing in the private output links to anything the gate can serve. The members' area, as built, is a single unstyled page with no working navigation and no reachable document.**

This is the most consequential defect I found, and no stream could have seen it: it lives in the gap between the gate's URL space and the site's link generation, and each stream is individually correct.

The gate serves the private area under `/p/**` (`gate/app/main.py:221`), stripping `/p/` to form the object name. The private build is produced by `build.yml:684` running `npm run build:private` with **no `SITE_BASE`**, so Astro's base is `/` (`site/scripts/site-env.mjs:11`) and every generated link is root-absolute. I inspected the actual built output:

```
dist-private/index.html  hrefs:
  href="/p/"                                        ← correct
  href="/_astro/private-content.BLqr-G24.css"       ← stylesheet
  href="/phd/phd-milestones/milestones/"            ← the item link

dist-private/phd/phd-milestones/milestones/index.html:
  src="/_payload/phd-milestones/site/index.html"    ← the iframe carrying the document
```

Through Hosting, a member at `https://jason.cusati.us/p/` gets a page whose stylesheet resolves to `https://jason.cusati.us/_astro/…` — the **public** origin, which does not have it → 404, unstyled page. Clicking an item goes to `https://jason.cusati.us/phd/phd-milestones/milestones/` — the public site, which 404s. On the item page, the iframe carrying the actual document requests `/_payload/…` from the public origin → 404, empty frame. On the direct `*.run.app` URL it is worse: none of those paths is under `/p/`, so the gate's catch-all returns its static not-found page.

Only `/p/` itself and the "← Members' area" crumb are correct, because they are the two hardcoded strings.

*This is roadmap acceptance criterion 1 — "A seeded member signs in at `jason.cusati.us` and sees the milestone tracker and the committee dossier" — failing at Checkpoint 4,* and failing in the exact silent manner this phase kept catching elsewhere: nothing errors, the build is green, the objects sync perfectly, and the breakage is visible only to the two people the private area exists for.

**Nothing in the repository will catch it, and one thing actively entrenches it.** `site/src-private/lib/private-content.test.ts:33` asserts `routeFor(MILESTONES)` equals `/phd/phd-milestones/milestones/` — the value that does not work — and `:37` does the same for `payloadUrlFor`. The test pins the defect. No contract, seam, ADR or handoff discusses the private area's base path at all; grep across all of them returns nothing. It simply was never anyone's question.

*Required, in the follow-up PR that adds the rewrites — not necessarily this one, since the rewrites are deliberately absent and nothing is reachable until they land:* set the private build's base to `/p/` so Astro emits `/p/_astro/…` (the gate serves `/p/_astro/…` → object `_astro/…`, which exists), **and** prefix `routeFor()` and `payloadUrlFor()` in `site/src-private/lib/private-content.mjs:63–70`, which build raw strings and are not covered by Astro's base. Both are needed; neither alone is sufficient. Update `private-content.test.ts:33,37` to the corrected values. Then add one assertion that no link in `dist-private` resolves outside `/p/` — that is the guard whose absence let this through, and it is five lines.

**S-2. The bucket IAM test does not run on any deploy, and two committed documents state that it does.**

Design doc §12.1 is a non-negotiable: "No private content in public output. Build-time check, **bucket IAM test, both on every deploy**." Roadmap criterion 10 says the same. Grep of `build.yml` for `check_private_bucket_config`, `check-private-bucket-iam` or any private-bucket assertion returns **nothing**. The `budget-guard` job asserts the *content* bucket's UBLA and the satellite role (`:363–390`), which is Phase 2's boundary, not Phase 3's.

The infra stream flagged this correctly as its seam issues 2 and 3 and as follow-up 2, naming `build.yml` as the site stream's file; the site stream's handoff does not mention it. It fell in the gap. That is an understandable handoff failure and the credential-free half costs one step to wire.

What must not stand is the documentation. `infra/outputs.tf:222` states the credential-free half "runs on every push", `infra/README.md:363–364` states both invariants "are asserted on every push", and `infra/README.md:740` is headed "**The credential-free half, which runs on every push**". All three are false today. A future reader auditing §12.1 will read those lines, conclude the criterion is met, and stop looking.

*Required now:* correct those three claims to say where the check is *intended* to run and that the wiring is outstanding. *Required before Checkpoint 4:* add `python3 infra/scripts/check_private_bucket_config.py` as a step in `budget-guard` — which is deliberately the right home, because `budget-guard` is already a required status check on `main`, so the assertion is enforced from the moment it lands rather than sitting unenforced until branch protection changes. That is the same reasoning the Phase 2 reviewer's S5 used, and it was right then.

Separately, on the live half: the infra stream declined to add `storage.buckets.getIamPolicy` to `privateSyncWriter` purely so a *check* could run, and declined to widen a role for the benefit of a check. **That judgement is correct and I endorse it.** Its recommendation — credential-free configuration check plus the anonymous-object probe on every deploy, with live policy enumeration as an owner/Checkpoint procedure — is the right division. Note that the anonymous probe (`check-private-bucket-iam.sh:154–168`) needs **no credential at all** and is the half that actually catches a world-readable object, so it is the better candidate for the deploy path.

**S-3. The sign-in page and the gate disagree about what a non-member sign-in returns, and the result is the redirect loop SEAM-3 explicitly forbids.**

`gate/app/main.py:188` and `:195` return **HTTP 200** with `{"status": "not_a_member"}` for a verified non-member, and set no cookie. `site/src/pages/signin/index.astro:129–138` treats `response.ok` as success and does `window.location.assign("/p/")`; its non-member branch keys on `response.status === 403`, which the gate never returns — that branch is unreachable, and the carefully-worded message in it will never be shown.

So a non-member signs in successfully, is redirected to `/p/` **with no session cookie**, and the gate answers with `pages.SIGN_IN_REQUIRED` — the "Sign in" page, carrying a link back to `/signin` (`gate/app/pages.py:33–38`). They sign in again. Same result.

SEAM-3 names this outcome directly: "A non-member who signs in successfully gets the 'not shared with you' page and **no private content** — not a 403 with a body, **not a redirect loop**." The gate implements its half correctly and its handoff (SD-5) records the response contract it invented because none was written. The site stream could not have inferred it — SEAM-2 specifies only `{"idToken": …}` in and `Set-Cookie` out, "and a JSON error body otherwise", which does not describe a 200 carrying a refusal.

This is not a privacy failure — no private content is served, and the eventual page names nothing. It is a correctness and diagnosis failure, and STATE §10 Q4 already warns that this exact page is "indistinguishable from a gate bug". The owner's own gcloud/GitHub identity is `djjay0131@gmail.com`, which is **not** on the allowlist, so the owner is the single most likely person to hit this path at Checkpoint 4 — and what they will see is a sign-in loop.

*Required:* have the sign-in page branch on the JSON body (`status === "not_a_member"`) rather than on the HTTP status, and record the `/session` response contract in SEAM-2 so the next consumer does not have to infer it. This is the same defect class as the `PRIVATE_BUCKET`/`GATE_PRIVATE_BUCKET` mismatch the Lead Architect caught — a cross-stream interface named in prose rather than pinned — and it validates STATE's newly-recorded constraint that "a cross-stream environment variable is a contract, and nothing checks it." Extend that constraint to response contracts.

**S-4. The leak-check self-test gates nothing, and the guard it protects is the one the whole phase rests on.**

`build.yml:449–485` — `leak-check-self-test` is not in any job's `needs` and is not a required status check. The comment at `:445–448` says so deliberately and defers promotion to the owner at Checkpoint 4.

The reasoning for a separate *job* is sound and I endorse it: `content:fixture` rewrites `site/src/content`, and doing that inside `build` or `build-firebase` would put fixture content into the artifact those jobs upload to the live site. A separate runner cannot contaminate a deploy. That is exactly right.

But the consequence is that if the leak check silently stops catching leaks, the red job sits beside a green deploy. Meanwhile the *real* leak check in `build` and `build-firebase` exits 0 today while printing that it proved nothing, because no private item is published until Checkpoint 4. **Both halves of the guarantee are currently non-blocking**: the real check has nothing to find, and the check that proves the guard works cannot stop a deploy. Adding it as a required context costs one setting.

**S-5. `contract/` was changed in this PR and its test suite still runs nowhere.**

This PR modifies `contract/manifest.schema.json`, `contract/README.md`, `contract/test/validate.test.mjs` and adds an invalid fixture. Grep of all three workflows for anything invoking `contract/`'s `node --test` returns nothing. `build`/`build-firebase` run `npm test` with `working-directory: site`.

This is STATE's issue #26, opened by the Lead Architect during this phase. It was tolerable while `contract/` was unchanged; it is not tolerable in the PR that edits the schema. The schema, the dependency-free validator the publish action actually runs, the fourteen rejection fixtures and the fixture-coverage guard are verified only by hand, on an L3 PR, in the phase where the contract first carries private items. Same shape as the exit-126 defect and the non-hermetic tests: passes locally, unguarded on the runner.

**S-6. Correct the memory bank's false statements about merged reality, independently of the Phase 3 sync.**

Audit finding A-3. I accept the deferred-bookkeeping pattern for *new* Phase 3 content. I do not accept that `progress.md` says PR #17 is pending merge, that three files name canon v0.8 when the delta and CI pin v0.9.0, and that two files say "ADRs 0001–0008". Those are wrong now, were wrong before this PR, and the memory bank is rank 1 in this repo's authority hierarchy.

### NOTE

**N-1.** `roles/firebaseauth.admin` on the gate's runtime identity (`infra/gate.tf:118–122`) is wider than needed — it can create and delete users. Both the gate and infra streams independently identified `firebaseauth.users.createSession` as the intended narrowing and neither could confirm custom-role eligibility from a primary source in this environment. The Checkpoint 4 command is written down (`gate.tf:78–80`). This is honest over-granting with a dated exit, which is the right way to do it, but it is the widest grant in the phase and it should not survive Checkpoint 4 quietly.

**N-2.** SD-3 is **closed and the handoffs are stale on it.** `infra/gate.tf:114` grants `roles/datastore.viewer`, not `datastore.user`. The Lead Architect verified, correctly, that `gate/app/` contains no Firestore write of any kind — I confirmed: `members.py:65` is the only call site and it is a `.get()`. The gate handoff and agent-visible summaries still describe the write grant. Worth a line so the next reader does not re-raise it.

**N-3.** The deny-all Firestore ruleset (`infra/firestore.tf:97–154`) was added beyond the infra contract's deliverables and it should stay. Without it, `members/{email}` — two real email addresses — is readable from a browser console by any signed-in stranger via the public sign-in page's Web SDK, because Security Rules govern client SDKs while the gate's Admin SDK bypasses them entirely. The release resource is correctly separate from the ruleset, with a comment noting that a ruleset created but never released governs nothing and looks identical in a plan. Beyond-scope work, flagged rather than smuggled — exactly the right conduct.

**N-4.** `format: html` items are not served in the public output, and the gap was left unexpanded deliberately. **I agree with leaving it, and would have argued for it.** The honest position is that `format: html` is under-specified in the contract (STATE C28): §4 calls it "a self-contained page or folder", and neither reading survives contact with the two items now published — the pages are not self-contained (they load a sibling stylesheet), and "folder" collapses because both items share one directory. The private side resolved this pragmatically by staging the containing directory minus non-surviving documents, which works and is well-reasoned. Extending the same treatment to the *public* path would mean copying satellite-authored HTML directories into `site/public/` — arbitrary third-party markup on the public origin, with no equivalent of the private side's gate in front of it. That is a materially larger decision than a format gap and deserves an ADR, not a mid-phase expansion. Expanding it now would also have meant touching `contract/` during a phase in which two streams were reading the schema and its fixtures. The correct next step is the ADR C28 asks for: state that a file-valued `html` path serves its containing directory, and define what happens when two items share one. Until then, no satellite publishes a public `html` item, so nothing is broken — only undefined.

**N-5.** `dist-private` carries the whole `publicDir` — four CV PDFs, a photo and two favicons, about 70 files — into the private bucket. Harmless (they are already public bytes) but it inflates the destination and, more relevantly, it inflates the denominator of P6's deletion ceiling: 80 objects in my run, of which only 5 are actually private content. A future withdrawal of both items would delete roughly 4% of the destination and sail under the 34% ceiling — the ceiling is therefore weaker in practice than the number suggests. Not a defect; worth knowing before tuning that ratio.

**N-6.** The committed fixture at `site/fixtures/content/sources/phd-milestones/` is **genuinely invented**, and I verified this rather than taking it on trust: SHA-256 differs from the real satellite pages on all three files, the fixture pages are 20 and 25 lines against 393 and 332, and the titles are explicitly marked `(fixture)`. The slugs are the real ones, which is necessary and correct — the leak check must be exercised against the needle values it will really search for, and my clean-build PASS above is only meaningful because of it. Given Incident A1, this deserved checking and it is right. `site/fixtures/README.md:3` still says the tree holds invented content "for one source, `cv`" — stale now that there are two.

**N-7.** `phd-milestones`'s working tree has fourteen files showing `old mode 100644 / new mode 100755` with zero content change — DrvFs mode noise on `/mnt/c`, where `ls -l` lies. The **tracked** modes are all `100644`, which is correct for `.yml` and `.md`. Commit there with `git -c core.fileMode=false add` and verify with `git ls-files -s`. This is the same hazard that cost a red CI in Phase 2.

**N-8.** H-5 stands and is the private area's one genuine third-party exposure: the two published pages load webfonts from a public CDN, so a signed-in member reading private material makes a request that discloses their IP and the referring page to that CDN. It is not fixable within this phase's file contract (it means editing seed content) and it is correctly documented in the satellite's own `docs/hub-publishing.md:84–87`. The hub self-hosts its own fonts via `@fontsource`; the payload does not. An owner decision.

**N-9.** ADR-0002's index title still advertises the dispatch mechanism ADR-0007 removed, and ADR-0002 carries no `Superseded By`. Audit check 2.

**N-10.** Handoff statuses are inconsistent — gate "Delivered", infra "Draft", site and satellite "Complete" — and the infra handoff still carries an "owner action required before commit" (`git update-index --chmod=+x`) that is **already done**: `infra/scripts/check-private-bucket-iam.sh` is committed `100755`. Two minutes of tidying that prevents someone re-running a resolved instruction.

**N-11.** SD-8 is real: roadmap acceptance criterion 7 requires a test asserting no `/p/**` **or `/s/**`** response carries `public` or `s-maxage`. `/s/**` does not exist until Phase 4, so the criterion is half-unsatisfiable. The gate stream flagged it rather than ticking it. It must be recorded **deferred**, not ticked, when the roadmap boxes are filled in.

**N-12.** SD-4: there is no way to sign out. A 14-day `HttpOnly` session cookie with no in-band clear means a member on a shared machine cannot end their own session; clearing it requires the owner to revoke refresh tokens out of band. Not in any Phase 3 acceptance criterion and correctly not built. It belongs with the Phase 4 session work and should be on that phase's list now, while the reason is fresh.

**N-13.** `POST /session` has no rate limiting. It is unauthenticated, directly reachable on the `*.run.app` URL, and bounded only by `max-instances=3` and an 8 KB body cap. Each call costs an Identity Toolkit verification. Against a $5 budget that is a cost-exhaustion surface more than a security one. Worth a line in the Phase 4 scope.

**N-14.** `check_revoked=True` (`gate/app/config.py:87`) costs an Identity Toolkit lookup **and** a Firestore read per request, and every sub-asset of a private page is a request. That is what makes "remove someone from the allowlist and it takes effect immediately" true — and `test_serve.py:41–51` proves it does. It is the right default for a committee dossier. It also means an Identity Platform outage makes the private area unreadable, and it is a real per-request cost. STATE C30; recorded, not a defect.

**N-15.** `contract/README.md:287` still contains the string `phd-milestones` in prose, as does `docs/satellites.md:175`. Both are the source **name** only — no slug, no title, no summary, no description of contents — and `docs/satellites.md`'s worked example is now a neutral placeholder. H-4 is closed for the material that mattered. The remaining question STATE raises — whether design doc §4's example and the eleven fixtures derived from it should be re-worded — is a design-authority change, correctly not made mid-phase by an agent, and it is the owner's call. My view: the identifiers have been public in §4 since 2026-09-10 and the summary line was the sensitive part; that is now gone from both prose files. The residual is low and the cascade cost across eleven fixtures and two test files is real. I would not spend it now.

**N-16.** The site handoff's defect 3 — that `docs/satellites.md` lacks ADR-0010's satellite-owner withdrawal obligation — is **stale**. The text is present at `docs/satellites.md:155–158` ("Withdrawal does not delete your bytes… if the material is genuinely sensitive… delete the object yourself as well"), added in the same commit that landed the handoff. Mark it resolved so it is not re-raised.

---

## Verdict

**Request changes.**

Two blocking items, B-1 and B-2. Both are documentary, both are minutes of work, and neither describes a defect in the system's behaviour. I want to be very clear about why they block rather than sit as should-fixes: my charter requires that where a PR conflicts with a higher-authority artifact, the source of authority is updated first, and forbids accepting undocumented architectural decisions. In both cases the *right* decision was made — the two-principal bucket policy is correct, and the two-`srcDir` structure is better than the design document asks for. What is missing is the record. A repository that amends the roadmap and the seams while leaving the design document contradicted, twice, is not making decisions; it is drifting and calling it decisions. That is the failure this hierarchy exists to prevent, and it is cheapest to fix today.

**Nothing in Parts A, B or C is blocking.** I verified all seven of Part A's properties from code and configuration, and I executed the ones that could be executed. The private material is protected by construction, not by convention: the public build's router is never shown the private pages; the leak check greps contents and I watched it catch five content-only leaks with no matching path; the gate's every authorisation check is tested twice, once as Hosting delivers it and once as the open internet does; the private bucket's two principals are asserted by an equality test that a third binding would fail; and the destructive sync refused three separate ways when I tried to make it misbehave, then deleted exactly the two objects of a genuinely withdrawn item and nothing else. This is careful work, and the streams' habit of naming their own unproven assumptions in writing — "this path has NEVER been run", "this run proves nothing", "the real Firebase code paths are unexercised" — is what made this review possible at the depth it reached.

**The Governance Audit returns DRIFTING**, with no blocking finding. Governance checks pass 4 of 4, the canon pin is honest and current, ADRs are well-formed and correctly indexed, no direct commits reached `main` after adoption, and the data plane is clean. The drift is that the artifacts recording reality — the memory bank most of all, and the L0 allowlist behind it — have fallen behind the reality they record.

**No semantic change has entered through the L0 lane.** The lane remains inert: Steward Activation Status is INACTIVE, with no activation ADR and no activation PR, and no L0 certification was issued in this phase.

---

## The single most important thing to look at before merging

**Open `site/dist-private/index.html` and read its links.**

Not because it is the most dangerous finding — it leaks nothing — but because it is the one defect that makes this phase's headline promise false, and because nothing in the repository will tell you. Every generated link in the private output is root-absolute (`/phd/…`, `/_payload/…`, `/_astro/…`) while the gate serves everything under `/p/`. A seeded member who signs in at Checkpoint 4 will reach an unstyled members' page, click the milestone tracker, and land on a 404 from the public site. The document itself, carried in an iframe, will not load either.

Everything else in this review was caught by something: a test, a CI job, a stream reporting its own seam defect, or the Lead Architect's integration pass. This one was caught by nothing, because the private area's base path was never anyone's question — it appears in no contract, no seam, no ADR and no handoff. Worse, `site/src-private/lib/private-content.test.ts:33` asserts the broken value, so the test suite currently defends the defect.

The fix belongs in the follow-up PR that adds the `/p/**` and `/session` rewrites, since nothing is reachable until then — but it must be **written down now**, in that follow-up's scope, rather than discovered at Checkpoint 4 with the owner staring at a blank frame and wondering whether the gate, the bucket, the sync or the allowlist is broken. Add the assertion that no link in `dist-private` resolves outside `/p/`, and this class of defect cannot return.

---

### Files this report cites

- `/mnt/c/code/website/llm/specs/2026-09-10-research-hub-design.md` (§5, §6:175, §7, §12)
- `/mnt/c/code/website/llm/governance/adr/0010-withdrawal-semantics.md`, `0009-manifest-version-lands-optional-first.md`, `0005-two-output-build-with-leak-check.md`, `0004-private-area-cloud-run-gate-behind-hosting.md`
- `/mnt/c/code/website/llm/governance/governance-delta.md` (§Repository Layout, §L0 Path Allowlist, §Platform Enforcement Reality)
- `/mnt/c/code/website/llm/sprints/2026-09-hub/contracts/phase-3-seams.md` (SEAM-1..9)
- `/mnt/c/code/website/llm/sprints/2026-09-hub/STATE.md` (§Phase 3 integration findings; C27–C31)
- `/mnt/c/code/website/llm/master-roadmap.md` (§phase-3-private-area, criteria 1, 7, 10, 13)
- `/mnt/c/code/website/llm/memory_bank/activeContext.md`, `progress.md`, `projectbrief.md`
- `/mnt/c/code/website/site/astro.config.mjs`, `site/scripts/site-env.mjs`, `site/scripts/check-no-private-in-public.mjs`, `site/scripts/demo-leak-check.mjs`, `site/scripts/sync-private.mjs`, `site/scripts/private-build.mjs`, `site/scripts/private-structure.test.ts`, `site/scripts/site-routes.mjs`
- `/mnt/c/code/website/site/src-private/lib/private-content.mjs`, `private-content.test.ts`, `site/src-private/pages/index.astro`, `[...itemPath].astro`, `site/src-private/layouts/PrivateBase.astro`
- `/mnt/c/code/website/site/src/lib/hub-content.mjs`, `site/src/content.config.ts`, `site/src/pages/signin/index.astro`
- `/mnt/c/code/website/gate/app/main.py`, `config.py`, `serve.py`, `members.py`, `pages.py`, `auth.py`; `gate/tests/conftest.py`, `test_headers.py`, `test_paths.py`, `test_scope.py`, `test_serve.py`, `test_session.py`; `gate/Dockerfile`
- `/mnt/c/code/website/infra/private-bucket.tf`, `private-roles.tf`, `gate.tf`, `firestore.tf`, `identity-platform.tf`, `satellites.tf`, `variables.tf`, `outputs.tf`, `registry.tf`, `phase3-apis.tf`, `README.md`, `scripts/check_private_bucket_config.py`, `scripts/check-private-bucket-iam.sh`
- `/mnt/c/code/website/.github/workflows/build.yml`, `gate.yml`, `ci.yml`; `/mnt/c/code/website/firebase.json`
- `/mnt/c/code/website/contract/manifest.schema.json`, `contract/README.md`; `/mnt/c/code/website/docs/satellites.md`
- `/mnt/c/code/phd-milestones/.github/workflows/publish.yml`, `ci.yml`, `tools/generate-manifest.mjs`, `docs/hub-publishing.md`, `dist/manifest.json`
