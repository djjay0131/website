// THE ANNOTATION ISLAND'S PURE LOGIC (AN-CAP, AN-STORE, AN-USE, AN-EXPORT;
// contract site-wave-6, requirements 2 and 7).
//
// Everything with a security, validation, anchoring or routing decision lives
// here, and nothing here touches the DOM, `node:fs`, `document`, `window` or the
// network. The capture island (components/AnnotationsIsland.tsx), the My notes
// island (components/NotesIsland.tsx) and the Node export renderer
// (scripts/export-notes.mjs) all import THIS module, so the gate's field bounds,
// the W3C selector shapes, the intent vocabulary and the owner-editable routing
// have exactly one definition.
//
// WHY IT MUST STAY BROWSER-SAFE. This module is bundled into the private build's
// client islands. Importing `node:fs` here (to read notes-routing.json) would
// drag a filesystem module into the browser bundle, so the routing file is read
// by the Node caller and handed to parseRouting() as data -- the same split
// shares.mjs makes for its endpoint constants.
//
// THE FIVE PROPERTIES THAT MATTER, AND WHY THEY ARE PINNED HERE:
//
//   1. Every annotation call is SAME-ORIGIN -- a bare `/annotations` path, never
//      an absolute *.run.app URL -- and carries `credentials: "same-origin"`.
//      Firebase Hosting rewrites `/annotations/**` to the gate, so a same-origin
//      path is what keeps the Origin the gate accepts.
//   2. The field bounds are the GATE's bounds (AN-STORE): exact 1-2000,
//      prefix/suffix 0-64, comment 0-5000, tags <=10 x <=40, intent in the enum.
//      A client that is stricter than the server invents rejections; one that is
//      looser sends a request the gate refuses. Mirroring them is the point.
//   3. Anchoring is by quote first (W3C TextQuoteSelector), disambiguated by
//      prefix/suffix, then by position, and marked ORPHAN -- never dropped --
//      when none of those resolves (AN-CAP 5-6).
//   4. A note is rendered as React text nodes and exported as escaped Markdown.
//      Nothing here ever returns or builds HTML, so a `<script>` in a quote or
//      comment stays inert text (AN-ADVERSARIAL 2).
//   5. Routing is owner-editable data, never code: parseRouting() validates
//      `site/notes-routing.json` so a malformed file fails loudly instead of
//      silently dropping notes.

/** The one annotation endpoint. Hosting rewrites it to the gate (AN-REWRITES). */
export const ANNOTATION_ENDPOINT = "/annotations";

/** The private My notes page, served by the gate under the private base (AN-USE). */
export const NOTES_PAGE_PATH = "/p/notes/";

/** The intent vocabulary (AN-STORE). Order is the UI's chip order. */
export const INTENTS = ["paper", "experiment", "brainstorm", "question"];

/** A highlight with no comment is still a note; it defaults to `question`. */
export const DEFAULT_INTENT = "question";

/** The one scope switch GET /annotations understands, and it is owner-only. */
export const ALL_SCOPE = "all";

/** How much surrounding text a TextQuoteSelector keeps (AN-CAP 5). */
export const SELECTOR_CONTEXT = 32;

export const SELECTOR_TYPE = "TextQuoteSelector";
export const POSITION_TYPE = "TextPositionSelector";

/** The gate's field bounds, copied from AN-STORE (do not "tidy" one). */
export const LIMITS = {
  exactMin: 1,
  exactMax: 2000,
  prefixMax: 64,
  suffixMax: 64,
  commentMax: 5000,
  tagsMaxItems: 10,
  tagMaxLength: 40,
};

// ---------------------------------------------------------------------------
// Endpoints and request inits
// ---------------------------------------------------------------------------

const stringOr = (value, fallback = "") => (typeof value === "string" ? value : fallback);

/**
 * The GET /annotations path, with the gate's filters.
 *
 * `scope: "all"` is the owner-only export/My-notes-wide switch; `intent`,
 * `source` and `slug` are applied in the gate (gate-wave-6 requirement 4).
 *
 * @param {{scope?: string|null, intent?: string|null, source?: string|null, slug?: string|null}} [options]
 * @returns {string}
 */
