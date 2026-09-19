import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  SIGNED_OUT_DESTINATION,
  SIGN_OUT_ENDPOINT,
  SIGN_OUT_FAILED_MESSAGE,
  signOut,
  signOutRequestInit,
} from "./signout.mjs";

// ===========================================================================
// SD-4 / B-8: the caller that did not exist
// ===========================================================================
// The gate's handler, its Hosting rewrite and its 43 tests were all in place
// while NOTHING in site/ called /session/end. These tests pin the caller, and in
// particular the three ways of writing it that would ship a sign-out which looks
// right and is not:
//
//   - an <a href> or a GET   -> triggerable by an <img> tag on any page
//   - an absolute run.app URL -> cross-origin, refused by the gate with 403
//   - mode: "no-cors"         -> makes the failure unreadable rather than absent
//
// If someone deletes this file to make a change pass, that is the signal.

/** A fetch stand-in that records exactly what it was called with. */
function recordingFetch(result: unknown) {
  const calls: { url: unknown; init: unknown }[] = [];
  const impl = async (url: unknown, init: unknown) => {
    calls.push({ url, init });
    if (result instanceof Error) throw result;
    return result as Response;
  };
  return { calls, impl: impl as unknown as typeof globalThis.fetch };
}

function recordingLocation() {
  const assigned: string[] = [];
  return { assigned, location: { assign: (url: string) => void assigned.push(url) } };
}

describe("the call itself is the one the gate accepts", () => {
  it("POSTs to the gate's own path, same-origin", async () => {
    const { calls, impl } = recordingFetch({ ok: true, status: 200 });
    const { location } = recordingLocation();

    await signOut({ fetch: impl, location });

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("/session/end");
    expect(calls[0].init).toEqual({ method: "POST", credentials: "same-origin" });
  });

  it("is a POST and never a GET", () => {
    // A GET sign-out is triggerable by <img src="/session/end"> on any page the
    // member visits, which hands a third party the ability to sign them out.
    expect(signOutRequestInit().method).toBe("POST");
    expect(signOutRequestInit().method).not.toBe("GET");
  });

  it("names a same-origin PATH, never the gate's *.run.app host", () => {
    // An absolute URL to the Cloud Run host makes the request cross-origin: the
    // browser sends a different Origin and the gate refuses with 403.
    expect(SIGN_OUT_ENDPOINT.startsWith("/")).toBe(true);
    expect(SIGN_OUT_ENDPOINT).not.toMatch(/^https?:/);
    expect(SIGN_OUT_ENDPOINT).not.toContain("run.app");
    expect(SIGN_OUT_ENDPOINT).not.toContain("//");
  });

  it("sends no body, no token, no custom header and no mode", () => {
    // EXACTLY these two keys. A custom header would make the request
    // preflighted, and the gate answers no preflight; `mode: "no-cors"` would
    // make every response opaque, so the page could no longer tell a refusal
    // from a success.
    expect(Object.keys(signOutRequestInit()).sort()).toEqual(["credentials", "method"]);
    expect(signOutRequestInit()).not.toHaveProperty("mode");
    expect(signOutRequestInit()).not.toHaveProperty("body");
    expect(signOutRequestInit()).not.toHaveProperty("headers");
  });
});

describe("a member who signed out lands somewhere that makes sense signed out", () => {
  it("goes to the public site, not back into the members' area", async () => {
    const { impl } = recordingFetch({ ok: true, status: 200 });
    const { assigned, location } = recordingLocation();

    const outcome = await signOut({ fetch: impl, location });

    expect(outcome).toEqual({ ok: true });
    expect(assigned).toEqual([SIGNED_OUT_DESTINATION]);
    // /p/ answers a cookie-less request with "sign in required", so sending them
    // there would show a refusal page to someone who just did the right thing.
    expect(SIGNED_OUT_DESTINATION.startsWith("/p/")).toBe(false);
  });
});

