import { describe, it, expect } from "vitest";
import {
  AUTH_FAILURE_CLASSES,
  classifyAuthError,
  classifyEmailLinkFailure,
  classifyEmailLinkMismatch,
} from "./auth-errors.mjs";

// The codes this site can realistically see. Each one is here because it is a
// DIFFERENT thing for the person reading the screen to do about it.
const KNOWN = [
  "auth/operation-not-allowed",
  "auth/popup-blocked",
  "auth/popup-closed-by-user",
  "auth/cancelled-popup-request",
  "auth/unauthorized-domain",
  "auth/network-request-failed",
  "auth/too-many-requests",
  "auth/invalid-email",
  "auth/missing-email",
  "auth/expired-action-code",
  "auth/invalid-action-code",
  "auth/invalid-credential",
  "auth/user-disabled",
];

describe("sign-in failure classification", () => {
  it("classifies the code that actually bit us", () => {
    // The Google popup opened and vanished. The page said "cancelled or did not
    // complete", which sent the owner looking at their own browser instead of at
    // the missing provider. This is the regression test for that afternoon.
    const { failureClass, message } = classifyAuthError({ code: "auth/operation-not-allowed" });
    expect(failureClass).toBe("provider_disabled");
    expect(message).toMatch(/not enabled/i);
    expect(message).toMatch(/email link/i);
  });

  it("gives every known code a class that is not 'unknown'", () => {
    for (const code of KNOWN) {
      const { failureClass } = classifyAuthError({ code });
      expect(failureClass, code).not.toBe("unknown");
    }
  });

  it("only ever returns a class from the closed vocabulary", () => {
    const codes = [...KNOWN, "auth/internal-error", "", "auth/not-a-real-code"];
    for (const code of codes) {
      expect(AUTH_FAILURE_CLASSES, code).toContain(classifyAuthError({ code }).failureClass);
    }
    expect(AUTH_FAILURE_CLASSES).toContain(classifyEmailLinkMismatch().failureClass);
  });

  it("keeps an unknown code for the log, but not in the reader's message", () => {
    const { failureClass, message, code } = classifyAuthError({ code: "auth/internal-error" });
    expect(failureClass).toBe("unknown");
    // The raw code survives so the map can be extended from real traffic...
    expect(code).toBe("auth/internal-error");
    // ...but is not shown, because nobody can act on it.
    expect(message).not.toContain("auth/");
  });

  it("survives being handed something that is not a Firebase error", () => {
    for (const thrown of [undefined, null, "boom", 42, new Error("boom"), {}]) {
      const r = classifyAuthError(thrown as never);
      expect(AUTH_FAILURE_CLASSES).toContain(r.failureClass);
      expect(r.message.length).toBeGreaterThan(0);
    }
  });

  it("always gives the reader something to DO", () => {
    // "Sign-in failed" is true and useless. Every message must be actionable or
    // must say plainly that the reader cannot fix it.
    for (const code of KNOWN) {
      const { message } = classifyAuthError({ code });
      expect(message.length, code).toBeGreaterThan(20);
      expect(message, code).toMatch(/try again|use the email link|wait|enter|allow|request a new|cannot|not something you can fix/i);
    }
  });

  it("distinguishes a link sent to a different address from an expired one", () => {
    // Firebase reports both as invalid-action-code; they need different advice.
    expect(classifyAuthError({ code: "auth/invalid-action-code" }).failureClass).toBe("link_expired");
    expect(classifyEmailLinkMismatch().failureClass).toBe("link_wrong_email");
    expect(classifyEmailLinkMismatch().message).toMatch(/different email/i);
  });

  it("never leaks an email address or a token through the message", () => {
    const r = classifyAuthError({ code: "auth/invalid-email", customData: { email: "djjay@vt.edu" } });
    expect(r.message).not.toMatch(/@/);
  });
});

describe("the email-link return leg, which fooled us in production", () => {
  const invalid = { code: "auth/invalid-action-code" };

  it("only claims 'wrong email' when there is something to compare against", () => {
    // THE PRODUCTION BUG. With nothing remembered, the old inline check compared
    // a typed address against null -- always unequal -- so an expired link was
    // reported as a wrong address. This is the regression test for that.
    const r = classifyEmailLinkFailure(invalid, { remembered: null, used: "djjay@vt.edu" });
    expect(r.failureClass).toBe("link_expired");
    expect(r.certain).toBe(false);
    expect(r.message).toMatch(/expired/i);
    expect(r.message).toMatch(/different address/i);
  });

  it("does claim 'wrong email' when the remembered address really differs", () => {
    const r = classifyEmailLinkFailure(invalid, {
      remembered: "someone@example.edu",
      used: "djjay@vt.edu",
    });
    expect(r.failureClass).toBe("link_wrong_email");
    expect(r.certain).toBe(true);
  });

  it("treats a matching remembered address as an ordinary expired link", () => {
    const r = classifyEmailLinkFailure(invalid, {
      remembered: "djjay@vt.edu",
      used: "djjay@vt.edu",
    });
    expect(r.failureClass).toBe("link_expired");
  });

  it("passes non-link errors through to the ordinary classifier", () => {
    const r = classifyEmailLinkFailure({ code: "auth/network-request-failed" }, { remembered: null });
    expect(r.failureClass).toBe("network_unreachable");
  });

  it("never invents a class outside the closed vocabulary", () => {
    for (const err of [invalid, { code: "auth/whatever" }, null, "boom"]) {
      for (const remembered of [null, "", "a@b.c"]) {
        const r = classifyEmailLinkFailure(err, { remembered, used: "x@y.z" });
        expect(AUTH_FAILURE_CLASSES).toContain(r.failureClass);
      }
    }
  });
});
