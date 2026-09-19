# Handoff — `Dissenter`, Wave 0

Stream: `Dissenter` (independent; authored nothing in this wave)
Contract: `llm/sprints/2026-09-hub/contracts/dissenter-wave-0.md`
Issue: #44 (hub-007)
Date: 2026-09-18

**Nothing was changed, committed, pushed, merged or applied. No `gh` call, no cloud call, no
`git` mutation. Branches were read with `git diff main...<branch>`; none was checked out.**

---

**Five objections: (1) the private-sync identity split does not move the boundary it is sold
as moving, because WIF admits on branch alone and the private tree is still built under
`hub-deploy`; (2) N-1's only real verification runs through the one sign-in route this repo
has independently recorded as possibly non-delivering, while the alternate route is
unconfigured — so the narrowing can ship unverifiable; (3) SEAM-B5 condition 1 hands an
untrusted satellite a kill switch on the hub's deploy, and that same deploy is what performs
withdrawal; (4) SEAM-10's split across two streams produced, inside this wave, exactly the
serialization failure lesson 3 predicts — the wave's highest-risk IAM change was not built;
(5) dev-staging in a second project is a consequence the owner should see stated, not a
neutral upgrade.**

Objections 1–4 I believe. Objection 5 I raise as a consequence rather than a refusal, because
it turns on a preference (review fidelity vs. surface) that is the owner's to weigh. A sixth
candidate (the allowlist's L0 classification) I examined and dismissed; §Examined and
dismissed says why, along with three others.

---

## Objection 1 — The private-sync identity split does not move the boundary it claims to move

### The claim I dispute

`contracts/infra-wave-0.md`, ITEM 3:

> The owner has chosen the stronger form: a dedicated identity, so the public deploy identity
> holds NO private-bucket access at all.

and `handoffs/site-wave-0.md` S10.4:

> **H1 — the public deploy identity has no private-bucket permission.**

### Why it may be wrong

H1 is true as stated and will be provable. My objection is that H1 is not the property anyone
cares about, and the property they care about is unchanged by this work.

**First: the new identity is reachable by exactly the same principals as the old one.**
`infra/wif.tf`'s provider maps five attributes and no more:

```
"attribute.repository" "attribute.repository_id" "attribute.repository_owner_id"
"attribute.ref"        "attribute.repository_id_ref"
```

The binding admits `principalSet://…/attribute.repository_id_ref/<repository_id>/refs/heads/main`,
and SEAM-10 S10.3 specifies the new one as **"identical in shape to `gate_deploy_wif_main` …
same pool, `refs/heads/main` only."** Nothing in the mapping names a workflow, a job, or an
environment. So *any* job, in *any* workflow, on `refs/heads/main`, in this repository, can
exchange its OIDC token for `private-sync` precisely as easily as for `hub-deploy`. Against
the threat "something running on `main` in this repo misbehaves" — which is the threat
ADR-0010 itself names as the live one ("the one place in this system where a build defect can
remove data") — the split is a no-op. It relabels which of two equally-reachable identities
holds the grant.

**Second, and this is the part I think has not been noticed: the bytes and the delete set are
still decided under `hub-deploy`.** `build.yml`'s `build-firebase` job authenticates as
`${{ vars.GCP_DEPLOY_SA }}` (line 668), runs `npm run build:private` to produce
`site/dist-private`, has `scripts/private-build.mjs` write `.hub-private-build.json` into it,
and uploads the whole thing as artifact `hub-private`. `private-sync` then does
`download-artifact: hub-private` and pushes it with `--apply`. So the private bucket's
contents, and every deletion, are wholly determined by a job that **keeps `hub-deploy`** after
the split. A compromised or defective `build-firebase` poisons the artifact and `private-sync`
faithfully executes it — including the prune.

The receipt does not close this. `private-build.mjs` writes the receipt in the same job that
produces the tree, so P2/P3/P4 attest that *a* private build ran, not that a trustworthy one
did. What actually bounds the damage today is P6, the 34% deletion ceiling in
`sync-private.mjs` — a ratio check in the application, not an IAM boundary.

So after this change: `hub-deploy` cannot call the Storage API against the private bucket, but
a `hub-deploy` job can still determine everything that bucket contains, and anything on `main`
can still mint `private-sync`. The threat it genuinely defends against is narrow and worth
naming honestly: **leakage of `hub-deploy`'s short-lived access token out of one of its four
other jobs** (`check`, `build`, `build-firebase`, `firebase-deploy`) — e.g. through a
compromised third-party action in a job that has no business touching private material. That
is a real threat and the split is a real mitigation for it. It is not "the stronger form" of
the two-principal invariant, and describing it that way risks the owner banking a boundary
that is not there.

### The evidence that would settle it

Two experiments, both cheap, neither destructive:

1. **Does the OIDC token carry a workflow identifier at all?** On `main`, run a throwaway job
   that fetches its own token from `$ACTIONS_ID_TOKEN_REQUEST_URL` and prints the decoded
   claim names only (never the token). Confirm whether `workflow_ref`, `job_workflow_ref` and
   `environment` are present. If they are, a per-workflow boundary is available and was simply
   not used; if they are not, my proposed alternative is impossible and the objection reduces
   to the second half.
2. **Is `private-sync` reachable from outside its job?** After the cutover, add a scratch step
   to a *different* job in `build.yml` on a branch, merged to `main` behind the existing
   review, that calls `google-github-actions/auth` with
   `service_account: ${{ vars.GCP_PRIVATE_SYNC_SA }}` and attempts one
   `storage.objects.list` against the private bucket. **If it returns 200, the split moved
   nothing against the in-repo threat** and H1 should be recorded with that scope attached.
   Remove the step afterwards.

Both are the kind of proof S10.5 already demands for H1 — "*Behavioural denial* — the only one
that proves a **denial** rather than an absence". I am asking for the same rigour pointed at
the other direction.

### The cheapest alternative

Keep the split — it is already specified and costs little — but buy the boundary it is being
credited with, in one of two ways:

- **Cheapest (one attribute, one binding).** Add `"attribute.workflow_ref" =
  "assertion.job_workflow_ref"` to the `website` provider's `attribute_mapping`, and bind
  `private_sync_wif_main` on `attribute.workflow_ref/<owner>/<repo>/.github/workflows/build.yml@refs/heads/main`
  instead of on `repository_id_ref`. The boundary becomes "this workflow file on main", not
  "anything on main". No new job, no new file, no new cost. Note it must be added to the
  provider used by `website`, and `wif.tf`'s own shared-pool warning then applies to the new
  attribute too — say so in the comment.
- **Stronger, still cheap.** Put the `private-sync` job in a GitHub Environment with a
  required reviewer, map `attribute.environment`, and bind on that. A destructive sync then
  needs a human click. One `environment:` key in `build.yml` plus one attribute. This also
  closes infra's own Risk 5 (`PRIVATE_SYNC_PLAN_ONLY` is a repository variable anyone who can
  set variables can flip silently).

And if neither is taken: **amend S10.4's H1 to say what it proves and what it does not** —
that `hub-deploy` holds no private-bucket grant, that anything on `main` can still assume
`private-sync`, and that the artifact path is unchanged. The record is the deliverable here as
much as the Terraform is.

---

## Objection 2 — The N-1 narrowing's only meaningful verification runs through a route this repo has already recorded as possibly broken

### The claim I dispute

`contracts/infra-wave-0.md`, ITEM 4:

> SIGN-IN MUST STILL WORK AFTERWARDS, and that is not something you can prove — you cannot
> apply. Write the precise live verification the Lead Architect runs after apply: an
> email-link sign-in as djjay@vt.edu, the session minted, and the matching gate log line.

and `STATE.md` §Wave 0 dispositions, RT-1:

> **Fix now — #49.** `infra` is implementing the custom role. Ships with post-apply sign-in
> verification **and** rollback.

### Why it may be wrong

The verification `infra` wrote is excellent — step (f) in particular, separating mint from
verify, catches exactly the partial break the contract worried about, and the
`createSession`-only error was caught before it shipped. My objection is not to its content.
It is that **the verification may not be executable at the moment it is needed**, and the
disposition "ships with post-apply sign-in verification" reads as though it will be.

Three facts already in this repository, which I do not think have been put side by side:

1. **Email-link is the only working sign-in route.** STATE §Sign-in, 2026-09-17: "Email-link
   sign-in works; the Google button does not… `defaultSupportedIdpConfigs` returns **zero
   providers**". S5 is FALSE, tracked as #31, console-only, owner hard stop.
2. **Email delivery is independently suspect.** STATE D6.5: "all three alert policies are
   enabled and deliver nothing, because the channel is unverified… **if that is the same
   delivery failure as the missing Firebase sign-in emails, then A1 is unverifiable by
   anyone**, not merely by an agent — email-link is the only working sign-in route." The
   owner reports Firebase sign-in emails never arriving.
3. **Nobody in this run holds a member credential.** STATE §Wave 0: the four NOT VERIFIABLE
   Checkpoint-4 criteria are all "a member signs in and sees X"; the run's identity
   `djjay0131@gmail.com` is deliberately not a member.

Put together: the narrowing's step (a) is "request a link as `djjay@vt.edu`". If that link
does not arrive — which is the *live hypothesis* D6.5 raises — then steps (b) through (f)
cannot run, and the operator is left with steps 1 and 2, which prove the role's shape and
prove nothing about whether sign-in works. infra's own Risk 2 says it plainly: "Between
`apply` and the live sign-in check, sign-in is unverified."

The failure mode is the one the contract itself named: sign-in breaks for the only two members
of the system, at a moment nobody is watching, and the first person to discover it is the
owner. The rollback is one command and is genuinely good — but a rollback is only reached by
someone who knows something broke.

There is also a forward-looking half, which is starting point 2 in my brief. Once #31
configures Google, that provider's tokens go through the same `verify_id_token` /
`create_session_cookie` call sites, so I do **not** predict a new permission. But infra's own
open question 1 is unresolved — whether `firebase_admin` fetches project/tenant config on
first auth use and needs `firebaseauth.configs.get` — and if it does, the fetch may be
cached per process, meaning a verification run on a warm revision can pass while a cold start
after the next deploy fails. That is a partial break the current procedure would not catch.

### The evidence that would settle it

Ordered cheapest first; the first two are the ones that matter:

1. **Does an email-link actually arrive?** Before applying N-1, request a sign-in link to
   `djjay@vt.edu` on the *current* (unnarrowed) system and confirm receipt. This is a one-shot
   test of the entire verification procedure's premise, it costs the owner a minute, and it
   settles D6.5's open connection at the same time. If no link arrives, the verification for
   #49 does not exist yet and the apply should wait.
2. **Is the `configs.get` question warm-cache-sensitive?** After apply and a successful
   sign-in, force a cold start (deploy a no-op revision, or wait out `min_instance_count = 0`)
   and repeat step (f) against the fresh instance. A `PERMISSION_DENIED` naming
   `firebaseauth.configs.get` on the cold path and not the warm one is the signature.
3. **After #31 lands**, repeat steps (c)–(f) via the Google button, as a distinct run. Do not
   let the email-link pass stand as evidence for both providers.

### The cheapest alternative

**Reorder, do not redesign.** The work `infra` produced is right; the sequencing is what I am
objecting to. Apply N-1 **after** at least one sign-in route is proven to deliver end to end,
not before. Concretely, the cheapest ordering:

1. Owner clicks the monitoring channel verification link (already a required §10 step, RT-9).
2. Owner confirms an email-link sign-in arrives and works on the **current** system. This is
   also the evidence that closes A1/A3/A5, so it is not extra work — it is work this wave
   already needs.
3. *Then* apply N-1, with the owner present, and run steps 1, 2, (a)–(f) in one sitting.

If that ordering is unacceptable and N-1 must go first, then the cheapest mitigation is a
**standing external check**: an uptime check or scheduled job that exercises `POST /session`
periodically, or — cheaper still and requiring nothing new — a log-based alert on
`PERMISSION_DENIED` from `hub-gate`, so that a broken mint is discovered by the system rather
than by a member. `infra/monitoring.tf` already carries log-based alert policies of exactly
this shape; this is one more, at $0.00. It converts "breaks at a moment nobody is watching"
into "breaks and says so", which is the actual gap.

---

## Objection 3 — SEAM-B5 condition 1 gives an untrusted satellite a kill switch on the hub's deploy, and that deploy is what performs withdrawal

### The claim I dispute

`contracts/private-by-default-seams.md`, SEAM-B5:

> The build **fails** when:
> 1. an allowlist entry names a `(source, slug)` that **does not exist** — a stale allowlist
>    must not silently allow nothing, because it would look like a working control while
>    protecting an item that is no longer there

### Why it may be wrong

The anti-rot instinct is right. The mechanism chosen to serve it hands a capability to exactly
the party design doc §12.3 says holds none: **"Satellites are untrusted."**

The day-one allowlist names four `cv/*` entries. `cv` is a separate repository, owned by the
same person but outside this run's stream roster (STATE RT-10 says so explicitly), whose
manifest slugs are entirely under `cv`'s control. Under SEAM-B5 condition 1, **a slug rename
in `cv` — an ordinary content edit, requiring no malice — fails the hub's build.** Not the
public half; the build.

Follow what that fails. `build-firebase` is where the allowlist would be evaluated (it is
where both outputs are produced and where the leak check runs), and `private-sync` declares
`needs: build-firebase`. So a `cv` rename stops:

- the public deploy (intended, arguably);
- the **private** build and therefore the private sync (not intended);
- and with it, **withdrawal**.

That last one is the problem. ADR-0010 decision 5 exists because "a sync that only adds leaves
withdrawn private files served at their old paths. That is a privacy failure wearing the
costume of a stale page." A stalled `private-sync` is functionally identical to an additive
one: a member who withdrew a dossier item goes on having it served, for as long as the
allowlist stays stale. And the repair — editing `site/publish-allowlist.json` — is an edit to
the *disclosure-control file*, made under time pressure, by someone whose actual goal is
"make the build go green again." That is the worst possible context in which to edit the one
file that decides what the world can see.

Note also that condition 1 is not load-bearing for safety. The rule is an AND: an allowlist
entry naming a nonexistent item makes *nothing* public, because there is nothing to render.
Condition 1 is a hygiene check — "this control has rotted" — wearing the clothes of a safety
check. Condition 2 (an allowlist entry over a `private` manifest) genuinely is a safety check
and I have no objection to it failing anything it likes.

There is a second-order version worth stating for completeness: because `cv` can fail the hub
build by renaming, and because the fix is an allowlist edit, a satellite has indirect
influence over the contents of the hub's disclosure control. Not a bypass, and I am not
claiming one — but it is pressure on a file that should be under no pressure at all.

### The evidence that would settle it

1. **Read `cv`'s slug history.** `git log` on `cv`'s manifest/config for the four allowlisted
   slugs (`academic`, `research-professional`, `sde-long`, `cv-data`): have any been renamed
   since the satellite contract landed? A history of renames makes this a when, not an if; a
   history of none makes it a lower-probability risk that is still worth the cheap fix.
2. **Confirm the blast radius directly.** In a scratch tree, add an allowlist entry for a
   nonexistent `(cv, does-not-exist)` and run the full `build-firebase` sequence. Record
   whether `npm run build:private` fails, and whether a real run would therefore skip
   `private-sync`. If the private build survives and only the public half fails, this
   objection shrinks to a deploy-availability concern and I will withdraw the privacy half of
   it — but that needs to be *shown*, because SEAM-B5 as written does not distinguish the two
   builds.
3. **Ask what the hub does today** when a `cv` slug disappears without an allowlist. ADR-0010
   decision 1 says an item absent from a manifest is simply not rendered — no failure. So
   condition 1 introduces a *new* failure mode where there was none.

### The cheapest alternative

**Split the guard by where it runs, not by what it checks.** One `if:` and one exit code:

- **On the hub's own pull requests and pushes** (`ci.yml` or `budget-guard`, both already
  required contexts): a stale allowlist entry is a **hard failure**. This is where the anti-rot
  signal belongs — it fires on a human's change to hub code, blocks a merge, and is repaired
  calmly with the allowlist file already open.