describe("a FAILED sign-out is visible, never silent", () => {
  // The member who believes they signed out and did not is the person SD-4
  // exists for. Every failure path below must (a) report, and (b) NOT redirect --
  // a redirect is indistinguishable from success to the person watching.

  it("reports a refusal and does not redirect", async () => {
    const { impl } = recordingFetch({ ok: false, status: 403 });
    const { assigned, location } = recordingLocation();
    const failures: { message: string; detail: { reason: string; status?: number } }[] = [];

    const outcome = await signOut({
      fetch: impl,
      location,
      onFailure: (message, detail) => void failures.push({ message, detail }),
    });

    expect(outcome).toEqual({ ok: false, reason: "refused", status: 403 });
    expect(assigned).toEqual([]);
    expect(failures).toHaveLength(1);
    expect(failures[0].message).toBe(SIGN_OUT_FAILED_MESSAGE);
    expect(failures[0].detail.status).toBe(403);
  });

  it("reports a missing rewrite (404) and does not redirect", async () => {
    // The other half of this seam: if /session/end has no Hosting rewrite it is
    // answered by the STATIC site, which 404s. Sign-out then fails through the
    // CDN only, while every direct *.run.app test still passes.
    const { impl } = recordingFetch({ ok: false, status: 404 });
    const { assigned, location } = recordingLocation();
    const failures: unknown[] = [];

    const outcome = await signOut({ fetch: impl, location, onFailure: (m) => void failures.push(m) });

    expect(outcome.ok).toBe(false);
    expect(outcome.status).toBe(404);
    expect(assigned).toEqual([]);
    expect(failures).toEqual([SIGN_OUT_FAILED_MESSAGE]);
  });

  it("reports an unreachable gate and does not redirect", async () => {
    const { impl } = recordingFetch(new TypeError("Failed to fetch"));
    const { assigned, location } = recordingLocation();
    const failures: unknown[] = [];

    const outcome = await signOut({ fetch: impl, location, onFailure: (m) => void failures.push(m) });

    expect(outcome).toEqual({ ok: false, reason: "unreachable" });
    expect(assigned).toEqual([]);
    expect(failures).toEqual([SIGN_OUT_FAILED_MESSAGE]);
  });

  it("says the member is still signed in, and claims nothing about other browsers", () => {
    expect(SIGN_OUT_FAILED_MESSAGE).toMatch(/still signed in/i);
    // Gate finding G-5: this clears the cookie in THIS browser and does not
    // revoke server-side. It must never be described as "sign out everywhere".
    expect(SIGN_OUT_FAILED_MESSAGE).not.toMatch(/everywhere/i);
  });
});

// ===========================================================================
// The control is REACHABLE -- the half B-8 was actually about
// ===========================================================================
describe("the members' layout actually renders the control and calls this module", () => {
  const LAYOUT = path.resolve("src-private/layouts/PrivateBase.astro");
  const layout = fs.readFileSync(LAYOUT, "utf8");

  it("every private page carries a sign-out control, because they all use this layout", () => {
    expect(fs.existsSync(LAYOUT)).toBe(true);
    expect(layout).toMatch(/id="sign-out"/);
    expect(layout).toMatch(/<button[^>]*id="sign-out"/);
  });

  it("wires the button to this module rather than re-implementing the call", () => {
    expect(layout).toMatch(/signout\.mjs/);
    expect(layout).toMatch(/\bsignOut\b/);
  });

  it("contains none of the three shapes that would ship a broken sign-out", () => {
    // A link/GET, an absolute run.app URL, or no-cors. Asserted against the
    // layout's own bytes because these are exactly the edits that look harmless.
    expect(layout).not.toMatch(/<a[^>]+href="[^"]*session\/end/);
    expect(layout).not.toContain("run.app");
    expect(layout).not.toContain("no-cors");
    // The endpoint string belongs to signout.mjs; the layout must not spell its
    // own copy, or the two can drift.
    expect(layout).not.toContain('"/session/end"');
  });

  it("gives the failure somewhere to be seen", () => {
    expect(layout).toMatch(/id="sign-out-error"/);
    expect(layout).toMatch(/role="alert"/);
  });
});
