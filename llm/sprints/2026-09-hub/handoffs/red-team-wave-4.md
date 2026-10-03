# Handoff — `Red Team`, Wave 4 (Phase 5 satellite)

Agent: Red Team (independent; authored nothing in this wave — report only, no fixes)
Contract: `llm/sprints/2026-09-hub/contracts/red-team-wave-4.md`
Seam: `llm/sprints/2026-09-hub/contracts/phase-5-seams.md`
Wave: 4 · Phase 5 (`construction-ai-proposal`)
Repos: hub `/home/djjay/code/website` branch `feat/construction-ai` HEAD `834465f`;
satellite `/home/djjay/code/construction-ai-proposal` branch `feat/hub-publish` HEAD `5201b47`.
Working tree: I changed **no tracked file**. All scratch work is under `/tmp/rt4.*`
(temporary `dist/`, a gitignored synced source I added and removed, a fake README repo,
a source mirror for the sync arithmetic). One `satellite-construction` diff showed up
transiently in `infra/satellites.tf` / `infra/variables.tf` / `contract/validate-manifest.mjs`
during the session and reverted on its own — that is a peer stream or the harness writing
concurrently, not me. At the end `git status --porcelain` on the hub shows only untracked
peer handoffs. My analysis is against the committed HEAD above.

## Summary

**15 attacks / groups: 13 REFUSED, 1 control pass, 1 BYPASS.** The manifest validator, the private/allowlist
split, the project index, the identity bindings and the satellite workflow all held. The one
bypass is **not in the validator**: `contract/validate-manifest.mjs` refuses every traversal
spelling and every source mismatch I threw at it. It is at the **IAM-prefix ↔ `sync-content.sh`
seam**: the per-source `startsWith` condition admits an object name containing `..`, Cloud
Storage stores it as one literal name (as `satellites.tf` itself says), and the hub's own
`sync-content.sh` then *interprets that name as a path* and writes it wherever the `..` walks —
including overwriting a tracked hub file such as `site/publish-allowlist.json`. That defeats
"the new source cannot publish outside its prefix" and the source-key boundary, and (via the
allowlist) the private-until-allowlisted guarantee.

## Attack table

