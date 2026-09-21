# CHECK 6 FAIL

Re-verification of Wave 0 check 6, sprint 2026-09-hub. Read-only. No git, `gh`, or cloud
mutations were made. No file outside this one was modified. No branch was checked out; every
read used `git show <ref>:<path>` / `git grep <ref>` / `git ls-tree <ref>`.

---

## Verdict in one paragraph

**The pinning claim as worded is true, and I could not break it.** All four wave-target refs are
the correct default-branch heads, all four read **0 unpinned `uses:`** by both occurrence and
distinct counting, the baseline really was **34**, all **15** distinct pinned refs (13 in the
satellites + 2 nested inside the hub action) are full 40-hex SHAs that resolve **exactly** to the
tag named in their trailing comment, and the `curl` remote-code vector in `agentic-kgis` is
SHA-pinned. `djjay0131/website/contract/publish@f98a928…` exists and carries the action.

**Check 6 nonetheless fails on its own stated standard — "0 branch-ref code fetches" — because of
something no one counted.** Seven workflow steps across `cv` and `construction-ai-proposal` pin
`xu-cheng/latex-action` by SHA, and that action is a *composite* whose entrypoint runs
`docker run … ghcr.io/xu-cheng/texlive-full:latest`. The pinned SHA buys a 40-character wrapper
around a **mutable `:latest` container tag that is pulled and executed at run time**. That is the
same threat class as `@main`, it lives in `.github/`, and a `uses:`-only audit misses it exactly
the way it missed the `curl` one. Additionally, `cv`'s CI is **red on the wave-target head** and
its hub-publish step was **skipped**, so `cv` has not published to the hub since the pin landed.
The red is **not** caused by the pin — I proved that below rather than assuming it.

Downgrade reason is the uncounted mutable fetch, not an error in the pinning work itself. The
pinning work is correct.

---

## Line-by-line

| # | Line | Verdict |
|---|---|---|
| 1 | Wave-target ref is the right one for each repo | **PASS** |
| 2 | 0 unpinned `uses:`, occurrence **and** distinct | **PASS** |
| 3 | Pinned SHAs resolve to the tag they claim | **PASS** (15/15) |
| 4 | 0 branch-ref code fetches in `.github/` | **FAIL** — rolling `:latest` image, 7 steps, 2 repos |
| 5a | Changed workflows still valid YAML | **PASS** (6/6) |
| 5b | CI on the new head not failing *because of* the pin | **PASS** — red in `cv`, but demonstrably not pin-caused |
| 5c | CI green on the wave-target head | **FAIL** — `cv` red; hub publish skipped |
| 5d | Would a `cv` re-run pass? | **NOT TESTED** — re-running is a mutation |
| 6 | Anything in scope nobody counted | **FAIL** — see findings F-1 … F-5 |

---

## 1. Are the wave-target refs the right ones? — PASS

Default branch taken from the API, not from the claim. `cv` has no `main`; `master` is correct.

```
$ GH="/mnt/c/Program Files/GitHub CLI/gh.exe"
$ for r in agentic-kgis construction-ai-proposal phd-milestones cv website; do
    "$GH" api "repos/djjay0131/$r" --jq '.full_name + " default=" + .default_branch + " private=" + (.private|tostring) + " archived=" + (.archived|tostring)'; echo "EXIT:$?"; done
djjay0131/agentic-kgis default=main private=false archived=false
EXIT:0
djjay0131/construction-ai-proposal default=master private=false archived=false
EXIT:0
djjay0131/phd-milestones default=main private=true archived=false
EXIT:0
djjay0131/cv default=master private=false archived=false
EXIT:0
djjay0131/website default=main private=false archived=false
EXIT:0
```

Remote head vs. claimed SHA — all four identical, and re-confirmed at the end of the run:

```
$ for spec in "agentic-kgis main" "construction-ai-proposal master" "phd-milestones main" "cv master" "website main"; do
    set -- $spec; printf "%-28s %s -> " "$1" "$2"; "$GH" api "repos/djjay0131/$1/branches/$2" --jq '.commit.sha'; done
agentic-kgis                 main -> 34b5be72ef68b3c1c51af64c44360684604b80a2
construction-ai-proposal     master -> b3fb677c6f9850955f06b91d37096f4bd8ba1f8f
phd-milestones               main -> a71b9e5a22c102899364f8012aaa26932e250fe2
cv                           master -> 51c3443795c1f9719797127d847a64e3faf4275f
website                      main -> f98a928a1b92b2248b130822ba5098fb926b8898
```

Each claimed SHA exists locally and is an ancestor of its target branch (`merge-base
--is-ancestor` exit 0 = ancestor, checked directly, not through a pipe):

```
agentic-kgis              rev-parse_exit:0  cat-file:commit  is_ancestor_exit:0
construction-ai-proposal  rev-parse_exit:0  cat-file:commit  is_ancestor_exit:0
phd-milestones            rev-parse_exit:0  cat-file:commit  is_ancestor_exit:0
cv                        rev-parse_exit:0  cat-file:commit  is_ancestor_exit:0
```

**The `cv` ref you were warned about is the right one.** The `cv` worktree on disk sits on
`add-mit-to-all-variants` (`fe7facb`), which is *not* the wave target; I never touched it. Your
correction stands: `origin/master` `51c3443` is the correct measurement point.

---

## 2. Unpinned `uses:` counts — PASS (both methods)

Method stated explicitly: I report **both**. Extraction is `grep -oP` over `uses:` values within
`.github`, at the ref; unpinned = does not end in `@<40 hex>`. `total_uses_occurrences` is printed
so you can confirm the command actually matched files — a zero total would mean the check could
not fail, and every total below is non-zero.

```
$ git -C /mnt/c/code/$r grep -h -oP '^\s*-?\s*uses:\s*\K\S+' "$s" -- .github > "$tmp"
$ grep -vcE '@[0-9a-f]{40}$' "$tmp"            # occurrences
$ grep -vE  '@[0-9a-f]{40}$' "$tmp" | sort -u | wc -l   # distinct
```

| Repo | Ref | total `uses:` | unpinned occ. | unpinned distinct |
|---|---|---:|---:|---:|
| `agentic-kgis` | `34b5be7` | 11 | **0** | **0** |
| `construction-ai-proposal` | `b3fb677` | 10 | **0** | **0** |
| `phd-milestones` | `a71b9e5` | 5 | **0** | **0** |
| `cv` | `51c3443` | 12 | **0** | **0** |

Verbatim:

```
=== agentic-kgis TARGET 34b5be72ef68b3c1c51af64c44360684604b80a2
  extract_exit:0 total_uses_occurrences=11
  UNPINNED_occurrences=0
  UNPINNED_distinct=0
=== construction-ai-proposal TARGET b3fb677c6f9850955f06b91d37096f4bd8ba1f8f
  extract_exit:0 total_uses_occurrences=10
  UNPINNED_occurrences=0
  UNPINNED_distinct=0
=== phd-milestones TARGET a71b9e5a22c102899364f8012aaa26932e250fe2
  extract_exit:0 total_uses_occurrences=5
  UNPINNED_occurrences=0
  UNPINNED_distinct=0
=== cv TARGET 51c3443795c1f9719797127d847a64e3faf4275f
  extract_exit:0 total_uses_occurrences=12
  UNPINNED_occurrences=0
  UNPINNED_distinct=0
```

### The "34" baseline is real — and your corrected methodology was right

Same command at the four pre-fix refs named in `supply-chain-pinning-wave-0.md`:

```
=== agentic-kgis BASELINE 5348971      total=11  UNPINNED_occurrences=11  UNPINNED_distinct=5
=== construction-ai-proposal BASELINE 3e07595  total=10  UNPINNED_occurrences=10  UNPINNED_distinct=5
=== phd-milestones BASELINE b6296fa    total=5   UNPINNED_occurrences=1   UNPINNED_distinct=1
=== cv BASELINE aedb599                total=12  UNPINNED_occurrences=12  UNPINNED_distinct=7
```

11 + 10 + 1 + 12 = **34 occurrences → 0**. Confirmed independently.

