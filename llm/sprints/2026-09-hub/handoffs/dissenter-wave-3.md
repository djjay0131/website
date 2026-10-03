# Handoff — `Dissenter`, Wave 3 (Phase 4 sharing)

Agent: Dissenter (independent; authored nothing in this wave)
Contract: `llm/sprints/2026-09-hub/contracts/dissenter-wave-3.md`
Seams: `llm/sprints/2026-09-hub/contracts/phase-4-seams.md`
Design authority: `llm/specs/2026-09-10-research-hub-design.md` §6 responsibility 4, §11 Phase 4
Repo: `/home/djjay/code/website` · branch `feat/sharing` · HEAD reviewed: `c605c72`
Issue: `hub-004`

## Summary

I read the contract, the seams, the gate handoffs (`gate-wave-3.md`,
`gate-wave-3-section.md`), the site and infra handoffs, the gate contract and its
2026-10-03 rulings, the design doc §6/§7/§11/§12 and the §8 amendment lesson,
`gate/app/{shares,main,serve,config}.py`, `gate/tests/{conftest,test_shares}.py`,
the three site files named in the brief, `site/src/lib/frame-content.mjs`,
`site/src-private/pages/[...itemPath].astro`, the committed
`site/dist-private/` tree, and `infra/{firestore.tf,gate.tf}`. I ran read-only
commands only; I wrote no file but this one and modified no tracked file.

**I raise eight objections.** Three would block: **D1**, the share serves the
members' *frame*, not the item — for a real `html`/`bundle` item the payload and
stylesheet live under `_payload/` and `_astro/`, outside the item prefix, and the
frame links to them through `/p/`, so a signed-out share holder gets a frame
whose document never loads and whose nav lists every private item. **D2**, the
design authority §6 was never amended (the branch does not touch the spec), which
is the exact "a seam/ADR claims to amend authority and nothing checks it" failure
the doc itself documents at §8. **D3**, the `datastore.user` grant is project-wide
and the deny-all rules do not constrain the Admin SDK, so a compromised gate can
write `members/` (a persistent `role: owner` backdoor), not just `shares/` — the
record calls the class plus rules a "bound", and they are not a bound against the
gate's own process.

The other five are a real capability gap in revoke (D4), a log-discipline
regression (D5), an unmeasured cost model (D6), and two angles I examined and
dismissed as correctness concerns (D7 display-id prefix, D8 share-unit), with the
`mint blind, 404 on serve` oracle dismissed outright (D9) and `private, no-store`
upheld (D10).

Objection table. "Block?" means block the Wave 3 exit/merge.

| # | Objection (claim) | Confidence | Block? |
|---|---|---|---|
| **D1** | A share serves the members' frame; the item's payload/assets are outside the token prefix and referenced via `/p/`, so the document does not load for a share holder and the frame leaks every private item's title/path | High | **Yes** |
| **D2** | Design §6 resp. 4 still reads `{slug}`/`{slug, exp, created_by, revoked}`; the seam's `(section, source, slug)` "amendment" was never made in the authority | High | **Yes (record)** |
| **D3** | Project-wide `datastore.user` + deny-all rules + the `FirestoreShareStore` class do not bound a compromised gate; it can write `members/` and persist an owner | High | **Yes (record/risk)** |
| **D4** | `GET /share` lists rows that the API cannot revoke without the credential; revoke depends on the owner having saved the link | High | Borderline (exit claim) |
| **D5** | `POST /share` logs the full `<section>/<source>/<slug>` unconditionally, against the gate's own `GATE_LOG_OBJECT_PATHS` discipline | High | No (fix before merge) |
| **D6** | Per-sub-asset Firestore reads + `private, no-store` + no rate limit + no cleanup; the seam's "sound cost model" is asserted, not measured | Medium | No (require measurement) |
| **D7** | The 12-char display id is a token prefix: 72 bits of the 256-bit secret, bought for no security and at the cost of D4 | High on arithmetic | No |
| **D8** | "One item" is the design's unit and defensible, but for framed items item ≠ document; the unit is only correct once D1 is fixed | Medium | No |

---

## Objections

### D1 — The share serves the members' frame, not the item; the document does not load and the frame leaks the whole private catalogue · BLOCK

