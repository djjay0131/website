# ADR-0027: A private calendar for active work and submission deadlines

Status: Accepted
Date: 2026-10-20
Builds on: ADR-0025 (roles, groups and the Firestore access policy), ADR-0026
(private projects as site sections)

## Context

D25 turned the members' area into Projects, but active work still had no time
view. The owner asked for one calendar of active work and submission deadlines,
filterable by project and conference, that is **not public** and that shows a
project's events only to members who can open that project. The repository is
public, so no event, project name, group name or member email may be committed;
access must still change without a PR, rebuild or redeploy.

Two kinds of events exist. Some belong to a satellite project and should travel
with that project's published manifest. Others are the owner's own milestones
and may belong to no project at all. A calendar that only accepted one kind
would either force private event data into the public repo or force satellites
to learn Firestore.

## Decision

1. **The calendar is a member page, not a public surface.** It lives at
   `/p/calendar/`, is linked from the private Projects navigation and project
   sections, and is emitted only by the private build. It is never in the public
   build, sitemap, feeds or `publish-allowlist.json`. Signed-out requests get the
   standard styled 404. `calendar/index.html` joins the fixed member pages that
   carry no item metadata; the events themselves arrive from the gated endpoint.

2. **One event model, two sources.** An event is
   `{id, project, title, kind, start, end?, all_day, timezone, conference?,
   url?, notes?, status}`. `kind` is `submission`, `abstract`, `notification`,
   `camera-ready`, `conference`, `milestone` or `work`; `status` is `active`,
   `done` or `cancelled`.
   - **Satellites** may add an OPTIONAL `deadlines[]` array to the manifest. It
     requires envelope `manifest_version: "2"`; an absent version still means
     `"1"`, and every existing manifest stays valid unchanged. The hub derives
     the project from the **assigned source prefix** (the staging directory),
     never from a field inside an event, and refuses a manifest whose declared
     source disagrees. Entries are validated against the contract and sanitised
     again at build time (plain text, `https:` URLs only, strict ISO dates).
   - **Owner events** live in Firestore `calendar_events`, written only by
     `infra/scripts/calendar_events.py` with an out-of-repo JSON file per event.
     Every write is one transaction that also appends a `calendar_audit`
     record. No event data is committed to this repository.

3. **The gate reuses the item policy; there is no second ACL.** The private
   build writes `_hub/calendar.json` beside `_hub/catalog.json`. This is a small,
   deliberate departure from "stage deadlines per project": `_hub/**` is never
   served, the gate already reads one private document (`catalog.json`), and a
   single file means one filtered view instead of N bucket reads. Per-project
   files would add fetch fan-out without changing who may read an event, so the
   project remains a field on each event and the gate applies the ACL. The gate
   merges that file with Firestore and applies the same joined item → source →
   section → default policy as `/private/items`: a project event is returned only
   when the viewer may open at least one item in that project. A non-project
   event is owner-only. The owner sees everything. Both sources fail closed: a
   missing or malformed document contributes nothing, never "show everything".
   The response contains no count of denied events, and the UI builds its filter
   options only from returned events, so the endpoint adds no existence oracle.

4. **One new read route.** `GET /private/calendar` requires a verified member
   and returns `{events: [...]}`. It sits in the gate's exact route table and is
   covered by the same origin, session and membership checks as
   `/private/items`. `calendar_events` and `calendar_audit` are covered by the
   existing deny-all Firestore client rules; only the gate's service account and
   the owner tool reach them.

5. **The UI is part of the site, not an embed.** A month grid and an agenda/list
   toggle, an upcoming strip with countdowns, multi-select project and
   conference chips persisted in the URL query, kind badges, done/past styling,
   and an accessible `aria-pressed` control set. Project sections show their own
   upcoming events from the same endpoint. There is no iframe and no third-party
   calendar embed.

6. **Time is explicit.** A date-only event is a calendar date; a timed event
   must carry an explicit offset or `Z`, so a browser never guesses a zone.
   `timezone: "AoE"` (Anywhere on Earth, UTC−12) is supported: a date-only AoE
   deadline means 23:59:59 on that date in UTC−12, which is the following day in
   UTC. The UI shows the AoE date and the viewer's local equivalent, and the
   countdown uses that instant. Impossible dates are rejected, not normalised.

7. **Opt-in publishing.** Publishing no `deadlines` is the normal case and needs
   no satellite change. A satellite opts in only by declaring version 2 and
   adding the array; the contract suite proves old manifests still validate.

## Consequences

- A satellite can publish its own submission and notification dates without
  learning Firestore, and the owner can add work or personal milestones without
  publishing anything.
- Project membership remains the single access decision. A member who can open
  one page of a project sees that project's events; they still cannot open its
  other pages, payloads or documents.
- Event changes in Firestore take effect within the existing 30-second policy
  cache window with no rebuild or redeploy. Satellite deadlines change when the
  project publishes.
- The calendar endpoint can be slow to reflect a withdrawal for the cache
  window; it never leaks a withdrawn event after that window.
- A cancelled or done event remains available for its past styling and history;
  the upcoming strip excludes it.

## Out of scope

- **Per-member `.ics` feeds.** A bearer feed URL is a secret and needs
  revocation design; it is deferred rather than shipped quietly.
- **Seeding live events.** Candidate deadlines found in existing content are
  drafted out-of-repo and listed for the owner to confirm. No event is written
  live by the agent, and no seed data is committed.
- **Third-party calendar sync** (Google Calendar and similar). It would move the
  access decision out of the gate and is not needed for this surface.

## Rejected alternatives

- **A public calendar.** The brief requires member-only visibility, and a
  public build cannot be trusted to hide event data that is merely filtered at
  render time.
- **An `access` field on each event.** It would create a second ACL, let an
  untrusted manifest widen access, and break the rule that the repository never
  carries access values.
- **Events only in the manifest.** Personal milestones have no satellite and
  would force private data into the public repo.
- **Events only in Firestore.** Satellites would need credentials and a write
  path to the hub's database, widening the trust boundary for a display field.