Note the `cv` baseline distinct count is **7**, not 6 — 6 was the distinct count on the *wrong
branch*. The mixed-method problem you identified was real and your re-scope to `origin/master`
was the correct call. The highest-value ref was indeed at stake: `cv` baseline included
`djjay0131/website/contract/publish@main`, which only exists on `master`.

---

## 3. Do the pinned SHAs resolve to what they claim? — PASS, 15/15

For each pin: the commit must exist **in that action's own repo** (catches a SHA transposed into
a valid-looking but foreign ref) and the claimed tag must dereference (through the annotated-tag
object where applicable) to exactly that SHA.

```
actions/checkout@11d5960a3267 claims=v4 commit_in_repo=11d5960a3267 tag_resolves_to=11d5960a3267 -> MATCH_EXACT
actions/setup-python@a26af69be951 claims=v5 commit_in_repo=a26af69be951 tag_resolves_to=a26af69be951 -> MATCH_EXACT
astral-sh/setup-uv@d4b2f3b6ecc6 claims=v5 commit_in_repo=d4b2f3b6ecc6 tag_resolves_to=d4b2f3b6ecc6 -> MATCH_EXACT
actions/setup-node@49933ea5288c claims=v4 commit_in_repo=49933ea5288c tag_resolves_to=49933ea5288c -> MATCH_EXACT
xu-cheng/latex-action@e2f99d4b3685 claims=v3 commit_in_repo=e2f99d4b3685 tag_resolves_to=e2f99d4b3685 -> MATCH_EXACT
actions/upload-pages-artifact@56afc609e742 claims=v3 commit_in_repo=56afc609e742 tag_resolves_to=56afc609e742 -> MATCH_EXACT
softprops/action-gh-release@3bb12739c298 claims=v2 commit_in_repo=3bb12739c298 tag_resolves_to=3bb12739c298 -> MATCH_EXACT
actions/deploy-pages@d6db90164ac5 claims=v4 commit_in_repo=d6db90164ac5 tag_resolves_to=d6db90164ac5 -> MATCH_EXACT
actions/checkout@fbc6f3992d24 claims=v5 commit_in_repo=fbc6f3992d24 tag_resolves_to=fbc6f3992d24 -> MATCH_EXACT
actions/setup-node@a0853c245446 claims=v5 commit_in_repo=a0853c245446 tag_resolves_to=a0853c245446 -> MATCH_EXACT
actions/upload-artifact@ea165f8d65b6 claims=v4 commit_in_repo=ea165f8d65b6 tag_resolves_to=ea165f8d65b6 -> MATCH_EXACT
actions/download-artifact@d3f86a106a0b claims=v4 commit_in_repo=d3f86a106a0b tag_resolves_to=d3f86a106a0b -> MATCH_EXACT
```

> Method note: my first attempt at this loop printed **one** line and looked like it had passed.
> `gh` consumed the heredoc on stdin, killing the `while read` loop after one iteration. Re-run
> with `< /dev/null` on every `gh` call. A 1-of-12 result that renders as a clean list is exactly
> the "check that cannot fail" failure mode — flagging it because the first output was wrong and
> plausible.

`djjay0131/website/contract/publish@f98a928a1b92b2248b130822ba5098fb926b8898` — **exists**, and
carries the action:

```
$ "$GH" api "repos/djjay0131/website/commits/f98a928a1b92b2248b130822ba5098fb926b8898" --jq '...'
f98a928a1b92b2248b130822ba5098fb926b8898 | 2026-09-18T21:39:49Z | fix(signin): stop claiming "wrong email" when we cannot actually tell (#43)
EXIT:0
$ "$GH" api "repos/djjay0131/website/contents/contract/publish/action.yml?ref=f98a928…" --jq '...'
contract/publish/action.yml size=7132
EXIT:0
$ "$GH" api "repos/djjay0131/website/compare/main...f98a928…" --jq '...'
status=identical ahead=0 behind=0
EXIT:0
```

**One hop further, which the checklist never reached.** The hub action is itself a composite that
calls two more actions. Both are pinned and both verify:

```
google-github-actions/auth@7c6bc770dae8 claims=v3.0.0 commit_in_repo=7c6bc770dae8 tag_resolves_to=7c6bc770dae8 -> MATCH_EXACT
google-github-actions/upload-cloud-storage@6397bd7208e1 claims=v3.0.0 commit_in_repo=6397bd7208e1 tag_resolves_to=6397bd7208e1 -> MATCH_EXACT
```

The action that mints the GCP credential is clean to its second hop. Worth recording, since that
is the step where a compromise would matter most.

Also verified: `agentic-kgis` checks out the governance canon cross-repo at an explicit `ref:`,
which a `uses:`-only audit does not see. It is SHA-pinned and the SHA is genuinely `v0.9.0`:

```
.github/workflows/ci.yml:91:          ref: 851a50a0692d4409cbd255e3b3be111d863ae264   # "agentic-governance v0.9.0."
$ "$GH" api repos/djjay0131/agentic-governance/commits/851a50a… --jq .sha
851a50a0692d4409cbd255e3b3be111d863ae264
$ tag v0.9.0 -> annotated 39d28ccf…  -> deref: 851a50a0692d4409cbd255e3b3be111d863ae264
```

---

## 4. Branch-ref code fetches — FAIL

The `curl` vector you were worried about is **fixed**. `agentic-kgis` fetches the hub validator
at a 40-hex SHA, not a branch:

```
.github/workflows/docs-publish.yml:62:          curl -fsSL \
.github/workflows/docs-publish.yml:63:            https://raw.githubusercontent.com/djjay0131/website/f98a928a1b92b2248b130822ba5098fb926b8898/contract/validate-manifest.mjs \
.github/workflows/docs-publish.yml:65:          curl -fsSL \
.github/workflows/docs-publish.yml:66:            https://raw.githubusercontent.com/djjay0131/website/f98a928a1b92b2248b130822ba5098fb926b8898/contract/manifest.schema.json \
```

Whole-tree sweep for `curl|wget|raw.githubusercontent|docker://|git clone|archive/refs/heads` at
all four refs: the only other hits are prose in `.md` design docs and a `memory-bank` note.
`phd-milestones` returned `grep_exit:1` (no match anywhere). No `uses: ./…@ref` reusable-workflow
references, no `docker://` refs, and **no `action.yml` / `action.yaml` exists in any of the four
repos** (composite-action sweep returned empty).

### F-1 — but the line still fails: a rolling container tag, executed, 7 times

`xu-cheng/latex-action` is `using: composite`, and its entrypoint runs a **mutable image tag**:

```
$ "$GH" api "repos/xu-cheng/latex-action/contents/action.yml?ref=e2f99d4b…" | base64 -d | grep -n -iE 'image|texlive|using'
5:  texlive_version:
7:  docker_image:
8:    description: The docker image to be used
44:runs:
45:  using: composite
51:        INPUT_TEXLIVE_VERSION: ${{ inputs.texlive_version }}
52:        INPUT_DOCKER_IMAGE: ${{ inputs.docker_image }}
```

Neither `cv` nor `construction-ai-proposal` sets either input, so both default to rolling. From
the live run log (`cv`, wave-target head):

```
  INPUT_TEXLIVE_VERSION:
  INPUT_DOCKER_IMAGE:
'docker' 'run' … '--entrypoint' '/entrypoint.sh' 'ghcr.io/xu-cheng/texlive-full:latest'
Unable to find image 'ghcr.io/xu-cheng/texlive-full:latest' locally
latest: Pulling from xu-cheng/texlive-full
Status: Downloaded newer image for ghcr.io/xu-cheng/texlive-full:latest
This is XeTeX, Version 3.141592653-2.6-0.999998 (TeX Live 2026) (preloaded format=xelatex)
```

Same in `construction-ai-proposal`'s passing run on `b3fb677`:

```
… '--entrypoint' '/entrypoint.sh' 'ghcr.io/xu-cheng/texlive-full:latest'
Status: Downloaded newer image for ghcr.io/xu-cheng/texlive-full:latest
This is pdfTeX, Version 3.141592653-2.6-1.40.29 (TeX Live 2026) (preloaded format=pdflatex)
```

