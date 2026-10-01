# Handoff — `Skeptic Verifier`, Wave 1

Agent: Skeptic Verifier (independent; authored nothing in this wave)
Contract: `llm/sprints/2026-09-hub/contracts/skeptic-verifier-wave-1.md`
Wave: 1 · Issue: #72 · Branch: `feat/satellite-kgis` · HEAD: `4c6e2c5`

## Summary

All six assigned Wave 1 guards are **breakable**. Each was anchored uniquely
first, broken with a minimal edit, shown red **by the specific test name**,
restored with `git checkout -- <file>`, and shown green again. **No un-failable
guard was found** in this wave. `npm test` is green before and after
(268 passed, 1 skipped, 21 files). `audit-baseline.json` was never modified.

> Scope note. The contract and the assignment list the guards differently at
> positions 5 and 6. The contract's #5 is "make `public-build.mjs` skip html
> items and show the iframe target 404s"; its #6 is "`_neutralise_grammar`
> (#54), remove and show `gate/tests/test_client_events.py` fails". The
> assignment's #5 is `mixedSourceError` returns null and its #6 is the
> `frame-content` containment check. **This verifier executed the assignment's
> list verbatim**, which is the operative instruction. The two contract items
> were not executed and are therefore **unverified**, not passed.

## Per-guard results

| # | Guard | Edit | Failing test name | Restored? |
|---|-------|------|-------------------|-----------|
| 1 | `frame-content.test.ts` prefix-root staging | replaced the `root: true` dir registration with `addFile(staged, sourcesDir, item.source, rel)` | `stages the sibling stylesheet the manifest never names` | yes |
| 2 | `collectPublicItems` private filter | `if (item?.visibility !== "public")` → `if (item?.visibility === "public")` | `leaves a PRIVATE item in the same section out` | yes |
| 3 | Leak check over a private `projects` item | appended `<!-- Internal Project Notes (fixture) -->` to `dist-public/projects/index.html` | CLI exit 1 (no named test) | yes |
| 4 | `check-npm-audit classify()` novel advisory | none — fed fake reports via `node --input-type=module -e` | n/a (assertion script) | n/a (baseline untouched) |
| 5 | `public-build.mjs` `mixedSourceError` | inserted `return null;` as the function's first statement | `SHOWS RED on a private item plus a prefix-root framed public item` | yes |
| 6 | `frame-content` containment guard | removed `if (from !== prefixRoot && !from.startsWith(prefixRoot + path.sep)) return;` | `` does not stage a file reached by `..` `` | yes |

## Guard 1 — prefix-root staging

Anchor uniqueness: `grep -c 'root: true' src/lib/frame-content.mjs` → `1`.

Exact edit (`src/lib/frame-content.mjs`, in `stagingPlanFor`):

```diff
-      dirs.set(`${item.source} ${""}`, { source: item.source, dir: "", root: true });
-      continue;
+      addFile(staged, sourcesDir, item.source, rel);
+      continue;
```

Verbatim failing output (`npx vitest run src/lib/frame-content.test.ts -t "sibling stylesheet"`):

```
 FAIL  src/lib/frame-content.test.ts > a framed item whose path is at the PREFIX ROOT is a built site > stages the sibling stylesheet the manifest never names
AssertionError: expected [ '_payload/kgis/index.html' ] to include '_payload/kgis/assets/style.css'
 ❯ src/lib/frame-content.test.ts:46:16
```

Restore: `git checkout -- src/lib/frame-content.mjs`; re-run → `1 passed | 8 skipped`.

## Guard 2 — `collectPublicItems` returns private items

Anchor uniqueness: `grep -c 'if (item?.visibility !== "public") continue;' src/lib/frame-content.mjs` → `1`.

Exact edit (`src/lib/frame-content.mjs`, in `collectPublicItems`):

```diff
-      if (item?.visibility !== "public") continue;
+      if (item?.visibility === "public") continue;
```

Verbatim failing output (`npx vitest run src/lib/frame-content.test.ts -t "PRIVATE item"`):

```
 FAIL  src/lib/frame-content.test.ts > collectPublicItems builds a section index from manifests (D7) > leaves a PRIVATE item in the same section out
AssertionError: expected true to be false // Object.is equality
 ❯ src/lib/frame-content.test.ts:71:60
```

Note: this also makes `lists kgis-docs under projects, from its manifest alone`
fail (`internal-notes` is injected into the index), which reconfirms the public
index and the private filter are the same code path.

Restore: `git checkout -- src/lib/frame-content.mjs`; re-run → `1 passed | 8 skipped`.

## Guard 3 — leak check flags a planted private `projects` title

Anchor: `dist-public/projects/index.html` exists and is gitignored
(`git check-ignore dist-public` → `dist-public`). File backed up to
`/tmp/opencode/projects-index.html.bak`, then appended:

```
<!-- Internal Project Notes (fixture) -->
```

Verbatim output (`node scripts/check-no-private-in-public.mjs`):

```
check:no-private-in-public: 1 LEAK(S) of private content into dist-public:

  projects/index.html
    contents: title of phd-milestones/internal-notes — "Internal Project Notes (fixture)"
    …in</a></p></footer></body></html> <!-- Internal Project Notes (fixture) -->…

The public output must not contain, name or link any private item (ADR-0005, design doc §12.1). Nothing has been deployed.

EXIT=1
```

Restore: copied the backup back; re-run → `PASS … (163 files scanned)`, `EXIT=0`.

## Guard 4 — `classify()` surfaces a novel advisory

No repository file edited. Fake reports fed via inline module evaluation;
`audit-baseline.json` read-only.

Verbatim output (`node --input-type=module -e '…'`):

```
STEP1 novel.length = 1 | known.length = 0 | novel = ["GHSA-novel-xxxx-yyyy"]
STEP2 removed from COPY: GHSA-f596-whhp-79r4 -> novel.length = 1 | novel = ["GHSA-f596-whhp-79r4"]
```

Step 1 proves a GHSA outside the baseline is classified `novel` (length 1).
Step 2 proves removing one accepted id from an **in-memory copy** of the
baseline makes the previously accepted advisory surface as `novel`. The real
`audit-baseline.json` was not touched (`git diff` empty).

## Guard 5 — `mixedSourceError` returns null always

Anchor uniqueness: `grep -c 'const hasPrivate = items.some' scripts/public-build.mjs` → `1`.

Exact edit (`scripts/public-build.mjs`, in `mixedSourceError`):

```diff
+  return null;
   const hasPrivate = items.some((i) => i?.visibility === "private");
```

Verbatim failing output (`npx vitest run scripts/public-build.test.ts -t "SHOWS RED"`):

```
 FAIL  scripts/public-build.test.ts > mixedSourceError refuses to stage a folder that may hold private bytes > SHOWS RED on a private item plus a prefix-root framed public item
TypeError: .toMatch() expects to receive a string, but got object
 ❯ scripts/public-build.test.ts:18:19
```

Restore: `git checkout -- scripts/public-build.mjs`; re-run → `1 passed | 3 skipped`.

## Guard 6 — containment check removal

Anchor uniqueness: `grep -c 'if (from !== prefixRoot && !from.startsWith' src/lib/frame-content.mjs` → `1`.

Exact edit (`src/lib/frame-content.mjs`, in `addFile`):

```diff
-  if (from !== prefixRoot && !from.startsWith(prefixRoot + path.sep)) return;
   if (!fs.existsSync(from)) return;
```

Verbatim failing output (`npx vitest run src/lib/frame-content.test.ts -t "reached by"`):

```
     × does not stage a file reached by `..` 11ms
 FAIL  src/lib/frame-content.test.ts > staging is contained to the source prefix > does not stage a file reached by `..`
AssertionError: [{"from":"/tmp/escape-ZCt6Bw/outside/secret.html","to":"_payload/outside/secret.html","source":"kgis"}]: expected [ { …(3) } ] to deeply equal []
 ❯ src/lib/frame-content.test.ts:99:42
```

The escaped file `outside/secret.html` is staged, and `path.posix.join`
collapses `_payload/kgis/../outside/secret.html` to
`_payload/outside/secret.html` — the guard fails closed only because of the
removed line. Restore: `git checkout -- src/lib/frame-content.mjs`; re-run →
`1 passed | 8 skipped`.

## Final tree state

```
$ npm test
 Test Files  21 passed (21)
      Tests  268 passed | 1 skipped (269)

$ git status --short
?? ../llm/sprints/2026-09-hub/handoffs/security-tester-wave-1.md
```

`git diff` is empty. Every file edited by this verifier was restored exactly.
The one untracked file shown is the pre-existing `security-tester-wave-1.md`
handoff, which this verifier did not author; the only file this verifier
created is this handoff.

## Assumptions

- The assignment's guard list is operative where it diverges from the contract's
  (positions 5 and 6); see the Summary note.
- Guard 3 edits a gitignored build artifact, not a tracked file. "Restore" there
  means byte-for-byte copy-back from a `/tmp` backup, verified by a clean PASS
  over the same 163 files.
- "Failing by name" for Guard 3 is the CLI's exit code and LEAK report; there is
  no test name because the leak check is a script, not a Vitest test.

## Recommendations

1. Reconcile the contract and the assignment guard lists. Two contract guards
   (`public-build` skip-html 404, and `_neutralise_grammar` /
   `test_client_events.py`) are currently unverified by this wave. If they are
   Wave 1 scope, issue a follow-up so they get the same break/restore treatment.
2. Guard 2's break shows the private filter and the `kgis` index expectation
   share a code path; that is a strength, but it means a single-anchor break
   trips two tests. Keep both assertions.

## Alternatives considered

- Breaking `collectPublicItems` by deleting the filter line entirely — rejected
  only because an inverted comparison is a smaller, more obviously intentional
  diff; both break the same test.
- Rebuilding `dist-public` to restore Guard 3 — rejected as unnecessary and
  riskier than a `/tmp` byte copy (the task forbids redundant heavy builds).

## Risks

- Guard 4's inline script asserts on `classify()` in isolation, not on the CLI
  exit path. The CLI `main()` was read and its `novel.length === 0 ? 0 : 1`
  branch is consistent with the classification, but it was not executed against
  a real `npm audit` run (no network/`npm audit` invocation was made).

## Open questions

- Should the two contract-only guards (positions 5 and 6) be treated as
  unverified findings for Wave 1 sign-off, or is the assignment list the
  superseding record?

## Related docs

- `llm/sprints/2026-09-hub/contracts/skeptic-verifier-wave-1.md`
- `llm/sprints/2026-09-hub/contracts/site-wave-1.md`
- `llm/sprints/2026-09-hub/handoffs/site-wave-1.md`
- `llm/governance/adr/0005-two-output-build-with-leak-check.md`
- `llm/governance/adr/0010-withdrawal-semantics.md`
- `llm/governance/adr/0011-two-srcdirs-not-a-visibility-filter.md`

## ADR candidates

- None new from this verification. It confirms, rather than adds to, the
  existing candidates (`html`/`bundle` declare their asset set; `frame-content`
  as the shared frame model).
