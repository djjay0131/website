# Handoff — `Red Team`, Wave 1

Agent: Red Team (independent; authored nothing in this wave)
Contract: `llm/sprints/2026-09-hub/contracts/red-team-wave-1.md`
Wave: 1 · Issue: #72
Repo: `/home/djjay/code/website` · branch `feat/satellite-kgis` · HEAD `4c6e2c5`
Working tree at start and end: clean (`git status --porcelain` shows only the pre-existing
untracked `security-tester-wave-1.md`, the pre-existing `skeptic-verifier-wave-1.md`, and this
handoff).

## Summary

I ran **6 attacks** against the Wave 1 surface. Two are clean refusals, one is a low-risk
accepted-input residual, and **three are real bypasses** of guards this wave added or re-tested.
No production deploy is reachable through any of them today, because the ADR-0005 leak check is
in the deploy path and catches every private-byte case — but "caught by the backstop after the
fail-closed rule already failed open" is not the same as "refused", and three of the findings are
exactly that shape.

| # | Attack | Verdict | Headline |
|---|--------|---------|----------|
| 1 | Prefix escape through the new public frame | **BYPASSED (partial)** | `mixedSourceError` misses `path: "./index.html"`; private bytes stage, leak check catches |
| 2 | Public→private reach (`/projects/`, frame, sitemap, payload) | **REFUSED** | no trace of `phd-milestones/internal-notes` anywhere |
| 3 | Allowlist/bypass tricks in section/source/slug/path | **PARTIAL** | casing/Unicode/dot-segments refused; `path` accepts `./` and `..%2f` |
| 4 | Leak-check evasion (entity / ZWSP / JSON escape) | **BYPASSED** | a browser-readable title the grep cannot see |
| 5 | Audit-baseline abuse (`classify()`/`collectAdvisories()`) | **BYPASSED** | id collision / severity escalation / string-`via` all green |
| 6 | Metric forgery #54 (`note=event=deny`) | **BYPASSED** | split key/value `{event: deny}` forges both metric triggers; 295 tests still pass |

Attack 1 has two distinct halves worth separating: the **helper-level escape** (`stagingPlanFor`
emits `to` outside `_payload/<source>/` for a crafted `source`) and the **fail-open guard bypass**
(`mixedSourceError` returns `null` for `./index.html` while the staging plan treats it as the
prefix root and copies the whole source prefix, private bytes included). The second is the
actionable one.

Baseline established before any attack, on the unmodified tree:

```
$ npm run content:fixture && npm run build:public
[hub-public-build] staged 3 payload file(s) for 1 public framed item(s)
[build] 27 page(s) built in 1.42s
=== EXIT 0 ===

$ npm run check:no-private-in-public
check:no-private-in-public: PASS — ... (163 files scanned).
=== EXIT 0 ===

$ npm run build:private
[hub-private-build] staged 4 payload file(s) for 3 private item(s)
[hub-private-build] checked 87 emitted path(s) against the gate's allowlist (SD-7)
=== EXIT 0 ===

$ npm test
 Test Files  21 passed (21)
      Tests  268 passed | 1 skipped (269)
=== EXIT 0 ===

$ uv run --extra dev pytest          # in gate/
295 passed, 2 warnings in 1.34s
=== EXIT 0 ===
```

---

## Attack 1 — Prefix escape through the new public frame · BYPASSED (partial)

**Hypothesis.** A crafted manifest `path`/`slug`/`section`/`source` can make `public-build.mjs`
stage a file outside `_payload/<source>/`, overwrite another source's staged bytes, or make the
new fail-closed `mixedSourceError` return `null` while the staging plan stages private bytes.

### 1a. End-to-end: schema and the loader **refuse** an escaping `source`

I planted a gitignored source `src/content/sources/evil/` whose manifest claimed a different
`source` (prefix mismatch), then built.

```
$ npm run build:public
sources/evil/manifest.json breaks the publishing contract:
  source: the manifest says "kgis" but it was published under the prefix sources/evil/. ...
=== EXIT 1 ===
```

Then with `"source": "../cv"`:

