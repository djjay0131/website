# The gate's Identity Platform role (Chief Reviewer N-1; design doc §12.3
# principle 3; ADR-0004 decision 2).
#
# WHAT THIS REPLACES, AND WHY. The gate held roles/firebaseauth.admin -- the
# Chief Reviewer recorded it as the widest grant in Phase 3 and said it must not
# survive Checkpoint 4 quietly. That predefined role carries the whole
# firebaseauth surface: creating, updating and DELETING users, reading the
# password hash config (firebaseauth.configs.getHashConfig) and rewriting the
# sign-in configuration (firebaseauth.configs.update). The gate does none of
# those things. A compromised gate holding it could delete both members, disable
# email sign-in, or read the hash configuration.
#
# It is kept in a file of its own for the reason satellite-role.tf and
# private-roles.tf are: the permission list IS the security boundary, and a
# single-purpose file makes it reviewable as a unit and assertable by a CI guard
# (scripts/check_private_bucket_config.py).
#
# TWO PERMISSIONS, each traced to a call site in gate/app/auth.py:
#
#   firebaseauth.users.createSession
#     fb_auth.create_session_cookie(...) -- gate/app/auth.py, the mint half of
#     POST /session. This is the permission the whole private area rests on: it
#     is what exchanges a verified Firebase ID token for the 14-day __session
#     cookie (SEAM-2). Without it sign-in fails for every member.
#
#   firebaseauth.users.get
#     Both verify paths run with check_revoked=True --
#     fb_auth.verify_id_token(id_token, check_revoked=True) and
#     fb_auth.verify_session_cookie(cookie, check_revoked=check_revoked), where
#     GATE_CHECK_REVOKED defaults to True (gate/app/config.py). A revocation
#     check is not a local JWT operation: the Admin SDK fetches the user record
#     to compare tokensValidAfterTime, which is an accounts lookup and needs
#     users.get. Signature verification itself needs no permission at all -- it
#     uses Google's public certificate endpoint -- so this permission exists
#     solely for the revocation check, and dropping it would turn
#     check_revoked=True into a runtime error rather than a silent no-op.
#
# AND DELIBERATELY NOT:
#   users.create / users.update / users.delete -- the gate never mutates a user.
#     Identity Platform creates the user on email-link sign-in, in the browser.
#   users.sendEmail -- the sign-in page sends the link through the Web SDK; the
#     gate never sends mail.
#   configs.* -- the gate reads no sign-in configuration and writes none.
#     configs.getHashConfig and configs.getSecret in particular are credential
#     material and have no business being reachable from a request handler.
#
# VERIFIED AGAINST A PRIMARY SOURCE, not copied from documentation. Against THIS
# project:
#   gcloud iam list-testable-permissions \
#     //cloudresourcemanager.googleapis.com/projects/<project id> \
#     --filter="name:firebaseauth"
# returns 11 firebaseauth permissions, all stage GA, and both permissions below
# are in that list. Custom-role support was confirmed the same way rather than
# assumed: across all 13,673 testable permissions on this project the API emits
# customRolesSupportLevel for 470 of them (70 NOT_SUPPORTED, 400 TESTING) and
# omits it for the rest, which is how it reports SUPPORTED. It is omitted for
# both permissions here, so both may be held by a custom role. The Checkpoint 3
# runbook was wrong in exactly the way this note guards against -- a permission
# list taken from documentation that was never checked against the project --
# and only running it found out.
#
# NO NARROWER PREDEFINED ROLE EXISTS. roles/firebaseauth.viewer holds no
# createSession, and there is no predefined role between viewer and admin, which
# is why this is a custom role rather than a swap.
resource "google_project_iam_custom_role" "gate_session_minter" {
  project = var.project_id

  # role_id is camel case: "[c]annot contain `-` characters" (provider docs).
  role_id     = "gateSessionMinter"
  title       = "Gate session minter"
  description = "Mint a Firebase session cookie from a verified ID token, and read a user record to honour check_revoked. Holds no permission to create, update or delete a user, and none to read or write sign-in configuration. Bind only to the gate's Cloud Run runtime identity."

  # The launch stage of the role, not of the permissions. GA is the provider
  # default; stated so the role is not read as experimental.
  stage = "GA"

  # EXACTLY these two. See the header for the call site behind each.
  permissions = [
    "firebaseauth.users.createSession",
    "firebaseauth.users.get",
  ]

  # As on every other custom role in this module: "A deleted role is permanently
  # deleted after 7 days, but it can take up to 30 more days (i.e. between 7 and
  # 37 days after deletion) before the role name is made available again"
  # (google_project_iam_custom_role). Destroying this one would break SIGN-IN
  # for up to 37 days with no way to apply out of it. Revoking access does not
  # need the role destroyed: remove the BINDING in gate.tf, which is instant and
  # reversible.
  deletion_policy = "PREVENT"

  depends_on = [google_project_service.phase3]
}