| # | Target | Exact setup | Observed | Verdict | Code path |
|---|--------|-------------|----------|---------|-----------|
| 1 | Validator, `..` in `path` | temp `/tmp/rt4.*/dist`, item `path: "../outside.txt"`, `--check paths` | `path "../outside.txt" contains a ".." segment`, rc 1 | **REFUSED** | `contract/validate-manifest.mjs:361-368` |
| 2 | Validator, absolute `path` | `path: "/etc/hostname"` (a real file), `--check paths` | `path "/etc/hostname" is absolute`, rc 1 | **REFUSED** | `validate-manifest.mjs:353-360` |
| 3 | Validator, symlink escape | `dist/escape-link -> /etc/hostname`, item `path: "escape-link"`, `--check paths` and full `all` | `resolves outside dist/ (a symlink leads to /etc/hostname)`, rc 1 (schema passes, paths fails) | **REFUSED** | `validate-manifest.mjs:378-385` (uses `realpathSync`) |
| 4 | Validator, control | `dist/inside-link -> inside.txt`, `--check paths` | `Manifest check "paths" passed` | pass (control) | `validate-manifest.mjs:369-386` |
| 5 | Validator, second source | manifest `source: "construction-ai-evil"`, action `--source construction-ai`, `--check source` | `manifest's "source" is "construction-ai-evil" but the action was called with source: "construction-ai"`, rc 1 | **REFUSED** | `validate-manifest.mjs:397-408` |
| 6 | Validator, shape layer | full `all` with `path: "../x"` | schema pattern `^(?!/)(?!.*(?:^|/)\.\.(?:/|$))…` rejects before paths runs, rc 1 | **REFUSED** | `manifest.schema.json:92`, `validate-manifest.mjs:178-184` |
| 7 | IAM prefix, sibling key | `satellites.tf:178` condition `…/objects/sources/${each.key}/`; test `…/sources/construction-ai-evil/manifest.json` | `startsWith("…/sources/construction-ai/")` = **false** (trailing `/` is load-bearing) | **REFUSED** | `infra/satellites.tf:176-179` |
| 8 | IAM prefix + hub sync, `..` in object name | `…/sources/construction-ai/../../../../publish-allowlist.json`; prefix condition true; `sync-content.sh:172-190` writes `$DEST/$REL` | object allowed by IAM **and** written to `publish-allowlist.json` at the site root, overwriting it | **BYPASS** | `infra/satellites.tf:178` + `site/scripts/sync-content.sh:172-190` (see §Bypass) |
| 9 | Private-until-allowlisted, public build | added the real 2-item `construction-ai` manifest + `main.pdf` + generated `index.html` to the gitignored synced tree; `npm run build:public` | `grep -rIl` for `construction-ai` / slugs / titles over `dist-public` = **0 files**; `find -iname '*construction-ai*'` = none; `projects/index.html` = 0 hits | **REFUSED** | `content.config.ts:424-437` (public build stores only effective-public); `frame-content.mjs:393-432` |
| 10 | Leak check | `npm run check:no-private-in-public` with the source present | `6 private item(s) to look for` (incl. both `construction-ai` items) → **PASS**, 162 files scanned, 0 leaks | **REFUSED** | `scripts/check-no-private-in-public.mjs` |
| 11 | Project index | (a) real build: `grep construction-ai dist-public/projects/index.html`; (b) isolated `collectPublicItems` over a manifest with `pub-listed` (public, allowlisted), `pub-unlisted` (public, **not** allowlisted), `priv-listed` (private, allowlisted) | (a) 0 hits; allowlisted `kgis/kgis-docs` **is** listed from its manifest. (b) allowlist={pub-listed} → `['pub-listed']`; allowlist={} → `[]` (public-but-unlisted dropped, private dropped) | **REFUSED** | `projects/index.astro:35`, `frame-content.mjs:393-432`, `hub-content.mjs:479-482` |
| 12 | Repo swap / source-key confusion | `satellites.tf:97-102` provider condition pins `repository_id` 1134376420 AND `owner_id` 5666389 AND `repository` `djjay0131/construction-ai-proposal` AND rejects `pull_request_target`; binding `:137-143` pins `repository_id_ref/<id>/refs/heads/master` | a different repo (different id/owner) or a renamed repo (same id) fails the condition; a PR/other branch fails the binding | **REFUSED** | `infra/satellites.tf:88-102,137-143` |
| 13 | Hub source/dir equality | manifest `source: construction-ai` under directory prefix `construction-ai-evil`, `--source construction-ai-evil` | source mismatch, rc 1; hub `loadSources` passes the **directory name** as `expectedSource` | **REFUSED** | `content.config.ts:270-275,347`, `validate-manifest.mjs:397-408` |
| 14 | Satellite `index.html` injection | temp README with `<script>alert…</script>` in H1 and body, `<img src=x onerror=…>`, `"><svg onload=…>`, `&`; `node tools/build-site.mjs`; grep raw payloads | every `<`, `>`, `"`, `&` escaped (`&lt;script&gt;`, `&lt;img … onerror=&quot;`); **no** raw `<script`/`<img`/`onerror="`; `<title>` escaped too | **REFUSED** | `tools/build-site.mjs:18-23,34,45,61` |
| 15 | Supply chain pins | classify every `uses:` in `.github/workflows/publish-hub.yml` | `actions/checkout@fbc6f399…` (40-hex), `actions/setup-node@a0853c24…` (40-hex) SHA-pinned; `djjay0131/website/contract/publish@v1` is the allowed hub carve-out; **no unpinned third-party `uses:`** | **REFUSED** | `publish-hub.yml:48,53,87` |

Counts: **15 groups, 13 REFUSED, 1 control pass, 1 BYPASS.**

---

## Bypass — `..` survives the IAM prefix and `sync-content.sh` turns it into a real traversal

**Target claim under attack.** `infra/satellites.tf:156-160`: the prefix condition "cannot be
escaped by a crafted object name ... an object called `sources/cv/../phd-milestones/x` is a
single literal name that still startsWith `sources/cv/`, not a traversal out of the prefix."
That is true *inside Cloud Storage*. It is false for **the hub's own reader**, which does not
keep object names literal: `sync-content.sh` strips `sources/`, appends the remainder to the
destination, and lets the shell/filesystem resolve `..`.

**Prerequisites (all established by the reviewed design, not invented here).**
- A satellite's WIF identity mints a Google token and can call the Storage API directly; the
  publish *action* is not the boundary (`satellites.tf:156-160` says so explicitly).