- **On the scheduled/deploy build**: a stale entry is a **loud warning** — `::warning::`, plus
  the existing failure-notification path (`notify-failure` already exists in `build.yml`) —
  and the build **continues**. Nothing becomes public that should not: the AND still holds and
  the stale entry still renders nothing. The private build, the private sync and withdrawal all
  keep working.

Cost: one conditional on an existing check. It keeps every safety property of SEAM-B5,
preserves the anti-rot signal in the place it actually gets read, and takes the kill switch out
of an untrusted party's hands.

If that is rejected, the fallback is smaller still: keep condition 1 fatal, but **evaluate it
only against the public build**, and let the private build and `private-sync` proceed
regardless. Withdrawal must never be blocked by a publishing-control error.

---

## Objection 4 — Lesson 3 was tested in this wave and lost, and the evidence is the wave's own highest-risk item

### The claim I dispute

Not a claim so much as a shape. `contracts/site-wave-0.md`'s opening note settles the
`build.yml` ownership conflict by splitting one change in two:

> `build.yml` is infra's this wave; this contract therefore specifies the *requirement* and
> infra implements it.

and `execution-patterns.md` lesson 3, whose "This repo" line still reads "**no evidence yet —
onboarded 2026-09-14**":

> implementation against an approved blueprint is serialized by shared code, tests, and
> migrations — default to a single agent or small team