Count of affected steps: **1 in `cv`** (`build-cv.yml:84`) and **6 in
`construction-ai-proposal`** (`build-and-publish-pdf.yml:35,44,51,58,65,72`) = **7**. Every one
of them pulls and executes whatever `:latest` resolves to at run time, as root in the job
container. The `@<sha>` on the `uses:` line pins a ~50-line shell wrapper; it does not pin the
several-GB image that actually runs. Whoever controls that tag controls those jobs.

Fix is one line per step: `docker_image: ghcr.io/xu-cheng/texlive-full@sha256:<digest>` (the
digest observed in both runs today is `sha256:11383430b9a3e48c0b79339f34d8092f942f897d91ab3749d4899d06731fea7f`),
or at minimum `texlive_version: "2026"`.

---

## 5. Did the fix break anything?

### 5a. YAML validity — PASS, 6/6

Every workflow at every wave-target ref parses. Parse exit captured directly, file size printed
so an empty-file false pass is visible:

```
VALID_YAML   agentic-kgis:.github/workflows/ci.yml            parse_exit=0 bytes=3706
VALID_YAML   agentic-kgis:.github/workflows/docs-publish.yml  parse_exit=0 bytes=4056
VALID_YAML   construction-ai-proposal:.github/workflows/build-and-publish-pdf.yml parse_exit=0 bytes=7636
VALID_YAML   phd-milestones:.github/workflows/ci.yml          parse_exit=0 bytes=1067
VALID_YAML   phd-milestones:.github/workflows/publish.yml     parse_exit=0 bytes=3730
VALID_YAML   cv:.github/workflows/build-cv.yml                parse_exit=0 bytes=9702
```

### 5b/5c. CI conclusions on the wave-target heads

```
agentic-kgis @34b5be7:   docs success · governance success · runtime-import (3.11) success
                         · runtime-import (3.12) success · test success
                         runs: "Docs — build, validate, and (gated) publish" success · "ci" success
construction @b3fb677:   build success · deploy success      → "Build and Publish PDF" success
phd-milestones @a71b9e5: publish success                      → "publish" success
cv @51c3443:             build-cv **FAILURE**
                         Python tests & lint    success
                         Discover variants      success
                         Compile sde-long       success
                         Compile research-professional success
                         Compile anthropic-fellow **failure**
                         Compile academic       **cancelled**  (fail-fast: true)
                         Publish release + hub contract **skipped**
```

`phd-milestones` shows no `ci` run on `main` — that is **by design**, not a gap:
`ci.yml` is `on: push: branches-ignore: [main]  # main is covered by publish.yml`.

### F-2 — `cv` is red on the wave-target head, and the hub publish never ran

`publish` is `needs: build` with `fail-fast: true` on the variant matrix, so one variant's failure
cancelled a sibling and skipped the publish job. Consequence: **`cv` has not published to the hub
since the pin landed**, and `contract/publish@f98a928…` — the highest-value pin in the repo — has
never actually executed at its pinned SHA on `master`. The pin is untested in production.

### The failure is NOT caused by the pin — established, not assumed

The tempting story (pin changed the action → broke the build) is **false**. Evidence, each point
checked rather than inferred:

1. **The diff is workflow-only.** Nothing but `uses:` lines changed between the last green commit
   and the wave target:
   ```
   $ git -C /mnt/c/code/cv log --oneline aedb599..51c3443
   51c3443 ci: pin every action and contract/publish by commit SHA
   $ git -C /mnt/c/code/cv diff --stat aedb599 51c3443
    .github/workflows/build-cv.yml | 24 ++++++++++++------------
    1 file changed, 12 insertions(+), 12 deletions(-)
   $ git -C /mnt/c/code/cv diff --name-only aedb599 51c3443 | grep -v '^\.github/workflows/build-cv\.yml$'
   non_workflow_changes_grep_exit:1        # nothing else changed
   ```
   The full diff is 12 `@vN` → `@<sha>` substitutions and nothing else — `args`, `root_file` and
   every other input are byte-identical.