**Claim.** The seam fixes a token's reach to the object prefix
`<section>/<source>/<slug>/` (`main.py:916-935`; `_share_item_prefix`). In the real
private build that prefix contains **only the generated frame page**
`<section>/<source>/<slug>/index.html`. The item's actual bytes live under
`_payload/<source>/…`, and the shared stylesheet under `_astro/…` — both siblings
of the item prefix, neither reachable by `/s/{token}/…`. The frame references
them with **absolute `/p/` URLs**, so a signed-out share holder's browser
requests `/p/_payload/…` and `/p/_astro/…`, which the gate answers with the
sign-in-required 404. The result is a share link that (a) never renders the
document it names, and (b) hands the holder the frame's members' navigation — the
title and `/p/` path of **every** private item, plus a sign-out control and a
`Members' area` link.

The seam's own amendment is the tell: it justified adding `section` by citing
`frame-content.mjs: routeFor` (`<section>/<source>/<slug>/`) — the *frame* route —
but a framed item is frame **plus** payload **plus** shared assets, and the
payload route is `payloadUrlFor` = `<base>_payload/<source>/<path>`. The gate's
test fixture invents a tree where the item prefix holds `private.css`
(`conftest.py:54`, `test_shares.py:145`), a shape the private build never emits.

**Evidence (examined).**

- `site/src/lib/frame-content.mjs:79-86` — `routeFor` = `<section>/<source>/<slug>/`;
  `payloadUrlFor` = `_payload/<source>/<path>`.
- `site/src-private/pages/[...itemPath].astro:46-53` — the frame embeds
  `<iframe src={payload}>` and `<a href={payload}>`, both `payloadUrlFor`, i.e.
  `/p/_payload/…` under the private base.
- The committed build, `site/dist-private/phd/phd-milestones/committee-dossier/index.html`:
  `<link rel="stylesheet" href="/p/_astro/private-content.BKq7vh8B.css">` and
  `<iframe … src="/p/_payload/phd-milestones/site/committee.html">`; its
  `<nav class="band-nav">` lists all nine items' titles and `/p/…` hrefs.
- `gate/app/main.py:625-639` — serve builds `prefix = <section>/<source>/<slug>`
  and calls `safe_object_path(path, prefix)`; `_payload/**` and `_astro/**` are
  outside it by construction.

**Settling test.** `npm run build:private`, then against a running gate: sign in
as the owner, mint a 14-day share for `("phd","phd-milestones","committee-dossier")`,
then in a signed-out browser open `/s/{token}/` and assert (i) the payload request
(`/s/{token}/_payload/…` or a rewritten equivalent) returns 200 and renders the
document, and (ii) the served HTML contains no `/p/`-absolute asset or nav link.
**Expected if the objection holds:** the iframe and stylesheet requests 404 (or
land on the sign-in page), the body does not render, and the returned HTML still
contains the full private nav. The current gate tests cannot catch this because
their fixture is synthetic: `test_the_minted_share_serves_its_item_without_a_session`
asserts on `<h1>` bytes under the item prefix, a file the build does not put there.

**Why it blocks.** Design §6 resp. 4 says the route "serves that one slug's
files" and Phase 4 ships "a 14-day link to one document" (§11). A link that serves
the wrapper instead of the document, and additionally discloses the existence and
titles of every other private item to an unauthenticated holder, is wrong and
incomplete, not merely buggy. The gate and site handoffs both assert the
`(section, source, slug)` prefix "match[es] the real tree"
(`gate-wave-3-section.md:14-26`); the real tree says otherwise.

---

### D2 — The design authority §6 was never amended; the seam's schema change exists only in the seam · BLOCK (record/governance)

**Claim.** SEAM-S1 says it "amends" the store to `(section, source, slug)` and
records an "ADR candidate, not a schema change." But the design authority still
reads, verbatim:

> 4. **Share links.** `POST /share {slug, expires_in_days}` (owner only) mints a
>    random token, stores `{slug, exp, created_by, revoked}` in Firestore
>    `shares/{token}`. — `llm/specs/2026-09-10-research-hub-design.md:217-220`

The gate contract, the store, the routes and the site all now carry
`(section, source, slug)`; the document that outranks them is unchanged, and the
branch does not touch the design doc at all (`git diff main...HEAD -- …design.md`
is empty).

