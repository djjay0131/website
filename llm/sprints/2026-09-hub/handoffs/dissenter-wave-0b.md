# Handoff — Dissenter, Wave 0b (private by default)

Stream: Dissenter (adversary; authors no source, fixes nothing)
Wave: 0b — private by default (D8)
Branch: `feat/private-by-default` (PR #86)
Contract: `llm/sprints/2026-09-hub/contracts/dissenter-wave-0b.md`
Date: 2026-10-02

Read: the contract; `private-by-default-seams.md` (SEAM-B1…B9); ADR-0016;
`handoffs/site-wave-0b.md`; `git diff main...feat/private-by-default` (36 files,
+1603/−56). Ran `npm test` from `site/`: **291 passed, 1 skipped**, matching the
handoff. Ran no astro build (shared `dist-*`).

These are design objections, not bugs. Each states the claim, severity, whether
it blocks the merge, and the evidence that would settle it. I fix nothing.

## Summary

The wave's core mechanism — `effectiveVisibility()` + the committed allowlist +
the widened leak check — is sound for **satellite** items and appears to close
`cv/anthropic-fellow` correctly. The design defects are all at the *edges of the
claim*, and one of them is serious: the wave's headline invariant ("one file is
the only way to publish") is now **false for first-party pages**, and the
governing documents (ADR-0016, SEAM-B1, SEAM-B6, `site-wave-0b.md` req 1) assert
it anyway. Three of the five objections are documentation/decision defects that
a merge would freeze into the durable record; none of the five is a code bug.

## Objections

### 1. The `hub/*` allowlist entries are documentation, not enforcement — the "one file is the only way to publish" claim is false for first-party pages, and SEAM-B6's "first-party hub pages included" private set is not implemented

**Claim.** SEAM-B1 says `site/publish-allowlist.json` "is the only way to make
something public", and SEAM-B6 says the leak check's private set is "every
non-allowlisted item, first-party hub pages included". Neither holds for
first-party pages. First-party routes are compiled verbatim from committed
`site/src/pages/**`; nothing reads the `hub` entries to decide whether a
first-party route may be emitted. Concretely:

- `collectPrivateItems()` (`check-no-private-in-public.mjs:139-173`) enumerates
  only directories under `sources/` that carry a `manifest.json`. A hub page has
  no manifest, so it can never enter the leak check's private set. SEAM-B6 names
  first-party pages as members of that set; the implementation cannot represent
  one.
- `findStaleAllowlistEntries()` (`hub-content.mjs:534-535`) explicitly returns
  `false` for `entry.source === HUB_SOURCE`. A `hub/<path>` entry naming a
  deleted, renamed or never-existing route is never reported — the exact
  bookkeeping drift condition B exists to catch.
- The day-one allowlist proves the entries are not an enforcement list: it names
  only the research digests (`publish-allowlist.json:9-17`) and omits `/`,
  `/cv/`, `/resumes/`, `/papers/`, `/privacy/`, `/signin/` and every other
  first-party page. If the `hub` entries governed emission, the site would be
  half-private by its own file.
- Nothing maps an emitted first-party route to an allowlist key. A route-level
  guard is feasible against existing machinery (`route-inventory.mjs:50`
  `routesFromPagesDir()` already enumerates non-dynamic `src/pages` routes); it
  is simply not wired up. The `site` handoff concedes all of this (assumption 1,
  ADR candidate 1, recommendation 1) and defers the guard to "before Wave 5".

**Severity: High.** It falsifies the wave's central security claim for one of
the two content classes the seam says it covers, and it directly contradicts
SEAM-B6.

**Blocks the merge? Yes — to reconcile claim and code, not necessarily to add
code.** Merging as-is permanently records a false invariant: ADR-0016 decision 1
("an item is public only when … the allowlist contains its `(source, slug)`.
First-party hub pages use `source: "hub"`") cannot be true, because hub pages
have no manifest for `effectiveVisibility()` to combine with. A future agent
reading the "durable" ADR will believe first-party publication is gated when it
is not — the false-assurance failure shape this repository's own ADRs warn
about. Acceptable dispositions: (a) build the route guard now, or (b) amend
ADR-0016, SEAM-B1/B6 and `site-wave-0b.md` req 1 to say explicitly that the
allowlist governs *satellite* items only and first-party pages are trusted
committed code. Either closes it; silence does not.

**Evidence that would settle it.** A transcript that (i) adds a new
`site/src/pages/foo.astro`, runs the public build and the leak check *without*
touching the allowlist, and shows `/foo/` emitted and no check failed (proves the
gap), then (ii) with a route guard added, shows the same page failing until a
`hub/foo` entry is committed, and a `hub/` entry for a deleted route failing the
guard (proves enforcement). For disposition (b), the amended ADR text is the
evidence.

### 2. A satellite's `visibility: public` request is recorded but never reconciled with the allowlist — the owner authors the allowlist blind

**Claim.** D8 makes `visibility` a *request*. The only build-time check that
compares request to decision is condition A, which fires when the allowlist names
a manifest-**private** item (`hub-content.mjs:493-508`). There is no symmetric
signal for the common case: a manifest says `public`, the allowlist omits it, and
the item silently does not appear. The first publish therefore looks like a
broken site (contract candidate 2), and the only feedback channel is a prose
instruction in `docs/satellites.md` telling the satellite to inform the owner.
The authority has no report of what is waiting on it.

**Severity: Medium.** Deliberate friction (ADR-0016 Consequences) is defensible;
friction with no queue and no signal is where "forgot to allowlist" becomes a
recurring operational fault. This is not a privacy risk — the fail direction is
private, which is correct.

**Blocks the merge? No.** It is a missing affordance, not a correctness defect.

**Evidence that would settle it.** An audit output (a `check:publish-allowlist`
report or a `--pending` mode) listing every manifest-`public` item the allowlist
does not name, shown to name a first publish before the owner acts; or an
explicit, tested statement that the owner accepts blind authoring and the
resulting lag. If neither exists, the gap is real.

### 3. Removing an entry from the allowlist demotes an item to members-only; it does not unpublish it — and the docs do not say so

**Claim.** SEAM-B4 makes the private build render every non-data item, public
and private alike. So de-allowlisting a `(source, slug)` whose manifest still
says `public` does not withdraw the item from the site: the public build drops it
and the private build keeps it, and `private-build.mjs` now stages it
(`private-build.mjs:69-77`) and `[...itemPath].astro` routes it. "Take it off the
allowlist" reads in the ADR and `docs/satellites.md` as "unpublish", but the
implemented meaning is "make it members-only". For a genuinely sensitive item
whose manifest still requests `public`, the owner can believe it is gone while it
remains served behind sign-in at a second URL. The public-vs-private URL
duplication is also unstated.

**Severity: Medium-High.** The failure is an expectation mismatch on the one
action the whole wave is about, in the direction that hides content removal
behind a boolean edit.

**Blocks the merge? No, but the semantics must be stated before merge.** ADR-0016
decision 3/Consequences and `docs/satellites.md` should say plainly that the
allowlist governs *public emission only*, that de-listing demotes to the members'
area, and that true withdrawal requires the satellite to withdraw the item from
its manifest/bucket (ADR-0010). Consumers also need to know a public item exists
at both `/<section>/<source>/<slug>/` and the private route.

**Evidence that would settle it.** A transcript: allowlist a `public` item, build
both outputs, then remove the entry, rebuild, and show the item absent from
`dist-public` but present in `dist-private` (and in the private receipt's
`items`). If that is the intended meaning, the ADR text recording it is the
evidence.

### 4. Condition B's "not suppressible / will not decay into ignore" warning is a bare `console.warn` with no CI annotation

**Claim.** SEAM-B5 requires the deploy warning to name the stale entry and "not
[be] suppressible, so 'warn' does not decay into 'ignore'." Condition A emits a
GitHub annotation (`::error`, `check-publish-allowlist.mjs:164`); condition B in
`deploy` mode emits only `console.warn` (`check-publish-allowlist.mjs:146-155`).
In GitHub Actions a `console.warn` is plain log text — it is not surfaced in the
annotations panel, not in the job summary, not counted, and not retained anywhere
a human will see it. The anti-decay property the seam asserts is therefore not
delivered by the implementation.

**Severity: Medium.** A stale non-hub entry publishes nothing (conditions A and B
are an AND), so safety is intact; the harm is a permanently degraded deploy
signal that the seam explicitly tried to prevent.

**Blocks the merge? No.**

**Evidence that would settle it.** Run `check-publish-allowlist.mjs --mode deploy`
against a tree with a present source and a renamed-away slug, once on the current
code and once emitting `::warning`; show that the first produces no annotation
and the second does. A test asserting `::warning` is printed in deploy mode would
settle it durably.

### 5. The historical-URL control for `anthropic-fellow` is Firebase-only; the Pages mirror gets a 404 (not the SEAM-B9 "410 or sign-in") and no live-probe transcript is recorded

**Claim.** SEAM-B9 target 4 requires every historical URL of the fellowship
variant to be "410 or sign-in, never 200", and the exit criteria require live
probes on **every** origin, explicitly including the GitHub Pages mirror. The
only redirect mechanism added is in `firebase.json:41-55`, which governs Firebase
Hosting alone. On Pages the only control is that the route is no longer emitted,
which yields a **404** — not 410 and not sign-in. The handoff records the Pages
residual in prose (risk paragraph, ADR-0016 Risks), which the exit criteria
permit, but 404 is a different status than SEAM-B9 names and no post-redeploy
live-probe evidence for the Pages mirror is recorded. The old Pages deployment
continues to serve 200 until a `main` rebuild replaces it.

**Severity: Medium for design; High for the wave's purpose**, because the Pages
mirror is the exact origin that carried the live leak (STATE finding A-6) and the
seam singles it out.

**Blocks the merge? No**, because SEAM-B9's own clause permits recording the
residual when Pages cannot be fixed in-wave. It blocks only if the disposition is
to *claim* fulfillment of target 4 — which must not happen.

**Evidence that would settle it.** After merge to `main` and a Pages deploy,
probe `https://djjay0131.github.io/website/cv/anthropic-fellow/` and
`https://djjay0131.github.io/website/pdfs/anthropic-fellow.pdf` signed-out and
confirm status ≠ 200; confirm the Pages job always runs on `main` and that no
older Pages deployment remains reachable; and confirm the Firebase `/signin/`
redirects resolve (302 is explicitly within "sign-in"). Either that transcript, or
an explicit ADR/exit note that Pages serves 404-by-omission and that this is the
accepted deviation from "410 or sign-in".

## What I did not object to and why

- **`effectiveVisibility()` as the single computation (SEAM-B2).** I tried to
  find a consumer that re-derives visibility. `src/pages/[section]/[source]/[slug].astro`
  now reads `effective_visibility`; `public-build.mjs`, `stage-public-assets.mjs`,
  `frame-content.mjs` and the leak check all call `effectiveVisibility()`.
  `cv/index.astro` and `resumes/index.astro` call `collectPublicItems()`, which
  re-reads the allowlist and recomputes — but through the same function, so it is
  a second *consumption* path, not a second *computation*. Acceptable.
- **Condition B being context-dependent (warn on deploy).** The reasoning in the
  SEAM-B5 amendment (a satellite rename must not kill deploy or the
  `needs: build-firebase` withdrawal path) is sound; I object only to how the
  warning is surfaced (objection 4), not to the policy.
- **Private build rendering public items and the P5 receipt split.** The handoff
  keeps P5 meaningful by counting `privateItemCount` (effectively private)
  separately from `renderedItemCount` (`private-build.mjs:133-137`,
  `sync-private.mjs:148-157`). I checked: a build that rendered only public items
  still trips P5. My objection is to the unstated *semantics* (objection 3), not
  to P5 being weakened.
- **The cv-release fingerprint fix (`e360ce4`).** Hashing the asset list instead
  of naming assets is the right shape; it removes the `build-info.json` leak
  without weakening change detection. Not a design risk.
- **No schema change (SEAM-B7).** Keeping `visibility`'s shape while moving the
  decision is the lower-blast-radius choice; I agree.
- **The `cv-data` render-time filter (SEAM-B3).** Both the variant list and the
  routes are filtered from the allowlisted `cv` PDF items, so the private
  variant's definition being present in the shared payload is not itself a
  public leak. This rests on the leak check catching residue, which is the
  Skeptic Verifier's marker demonstration — a verification dependency, not a
  design flaw I can settle here.

## Related docs

- `llm/sprints/2026-09-hub/contracts/dissenter-wave-0b.md`
- `llm/sprints/2026-09-hub/contracts/private-by-default-seams.md` (SEAM-B1…B9)
- `llm/governance/adr/0016-private-by-default-publish-allowlist.md`
- `llm/sprints/2026-09-hub/handoffs/site-wave-0b.md` (assumptions 1 and 3; risks)
- `llm/sprints/2026-09-hub/contracts/site-wave-0b.md` (requirements 1 and 6)
- `site/scripts/check-publish-allowlist.mjs`, `site/scripts/check-no-private-in-public.mjs`,
  `site/src/lib/hub-content.mjs`, `site/scripts/route-inventory.mjs`, `firebase.json`