export function annotationListEndpoint(options = {}) {
  const params = [];
  if (options.scope) params.push(`scope=${encodeURIComponent(options.scope)}`);
  if (options.intent) params.push(`intent=${encodeURIComponent(options.intent)}`);
  if (options.source) params.push(`source=${encodeURIComponent(options.source)}`);
  if (options.slug) params.push(`slug=${encodeURIComponent(options.slug)}`);
  return params.length === 0 ? ANNOTATION_ENDPOINT : `${ANNOTATION_ENDPOINT}?${params.join("&")}`;
}

/** The same-origin DELETE path for a note id. @param {string} id */
export function annotationDeleteEndpoint(id) {
  return `${ANNOTATION_ENDPOINT}/${encodeURIComponent(stringOr(id))}`;
}

/** @returns {{method: "GET", credentials: "same-origin"}} */
export function annotationListRequestInit() {
  return { method: "GET", credentials: "same-origin" };
}

/**
 * The POST body, EXACTLY the AN-STORE fields the gate validates. Same-origin, so
 * the JSON content-type costs no preflight. `quote` is normalised to the
 * selector's `exact`; the gate stores `quote == selector.exact`.
 *
 * @param {{section: string, source: string, slug: string, selector: object,
 *   position?: object|null, quote?: string, comment?: string, intent?: string,
 *   tags?: string[]}} input
 */
export function annotationCreateRequestInit(input) {
  const selector = input?.selector ?? {};
  return {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      section: input?.section,
      source: input?.source,
      slug: input?.slug,
      selector: {
        type: SELECTOR_TYPE,
        exact: stringOr(selector.exact),
        prefix: stringOr(selector.prefix),
        suffix: stringOr(selector.suffix),
      },
      position: input?.position ?? null,
      quote: stringOr(input?.quote, stringOr(selector.exact)),
      comment: stringOr(input?.comment),
      intent: input?.intent,
      tags: Array.isArray(input?.tags) ? input.tags : [],
    }),
  };
}

/** @returns {{method: "DELETE", credentials: "same-origin"}} */
export function annotationDeleteRequestInit() {
  return { method: "DELETE", credentials: "same-origin" };
}

// ---------------------------------------------------------------------------
// Selector construction (pure, node-like objects only)
// ---------------------------------------------------------------------------

/**
 * A depth-first text index over a node-like tree: the concatenated text and, for
 * each text node, its [start, end) span in that concatenation.
 *
 * Deliberately takes node-like objects (`nodeType`, `nodeValue`, `childNodes`,
 * `parentNode`) rather than a `Document`, so it is unit-testable with plain
 * objects and has no dependency on the DOM globals (the island passes the
 * iframe's real `body`).
 *
 * @param {{nodeType: number, nodeValue?: unknown, childNodes?: Iterable<any>}} root
 * @returns {{text: string, segments: {node: any, start: number, end: number}[]}}
 */
export function buildTextIndex(root) {
  const segments = [];
  let text = "";
  const visit = (node) => {
    if (!node) return;
    if (node.nodeType === 3) {
      const value = String(node.nodeValue ?? "");
      segments.push({ node, start: text.length, end: text.length + value.length });
      text += value;
      return;
    }
    const children = node.childNodes ? Array.from(node.childNodes) : [];
    for (const child of children) visit(child);
  };
  visit(root);
  return { text, segments };
}

function textLengthOf(node) {
  if (!node) return 0;
  if (node.nodeType === 3) return String(node.nodeValue ?? "").length;
  const children = node.childNodes ? Array.from(node.childNodes) : [];
  let total = 0;
  for (const child of children) total += textLengthOf(child);
  return total;
}

function segmentFor(node, index) {
  return index.segments.find((segment) => segment.node === node) ?? null;
}

function isInSubtree(ancestor, node) {
  let current = node;
  while (current) {
    if (current === ancestor) return true;
    current = current.parentNode;
  }
  return false;
}