**Why it matters.** The design doc's own §8 amendment block documents this exact
failure twice ("ADRs 1 and 4 still read X days after the decision made it
unimplementable"; "an ADR that says it amends design authority has not amended
anything until the edit is made, and nothing mechanically checks the difference").
Wave 3 repeats it one field larger: a seam claims to change the authority, and the
authority still disagrees. A future reader implementing against §6 — or a
satellite author reading it — gets the old shape.

**Evidence that settles it.** `grep -n "section, source\|source, slug" design.md`
returns nothing at §6; `git diff main...HEAD --stat -- llm/specs/…` is empty;
compare §8's dated amendment note (`design.md:258-276`), which is the house
pattern for exactly this. **Expected if the objection holds:** no amendment note,
no `section` in §6. The remedy is a dated amendment to §6 (or an ADR that is then
reflected in §6), not a code change.

---

### D3 — Project-wide `datastore.user` plus deny-all rules do not bound a compromised gate · BLOCK (record/risk)

**Claim.** The records present the gate's Firestore reach as bounded by
"`FirestoreShareStore` + the deny-all released rules (SEAM-S5)"
(`shares.py:114-120`; `infra-wave-3.md:11-20`, risks). Neither constrains the
threat named: the deny-all rules only bind **client** SDKs —
`infra/firestore.tf:75-77` says so outright ("the gate reaches Firestore through
the Admin SDK … and BYPASSES security rules entirely. Rules therefore do not
constrain the gate at all") — and `FirestoreShareStore` is not a boundary against
code executing in the gate process. With `roles/datastore.user` the runtime SA
holds create/get/update/delete/list on **every** document in the project. A
compromised gate image can therefore: insert or overwrite `members/{email}` with
`role: "owner"` (a persistent backdoor that survives redeploy, because it is data,
not code); delete the allowlist (denial of the whole private area); enumerate
every `shares/{token}` (token = document id) and thus every shared item; and
delete shares. The `infra-wave-3.md` risk section admits the grant "also reaches
`members/`" but calls the control "code-level" — which is precisely not a control
when the threat is code execution.

**Evidence that settles it.** `infra/gate.tf` (`roles/datastore.user`), and
`infra/firestore.tf:72-128` (rules bypassed by Admin SDK); `shares.py:114-120`
(class docstring asserting collection discipline); `infra-wave-3.md:118-128`.
**Settling experiment:** a test/one-off that constructs the production
`FirestoreShareStore`'s underlying `firestore.Client` with the real SA and writes
`members/attacker@example.invalid {role: owner}`, then calls `is_owner`. **Expected
if the objection holds:** the write succeeds and the injected principal is an
owner — proving the "bound" is a naming convention, not an enforcement.

**Why it blocks the record.** The contract asked infra to "record the choice"
(SEAM-S5), and it did; but the record asserts a bound that does not exist. Either
the exit record states plainly "a compromised gate owns the Firestore database and
the allowlist," with the detection/response this implies, or a narrower mechanism
(Firestore security rules cannot scope the Admin SDK; a separate SA per
collection is not expressible in Firestore IAM) is required. It also means D3 is
the security half of D6's cost concern: the same project-wide read is what makes
`list_active` and per-asset reads matter.

---

### D4 — A share list that cannot revoke what it lists · Borderline (blocks the "revoke" exit claim)

**Claim.** `GET /share` never returns the token; it returns `id = token[:12]`
(`main.py:575-587`) plus metadata. `DELETE /share/{token}` needs the **full**
token (`main.py:592-609`), and there is no revoke-by-`id` route. The island
therefore keeps the token only in `sessionStorage`, keyed by that prefix
(`shares.mjs:31,87-95,163-178`), and can offer `Revoke` only for rows whose token
this tab, this session, still holds; every other active row renders "paste link to
revoke" (`SharesIsland.tsx:159-165`). So an owner who lists a live share minted on
another device, or after the browser session ended, **cannot revoke it without
possessing the link** — even though `DELETE` already authorises by the owner's
session, not by the secret.

**Why it matters.** Design §7 calls a shared link "revocable" and §11 Phase 4
ships "Share mint/list/revoke." The list is the only owner surface, and it cannot
revoke what it enumerates. The gate's own ruling 2 anticipated this and chose
token-less listing "as a usability limit, not a security one" — but the gap is a
*capability* gap: an owner who did not keep the link cannot withdraw access. The
fix is safe and small: since revoke is owner-authorised, return an opaque random
row id (or the full token — the response is owner-only and `private, no-store`)
and add `DELETE /share/{id}`. The current "solution" makes the usability of the
one promised destructive action depend on retaining the credential.

**Evidence that settles it (already available).** `main.py:575-587` (no token) vs
`main.py:592-609` (needs token); `shares.mjs:18-25` (comments conceding a row from
a previous session "can only be revoked by pasting"); `SharesIsland.tsx:196-205`
the paste fallback; `gate-wave-3.md` open question 2 and `gate-wave-3-section.md`
ruling 2. **Settling test:** mint in browser A; in a clean browser B call
`GET /share` and try to revoke the returned row using only the listed fields.
**Expected if the objection holds:** no endpoint accepts the listed id; the row
requires the pasted link. (Ruling 2 has already accepted this; my objection is
that the ruling's "not a security one" framing understates a lost capability and
that a revoke-by-id is cheap enough that "fix later" is the wrong disposition for
the destructor.)

---

### D5 — The mint log line leaks the private item triple unconditionally · Fix before merge

**Claim.** `mint_share` logs `item=%s/%s/%s` on every successful mint
(`main.py:548-554`) with no `GATE_LOG_OBJECT_PATHS` guard, while the gate's stated
discipline keeps private object paths out of Cloud Logging unless deliberately
enabled (`_log_path`, `main.py:234-242`; `config.py:146-148`). The mint line and
the serve line therefore disagree about the same class of value. The follow-up
handoff spotted this and left it ("flagged for completeness" /
open question 2, `gate-wave-3-section.md:111-123`), so it is a known, unrepaired
inconsistency rather than an unexamined one.

**Why it matters.** Cloud Logging is readable by anyone with project-level log
access, which the code itself says is "a wider audience than the allowlist." A
mint writes the full private slug into that audience on the happy path. The
`item=` field is not a served path but it *is* private material.

**Evidence that settles it.** `main.py:548-554` vs `main.py:234-242`; no
`_log_path` call on the mint line. **Settling experiment:** run the gate with
`GATE_LOG_OBJECT_PATHS` unset, mint a share, read stdout. **Expected if the
objection holds:** `event=allow scope=share action=mint item=<section>/<source>/<slug>`
appears. The fix is to route it through `_log_path`/the same flag, or drop the
field; it does not block the feature, but the exit record should not claim the
discipline holds.

---

### D6 — The per-sub-asset cost model is asserted, not measured, and has no ceiling · Require measurement

**Claim.** Every `/s/{token}/{path}` request performs an uncached Firestore
document read (`deps.shares.get(token)`, `main.py:617`) before a GCS `get_blob`
(`main.py:639`). Every `/s/**` and `/share/**` response is `private, no-store`
(`main.py:101,285-293`), so neither browser nor CDN reuses anything; there is no
per-token rate limit; and the endpoint is unauthenticated. A shared `html`/`bundle`
item is a page of many sub-assets, so reads scale with assets × opens. Separately,
`list_active` queries all non-revoked documents and filters expiry in Python
(`shares.py:157-170`); nothing ever deletes expired shares, so the list read grows
without bound. The seam/contract claim the cost model is sound; no measurement,
load test, or budget figure appears in any handoff.

**Why it matters.** The design fixes a $0–3/month budget (§8) and
`min-instances=0`. The failure mode is a token holder (or a leaked link) looping
`/s/{token}/<asset>` to drive Firestore reads and GCS egress with no auth and no
throttle, and the owner's Shares page getting slower/expensive as expired rows
accumulate. Note this concern is *masked* today by D1: the assets 404 before the
prefix check, so the worst case is hidden until D1 is fixed.

**Evidence that settles it.** `main.py:285-293,617,639`; `shares.py:157-170`;
middleware sets `no-store`. **Settling experiment:** count `store.fetch` and share
`get` calls for one page load with N sub-assets, then a short loop against a
running gate measuring Firestore operations and CPU. **Expected if the objection
holds:** one Firestore read per asset request, linear and unbounded per token, and
`list_active` reads every expired-but-unrevoked share. Not a blocker by itself,
but the exit record should not assert a sound cost model without the number.

---

### D7 — The display id is a token prefix · Dismissed as a security concern, folded into D4

**Claim.** The row id is `token[:12]` (`main.py:132,944-946`; `shares.mjs:37-44`).
`token_urlsafe(32)` is 43 base64url chars ≈ 256 bits; 12 chars ≈ 72 bits. The
prefix narrows a brute-force from 2²⁵⁶ to 2¹⁸⁴ (still infeasible), is shown only
on owner-only `private, no-store` responses, and introduces a 2⁻⁷² chance that two
retained tokens alias in `sessionStorage` (`shares.mjs` keys by the prefix). The
gate-side and site-side derivations must also stay in lockstep, or retained tokens
stop matching (`site-wave-3.md` risk 1).

**Verdict.** I examined and dismissed the "meaningfully narrows an attack" angle:
72 bits of a 256-bit secret changes no attacker's position. What the prefix *does*
buy is nothing security-relevant, while it is the mechanism that forces D4's
paste-to-revoke. The right move is an opaque random row id (or the full token on
an owner-only response), not a longer prefix.

---

### D8 — "One item" is the right unit only after D1; item ≠ document for framed items · Not blocking

**Claim.** Design §7 ("one slug") and §11 Phase 4 ("a 14-day link to one
document") make a single item the intended unit, so the seam's choice is
authorised; adding `source` to disambiguate two sources sharing a slug is
reasonable. But the design's word is *document*, and in the private build a
framed `html`/`bundle` item is a wrapper plus a payload whose assets are shared
across items (`_payload/<source>/…`, `_astro/…`). "One item" therefore has no
well-defined file set the gate can serve, which is the root cause of D1; sharing a
section or a source would at least make the file set closed. I do not recommend a
unit change now — the design says one document, and per-item is the smaller
change — but the unit is only correct once a share knows the item's *payload*
entry point, not just its frame route.

---

### D9 — "Mint blind, 404 on serve" · Examined and dismissed

Minting for any well-formed triple (`main.py:523-534`) returns 200 even when the
item does not exist; serve then 404s. Is there an oracle? Mint and list are
owner-only, so the only party who can probe existence is the owner, who may know
it anyway. On `/s/**`, unknown, expired and revoked all take the same Firestore
`get` then return the same 404; a valid active token additionally does a GCS read,
which is a theoretical timing signal that a token exists — but guessing a
256-bit token to observe it is not a threat. I dismissed the oracle angle. The
real residue is usability: the owner can mint a link that 404s with no warning,
and the list shows it as active. That is the seam's accepted trade, and it is
recorded; it is not a security finding.

### D10 — `private, no-store` on a handed-out link · Upheld

`private, no-store` (`main.py:101`) is the right call for a revocable bearer link:
a cached 200 keyed on `/s/{token}/…` would outlive `revoke` and keep serving after
withdrawal, and A7 requires that no `/s/**` response be `public`/`s-maxage`. The
tension with the cost model (no browser/CDN reuse) is real and is captured under
D6; it is not a correctness defect, and `no-referrer` (also set by the middleware)
protects the token-in-URL from leaking via `Referer`.

---

## Assumptions

- "Wave 3" is HEAD `c605c72` on `feat/sharing`; I reviewed that tree and the
  working tree was clean for tracked files when I finished (`git status --short`
  empty before I created this file).
- The private build's base is `/p/`, so `payloadUrlFor`/frame asset URLs are
  `/p/_payload/…` and `/p/_astro/…`, as the committed `dist-private` shows. The
  committed tree is fixture content but the Astro frame/staging code that produces
  its shape is the production code.
- `GATE_PRIVATE_PREFIX` is unset (no infra reference), so the object name is the
  output-relative path and the item prefix is exactly `<section>/<source>/<slug>`.
- I did not deploy, mint a live token, or touch cloud; D1's settling test and
  D3's settling experiment are described, not run, because they require the
  deployed owner step (SEAM-S7) or the real SA.
- Rulings 1–6 in `gate-wave-3.md` bind the wave; D2 and D4 argue that two of them
  (the schema amendment and the token-less list) rest on claims the evidence does
  not support, not that the rulings were unread.

## Recommendations

1. **D1 (block):** before declaring the exit, run the live acceptance (SEAM-S7)
   with a *real framed item*, not the synthetic fixture: build private, mint,
   open `/s/{token}/` signed-out, and require the document to render and the
   members' nav to be absent. If it does not, the item unit/prefix rule and the
   `/s/**` URL scheme must be redesigned (serve `_payload` under the token, or a
   share-mode frame with `/s/`-relative links).
2. **D2 (block, record):** add a dated amendment to design §6 resp. 4 recording
   `(section, source, slug)`, or write the ADR candidate and then reflect it —
   follow the §8 amendment pattern the doc itself mandates.
3. **D3 (block, record):** restate the SEAM-S5 risk as what it is — a compromised
   gate owns `members/` and `shares/` — and either record the accepted risk with a
   detection/response or narrow the mechanism. Do not call deny-all rules a bound
   on the gate.
4. **D4:** return an opaque row id from `POST /share`/`GET /share` and add
   `DELETE /share/{id}` (owner-authorised, so no secret is needed), making the
   list able to revoke what it lists; or explicitly record the lost capability in
   the exit.
5. **D5:** gate the mint `item=` field behind `GATE_LOG_OBJECT_PATHS` or drop it.
6. **D6:** measure Firestore reads per asset and per list, and state the number,
   before repeating the "sound cost model" claim.

## Alternatives considered

- **Blocking on D6 (cost).** Rejected: no measurement yet, and D1 currently
  prevents the many-asset path from being exercised. Requiring the number is
  proportionate.
- **Blocking on D1 as "a bug to be fixed."** Rejected as a *frame*: fixing how the
  frame links its payload is a site change; changing the token to know the
  payload prefix is a seam change. The objection is that the unit and prefix rule
  do not describe a real item, which is a design-level defect, not a one-line bug.
- **Treating D3 as accepted because `infra-wave-3.md` recorded it.** Rejected: the
  record states a mitigation ("code-level" + deny-all rules) that
  `infra/firestore.tf` itself says does not apply to the gate. A recorded
  non-control is worse than an open risk.
- **Blocking on D7 (prefix id).** Rejected: 72 bits of a 256-bit secret is not a
  meaningful narrowing; the fix belongs with D4.

## Risks

- **High:** a share link for a real `html`/`bundle` item does not deliver the item
  and discloses the private catalogue to an unauthenticated holder (D1); it will
  look like a working feature in tests because the fixture is synthetic.
- **High (record/security):** a compromised gate can persist `members/` owner
  documents; the current record understates this (D3).
- **Medium:** the owner may be unable to revoke a live share they did not keep
  the link to, defeating the promise of revocation (D4).
- **Medium:** private item triples reach Cloud Logging on every mint (D5).
- **Low/Medium:** Firestore read cost scales unboundedly per asset and per list,
  with no throttle and no cleanup (D6).
- **Record:** design authority §6 contradicts the shipped schema, repeating the
  exact stale-authority failure the doc documents (D2).

## Open questions

- Is the private build's framed item meant to be shareable at all, or should
  `format: html` items be excluded until a share-mode frame and a payload-aware
  prefix exist (D1)?
- Should `POST /share`/`GET /share` return an opaque row id and add
  `DELETE /share/{id}`, closing D4 without weakening the owner-only boundary?
- Does the owner accept "a compromised gate owns the Firestore database and the
  allowlist" as a recorded risk, or is a narrower mechanism required (D3)?
- Does `GATE_LOG_OBJECT_PATHS=false` apply to the mint `item=` field as it does to
  served paths (D5)?
- What Firestore operations/day is the share feature allowed to spend (D6)?

## Related docs

- `llm/sprints/2026-09-hub/contracts/dissenter-wave-3.md`
- `llm/sprints/2026-09-hub/contracts/phase-4-seams.md` (SEAM-S1..S8)
- `llm/sprints/2026-09-hub/contracts/gate-wave-3.md` (rulings 1–6)
- `llm/sprints/2026-09-hub/handoffs/{gate,gate-wave-3-section,site,infra}-wave-3.md`
- `llm/specs/2026-09-10-research-hub-design.md` §6 (`:189-226`), §7 (`:228-237`),
  §8 (`:258-301`), §11 (`:365-375`), §12
- `gate/app/{main,shares,serve,config}.py`, `gate/tests/{conftest,test_shares}.py`
- `site/src-private/lib/shares.mjs`, `site/src-private/components/SharesIsland.tsx`,
  `site/src-private/pages/shares.astro`
- `site/src/lib/frame-content.mjs`, `site/src-private/pages/[...itemPath].astro`,
  `site/dist-private/`
- `infra/firestore.tf`, `infra/gate.tf`, `firebase.json`

## ADR candidates

- **A share addresses an item's *payload*, not its frame route.** Either the token
  stores the payload entry (`_payload/<source>/<path>`) and `/s/**` serves that
  subtree, or the private build emits a share-mode frame whose assets are relative
  to `/s/{token}/`. Resolves D1 and gives "one item" a decidable file set.
- **The owner list must be able to revoke what it enumerates.** Return an opaque
  random row id and authorise `DELETE /share/{id}` by the owner session, so the
  destructive action never depends on retaining the bearer secret (D4).
- **`roles/datastore.user` on the gate means a compromised gate owns the
  allowlist.** Record the accepted risk with its detection/response, or define a
  narrower write path; deny-all rules do not constrain the Admin SDK (D3).
- **Design authority is amended when a seam changes its schema, in the same
  wave** — the §8 lesson, applied to §6 resp. 4 (D2).
