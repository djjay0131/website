# Handoff — `site`, Wave 0 fixes

Stream: `site` (Wave 0 fixes)
Contract: `llm/sprints/2026-09-hub/contracts/site-wave-0-fixes.md`
Issue: #44 (hub-007); fixes #56, SD-4's missing caller, F-1
Date: 2026-09-19
Files changed: `site/**` only

---

## Summary

All three items are done and each change has been shown failing before passing.

**Item 1 — sign-out now has a caller (SD-4, B-8).** `site/src-private/lib/signout.mjs` makes
the call the gate stream specified, exactly:

```js
await fetch("/session/end", { method: "POST", credentials: "same-origin" });
```

`site/src-private/layouts/PrivateBase.astro` renders a `<button id="sign-out">` and wires it.
Because it is in the **layout**, every private page carries it — the members' index and both
item pages — verified in the built output, not inferred:

```
dist-private/index.html                                      button=1 error=1
dist-private/phd/phd-milestones/committee-dossier/index.html button=1 error=1
dist-private/phd/phd-milestones/milestones/index.html        button=1 error=1
```

and in the shipped bundle `dist-private/_astro/signout.CI_xtEqO.js`: `"/session/end"`,
`POST`, `same-origin` present; `no-cors` **0 occurrences**, `run.app` **0 occurrences**,
`<a href="…session/end">` **0 occurrences** anywhere in `dist-private`.

