NOT FULLY PINNED — `agentic-kgis` and `construction-ai-proposal` are pinned on disk and verified (21 occurrences, both now 0), including the `curl` remote-code vector. `phd-milestones` (1) and `cv` (12) are **not written**: neither repo has its wave-target branch checked out, and I make no git mutations. Both have verified, `git apply`-clean patches embedded below.

# Handoff — supply-chain pinning, Wave 0 (check 6, supply-chain half)

Stream: supply-chain pinning · Wave 0 · 2026-09-21
Scope: `.github/workflows/**` in `agentic-kgis`, `construction-ai-proposal`, `phd-milestones`, `cv`

---

## Headline

**The tester's `cv` count of 6 is not an occurrence count and not the wave target.** It is
the number of **distinct** unpinned refs on `add-mit-to-all-variants` — the branch that
happens to be checked out at `/mnt/c/code/cv`, which is **behind `master`** and whose
`build-cv.yml` predates the `contract/publish` step entirely.

- `cv` distinct unpinned on the checked-out branch = **6** ← the tester's number
- `cv` occurrences on the checked-out branch = **11**
- `cv` occurrences on `origin/master` (aedb599, the wave target) = **12**

`agentic-kgis` (11) and `construction-ai-proposal` (10) *are* occurrence counts and matched
exactly. So the tester's table mixes two counting methods, and the one repo counted the other
way is also the one pointed at the wrong tree. **The grand total understated the work: 28 in
the brief, 34 in reality.**

Had I pinned the checked-out `cv` tree as instructed, I would have pinned a stale workflow on
an unrelated content PR and **left `djjay0131/website/contract/publish@main` unpinned on
`master`** — the single highest-value pin in that repo — with the finding reading as closed.

---

## Per-file before → after

Counts from the mandated command, run per file against the ref named:

```
grep -rhoP '^\s*-?\s*uses:\s*\K\S+' .github/workflows/ | grep -vcE '@[0-9a-f]{40}$'
```

| Repo | File | Ref counted | Before | After | Status |
|---|---|---|---:|---:|---|
| `agentic-kgis` | `.github/workflows/ci.yml` | HEAD = `origin/main` 5348971 | 6 | **0** | **written** |
| `agentic-kgis` | `.github/workflows/docs-publish.yml` | HEAD = `origin/main` 5348971 | 5 | **0** | **written** |
| `construction-ai-proposal` | `.github/workflows/build-and-publish-pdf.yml` | HEAD = `origin/master` 3e07595 | 10 | **0** | **written** |
| `phd-milestones` | `.github/workflows/ci.yml` | `origin/main` b6296fa | 0 | 0 | already pinned |
| `phd-milestones` | `.github/workflows/publish.yml` | `origin/main` b6296fa | 1 | **0** | **patch below** |
| `cv` | `.github/workflows/build-cv.yml` | `origin/master` aedb599 | 12 | **0** | **patch below** |

**Per-repo:** `agentic-kgis` 11 → 0 · `construction-ai-proposal` 10 → 0 ·
`phd-milestones` 1 → 0 · `cv` 12 → 0.

### Grand total, all four repos

**34 → 0.**

On disk right now the total is **12** (`phd-milestones` 1 + `cv` 11) until you apply the two
patches on the correct branches. `agentic-kgis` and `construction-ai-proposal` read 0 today.

---

## Files I changed — stage exactly these three

```
/mnt/c/code/agentic-kgis/.github/workflows/ci.yml
/mnt/c/code/agentic-kgis/.github/workflows/docs-publish.yml
/mnt/c/code/construction-ai-proposal/.github/workflows/build-and-publish-pdf.yml
```

`git status --porcelain` in both repos shows only these, plus the two untracked files you
named, which I did not touch, stage, or delete:

```
[agentic-kgis]              M .github/workflows/ci.yml
                            M .github/workflows/docs-publish.yml
                            ?? uv.lock                        <- left alone
[construction-ai-proposal]  M .github/workflows/build-and-publish-pdf.yml
[phd-milestones]            ?? withdrawal-proof.patch         <- left alone
[cv]                        (clean — nothing written)
```