- The role grants `storage.objects.create` (`infra/satellite-role.tf:93-97`).
- The condition is a **string** `startsWith` on the full object resource name
  (`satellites.tf:178`), so any name with the literal prefix passes, `..` included.
- `satellites.tf:157-158` itself uses `sources/cv/../phd-milestones/x` as an example of a valid
  object name.

**Minimal reproduction (the exact arithmetic of `site/scripts/sync-content.sh:172-190`).**

```
$ DEST="src/content/sources"; NAME="sources/construction-ai/../../../../publish-allowlist.json"
$ REL="${NAME#sources/}"; OUT="$DEST/$REL"
$ echo "$REL"          # construction-ai/../../../../publish-allowlist.json
$ mkdir -p "$(dirname "$OUT")"
$ printf '{"version":1,"items":[{"source":"construction-ai","slug":"construction-ai-site"}]}' > "$OUT"
$ cat publish-allowlist.json   # ATTACKER CONTENT (hub allowlist overwritten)
```

and the IAM half:

```
$ node -e 'const c=n=>n.startsWith("projects/_/buckets/B/objects/sources/construction-ai/");
  console.log(c("projects/_/buckets/B/objects/sources/construction-ai/../../../../publish-allowlist.json"));'
true
```

`sync-content.sh:172-190` (`REL="${NAME#sources/}"; OUT="$DEST/$REL"; mkdir -p "$(dirname "$OUT")"`
then `cp`/`curl -o "$OUT"`) never realpath-normalises `OUT`, never rejects a `..` segment in
`NAME`, and `list_bucket` skips only names ending in `/`. The listing is sorted, and the forged
name sorts early (`construction-…` < `cv…`/`kgis…`/`phd…`), so it lands before — and can be
overwritten by — the genuine object only for sources that sort *after* `construction-ai`; for
targets that sort before, or for the two-different-prefix overwrite, no genuine object competes.

**Reachable damage.** With the object name above, the deploy build's
`site/publish-allowlist.json` is replaced by the satellite's own allowlist before
`npm run build` and `check:no-private-in-public` run. The satellite's two `visibility: private`
items become effectively public in that build, defeating attack 2 and the hub's stated authority
(`hub-content.mjs:313-330`, D8/SEAM-B1). By extending the `..` run further (`construction-ai/`
plus enough `../`), any writable path under `site/` can be overwritten — e.g.
`astro.config.mjs`, `src/lib/frame-content.mjs`, `src/content.config.ts` — and
`build.yml` contains **no** `git diff`/`git status` guard after the sync (grep returned nothing),
so the mutation is not detected. The same mechanism writes into *another source's* prefix in the
synced tree (`sources/construction-ai/../construction-ai-evil/manifest.json` is IAM-ALLOW and
lands at `construction-ai-evil/manifest.json`), which is the source-key confusion target 4 asks
about.

**Why the validator does not save it.** `contract/validate-manifest.mjs` rejects `..`/absolute/
symlink paths and a mismatched `source` (attacks 1-6, all REFUSED). But it only runs when the
satellite *calls the action*; a satellite that talks to Storage directly with its WIF token
never executes it. The Terraform comment claims the boundary "does not depend on that"; the
sync reader shows it does.

**Verdict: BYPASS (prefix boundary).** Fix direction (for the owners, not applied here): have
`sync-content.sh` reject or normalise any listing name whose `REL` contains a `..` segment or
whose `realpath` leaves `$DEST`, and/or add an IAM condition that rejects names containing the
`/../` substring; and add a post-sync `git diff --exit-code` (or a destination allowlist) as a
backstop. The `publish` action's path check alone is not a boundary because the action is
optional.

---

## Observations / residual (not contract failures)

- **`v1` fetch URLs are deliberate.** `.github/workflows/publish-hub.yml:71-77` fetches
  `validate-manifest.mjs` and `manifest.schema.json` from `…/website/v1/` (not a 40-hex SHA) and
  then executes the fetched JS. Target 6 is scoped to `uses:` and ADR-0014 decision 4 mandates
  `v1`, so this is **REFUSED/expected** — but it is an arbitrary-code path from hub `v1` into the
  satellite runner; recorded as accepted-by-design, not a bypass.