**Item 2 — audit (#56): 17 findings → 3.** `npm audit --omit=dev` went from
**1 critical, 9 high, 6 moderate, 1 low (17)** to **1 critical, 1 high, 0 moderate, 1 low (3)**.
Both direct findings the contract named are **fixed**: `js-yaml` 4.1.1 → **4.3.2**,
`astro` 6.1.7 → **6.4.8** (as far as its declared major goes). The remaining three are
**accepted, not clean**, all with the same single remedy — `astro@7.3.3`, a semver-major
bump — and each is recorded below with the version it is accepted at.

**Item 3 — `check:private-links` now sees off-origin and relative-escape links (F-1).**
Both shapes were planted in the **real** private build and the **committed pre-fix script,
extracted from HEAD, passed them GREEN** while the new one exits 1. The satellite's own
legitimate relative links (`href="assets/style.css"` in the staged `_payload/**` pages) still
pass — that constraint is what shaped the fix.

Final state: `npm test` **18 files, 230 passed, 1 skipped**; both builds green; every check
green; `demo:leak-check` still red on a planted slug; no tracked mode changed.

> **The seam, not either stream.** The gate built the handler and said what the site should
> call; the rewrite request was routed and the caller never was. Recording it once more here
> so the shape is legible later: *a change that is one thing owned by two agents* — the same
> shape as D-5, SP-1 and the `PRIVATE_BUCKET`/`GATE_PRIVATE_BUCKET` defect.

---

## What changed

| File | Status | Why |
|---|---|---|
| `site/src-private/lib/signout.mjs` | **new** | The call, its destination, its failure message and its request init, in one place so a test can assert them |
| `site/src-private/lib/signout.test.ts` | **new** | 13 tests: the three forbidden shapes, the failure paths, and that the layout actually renders the control |
| `site/src-private/layouts/PrivateBase.astro` | modified | The `<button>`, the `role="alert"` error region, the wiring, the styles |
| `site/scripts/check-private-links.mjs` | modified | Widened regex + resolve-and-judge classifier; `--dist`/`--base` flags; exported functions |
| `site/scripts/check-private-links.test.ts` | **new** | 18 tests, including both F-1 shapes and the relative link that must NOT become a false positive |
| `site/package.json` | modified | Direct-dependency floors raised: `astro ^6.4.8`, `js-yaml ^4.3.2`, `vitest ^4.1.11` |
| `site/package-lock.json` | modified | `npm audit fix` (no `--force`) |

Nothing outside `site/**` was touched. `firebase.json` was **not** modified — the
`/session/end` rewrite is already on `feat/site-wave-0`, confirmed by
`git show feat/site-wave-0:firebase.json`. No git, `gh` or cloud mutation was made; no branch
was checked out (branch content was read with `git show` / `git diff main...<branch>`).

> The repo-wide `git status` also shows `gate/**` modified and `gate/tests/test_signout.py`
> new. **That is the concurrent gate stream in this shared worktree, not mine.** I scoped
> every status and diff to `site/`.

---

## Item 1 — the sign-out control

### Design, and why it is a module rather than four lines in the layout

Three properties of this one call are security properties, each invisible in a diff and each
failing **silently** — the member is told they signed out and they did not. Putting them in a
module makes all three assertable by a test rather than by review:

1. **POST, never `<a href>` or GET.** A GET sign-out is triggerable by an `<img src>` on any
   page the member visits, which hands a third party the ability to sign them out.
2. **A same-origin path, never an absolute `*.run.app` URL.** An absolute cross-origin URL
   makes the browser send a different `Origin` and the gate answers 403 — a failure that reads
   like a gate bug.
3. **No `mode: "no-cors"`.** That is the tempting way to make the resulting error go away, and
   it works by making the failure *unreadable*: an opaque response is `ok === false`, status 0,
   forever.

The request init has **exactly two keys**, and `signout.test.ts` asserts the key set itself, so
a fourth key is a failing test rather than a review comment.

### After a success, and after a failure

- **Success → the public home page (`/`).** The members' area is served by the gate under `/p/`
  and answers a cookie-less request with "sign in required", so reloading `/p/` would show a
  refusal page to someone who just did the right thing. The public site is somewhere that
  plainly makes sense signed out. (Alternative considered: `/signin/` — see below.)
- **Failure → visible, and no redirect.** The member stays where they are, a `role="alert"`
  region says *"Sign-out failed — you are still signed in. Try again; if it keeps failing,
  close every window of this browser."*, the button re-enables, and `recordEvent("signout_failed",
  {reason, http_status})` reports it in the same grammar `/signin/` already uses. A redirect on
  failure is indistinguishable from success to the person watching, which is precisely the
  state SD-4 exists to prevent.
- The wording deliberately **never says "everywhere"**, and a test asserts that. Gate finding
  G-5: this clears the cookie in *this* browser and does not revoke server-side.

### Sequencing, recorded as the contract asked

The gate's `Origin` check is being repaired concurrently (`gate-wave-0-fixes` item 1) because
it does not currently work as intended. **This call is same-origin, so it is correct under both
the broken and the repaired check.** Nothing here is designed around the broken version, and no
part of the call would need to change if the repair changes how `Origin` is compared — the
browser sends the site's own origin either way.

The other half of this seam is still a merge-order fact, not a code fact: `/session/end` needs
the Hosting rewrite on `feat/site-wave-0` to reach the gate through the CDN (G-R1). Until it
merges, the call 404s through the domain — which is why a 404 is one of the failure cases with
its own test.

---

## Item 2 — npm audit (#56)

### The flag really is a no-op, confirmed

`site/package.json` declares 13 `dependencies` and **no `devDependencies` key at all**. The
audit metadata says so directly:

```
deps: {"prod":442,"dev":0,"optional":79,"peer":0,"peerOptional":0,"total":520}
```

`dev: 0`. `--omit=dev` excludes nothing, and every finding is a production finding. Reported
as such, not softened.

### Counts, before and after

| | critical | high | moderate | low | **total** |
|---|---|---|---|---|---|
| Before | 1 | 9 | 6 | 1 | **17** |
| After | 1 | 1 | 0 | 1 | **3** |

### A correction to the contract's premise

The contract says to triage "the critical and the **two** direct highs". Against the lockfile as
it stood there was **one** direct high, not two:

| Package | Direct? | Severity (before) | Outcome |
|---|---|---|---|
| `astro` | yes | **critical** | bumped 6.1.7 → **6.4.8**; critical remains (needs 7.x) |
| `js-yaml` | yes | **high** | bumped 4.1.1 → **4.3.2** — **fixed** |
| `vitest` | yes | *moderate* (not high) | bumped 4.1.4 → **4.1.11** — **fixed** |

The other eight highs were all transitive under `astro`, and the contract's expectation that
"transitive ones may resolve with them" held: `postcss` 8.5.10→8.5.28, `nanoid` 3.3.11→3.3.19,
`vite` 7.3.2→7.3.6, `svgo` 4.0.1→4.1.0, `smol-toml` 1.6.1→1.8.0, `devalue` 5.7.1→5.9.4,
`fast-uri` 3.1.0→3.1.8, and `@astrojs/language-server` 2.16.6→2.17.0 (which cleared all six
moderates, via `@astrojs/check`, whose own version 0.9.8 did not need to move).

### The astro major bump: **not done in this wave, and here is the evidence either way**

`astro@7.3.3` is the *only* remedy npm offers for all three remaining findings, and it is
semver-major (6 → 7). I ran a **bounded trial in a scratch copy** rather than asserting a
belief:

```
astro now: 7.3.3
astro7 public  build exit: 0
astro7 private build exit: 0
Test Files  1 failed | 15 passed (16)
  FAIL src/content.config.test.ts
  Error: ENOENT: no such file or directory, open '…/scratchpad/contract/manifest.schema.json'
