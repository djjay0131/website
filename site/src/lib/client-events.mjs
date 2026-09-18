// A small buffered client event stream.
//
// WHY. Browser errors on this site went nowhere. Every sign-in handler used a
// bare `catch {}`, so `auth/operation-not-allowed` -- the reason the Google
// popup opened and vanished -- was discarded in the browser and never reached
// any log. Diagnosing it needed a person at a keyboard describing symptoms.
// This ships the class to the gate, which already logs in a queryable grammar.
//
// THE RULE THIS MODULE MUST NEVER BREAK: telemetry must not throw into user
// code. Every entry point swallows its own failures. A monitoring system that
// can break sign-in is worse than no monitoring system.
//
// Deliberately NOT authenticated. The failures worth capturing happen BEFORE a
// session exists -- that is the whole point -- so the endpoint accepts anonymous
// writes, and the caps below are what make that safe rather than a gift to
// anyone who finds it.

const ENDPOINT = "/client-events";
const MAX_BATCH = 20;
const MAX_PAYLOAD_CHARS = 2000;
const FLUSH_AFTER_MS = 5000;
const MAX_BUFFER = 50;

/** Never send these, whatever a caller passes. Matched case-insensitively. */
const REDACT_KEYS = ["password", "token", "idtoken", "secret", "code", "oobcode", "email"];

let buffer = [];
let timer = null;
let dropped = 0;
let traceId = "";

/** One id per page load, echoed on every event and sent to the gate. */
export function correlationId() {
  if (traceId) return traceId;
  try {
    traceId = globalThis.crypto?.randomUUID?.() ?? "";
  } catch {
    traceId = "";
  }
  if (!traceId) traceId = `nc-${Date.now().toString(36)}`;
  return traceId;
}

/** Allowlist scrub. The gate scrubs again server-side; this is defence in depth. */
function scrub(value, depth = 0) {
  if (depth > 4) return "***";
  if (value === null || typeof value !== "object") {
    const s = typeof value === "string" ? value : value;
    if (typeof s === "string" && s.length > MAX_PAYLOAD_CHARS) return s.slice(0, MAX_PAYLOAD_CHARS);
    return s;
  }
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => scrub(v, depth + 1));
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = REDACT_KEYS.some((r) => k.toLowerCase().includes(r)) ? "***" : scrub(v, depth + 1);
  }
  return out;
}

function schedule() {
  if (timer !== null) return;
  try {
    timer = globalThis.setTimeout(() => {
      timer = null;
      flush();
    }, FLUSH_AFTER_MS);
  } catch {
    timer = null;
  }
}

/**
 * Record an event. Returns nothing and throws nothing, ever.
 *
 * @param {string} event  a stable name, e.g. "signin_failed"
 * @param {object} fields queryable fields; scrubbed before they leave
 * @param {{immediate?: boolean}} opts
 */
export function recordEvent(event, fields = {}, opts = {}) {
  try {
    if (buffer.length >= MAX_BUFFER) {
      dropped += 1;
      return;
    }
    buffer.push({
      event: String(event).slice(0, 64),
      correlation_id: correlationId(),
      at: new Date().toISOString(),
      path: globalThis.location?.pathname ?? "",
      fields: scrub(fields),
    });
    if (opts.immediate) flush();
    else schedule();
  } catch {
    // Never propagate.
  }
}

/**
 * Send what is buffered. Retries exactly once, then drops the batch -- a
 * Cloud Run revision rollover can 5xx for a few seconds, and one retry survives
 * that without letting a dead endpoint grow an unbounded queue in memory.
 */
export function flush({ beacon = false } = {}) {
  let batch;
  try {
    if (buffer.length === 0) return;
    batch = buffer.splice(0, MAX_BATCH);
    const body = JSON.stringify({ trace_id: correlationId(), events: batch });

    if (beacon && typeof navigator !== "undefined" && navigator.sendBeacon) {
      // On unload only: fire-and-forget, no retry possible, no error surface.
      navigator.sendBeacon(ENDPOINT, new Blob([body], { type: "application/json" }));
      return;
    }

    const send = () =>
      fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Trace-Id": correlationId() },
        body,
        keepalive: true,
      });

    send()
      .then((r) => (r.ok ? null : send()))
      .catch(() => send().catch(() => {
        dropped += batch.length;
        try {
          console.warn(`client-events: dropped ${batch.length} event(s)`);
        } catch {
          /* ignore */
        }
      }));
  } catch {
    // Never propagate.
  }
}

/** For tests and for a status line if one is ever wanted. */
export function stats() {
  return { buffered: buffer.length, dropped };
}

/** Test seam: reset module state between cases. */
export function __reset() {
  buffer = [];
  dropped = 0;
  traceId = "";
  if (timer !== null) {
    try {
      globalThis.clearTimeout(timer);
    } catch {
      /* ignore */
    }
    timer = null;
  }
}

/** Capture what the page would otherwise swallow. Safe to call more than once. */
let installed = false;
export function installGlobalHandlers() {
  try {
    if (installed || typeof window === "undefined") return;
    installed = true;
    window.addEventListener("error", (e) => {
      recordEvent("window_error", {
        message: e?.message ?? "",
        source: e?.filename ?? "",
        line: e?.lineno ?? 0,
      });
    });
    window.addEventListener("unhandledrejection", (e) => {
      const reason = e?.reason;
      recordEvent("unhandled_rejection", {
        message: typeof reason === "string" ? reason : (reason?.message ?? ""),
        code: reason?.code ?? "",
      });
    });
    // Drain on the way out: a tab close is exactly when a buffered error is
    // about to be lost, and it is the only case sendBeacon exists for.
    const drain = () => {
      if (document.visibilityState === "hidden") flush({ beacon: true });
    };
    document.addEventListener("visibilitychange", drain);
    window.addEventListener("pagehide", () => flush({ beacon: true }));
  } catch {
    // Never propagate.
  }
}