/**
 * The absolute text offset for a (container, offset) pair, as a DOM Range spells
 * it. A text container's offset is a character index; an element container's is a
 * child index, resolved by summing the text of the preceding children.
 *
 * @param {any} container
 * @param {number} offset
 * @param {{text: string, segments: {node: any, start: number, end: number}[]}} index
 * @returns {number}
 */
export function offsetAt(container, offset, index) {
  if (!container || !index) return 0;
  const segment = segmentFor(container, index);
  if (segment) {
    const bounded = Math.min(Math.max(Number(offset) || 0, 0), segment.end - segment.start);
    return segment.start + bounded;
  }
  const children = container.childNodes ? Array.from(container.childNodes) : [];
  let total = 0;
  for (const segmentEntry of index.segments) {
    if (isInSubtree(container, segmentEntry.node)) {
      total = segmentEntry.start;
      break;
    }
  }
  const upto = Math.min(Math.max(Number(offset) || 0, 0), children.length);
  for (let i = 0; i < upto; i += 1) total += textLengthOf(children[i]);
  return total;
}

/**
 * The absolute [start, end) offsets a Range covers in the indexed text.
 *
 * @param {any} range a Range-like `{startContainer, startOffset, endContainer, endOffset}`
 * @param {ReturnType<typeof buildTextIndex>} index
 * @returns {{start: number, end: number} | null}
 */
export function offsetsForRange(range, index) {
  if (!range || !index) return null;
  const start = offsetAt(range.startContainer, range.startOffset, index);
  const end = offsetAt(range.endContainer, range.endOffset, index);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return { start: Math.min(start, end), end: Math.max(start, end) };
}

/**
 * Build the AN-CAP `{exact, prefix, suffix, start, end}` selector from a Range
 * and the indexed text. Prefix/suffix are up to `context` characters of
 * surrounding text; the gate accepts up to 64.
 *
 * @param {any} range
 * @param {ReturnType<typeof buildTextIndex>} index
 * @param {{context?: number}} [options]
 */
export function selectorFromRangeInIndex(range, index, options = {}) {
  const offsets = offsetsForRange(range, index);
  if (!offsets) return null;
  return selectorFromOffsets(index.text, offsets.start, offsets.end, options);
}

/** Convenience over selectorFromRangeInIndex that builds the index from `root`. */
export function selectorFromRange(range, options = {}) {
  const { root, ...rest } = options;
  return selectorFromRangeInIndex(range, buildTextIndex(root), rest);
}

/**
 * Build the selector fields from a known [start, end) span of `text`.
 *
 * @param {string} text
 * @param {number} start
 * @param {number} end
 * @param {{context?: number}} [options]
 * @returns {{exact: string, prefix: string, suffix: string, start: number, end: number}}
 */
export function selectorFromOffsets(text, start, end, options = {}) {
  const full = String(text ?? "");
  const context = Number.isFinite(options.context) ? options.context : SELECTOR_CONTEXT;
  const from = Math.max(0, Math.min(Number(start) || 0, full.length));
  const to = Math.max(from, Math.min(Number(end) || from, full.length));
  return {
    exact: full.slice(from, to),
    prefix: full.slice(Math.max(0, from - context), from),
    suffix: full.slice(to, Math.min(full.length, to + context)),
    start: from,
    end: to,
  };
}

/**
 * The absolute offset to place a Range boundary at, from an index and an offset.
 * Used to draw existing highlights without mutating the document.
 *
 * @param {ReturnType<typeof buildTextIndex>} index
 * @param {number} offset
 * @returns {{node: any, offset: number} | null}
 */
export function locateOffset(index, offset) {
  if (!index || index.segments.length === 0) return null;
  const value = Math.max(0, Number(offset) || 0);
  for (const segment of index.segments) {
    if (value >= segment.start && value <= segment.end) {
      return { node: segment.node, offset: value - segment.start };
    }
  }
  const last = index.segments[index.segments.length - 1];
  return { node: last.node, offset: last.end - last.start };
}

// ---------------------------------------------------------------------------
// Quote fallback resolution (AN-CAP 5-6)
// ---------------------------------------------------------------------------