```

**That failure is an artefact of the scratch copy, not an Astro 7 regression** — that test reads
`../contract/manifest.schema.json`, a sibling directory of `site/` that the copy excluded. So
the honest reading is: *Astro 7 built both outputs of this site and broke no test the trial
could actually run.*

**I still did not do it, and this is the reason.** The trial establishes that the bump is
*plausible*, not that it is *safe here, now*:

- It is the framework, and the wave has four PRs in flight with a documented merge order
  (#48 → #47 → #53 → #45) plus two branches concurrently touching `site/`. A framework major
  landing between them changes the bytes every one of those PRs is measured against.
- The trial could not run the one suite that pins the manifest contract (`content.config.test.ts`),
  which is exactly the seam a framework bump is most likely to disturb.
- Astro 7's own remaining advisories are not zero: the scratch tree under `astro@7.3.3` still
  audited **7 (6 moderate, 1 high)** — those are the ones the non-force fix cleared here, so
  the right sequence is *this* lockfile plus 7.x later, not 7.x instead.
- Nothing among the three accepted findings is reachable by this site's deployment shape
  (see the acceptance table below), so the bump buys correctness-of-posture, not the removal
  of a live exposure — and this wave's blockers are live ones.

**Recommendation: do it as its own change, on its own branch, after Wave 0 closes**, with the
full suite (including `content.config.test.ts`) and both builds green, and re-audit afterwards.

### The three accepted findings, each with the version it is accepted at

Recorded so the next audit is a comparison and not a re-litigation.

| Finding | Severity | Accepted at version | Remedy | Reason for accepting |
|---|---|---|---|---|
| `astro` — server-island replay, several XSS, host-header SSRF, AVIF RCE, base-stripping authz bypass | critical | **astro 6.4.8** (direct) | `astro@7.3.3` (semver-major) | Major framework bump mid-wave; see above. Exposure is bounded by this site being a **static** build: no server islands, no SSR, no view transitions, no `astro dev` in CI or production, and `output: 'static'` in `astro.config.mjs`. The AVIF path needs image optimization of attacker-supplied images, which this site does not do |
| `sharp` — libvips/libheif CVEs | high | **sharp 0.34.5** (transitive, via astro) | `astro@7.3.3` | Same remedy, same reason. `sharp` runs only at build time, on committed repository images; no user-supplied image ever reaches it |
| `esbuild` — arbitrary file read via the dev server on Windows | low | **esbuild 0.27.7** (transitive, via astro) | `astro@7.3.3` | Same remedy. Requires `astro dev`, which is never run in CI or production; the finding is a developer-workstation concern only |

Floors were raised in `package.json` as well as in the lock, so a fresh resolve cannot walk
back to a vulnerable version, and `npm ci --dry-run` confirms lock and manifest still agree
(CI uses `npm ci`).

> **`npm audit` is not wired into any workflow.** It is run by a human or by a contract, which
> means these numbers are a snapshot, not a guard. Making it a check is a separate decision
> with a real cost — a new advisory can turn a green pipeline red without a line of this
> repository changing — and it is recorded as a recommendation rather than taken unilaterally.

---

## Item 3 — `check:private-links` and F-1

### What was wrong

The pattern was `/(?:href|src)="(\/[^"]*)"/g` — it matched **only links beginning with `/`**.
The guard's own error text says "a link outside `/p/` reaches the PUBLIC origin", and an
absolute off-origin URL is the strongest form of exactly that, and it passed.

