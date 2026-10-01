# Handoff — `Security Tester`, Wave 1

Agent: Security Tester (independent; authored nothing in this wave)
Contract: `llm/sprints/2026-09-hub/contracts/security-tester-wave-1.md`
Wave: 1 · Issue: #72 (hub-009)
Repo: `/home/djjay/code/website` · branch `feat/satellite-kgis` · HEAD `bf396a6`
Working tree at start and end: clean (`git status --porcelain` empty).

## Summary

I ran the seven checks my contract names. **6 PASS, 0 FAIL, and 1 PASS-with-latent-risk**
(Check 3: the schema guard is real and I proved it red, but the shared staging helper has no
independent containment check). I could not exercise the infrastructure/gate/share items of the
run brief's §6 because this wave changed none of them; they are listed as OUT-OF-SCOPE with
their owning wave, never as a silent PASS.

The two guards this wave actually adds — the public framed-item surface and the untrusted
manifest → public HTML render — behave correctly under attack. The #54 metric-forgery fix is on
this branch and goes red by name when broken. The npm audit is genuinely report-only and its
baseline is a written reachability argument, not a suppression file.

### Verdicts

| # | Check | Verdict |
|---|---|---|
| 1 | Private content on the public path (leak check + grep of dist-public) | **PASS** |
| 2 | Untrusted manifest value injects markup/script into public HTML | **PASS** (no execution; see notes) |
| 3 | Traversal in the new public route / payload URL | **PASS** (pipeline); **latent-risk** in `stagingPlanFor` |
| 4 | Leak check itself goes red on a planted private title | **PASS** (planted, exit 1, restored) |
| 5 | Audit `--report` exits 0; without `--report` exits 1 on a novel advisory | **PASS** |
| 6 | #54 gate suite green; `_neutralise_grammar` break fails by name; restore | **PASS** |
| 7 | Supply chain: no new `uses:`, no new network fetch | **PASS** (one deliberate `npm audit` call — see transcript) |

Totals: **PASS 7 · FAIL 0 · OUT-OF-SCOPE 8** (the §6 items no Wave 1 file touches; enumerated at
the end). No FAIL to report; the one latency is a defense-in-depth recommendation, not an
exploited pathway.

---

## Check 1 — No private content on the public path · PASS

```text
$ npm run content:fixture
> website@0.0.1 content:fixture
> ./scripts/sync-content.sh --from fixtures/content

sync-content: synced 27 object(s) into src/content/sources.
sync-content: provenance local, complete=true.
stage-public-assets: public/pdfs/academic.pdf
stage-public-assets: public/pdfs/research-professional.pdf
stage-public-assets: public/pdfs/anthropic-fellow.pdf
stage-public-assets: public/pdfs/sde-long.pdf
stage-public-assets: public/photo_jason_1.jpeg
=== EXIT 0 ===

$ npm run build:public
...
22:12:48 [hub-public-build] staged 3 payload file(s) for 1 public framed item(s)
22:12:48 [build] 27 page(s) built in 1.67s
22:12:48 [build] Complete!
=== EXIT 0 ===
```

```text
$ npm run check:no-private-in-public
> website@0.0.1 check:no-private-in-public
> node scripts/check-no-private-in-public.mjs

check:no-private-in-public: 3 private item(s) to look for in dist-public:
  phd-milestones/milestones — needles: qualified-id, slug, route, source, payload-path, title, summary
  phd-milestones/committee-dossier — needles: qualified-id, slug, route, source, payload-path, title, summary
  phd-milestones/internal-notes — needles: qualified-id, slug, route, source, payload-path, title, summary

check:no-private-in-public: PASS — no private slug, source, route, payload path, title or summary appears in any path or any file's contents under dist-public (163 files scanned).
=== EXIT 0 ===
```

Direct greps for the private fixture item (`phd-milestones/internal-notes`, title
`Internal Project Notes (fixture)`), escape-free and over the whole output:

```text
$ grep -rn "Internal Project Notes" dist-public/        → (no title match)
$ grep -rln "internal-notes" dist-public/               → (no slug match)
$ grep -rln "phd-milestones" dist-public/               → (no source match)
```

The public `/projects/` index lists manifest items and omits the private `projects` item:

```text
$ grep -o 'href="[^"]*projects[^"]*"' dist-public/projects/index.html | sort -u
href="https://jason.cusati.us/projects/"
href="/projects/"
href="/projects/fixture-one"
href="/projects/fixture-two"
href="/projects/kgis/kgis-docs/"

$ grep -in "internal\|committee\|milestone" dist-public/projects/index.html
(absent)
```

Verdict: **PASS**. The index lists `kgis/kgis-docs` from its manifest alone and contains no trace
of the private `projects` item in any path or file body.

---

## Check 2 — Untrusted manifest value into public HTML · PASS (no execution)

Method: I edited the **gitignored synced copy**
`site/src/content/sources/kgis/manifest.json` (never a tracked file), so the repo could not be
left dirty. Two payloads were placed in the item the public index and the new frame render:

- `title`: `KGIS </h3><script>alert(1)</script> and <img src=x onerror=alert(2)> title`
- `summary`: `SUMMARY </h3><script>alert(3)</script> <a href="javascript:alert(4)">x</a> injection`

The build succeeded (schema accepts both as valid strings, exit 0). The emitted HTML:

```text
$ grep -o '.\{0,20\}alert(1).\{0,40\}' dist-public/projects/index.html
h3&gt;&lt;script&gt;alert(1)&lt;/script&gt; and &lt;img src=x onerro

$ grep -o '.\{0,20\}alert(3).\{0,40\}' dist-public/projects/index.html
h3&gt;&lt;script&gt;alert(3)&lt;/script&gt; &lt;a href=&quot;javascr
```

What the renderer does, precisely:

- **Text contexts are entity-escaped.** `<h1>{item.title}</h1>`, `<p class="summary">`,
  `<title>`, and the `/projects/` list render `&lt;script&gt;` / `&lt;/h3&gt;`; the browser
  parses those as text, not elements.
- **Attribute contexts are quoted, and the breaking character is escaped.**
  `description={item.summary}` becomes `content="SUMMARY </h3><script>alert(3)</script> <a href=&quot;javascript:alert(4)&quot;>x</a> injection"`.
  The inner `"` is escaped to `&quot;`, so the attacker cannot close the attribute. The raw
  `<script>`/`<img>` inside a **quoted** attribute value are inert — HTML parsers do not execute
  markup inside an attribute.
- **No untrusted value reaches a raw-HTML sink.** The frame page never passes `jsonLd`, so
  `Base.astro`'s `set:html={JSON.stringify(jsonLd)}` is not emitted. The only `set:html` on the
  index path is `item.summaryHtml`, which the index populates **only** from the first-party CV
  pool (`mdToHtml(...)`), not from manifest items.
- `og:*` / `twitter:*` / `<iframe title=...>` carry the same raw `<`/`>` inside quoted attributes
  as the meta tags above; inert for the same reason.

Then restored:

```text
$ npm run content:fixture      # re-syncs fixtures/content over the synced tree
$ git status --porcelain       # (empty)
$ grep '"title"' src/content/sources/kgis/manifest.json
      "title": "KGIS Documentation (fixture)",
```

Verdict: **PASS**. A satellite manifest value cannot inject markup or script into a public page:
text is escaped and attributes are quoted with the quote character escaped.

Observation (not a FAIL): the prefix-root staging rule copies the source prefix **including its
`manifest.json`** to `dist-public/_payload/kgis/manifest.json`. For a public-only source that is
harmless, and the leak check scans the file's contents. But a source with a public item at the
prefix root **and** private siblings would publish the siblings' metadata there — the leak check
catches it (exit 1) rather than shipping it, so the guarantee holds; see Risks.

---

## Check 3 — Traversal in the new route / payload URL · PASS, with a latent gap

End-to-end (this is the path that actually runs). I planted real traversal in the synced kgis
manifest, gitignored, then built:

```text
slug: "../evil"
path: "../../etc/passwd"

$ npm run build:public
sources/kgis/manifest.json does not match contract/manifest.schema.json:
  items.0.slug: Invalid string: must match pattern /^[a-z0-9]+(?:-[a-z0-9]+)*$/
  items.0.path: Invalid string: must match pattern /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[^\\\u0000-\u001f]+$/
=== EXIT 1 ===
```

