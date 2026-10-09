import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  ALL_SCOPE,
  ANNOTATION_ENDPOINT,
  DEFAULT_INTENT,
  INTENTS,
  LIMITS,
  INTENT_PREFERENCE_KEY,
  SELECTOR_CONTEXT,
  annotationCreateRequestInit,
  annotationDeleteEndpoint,
  annotationDeleteRequestInit,
  annotationListEndpoint,
  annotationListRequestInit,
  annotationsView,
  buildTextIndex,
  createAnnotation,
  deleteAnnotation,
  filterNotes,
  groupNotesByItem,
  isIntent,
  isOrphanNote,
  isSafeItemIdentity,
  isSafeSegment,
  listAnnotations,
  locateOffset,
  normalizeIntent,
  noteItemKey,
  offsetsForRange,
  parseRouting,
  resolveAnchor,
  resolveNote,
  routeForIntent,
  routeNote,
  selectorFromOffsets,
  selectorFromRangeInIndex,
  validateNoteInput,
} from "./annotations.mjs";

// ===========================================================================
// The annotation capture island's pure logic (AN-CAP, AN-STORE, AN-USE,
// AN-EXPORT; contract site-wave-6, requirements 1 and 2).
// ===========================================================================
// Everything the islands and the export renderer decide is pinned here, without
// a DOM and without the network. If someone deletes this file to make a change
// pass, that is the signal.

const ROUTING_FILE = path.resolve("notes-routing.json");

function recordingFetch(result: unknown) {
  const calls: { url: unknown; init: any }[] = [];
  const impl = async (url: unknown, init: unknown) => {
    calls.push({ url, init });
    if (result instanceof Error) throw result;
    return result as Response;
  };
  return { calls, impl: impl as unknown as typeof globalThis.fetch };
}

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

/** A minimal node-like text tree, so the index is testable without a DOM. */
function textNode(value: string, parent: any = null) {
  return { nodeType: 3, nodeValue: value, childNodes: [], parentNode: parent };
}
function element(children: any[]) {
  const node: any = { nodeType: 1, nodeValue: null, childNodes: children, parentNode: null };
  for (const child of children) child.parentNode = node;
  return node;
}

// ---------------------------------------------------------------------------
// Endpoints and request shapes
// ---------------------------------------------------------------------------
describe("every annotation call is same-origin and shaped the way the gate expects", () => {
  it("names a bare /annotations path and NO private route, so the island can ship publicly (D20)", () => {
    expect(ANNOTATION_ENDPOINT).toBe("/annotations");
    expect(ANNOTATION_ENDPOINT.startsWith("/")).toBe(true);
    expect(ANNOTATION_ENDPOINT).not.toMatch(/^https?:/);
    expect(ANNOTATION_ENDPOINT).not.toContain("run.app");
    // The shared logic must not name the private My notes route (/p/notes/);
    // that constant lives with the private-only My notes surface. If it were
    // here, the public island bundle would carry it and the leak check would
    // (correctly) refuse to publish.
    expect(INTENT_PREFERENCE_KEY).toBe("hub:annotation-intent");
    expect(INTENT_PREFERENCE_KEY).not.toContain("hub:annotation:");
  });

  it("GET is a same-origin read; the scope switch and filters are query params", () => {
    expect(annotationListRequestInit()).toEqual({ method: "GET", credentials: "same-origin" });
    expect(annotationListEndpoint()).toBe("/annotations");
    expect(annotationListEndpoint({ scope: ALL_SCOPE })).toBe("/annotations?scope=all");
    expect(annotationListEndpoint({ intent: "paper", source: "phd-milestones", slug: "milestones" })).toBe(
      "/annotations?intent=paper&source=phd-milestones&slug=milestones",
    );
  });

  it("POST /annotations sends EXACTLY the AN-STORE body, and NEVER a member", async () => {
    const selector = { exact: "hello", prefix: "say ", suffix: " now" };
    const init = annotationCreateRequestInit({
      section: "phd",
      source: "phd-milestones",
      slug: "milestones",
      selector,
      position: { start: 4, end: 9 },
      quote: "hello",
      comment: "note",
      intent: "paper",
      tags: [],
      member: "someone@else",
    });
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("same-origin");
    expect(init.headers).toEqual({ "Content-Type": "application/json" });
    const body = JSON.parse(String(init.body));
    expect(Object.keys(body).sort()).toEqual([
      "comment",
      "intent",
      "position",
      "quote",
      "section",
      "selector",
      "slug",
      "source",
      "tags",
    ]);
    expect(body).not.toHaveProperty("member");
    expect(body.selector).toEqual({ type: "TextQuoteSelector", exact: "hello", prefix: "say ", suffix: " now" });
  });

  it("DELETE goes to /annotations/<id>, encoded, and only there", async () => {
    expect(annotationDeleteRequestInit()).toEqual({ method: "DELETE", credentials: "same-origin" });
    expect(annotationDeleteEndpoint("a/b c")).toBe("/annotations/a%2Fb%20c");
  });
});