```
$ npm run build:public
sources/evil/manifest.json does not match contract/manifest.schema.json:
  source: Invalid string: must match pattern /^[a-z][a-z0-9-]{0,38}$/
=== EXIT 1 ===
```

The manifest is restored with `npm run content:fixture` (the synced tree is gitignored).
**REFUSED** for the shipped pipeline. `public-build.mjs` itself reads manifests without
validating, but the content collection's `load()` validates every manifest in the same build
before `astro:build:done` runs, so the unvalidated read is covered.

### 1b. Helper level: `stagingPlanFor` does **not** contain `to` to `_payload/<source>/`

```text
$ node --input-type=module -e '
import { stagingPlanFor, PAYLOAD_ROOT } from "./src/lib/frame-content.mjs";
const root = process.argv[1] + "/sources";
for (const item of [
  { source: "../cv", slug: "x", section: "projects", format: "html", path: "index.html" },
  { source: "../outside", slug: "x", section: "projects", format: "html", path: "secret.html" },
]) {
  const plan = stagingPlanFor(root, [item]);
  console.log(JSON.stringify(plan));
  console.log("escapes _payload/:", JSON.stringify(plan.filter(p => !p.to.startsWith(PAYLOAD_ROOT + "/"))));
}' "$D"
```

Verbatim result (throwaway tree under `/tmp/opencode`):

```
[{"from":"/tmp/opencode/rt1.obmIfa/cv/index.html","to":"cv/index.html","source":"../cv"}]
escapes _payload/: [{"from":"/tmp/opencode/rt1.obmIfa/cv/index.html","to":"cv/index.html","source":"../cv"}]
[{"from":"/tmp/opencode/rt1.obmIfa/outside/secret.html","to":"outside/secret.html","source":"../outside"}]
escapes _payload/: [{"from":"/tmp/opencode/rt1.obmIfa/outside/secret.html","to":"outside/secret.html","source":"../outside"}]
```