function positionMatch(position, text, exact) {
  if (!position || typeof position !== "object") return null;
  const { start, end } = position;
  if (!Number.isInteger(start) || !Number.isInteger(end)) return null;
  if (start < 0 || end < start || end > String(text ?? "").length) return null;
  if (String(text ?? "").slice(start, end) !== exact) return null;
  return { start, end };
}

/**
 * Resolve a note's anchor against the current document text.
 *
 * Order (AN-CAP 5, contract requirement 2): `exact`, then disambiguate with
 * `prefix`/`suffix`, then fall back to `position`. A quote that occurs but is
 * ambiguous still anchors rather than orphaning -- `exact` DID resolve. Orphan
 * means the quote is genuinely absent and no valid position matches.
 *
 * @param {{exact?: string, prefix?: string, suffix?: string}|null} selector
 * @param {{start: number, end: number}|null} position
 * @param {string} text
 * @returns {{state: "anchored"|"orphan", via: "exact"|"context"|"position"|null, start: number|null, end: number|null}}
 */
export function resolveAnchor(selector, position, text) {
  const full = String(text ?? "");
  const exact = stringOr(selector?.exact);
  const prefix = stringOr(selector?.prefix);
  const suffix = stringOr(selector?.suffix);
  if (exact === "") return { state: "orphan", via: null, start: null, end: null };

  const occurrences = [];
  let at = full.indexOf(exact);
  while (at !== -1) {
    occurrences.push(at);
    at = full.indexOf(exact, at + exact.length);
  }

  if (occurrences.length === 1) {
    return { state: "anchored", via: "exact", start: occurrences[0], end: occurrences[0] + exact.length };
  }

  if (occurrences.length > 1) {
    let best = null;
    for (const start of occurrences) {
      let score = 0;
      if (prefix && full.slice(Math.max(0, start - prefix.length), start) === prefix) score += 1;
      if (suffix && full.slice(start + exact.length, start + exact.length + suffix.length) === suffix) {
        score += 1;
      }
      if (best === null || score > best.score) best = { start, score };
    }
    if (best && best.score > 0) {
      return { state: "anchored", via: "context", start: best.start, end: best.start + exact.length };
    }
    const byPosition = positionMatch(position, full, exact);
    if (byPosition) return { state: "anchored", via: "position", ...byPosition };
    // `exact` resolved; only the disambiguator failed. Anchor to the first
    // occurrence rather than falsely calling a present quote an orphan.
    return { state: "anchored", via: "exact", start: occurrences[0], end: occurrences[0] + exact.length };
  }

  // The quote is genuinely absent. Position cannot invent it -- a stored
  // position whose slice is not the quote is not a match either -- so this is an
  // orphan (AN-CAP 6).
  return { state: "orphan", via: null, start: null, end: null };
}

/**
 * Resolve one stored note against the current document text.
 *
 * @param {{selector?: object|null, position?: object|null}} note
 * @param {string} text
 */
export function resolveNote(note, text) {
  const anchor = resolveAnchor(note?.selector, note?.position, text);
  return {
    ...note,
    anchor: anchor.state,
    anchorVia: anchor.via,
    anchorStart: anchor.start,
    anchorEnd: anchor.end,
  };
}

// ---------------------------------------------------------------------------
// Identity and field validation (the gate's rules, before the network)
// ---------------------------------------------------------------------------

const SEGMENT_PATTERN = /^[A-Za-z0-9._-]+$/;

/** One safe path segment, as the gate's `_checked_segments` allowlist defines it. */
export function isSafeSegment(segment) {
  const raw = typeof segment === "string" ? segment : "";
  if (raw === "" || raw === "." || raw === "..") return false;
  return SEGMENT_PATTERN.test(raw);
}

/** `section`/`source` one safe segment, `slug` one or more (AN-STORE). */
export function isSafeItemIdentity(identity) {
  const section = stringOr(identity?.section);
  const source = stringOr(identity?.source);
  const slug = stringOr(identity?.slug);
  if (!isSafeSegment(section) || !isSafeSegment(source)) return false;
  const segments = slug.split("/");
  if (segments.length === 0) return false;
  return segments.every(isSafeSegment);
}

