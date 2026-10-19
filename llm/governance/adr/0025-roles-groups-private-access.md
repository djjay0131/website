# ADR-0025: Private access is role/group based, owner-managed in Firestore, and enforced per item

Status: Accepted
Date: 2026-10-19
Amended: 2026-10-19 (D24-B: owner decision — the policy moves to Firestore)

## Context

The private area is currently all-or-nothing: any document in
`members/{email}` may read every object under `/p/**`. The owner wants
per-section and per-item access by role and group, without weakening the
public-build leak check or changing what satellites must publish. The private
UX also needs repair: signed-out callers see a white sign-in page, signed-in
members without access see a bare message, and private items are embedded in an
iframe below a separate members' menu.

Three trust facts constrain the design:

- **Satellites are untrusted** (design doc §12.3). A satellite must not be able
  to widen access by asserting it, just as it cannot publish by asserting
  `visibility: public` (ADR-0016).
- **The public build is structurally separate** (ADR-0011, ADR-0005). Any access
  data must stay on the private side and must never appear in `dist-public`.
- **The website repository is public.** A committed policy would reveal private
  item keys, private source names and the group names used for private content,
  even though it would not reveal the content bytes. The owner's decision is
  that roles and access change without a PR, and the repository does not control
  access to the website.

## Decision

1. **Keep `/p/` paths for this wave.** Moving private items to their real section
   paths would require Hosting rewrites over public route namespaces and a new
   proof that no private route or byte enters `dist-public`. Per-item gating is
   achievable under `/p/` with a much smaller change. A future ADR may move the
   paths once that proof exists.

2. **Members carry roles and groups.** `members/{email}` carries optional
   `groups: [string]`; `role` is `owner` or `member` (absent means `member`).
   `owner` is always allowed. A non-owner is allowed when the item is
   effectively public, when the member's role matches a listed role, or when one
   of the member's groups intersects the item's groups.

3. **The policy lives in Firestore, not in the repository.**
   `access_policy/current` is the authority, resolved
   **item → source → section → default** as before. The document carries
   `version`, `default`, `sections`, `sources` and `items`; each rule is
   `{groups, roles}`. Member role and groups stay on `members/{email}`.
   `site/private-access.json` is removed.

   The gate reads the policy through the Admin SDK at request time, caches it
   for **at most 30 seconds**, and **fails closed** when it is missing or
   malformed. The owner is always allowed. A policy or member-group change
   therefore takes effect with **no PR, no rebuild and no redeploy**. There is
   no access data in this public repository; the initial policy is written by
   the owner after merge.

4. **The private build emits an object map, not a policy.** It writes
   `_hub/catalog.json` into `dist-private`: item metadata plus an
   **object → item-key map** covering every staged payload and every item-scoped
   `_doc/` file. It carries **no groups or roles**. The gate joins the map with
   the Firestore policy, which is what makes `_payload/**`, `_doc/**` and
   annotation checks resolve to an item. `_hub/**` is never served through
   `/p/**`; an unmapped object fails closed. A stale catalog can change what
   exists, never who may read it.

5. **The gate enforces access on every private surface.** `/p/**` page and
   payload objects, `_doc/**`, annotation create/list, and the new
   `GET /private/items` listing all consult the same joined resolver. The owner
   is always allowed. Share links remain owner-minted bearer grants for one item
   and are unchanged; a token does not consult group membership.

6. **No existence oracle.** Signed-out `/p/**` returns one static, styled site
   404 for every path, with no sign-in prompt (sign-in remains in the normal
   footer/nav link). A signed-in member without access returns the same 404
   status with one generic styled message; "exists but not yours" and "does not
   exist" are indistinguishable. Missing objects under an allowed rule keep the
   ordinary 404 body.

7. **No embedded private items.** Private item pages render top-level in the
   normal site chrome and link the document itself top-level. The members'
   landing page, Shares and My notes fetch `/private/items` rather than shipping
   the full private catalogue in static HTML.

