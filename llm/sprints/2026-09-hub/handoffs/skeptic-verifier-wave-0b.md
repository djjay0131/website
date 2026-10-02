# Handoff — Skeptic Verifier, Wave 0b (private by default)

Stream: Skeptic Verifier (adversary; authors no source, fixes nothing)
Wave: 0b — private by default (D8)
Branch: `feat/private-by-default` (PR #86)
Date: 2026-10-02
Contract: `llm/sprints/2026-09-hub/contracts/skeptic-verifier-wave-0b.md`
Seams: `llm/sprints/2026-09-hub/contracts/private-by-default-seams.md`
Status: **Complete. Tree restored, all guards green, one detection-coverage limit recorded.**

## Summary

I broke both new guards, recorded red and green, and restored the tree. All five
mandatory demonstrations were made red, then restored/re-verified green:

| # | Demonstration | Result |
|---|---|---|
| 1 | `cv-data` residue (SEAM-B3): planted marker caught by the leak check | **RED** exit 1, named `cv/anthropic-fellow`; **GREEN** after restore |
| 2 | Remove `cv/academic` from a copy of the allowlist | allowlist guard **blind** (PASS); leak check **RED** exit 1 (14 leaks) / rebuilt **RED** (4 leaks); **GREEN** after restore |
| 3 | Condition A: allowlist a manifest-`private` item | **RED** exit 1 in **both** `pr` and `deploy`; **also a hard build failure**; committed allowlist GREEN |
| 4 | Condition B: stale entry / wholly-absent source | `pr` **RED** exit 1; `deploy` warns and exits 0 (with `::warning`); absent source does **not** fail `pr`; committed allowlist GREEN |
| 5 | `cv` is deliberately not a bare source needle | no `source` needle; bare `cv` output PASSES; planted `cv/anthropic-fellow` **RED** via qualified-id/route |

**One guard could not be made to fail as literally worded** — the Demo 1
instruction to plant an *arbitrary* marker in the fellowship variant. Reason and
transcripts are in "Guards that could not be made to fail" below. It is a
detection-coverage limit of the content grep, not (today) a bypass, because the
render-time filter prevents the payload reaching `dist-public` at all.

No guard failed to fail in a way that lets private content out under the
committed allowlist. The one **bypass** in this wave is the Red Team's A5
(allowlist binds `(source, slug)`, staging copies the manifest `path`), which the
leak check cannot see because binaries are matched by path only; it is unchanged
and out of this contract's scope, and I did not re-run it.

## Demonstrations

All commands run from `site/`, sequential builds. Backups:
`/tmp/opencode/wave0b/sources-backup` and
`/tmp/opencode/wave0b/publish-allowlist.json.bak`.

### Demo 1 — `cv-data` residue (SEAM-B3), explicitly required

I planted `SEAM-B3-FELLOWSHIP-CANARY-7F3A9` in three places in the gitignored
fixture: the fellowship manifest item's `title`, the fellowship variant's
`label`/`description`, and a new `fellowship-only` summary that **only the
fellowship variant references** and that I placed **first** in `summaries.yaml`.
The public home page renders the shared pool's first summary (`index.astro:11`),
so this content is the SEAM-B3 residue reaching public.

**RED**

```
$ grep -n CANARY src/content/sources/cv/manifest.json \
      src/content/sources/cv/cv-data/data/content/summaries.yaml \
      src/content/sources/cv/cv-data/data/variants/anthropic-fellow.yaml
manifest.json:25:      "title": "SEAM-B3-FELLOWSHIP-CANARY-7F3A9",
summaries.yaml:3:  text: SEAM-B3-FELLOWSHIP-CANARY-7F3A9 content only the fellowship variant includes.
anthropic-fellow.yaml:3:label: Fellowship SEAM-B3-FELLOWSHIP-CANARY-7F3A9
anthropic-fellow.yaml:4:description: SEAM-B3-FELLOWSHIP-CANARY-7F3A9 fellowship-only content.

$ npm run build:public              # exit 0
15:39:55 [build] 26 page(s) built in 1.43s
$ grep -rl "SEAM-B3-FELLOWSHIP-CANARY-7F3A9" dist-public
dist-public/index.html

$ npm run check:no-private-in-public   # exit 1
check:no-private-in-public: 4 private item(s) to look for in dist-public:
  cv/anthropic-fellow — needles: qualified-id, slug, route, payload-path, title
  ...
check:no-private-in-public: 1 LEAK(S) of private content into dist-public:

  index.html
    contents: title of cv/anthropic-fellow — "SEAM-B3-FELLOWSHIP-CANARY-7F3A9"
    …class="subtitle" data-astro-cid-lcdefpme>SEAM-B3-FELLOWSHIP-CANARY-7F3A9 content only the fellowship variant inc…
```

**GREEN** (restore + rebuild + check)

```
$ rm -rf src/content/sources && cp -a /tmp/opencode/wave0b/sources-backup src/content/sources
$ diff -rq /tmp/opencode/wave0b/sources-backup src/content/sources && echo RESTORE IDENTICAL
RESTORE IDENTICAL
$ npm run build:public              # exit 0, 26 pages
$ npm run check:no-private-in-public   # exit 0
check:no-private-in-public: PASS — no private slug, source, route, payload path, title or
  summary appears in any path or any file's contents under dist-public (161 files scanned).
```

**Mechanism and honest caveat.** The check fires because the marker is the
private item's manifest **title**, which is a needle. The residue reached public
through the *shared content pool* (`index.astro` renders `summaries.values()[0]`),
not through the variant: `cv/index.astro:15-20`, `resumes/index.astro:12-17` and
`cv/[variant].astro:19-21` intersect the variant list with
`collectPublicItems(...)`, and `public-build.mjs` stages only `html`/`bundle`
payloads (`:26`, `:109-113`), so no `cv-data` YAML is ever emitted. See the
"could not be made to fail" section for the arbitrary-marker case.

### Demo 2 — a wrong allowlist entry (remove `cv/academic`)

Copy of the committed allowlist minus `cv/academic`
(`/tmp/opencode/wave0b/skeptic/allowlist-no-academic.json`, 13 entries).
The committed file was **not** the CLI input.

First, the allowlist guard is blind to removing an allowlisted item:

```
$ node scripts/check-publish-allowlist.mjs --mode pr --allowlist /tmp/.../allowlist-no-academic.json
check:publish-allowlist: PASS (mode pr) — 13 entries, 0 conflicts, 0 stale.   # exit 0
```

The actual effect is on the build/leak check. Run from a temp cwd whose only
`publish-allowlist.json` is the copy, against the real committed-allowlist build:

```
$ cd /tmp/opencode/wave0b/skeptic/checkcwd   # contains the 13-entry copy
$ node /home/djjay/code/website/site/scripts/check-no-private-in-public.mjs \
      --dist  /home/djjay/code/website/site/dist-public \
      --sources /home/djjay/code/website/site/src/content/sources
check:no-private-in-public: 5 private item(s) ... cv/academic — needles: qualified-id, slug, route, payload-path, title
check:no-private-in-public: 14 LEAK(S) ...                            # exit 1
  cv/academic/index.html  path: slug of cv/academic — "academic"
  cv/index.html           contents: qualified-id of cv/academic — "cv/academic"
  index.html              contents: qualified-id of cv/academic — "cv/academic"
  pdfs/academic.pdf       path: slug of cv/academic — "academic"
  resumes/index.html, sitemap-0.xml, ... 13 more
```

Then, to show the **rebuilt** output, I transiently swapped the committed path
(the build can read no other), staged, and built:

```
$ cp publish-allowlist.json publish-allowlist.json.committed   # backup
$ cp /tmp/.../allowlist-no-academic.json publish-allowlist.json
$ node scripts/stage-public-assets.mjs     # academic.pdf removed
$ npm run build:public                     # exit 0, 25 pages (was 26)
$ npm run check:no-private-in-public       # exit 1
check:no-private-in-public: 5 private item(s) ... cv/academic ...
check:no-private-in-public: 4 LEAK(S):
  index.html                  contents: qualified-id of cv/academic — "cv/academic"
    …<a href="/cv/academic" class="btn btn-primary" …>
  index.html                  contents: slug of cv/academic — "academic"
  research/.../sources/index.html  contents: slug — "academic"   (CSS class `.chip.s-academic`)
  research/.../sources/index.html  contents: slug — "academic"   (CSS class `.chip.s-academic`)
```

**Mechanism.** With `cv/academic` not allowlisted, the `/cv/academic/` page and
`/pdfs/academic.pdf` are no longer emitted, but `index.astro:41-42` **hardcodes**
`<a href="/cv/academic">` and `<a href="/pdfs/academic.pdf">`, so the home page
still names the now-private item and the leak check catches it. The allowlist
guard alone is silent: removing a public item is neither a conflict (Condition A)
nor stale (Condition B).

**GREEN** (restore committed + re-stage + rebuild + check)

```
$ cp publish-allowlist.json.committed publish-allowlist.json
$ sha256sum publish-allowlist.json
be524caf378fe8d3a42e6717552e6bdc68e8f41ea304be17c24931794b2c34ab  publish-allowlist.json
$ git diff --stat -- publish-allowlist.json     # (empty)
$ node scripts/stage-public-assets.mjs          # academic.pdf back
$ npm run build:public                          # exit 0, 26 pages
$ npm run check:no-private-in-public            # exit 0 PASS (161 files)
```

### Demo 3 — Condition A (allowlist names a manifest-`private` item)

Temp allowlist = committed + `{ "source": "phd-milestones", "slug": "milestones" }`
(`phd-milestones/milestones` is `visibility: private`).

```
$ node scripts/check-publish-allowlist.mjs --mode pr     --allowlist /tmp/.../allowlist-condition-a.json
check:publish-allowlist: CONFLICT the allowlist names ("phd-milestones", "milestones"), but
  that item's manifest says visibility: private. ... (SEAM-B5 condition A)
check:publish-allowlist: FAIL. ...                                            # exit 1

$ node scripts/check-publish-allowlist.mjs --mode deploy --allowlist /tmp/.../allowlist-condition-a.json
check:publish-allowlist: CONFLICT ... (same)
check:publish-allowlist: FAIL. ...                                            # exit 1
```

Condition A is **also a hard build failure**. Transient swap of the committed
path then `npm run build:public`:

```
$ cp /tmp/.../allowlist-condition-a.json publish-allowlist.json
$ npm run build:public                                                        # exit 1
the publish allowlist conflicts with a satellite manifest:
  the allowlist names ("phd-milestones", "milestones"), but that item's manifest says
  visibility: private. ... Remove the entry, or ask the satellite to publish it as public.
  Location: /home/djjay/code/website/site/src/content.config.ts:349:11
```

**GREEN**: committed allowlist restored (sha `be524caf…`), `check:publish-allowlist`
PASS in both modes (14 entries, 0 conflicts, 0 stale); build exit 0.

### Demo 4 — Condition B (stale entry vs wholly-absent source)

`allowlist-condition-b-stale.json` = committed + `cv/does-not-exist` (source `cv`
present, slug absent). `allowlist-condition-b-absent-source.json` = committed +
`ghost-src/whatever` (source absent entirely).

```
$ node scripts/check-publish-allowlist.mjs --mode pr     --allowlist .../stale.json
check:publish-allowlist: 1 STALE entry in site/publish-allowlist.json (mode pr):
  cv/does-not-exist names no item in any manifest. On a pull request a stale entry is the
  hub's own bookkeeping error and fails the build; fix it before merging (SEAM-B5 condition B).
check:publish-allowlist: FAIL. ...                                            # exit 1

$ GITHUB_ACTIONS=true node scripts/check-publish-allowlist.mjs --mode deploy --allowlist .../stale.json
check:publish-allowlist: 1 STALE entry in site/publish-allowlist.json (mode deploy):
  cv/does-not-exist names no item in any manifest. A satellite rename is ordinary content
  editing and must NOT stop the hub deploying or withdrawing, so the deploy build continues
  -- but this entry is now doing nothing.
::warning title=Stale publish allowlist entry::cv/does-not-exist names no item
check:publish-allowlist: PASS (mode deploy) — 7 entries, 0 conflicts, 1 stale.  # exit 0

$ node scripts/check-publish-allowlist.mjs --mode pr --allowlist .../absent-source.json
check:publish-allowlist: PASS (mode pr) — 7 entries, 0 conflicts, 0 stale.       # exit 0
$ node scripts/check-publish-allowlist.mjs --mode deploy --allowlist .../absent-source.json
check:publish-allowlist: PASS (mode deploy) — 7 entries, 0 conflicts, 0 stale.  # exit 0
```

**GREEN**: committed allowlist PASS in both modes (14 entries, 0 conflicts, 0 stale).

### Demo 5 — `cv` is deliberately not a bare source needle

```
$ node --input-type=module -e '...from "./scripts/check-no-private-in-public.mjs"...'
SOURCE_MIN_LENGTH = 4  (|cv| = 2)
needles for cv/anthropic-fellow: qualified-id, slug, route, payload-path, title
has a bare `source` needle?  false
would a bare `cv` needle fire on clean markup? true (true => it was deliberately excluded)
```

`SOURCE_MIN_LENGTH = 4` (`check-no-private-in-public.mjs:98`) excludes `cv`;
`needlesFor` carries it by qualified-id (`cv/anthropic-fellow`), route
(`/cv/cv/anthropic-fellow/`) and payload-path (`cv/anthropic-fellow.pdf`). A bare
`cv` needle would delimiter-match every `/cv/…` link in a clean build, so it is
not emitted.

**RED** — temp dist with a bare-`cv` page plus two planted traces:

```
$ node scripts/check-no-private-in-public.mjs \
      --dist /tmp/.../demo5-dist --sources /tmp/.../demo5-sources      # exit 1
check:no-private-in-public: 1 private item(s) ... cv/anthropic-fellow — needles: qualified-id, slug, route, payload-path, title
check:no-private-in-public: 4 LEAK(S):
  leak-qualified/index.html  contents: qualified-id of cv/anthropic-fellow — "cv/anthropic-fellow"
  leak-route/index.html      contents: qualified-id of cv/anthropic-fellow — "cv/anthropic-fellow"
  leak-route/index.html      contents: slug of cv/anthropic-fellow — "anthropic-fellow"
  leak-route/index.html      contents: route of cv/anthropic-fellow — "/cv/cv/anthropic-fellow/"
```

`clean-with-bare-cv/index.html` (which contains `/cv/`, `/cv/academic/`,
`/_payload/cv/cv-data/`) produced **no** leak.

**GREEN** — same sources, dist limited to the bare-`cv` page:

```
$ node scripts/check-no-private-in-public.mjs \
      --dist /tmp/.../demo5-dist/clean-with-bare-cv --sources /tmp/.../demo5-sources
check:no-private-in-public: PASS — ... (1 files scanned).                     # exit 0
```

## Guards that could not be made to fail

**The literal Demo 1 as worded.** "Plant a distinctive marker inside the
fellowship variant (its YAML, its label, or content only it includes), run the
public build, and show `check:no-private-in-public` fails." An **arbitrary**
marker could not be made to fail, for two independent reasons, either of which is
sufficient:

1. **The payload never reaches `dist-public`.** The render-time filter
   (`cv/index.astro:15-20`, `resumes/index.astro:12-17`, `cv/[variant].astro:19-21`)
   and the staging rule (`public-build.mjs:26,109-113` — only `html`/`bundle` are
   staged, `data` is not) mean no `cv-data` YAML is emitted.
2. **An arbitrary marker is not a needle.** `needlesFor` derives needles only
   from the private *manifest item* — title, summary, slug, route, payload-path,
   qualified-id. Prose-only private content is deliberately not matched (the
   `milestones`-in-a-sentence regression). So even if arbitrary text did reach
   public, the grep would pass.

Negative controls:

```
# (2) isolated: an arbitrary canary present in a scanned dist still passes
$ node scripts/check-no-private-in-public.mjs --dist /tmp/.../demo1b-dist --sources /tmp/.../demo5-sources
check:no-private-in-public: PASS — ... (1 files scanned).                     # exit 0

# (1) full build: pure marker in the variant + an appended fellowship-only summary
$ npm run build:public                                                        # exit 0, 26 pages
$ grep -rl "SEAM-B3-PURE-CANARY-9C1D2" dist-public      → (none: filter held)
$ grep -rl "anthropic-fellow" dist-public               → (none)
$ npm run check:no-private-in-public                                          # exit 0 PASS
```

**Assessment.** This is a **detection-coverage limit**, not a bypass, while the
render-time filter holds: the guard is a backstop for the *item's* identity
(title/slug/route/path), and it has no needles for the private variant's own
prose (e.g. the variant `label: Fellowship`) or for arbitrary pool content only
that variant references. If the filter ever regresses, that class of residue
would publish silently. The `site` handoff already carries "a render-aware leak
check" as ADR candidate #2; this is evidence for it. Recommend **Fix later** (ADR
candidate), not Fix now, because the render filter currently refuses the payload.