// ---------------------------------------------------------------------------
// Selector construction
// ---------------------------------------------------------------------------
describe("selector construction from offsets, text and a Range", () => {
  // 80 characters, so a middle selection has a full 32 characters on each side.
  const TEXT = Array.from({ length: 80 }, (_, i) => String.fromCharCode(97 + (i % 26))).join("");

  it("takes up to SELECTOR_CONTEXT characters of prefix and suffix", () => {
    const selector = selectorFromOffsets(TEXT, 40, 44);
    expect(selector.exact).toBe(TEXT.slice(40, 44));
    expect(selector.start).toBe(40);
    expect(selector.end).toBe(44);
    expect(selector.prefix).toHaveLength(SELECTOR_CONTEXT);
    expect(selector.suffix).toHaveLength(SELECTOR_CONTEXT);
    expect(selector.prefix).toBe(TEXT.slice(40 - SELECTOR_CONTEXT, 40));
    expect(selector.suffix).toBe(TEXT.slice(44, 44 + SELECTOR_CONTEXT));
  });

  it("clamps out-of-range offsets instead of throwing", () => {
    expect(selectorFromOffsets(TEXT, -5, 9999).start).toBe(0);
    expect(selectorFromOffsets(TEXT, -5, 9999).end).toBe(TEXT.length);
    expect(selectorFromOffsets(TEXT, 8, 2).exact).toBe("");
  });

  it("builds a selector from a Range and a node-like text tree", () => {
    const root = element([textNode("alpha "), element([textNode("bravo")]), textNode(" charlie")]);
    const index = buildTextIndex(root);
    expect(index.text).toBe("alpha bravo charlie");
    const bravo = index.segments.find((s) => String(s.node.nodeValue) === "bravo");
    const range = {
      startContainer: bravo!.node,
      startOffset: 0,
      endContainer: bravo!.node,
      endOffset: 5,
    };
    const selector = selectorFromRangeInIndex(range, index);
    expect(selector).toEqual({
      exact: "bravo",
      prefix: "alpha ",
      suffix: " charlie",
      start: 6,
      end: 11,
    });
  });

  it("resolves an element container offset by the children before it", () => {
    const root = element([textNode("ab"), textNode("cd"), textNode("ef")]);
    const index = buildTextIndex(root);
    // Offset 2 on the root element = after the first two text nodes = "abcd".
    const range = { startContainer: root, startOffset: 0, endContainer: root, endOffset: 2 };
    expect(offsetsForRange(range, index)).toEqual({ start: 0, end: 4 });
    // Locate offset 5, inside "ef".
    const located = locateOffset(index, 5);
    expect(String(located!.node.nodeValue)).toBe("ef");
    expect(located!.offset).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Quote fallback resolution: exact -> prefix/suffix -> position
// ---------------------------------------------------------------------------
describe("anchoring resolves by exact, then context, then position, and orphans nothing else", () => {
  it("anchors a unique exact match", () => {
    expect(resolveAnchor({ exact: "bravo" }, null, "alpha bravo charlie")).toEqual({
      state: "anchored",
      via: "exact",
      start: 6,
      end: 11,
    });
  });

  it("disambiguates a repeated quote with the prefix", () => {
    const text = "alpha bravo x bravo charlie";
    const anchor = resolveAnchor({ exact: "bravo", prefix: "alpha " }, null, text);
    expect(anchor).toEqual({ state: "anchored", via: "context", start: 6, end: 11 });
  });

  it("disambiguates a repeated quote with the suffix", () => {
    const text = "bravo charlie x bravo delta";
    const anchor = resolveAnchor({ exact: "bravo", suffix: " delta" }, null, text);
    expect(anchor.state).toBe("anchored");
    expect(anchor.via).toBe("context");
    expect(anchor.start).toBe(16);
  });

  it("falls back to position when the quote is ambiguous and context does not help", () => {
    const text = "bravo x bravo";
    const anchor = resolveAnchor({ exact: "bravo" }, { start: 8, end: 13 }, text);
    expect(anchor).toEqual({ state: "anchored", via: "position", start: 8, end: 13 });
  });

  it("does NOT resurrect an absent quote from position alone (AN-CAP 6)", () => {
    // A quote that no longer resolves is an orphan even when a position is
    // stored: position can disambiguate a present quote, not invent a missing one.
    const text = "the new text here";
    expect(resolveAnchor({ exact: "old" }, { start: 4, end: 7 }, text)).toEqual({
      state: "orphan",
      via: null,
      start: null,
      end: null,
    });
  });

  it("is an orphan when neither the quote nor a valid position resolves", () => {
    expect(resolveAnchor({ exact: "gone" }, { start: 0, end: 4 }, "the new text")).toEqual({
      state: "orphan",
      via: null,
      start: null,
      end: null,
    });
    expect(resolveAnchor({ exact: "" }, null, "anything")).toEqual({
      state: "orphan",
      via: null,
      start: null,
      end: null,
    });
    // A position that does not actually spell the quote is not a match.
    expect(resolveAnchor({ exact: "gone" }, { start: 1, end: 5 }, "the new text").state).toBe("orphan");
  });

  it("resolveNote decorates the note and never drops it", () => {
    const note = { selector: { exact: "new" }, position: { start: 4, end: 7 } };
    expect(resolveNote(note, "the new text")).toMatchObject({
      anchor: "anchored",
      anchorStart: 4,
      anchorEnd: 7,
      selector: note.selector,
    });
    expect(resolveNote(note, "totally different").anchor).toBe("orphan");
  });
});

// ---------------------------------------------------------------------------
// Validation: the gate's bounds, before the network
// ---------------------------------------------------------------------------
describe("validateNoteInput mirrors the gate's bounds exactly", () => {
  const VALID = {
    section: "phd",
    source: "phd-milestones",
    slug: "milestones",
    selector: { exact: "bravo", prefix: "alpha ", suffix: " charlie" },
    position: { start: 6, end: 11 },
    quote: "bravo",
    comment: "a note",
    intent: "paper",
    tags: ["lit"],
  };

  it("accepts the documented shape and returns the normalised value", () => {
    const result = validateNoteInput(VALID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.quote).toBe("bravo");
    expect(result.value.selector.type).toBe("TextQuoteSelector");
    expect(result.value.position).toEqual({ type: "TextPositionSelector", start: 6, end: 11 });
  });

  it("sets quote from exact even when the caller omits or mistypes it", () => {
    const result = validateNoteInput({ ...VALID, quote: "wrong" });
    expect(result.ok && result.value.quote).toBe("bravo");
  });

  it("refuses exact outside 1-2000, prefix/suffix beyond 64, comment beyond 5000", () => {
    expect(validateNoteInput({ ...VALID, selector: { ...VALID.selector, exact: "" } }).ok).toBe(false);
    expect(
      validateNoteInput({ ...VALID, selector: { ...VALID.selector, exact: "x".repeat(LIMITS.exactMax + 1) } }).ok,
    ).toBe(false);
    expect(
      validateNoteInput({ ...VALID, selector: { ...VALID.selector, prefix: "x".repeat(LIMITS.prefixMax + 1) } }).ok,
    ).toBe(false);
    expect(
      validateNoteInput({ ...VALID, selector: { ...VALID.selector, suffix: "x".repeat(LIMITS.suffixMax + 1) } }).ok,
    ).toBe(false);
    expect(validateNoteInput({ ...VALID, comment: "x".repeat(LIMITS.commentMax + 1) }).ok).toBe(false);
    expect(validateNoteInput({ ...VALID, comment: "x".repeat(LIMITS.commentMax) }).ok).toBe(true);
  });

  it("the bounds are the gate's numbers", () => {
    expect(LIMITS).toEqual({
      exactMin: 1,
      exactMax: 2000,
      prefixMax: 64,
      suffixMax: 64,
      commentMax: 5000,
      tagsMaxItems: 10,
      tagMaxLength: 40,
    });
  });

  it("refuses an unknown intent and the wrong number/shape of tags", () => {
    expect(validateNoteInput({ ...VALID, intent: "someday" }).ok).toBe(false);
    expect(validateNoteInput({ ...VALID, tags: Array.from({ length: 11 }, (_, i) => `t${i}`) }).ok).toBe(false);
    expect(validateNoteInput({ ...VALID, tags: ["x".repeat(41)] }).ok).toBe(false);
    expect(validateNoteInput({ ...VALID, tags: "not-an-array" }).ok).toBe(false);
  });

  it("refuses an unsafe item identity and a bool or inverted position", () => {
    expect(validateNoteInput({ ...VALID, source: "../cv" }).ok).toBe(false);
    expect(validateNoteInput({ ...VALID, section: "a b" }).ok).toBe(false);
    expect(validateNoteInput({ ...VALID, slug: "a/../b" }).ok).toBe(false);
    expect(validateNoteInput({ ...VALID, position: { start: true, end: 3 } }).ok).toBe(false);
    expect(validateNoteInput({ ...VALID, position: { start: 5, end: 2 } }).ok).toBe(false);
    expect(validateNoteInput({ ...VALID, position: { start: -1, end: 2 } }).ok).toBe(false);
  });

  it("isSafeSegment and isSafeItemIdentity reject traversal spellings", () => {
    for (const bad of ["", ".", "..", "a b", "../x", "a/b", "café", "a\\b"]) {
      expect(isSafeSegment(bad), bad).toBe(false);
    }
    for (const good of ["phd", "phd-milestones", "site-2.0", "a_b"]) {
      expect(isSafeSegment(good), good).toBe(true);
    }
    expect(isSafeItemIdentity({ section: "phd", source: "phd-milestones", slug: "a/b" })).toBe(true);
    expect(isSafeItemIdentity({ section: "phd", source: "phd-milestones", slug: "a/../b" })).toBe(false);
  });

  it("normalises an unknown intent to the default rather than failing a chip (D20: paper)", () => {
    expect(isIntent("paper")).toBe(true);
    expect(isIntent("someday")).toBe(false);
    expect(normalizeIntent("someday")).toBe(DEFAULT_INTENT);
    expect(DEFAULT_INTENT).toBe("paper");
    expect(INTENTS).toEqual(["paper", "experiment", "brainstorm", "question"]);
  });
});

// ---------------------------------------------------------------------------
// The status -> UI branch
// ---------------------------------------------------------------------------
describe("403 degrades to read-only; the gate is the authority", () => {
  it("maps a forbidden read to a view with NO write control", async () => {
    const { impl } = recordingFetch(jsonResponse(403, { status: "forbidden" }));
    const view = annotationsView(await listAnnotations({}, { fetch: impl }));
    expect(view.kind).toBe("forbidden");
    expect(view.canWrite).toBe(false);
    expect(view.rows).toEqual([]);
  });

  it("maps a 200 read to a view that can write", () => {
    const view = annotationsView({ ok: true, forbidden: false, notes: [{ id: "a" }] });
    expect(view).toEqual({ kind: "ready", rows: [{ id: "a" }], canWrite: true });
  });

  it("maps an unreachable read to an error view", () => {
    expect(annotationsView({ ok: false, reason: "unreachable" })).toEqual({
      kind: "error",
      rows: [],
      canWrite: false,
    });
  });

  it("createAnnotation reports a 403 as forbidden", async () => {
    const { impl } = recordingFetch(jsonResponse(403, { status: "forbidden" }));
    const outcome = await createAnnotation(
      {
        section: "phd",
        source: "phd-milestones",
        slug: "milestones",
        selector: { exact: "x" },
        intent: "paper",
      },
      { fetch: impl },
    );
    expect(outcome).toEqual({ ok: false, reason: "forbidden", status: 403 });
  });

  it("deleteAnnotation refuses an empty id without a request", async () => {
    const { calls, impl } = recordingFetch(jsonResponse(200, { status: "ok" }));
    expect(await deleteAnnotation("", { fetch: impl })).toEqual({ ok: false, reason: "no-id" });
    expect(calls).toHaveLength(0);
  });

  it("listAnnotations accepts either notes or annotations and never trusts a non-array", async () => {
    const { impl } = recordingFetch(jsonResponse(200, { annotations: [{ id: "a" }] }));
    expect((await listAnnotations({}, { fetch: impl })).notes).toEqual([{ id: "a" }]);
    const bad = recordingFetch(jsonResponse(200, { notes: "nope" }));
    expect((await listAnnotations({}, { fetch: bad.impl })).notes).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Grouping and filtering (AN-USE)
// ---------------------------------------------------------------------------
describe("My notes groups by item and filters by intent and date", () => {
  const rows = [
    { id: "1", section: "phd", source: "phd-milestones", slug: "milestones", intent: "paper", created: "2026-10-01T00:00:00Z" },
    { id: "2", section: "phd", source: "phd-milestones", slug: "milestones", intent: "question", created: "2026-10-05T00:00:00Z" },
    { id: "3", section: "projects", source: "construction-ai", slug: "site", intent: "experiment", created: "2026-09-20T00:00:00Z" },
  ];

  it("groups by qualified id, newest first within a group", () => {
    const groups = groupNotesByItem(rows);
    expect(groups.map((g) => noteItemKey(g.item))).toEqual([
      "phd/phd-milestones/milestones",
      "projects/construction-ai/site",
    ]);
    expect(groups[0].notes.map((n) => n.id)).toEqual(["2", "1"]);
  });

  it("filters by intent and by an inclusive created-date window", () => {
    expect(filterNotes(rows, { intent: "question" }).map((n) => n.id)).toEqual(["2"]);
    expect(filterNotes(rows, { from: "2026-10-01" }).map((n) => n.id)).toEqual(["1", "2"]);
    expect(filterNotes(rows, { from: "2026-09-25", to: "2026-10-01" }).map((n) => n.id)).toEqual(["1"]);
  });

  it("marks a note orphan when its item is not in this build", () => {
    const keys = new Set(["phd/phd-milestones/milestones"]);
    expect(isOrphanNote(rows[0], keys)).toBe(false);
    expect(isOrphanNote(rows[2], keys)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Routing parse/validate (AN-EXPORT; requirement 1)
// ---------------------------------------------------------------------------
describe("notes-routing.json is validated, owner-editable data", () => {
  const committed = JSON.parse(fs.readFileSync(ROUTING_FILE, "utf8"));

  it("parses the committed file and names the two target repos", () => {
    const routing = parseRouting(committed);
    expect(routing.version).toBe(1);
    expect(routeForIntent(routing, "paper")).toEqual({ repo: "djjay0131/soa-agentic-se", dir: "notes" });
    expect(routeForIntent(routing, "experiment")).toEqual({ repo: "djjay0131/agentic-kg-research", dir: "notes" });
    expect(routeForIntent(routing, "brainstorm")).toEqual({ repo: "djjay0131/agentic-kg-research", dir: "notes" });
    expect(routeForIntent(routing, "question")).toBeNull();
  });

  it("requires every intent and accepts a null route as My notes only", () => {
    const missing = { version: 1, routes: { paper: null, experiment: null, brainstorm: null } };
    expect(() => parseRouting(missing)).toThrow(/question/);
    expect(parseRouting({ version: 1, routes: { paper: null, experiment: null, brainstorm: null, question: null } }).routes.paper).toBeNull();
  });

  it("refuses a bad version, a bad repo and an unsafe dir", () => {
    const base = { version: 1, routes: { paper: null, experiment: null, brainstorm: null, question: null } };
    expect(() => parseRouting({ ...base, version: 2 })).toThrow(/version/);
    expect(() => parseRouting({ ...base, routes: { ...base.routes, paper: { repo: "nope", dir: "notes" } } })).toThrow(/owner\/name/);
    expect(() => parseRouting({ ...base, routes: { ...base.routes, paper: { repo: "a/b", dir: "../escape" } } })).toThrow(/dir/);
    expect(() => parseRouting({ ...base, routes: { ...base.routes, paper: { repo: "a/b", dir: "/abs" } } })).toThrow(/dir/);
  });

  it("routeNote skips question and routes paper to its repo", () => {
    const routing = parseRouting(committed);
    expect(routeNote({ intent: "question" }, routing)).toEqual({
      render: false,
      route: null,
      reason: "question stays in My notes",
    });
    const routed = routeNote({ intent: "paper" }, routing);
    expect(routed.render).toBe(true);
    expect(routed.route).toEqual({ repo: "djjay0131/soa-agentic-se", dir: "notes" });
  });
});