The `addFile` containment check guards `from` (the security tester's latency); it does **not**
guard `to`, and `mixedSourceError` does not inspect `source` at all. A future caller that skips
`loadSources()` gets arbitrary copy into `dist-public/<anything>`. Today the schema is the only
thing standing between this and the build. **BYPASSED at helper level.**

### 1c. The fail-open: `mixedSourceError` misses `./index.html` while staging treats it as the prefix root

`mixedSourceError` classifies a "prefix-root" framed item with `!i.path.includes("/")`.
`stagingPlanFor` classifies it with `path.posix.dirname(rel) === "."`. For `path: "./index.html"`
the two disagree: the guard thinks it is a named subdirectory, the staging plan thinks it is the
prefix root and copies the **whole source prefix**, private bytes included. I planted a gitignored
source with one private item and one public `./index.html`:

```json
{
  "source": "mixedtest",
  "items": [
    { "slug": "mix-secret", "section": "phd", "format": "html", "path": "secret.html", "visibility": "private", ... },
    { "slug": "mix-public", "section": "projects", "format": "html", "path": "./index.html", "visibility": "public", ... }
  ]
}
```

```
$ node --input-type=module -e 'import { mixedSourceError } from "./scripts/public-build.mjs"; ...'
  mixedSourceError -> null                      # <-- fail-closed rule did NOT fire

$ npm run build:public
[hub-public-build] staged 6 payload file(s) for 2 public framed item(s)
[build] 28 page(s) built in 1.32s
=== EXIT 0 ===

$ ls -l dist-public/_payload/mixedtest/
-rw-rw-r-- 1 djjay djjay  22 index.html
-rw-rw-r-- 1 djjay djjay 525 manifest.json
-rw-rw-r-- 1 djjay djjay  33 secret.html        # <-- PRIVATE BYTES STAGED

$ grep -rl "PRIVATE BYTES THAT MUST NOT SHIP" dist-public/
dist-public/_payload/mixedtest/secret.html
```

The ADR-0005 backstop then fires, and it is in the deploy path
(`.github/workflows/build.yml:1088`, between build and `upload-pages-artifact`):

```
$ npm run check:no-private-in-public
check:no-private-in-public: 12 LEAK(S) of private content into dist-public:
    path: source of mixedtest/mix-secret — "mixedtest"
    contents: slug of mixedtest/mix-secret — "mix-secret"
    contents: payload-path of mixedtest/mix-secret — "secret.html"
    contents: title of mixedtest/mix-secret — "Mix Secret (fixture)"
    contents: summary of mixedtest/mix-secret — "private fixture bytes"
    ...
=== EXIT 1 ===
```

Restored with `npm run content:fixture` + `npm run build:public`; leak check `PASS`; tree clean.

**Verdict: BYPASSED (partial).** The Wave 1 fail-closed guard is evadable with a schema-legal
`./index.html`; the private bytes reach `dist-public` and only the leak check stops them. The
existing `public-build.test.ts` only exercises `"index.html"` (no `./`) and `"site/index.html"`, so
this spelling is untested.

---

## Attack 2 — Public→private reach · REFUSED

**Hypothesis.** `/projects/`, the new frame route, the sitemap, or a payload exposes
`phd-milestones/internal-notes` (title "Internal Project Notes (fixture)").

```
$ npm run build:public
[hub-public-build] staged 3 payload file(s) for 1 public framed item(s)
=== EXIT 0 ===

$ grep -rin "internal-notes" dist-public            → (no match)
$ grep -rin "Internal Project Notes" dist-public    → (no match)
$ grep -rin "phd-milestones" dist-public            → (no match)
$ ls -d dist-public/projects/phd-milestones          → (absent)
$ ls -d dist-public/_payload/phd-milestones          → (absent)
$ grep -o "phd-milestones\|internal-notes" dist-public/sitemap*.xml → (no match)

$ grep -o 'href="[^"]*"' dist-public/projects/index.html | sort -u
href="/"
href="/_astro/Base.BfMvFH-d.css"
href="/cv/"
href="/favicon.svg"
href="https://github.com/example/fixture-one"
href="https://jason.cusati.us/projects/"
href="#main-content"
href="/papers/"
href="/projects/"
href="/projects/fixture-one"
href="/projects/fixture-two"
href="/projects/kgis/kgis-docs/"
href="/research/"
href="/resumes/"
href="/signin/"
href="/writing/"
```

The private `projects` item is omitted from the index, has no frame route, has no sitemap entry,
and has no payload directory. `collectPublicItems` filters on `visibility === "public"` and the
route `getStaticPaths` filters the same way, so the two agree. **REFUSED.**

---

## Attack 3 — Allowlist/bypass tricks · PARTIAL

**Hypothesis.** Casing, Unicode, dot-segments or HTML-entity encoding in `section`/`source`/`slug`
(or `path`) reaches a private item or an unintended path.

Matrix through the real entry point `validateManifest()`:

```
section casing             REFUSED
section trailing NUL       REFUSED
section entity             REFUSED
source casing              REFUSED
source fullwidth           REFUSED
source zero-width          REFUSED
source dot                 REFUSED
slug casing                REFUSED
slug underscore            REFUSED
slug dot-segment           REFUSED
slug slash                 REFUSED
slug encoded slash         REFUSED
slug entity                REFUSED
slug zero-width            REFUSED
slug unicode homoglyph     REFUSED
visibility casing          REFUSED
visibility missing         REFUSED
path dot-segment           REFUSED
path leading dot           ACCEPTED (!!)
path abs                   REFUSED
path encoded traversal     ACCEPTED (!!)
```

Two accepted forms:

```
payloadUrlFor({ source:"kgis", section:"projects", format:"pdf", path:"..%2f..%2fetc%2fpasswd" })
  -> /_payload/kgis/..%2f..%2fetc%2fpasswd
```

- `path: "./index.html"` is accepted and is the Attack 1c fail-open.
- `path: "..%2f..%2fetc%2fpasswd"` is accepted by the pattern. Node treats `%2f` as three literal
  characters, so there is **no filesystem traversal**: `stagingPlanFor` with `format:"pdf"` returns
  `[]` (the literal filename does not exist). Low risk, but the served URL is host-dependent if a
  fronting host decodes `%2f` before resolving. This is a residual, not an exploit.

`routeFor` with a slug containing `/` (schema would refuse) yields `/projects/kgis/../evil/`, i.e.
the helper has no independent sanitisation — same shape as the `to` gap in Attack 1b.
**Verdict: PARTIAL** (casing/Unicode/dot-segment/entity refused; `./` and `%2f` accepted).

---

## Attack 4 — Leak-check evasion · BYPASSED

**Hypothesis.** A private title split with an HTML entity, a zero-width char, or JSON escaping is
read by a browser while `check-no-private-in-public.mjs` misses it.

Method: append the payload to the gitignored `dist-public/projects/index.html`, run the check,
restore from a `/tmp` backup. The control (raw title) correctly leaks.

```
### A HTML entity in a title letter (&#111; = o)
check:no-private-in-public: PASS — no private ... appears ... (163 files scanned).
    check exit=0
### B raw title (CONTROL)
check:no-private-in-public: 1 LEAK(S) of private content into dist-public:
    check exit=1
### B2 zero-width space U+200B inside the title
check:no-private-in-public: PASS — no private ... appears ... (163 files scanned).
    check exit=0
### C JSON/JS unicode escape of the title (\u006f)
check:no-private-in-public: PASS — no private ... appears ... (163 files scanned).
    check exit=0
### restored
check:no-private-in-public: PASS ...
    restored check exit=0
```

A browser/parser reads each as the title:

```
entity decoded === title : true "Internal Project Notes (fixture)"
json  decoded === title : true "Internal Project Notes (fixture)"
strip-ZWSP === title     : true
```

The check adds a `title-escaped` needle via `htmlEscape()`, but `htmlEscape` only escapes
`& < > " '`; it never **decodes** entities, and it has no zero-width or JSON-escape notion. The
written LIMITS in the file name binary files, prose-without-metadata, and prose slugs — not this.
**BYPASSED.** This is a limit of the check, not a live leak (no public page emits a private title
in this build); it matters only when a leak exists by some other route — which is precisely when
the check must work.

---

## Attack 5 — Audit-baseline abuse · BYPASSED

**Hypothesis.** `check-npm-audit.mjs` reports green for a genuinely new high advisory (duplicate
id, same package, hidden package). Exercised through the exported `classify()` /
`collectAdvisories()`, baseline read-only.

```
accepted[0].id = GHSA-m9gg-hp2v-232j

### 1 genuinely-new HIGH reusing an accepted id (different pkg/title)
  collectAdvisories -> [ 'GHSA-m9gg-hp2v-232j(high)' ]
  known: [ 'GHSA-m9gg-hp2v-232j' ] novel: []
  CI exit WITHOUT --report (would-be): 0

### 2 genuinely-new HIGH on the SAME package, fresh id
  known: [] novel: [ 'GHSA-brand-new-1111' ]
  CI exit WITHOUT --report (would-be): 1        # correctly caught

### 3 accepted id re-published as CRITICAL (severity escalation)
  collectAdvisories -> [ 'GHSA-m9gg-hp2v-232j(critical)' ]
  known: [ 'GHSA-m9gg-hp2v-232j' ] novel: []
  CI exit WITHOUT --report (would-be): 0

### 4 spoofed via.url ending in an accepted GHSA
  known: [ 'GHSA-m9gg-hp2v-232j' ] novel: []
  CI exit WITHOUT --report (would-be): 0

### 5 advisory only named as a via STRING (object omitted)
  collectAdvisories -> []  known: [] novel: []
  CI exit WITHOUT --report (would-be): 0

### 6 metadata claims high:99 but no via objects
  collectAdvisories -> []  known: [] novel: []
  CI exit WITHOUT --report (would-be): 0
```

`classify()` keys the accepted set on `id` alone. It never checks that the accepted entry's
`package`/`path`/`severity` matches the finding. So:

- an advisory that reuses an accepted id (cases 1, 4 — including a spoofed `via.url` that merely
  ends in an accepted GHSA, per `advisoryIdFromUrl`) is `known`;
- an accepted advisory **escalated to critical** (case 3) is invisible;
- an advisory that appears only as a `via` string is dropped entirely (cases 5, 6), and the
  `metadata.vulnerabilities` counts are printed but never gate the exit code.

Today this is non-blocking (`--report` in CI), so the concrete impact lands only after #59
graduates the check to blocking. But the baseline is the graduation artifact, and it is abusable
in its current shape. Case 2 shows the guard does catch a fresh id on the same package, so the
issue is specifically id identity, not package hiding. **BYPASSED (latent until graduation).**

---

## Attack 6 — #54 metric forgery · BYPASSED

The contract says the live re-test is optional and the gate suite is acceptable; I used the gate
suite **plus** an in-process run of the real endpoint (read-only; no file mutated).

**Hypothesis.** `note=event=deny` no longer moves the metric.

Existing tests pass, and the literal single-value payload is correctly neutralised:

```
$ uv run --extra dev pytest
295 passed, 2 warnings in 1.34s

CONTROL (note=event=deny in ONE value):
   'INFO gate event=client_grammar_rejected trace=t smuggled=1 reported=probe note=event-deny'
```

But `client_events()` neutralises the field **key** and the field **value** independently and then
joins them with `=` (`app/main.py:522-532`). Splitting the grammar across the two reintroduces it:

```
$ uv run --extra dev python -c '... real TestClient, gate handler buffer ...'

SPLIT-KEY fields {event: deny}:
   'INFO gate event=client_probe trace=t event=deny'
   contains event=deny              : True

SPLIT-KEY fields {event: client_signin_failed}:
   'INFO gate event=client_probe trace=t event=client_signin_failed'
   contains event=client_signin_failed: True
```

An anonymous caller posts
`{"events":[{"event":"probe","fields":{"event":"deny"}}]}` and the gate writes
`event=deny` into `textPayload`; the denials metric filter (`textPayload:"event=deny"`) matches.
The same with `{"event":"client_signin_failed"}` forges the sign-in-failure metric. The 295-test
suite is green because every #54 test puts `event=` **inside a single value**
(`test_client_events.py`), never across key and value. **BYPASSED.** This is the most serious
finding in the wave: it is the exact class of forgery #54 exists to close, and the fix is one
join away from complete.

---

## Assumptions

- "Clean tree" means no tracked file changed (`git diff` empty); the synced content tree,
  `dist-public`, `dist-private` and `public/pdfs` are gitignored and were rebuilt/restored from
  `fixtures/content` at the end. The only untracked files are the two pre-existing handoffs and
  this one.
- All private strings used are the committed `(fixture)` values; no production content was read or
  quoted.
- Attack 6's live re-test was substituted by (a) the gate suite and (b) an in-process FastAPI
  `TestClient` run of the real `/client-events` handler with the gate's own log buffer. No cloud,
  git, gh, gcloud, terraform or firebase mutation was made.
- The `./index.html` end-to-end run used a gitignored throwaway source, never a tracked fixture.

## Recommendations

1. **Fix #54's split-key/value forgery first.** Neutralise the assembled `key=value` string (or
   forbid a key that is exactly `event`, or escape the `=` join). Add a regression test with
   `fields: { event: "deny" }` and `fields: { event: "client_signin_failed" }` to
   `test_client_events.py`.