2. **The pinned SHA is exactly what the old floating tag resolved to.** `v3` →
   `e2f99d4b3685…`, and the newest commit on that line is `2025-04-28`, over a year before either
   run. The tag could not have moved between the green run and the red one. The runner logs confirm
   both runs loaded the same code — only the cache directory name differs:
   ```
   PASS: Download action repository 'xu-cheng/latex-action@v3' (SHA:e2f99d4b3685b0da93f97e1b86ad8fab81105098)
   FAIL: Download action repository 'xu-cheng/latex-action@e2f99d4b…' (SHA:e2f99d4b3685b0da93f97e1b86ad8fab81105098)
   ```

3. **Identical container image digest** in the green and red runs — so not environment drift
   either:
   ```
   PASS (2026-09-16): Digest: sha256:11383430b9a3e48c0b79339f34d8092f942f897d91ab3749d4899d06731fea7f
   FAIL (2026-09-21): Digest: sha256:11383430b9a3e48c0b79339f34d8092f942f897d91ab3749d4899d06731fea7f
   ```

4. **Identical dependency versions**, so the unpinned `pip install` is not the trigger here
   either — both runs resolved `bibtexparser-2.0.1`:
   ```
   PASS: Successfully installed … bibtexparser-2.0.1 jinja2-3.1.6 pydantic-2.13.5 … pyyaml-6.0.3 …
   FAIL: Successfully installed … bibtexparser-2.0.1 jinja2-3.1.6 pydantic-2.13.5 … pyyaml-6.0.3 …
   ```

5. **Two sibling variants compiled successfully** in the very same red run, through the same
   pinned action and the same image.

6. **The actual cause is a crash.** `latexmk` prints the child's status divided by 256:
   ```
   xelatex: Command for 'xelatex' gave return code 0.54296875
   $ python3 -c "print(0.54296875*256)"  ->  139.0     # 128 + 11 = SIGSEGV
   ```
   `xelatex` segfaulted on the second of four passes (green run: 4 invocations, 4 `Output written`;
   red run: 2 invocations, 1 `Output written`).

> **Method correction on myself.** I initially "found" that the red log contained
> `biblatex Warning: Type 'article' not found` and the green log did not — and nearly reported it
> as the cause. It was an artifact: my red-log grep pattern included `not found` and my green-log
> pattern did not. Re-run with one identical pattern over both logs, the counts are equal
> (`2` and `2`), as are the per-pass `Missing character` rates (11 over 2 passes vs 22 over 4).
> That near-miss is the same class of error as testing `&&` after a pipe: two greps that are not
> the same command cannot be compared.

So: **5b PASS** (pin exonerated, on six independent lines of evidence), **5c FAIL** (the tree is
red regardless), **5d NOT TESTED** — confirming a transient segfault would require re-running the
job, which is a mutation I am not permitted to make. The single-occurrence history
(`aedb599` and every prior `master` build green) is consistent with a transient crash but does not
prove it.

---

## 6. In scope, uncounted

**F-1** (above) — rolling `ghcr.io/xu-cheng/texlive-full:latest`, 7 steps, 2 repos. The substantive
finding; it is why this report says FAIL.

**F-2** (above) — `cv` red on the wave-target head; hub publish skipped; the pin unexercised.

**F-3 — unpinned runtime package installs inside the pinned workflows.** Pinning `uses:` and
leaving the installs open is a half-closed door. In `cv` alone:

```
build-cv.yml:33:          python -m pip install --upgrade pip
build-cv.yml:34:          pip install -e ".[dev]"
build-cv.yml:78:          pip install pyyaml jinja2 pydantic bibtexparser
build-cv.yml:91:        run: sudo apt-get update && sudo apt-get install -y poppler-utils imagemagick
build-cv.yml:209:          .venv/bin/pip install --quiet pyyaml pydantic
```

Note line 78 installs `bibtexparser` **unconstrained**, while `pyproject.toml` deliberately pins
`bibtexparser>=1.4.1,<2`. The workflow therefore runs `2.0.1` — the exact version the project
forbids — silently bypassing the constraint. There is already an un-merged branch
`origin/fix/bibtexparser-pin` ("pin bibtexparser<2: CI is red on a fresh install"), but it is cut
from a **pre-pin** base: its diff *reverts* every SHA back to `@v4`/`@v5`/`@v3`. Merging it as-is
would undo check 6 in `cv`. Flagging before someone merges it to fix the red.

