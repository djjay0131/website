# Wave 0b seams — private by default

Status: Active
Issued: 2026-09-18
Owner: Chief Architect (Lead Architect)
Issue: to be opened as `hub-008`
Branch: `feat/private-by-default`

## Purpose

Wave 0b inverts the default that decides what the world can see. It runs on its own branch,
**before Phase 4**, because share links and the two new satellites both depend on which items
are private — and getting that order wrong would mean minting shares against a visibility
model that is about to change underneath them.

These seams fix the interfaces before any stream starts. A seam is binding: a specialist who
believes a seam is wrong **reports it and stops at that seam**. It never renegotiates one
unilaterally and never edits a file outside its own scope to make one fit.

## The decision this implements

Owner decision **D8**, 2026-09-18:

> An item is public only if **both** its satellite manifest says `visibility: public` **and**
> the hub's committed publish allowlist names its `(source, slug)`. Everything else renders
> only in the private build, behind sign-in.

The manifest's `visibility` becomes a **request**. The hub is the **authority**. This is what
design doc §12.3 — "satellites are untrusted" — always implied but never enforced: until now
a satellite could make its own content public by asserting it, which is exactly the trust the
non-negotiable says we do not extend.

**Recorded as an ADR amending design doc §4 and §5, and ADR-0011's `srcDir` model as needed.**

## The day-one allowlist, exactly

| Entry | Why |
|---|---|
| `cv/academic` | public CV variant |
| `cv/research-professional` | public CV variant |
| `cv/sde-long` | public CV variant |
| `cv/cv-data` | the data item the public CV pages render from — **see SEAM-B3** |
| `kgis/kgis-docs` | Phase 5 satellite #3's docs |
| `hub/<path>` for the `soa-agentic-se` research digests | first-party pages get entries too |

- **`cv/anthropic-fellow` is private.** It must not appear on `/resumes/`, `/cv/`, in
  `/pdfs/`, in the sitemap, search index, RSS, OG images, or any `dist-public` byte.
- **`construction-ai-proposal` items start private** and stay so until the owner adds them.

---

## SEAM-B1 — Where the allowlist lives, and what it is

- One file under `site/`: **`site/publish-allowlist.json`**.
- It is **committed**, and it is the **only** way to make something public.
- Its edits are an **L0-shaped** change (owner decision D8), so it can be reviewed as
  bookkeeping rather than as semantic work — which is the point: making something public
  should be a small, visible, reviewable diff, not a side effect of a content change.
- Entry shape: a `(source, slug)` pair. First-party hub pages use `source: "hub"` and the
  page path as the slug, so the same mechanism covers both.

**A satellite can never edit it.** It lives in the hub, and no satellite holds a GitHub
credential for the hub (ADR-0007 decision 2). That is the whole enforcement story.

## SEAM-B2 — Effective visibility is computed in exactly one place

`site/src/lib/hub-content.mjs` computes **effective visibility** and every consumer reads it
from there. No consumer may re-derive it, and no consumer may read `item.visibility` directly.

```
effective_visibility(item) =
    public   if item.visibility == "public" AND allowlist contains (source, slug)
    private  otherwise
```

Consumers, all of which must use it:

| Consumer | Consequence of re-deriving |
|---|---|
| every page and index | a private item rendered publicly |
| the sitemap | a private slug published |
| the redirect map | a private path advertised |
| the leak check | the guard checks the wrong set |
| RSS, search index, OG images (Wave 3) | the four outputs ADR-0005 names |

**Why one place.** Two sources of truth about one property is the shape this repository has
diagnosed in itself repeatedly, and ADR-0011 already chose structure over convention for
exactly this reason: "a filter is a convention… the failure mode of forgetting is a private
title on a public page." The allowlist must not reintroduce, at a higher level, the filter
that ADR-0011 removed at a lower one.

## SEAM-B3 — The `cv-data` caveat, stated in full

`cv/cv-data` is **one data item** carrying all four variant definitions and the shared content
pool. Allowlisting it therefore does **not** by itself keep the fellowship variant out of the
public build.