- **Concurrent peer writes.** During the session `git status` showed
  `infra/satellites.tf`, `infra/variables.tf` (briefly `default_branch = "refs/heads/master"`,
  which `variables.tf:260-266` forbids) and `contract/validate-manifest.mjs` as modified, then
  clean again. Those are not my edits; the analysis above is against HEAD `834465f`, and the
  committed `default_branch` is `master`. If a `refs/heads/` prefix does land in
  `var.satellites[*].default_branch`, the binding member doubles to
  `…/attribute.repository_id_ref/<id>/refs/heads/refs/heads/master`, which **fails closed**
  (no satellite can authenticate) — a provisioning defect, not a security bypass.
- The validator refuses shape/path/source problems only when invoked; it is sound, but it is not
  the prefix boundary the design sometimes treats it as. See the bypass.

---

# Round 2 — re-verify the `sync-content.sh` traversal guard

Scope: `site/` only. I modified no tracked file. Method: the same stub-`curl` technique as the
repo's new test — a fake `curl` on `PATH` returns a one-object listing for a hostile name; no
bucket, no credential. Harness at `/tmp/rt4-round2-harness.mjs`; each case uses a fresh
`parent/` with a sentinel `parent/publish-allowlist.json` and `DEST = parent/src/content/sources`,
then checks the sentinel and scans `parent/` for any write outside `DEST`.

Fix under test: `site/scripts/sync-content.sh:168-192` — `DEST_REAL="$(realpath -m -- "$DEST")"`,
then per object `case "$REL" in ""|/*) die` and `OUT_REAL="$(realpath -m -- "$OUT")";
case "$OUT_REAL" in "$DEST_REAL"/*) ;; *) die "unsafe object name ..." ;; esac`, both **before**
`mkdir`/write. Test: `site/scripts/sync-content.test.ts:86-140` (17/17 pass).

**Verdict: the bypass is CLOSED.** The original object name is refused with `unsafe object name`,
exit 1, and nothing is written outside `$DEST`; a normal name still syncs.

| # | Object name | Observed | Verdict |
|---|-------------|----------|---------|
| 1 | `sources/construction-ai/../../../../publish-allowlist.json` (original) | rc 1, `unsafe object name …: resolves outside <DEST>`, sentinel intact, `outside=[]` | **REFUSED** |
| 2 | `sources/cv/../../../../../../../../pwned.txt` (deeper) | rc 1, `resolves outside <DEST>`, `outside=[]` | **REFUSED** |
| 3 | `sources/cv/%2e%2e/pwned.txt` (encoded) | rc 0; `realpath -m` does not decode `%`; wrote literal `cv/%2e%2e/pwned.txt` **inside** `$DEST` | allowed, harmless |
| 4 | `sources/cv/../` (trailing slash) | filtered upstream (`list_bucket` drops names ending `/`, sync-content.sh:112); no object; `inside=[.hub-content-source.json]` | harmless |
| 5 | `sources//etc/hostname` (absolute `REL`) | rc 1, `unsafe object name …: empty or absolute` | **REFUSED** |
| 6 | `sources/cv//sub/x.txt` (doubled slash) | rc 0; collapsed to `cv/sub/x.txt` **inside** `$DEST` | allowed, harmless |
| 7 | `sources/cv/..` (resolves exactly to `$DEST`) | rc 1, `resolves outside <DEST>` (the `"$DEST_REAL"/*` case does not match equality) | **REFUSED** |
| 8 | `sources/` (empty `REL`) | filtered upstream (ends `/`); no object | harmless |
| 9 | `sources` (no `/`) | rc 0; `REL="sources"`; writes a regular file `$DEST/sources` **inside** `$DEST` | allowed, harmless |
| 10 | `sources/cv/academic.pdf` (normal) | rc 0; `$DEST/cv/academic.pdf` written | **syncs normally** |

Residual (all harmless, no action required):
- The guard is robust because `DEST` is `rm -rf`'d and re-`mkdir`'d immediately before the loop, so
  no symlink can be pre-planted inside it; `realpath -m` then resolves only real components and the
  write happens after the check. The `"" | /*` case is defence in depth (the bucket path already
  filters trailing `/`).
- `%2e%2e`, `//`, and a bare `sources` land as literal names **inside** the tree. They are not
  traversals and are invisible to `loadSources` (only `<source>/manifest.json` directories matter).
- `git status` at end showed the fix (`site/scripts/sync-content.sh`, `sync-content.test.ts`) plus
  peer handoffs already modified/untracked; nothing I changed.
