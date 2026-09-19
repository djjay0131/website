// THE SIGN-OUT CALLER (SD-4; Chief Reviewer finding B-8).
//
// WHY THIS FILE EXISTS. The gate has owned `POST /session/end` since the
// gate-signout branch, `firebase.json` has carried its Hosting rewrite since the
// site-wave-0 branch, and 43 tests stand behind the handler -- and until this
// file, NOTHING IN site/ CALLED IT. A route, a rewrite and a test suite with no
// caller is sign-out that does not exist: a member on a shared machine still had
// no way to end a 14-day HttpOnly session. Neither stream was at fault and
// neither was out of scope; the seam between them was never routed. This is the
// caller half, and it lives under src-private/ because the control belongs in the
// members' area, which is the only place a signed-in member ever is.
//
// WHY A MODULE RATHER THAN FOUR LINES INSIDE THE LAYOUT. Three properties of
// this one call are security properties. Each is invisible in a diff, and each
// fails SILENTLY -- the member is told they signed out, and they did not:
//
//   1. IT MUST BE A POST, NEVER `<a href>` OR A GET. A GET sign-out is
//      triggerable by an `<img src>` on any page the member visits, which makes
//      "sign out" something a third party can do to them.
//
//   2. IT MUST BE SAME-ORIGIN -- a bare path, never an absolute URL to the
//      gate's `*.run.app` host. An absolute cross-origin URL makes the browser
//      send a different `Origin`, and the gate's CSRF check answers 403. The
//      call then fails for a reason that reads like a gate bug.
//
//   3. IT MUST NOT USE `mode: "no-cors"`. That is the tempting way to make the
//      resulting error go away, and it works by making the failure unreadable:
//      an opaque response has `ok === false` and status 0 forever, so the page
//      can no longer tell a refusal from a success.
//
// A module makes all three assertable by a test rather than by review, which is
// this sprint's whole lesson about guards nobody has seen fail.
//
// SEQUENCING, recorded deliberately: the gate's `Origin` check is being repaired
// concurrently because it does not currently work as intended. This call is
// same-origin, so it is correct under BOTH the broken and the repaired check, and
// nothing here is designed around the broken one.
//
// NOT "SIGN OUT EVERYWHERE". This ends the session in THIS browser by clearing
// the cookie. It does not revoke the Firebase session server-side, so a cookie
// already stolen outlives it (gate finding G-5). That is SD-4's scope as written
// -- "a member on a shared machine" -- and the wording below says exactly that
// much and no more.

/**
 * The gate's sign-out route, as a SAME-ORIGIN PATH.
 *
 * It is a path and not a URL on purpose (property 2 above). Firebase Hosting
 * rewrites `/session/end` to the gate, so this reaches the same service the
 * absolute `*.run.app` URL would -- while staying same-origin, which is the only
 * way the browser sends an `Origin` the gate will accept.
 */
export const SIGN_OUT_ENDPOINT = "/session/end";

/**
 * Where a signed-out member is sent.
 *
 * The public home page, deliberately. The members' area is served by the gate
 * under /p/ and answers a cookie-less request with "sign in required" -- so
 * staying put, or reloading /p/, would show a refusal page to someone who just
 * did the right thing. The public site is somewhere that plainly makes sense
 * signed out.
 */
export const SIGNED_OUT_DESTINATION = "/";

/**
 * What a member is told when sign-out did NOT happen.
 *
 * A member who believes they signed out and did not is worse off than one who
 * sees an error -- that is the entire reason SD-4 exists. So the failure is
 * stated plainly, says what is still true ("you are still signed in"), and gives
 * the one remedy that always works.
 */
export const SIGN_OUT_FAILED_MESSAGE =
  "Sign-out failed — you are still signed in. Try again; if it keeps failing, " +
  "close every window of this browser.";

/**
 * The request init, in one place.
 *
 * EXACTLY two keys. No body, no token, no custom header -- a custom header would
 * make the request preflighted, and the gate answers no preflight. No `mode`:
 * see property 3 above. `signout.test.ts` asserts the key set itself, so adding
 * a fourth key is a failing test rather than a review comment.
 *
 * @returns {{method: "POST", credentials: "same-origin"}}
 */
export function signOutRequestInit() {
  return { method: "POST", credentials: "same-origin" };
}

/**
 * Sign the member out, and make a failure visible.
 *
 * Redirects ONLY on a success the gate actually confirmed. Every other
 * outcome -- a refusal, an unreachable gate, a thrown fetch -- leaves the member
 * where they are and reports it, because a redirect is indistinguishable from
 * success to the person watching.
 *
 * @param {{
 *   fetch?: typeof globalThis.fetch,
 *   location?: {assign: (url: string) => void},
 *   onStart?: () => void,
 *   onFailure?: (message: string, detail: {reason: string, status?: number, error?: unknown}) => void,
 * }} [deps] injected for testing; defaults are the browser's own
 * @returns {Promise<{ok: boolean, reason?: string, status?: number}>}
 */
export async function signOut(deps = {}) {
  const fetchImpl = deps.fetch ?? globalThis.fetch;
  const location = deps.location ?? globalThis.location;
  const onStart = deps.onStart ?? (() => {});
  const onFailure = deps.onFailure ?? (() => {});

  onStart();

  let response;
  try {
    response = await fetchImpl(SIGN_OUT_ENDPOINT, signOutRequestInit());
  } catch (error) {
    // The gate was not reached at all. NOT swallowed: this is the case where a
    // silent failure would leave a live session behind a member who walked away.
    onFailure(SIGN_OUT_FAILED_MESSAGE, { reason: "unreachable", error });
    return { ok: false, reason: "unreachable" };
  }

  if (!response?.ok) {
    // 403 means the gate refused the Origin -- which should be impossible from a
    // same-origin call, and is therefore exactly the thing worth surfacing. 404
    // means the Hosting rewrite for /session/end is missing, which is the other
    // half of this seam.
    onFailure(SIGN_OUT_FAILED_MESSAGE, { reason: "refused", status: response?.status ?? 0 });
    return { ok: false, reason: "refused", status: response?.status ?? 0 };
  }

  location.assign(SIGNED_OUT_DESTINATION);
  return { ok: true };
}