2. **Close the `mixedSourceError` / `stagingPlanFor` classification mismatch.** Use the *same*
   prefix-root predicate in both (`path.posix.dirname(normalizeRel(path)) === "."`), or have
   `stagingPlanFor` return the root decision and `mixedSourceError` consume it. Add
   `path: "./index.html"` to `public-build.test.ts`.
3. **Give `stagingPlanFor` an independent `to`-containment and `source`-shape check** (its `from`
   check exists; `to` and `source` are unguarded). Reject a `source` containing `/`, `\`, `..`, or
   not matching the schema pattern, rather than trusting the caller.
4. **Decode-aware leak needles, or state the limit.** Either add decoded/entity-stripped and
   zero-width-stripped variants of title/summary to `needlesFor()`, or write "entity-encoded,
   zero-width and JSON-escaped spellings of a title are not matched" into the LIMITS list so the
   guarantee is not overstated.
5. **Make the audit baseline match on `(id, package, path)` and surface severity changes.** If the
   check is to graduate (#59), a novel/upgraded finding must not be hideable by id reuse; treat a
   metadata count with no corresponding advisory as a parse anomaly.

## Alternatives considered

- Declaring Attack 1c a clean FAIL: rejected. The leak check is demonstrably in the deploy path
  (`build.yml:1088`, before the artifact upload) and caught the staged private bytes, so nothing
  ships. It is a fail-open guard bypass with a working backstop — correctly a bypass finding, not a
  shipped leak.
- Calling Attack 4 a non-finding because "nothing leaks today": rejected. The contract asks whether
  the check can be evaded; it can, and the evasion is not in the file's own written LIMITS.
- Forcing Attack 5 to exit non-zero by editing `audit-baseline.json`: rejected; the contract says
  use `classify()` and do not modify the baseline, and I did not.
- Editing a gate test to prove Attack 6: rejected (I may write one file only). The in-process
  handler run is stronger than a unit test — it exercises the real route end to end.

## Risks

- **High:** the #54 bypass is a working, unauthenticated metric-poisoning primitive against both
  log-based metrics. It does not read private data, but it corrupts the operational signals the
  monitoring contract depends on.
- **Medium:** the `mixedSourceError` bypass means the Wave 1 fail-closed rule can be silently
  defeated; safety then rests entirely on the leak check's needle set (Attack 4 shows that set is
  evadable for titles). The two bypasses compose: stage private bytes via `./index.html`, and the
  only thing that catches them is a grep whose title matching is entity-evadable.
- **Medium:** `stagingPlanFor` trusts `source`; any future caller bypassing `loadSources()` gets
  arbitrary copy to an output-relative path.
- **Low:** `path` accepts `./` and `%2f`-encoded traversal; host-dependent URL only.
- **Low (latent):** the audit baseline is id-keyed; impact activates when #59 makes it blocking.

## Open questions

- Should `mixedSourceError` and `stagingPlanFor` share one prefix-root predicate (one declaration
  of the fact), or should staging return the root flag for the guard to read?
- For #54, is the intended invariant "no line may contain `event=deny`" or "the assembled field
  pair may not form the grammar"? The split-key case shows the current implementation assumes the
  former while the code constructs the latter.
- Should the leak check fail **closed** on a text file it cannot decode (currently it reads UTF-8
  and greps raw bytes), so an undecodable file is a warning rather than a silent pass?
- Is #54 owned by Wave 1 sign-off or Wave 0b/gate? The contract lists it as a re-test; the bypass
  is in `gate/app/main.py`, unchanged by this wave.

## Related docs

- `llm/sprints/2026-09-hub/contracts/red-team-wave-1.md`
- `llm/sprints/2026-09-hub/contracts/site-wave-1.md`
- `llm/sprints/2026-09-hub/handoffs/site-wave-1.md`
- `llm/sprints/2026-09-hub/handoffs/security-tester-wave-1.md`
- `llm/governance/adr/0005-two-output-build-with-leak-check.md`
- `llm/governance/adr/0010-withdrawal-semantics.md`
- `llm/governance/adr/0011-two-srcdirs-not-a-visibility-filter.md`
- issues #54, #56, #59

## ADR candidates

- **The prefix-root predicate has one declaration, shared by the guard and the staging plan.**
  Records that `mixedSourceError` and `stagingPlanFor` must not classify the same `path`
  differently (closes Attack 1c by construction).
- **`stagingPlanFor` contains both `from` and `to` (and validates `source`) at its own boundary.**
  Extends the security tester's ADR candidate from `from`-only to the full plan.
- **The leak check's needle set is defined against decoded text, not raw bytes.** Records that an
  entity/zero-width/JSON-escape spelling is either matched or explicitly out of scope.
- **A log-based metric trigger is matched against the assembled log line, not per field.** Records
  that #54's neutralisation must run after field assembly, not before.