export function isIntent(value) {
  return INTENTS.includes(value);
}

/** The chip's fallback: an unknown intent is `question`, never an error. */
export function normalizeIntent(value) {
  return isIntent(value) ? value : DEFAULT_INTENT;
}

/**
 * Validate a note before it reaches POST /annotations, with the gate's exact
 * bounds. A `bool` is not an integer position (Python's `isinstance(True, int)`
 * trap, from the gate contract).
 *
 * @param {any} input
 * @returns {{ok: true, value: object} | {ok: false, errors: string[]}}
 */
export function validateNoteInput(input) {
  const errors = [];
  const section = stringOr(input?.section);
  const source = stringOr(input?.source);
  const slug = stringOr(input?.slug);
  const selector = input?.selector ?? {};
  const exact = stringOr(selector.exact);
  const prefix = stringOr(selector.prefix);
  const suffix = stringOr(selector.suffix);
  const comment = stringOr(input?.comment);
  const intent = input?.intent;
  const tags = input?.tags === undefined ? [] : input?.tags;
  const position = input?.position ?? null;

  if (!isSafeSegment(section)) errors.push("section must be one safe path segment");
  if (!isSafeSegment(source)) errors.push("source must be one safe path segment");
  if (!stringOr(slug).split("/").every(isSafeSegment)) {
    errors.push("slug must be one or more safe path segments");
  }
  if (exact.length < LIMITS.exactMin || exact.length > LIMITS.exactMax) {
    errors.push(`exact must be ${LIMITS.exactMin}-${LIMITS.exactMax} characters`);
  }
  if (prefix.length > LIMITS.prefixMax) errors.push(`prefix must be at most ${LIMITS.prefixMax} characters`);
  if (suffix.length > LIMITS.suffixMax) errors.push(`suffix must be at most ${LIMITS.suffixMax} characters`);
  if (comment.length > LIMITS.commentMax) errors.push(`comment must be at most ${LIMITS.commentMax} characters`);
  if (!isIntent(intent)) errors.push(`intent must be one of ${INTENTS.join(", ")}`);

  if (!Array.isArray(tags)) {
    errors.push("tags must be an array");
  } else {
    if (tags.length > LIMITS.tagsMaxItems) errors.push(`at most ${LIMITS.tagsMaxItems} tags`);
    for (const tag of tags) {
      if (typeof tag !== "string" || tag.length === 0 || tag.length > LIMITS.tagMaxLength) {
        errors.push(`each tag must be 1-${LIMITS.tagMaxLength} characters`);
        break;
      }
    }
  }

  if (position !== null && position !== undefined) {
    const start = position?.start;
    const end = position?.end;
    const integer = (value) => typeof value === "number" && Number.isInteger(value);
    if (!integer(start) || !integer(end) || start < 0 || end < start) {
      errors.push("position must be {start, end} integers with 0 <= start <= end");
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      section,
      source,
      slug,
      selector: { type: SELECTOR_TYPE, exact, prefix, suffix },
      position: position === null || position === undefined
        ? null
        : { type: POSITION_TYPE, start: position.start, end: position.end },
      quote: exact,
      comment,
      intent,
      tags: tags.slice(),
    },
  };
}

// ---------------------------------------------------------------------------
// The status -> UI branch (403 degrades to read-only; the gate is the authority)
// ---------------------------------------------------------------------------

/**
 * Map a list/create outcome to the capabilities the islands may render. On 403
 * NO write control is offered -- the gate refuses the request regardless.
 *
 * @param {{ok: boolean, forbidden?: boolean, notes?: unknown[]}} result
 */
export function annotationsView(result) {
  if (!result?.ok) return { kind: "error", rows: [], canWrite: false };
  if (result.forbidden) return { kind: "forbidden", rows: [], canWrite: false };
  return { kind: "ready", rows: Array.isArray(result.notes) ? result.notes : [], canWrite: true };
}

// ---------------------------------------------------------------------------
// Network calls (same-origin, injected fetch for tests)
// ---------------------------------------------------------------------------

