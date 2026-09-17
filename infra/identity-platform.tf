# Identity Platform (design doc §8; ADR-0004 decision 2; roadmap
# §phase-3-private-area "Identity Platform with Google and email-link sign-in").
#
# This resource configures sign-in for the project. It is the thing that lets a
# member obtain a Firebase ID token, which the gate then exchanges for the
# `__session` cookie (SEAM-2).
#
# TWO MANUAL STEPS TERRAFORM CANNOT DO. Both are in README.md §Phase 3 manual
# steps, in order, and both are one-way enough to matter (contract open question
# (b)):
#
# 1. IDENTITY PLATFORM MUST BE ENABLED IN THE MARKETPLACE FIRST. The provider is
#    explicit: "You must enable the Google Identity Platform in the marketplace
#    prior to using this resource" (google_identity_platform_config /
#    google_identity_platform_default_supported_idp_config). Enabling the
#    identitytoolkit API alone is not the same action. An apply run before that
#    click fails, and it fails at this resource -- not silently.
#
# 2. GOOGLE SIGN-IN IS ENABLED BY HAND, NOT HERE, AND THAT IS DELIBERATE.
#    The Terraform resource for a Google provider is
#    google_identity_platform_default_supported_idp_config, and its arguments
#    `client_id` and `client_secret` are BOTH REQUIRED. That means a long-lived
#    OAuth client secret in terraform.tfvars and in Terraform state -- exactly
#    the class of credential design doc §12.2 forbids ("No long-lived cloud
#    keys... A JSON key file anywhere in a repo or in GitHub secrets is a review
#    failure") and the one this whole phase is careful about. Enabling Google
#    sign-in in the Firebase console provisions the OAuth client on the project's
#    own behalf and hands this repository no secret at all.
#    So: no idp_config resource exists in this module, on purpose. If a future
#    change adds one, it must first answer where the secret lives.
#
# Also note what this resource IS: "This entity is created only once during
# intialization and cannot be deleted, individual Identity Providers may be
# disabled instead. This resource may only be created in billing-enabled
# projects" (provider docs). A `terraform destroy` therefore removes it from
# state and leaves the configuration in place. That is recorded in README.md
# §Rollback rather than discovered during one.

resource "google_identity_platform_config" "hub" {
  project = var.project_id

  # EMAIL-LINK SIGN-IN, which is half of what the roadmap asks for.
  #
  # password_required = false is the setting that enables it, and its meaning is
  # not obvious from its name: "Whether a password is required for email auth or
  # not. If true, both an email and password must be provided to sign in. If
  # false, a user may sign in via either email/password or email link"
  # (provider docs). false is therefore the permissive-by-method setting, not a
  # weakening of anything: who may sign in is decided by the Firestore allowlist
  # (SEAM-3), never by the sign-in method. A stranger may hold a perfectly valid
  # token and still get "not shared with you".
  #
  # Email link also matters for the seed members specifically: the owner's
  # allowlisted identity is djjay@vt.edu, and email-link is the route that does
  # not depend on which Google account a browser happens to be signed in to
  # (STATE §10 Q4, "the matching trap").
  sign_in {
    email {
      enabled           = true
      password_required = false
    }

    # allow_duplicate_emails is left at its default (false), so one email is one
    # account. With an allowlist keyed on the email, two accounts sharing an
    # address would mean two identities matching one allowlist entry.

    # Declared explicitly because the API RETURNS this block whether or not the
    # configuration asks for it, and an undeclared block reads to Terraform as
    # "remove it" -- so every apply updated this resource in place for no reason
    # (issue #30). Phone sign-in stays OFF: the allowlist is keyed on email
    # addresses, and a phone identity could never match an entry in it.
    phone_number {
      enabled            = false
      test_phone_numbers = {}
    }
  }

  # AUTHORIZED DOMAINS -- the Checkpoint 4 trap this line exists to prevent.
  #
  # Identity Platform accepts a sign-in (and an email-link continue URL) only
  # from a domain on this list. The defaults cover localhost and the project's
  # own *.firebaseapp.com / *.web.app hosts, but NOT a custom domain, so a
  # member signing in at https://jason.cusati.us would be refused by the SDK
  # with an unauthorized-domain error that looks nothing like a domain problem.
  #
  # The list is authoritative, not additive: whatever is written here replaces
  # the project's list, so the defaults are restated rather than assumed. The
  # two *.firebaseapp.com / *.web.app entries are kept because the Firebase SDK
  # uses the project's auth domain during the sign-in handshake, and localhost
  # is kept so the sign-in page can be exercised locally by the site stream.
  #
  # var.domain is the canonical hub host (ADR-0006). Redirect domains are
  # deliberately NOT listed: research.cusati.us answers every request with a 301
  # to var.domain, so nothing ever signs in there.
  authorized_domains = [
    "localhost",
    "${var.project_id}.firebaseapp.com",
    "${var.project_id}.web.app",
    var.domain,
  ]

  depends_on = [
    google_project_service.phase3,
    google_firebase_project.hub,
  ]
}