Required outcome:

- the public build renders the **three** public variants from it;
- the public build emits **none** of the `anthropic-fellow` variant's YAML, its label, its
  slug, or any content included only by it, into `dist-public`.

Two acceptable implementations; **the `site` stream decides and records why**:

1. the hub filters the payload at render time, and the leak check proves the residue absent; or
2. the `cv` satellite splits the payload.

**The Skeptic Verifier plants a marker string inside the fellowship variant and shows the
leak check catch it.** A leak check that passes here without that demonstration proves
nothing — this is a content-only leak with no matching path, which is precisely the class the
path-only check would miss and the class ADR-0005 settled against the brief on reasoning
alone before it ever had evidence.

Acceptance, live: `/resumes/` and `/cv/` list **three** variants signed out and **four**
signed in.

## SEAM-B4 — What each build renders

- **Private build** renders **every section**, not only `/phd/`, with the members' navigation.
  A member signed in sees everything, public and private alike, in one place.
- **Public build** renders **only** allowlisted items, and **never names a non-allowlisted
  one** — not in a link, a list, a count, a title, an OG tag or a sitemap entry.

This extends ADR-0011's two-`srcDir` model rather than replacing it. The private build's
`srcDir` now covers all sections; the router isolation stays exactly as ADR-0011 specifies,
and its module-graph assertion still binds.

## SEAM-B5 — The build-time allowlist guard

**Condition A — always a hard build failure.** An allowlist entry names an item whose
**manifest says `private`**. The allowlist cannot override a satellite's own privacy. This is
the condition that keeps the whole model honest: the hub is the authority on making things
public, not on overriding a satellite that has asked for privacy.

**Condition B — a stale entry naming a `(source, slug)` that does not exist.**

> **Amended 2026-09-18, on the Dissenter's objection 3, before implementation.** As first
> written this was also a hard failure "because a stale allowlist must not silently allow
> nothing." That reasoning does not survive contact with the rest of the system.
>
> **It hands an untrusted satellite a kill switch on the hub's deploy.** A `cv` slug rename is
> ordinary content editing, and §12.3 says satellites are untrusted. Under the original wording
> that rename fails the hub build — and `private-sync` declares `needs: build-firebase`
> (`build.yml:1140`, verified), so it halts **withdrawal** too. A withdrawn private item would
> go on being served at its old path while the system reported a build failure somewhere else
> entirely. That is precisely the privacy failure ADR-0010 decision 5 exists to prevent,
> reached by a route nobody intended.
>
> **And it was never load-bearing for safety.** Conditions A and B are an AND, so a stale entry
> already publishes nothing — it names an item that does not exist. The original wording bought
> tidiness and paid for it with availability of the withdrawal path.

So condition B is **context-dependent**:

| Where | Behaviour |
|---|---|
| The hub's own pull requests | **hard failure** — a stale entry is the hub's own bookkeeping error and should be fixed before merge |
| The deploy build on `main` | **warn, loudly, and continue** — never let a satellite's content edit stop the hub deploying or withdrawing |

The warning must name the stale entry and must not be suppressible, so "warn" does not decay
into "ignore".

**Open, and to be settled when this is built:** which job evaluates the allowlist. The
Dissenter flagged that objection 3's severity depends on it and correctly declined to assume,
since the tree does not exist yet. If the check runs inside `build-firebase`, the coupling
above is exact; if it runs earlier, the blast radius differs. Name the job in the
implementation and re-check this table against it.

## SEAM-B6 — The leak check's private set widens

The leak check's private-slug set becomes **every non-allowlisted item**, first-party hub
pages included — not only the items whose manifest says `private`.

That is a strictly larger set than today's, and it is the set that matches the new rule.

## SEAM-B7 — Documentation, and no schema change

The `contract` stream updates `docs/satellites.md` and `contract/README.md` to state that
`visibility: public` is a **request** and the hub allowlist is the **decision**.