The other guard limit I did **not** re-run is the Red Team's **A5** bypass — the
allowlist binds a name, and `stage-public-assets.mjs` copies the manifest `path`,
so a hostile manifest can serve the fellowship PDF at an allowlisted URL; the
leak check cannot see it (binary ⇒ path only). That is a real **Fix now** finding
authored by the Red Team, unchanged by me.

Minor observation (false positive, not a leak): with `cv/academic` treated as
private, the guard flags the CSS class `.chip.s-academic` on two public research
source pages. It does not fire under the committed allowlist, so it is latent.

## Restore evidence

```
$ git status --short
 M docs/satellites.md
 M llm/governance/adr/0016-private-by-default-publish-allowlist.md
 M site/scripts/check-publish-allowlist.mjs
?? llm/sprints/2026-09-hub/handoffs/dissenter-wave-0b.md
?? llm/sprints/2026-09-hub/handoffs/red-team-wave-0b.md

$ git show HEAD:site/publish-allowlist.json | sha256sum
be524caf378fe8d3a42e6717552e6bdc68e8f41ea304be17c24931794b2c34ab  -
$ sha256sum site/publish-allowlist.json
be524caf378fe8d3a42e6717552e6bdc68e8f41ea304be17c24931794b2c34ab  site/publish-allowlist.json

$ diff -rq /tmp/opencode/wave0b/sources-backup site/src/content/sources && echo identical
identical
$ grep -rn "CANARY" site/src/content/sources || echo "(none)"
(none)

$ npm run build:public                  # exit 0, 26 pages
$ npm run check:no-private-in-public    # exit 0 PASS (4 private items, 161 files)
$ npm run check:publish-allowlist       # exit 0 PASS (mode pr) — 14 entries, 0 conflicts, 0 stale
$ node scripts/check-publish-allowlist.mjs --mode deploy   # exit 0 PASS (mode deploy)
$ npm test                              # exit 0 — Test Files 23 passed; Tests 291 passed | 1 skipped
```

The three `M` files and two `??` handoffs were **already present before this run**
(recorded at the start; I did not author or touch them). The committed allowlist
sha is byte-identical to `HEAD`, the gitignored synced tree is byte-identical to
its pre-run backup, and the only file this run adds is this handoff.

## Related docs

- `llm/sprints/2026-09-hub/contracts/skeptic-verifier-wave-0b.md` — this contract
- `llm/sprints/2026-09-hub/contracts/private-by-default-seams.md` — SEAM-B3, SEAM-B5, SEAM-B6
- `llm/governance/adr/0016-private-by-default-publish-allowlist.md` — the decision under test
- `llm/sprints/2026-09-hub/handoffs/site-wave-0b.md` — implementer; ADR candidate #2 (render-aware leak check)
- `llm/sprints/2026-09-hub/handoffs/red-team-wave-0b.md` — A5 bypass (name-vs-bytes)
- `site/scripts/check-no-private-in-public.mjs`, `site/scripts/check-publish-allowlist.mjs`, `site/src/lib/hub-content.mjs`, `site/src/content.config.ts`
- Evidence transcripts: `/tmp/opencode/wave0b/skeptic/*.log`