8. **Owner writes are tooled and audited.** `infra/scripts/access.py` shows the
   policy and sets or clears a default, section, source or item rule; it adds or
   removes a member's groups and sets a role. Every name is supplied as an
   argument: the script contains no member email, item key, source name, section
   name, group name or role name. Every write is a Firestore transaction that
   also appends an `access_audit` record (who, when, action, target, before,
   after). Firestore security rules deny every client read and write to
   `access_policy` and `access_audit`; only the gate and the owner tool reach
   them through service-account credentials.

## Alternatives Considered

### Keep the policy in a committed file

Rejected by the owner on 2026-10-19. The repository is public, so a committed
policy discloses private item keys, source names and group names; and a policy
change would need a review, merge, rebuild and deploy. Moving the policy to
Firestore is what makes an access change a one-command owner action while the
repository carries no access data.

### Add `access` to the manifest schema

Rejected for this wave. It is a contract change, it puts the access decision in
an untrusted input, and it cannot set a default for already-published items
without editing every satellite. The hub keeps the same trust direction as
ADR-0016.

### Firebase custom claims

Rejected as the primary mechanism. Claims require Admin SDK writes on every
group change and are stale until token refresh; they would make a role change
wait for a new token instead of the policy cache window. Firestore documents are
also the one store the gate and the owner tool already share.

### Astro middleware or per-group builds

Rejected. The private output is static and served by the gate; per-group builds
multiply the build matrix and create a second place where private bytes can be
staged. The gate is already the single enforcement point.

### Move private items to `/research/...`, `/cv/...` now

Deferred, not rejected forever. It needs Hosting rewrites over public prefixes
and a new leak proof. The ADR records the recommendation to revisit only with
that proof.

## Consequences

### Positive

- The owner narrows an item, a source or a section with one command, and the
  change takes effect within 30 seconds with no PR, rebuild or redeploy.
- The public repository carries no private item keys, source names, group names
  or member emails for this feature.
- Every policy and group write is audited with before/after values.
- Current members do not lose access on the day this lands; the initial policy
  preserves the pre-D24 set and is written by the owner after merge.
- The signed-out and no-access responses stop being white pages or oracles.
- The full private catalogue is no longer embedded in every private page.

### Negative / Tradeoffs

- The gate now depends on Firestore for reads as well as membership. A Firestore
  outage or a missing policy fails closed and denies private reads to members;
  the owner remains allowed.
- The policy document is invisible to code review. The audit log is the review
  trail, and the owner tool is the only intended writer.
- The gate depends on `_hub/catalog.json`; a failed private build or sync fails
  closed. An object added to the bucket without a catalog entry is unreachable.
- An item's asset bytes are mapped by the build's staging plan. Shared payload
  files are allowed when any item that legitimately stages them is allowed.

### Risks

- A stale policy can deny or allow for up to 30 seconds after a change. That is
  the chosen cache window.
- The initial policy is written after merge. Until that write, the gate fails
  closed for members (the owner can still sign in). This is intentional and is
  called out in the merge checklist.
- Group names are free-form strings; a typo is a denial, not a widening. The
  gate logs denials without item paths.
- `format: data` items remain build inputs and are not listed or served as
  private documents.

## Impacted Areas

- [ ] Product
- [x] Domain model
- [x] Data architecture
- [ ] AI architecture
- [ ] Domain-specific systems (see governance delta)
- [x] Integrations
- [x] UX
- [x] Security/privacy
- [x] Implementation
- [x] Documentation

## Related Documents

- `llm/governance/adr/0004-private-area-cloud-run-gate-behind-hosting.md`
- `llm/governance/adr/0005-two-output-build-with-leak-check.md`
- `llm/governance/adr/0011-two-srcdirs-not-a-visibility-filter.md`
- `llm/governance/adr/0016-private-by-default-publish-allowlist.md`
- `llm/governance/adr/0017-shares-serve-the-item-document.md`
- `llm/governance/adr/0021-annotations-private-item-notes.md`

## Supersedes

None.

## Superseded By

None.