Diffstats are pure 1:1 line swaps: `agentic-kgis` 13 insertions / 13 deletions (11 `uses:`
+ 2 `curl` URLs), `construction-ai-proposal` 10 / 10. `git diff --summary` is empty in both —
no mode changes; `git ls-files -s` still reports `100644` for every file. All source blobs are
LF, and I edited at byte level replacing only the ref token, so no line endings were rewritten.

---

## The `curl` vector — closed in `agentic-kgis`

`docs-publish.yml` fetched two files of executable code from a mutable branch and ran one of
them, on every push, ungated. Both URLs now carry the SHA:

```yaml
      - name: Validate the manifest against the hub contract
        run: |
          curl -fsSL \
            https://raw.githubusercontent.com/djjay0131/website/f98a928a1b92b2248b130822ba5098fb926b8898/contract/validate-manifest.mjs \
            -o /tmp/validate-manifest.mjs
          curl -fsSL \
            https://raw.githubusercontent.com/djjay0131/website/f98a928a1b92b2248b130822ba5098fb926b8898/contract/manifest.schema.json \
            -o /tmp/manifest.schema.json
          node /tmp/validate-manifest.mjs --dist docs-site/dist --source kgis
```

No `raw.githubusercontent.com` reference off a branch ref remains in any workflow in any of
the four repos.

### Sweep of the other repos for the same pattern

I swept all four repos for `curl`, `wget`, `raw.githubusercontent`, `/archive/refs/heads/`,
`pip install git+`, `npm install` from git, `npx`, and `| sh` — across **all tracked files**,
not just workflows, and against `cv@origin/master` and `phd-milestones@origin/main` as well as
each working tree.

- **`construction-ai-proposal`** — nothing in workflows. Two `curl -sI` mentions in prose
  (`construction/design/2026-product-roadmap.md:141`,
  `construction/design/vvuq-phase3-final-review.md:68`). Documentation, not executed. No action.
- **`phd-milestones`** — clean on both refs. No fetches of any kind in either workflow.
- **`cv`** — one `curl` at `build-cv.yml:192` on the checked-out branch: a `POST` to
  `api.github.com/.../dispatches`. It sends data, it does not fetch or execute code, so it is
  not this vector. It is also **already gone on `origin/master`**, replaced by the
  `contract/publish` step. No action either way.
- **No composite actions.** None of the four repos defines an `action.yml`/`action.yaml`, so
  there is no second-layer `uses:` hiding outside `.github/workflows/`. The only other
  `.github` content anywhere is `agentic-kgis`'s CODEOWNERS, issue templates and PR template —
  no `uses:`.

**Transitive check on the pin target:** `website/contract/publish/action.yml` at `f98a928`
pins both of its own `uses:` by SHA (`google-github-actions/auth@7c6bc770…`,
`upload-cloud-storage@6397bd72…`). Pinning the satellites to `f98a928` therefore closes the
chain rather than deferring it one hop.

---

## SHA integrity

All 11 SHAs in your table validate as exactly 40 lowercase hex, with no duplicates (a
copy/paste slip between two rows would have collided; a transposition would not, which is why
the second check below matters more).

Every pinned ref now present in the two written repos was re-read back off disk and checked
against your table programmatically — name **and** SHA must both match a table row:

```
OK  agentic-kgis              actions/checkout@11d5960a326750d5838078e36cf38b85af677262
OK  agentic-kgis              actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020
OK  agentic-kgis              actions/setup-python@a26af69be951a213d495a4c3e4e4022e16d87065
OK  agentic-kgis              astral-sh/setup-uv@d4b2f3b6ecc6e67c4457f6d3e41ec42d3d0fcb86
OK  agentic-kgis              djjay0131/website/contract/publish@f98a928a1b92b2248b130822ba5098fb926b8898
OK  construction-ai-proposal  actions/checkout@11d5960a326750d5838078e36cf38b85af677262
OK  construction-ai-proposal  actions/deploy-pages@d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e
OK  construction-ai-proposal  actions/upload-pages-artifact@56afc609e74202658d3ffba0e8f6dda462b719fa
OK  construction-ai-proposal  softprops/action-gh-release@3bb12739c298aeb8a4eeaf626c5b8d85266b0e65
OK  construction-ai-proposal  xu-cheng/latex-action@e2f99d4b3685b0da93f97e1b86ad8fab81105098
```