It **did** catch its real subject (#27's uniformly unprefixed root-absolute links), so this was
a coverage gap and not a vacuous guard. The timing is what made it matter: the private pages
are authored in another repository, and the satellite stream spent this same wave removing an
off-origin font `<link>` from these very pages (H-5). The satellite now enforces this itself;
the hub's guard is no longer the weaker of the two.

### The constraint that shaped the fix — and why relative links are not simply banned

The staged pages under `_payload/**` are a satellite's own bytes, served verbatim, and they
legitimately carry `href="assets/style.css"`:

```
dist-private/_payload/phd-milestones/site/index.html      href="assets/style.css"
dist-private/_payload/phd-milestones/site/committee.html  href="assets/style.css"
```

Rejecting every relative link would fail the **real** build on a **correct** page — and a
guard that cries wolf on a correct build is switched off within a week, after which it protects
nothing. That is the lesson `check-no-private-in-public.mjs` already paid for with its
bounded-needle rule.

So every link is now **resolved against the page that carries it** and judged on where it lands:

| Verdict | Meaning |
|---|---|
| `off-origin` | resolves to another `scheme://host` — never acceptable here (**F-1 shape 2**) |
| `outside-base` | resolves outside the base: #27's missing prefix, and `../../` escapes (**F-1 shape 3**) |
| `inert` | `#fragment`, `mailto:`, `tel:`, `data:` — fetches nothing off-origin |
| `ok` | lands under the base, and must then point at a file that **exists** |

Resolving also *strengthens* the existing half: a relative link that stays inside the base but
points at nothing is now caught too, which it was not before.

The script gained `--dist` and `--base` flags (matching `check-no-private-in-public.mjs`'s
convention) and a `isMain` guard, so the deliberate failing runs happen against a copy or a
planted build rather than by editing the guard.

---

## Validation

Every transcript below is from a committed fixture (`npm run content:fixture`, which publishes
the two `phd-milestones` private items) or from a temporary tree. **No private content is
quoted.**

### Final state

```
$ npm test
 Test Files  18 passed (18)
      Tests  230 passed | 1 skipped (231)

$ npm run build                       # public
01:09:27 [build] 26 page(s) built in 11.00s
01:09:27 [build] Complete!

$ npm run check:smoke-routes
check:smoke-routes: all 7 smoke routes present in dist-public

$ npm run build:private
01:09:59 [build] 3 page(s) built in 7.61s
01:09:59 [build] Complete!

$ npm run check:private-links
check:private-links: PASS — every link in 5 page(s) resolves under /p/: none off-origin,
none escaping the base, and each points at a file that exists.

$ npm run check:no-private-in-public
check:no-private-in-public: PASS — no private slug, source, route, payload path, title or
summary appears in any path or any file's contents under dist-public (157 files scanned).

$ npm run demo:leak-check
demo:leak-check: the check exited 1 (1 means it caught the leak).
demo:leak-check: PASS — the guard failed on the injected leak, which is what it is for.
The real dist-public was never modified.
```

Baseline before this work: 16 test files, 199 passed. **+2 files, +31 tests.**

### The control is reachable — the half B-8 was actually about

```
$ for f in $(find dist-private -name '*.html' -not -path '*_payload*'); do ... done
dist-private/index.html                                      button=1 error=1
dist-private/phd/phd-milestones/committee-dossier/index.html button=1 error=1
dist-private/phd/phd-milestones/milestones/index.html        button=1 error=1

$ grep -l "session/end" dist-private/_astro/*.js
dist-private/_astro/signout.CI_xtEqO.js
  "/session/end"   present
  same-origin      present
  POST             present

$ forbidden shapes anywhere in dist-private
no-cors             : 0 file(s)
run.app             : 0 file(s)
<a href=session/end : 0 file(s)
```

### Break → red → restore → green

Every break asserted the anchor was **unique before patching**, as the contract requires, and
the expected test is confirmed **by name**. Full transcripts follow in condensed form; each
pair ends with the restored run green.

#### Item 1 — sign-out (`src-private/lib/signout.test.ts`, baseline 13 passed)

**Break 1 — the endpoint becomes an absolute `*.run.app` URL (cross-origin → gate 403)**
```
ANCHOR: 'export const SIGN_OUT_ENDPOINT = "/session/end";'
assert text.count(anchor) == 1  ->  count = 1
  × POSTs to the gate's own path, same-origin
  × names a same-origin PATH, never the gate's *.run.app host
  Tests  2 failed | 11 passed (13)
RESTORED:  Tests  13 passed (13)
```

**Break 2 — the POST becomes a GET (triggerable by an `<img>` tag)**
```
ANCHOR: '  return { method: "POST", credentials: "same-origin" };'
assert text.count(anchor) == 1  ->  count = 1
  × POSTs to the gate's own path, same-origin
  × is a POST and never a GET
  Tests  2 failed | 11 passed (13)
RESTORED:  Tests  13 passed (13)
```

**Break 3 — `mode: "no-cors"` added to silence the error**
```
ANCHOR: '  return { method: "POST", credentials: "same-origin" };'
assert text.count(anchor) == 1  ->  count = 1
  × POSTs to the gate's own path, same-origin
  × sends no body, no token, no custom header and no mode
  Tests  2 failed | 11 passed (13)
RESTORED:  Tests  13 passed (13)
```

**Break 4 — a FAILED sign-out redirects anyway (the member believes they signed out)**
```
ANCHOR: '  if (!response?.ok) {'
assert text.count(anchor) == 1  ->  count = 1
  × reports a refusal and does not redirect
  × reports a missing rewrite (404) and does not redirect
  Tests  2 failed | 11 passed (13)
RESTORED:  Tests  13 passed (13)
```

**Break 5 — the control is removed from the layout. THIS IS THE B-8 DEFECT ITSELF.**
```
ANCHOR: '        <button id="sign-out" type="button" class="sign-out">Sign out</button>'
assert text.count(anchor) == 1  ->  count = 1
  × every private page carries a sign-out control, because they all use this layout
  Tests  1 failed | 12 passed (13)
RESTORED:  Tests  13 passed (13)
```
This is the pair that matters most: had this assertion existed, Wave 0 could not have shipped a
handler, a rewrite and 43 tests with no caller.

**Break 6 — the control is rewritten as an `<a href>` GET instead of a button**
```
ANCHOR: '        <button id="sign-out" type="button" class="sign-out">Sign out</button>'
assert text.count(anchor) == 1  ->  count = 1
  × every private page carries a sign-out control, because they all use this layout
  × contains none of the three shapes that would ship a broken sign-out
  Tests  2 failed | 11 passed (13)
RESTORED:  Tests  13 passed (13)
```

#### Item 3 — the link guard (`scripts/check-private-links.test.ts`, baseline 18 passed)

**Break A — the regex reverted to the pre-F-1 form**
```
ANCHOR: 'export const LINK = /(?:href|src)="([^"]*)"/g;'
assert text.count(anchor) == 1  ->  count = 1
  × FAILS on an absolute off-origin link (F-1 shape 2)
  × FAILS on a relative link that escapes the base (F-1 shape 3)
  × FAILS on a relative link that stays inside the base but resolves to nothing
  × reports only the bad one
  Tests  4 failed | 14 passed (18)
RESTORED:  Tests  18 passed (18)
```

**Break B — the off-origin branch disabled**
```
ANCHOR: '  if (resolved.origin !== SELF) {'
assert text.count(anchor) == 1  ->  count = 1
  × catches an absolute off-origin https link, which used to pass GREEN
  × catches http and protocol-relative off-origin links too
  × catches an off-origin font or stylesheet link — the regression the satellite just removed
  × FAILS on an absolute off-origin link (F-1 shape 2)
  × reports only the bad one
  Tests  5 failed | 13 passed (18)
RESTORED:  Tests  18 passed (18)
```

**Break C — the outside-base branch disabled**
```
ANCHOR: '  if (!resolved.pathname.startsWith(normalizedBase)) {'
assert text.count(anchor) == 1  ->  count = 1
  × still catches ISSUE #27: a root-absolute link that is missing the base
  × catches a relative link that ESCAPES the base, which used to pass GREEN
  × catches a relative escape from a deep page as well
  Tests  3 failed | 15 passed (18)
RESTORED:  Tests  18 passed (18)
```

### Both F-1 shapes planted in the REAL private build — old script vs new

The "old script" is the **committed pre-fix version, extracted with `git show HEAD:…`**, run
from `site/scripts/` so it resolves the same `dist-private`. It was deleted afterwards.

**Shape 2 — `<a href="https://evil.invalid/x">`**, planted in a real private item page:
```
OLD script: exit 0   <-- INVISIBLE. This is F-1, reproduced.
  check:private-links: PASS — every link in 5 page(s) starts with /p/ and resolves to a file that exists.

NEW script: exit 1
  check:private-links: 1 BROKEN LINK(S) in /mnt/c/code/website/site/dist-private:

    phd/phd-milestones/milestones/index.html
      https://evil.invalid/x
        off-origin: points at another origin (https://evil.invalid)
```

**Shape 3 — `<a href="../../elsewhere/">`**, planted in the members' index:
```
OLD script: exit 0   <-- INVISIBLE. This is F-1, reproduced.
  check:private-links: PASS — every link in 5 page(s) starts with /p/ and resolves to a file that exists.

NEW script: exit 1
  check:private-links: 1 BROKEN LINK(S) in /mnt/c/code/website/site/dist-private:

    index.html
      ../../elsewhere/
        outside-base: resolves to /elsewhere/, which is outside /p/
```

**Restored build:**
```
check:private-links: PASS — every link in 5 page(s) resolves under /p/: none off-origin,
none escaping the base, and each points at a file that exists.
exit 0
```

Both shapes fail deliberately, each on its own, with a message that names the shape.

### Executable bits

Verified with `git ls-files -s`, never `ls -l` (this mount reports everything 0777):

```
100755 infra/scripts/check-private-bucket-iam.sh
100755 infra/scripts/seed-members.sh
100755 site/scripts/fetch-data.sh
100755 site/scripts/sync-content.sh
100755 site/scripts/sync-local-data.sh
```

Unchanged. `git diff --summary HEAD -- site/` reports **no mode changes**. `core.fileMode` is
already `false` in this checkout, so the three new files will stage `100644` — which is what
exec-bit rule C requires of an interpreted module. `check-private-links.mjs` gained a
`#!/usr/bin/env node` shebang; it is a `.mjs` staged `100644`, matching
`check-no-private-in-public.mjs` and `demo-leak-check.mjs`, and rule A binds only `*.sh`.
**Confirm with `git ls-files -s site/` after `git add`.**

### Lockfile agreement

```
$ npm ci --dry-run
up to date in 2s
```

---

## Assumptions

1. **The `/session/end` Hosting rewrite lands with `feat/site-wave-0`.** Read, not assumed:
   `git show feat/site-wave-0:firebase.json` carries it; `main` does not. The contract told me
   not to touch `firebase.json`, so this handoff inherits G-R1's merge-order constraint rather
   than resolving it.
2. **The gate answers `{"status":"ok"}` with HTTP 200 on success and 403 on a refused Origin.**
   Read from `git show feat/gate-signout:gate/app/main.py`. The caller branches on
   `response.ok`, not on the body — deliberately different from `/signin/`, which must branch
   on the body because the gate answers a *verified non-member* with 200. Sign-out has no
   equivalent "success that isn't": it answers identically whether or not a session existed.
3. **`/` is a sensible signed-out destination.** It is a public page on the same origin that
   exists and renders for an anonymous visitor. If the owner would rather land members on
   `/signin/`, that is a one-constant change in `signout.mjs` and a one-line test edit.
4. **The scratch Astro 7 trial is representative of the real tree** except for the missing
   sibling `contract/` directory. Stated as a limitation rather than glossed.
5. **`npm audit`'s advisory database is a moving target.** These counts are true as of
   2026-09-19 against this lockfile; they are a snapshot, not an invariant.

---

## Recommendations

1. **Merge order is unchanged and still binding** (G-R1): `feat/site-wave-0` (the rewrite)
   before or with `feat/gate-signout` (the handler). This branch adds the third piece — the
   caller — and is useless through the CDN without the rewrite. A member on `main` + handler +
   caller but no rewrite gets the 404 failure path, visibly, which is the correct behaviour but
   not the intended one.
2. **Re-disposition SD-4 as capability-delivered *and* caller-delivered**, per Chief Reviewer
   recommendation 11 — but keep it open until a **live** sign-out is observed through
   `https://jason.cusati.us`, not just in a build. The live probe is the only thing that settles
   the rewrite, the Origin comparison and the cookie clear together.
3. **Do the `astro` 6 → 7 bump as its own change after Wave 0**, with `content.config.test.ts`
   actually running, and re-audit after. Expected result: 3 → 0.
4. **Decide, explicitly, whether `npm audit` becomes a required check.** It is currently run by
   no workflow, so #56 will recur silently. My recommendation: add it as a **non-blocking**
   reporting step first, with a blocking threshold decided once there is a baseline — a
   blocking audit can turn CI red on a day nobody changed anything.
5. **Add a live sign-out probe to the Checkpoint 5 script**, alongside the gate's P1–P7: click
   the control as a signed-in member, confirm the `__session` cookie is gone, confirm
   `event=allow scope=signout` in Cloud Logging, and confirm the member lands on `/`.
6. **When the gate's Origin repair lands, nothing here needs to change** — but re-run
   `signout.test.ts` and the live probe together anyway, because "no change needed" is a belief
   until something has been observed.

---

## Alternatives considered

- **A `<form method="POST" action="/session/end">` instead of `fetch`.** Genuinely appealing:
  it works without JavaScript, and a form POST is same-origin. Rejected because the gate answers
  JSON, so the browser would navigate to a page showing `{"status":"ok"}` — and, worse, a
  *failure* would navigate to the gate's error page, taking the member away from the members'
  area and making "did that work?" harder to answer, not easier. The failure has to be visible
  *in place*.
- **Putting the control only on the members' index (`/p/`).** Rejected: a member reading an item
  page would have to navigate back to sign out. In the layout it is on every page for the cost
  of one element.
- **Sending the member to `/signin/` after signing out.** Reasonable, and it does confirm the
  state. Rejected for now because a sign-in form is an odd thing to show someone who just asked
  to leave, and it invites an accidental immediate re-sign-in on the shared machine SD-4 is
  about. One constant if the owner disagrees.
- **A confirmation dialog before signing out.** Rejected: sign-out is cheap to undo and
  expensive to skip. A confirm step is friction on the safe action.
- **Reusing `/signin/`'s `say()`/status-line pattern for the error.** Rejected in favour of a
  `role="alert"` region: a sign-out failure is an alert, not a status, and `aria-live="polite"`
  would let it be announced late or not at all.
- **Banning every relative link in `check:private-links`.** Rejected — it would fail the real
  build on the satellite's own correct `href="assets/style.css"`. See Item 3.
- **Checking only `href`/`src` on a fixed element allowlist** (`<a>`, `<link>`, `<script>`,
  `<img>`). Rejected: the attribute is the thing that fetches, whatever carries it, and an
  allowlist is one more list to keep current.
- **`npm audit fix --force`.** Rejected: it *is* the astro 7 bump, applied silently as a side
  effect of a routine command, in a wave with four PRs in flight. If the bump is worth doing it
  is worth doing as a visible change with its own verification.
- **Pinning exact versions instead of raising `^` floors.** Rejected: the lockfile already pins,
  and exact ranges in `package.json` would make every future patch a manual edit.
- **Adding `astro check` to `npm test`.** Out of scope for this contract, and it would change
  what "green" means for every other stream mid-wave.

---

## Risks

1. **Sign-out is still not proven live.** Everything above is a build-time and unit-level proof.
   The gate's cookie clear, the Hosting rewrite and the Origin comparison have never been
   exercised together by a real browser. This is the same epistemic position the `/healthz`
   defect survived four revisions in. **Do not record SD-4 as closed on this handoff alone.**
2. **The three accepted audit findings are accepted on a reachability argument, not a fix.**
   That argument rests on this site being a static build with no SSR, no server islands and no
   `astro dev` in CI. If any of those changes — an SSR adapter, a server island, a dev server in
   a workflow — the acceptance lapses and `astro@7` becomes urgent. Written here so the
   condition is checkable rather than remembered.
3. **A new advisory can change these counts without anything in this repository changing.**
   "3 findings" is true today. It is not a property of this branch.
4. **The link guard now resolves relative links, which is new behaviour on satellite bytes.**
   If a satellite ever ships a page with a relative link to a file it does not also ship, the
   private build will now go **red** where it previously went green. That is the intent, and it
   is also a new way for a satellite's content change to block the hub's deploy (the same shape
   as D-4). The failure message names the file and the resolved path, so it is diagnosable — but
   it is a new coupling and should be expected.
5. **Sign-out does not invalidate a stolen cookie** (gate G-5). Unchanged by this work, and the
   member-facing wording never claims otherwise. It must not be described to the owner as "sign
   out everywhere".
6. **A member with JavaScript disabled cannot sign out.** The control is a button wired by a
   module. The members' area already requires JavaScript for nothing else, so this is a genuine
   new dependency — mitigated only by the fact that the private area is a handful of named
   people on ordinary browsers. The form alternative above is the fix if that assumption breaks.
7. **`recordEvent("signout_failed", …)` adds a new event name** that no log-based metric filters
   on. It is queryable in Cloud Logging but will not alert. Deliberate — adding a metric is
   infra's, not mine — but it means a rash of sign-out failures would be visible only to someone
   looking.

---

## Open questions

1. **Should the member land on `/` or `/signin/` after signing out?** *Evidence that settles it:*
   the owner's preference — this is a product judgement, not a technical one. *What it changes:*
   one constant and one assertion.
2. **Does `POST /session/end` through Firebase Hosting actually arrive with an `Origin` the gate
   accepts?** This is the gate's open question 1 (`Host` vs `X-Forwarded-Host`) seen from the
   caller's side. *Evidence:* the live sign-out probe plus one `--format json` Cloud Logging
   read. *What it unblocks:* deleting the gate's forgeable `X-Forwarded-Host` branch, and
   confirming my call needs no change under the repaired check.
3. **Should `npm audit` gate the build, and at what severity?** *Evidence that would settle it:*
   a few weeks of non-blocking runs showing how often the count moves without a repository
   change. *Why it matters:* #56 recurs silently otherwise.
4. **Should `check:private-links` also assert a minimum page count?** The Skeptic Verifier raised
   this (its open question 4) and it is still open. The guard inspected one page in
   `build-firebase` before the fixture existed, and passed having proved nothing. My change does
   not address it: a build with zero links still passes. *Evidence:* whether any job can reach
   this check with an item-free private build after Wave 0b.
5. **Should the guard also read `srcset`, `<meta http-equiv="refresh">` and CSS `url()`?** Each is
   a way to reach another origin from a private page, and none is checked. I did not widen
   beyond the two shapes F-1 named, deliberately — but the gap is now the *stated* boundary of
   the guard rather than an accident, and the satellite's font `<link>` regression class would
   also have been reachable through CSS `url()`.

---

## Related docs

- `llm/sprints/2026-09-hub/contracts/site-wave-0-fixes.md` — this contract
- `llm/sprints/2026-09-hub/handoffs/gate-wave-0.md` — §Recommendations item 2, the exact call
  and its three hazards; §Risks 5, sign-out is not revocation
- `llm/sprints/2026-09-hub/handoffs/chief-reviewer-wave-0.md` — S-1/B-8, the missing caller
- `llm/sprints/2026-09-hub/handoffs/skeptic-verifier-wave-0.md` — F-1, the three shapes
- `llm/sprints/2026-09-hub/handoffs/regression-wave-0.md` — G-R1, the merge order
- `llm/sprints/2026-09-hub/STATE.md` — §Wave 0 dispositions (B-8 at :803, F-1 at :776, #56 at :750)
- `llm/governance/adr/0004-private-area-cloud-run-gate-behind-hosting.md` — `__session`,
  `allUsers`, cache behaviour
- `llm/governance/adr/0005-two-outputs-one-source-tree.md` — the two builds the link guard protects
- `llm/governance/adr/0011-two-srcdirs-not-a-visibility-filter.md` — do not delete a guard
- `llm/governance/patterns/execution-patterns.md` — the ambiguous-anchor anti-pattern, applied
  to all nine breaks above

---

## ADR candidates

1. **Sign-out is a POST from a module, never a link** — the three forbidden shapes, written as a
   decision rather than as three comments in one file, so the next control that changes session
   state (Phase 4's mint and revoke) inherits the reasoning instead of rediscovering it. Pairs
   with the gate's own Origin-check ADR candidate.
2. **A dependency finding is either fixed or accepted *at a named version*, never "clean"** —
   the acceptance table format above, made the standing rule. This is the audit equivalent of
   ADR-0010's receipt: a record that makes the next audit a comparison.
3. **A guard's coverage boundary is stated, not implied** — F-1 existed because the guard's error
   message claimed more than its regex did. The decision: when a check's message describes a
   class of fault, the check either covers the class or names what it does not cover. Open
   question 5 above is the first application.
4. **A caller-side test may assert the layout's bytes** — `signout.test.ts` reads
   `PrivateBase.astro` to prove the control is rendered. That is unusual and deserves to be a
   deliberate pattern rather than a one-off: it is the only cheap way to catch "the handler has
   no caller", which is this wave's most expensive defect class.