**No schema change.** `visibility` keeps its meaning and its values; what changes is who
decides. Changing the schema would require every satellite to move in step, for no gain.

## SEAM-B8 — Who owns which file

| Path | Owner |
|---|---|
| `site/**` including `site/publish-allowlist.json` | `site` |
| `contract/**`, `docs/satellites.md` | `contract` |
| `infra/**`, `.github/workflows/build.yml`, `ci.yml` | `infra` |
| `gate/**`, `.github/workflows/gate.yml` | `gate` |
| `llm/**` | Lead Architect only |

## SEAM-B9 — Red Team targets for this wave

Named here so they are designed against, not discovered afterwards:

1. **Allowlist bypass** through slug casing, Unicode normalisation, added path segments, or a
   manifest that renames an item.
2. **Slug collision** — a satellite publishing a second item with a public item's slug.
3. **The `cv-data` residue** — the fellowship variant's content reaching `dist-public` through
   the shared payload.
4. **`/pdfs/anthropic-fellow.pdf`** and **every historical URL that variant ever had on GitHub
   Pages**. These go into the redirect map as **410 or sign-in, never 200**. A URL that
   previously served that PDF publicly and now returns 200 with anything at all is a finding.

## Exit criteria

> **Amended 2026-09-18, on the Live Prober's and Red Team's findings, before implementation.**
> As first written, these criteria were satisfiable by a fix that leaves the fellowship CV
> publicly readable. Both agents independently found it reachable on **five origins**, and the
> Lead Architect verified this directly:
>
> | Origin | `/cv/anthropic-fellow/` | `/pdfs/anthropic-fellow.pdf` |
> |---|---|---|
> | `jason.cusati.us` | 200 | 200 |
> | `cusati-hub.web.app` | 200 | — |
> | `cusati-hub.firebaseapp.com` | 200 | — |
> | `djjay0131.github.io/website` | **200** | **200** |
>
> The **GitHub Pages mirror is the one that matters**: it is an independent, `main`-built
> deployment that the allowlist does not govern at all, and it carries its own sitemap, a
> **self-referential canonical** pointing at itself rather than at the hub, **no `noindex`**,
> and `robots.txt: Allow: /`. Its `og:description` exposes a CV summary to link unfurlers.
>
> The allowlist governs the Firebase `dist-public` build. Pages is not retired until Phase 6.
> So, in the Live Prober's words: **"a fix scoped to `jason.cusati.us` will look complete and
> not be."**

Live probes show:

- the three public CVs served, and the fellowship CV **absent signed-out** and **present
  signed-in**, on **every origin that serves this site** — `jason.cusati.us`,
  `cusati-hub.web.app`, `cusati-hub.firebaseapp.com`, **and the GitHub Pages mirror**. An
  exit check that probes only the canonical domain does not satisfy this criterion;
- the fellowship CV absent from **every** sitemap, including the Pages sitemap, and from any
  search index, RSS feed and OG image;
- `kgis/kgis-docs` and the research digests public;
- the §7 security gate green **with its new lines** — the private-by-default checks in §7
  item 2, not merely the pre-existing ones.

**If Pages cannot be fixed within this wave**, say so explicitly and record what remains
reachable there, rather than declaring the wave complete against the canonical domain alone.
Phase 6 retires Pages and replaces it with forwarding stubs; until then the honest options are
to exclude the item from the Pages build, or to accept and record the residual. Silence is not
one of them.

## Cross-references

- `llm/sprints/2026-09-hub/STATE.md` §Owner decisions 2026-09-18 — D8 and the exact allowlist
- `llm/governance/adr/0005-two-output-build-with-leak-check.md` — the content-vs-path
  matching rule this widens
- `llm/governance/adr/0011-two-srcdirs-not-a-visibility-filter.md` — the structure this
  extends, and its warning about conventions that must be remembered
- `llm/specs/2026-09-10-research-hub-design.md` §4, §5, §12.1, §12.3
- `llm/sprints/2026-09-hub/contracts/phase-3-seams.md` — the precedent for this document's shape
