// Firebase sign-in failures, classified into a CLOSED VOCABULARY.
//
// WHY THIS EXISTS. Every handler in the sign-in page used a bare `catch {}` and
// replaced the real error with one generic sentence. The Google button opening a
// popup that vanished was `auth/operation-not-allowed` -- no provider configured
// -- and the page said "Sign-in was cancelled or did not complete." That single
// swallowed code cost an afternoon of interactive troubleshooting: the owner
// could not tell a misconfiguration from a mis-click, and neither could I.
//
// The pattern is taken from a sibling project, where one button failed in four
// indistinguishable ways: classify into named classes, emit one structured line
// per class, meter and alert on the class, and show a class-specific message.
// The same mapping drives BOTH the user-facing sentence and the log label, so
// they can never drift apart.
//
// Dependency-free and pure so it can be unit-tested without a browser or a
// Firebase project, and so the gate could reuse it if it ever needs to.

/** Every class this module can return. Adding a code means adding it here. */
export const AUTH_FAILURE_CLASSES = Object.freeze([
  "provider_disabled",
  "popup_blocked",
  "popup_dismissed",
  "unauthorized_domain",
  "network_unreachable",
  "rate_limited",
  "invalid_email",
  "link_expired",
  "link_wrong_email",
  "not_allowed_here",
  "unknown",
]);

// code -> [class, what the person reading the screen should do next]
//
// The messages say what to DO. "Sign-in failed" is what we had; it is true and
// useless. They also reveal nothing about who is allowed in or what is behind
// the gate -- a stranger seeing these learns only that sign-in exists.
const BY_CODE = new Map(Object.entries({
  "auth/operation-not-allowed": [
    "provider_disabled",
    "That sign-in method is not enabled for this site yet. Use the email link instead.",
  ],
  "auth/popup-blocked": [
    "popup_blocked",
    "Your browser blocked the sign-in popup. Allow popups for this site, or use the email link.",
  ],
  "auth/popup-closed-by-user": [
    "popup_dismissed",
    "The sign-in window closed before it finished. Try again.",
  ],
  "auth/cancelled-popup-request": [
    "popup_dismissed",
    "The sign-in window closed before it finished. Try again.",
  ],
  "auth/unauthorized-domain": [
    "unauthorized_domain",
    "This site is not an authorised sign-in domain. This is a configuration fault, not something you can fix.",
  ],
  "auth/network-request-failed": [
    "network_unreachable",
    "Could not reach the sign-in service. Check your connection and try again.",
  ],
  "auth/too-many-requests": [
    "rate_limited",
    "Too many attempts. Wait a few minutes and try again.",
  ],
  "auth/invalid-email": [
    "invalid_email",
    // Caught by its own test: the first version of this line read "That does not
    // look like a valid email address." -- true, and useless. Every message here
    // has to say what to DO next.
    "That does not look like a valid email address. Check it and try again.",
  ],
  "auth/missing-email": [
    "invalid_email",
    "Enter the email address you want the link sent to.",
  ],
  "auth/expired-action-code": [
    "link_expired",
    "That sign-in link has expired. Request a new one.",
  ],
  "auth/invalid-action-code": [
    "link_expired",
    "That sign-in link has already been used, or is not valid. Request a new one.",
  ],
  "auth/invalid-credential": [
    "link_expired",
    "That sign-in link is not valid any more. Request a new one.",
  ],
  "auth/user-disabled": [
    "not_allowed_here",
    "That account cannot sign in.",
  ],
}));

/**
 * Classify a Firebase error (or anything else that was thrown).
 *
 * Returns { failureClass, message, code }. `code` is the raw Firebase code when
 * there was one, for the log line only -- it is deliberately NOT put in front of
 * the reader, who cannot act on "auth/internal-error".
 */
export function classifyAuthError(error) {
  const code = typeof error?.code === "string" ? error.code : "";
  const known = BY_CODE.get(code);
  if (known) {
    return { failureClass: known[0], message: known[1], code };
  }
  return {
    failureClass: "unknown",
    // An unknown class is a gap in this map, not a dead end for the reader:
    // it is logged with its raw code so the map can be extended.
    message: "Sign-in did not complete. Please try again.",
    code: code || "none",
  };
}

/**
 * Classify a failure on the email-link RETURN leg.
 *
 * Firebase reports "link was for a different address" and "link expired or was
 * already used" with the SAME code, auth/invalid-action-code. The only thing
 * that can tell them apart is whether we remembered which address the link was
 * requested for -- and often we did not, because the link was opened in a
 * different browser from the one that asked for it.
 *
 * THIS FUNCTION EXISTS BECAUSE THE FIRST VERSION GOT IT WRONG, IN PRODUCTION.
 * The check was inline in the sign-in page and read, in effect,
 * `used !== localStorage.getItem(KEY)`. With nothing in storage that compares a
 * typed address against null and is ALWAYS true, so every invalid code with
 * empty storage was reported as "wrong email address" -- including a link that
 * had simply expired four hours earlier, which is what actually happened. The
 * observability caught it; the heuristic was untested because it lived inline in
 * an .astro file, which is why it now lives here.
 *
 * @param error      what Firebase threw
 * @param remembered the address we had stored, or null if we had none
 * @param used       the address actually offered to signInWithEmailLink
 */
export function classifyEmailLinkFailure(error, { remembered = null, used = "" } = {}) {
  const code = typeof error?.code === "string" ? error.code : "";
  const invalid = code === "auth/invalid-action-code";
  const haveComparison = typeof remembered === "string" && remembered !== "";

  if (invalid && haveComparison && used !== remembered) {
    // The only case where "wrong address" is a claim rather than a guess.
    return { ...classifyEmailLinkMismatch(), certain: true };
  }

  if (invalid && !haveComparison) {
    // Genuinely ambiguous. Say so, rather than pick one and sound sure.
    return {
      failureClass: "link_expired",
      message:
        "That sign-in link did not work. It may have expired, already been used, " +
        "or been sent to a different address. Request a new one.",
      code,
      certain: false,
    };
  }

  return { ...classifyAuthError(error), certain: true };
}

/**
 * The email-link return leg fails in one way the codes above do not cover: the
 * link is valid but was requested for a DIFFERENT address than the one being
 * offered. Firebase reports that as invalid-action-code, indistinguishable from
 * an expired link, so the caller disambiguates before classifying.
 */
export function classifyEmailLinkMismatch() {
  return {
    failureClass: "link_wrong_email",
    message:
      "That link was sent to a different email address. Enter the address the link was sent to.",
    code: "hub/email-mismatch",
  };
}