A matrix of crafted values against the mirrored patterns (`source`, `slug` reject every `/`,
`\`, `..`, `%`-encoded slash; `path` rejects leading `/` and any `..` segment):

```text
source  "kgis"                     ACCEPT        slug    "kgis-docs"                ACCEPT
source  "../evil"                  REJECT        slug    "../evil"                  REJECT
source  ".."                       REJECT        slug    "a/b"                      REJECT
source  "a/b"                      REJECT        slug    "a..b"                     REJECT
source  "a%2fb"                    REJECT        slug    "a.."                      REJECT

path    "index.html"               ACCEPT
path    "site/index.html"          ACCEPT
path    "../../etc/passwd"         REJECT
path    "../evil.html"             REJECT
path    "a/../../b"                REJECT
path    "/abs.html"                REJECT
path    "..%2f..%2fevil.html"      ACCEPT   <-- see below
```

`source`/`slug`/`section` are all schema-constrained (`section` is an enum), so a crafted
manifest cannot reach `routeFor`/`payloadUrlFor` in the real build — the build fails first and
`astro:build:done` never runs. Restored; green.

The `%2f` case: the `path` pattern accepts `..%2f..%2fevil.html`. `path.posix.join` /
`path.join` treat `%2f` as three literal characters, so there is **no filesystem traversal** and
the staged object name is literally `..%2f..%2fevil.html`; the served URL is host-dependent if a
host decodes `%2f`, but no file outside the prefix is ever read. Low risk; noted below.

**Latent gap — the helper has no independent containment check.** Calling the shared helper
directly with a crafted `path` (something the schema prevents the build from doing today) walks
the real filesystem:

```text
$ node --input-type=module -e 'import { routeFor, payloadUrlFor, stagingPlanFor } from "./src/lib/frame-content.mjs"; ...'
routeFor    : /../../../evil/../../evil/../../evil/
payloadUrl  : /_payload/../../evil/../../../etc/passwd
plan(to)    : [
  { from: '/etc/.pwd.lock', to: '../etc/.pwd.lock', source: 'kgis' },
  { from: '/etc/.resolv.conf.systemd-resolved.bak', to: '../etc/.resolv.conf.systemd-resolved.bak', source: 'kgis' },
  ...
  ... 2817 more items
]
```

`stagingPlanFor(sourcesDir, [{ source:"kgis", path:"../../../etc/passwd", format:"html" }])`
enumerated `/etc` and produced output-relative `to` paths escaping the output root. The build
pipeline never feeds it unvalidated data (`loadSources()` validates every manifest before
`astro:build:done`, in the same process), so this is **not currently exploitable** — but the
security of the staging step rests *entirely* on the Zod mirror, and `frame-content.test.ts`
does **not** test containment. One future caller that reads a manifest without the loader (or a
schema relaxation) turns this into arbitrary file copy. This is why Check 3 is PASS-with-risk,
not a clean PASS standing alone. Recommendation 1 / ADR candidate below.

Verdict: **PASS** for the shipped pipeline; **latent-risk** recorded.

---

## Check 4 — The leak check itself goes red · PASS

Planted the private title into a real public page, ran the check, then restored (backup in
`/tmp/opencode/`, `dist-public` is gitignored build output):

```text
$ printf '\n<!-- probe: Internal Project Notes (fixture) -->\n' >> dist-public/projects/index.html
$ npm run check:no-private-in-public
check:no-private-in-public: 3 private item(s) to look for in dist-public:
  ...
check:no-private-in-public: 1 LEAK(S) of private content into dist-public:

  projects/index.html
    contents: title of phd-milestones/internal-notes — "Internal Project Notes (fixture)"
    …</p></footer></body></html> <!-- probe: Internal Project Notes (fixture) -->…

The public output must not contain, name or link any private item (ADR-0005, design doc §12.1). Nothing has been deployed.
=== EXIT 1 ===

$ cp /tmp/opencode/projects-index.bak dist-public/projects/index.html   # restore
$ npm run check:no-private-in-public
check:no-private-in-public: PASS — ... (163 files scanned).
=== EXIT 0 ===
$ git status --porcelain
(empty)
```

Verdict: **PASS**. Break → red (exit 1, names the item and the file), restore → green.

---

## Check 5 — npm audit report-only · PASS

```text
$ node scripts/check-npm-audit.mjs --report
check-npm-audit: npm audit --omit=dev reports 0 critical, 4 high, 0 moderate, 0 low.
check-npm-audit: 2 accepted advisory(ies) in the baseline, 0 NEW.
check-npm-audit: no advisory outside the recorded baseline. This guard is REPORT-ONLY in CI (#59); a new finding is information, not yet a merge block.
check-npm-audit: 2 unique advisory(ies) total in this report.
=== EXIT 0 ===
```

Without `--report` on the real audit (0 novel, so exit 0), then a novel advisory through the
exported `classify()` exactly as the contract asks (baseline **not** modified):

```text
$ node scripts/check-npm-audit.mjs          # real audit, 0 novel
check-npm-audit: no advisory outside the recorded baseline.
=== EXIT 0 ===

$ node --input-type=module -e '
import { classify } from "./scripts/check-npm-audit.mjs";
const fakeAudit = { metadata:{vulnerabilities:{critical:0,high:5,moderate:0,low:0,total:5}},
  vulnerabilities:{ "evil-pkg": { severity:"high", via:[ { name:"evil-pkg", severity:"high",
    url:"https://github.com/advisories/GHSA-novel-aaaa-bbbb-cccc", title:"novel RCE" } ] } } };
const baseline = JSON.parse(await (await import("node:fs/promises")).readFile("audit-baseline.json","utf8"));
const { known, novel } = classify(fakeAudit, baseline);
console.log("known:", known.map(a=>a.id));
console.log("novel:", novel.map(a=>a.id));
const report = false;
const code = report || novel.length === 0 ? 0 : 1;
console.log("computed exit code WITHOUT --report:", code);
process.exit(code);'
known: []
novel: [ 'GHSA-novel-aaaa-bbbb-cccc' ]
computed exit code WITHOUT --report: 1
=== EXIT 1 ===
```

The baseline (`site/audit-baseline.json`) is a written decision, not a suppression file: a
`$comment` states the reachability argument ("static build, no SSR, no Node server runtime, and
no Firestore/gRPC calls at build or request time") and each accepted advisory carries its own
`reason`. `site/audit-baseline.json` was **not** changed by this test.

Verdict: **PASS**. `--report` cannot fail (0); without it the exact production exit expression
yields 1 on an advisory outside the baseline.

---

## Check 6 — #54 metric forgery · PASS

Baseline suite:

```text
$ uv run --extra dev pytest            # in gate/
295 passed, 2 warnings in 1.55s
=== EXIT 0 ===
```

I made `_neutralise_grammar` a no-op (removed the `re.sub` replacement, kept the hit count) —
unique anchor `return re.sub(` asserted before editing.

```text
$ uv run --extra dev pytest tests/test_client_events.py -q
E       AssertionError: assert 'event=client_signin_failed' not in 'INFO gate e...nin_failed\n'
E         'event=client_signin_failed' is contained here:
E           ure_class=event=client_signin_failed
FAILED tests/test_client_events.py::test_a_field_value_cannot_smuggle_the_denials_metric_trigger
FAILED tests/test_client_events.py::test_a_field_value_cannot_smuggle_the_signin_failure_metric_trigger
FAILED tests/test_client_events.py::test_the_trace_id_cannot_smuggle_it_either
FAILED tests/test_client_events.py::test_the_event_name_cannot_smuggle_it_either
FAILED tests/test_client_events.py::test_case_does_not_get_it_past
FAILED tests/test_client_events.py::test_a_rejected_report_is_counted_and_kept_not_dropped
=== EXIT 1 ===
```

The specific #54 test fails **by name**: `test_a_field_value_cannot_smuggle_the_denials_metric_trigger`
(the `note=event=deny` case). Restored and re-run:

```text
$ git checkout -- gate/app/main.py
$ grep -n "return re.sub" gate/app/main.py
203:    return re.sub(
$ uv run --extra dev pytest
295 passed, 2 warnings in 1.55s
=== EXIT 0 ===
$ git status --porcelain   # (empty)
```

Verdict: **PASS**. The neutralisation is load-bearing and the unit test proves it.

---

## Check 7 — Supply chain · PASS

```text
$ git diff --stat 87106b7..bf396a6 -- .github site    # 21 files, +906/-232
$ git diff 87106b7..bf396a6 -- .github/workflows | grep -E "^\+.*uses:"      → (none)
$ git diff 87106b7..bf396a6 -- .github/workflows | grep -E "^\+" | grep -iE "uses:|curl|wget|fetch"  → (none)
```

The only workflow change is a `run:` step (`node scripts/check-npm-audit.mjs --report`); no new
`uses:` and therefore no new third-party action to pin.

New/changed build and page files carry no network or exec primitive:

```text
site/src/lib/frame-content.mjs                     (no network/exec primitive)
site/scripts/public-build.mjs                      (no network/exec primitive)
site/src/pages/[section]/[source]/[slug].astro     (no network/exec primitive)
site/src/pages/projects/index.astro                (no network/exec primitive)
site/src/lib/hub-content.mjs                       (no network/exec primitive)

site/scripts/check-npm-audit.mjs
  23: import { spawnSync } from "node:child_process";
  75: const run = spawnSync("npm", ["audit", "--omit=dev", "--json"], { ... });
```

`check-npm-audit.mjs` **does** invoke `npm audit`, which performs a read-only registry lookup.
That is the deliberate, report-only object of #56/#59 and it is **not** on any build/runtime path
(the site build and the pages contain no fetch). Stated rather than hidden: it is a new network
call in CI, by design, non-blocking, and it runs with no credential.

Verdict: **PASS**. No new `uses:`, no new network fetch anywhere on the build/serve path; one
deliberate `npm audit` network call in a report-only CI step.

---

## Supporting runs (not part of the seven, for cross-check)

```text
$ npm test                                  # site, HUB_OUTPUT unset
 Test Files  20 passed (20)
      Tests  263 passed | 1 skipped (264)
=== EXIT 0 ===

$ npm run build:private
[hub-private-build] checked 87 emitted path(s) against the gate's allowlist (SD-7)
[hub-private-build] wrote .hub-private-build.json: 3 private item(s), 87 file(s).
[build] 4 page(s) built
=== EXIT 0 ===
```

---

## §6 items out of scope for Wave 1

The run-brief §6 gate is wider than this wave. Nothing below was touched by a Wave 1 file, so I
did not exercise it and I do **not** report it as PASS. Each is listed with its owner.

| §6 item | Why out of scope | Owning wave/agent |
|---|---|---|
| Private bucket exactly two principals, UBLA + PAP, anonymous GET refused | Infra (`infra/**`) unchanged this wave; verified live by `check-private-bucket-iam.sh` and the boundary proofs | infra / Live Prober |
| Gate refuses signed-out and non-member, identical status on both transports, `private, no-store` under `/p/`, `/s/`, `/share`, `__session` flags | Gate transports unchanged this wave | gate / Wave 0b |
| Traversal suite against the live gate `/p/{path}` allowlist | Gate code unchanged; the *hub-side* staging half is Check 3 | gate / Live Prober |
| Shares: entropy, expiry, revocation, slug escape, non-owner 403, origin check | Feature does not exist yet | Wave 3 (`hub-004`) |
| Identity: no keys, numeric-id + ref pinning, separate satellite pool, no `list`, gate SA roles, deploy identity | Infra/WIF; this wave's branch carries the already-applied `a68feea` | infra |
| Firestore deny-all rules, `members/`/`shares/` unreadable from the Web SDK | Unchanged this wave | gate / Wave 0b |
| Supply chain: every action SHA-pinned across **all satellite repos**, `pip-audit` clean in CI | Other repos / gate deps; only `site`'s npm audit is in this wave | infra / gate |
| Budget guard green; logging `event=` classes reach Cloud Logging, no secret in a log line; repos private by API | Infra/monitoring unchanged this wave | infra / Live Prober |

(#54 and #56/#59 **are** in scope and PASS above.)

---

## Assumptions

- The working tree was clean at `bf396a6` when I started and when I finished
  (`git status --porcelain` empty at both points). Every mutation I made was to a gitignored
  build output or to the gitignored synced content tree, except the explicitly-instructed gate
  sabotage, which I restored with `git checkout -- gate/app/main.py`.
- "No new network fetch" in Check 7 means the build/serve path and shipped pages; `npm audit`'s
  registry call is inherent to the audit feature and is reported in the transcript rather than
  waved away.
- The fixtures are invented (`docs/satellites.md` / contract §Constraints); no production
  private content was read, quoted or published. All private strings used are the committed
  `(fixture)` values.

## Recommendations

1. **Give `stagingPlanFor`/`addFile` an independent containment assertion** (Check 3 latency).
   Resolve every `from` under `path.resolve(sourcesDir, source)` and every `to` under
   `path.resolve(outDir)`, and fail the build if a plan entry escapes its root. Today only the
   Zod mirror stands between a malformed `path` and an arbitrary-file copy; a guard that a
   future caller can bypass by not going through `loadSources()` should not be the only guard.
2. Add a `frame-content.test.ts` case pinning that a `..`-bearing `source`/`path` cannot produce
   a `to`/`from` outside its root (proves Recommendation 1 and the anchor rule).
3. Decide deliberately whether `manifest.json` belongs in `_payload/<source>/`. It is staged by
   the prefix-root rule; for a mixed-visibility prefix it publishes sibling metadata in the
   public build (leak-check-caught, but avoidable by excluding `manifest.json` from staging).
4. Keep the audit report-only until #59's graduation; if it graduates, fail on a **delta**
   against `audit-baseline.json`, never on the absolute count.

## Alternatives considered

- Running Check 2 against the **tracked** fixture and reverting with `git checkout`: rejected in
  favour of editing the gitignored synced copy, which cannot leave the repo dirty even if a step
  fails midway. I still verified `git status` clean at the end.
- Forcing the audit script to exit 1 by editing `audit-baseline.json`: rejected — the contract
  says use `classify()` and do not modify the baseline. I exercised the exported classifier and
  the exact `process.exit(report || novel.length === 0 ? 0 : 1)` expression instead.
- Calling Check 3 a FAIL because the helper escapes when fed unvalidated input: rejected. In the
  shipped build the schema rejects such input before the helper runs (proved red), so the
  pipeline check passes; the helper gap is a defense-in-depth latency, correctly a Risk, not a
  present exposure.

## Risks

- **Latent (medium):** `stagingPlanFor` trusts its `source`/`path` inputs; containment depends on
  the schema mirror being the only caller-visible validator. Any future caller that bypasses
  `loadSources()` gets arbitrary file copy. Recommendation 1.
- **Low:** `manifest.json` staged under `_payload/<source>/`; a public prefix-root item alongside
  private siblings would publish their metadata, caught by the leak check but better excluded.
- **Low:** the `path` pattern accepts `..%2f`; filesystem- and object-name-safe today, but the
  served URL's normalization is host-dependent.
- **Informational:** the audit step adds a registry network call in CI. Non-blocking and
  credential-free.

## Open questions

- Does the owner want the leak check to distinguish a private item's *metadata* in a staged
  public manifest from the item's bytes? Today the answer is "caught, don't ship"; excluding
  `manifest.json` would make it "never happens".
- Should the private build's `findUnservablePaths()` (gate segment allowlist) also run on
  `dist-public`? There is no gate in front of public, so likely not — recorded so the choice is
  explicit.

## Related docs

- `llm/sprints/2026-09-hub/contracts/security-tester-wave-1.md`
- `llm/sprints/2026-09-hub/contracts/site-wave-1.md`
- `llm/sprints/2026-09-hub/handoffs/site-wave-1.md`
- `llm/plans/2026-10-01-completion-brief.md` §6
- `llm/governance/adr/0005-two-output-build-with-leak-check.md`
- `llm/governance/adr/0010-withdrawal-semantics.md`
- `llm/governance/adr/0011-two-srcdirs-not-a-visibility-filter.md`
- issues #54, #56, #59

## ADR candidates

- **Framed-item staging is containment-checked at the output root** (not only schema-checked at
  the input). Records that the staging step refuses to emit `from`/`to` paths outside its roots,
  closing the Check 3 latency independently of the manifest schema.
- **A published source prefix excludes its own `manifest.json` from payload staging.** Removes
  the mixed-visibility over-publication by construction.
- (From the site handoff, now corroborated) `format: html`/`bundle` declares its asset set, so
  staging needs no directory heuristic.
