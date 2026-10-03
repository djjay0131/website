# Handoff — `site` hardening, Wave 4 (traversal fix)

Status: Delivered
Date: 2026-10-03
Stream: `site` (`site/scripts/**`)
Branch: `feat/construction-ai`
Scope: Red Team Wave 4 bypass — `sync-content.sh` object-name traversal.
Report: `llm/sprints/2026-09-hub/handoffs/red-team-wave-4.md` §Bypass (attack 8).

## Summary

Fixed the IAM-prefix ↔ `sync-content.sh` traversal. A GCS object name is
arbitrary flat UTF-8, so a satellite calling the Storage API directly can create
`sources/<key>/../../../publish-allowlist.json`: it satisfies
`startsWith('sources/<key>/')`, and the sync loop interpreted the remainder as a
path and wrote outside `$DEST`. The write loop now refuses any object whose
resolved path is not strictly under `$DEST`. Normal, safe names are unchanged.

Touched: `site/scripts/sync-content.sh`, `site/scripts/sync-content.test.ts`.
No production test seam was added. Nothing committed.

## The fix (`site/scripts/sync-content.sh`)

`DEST_REAL="$(realpath -m -- "$DEST")"` is computed once after the destination is
rebuilt, then, in the single shared write loop (before `mkdir -p`/`cp`/`curl`) and
therefore covering **both** `--from` and `--bucket`:

```bash
REL="${NAME#sources/}"
OUT="$DEST/$REL"

case "$REL" in
  ""|/*) die "unsafe object name ${NAME}: empty or absolute" ;;
esac
OUT_REAL="$(realpath -m -- "$OUT")"
case "$OUT_REAL" in
  "$DEST_REAL"/*) ;;
  *) die "unsafe object name ${NAME}: resolves outside ${DEST}" ;;
esac
```

- Empty/absolute `REL` is refused first.
- `realpath -m` (missing components allowed) canonicalises `..`/`.`; `$OUT` must
  be strictly under `$DEST/` (boundary-safe prefix, not a bare string prefix).
- Runs **before** `mkdir -p "$(dirname "$OUT")"`, so a hostile name cannot even
  create a directory outside the tree, let alone a file.
- `die` runs in the current shell (the loop is fed by `<"$TMP/listing"`, not a
  pipe), so it exits 1 and the run fails loudly.

## The test (`site/scripts/sync-content.test.ts`)

New block: `sync-content.sh refuses an object name that escapes the destination`.

The hostile name **cannot** be placed on a `--from` fixture — a filesystem cannot
hold a literal `..` component and `find`/`realpath` collapse it. The existing
harness spawns the script, so the hostile listing is injected at `PATH`: a fake
executable `curl` (written into a temp `bin/`) returns an `objects.list`-shaped
JSON body containing `sources/cv/../../pwned.txt`, and writes bytes on
`alt=media`. The test runs the real script in `--bucket` mode with
`PATH=<stub-dir>:$PATH` and `GCS_ACCESS_TOKEN=fake`.

`dest = <parent>/dest`, so `REL = cv/../../pwned.txt` resolves to
`<parent>/pwned.txt` — outside `dest` and writable (so the mutation is not merely
saved by a permission error). The test asserts:

1. `status === 1`,
2. `stderr` contains `unsafe object name`,
3. `<parent>/pwned.txt` was **not** created.

This exercises the real guard through the real `curl` transport; no production
behaviour was changed to enable it. Existing safe-name tests (the `--from`
suite, fingerprint suite, provenance suite) confirm normal behaviour is intact.
Because the guard is in the one shared loop, the `--bucket` test covers the
`--from` code path too.

## Mutation that makes it red

Replace the guard's `die` on the escape branch with `:` (drop only the
`realpath` check; the empty/absolute check stays). The hostile object is then
written to `<parent>/pwned.txt` and the script exits 0. Re-run:

```
× fails loudly and writes nothing when REL escapes $DEST
AssertionError: sync-content: synced 1 object(s) into /tmp/sync-guard-.../dest.
... expected +0 to be 1
```

Observed: `Tests 1 failed | 16 passed (17)` — assertion 1 fails (status 0, not 1),
and `<parent>/pwned.txt` exists, so assertion 3 fails too. Guard restored after
the check.

## Counts (exact)

From `site/`:

```
$ bash -n site/scripts/sync-content.sh
bash -n OK

$ npx vitest run scripts/sync-content.test.ts
Test Files  1 passed (1)
     Tests  17 passed (17)

$ npm test
Test Files  26 passed (26)
     Tests  353 passed | 1 skipped (354)
```

Mutation run (guard neutered): `Tests 1 failed | 16 passed (17)`.
Mutated → restored; final tree is the guarded version.

## Residual

- `realpath -m` resolves existing symlinks, so an escape via a
  previously-created symlinked parent is also caught; no separate symlink test
  was added (out of scope for this bypass).
- A `..` that stays *inside* `$DEST` (e.g. `sources/cv/../manifest.json`) is
  allowed, per the task's "escapes `$DEST`" criterion; it does not cross the
  boundary.
- The Red Team's suggested IAM-side `/../` condition and a post-sync
  `git diff --exit-code` backstop are `infra/**`/`.github/**` concerns, outside
  this stream.