Zero `NOT-IN-TABLE`, zero `BAD-HEX`. Same check passes on both patched files. I resolved
nothing myself and substituted no versions. Every pinned line keeps its version as a trailing
comment; `contract/publish` carries `# main`, recording the ref it was pinned from.

All five resulting YAML files still parse under `yaml.safe_load`.

---

## `phd-milestones` — patch, not a write

You asked me not to check out a branch. The worktree is on `fix/self-host-webfonts`; writing
there would put the fix on PR #2 and leave `main` unpinned.

Two facts that make this safe and unambiguous for you:

1. `git diff origin/main -- .github/workflows/` in that worktree is **empty** — the workflow
   files are byte-identical on `fix/self-host-webfonts` and `origin/main` (b6296fa). There is
   no ambiguity about which content to patch.
2. **PR #2 changes 0 files under `.github/workflows/`** (verified via `gh pr view --json files`:
   README, `docs/hub-publishing.md`, and the self-hosted font assets only). Landing this pin on
   `main` will not conflict with PR #2.

Note your local `main` ref is stale — 24afd9d, behind `origin/main`, and `publish.yml` does not
exist there at all. Patch against `origin/main` / b6296fa, not local `main`.

Verified `git apply -p1` clean against `origin/main` content:

```diff
--- a/.github/workflows/publish.yml
+++ b/.github/workflows/publish.yml
@@ -71,7 +71,7 @@
       # in each one (docs/satellites.md). It validates the manifest three ways
       # before a credential is minted.
       - name: Publish to the research hub
-        uses: djjay0131/website/contract/publish@main
+        uses: djjay0131/website/contract/publish@f98a928a1b92b2248b130822ba5098fb926b8898 # main
         with:
           dist: ./dist
           source: phd-milestones
```

---

## `cv` — patch, not a write (same problem, larger)

`/mnt/c/code/cv` is on `add-mit-to-all-variants` = **PR #12**, base `master`. That branch is
behind `origin/master` (aedb599); its `build-cv.yml` differs by −79/+21 lines and **has no
`contract/publish` step at all**.

- **PR #12 changes 0 workflow files** — only `data/variants/{academic,research-professional,sde-long}.yaml`.
  So the workflow delta is pure merge-base staleness, and the pin belongs on `master`.
- `cv` has **no `main` branch**; the default is `master`. Local `master` is 0d27afb, **behind**
  `origin/master`. Patch against `origin/master` / aedb599.
- The two worktrees under my scratchpad (`feat/publish-contract`, `fix/bibtexparser-pin`) are not
  useful here — `feat/publish-contract` is already merged into `master` (its workflow diff vs
  `origin/master` is empty).

Verified `git apply -p1` clean against `origin/master` content. Every changed line is a `uses:`
line — I confirmed no other content line is touched anywhere in the patch. 12 occurrences → 0.