/**
 * Load the caller's notes (or every note for the owner's `scope: "all"`).
 *
 * @param {{scope?: string|null, intent?: string|null, source?: string|null, slug?: string|null}} [filters]
 * @param {{fetch?: typeof globalThis.fetch}} [deps]
 * @returns {Promise<{ok: true, forbidden: boolean, notes: unknown[]} | {ok: false, reason: string, status?: number, error?: unknown}>}
 */
export async function listAnnotations(filters = {}, deps = {}) {
  const fetchImpl = deps.fetch ?? globalThis.fetch;
  let response;
  try {
    response = await fetchImpl(annotationListEndpoint(filters), annotationListRequestInit());
  } catch (error) {
    return { ok: false, reason: "unreachable", error };
  }
  if (response?.status === 403) return { ok: true, forbidden: true, notes: [] };
  if (!response?.ok) return { ok: false, reason: "refused", status: response?.status ?? 0 };
  let data;
  try {
    data = await response.json();
  } catch {
    return { ok: false, reason: "malformed" };
  }
  const notes = Array.isArray(data?.notes)
    ? data.notes
    : Array.isArray(data?.annotations)
      ? data.annotations
      : [];
  return { ok: true, forbidden: false, notes };
}

/**
 * Create a note. The client NEVER sends `member`; the gate takes it from the
 * session (AN-ADVERSARIAL 4).
 *
 * @param {any} input
 * @param {{fetch?: typeof globalThis.fetch}} [deps]
 */
export async function createAnnotation(input, deps = {}) {
  const valid = validateNoteInput(input);
  if (!valid.ok) return { ok: false, reason: "invalid", errors: valid.errors };
  const fetchImpl = deps.fetch ?? globalThis.fetch;
  let response;
  try {
    response = await fetchImpl(ANNOTATION_ENDPOINT, annotationCreateRequestInit(valid.value));
  } catch (error) {
    return { ok: false, reason: "unreachable", error };
  }
  if (response?.status === 403) return { ok: false, reason: "forbidden", status: 403 };
  if (!response?.ok) return { ok: false, reason: "refused", status: response?.status ?? 0 };
  let data;
  try {
    data = await response.json();
  } catch {
    return { ok: false, reason: "malformed" };
  }
  return { ok: true, id: typeof data?.id === "string" ? data.id : "" };
}

/**
 * Delete one note by id. Only the caller's own (or the owner's) request is
 * honoured; the gate decides.
 *
 * @param {string} id
 * @param {{fetch?: typeof globalThis.fetch}} [deps]
 */
