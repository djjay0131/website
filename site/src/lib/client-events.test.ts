import { describe, it, expect, beforeEach, vi } from "vitest";
import { recordEvent, flush, stats, correlationId, __reset } from "./client-events.mjs";

describe("client event stream", () => {
  beforeEach(() => {
    __reset();
    vi.restoreAllMocks();
  });

  // THE RULE THIS MODULE EXISTS UNDER: telemetry must never throw into user
  // code. A monitoring system that can break sign-in is worse than none, and
  // this is the test that keeps that true.
  it("never throws, whatever it is handed", () => {
    const junk = [undefined, null, 0, "", Symbol("s"), () => {}, { a: { b: { c: { d: {} } } } }];
    for (const j of junk) {
      expect(() => recordEvent("x", j as never)).not.toThrow();
      expect(() => recordEvent(j as never, { ok: 1 })).not.toThrow();
    }
    expect(() => flush()).not.toThrow();
  });

  it("redacts secrets by key, at any depth", () => {
    let sent: any = null;
    vi.stubGlobal("fetch", (_u: string, init: any) => {
      sent = JSON.parse(init.body);
      return Promise.resolve({ ok: true });
    });
    recordEvent("signin_failed", {
      failure_class: "provider_disabled",
      password: "hunter2",
      idToken: "eyJhbGciOi",
      email: "djjay@vt.edu",
      nested: { secret: "s3cr3t", safe: "keep" },
    }, { immediate: true });

    const f = sent.events[0].fields;
    expect(f.failure_class).toBe("provider_disabled");
    expect(f.nested.safe).toBe("keep");
    for (const leaked of ["hunter2", "eyJhbGciOi", "djjay@vt.edu", "s3cr3t"]) {
      expect(JSON.stringify(sent)).not.toContain(leaked);
    }
  });

  it("caps the buffer instead of growing without bound", () => {
    // A dead endpoint must not turn into a memory leak in someone's tab.
    for (let i = 0; i < 200; i += 1) recordEvent("noise", { i });
    expect(stats().buffered).toBeLessThanOrEqual(50);
    expect(stats().dropped).toBeGreaterThan(0);
  });

  it("uses one correlation id for the whole page load", () => {
    const a = correlationId();
    recordEvent("one", {});
    expect(correlationId()).toBe(a);
    expect(a.length).toBeGreaterThan(8);
  });

  it("sends nothing when there is nothing buffered", () => {
    const fetchSpy = vi.fn(() => Promise.resolve({ ok: true }));
    vi.stubGlobal("fetch", fetchSpy);
    flush();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("carries the correlation id in the header and the body", () => {
    let init: any = null;
    vi.stubGlobal("fetch", (_u: string, i: any) => {
      init = i;
      return Promise.resolve({ ok: true });
    });
    recordEvent("signin_failed", { failure_class: "popup_blocked" }, { immediate: true });
    expect(init.headers["X-Trace-Id"]).toBe(correlationId());
    expect(JSON.parse(init.body).trace_id).toBe(correlationId());
  });

  it("survives an endpoint that is simply gone", () => {
    // Cloud Run returns 5xx for a few seconds during a revision rollover, and a
    // 404 forever if the rewrite is missing. Neither may surface to the user.
    vi.stubGlobal("fetch", () => Promise.reject(new Error("network down")));
    expect(() => {
      recordEvent("signin_failed", { failure_class: "network_unreachable" }, { immediate: true });
    }).not.toThrow();
  });
});