```diff
--- a/.github/workflows/build-cv.yml
+++ b/.github/workflows/build-cv.yml
@@ -21,10 +21,10 @@
     name: Python tests & lint
     runs-on: ubuntu-24.04
     steps:
-      - uses: actions/checkout@v4
+      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4
 
       - name: Set up Python
-        uses: actions/setup-python@v5
+        uses: actions/setup-python@a26af69be951a213d495a4c3e4e4022e16d87065 # v5
         with:
           python-version: "3.11"
 
@@ -49,7 +49,7 @@
     outputs:
       variants: ${{ steps.list.outputs.variants }}
     steps:
-      - uses: actions/checkout@v4
+      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4
       - id: list
         run: |
           json=$(ls data/variants/*.yaml | xargs -n1 basename | sed 's/\.yaml$//' | jq -R . | jq -sc .)
@@ -65,10 +65,10 @@
       matrix:
         variant: ${{ fromJSON(needs.configure.outputs.variants) }}
     steps:
-      - uses: actions/checkout@v4
+      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4
 
       - name: Set up Python
-        uses: actions/setup-python@v5
+        uses: actions/setup-python@a26af69be951a213d495a4c3e4e4022e16d87065 # v5
         with:
           python-version: "3.11"
 
@@ -81,7 +81,7 @@
         run: python -m tools.render "${{ matrix.variant }}"
 
       - name: Compile PDF
-        uses: xu-cheng/latex-action@v3
+        uses: xu-cheng/latex-action@e2f99d4b3685b0da93f97e1b86ad8fab81105098 # v3
         with:
           root_file: cv-llt.tex
           latexmk_use_xelatex: true
@@ -128,7 +128,7 @@
           cp "${{ matrix.variant }}.pdf" "dist/${{ matrix.variant }}.pdf"
 
       - name: Upload per-variant artifact
-        uses: actions/upload-artifact@v4
+        uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02 # v4
         with:
           name: variant-${{ matrix.variant }}
           path: |
@@ -155,10 +155,10 @@
       # gs://<content-bucket>/sources/cv/.
       id-token: write
     steps:
-      - uses: actions/checkout@v4
+      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4
 
       - name: Download all variant artifacts
-        uses: actions/download-artifact@v4
+        uses: actions/download-artifact@d3f86a106a0bac45b974a628896c90dbdf5c8093 # v4
         with:
           path: artifacts
           pattern: variant-*
@@ -211,7 +211,7 @@
           cat dist/manifest.json
 
       - name: Upload combined workflow artifact
-        uses: actions/upload-artifact@v4
+        uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02 # v4
         with:
           name: cv-${{ github.sha }}
           path: |
@@ -221,7 +221,7 @@
           retention-days: 30
 
       - name: Update "latest" release
-        uses: softprops/action-gh-release@v2
+        uses: softprops/action-gh-release@3bb12739c298aeb8a4eeaf626c5b8d85266b0e65 # v2
         with:
           tag_name: latest
           name: "Latest CV build"
@@ -245,7 +245,7 @@
       # makes failures harder to read. `dist` and `source` are literals.
       # See docs/satellites.md in the website repository.
       - name: Publish to the research hub
-        uses: djjay0131/website/contract/publish@main
+        uses: djjay0131/website/contract/publish@f98a928a1b92b2248b130822ba5098fb926b8898 # main
         with:
           dist: ./dist
           source: cv
```

Both patches also exist as files for this session only (scratchpad is ephemeral — the diffs
above are the durable copy):

```
<scratchpad>/patches/phd-main-pin.patch
<scratchpad>/patches/cv-master-pin.patch
```

---

## What I did not do

No commits, no staging, no pushes, no `gh` mutations, no cloud calls. `gh.exe` was used
read-only twice: `pr list` on all four repos and `pr view --json files` on `cv#12` and
`phd-milestones#2`, to establish that neither open PR touches a workflow file. I was tempted
to check out `cv`'s `master` — it is the wave target and the patch is ready — and did not;
branches are yours.

The only file I wrote outside `.github/workflows/**` in the four repos is this report, at the
path you specified. The `website` working tree was otherwise clean when I started and I added
nothing else to it.

## Open items for you

1. Apply the two patches on the correct branches (`phd-milestones` → `main` b6296fa;
   `cv` → `master` aedb599). Re-running the mandated command on those trees must give 0 and 0.
2. Re-check the tester's methodology for the rest of check 6 — `cv` was counted distinct while
   the other repos were counted by occurrence, so any other per-repo number in that table may
   be understated the same way.
3. Your note that the four open wave PRs change 0 files under `contract/` holds for the two
   PRs that exist in these four repos — `cv#12` and `phd-milestones#2` change 0 workflow files
   and 0 `contract/` files. `agentic-kgis` and `construction-ai-proposal` have **no open PRs at
   all**, so their pins can land directly. `f98a928` stays correct after the wave merges.