export async function deleteAnnotation(id, deps = {}) {
  const clean = stringOr(id).trim();
  if (clean === "") return { ok: false, reason: "no-id" };
  const fetchImpl = deps.fetch ?? globalThis.fetch;
  let response;
  try {
    response = await fetchImpl(annotationDeleteEndpoint(clean), annotationDeleteRequestInit());
  } catch (error) {
    return { ok: false, reason: "unreachable", error };
  }
  if (response?.status === 403) return { ok: false, reason: "forbidden", status: 403 };
  if (!response?.ok) return { ok: false, reason: "refused", status: response?.status ?? 0 };
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Grouping and filtering (AN-USE)
// ---------------------------------------------------------------------------

/** The item qualified id a note is anchored to. @param {any} note */
export function noteItemKey(note) {
  return `${stringOr(note?.section)}/${stringOr(note?.source)}/${stringOr(note?.slug)}`;
}

/**
 * Notes grouped by item, each group newest-first, groups by qualified id.
 *
 * @param {any[]} rows
 * @returns {{item: {section: string, source: string, slug: string}, notes: any[]}[]}
 */
export function groupNotesByItem(rows) {
  const groups = new Map();
  for (const note of Array.isArray(rows) ? rows : []) {
    const key = noteItemKey(note);
    if (!groups.has(key)) {
      groups.set(key, {
        item: { section: stringOr(note?.section), source: stringOr(note?.source), slug: stringOr(note?.slug) },
        notes: [],
      });
    }
    groups.get(key).notes.push(note);
  }
  return [...groups.values()]
    .map((group) => ({
      ...group,
      notes: group.notes.slice().sort((a, b) => (stringOr(b?.created) < stringOr(a?.created) ? -1 : 1)),
    }))
    .sort((a, b) => (noteItemKey(a.item) < noteItemKey(b.item) ? -1 : 1));
}

/** True when the note's item is not in this build (its title cannot be shown). */
export function isOrphanNote(note, itemKeys) {
  const keys = itemKeys instanceof Set ? itemKeys : new Set(itemKeys ?? []);
  return !keys.has(noteItemKey(note));
}

/**
 * Filter notes by intent and a created-date window (inclusive `YYYY-MM-DD`).
 *
 * @param {any[]} rows
 * @param {{intent?: string|null, from?: string|null, to?: string|null}} [filters]
 */
export function filterNotes(rows, filters = {}) {
  const intent = filters.intent ?? null;
  const from = filters.from ?? null;
  const to = filters.to ?? null;
  return (Array.isArray(rows) ? rows : []).filter((note) => {
    if (intent && note?.intent !== intent) return false;
    const day = stringOr(note?.created).slice(0, 10);
    if (from && day && day < from) return false;
    if (to && day && day > to) return false;
    return true;
  });
}

// ---------------------------------------------------------------------------
// Routing parse/validate (AN-EXPORT; contract requirement 1)
// ---------------------------------------------------------------------------

/** The only routing schema version this build understands. */
export const ROUTING_VERSION = 1;

const REPO_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\/[A-Za-z0-9._-]+$/;

function isSafeRelativeDir(dir) {
  const raw = stringOr(dir);
  if (raw === "" || raw.startsWith("/") || raw.endsWith("/") || raw.includes("\\")) return false;
  return raw.split("/").every(isSafeSegment);
}

/**
 * Validate the owner-editable `site/notes-routing.json`.
 *
 * Every intent must be present; `null` means "My notes only"; a route is
 * `{repo, dir}` with `repo` matching `owner/name` and `dir` a safe relative
 * path. A malformed file throws so the export stops rather than silently
 * dropping notes.
 *
 * @param {unknown} raw the parsed JSON
 * @returns {{version: number, routes: Record<string, {repo: string, dir: string}|null>}}
 */
export function parseRouting(raw) {
  if (!raw || typeof raw !== "object") throw new Error("notes-routing.json must be an object");
  if (raw.version !== ROUTING_VERSION) {
    throw new Error(`notes-routing.json version must be ${ROUTING_VERSION}`);
  }
  if (!raw.routes || typeof raw.routes !== "object") {
    throw new Error("notes-routing.json is missing the routes object");
  }
  const routes = {};
  for (const intent of INTENTS) {
    if (!(intent in raw.routes)) throw new Error(`notes-routing.json is missing the "${intent}" route`);
    const route = raw.routes[intent];
    if (route === null) {
      routes[intent] = null;
      continue;
    }
    if (typeof route !== "object" || Array.isArray(route)) {
      throw new Error(`notes-routing.json route "${intent}" must be an object or null`);
    }
    if (typeof route.repo !== "string" || !REPO_PATTERN.test(route.repo)) {
      throw new Error(`notes-routing.json route "${intent}" repo must match owner/name`);
    }
    if (!isSafeRelativeDir(route.dir)) {
      throw new Error(`notes-routing.json route "${intent}" dir must be a safe relative path`);
    }
    routes[intent] = { repo: route.repo, dir: route.dir };
  }
  return { version: ROUTING_VERSION, routes };
}

/** The route for one intent, or null when it is "My notes only". */
export function routeForIntent(routing, intent) {
  return routing?.routes?.[intent] ?? null;
}

/**
 * Inspect a note before rendering, from the routing's point of view.
 *
 * @returns {{render: boolean, route: object|null, reason: string}}
 */
export function routeNote(note, routing) {
  const intent = normalizeIntent(note?.intent);
  const route = routeForIntent(routing, intent);
  if (intent === "question") return { render: false, route: null, reason: "question stays in My notes" };
  if (!route) return { render: false, route: null, reason: `no route for intent "${intent}"` };
  return { render: true, route, reason: "" };
}
