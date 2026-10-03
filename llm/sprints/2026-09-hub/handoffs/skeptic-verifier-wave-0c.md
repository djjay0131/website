# Handoff — Skeptic Verifier, Wave 0c (branding)

Contract: `llm/sprints/2026-09-hub/contracts/skeptic-verifier-wave-0c.md`
Branch: `feat/branding` (PR #91)
Date: 2026-10-03
Status: Complete — five demonstrations run red→green; restore verified exact.

Baseline before any mutation, and again after restore:

- `npm test` → 23 files, **295 passed | 1 skipped (296)**
- `npm run contrast` → **56 pairs, 0 below AA** (exit 0)

All planted failures were reverted with the `edit` tool (no `git checkout`,
no stash, no history or cloud mutation). Restoration is proved by
`git hash-object` equality and an empty `git diff --stat`.

---

## Demonstration 1 — a wrong band colour turns `tokens.test.ts` red

**Mutation** (`site/src/styles/tokens.css:118`):
`--color-band: var(--vt-band);` → `--color-band: #7a1f3d;`

**Red** — `npx vitest run src/styles/tokens.test.ts`:

```
❯ src/styles/tokens.test.ts (9 tests | 1 failed)
  × resolves every brand token to the VT ramp, in both themes
AssertionError: light --color-band declaration: expected '#7a1f3d' to match /^var\(--vt-/
  ❯ src/styles/tokens.test.ts:123:81
Test Files  1 failed (1)   Tests  1 failed | 8 passed (9)
```

The literal both breaks the `^var(--vt-` delegation check and resolves to a
non-brand value. The alternative shape — a `--vt-band` primitive changed so
that `--color-band` still delegates but resolves off-ramp — is caught by the
second assertion at `tokens.test.ts:125` (resolved value must equal `#861f41`).

**Green** — reverted to `--color-band: var(--vt-band);`.

**Restore** — `tokens.css` = `369918c4e7c25ab5a05830bb101b5a09c8b42ab3`
(unchanged from before the mutation).

---

## Demonstration 2 — a sub-AA pair turns `npm run contrast` red

**Mutation** (`site/src/styles/tokens.css:108`):
`--vt-orange-text: #c34600;` → `#e5751f;` (the undarkened VT orange).

**Red** — `npm run contrast`:

```
light  --vt-orange-text  #e5751f on --color-bg  #f4f5f1  2.78:1 FAIL
56 pairs, 1 below AA
npm run contrast EXIT=1
```

2.78:1 is far below AA 4.5:1. `tokens.test.ts`'s "keeps every text pair at
WCAG AA" test would fail on the same value via the shared `checkContrast`
import; the contract named the CLI, so the CLI transcript is shown.

**Green** — reverted to `--vt-orange-text: #c34600;` (4.57:1).

**Restore** — `tokens.css` hash equals baseline (above).

---

## Demonstration 3 — `--tracker-petrol` removal is pinned

Two results, one of which is a finding.

### 3a. A bare re-introduced `--tracker-petrol` declaration is NOT caught — **could not be made to fail**

Mutation: add `--tracker-petrol: #326a64;` back to the light palette next to
`--tracker-petrol-soft`. Run `npm test`:

```
Test Files  23 passed (23)
     Tests  295 passed | 1 skipped (296)
EXIT=0
```

The "carries over the tracker palette verbatim" test iterates the fixed
`TRACKER_PALETTE` map; it checks that each listed colour is present, but never
asserts that no *extra* `--tracker-*` token exists. Re-introducing petrol as a
declaration is therefore invisible to the suite. The removal is pinned only
against *use*, not against a lingering uncited declaration.
**Fix now:** add a test that collects every `--tracker-\w+` declaration in
`tokens.css` and asserts the key set equals the verbatim palette (which still
contains `petrol-soft`, but not `petrol`).

### 3b. Re-introducing petrol as the accent fails — red

With `--tracker-petrol: #326a64;` declared, point the accent back at it:
`--color-accent: var(--vt-maroon);` → `var(--tracker-petrol);`. Run
`npx vitest run src/styles/tokens.test.ts`:

```
× uses the VT accent: Chicago Maroon in light, Burnt Orange in dark
    expect(themes.light["color-accent"]).toBe("#861f41")   // received #326a64
× resolves every brand token to the VT ramp, in both themes
    light --color-accent declaration: expected 'var(--tracker-petrol)' to match /^var\(--vt-/
Test Files  1 failed (1)   Tests  2 failed | 7 passed (9)
```

**Green** — reverted to `--color-accent: var(--vt-maroon);` and removed the
petrol declaration.

### 3c. Removing a band token from the carve-out fails — red

Mutation (`site/src/styles/tokens.test.ts:47`): delete `"color-link",` from
`BRAND_ACCENT_TOKENS`. Run the token test:

```
× maps each site token onto its tracker colour, departing only for AA
TypeError: Cannot read properties of undefined (reading 'replace')
  ❯ relativeLuminance scripts/contrast.mjs:135:17
  ❯ contrastRatio scripts/contrast.mjs:145:21
  ❯ src/styles/tokens.test.ts:108:35
Test Files  1 failed (1)   Tests  1 failed | 8 passed (9)
```

The carve-out is load-bearing: without it the mapping test tries to compare a
`--vt-*`-driven token against the now-absent `--tracker-petrol` source and
crashes. (Removing `color-band`/`rule-orange`/`vt-orange-text` instead has no
effect, because those names are not in `TOKEN_SOURCES`.)

**Restore** — `tokens.css` and `tokens.test.ts` hashes equal baseline
(`369918…`, `7039e6…`).

---

## Demonstration 4 — the portrait guard is live

**Red (build refusal, positive control)** — plant a stale
`site/public/photo_jason_1.jpeg`, then `npm run build:public`:

```
[hub-og-card] generated the default og:image (no portrait): public/og-card.png
[hub-public-build] removed a stale public portrait; the public site serves none (ADR-0015)
BUILD EXIT=0
after build:  public/photo_jason_1.jpeg       → No such file
              dist-public/photo_jason_1.jpeg  → No such file
```

The guard is deletion, not a failing assertion: `public-build.mjs`'s
`astro:config:setup` hook and `stage-public-assets.mjs`'s `rmSync` both remove
the stale file before Astro copies `public/`; the staging loop never adds it.
The unit-level twin (`sync-content.test.ts` "removes a stale portrait an older
build left in public/") pins the staging side.

**Finding — could not be made to fail on the `dist-public` branch.** Plant
`site/dist-public/photo_jason_1.jpeg` directly and run the checks:

```
npm run check:no-private-in-public → PASS (163 files scanned), EXIT 0
npm test                            → 295 passed | 1 skipped, EXIT 0
ls dist-public/photo_jason_1.jpeg   → present
```

Nothing refuses a portrait that is already in `dist-public`. The leak check
scans for private *items*; the portrait is not one, and as a binary it is
matched by path only, which `photo_jason_1.jpeg` does not match. The only
protection is that the build deletes `public/photo_jason_1.jpeg` at
`config:setup`; an output tree seeded around the build (or a non-Astro copy) is
unguarded. **Fix now:** extend the leak check with a forbidden-output-path
assertion for `photo_jason_1.jpeg`, or assert `dist-public` holds no
portrait-named file.

**Restore** — removed the planted `dist-public/photo_jason_1.jpeg` (already
absent from `public/` after the build). No git-visible change; both paths are
confirmed absent.

---

## Demonstration 5 — OG card no-portrait behaviour

**Green (as landed):**

- All **26** emitted HTML pages carry
  `property="og:image" content="https://jason.cusati.us/og-card.png"`.
- `dist-public/` contains no `photo*` file.
- `public/og-card.png` and `dist-public/og-card.png` are 1200×630 PNGs;
  `public/og-card.svg` contains **0** `<image>` references.
- No page passes an explicit `ogImage` prop (only the `Base.astro` default is
  in play), so the portrait cannot be selected through the normal path.

**Red (violation planted):** change the `Base.astro:48` default from
`og-card.png` to `photo_jason_1.jpeg` and rebuild:

```
26 property="og:image" content="https://jason.cusati.us/photo_jason_1.jpeg"
```

**Green (restore + rebuild):**

```
26 property="og:image" content="https://jason.cusati.us/og-card.png"
```

**Finding — there is no refusal guard, only a structural default.**
`renderOgCardSvg({ name, title, affiliation, portrait, image })` silently
ignores the portrait/image keys:

```
contains <image>: false
contains photo_jason: false
contains #861f41 band: true
```

It cannot embed a portrait (it accepts only name/title/affiliation and draws
rects + text), but it does not "refuse/fail" when handed one, and there is no
automated test of the no-portrait property — the demonstration above was a
manual grep of emitted HTML. Lower severity than the two gaps above, since the
default is a single declaration, but it is untested.

**Restore** — `Base.astro` hash equals baseline (`138772…`), rebuilt green.

---

## Guards that could not be made to fail

1. **Bare `--tracker-petrol` declaration re-introduction** (Demo 3a). No test
   asserts the absence of extra `--tracker-*` tokens. *Fix now.*
2. **A portrait already present in `dist-public`** (Demo 4). The leak check
   passes it; only `public/photo_jason_1.jpeg` is ever deleted. *Fix now.*
3. **The OG no-portrait property** (Demo 5) has no automated test; it is
   enforced only by the `Base.astro` default and verified by manual inspection.

---

## Restore evidence

`git hash-object` — values in parentheses are the pre-mutation baseline; all
current values match:

| File | Hash (baseline = current) |
| --- | --- |
| `site/src/styles/tokens.css` | `369918c4e7c25ab5a05830bb101b5a09c8b42ab3` |
| `site/src/styles/tokens.test.ts` | `7039e6d2ed32352d5e6ba6cbf715bf1fc5a8c98b` |
| `site/src/layouts/Base.astro` | `13877286834c42407244b38550600f2f1ca3066c` |
| `site/scripts/contrast.mjs` (untouched) | `5053e5404648f7c930e1ede71a12f896e14af8a0` |
| `site/scripts/og-card.mjs` (untouched) | `ccc6fe37ec49660142dddea84cb15c808b0c7ef0` |
| `site/scripts/public-build.mjs` (untouched) | `d6978527c52e0f183d567df2f9a5c14402575d9d` |
| `site/scripts/stage-public-assets.mjs` (untouched) | `f8a6afc2468bc39b5c4a4c0dce7f46fb6c25f971` |

- `git diff --stat` → empty.
- `git status --short` → only
  `?? llm/sprints/2026-09-hub/handoffs/red-team-wave-0c.md`, which is another
  verifier's untracked handoff, present before this run and not authored or
  touched by me.
- `npm test` → 23 files, 295 passed | 1 skipped (296).
- `npm run contrast` → 56 pairs, 0 below AA, exit 0.
- Planted files removed: `site/public/photo_jason_1.jpeg`,
  `site/dist-public/photo_jason_1.jpeg` both confirmed absent.

Handoff filename: `llm/sprints/2026-09-hub/handoffs/skeptic-verifier-wave-0c.md`