**F-4 — the hub's own published contract contradicts the shipped state.**
`website/docs/satellites.md` §"Why `@main` and not a pinned commit" instructs satellites to use a
moving ref and argues *against* a SHA: *"the answer is a moving `v1` tag the hub advances
deliberately, not a commit SHA that would freeze every satellite on a stale contract."* The
sample block still reads `uses: djjay0131/website/contract/publish@main`. All three consumers are
now SHA-pinned, and `phd-milestones/publish.yml:69` still carries the stale inline comment *"The
hub's own action, referenced at @main on purpose: contract fixes, including security fixes, reach
every satellite without a pull request in each one (docs/satellites.md)"* directly above a pinned
line. This is a real decision conflict, not a typo: the documented propagation path for hub-side
**security** fixes is now severed, and nobody recorded that trade. Needs an ADR or a doc update —
and, if the doc's reasoning still holds, the `v1`-tag mechanism it names.

Related and cosmetic: the trailing `# main` comments on the three `contract/publish` pins are
accurate only while `website` `main` == `f98a928…` (true right now). They will read as lies after
the next push to the hub. `# f98a928 (main @ 2026-09-18)` would age honestly.

**F-5 — the satellite roster is two, not four.** The authoritative list is Terraform, which is
what actually grants publish access (`infra/variables.tf`, `variable "satellites"`):

```
  default = {
    cv             = { repository = "djjay0131/cv",             default_branch = "master" }
    phd-milestones = { repository = "djjay0131/phd-milestones", default_branch = "main" }
  }
```

No `.tfvars` overrides it. So: `cv` and `phd-milestones` are satellites; `agentic-kgis` is a
*prospective* one (its publish step is `if: github.event_name == 'workflow_dispatch'` and
commented "GATED PUBLISH — disabled until the owner provisions the kgis satellite");
`construction-ai-proposal` is **not a satellite at all** — it has no `contract/publish` step and
deploys to its own GitHub Pages. The four-repo scope is still the right *pinning* scope, but
calling them "four satellites" overstates the blast radius by two and understates the care
`cv`/`phd-milestones` warrant.

**No fifth satellite is hiding.** I swept every other `djjay0131` repo with workflows for hub
references — `agentic-kg`, `agentic-kgcs`, `agentic-governance`, `soa-agentic-se`, `home-network`,
`mats-12-application`, `ai-empirical-se-chapter`, `ncsu-las-2026` — and all returned `hub_refs=0`.
(Caveat: GitHub's code-search API is unreliable here; `search/code` for the publish string returned
only `website` and missed three known consumers, presumably index lag plus the private repo. I did
not rely on it — the sweep above reads each workflow's bytes directly.)

Out of scope but worth one line for a future wave: those same repos are **100% unpinned** —
`agentic-kg` alone has 73 unpinned `uses:` across 11 workflows, and `agentic-kgcs`, the sibling of
a repo in this wave, has 4. Check 6's standard is not applied there at all.

---

## What would flip this to PASS

1. Pin the container image in the 7 `latex-action` steps (`docker_image: …@sha256:…`, or at least
   `texlive_version`). Closes F-1, the stated reason for the FAIL.
2. Get `cv` green on `master` and confirm the publish job runs `contract/publish@f98a928…` once —
   without merging `fix/bibtexparser-pin` as it currently stands (it reverts the pins). Closes F-2.
3. Reconcile `docs/satellites.md` §"Why `@main`" and the `phd-milestones` comment with the shipped
   SHA pins, in an ADR. Closes F-4.

F-3 and F-5 are follow-ups, not blockers.

---

## Discipline notes

- Every count reported came from a command whose total-matched figure is printed and non-zero.
- Exit statuses were captured directly (`grep_exit:`, `parse_exit:`, `is_ancestor_exit:`), never
  inferred from the tail of a pipeline.
- Two of my own checks produced convincing wrong answers before being caught: the `gh`-eats-stdin
  loop that verified 1 of 12 pins and looked complete, and the mismatched-grep comparison that
  invented a difference between two logs. Both are corrected above and both are recorded rather
  than quietly fixed.
- `NOT TESTED` is used once (5d) and is not counted as a pass.