### Why it may be wrong

The ownership reasoning is correct — one file, one owner, and the note was right to record
rather than silently resolve it. What I dispute is the conclusion drawn from it: that a
*single atomic change* could be split into a specifying stream and an implementing stream
running **concurrently**, and that the seam document would bridge them.

It did not. `handoffs/infra-wave-0.md`, item 3:

> **WAITING** — the `site` seam does not exist yet; nothing implemented, by design

`infra` behaved correctly — its restraint is the right call and it says why — but the outcome
is that **the wave's largest IAM change, the one its own contract calls "the stronger form",
did not get built.** infra's Recommendation 5 is now "Land item 3 next wave." The private-sync
identity split, scoped as the #3-of-7 risk item, costs a second infra pass, a second review,
and a second apply window.

This is not bad luck. SEAM-10 is by construction atomic: one service account, one WIF binding,
one bucket binding moved, one line of `build.yml`, and **two check scripts that S10.3 itself
says "will fail until they are updated in the same commit — by design."** A change whose own
specification says it must land in one commit cannot be parallelised across two agents; the
only orderings are serial. Splitting it guaranteed either a wait or a guess, and the contract
told `infra` to guess only if the seam existed. It didn't, so it waited.

That is lesson 3's claim, demonstrated, in this repository, with a measurable cost. It closes
the "no evidence yet" line — and it closes the Open Question at the foot of
`execution-patterns.md` ("Whether the Phase 1–3 implementation streams stay disjoint enough to
run in parallel") with a qualified **no**: they stayed disjoint by *file*, which is what the
contracts enforced, and were not disjoint by *change*, which is what actually matters.

The same root cause is already on this repo's record twice: the `PRIVATE_BUCKET` /
`GATE_PRIVATE_BUCKET` defect ("A cross-stream environment variable is a contract, and nothing
checks it") and SP-1, where `satellite-phd` found that `build.yml` cannot support the proof
its own procedure requires — a finding that had to be routed to a different stream to fix.
Three instances, one shape: **a change that is one thing was owned by two agents.**

A second cost, on the assurance side. The four landed streams produced 28 dispositioned
findings. Ten more independent assurance contracts were issued 2026-09-18 (Chief Reviewer,
Governance Auditor, Red Team, Security Tester, Skeptic Verifier, Boundary Tester, Live Prober,
Regression Tester, Roadmap Truth, and this one), several carrying explicit quotas — Red Team
"at least five attempted attacks", mine "at least three objections". STATE's own rule is that
"**No finding is closed by silence**" and that builders never disposition their own work. So
every finding from every one of those agents lands in a single serial queue at the Lead
Architect, before the wave can close. The fan-out is real and I think mostly justified — these
are disjoint-scope audits, which is the shape lesson 3 *permits* to fan out — but the
throughput limit is not the agents, it is the disposition queue, and nothing in the wave's
shape acknowledges that.

### The evidence that would settle it

1. **Count the second pass.** When item 3 lands next wave, record the wall-clock and token
   cost of the `infra` re-launch — re-reading `infra/**`, the seam, and the two check scripts
   — against the counterfactual of `infra` having owned SEAM-10 outright from the start. If
   the re-launch is cheap, my objection is smaller than I think.
2. **Count the disposition queue.** When all ten assurance handoffs are in, count the total
   findings and the number that required a Lead Architect decision rather than a mechanical
   accept. Compare with the 28 from four streams. If the ratio is roughly linear in agents,
   the queue is the binding constraint and the wave's shape should say so.
3. **Look for the third instance.** Check whether any *other* Wave 0 item was specified by one
   stream and implemented by another. If SEAM-10 is the only one, this is a single data point
   about one change, not about the wave.

### The cheapest alternative

Nothing to undo — the wave has run. Two changes for Wave 0b and Wave 1, both free:

- **Ownership follows the change, not the file.** When a single atomic change spans two file
  sets, give *one* stream both file sets for that change and name the exception in the
  contract, rather than splitting it into a spec and an implementation. Had `infra` owned
  `site/scripts/sync-private.mjs`'s two env-var names for the duration of SEAM-10 — or `site`
  owned the one `build.yml` line — item 3 would be done. The ownership rule exists to stop two
  streams editing one file; it was applied to stop one change having one owner, which is not
  the same thing.
- **If a spec/implement split is genuinely necessary, serialise it.** Land the seam, *then*
  launch the implementing stream. `infra` was launched before the seam existed, which made the
  wait structural rather than a scheduling accident.

And — this is the durable part — **promote this into `execution-patterns.md` lesson 3 as this
repo's own evidence**, replacing "no evidence yet". The lesson currently rests entirely on
seed-repo experience, which is exactly why it was easy to route around.

---

## Objection 5 — dev-staging in a separate project: a consequence for the owner, stated as a consequence

### The claim I dispute

`handoffs/infra-wave-0.md` item 7, the ADR text ready to file as `0012`:

> **Decision.** Dev-staging lives in a **separate GCP project**, not as a second Hosting
> target in `cusati-hub`.
> … Only (c) gives a real boundary — separate IAM, separate WIF, separate buckets, separate
> Firestore, and a blast radius that stops at the project edge.

### Why it may be wrong

The Hosting-IAM finding is correct, well-sourced from the provider schema, and infra was right
not to implement the contract's default. I am not disputing the finding. I am disputing that
"separate project" follows from it, and I want two consequences on the record before the owner
decides.

**First: it doubles the thing the whole security argument rests on being small.** Every
invariant this sprint has built now has two instances. §12.6's budget alert is one of six
non-negotiables, and `budget-guard` — a required status check — asserts `infra/budget.tf` and
its `prevent_destroy` by *file presence and content*. A second project needs a second budget,
and the ADR says so: "It needs its **own** `$5` budget alert; §12.6 binds per project." Unless
`budget-guard` is extended in the same commit, the non-negotiable is enforced for one project
and trusted for the other. The same applies to `check_private_bucket_config.py`'s
two-principal equality, UBLA, `public_access_prevention`, the WIF shared-pool invariant, and
the legacy-binding guard infra just added. The ADR does say the dev bucket keeps the
invariants and that the checker is "extended to assert it" — good — but that is one line
covering roughly six guards, a second WIF pool, a second Firestore and a second Artifact
Registry. §12.5 ("owner can rebuild from the repo in a fresh GCP project") also becomes two
rebuilds.

**Second: fixture content makes it an unfaithful rehearsal of the one thing it is for.** The
owner's stated problem (STATE §Follow-ups, 2026-09-17) is that "there is no way to review the
members' area as a member without either shipping it". The reviewing they want to do is *of
the content* — does the dossier read right, does the tracker look right. The ADR correctly
forbids real private material ("A dev environment mirroring production data is a second copy
of the dossier with weaker controls"), which means the dev site can rehearse **routing, gating
and layout** and cannot rehearse **content**. That is worth something, but it is not what the
follow-up asked for, and the gap is where the pressure to paste in "just one real page to
reproduce this bug" comes from. When that happens, the copy lands in the project that the same
ADR descopes from monitoring ("no dev uptime checks recommended: dev being down is not an
incident").

Worth noting too: a dev project does not solve the *immediate* blocker the follow-up describes
— "the owner, working over SSH, with no local browser, could not view a local preview at all".
A deployed dev site still needs a browser. What it solves is "deployed but not production",
which is a different and narrower problem than the one written down.

### The evidence that would settle it

1. **Does a tagged Cloud Run revision give the same review, in one project?** `gcloud run
   deploy --tag <name> --no-traffic` produces a distinct URL served by a revision carrying 0%
   of traffic, at `min_instance_count = 0`, in `cusati-hub`, with the existing gate SA and the
   existing bucket. Test whether a member can sign in against that tagged URL and read real
   private content pre-cutover. If yes, it is a faithful rehearsal — real data, real IAM, real
   Identity Platform — with **no new project, no new budget, no new WIF pool, no new guard
   instance, and no second copy of the dossier**. The Hosting-IAM problem does not arise
   because Hosting is not involved.
2. **Firebase Hosting preview channels**, similarly: `firebase hosting:channel:deploy` gives an
   expiring URL. Check whether a preview channel's rewrites resolve to the same Cloud Run
   service, and whether that is acceptable (it means dev traffic hits the production gate —
   which may be a feature for review fidelity and a problem for isolation). Settle it by
   deploying one channel and probing `/p/`.
3. **What review does the owner actually want?** If the answer is "I want to see my real
   dossier laid out before it ships", fixtures fail and option 1 is the only faithful answer.
   If it is "I want to click through sign-in and navigation", fixtures suffice and the question
   becomes purely one of surface. This is one question to the owner and it changes the answer.

### The cheapest alternative

**Try the tagged-revision route before committing to a second project.** It costs a `gcloud`
flag and one probe to falsify. If it works, the ADR becomes "dev-staging is a no-traffic
tagged revision of `hub-gate`, reviewed against real content, with no new project" — cheaper,
more faithful, and it leaves the security surface exactly the size it is now.

If it does not work and a second project is genuinely required, then the cheapest honest
version is: **file ADR-0012 as written, and in the same PR extend `budget-guard` and
`check_private_bucket_config.py` to assert the dev project's budget and bucket invariants
before the dev project exists.** Guards first, then resources. Otherwise the second project
starts life with the non-negotiables asserted in prose.

---

## Examined and dismissed

Recorded so they are not re-litigated, and so the examination is visible.

**The uniform 404 as an existence oracle (C29, my starting point 5) — dismissed; the design is
better than the brief assumed.** I read `gate/app/main.py:293–327`. The deny path returns three
*different* static bodies, all at 404, and the discriminator is the **caller class, never the
resource**:

| Caller | Real slug | Fake slug |
|---|---|---|
| signed out | `SIGN_IN_REQUIRED` | `SIGN_IN_REQUIRED` |
| signed in, unverified or non-member | `NOT_SHARED_WITH_YOU` | `NOT_SHARED_WITH_YOU` |
| member | 200 | `NOT_FOUND` |

A non-member learns nothing about what exists; a member is entitled to. The ordering comment
("an unauthenticated caller never reaches the path validator and never causes a bucket lookup")
means there is no bucket round-trip on the refused paths either, so the timing variant of the
attack has been designed against as well. And the premise of the other half of the starting
point is wrong: a member with a real permission problem gets `NOT_SHARED_WITH_YOU`, which is
*distinguishable* from `NOT_FOUND` — it is not "indistinguishable from a typo". **One residual,
too small to be an objection:** the bodies are static, so a member reporting "I get a 404" hands
support nothing to grep by. A random request id in an HTML comment is not an oracle (it names
no resource) and would cost three lines. Worth a line in the ADR-candidate for C29, not a
finding.

**The provenance marker (site stream, my starting point 4) — dismissed; it is well built.** I
looked for the ways it could be wrong and did not find them. It fails **closed**
(`expectedSourcesEnforcement` enforces on absent/unreadable/unrecognised — only an explicit
`complete: false` exempts); it is written **after** the sync into a destination
`sync-content.sh` rebuilds from scratch, so it cannot outlive its tree; satellites publish
under `sources/<source>/` and cannot reach the tree root where it sits; and the filename is
declared once in `hub-content.mjs` and imported by the shell script rather than spelled twice.
The cost-when-wrong is genuinely asymmetric in the safe direction: a wrongly-absent marker
fails a build loudly, a wrongly-present `complete: false` skips one guard and prints a
`console.warn` naming the reason. **One residual:** that `console.warn` is the only signal that
a guard did not run, and build logs are not read. `::warning::` instead of `console.warn` would
surface it in the GitHub UI, at the cost of one string. I also traced whether the marker can
reach `dist-public` via `stage-public-assets.mjs`, and it cannot: that script iterates the tree
root treating each entry as a *source directory* and skips any entry with no
`<entry>/manifest.json`, then copies only files named by a manifest `item.path`. A file at the
tree root is never a candidate. No leak, and nothing to confirm later.

**The allowlist as a second source of truth (my starting point 6) — dismissed.** SEAM-B2 puts
`effective_visibility` in exactly one function with a named consumer list and a stated
consequence per consumer, and SEAM-B5 makes the AND fail in *both* directions so the hub cannot
override a satellite's request for privacy. That is a better answer than "two sources of truth"
and it explicitly cites ADR-0011's warning against reintroducing the convention it removed. My
one real concern with SEAM-B5 is objection 3 above, which is about the failure *mode*, not
about duality.

**The allowlist's L0 classification — dismissed on a fact I went looking to use against it.** I
intended to argue that classifying the one operation that makes private material public as
"L0-shaped… reviewed as bookkeeping" collides with this repo's own anti-pattern ("Treating an
uncertain change as administrative. The default is the reverse: uncertain => semantic => human
review"). But `llm/governance/governance-delta.md` §Steward Activation Status reads **INACTIVE**
— "Steward merge authority ships inert… It is also blocked in substance by the identity model
above" — and the L0 allowlist block is explicitly "inert while §Steward Activation Status is
INACTIVE". So L0 here means "a small, reviewable diff", not "an agent may merge it", and the
objection evaporates. **It becomes live the moment the steward is activated**, so: if an
activation ADR is ever written, `site/publish-allowlist.json` should be named as excluded from
the L0 path allowlist. Recorded for that future, not as a finding now.

**The executable-bit guard (my starting point 4, first half) — dismissed.** The false-positive
class the contract worried about was handled better than the contract specified: `infra`
classifies by *how a file is reached* (scanning only execute surfaces — workflow `run:`,
`*.sh`, `package.json` scripts, composite actions, Dockerfiles — with comments stripped first),
found the true shebang count is eight rather than the contract's five, and added a rule C
("a shebang file that is neither `*.sh` nor directly invoked must **not** be `100755`") so the
classification cannot be silenced by drifting everything to 755. Its stated residual — comment
stripping can hide a call site inside a string — is one-directional toward missed detection,
never toward noise, which is the correct direction for a guard that must not cry wolf.

---

## Summary

Five objections, four of which I believe and one of which I raise as a consequence for the
owner. Stated at their sharpest:

1. **The private-sync identity split buys less than it is being credited with.** WIF admits on
   branch alone, so anything on `main` can assume the new identity; and the private tree is
   still built, receipted and artifact-uploaded under `hub-deploy`. What actually bounds the
   damage today is the 34% deletion ceiling in `sync-private.mjs`, not IAM. The change is a
   real mitigation for token leakage out of the four non-private jobs — which is worth doing —
   and is not "the stronger form" of the two-principal invariant. Fix: bind on
   `attribute.workflow_ref`, or put the job behind a GitHub Environment. Or amend H1's wording.
2. **N-1's verification may not be runnable when it is needed.** Its only real step is an
   email-link sign-in, and D6.5 raises the live hypothesis that email does not deliver at all;
   Google sign-in is unconfigured (#31). Fix: prove a sign-in route delivers *before* applying
   the narrowing, and add a log-based alert on `PERMISSION_DENIED` so a broken mint announces
   itself.
3. **SEAM-B5 condition 1 lets an untrusted satellite fail the hub's build, and that build
   gates `private-sync`, and `private-sync` is withdrawal.** A `cv` slug rename would leave
   withdrawn private items served. Fix: hard-fail on the hub's own PRs, warn on the deploy
   build. Condition 2 should keep failing everything.
4. **Lesson 3 was tested in this wave and lost.** SEAM-10 was split spec/implement across two
   concurrent streams and did not get built — infra's item 3 is `WAITING`, and its
   recommendation is "land it next wave". The rule should be that ownership follows the
   *change*, not the file. This closes lesson 3's "no evidence yet" line with this repo's own
   evidence.
5. **dev-staging in a second project** doubles every invariant the security argument depends on
   (§12.5 and §12.6 in particular) and still cannot rehearse content, because fixtures are
   mandatory. A no-traffic tagged Cloud Run revision may give a *more* faithful review in one
   project, for a flag. Worth one probe before the ADR is filed.

The wave's craft is high and I want that on the record alongside the objections: `infra`
catching that a `createSession`-only role would fail every verify, `satellite-phd` catching
that Part C's proof is unobtainable as `build.yml` stands, `site` catching that an unqualified
`required: true` flip would red every pull request, and `gate` declining a rename that would
have broken a live alert across a stream boundary — those are four streams each finding the
thing their own contract got wrong. My objections are mostly about **what a change is credited
with** and **what order things happen in**, not about whether the code is right.

## Assumptions

1. **I read branches with `git diff main...<branch>` and never checked one out**, per the
   contract; six other agents are reading this worktree. Where I quote `build.yml`,
   `wif.tf`, `gate/app/main.py` or `sync-private.mjs` without a branch qualifier, it is `main`
   as of `admin/wave-0-preconditions`.
2. **`private-sync`'s new WIF binding will be as SEAM-10 S10.3 specifies** — "identical in
   shape to `gate_deploy_wif_main`… same pool, `refs/heads/main` only". Objection 1's first
   half evaporates if `infra` implements it with a narrower attribute. It has not been
   implemented, so I am objecting to the specification.
3. **GitHub's OIDC token carries a workflow identifier** (`workflow_ref` / `job_workflow_ref`)
   and an `environment` claim. I did not verify this against a live token — no `gh` or cloud
   call was permitted — which is why it is the first piece of settling evidence in objection 1
   rather than an assertion.
4. **The allowlist would be evaluated in `build-firebase`**, where both outputs are produced.
   SEAM-B5 does not say which job, and objection 3's blast radius depends on it — which is why
   I named it as evidence (item 2) rather than assuming it.
5. **`cv`'s slugs can change without hub review.** `cv` is a separate repository and is not in
   this run's stream roster (STATE RT-10). If the owner treats `cv` slugs as frozen by
   convention, objection 3's probability drops but its mechanism stands.
6. **D1–D8 and §12's six non-negotiables are out of bounds.** Where I touch D8 (objection 3)
   and §12.5/§12.6 (objection 5), I am objecting to an implementation or naming a consequence,
   never to the decision.

## Recommendations

In the order I would act on them.

1. **Before applying N-1: confirm an email-link actually arrives.** One minute of the owner's
   time. It gates objection 2, closes D6.5's open connection, and is prerequisite evidence for
   A1/A3/A5 anyway. If no link arrives, #49's verification does not exist and the apply waits.
2. **Add the `PERMISSION_DENIED` log-based alert for `hub-gate`.** $0.00, mirrors alert
   policies already in `infra/monitoring.tf`, and converts N-1's worst case from "silent" to
   "announced". Do this whether or not the ordering in recommendation 1 is accepted.
3. **Decide objection 1's fork before `infra` implements item 3**, since it is not yet built:
   either narrow the binding to `attribute.workflow_ref`, or accept branch-only admission and
   amend S10.4's H1 to state the scope honestly. Deciding after the Terraform is written costs
   a second apply.
4. **Amend SEAM-B5 before Wave 0b starts.** Condition 1 hard-fails on the hub's own PRs, warns
   on the deploy build; condition 2 unchanged. One `if:`, and it must land before the allowlist
   does or the first `cv` rename finds it for us.
5. **Probe the tagged-revision route** (`gcloud run deploy --tag --no-traffic`) before filing
   ADR-0012. One command decides whether the second project is necessary.
6. **Write objection 4 into `execution-patterns.md` lesson 3** as this repo's own evidence,
   replacing "no evidence yet — onboarded 2026-09-14", and close its Open Question with the
   qualified "no". This is the durable output of the wave and it will be lost if it stays only
   in a dissent handoff.

## Alternatives considered

- **Objecting to D8's L0 classification of the allowlist** — dropped when
  `governance-delta.md` §Steward Activation Status turned out to be INACTIVE, making the L0
  lane inert. See §Examined and dismissed. It would also have been close to relitigating a
  decision, which is out of bounds.
- **Objecting to the uniform 404 as an existence oracle** — dropped after reading the deny
  path. The design discriminates by caller class, not by resource. See §Examined and dismissed.
- **Objecting to the provenance marker as "a second thing that must be true"** — dropped; it
  fails closed, cannot outlive its tree, and is unreachable by satellites. See §Examined and
  dismissed.
- **Objecting to the exec-bit guard's false-positive risk** — dropped; reach-based
  classification plus rule C is a better answer than the contract asked for, and its residual
  points toward missed detection rather than noise.
- **Arguing the wave should have been one agent** — rejected as wrong. Ten of the fourteen
  Wave 0 contracts are disjoint-scope audits, which is the shape lesson 3 *permits* to fan out;
  only four are builders. The real objection is narrower and is objection 4: one atomic change
  was owned by two builders, and the disposition queue, not the agent count, is the throughput
  limit.
- **Objecting to `PRIVATE_SYNC_PLAN_ONLY` being a repository variable** (infra's own Risk 5 —
  anyone who can set variables can silently stop the destructive sync, and a silently skipped
  sync is the ADR-0010 decision 5 failure) — folded into objection 1's Environment alternative,
  which closes it as a side effect, rather than raised separately.

## Risks

1. **Objection 1's second half may be considered out of scope and dropped with the first.** If
   the workflow_ref binding is adopted, the artifact path — private tree built under
   `hub-deploy`, pushed verbatim by `private-sync` — is still open, and it is the larger of the
   two. Whatever is decided about WIF, the artifact path should be recorded.
2. **Objection 2 argues for delay, and this run is authorised to go to the end of Phase 6
   without stopping.** The pressure is toward applying N-1 now. If it is applied before a
   sign-in route is proven, the log-based alert (recommendation 2) becomes the only thing
   standing between a broken mint and a member discovering it.
3. **My objection 3 could be read as an argument against the allowlist.** It is not. D8 is out
   of bounds and I am not arguing with it. I am arguing about one failure mode of one guard
   that serves it.
4. **I may have the allowlist's evaluation point wrong.** If SEAM-B5's condition 1 is evaluated
   somewhere that does not gate `private-sync`, the privacy half of objection 3 is wrong and
   only the deploy-availability half stands. Evidence item 2 settles it; I could not, without
   running a build against a tree that does not exist yet.
5. **I did not read the `roadmap-truth` handoff in full** (76 KB). I worked from STATE's
   summary of it, which the Lead Architect wrote. If that summary is incomplete, findings I
   should have engaged with are missing from this document.
6. **A dissent that is accepted wholesale is as suspicious as one that is rejected wholesale.**
   Objections 1 and 4 I hold firmly; 2 is about sequencing and may already be the plan; 3
   depends on an evaluation point I could not verify; 5 is explicitly the owner's call.

## Open questions

1. **Does GitHub's OIDC token for this repository carry `workflow_ref` / `job_workflow_ref` /
   `environment`?** Settles whether objection 1's cheapest alternative exists at all. Evidence:
   one throwaway job on `main` printing its own claim *names*.
2. **Does an email-link to `djjay@vt.edu` arrive?** Settles objection 2, D6.5, and whether
   A1/A3/A5 are verifiable by anyone. Evidence: send one.
3. **Which job evaluates the publish allowlist, and does its failure gate `private-sync`?**
   Settles objection 3's severity. Evidence: a scratch build with a deliberately stale entry.
4. **Can a member sign in against a no-traffic tagged Cloud Run revision and read real private
   content?** Settles objection 5, and possibly removes the need for ADR-0012 entirely.
   Evidence: `gcloud run deploy --tag` plus one browser session.
5. **Is `firebase_admin`'s project-config fetch (infra's open question 1) cached per process?**
   If so, N-1's verification can pass warm and fail on the next cold start — a partial break
   the current step (f) would not catch. Evidence: force a cold start and repeat (f).
6. **Have any of the four allowlisted `cv` slugs ever been renamed?** Turns objection 3 from a
   mechanism into a probability. Evidence: `git log` on `cv`'s manifest.

## Related docs

- `llm/sprints/2026-09-hub/contracts/dissenter-wave-0.md` — this contract
- `llm/sprints/2026-09-hub/contracts/infra-wave-0.md` — items 3, 4, 7 (objections 1, 2, 5)
- `llm/sprints/2026-09-hub/contracts/site-wave-0.md` — the ownership note (objection 4)
- `llm/sprints/2026-09-hub/contracts/private-by-default-seams.md` — SEAM-B2, SEAM-B5
  (objection 3)
- `llm/sprints/2026-09-hub/handoffs/site-wave-0.md` — SEAM-10, S10.3–S10.6 (objection 1)
- `llm/sprints/2026-09-hub/handoffs/infra-wave-0.md` — items 3, 4, 7; Risks 1, 2, 5, 6
- `llm/sprints/2026-09-hub/STATE.md` — §Wave 0 dispositions (RT-1, RT-9, D6.5), §Sign-in at
  Checkpoint 4, C29–C31, §Follow-ups, §Risks
- `llm/governance/patterns/execution-patterns.md` — lesson 3 and its Open Question (objection 4)
- `llm/governance/governance-delta.md` — §L0 Path Allowlist, §Steward Activation Status
- `llm/governance/adr/0010-withdrawal-semantics.md` — decisions 3, 4, 5 and its Risks section
- `llm/governance/adr/0007-…` — decisions 2, 4, 8 · `0011-…` — the two-`srcDir` model
- `llm/specs/2026-09-10-research-hub-design.md` — §8, §12.1, §12.3, §12.5, §12.6
- `infra/wif.tf`, `infra/gate-auth-role.tf`, `.github/workflows/build.yml`,
  `gate/app/main.py`, `site/scripts/sync-private.mjs`, `site/scripts/private-build.mjs`

## ADR candidates

1. **"WIF admission is by branch, not by workflow — and what that means for per-identity
   splits."** The load-bearing consequence of objection 1, and it generalises past
   `private-sync` to every future identity this project adds. It should record the shared-pool
   invariant's extension to any new attribute, and state plainly which threats a
   same-pool/same-ref identity split does and does not address. Without this, the next split
   will be credited with the same boundary this one is.
2. **"The private bucket's contents are determined by the build job, not by the sync
   identity."** An amendment to ADR-0010's decision 5 reasoning. The receipt (P2–P4) is written
   by the same build that produces the tree and therefore attests to completion, not to
   trustworthiness; the 34% deletion ceiling (P6) is what actually bounds a defective build.
   That distinction is currently only in source comments.
3. **"A publishing-control error never blocks withdrawal."** The general rule behind objection
   3, larger than SEAM-B5: any guard that can fail the build must be classified by whether its
   failure can leave private material served. If it can, it warns on the deploy path and fails
   only on the review path.
4. **"Ownership follows the change, not the file."** Objection 4, as an amendment to
   `execution-patterns.md` lesson 3 rather than a standalone ADR — with SEAM-10, the
   `PRIVATE_BUCKET`/`GATE_PRIVATE_BUCKET` defect and SP-1 as the three instances.
5. **If ADR-0012 (dev-staging in a separate project) is filed:** it should carry an explicit
   list of every guard that must be instantiated twice, and the §12.5/§12.6 consequence stated
   as a consequence — not as a footnote. And it should record why the tagged-revision
   alternative was rejected, if it is.
