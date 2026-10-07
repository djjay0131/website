// THE CAPTURE ISLAND (AN-CAP; contract site-wave-6 requirement 3; ADR-0021).
//
// Deliberately thin. Every decision with a security, validation or anchoring
// consequence -- the endpoints, the request shapes, the gate's exact field
// bounds, the W3C selector construction, quote fallback resolution and the
// 403->read-only branch -- lives in ../lib/annotations.mjs and is unit-tested
// there without a DOM. This file only reads the same-origin payload frame,
// renders that state and forwards user intent to those functions.
//
// IT NEVER BUILDS HTML. A quote or comment is rendered as a React text node, so
// a `<script>` in either stays inert text; there is no dangerouslySetInnerHTML
// anywhere in this file (AN-ADVERSARIAL 2). Existing highlights are drawn with
// the CSS Custom Highlight API, which paints a Range without mutating the
// document.
//
// The item identity arrives as props from [...itemPath].astro, never typed by
// hand, and the gate takes `member` from the session, never from this body.
import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_INTENT,
  INTENTS,
  LIMITS,
  SELECTOR_CONTEXT,
  annotationsView,
  buildTextIndex,
  createAnnotation,
  deleteAnnotation,
  listAnnotations,
  locateOffset,
  resolveNote,
  selectorFromRangeInIndex,
} from "../lib/annotations.mjs";

type AnyRecord = Record<string, any>;
type TextIndex = { text: string; segments: { node: any; start: number; end: number }[] };
type Selection = { exact: string; prefix: string; suffix: string; start: number; end: number };
type View = { kind: string; rows: AnyRecord[]; canWrite: boolean };

const FRAME_SELECTOR = "iframe[data-annotation-frame]";
const HIGHLIGHT_NAME = "hub-annotation";
const ANNOTATION_STYLE_ID = "hub-annotation-style";
const ANNOTATION_STYLE =
  "::highlight(hub-annotation){background-color:rgba(230,117,31,0.30);}";

/** Read the iframe's current selection as an AN-CAP selector, or null. */
function readSelection(doc: Document, index: TextIndex | null): Selection | null {
  const win = doc.defaultView;
  const selection = win?.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;
  const range = selection.getRangeAt(0);
  const current = index ?? buildTextIndex(doc.body);
  const selector = selectorFromRangeInIndex(range, current, { context: SELECTOR_CONTEXT });
  if (!selector || selector.exact.trim() === "") return null;
  return selector;
}

/** Paint the anchored notes with the CSS Custom Highlight API, if available. */
function paintHighlights(doc: Document, index: TextIndex, rows: AnyRecord[]) {
  const win = doc.defaultView as any;
  const registry = win?.CSS?.highlights;
  const HighlightCtor = win?.Highlight;
  if (!registry || !HighlightCtor) return;
  const ranges: any[] = [];
  for (const note of rows) {
    const resolved = resolveNote(note, index.text);
    if (resolved.anchor !== "anchored") continue;
    const from = locateOffset(index, resolved.anchorStart);
    const to = locateOffset(index, resolved.anchorEnd);
    if (!from || !to) continue;
    try {
      const range = doc.createRange();
      range.setStart(from.node, from.offset);
      range.setEnd(to.node, to.offset);
      ranges.push(range);
    } catch {
      /* an unrepresentable anchor is shown as text in the panel regardless */
    }
  }
  try {
    if (ranges.length === 0) registry.delete(HIGHLIGHT_NAME);
    else registry.set(HIGHLIGHT_NAME, new HighlightCtor(...ranges));
  } catch {
    /* an engine without the API: the panel still lists every note */
  }
}

export default function AnnotationsIsland({
  section,
  source,
  slug,
}: {
  section: string;
  source: string;
  slug: string;
}) {
  const [doc, setDoc] = useState<Document | null>(null);
  const [index, setIndex] = useState<TextIndex | null>(null);
  const [view, setView] = useState<View>({ kind: "loading", rows: [], canWrite: false });
  const [selection, setSelection] = useState<Selection | null>(null);
  const [composing, setComposing] = useState(false);
  const [comment, setComment] = useState("");
  const [intent, setIntent] = useState(DEFAULT_INTENT);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const result = await listAnnotations({ source, slug });
    setView(annotationsView(result));
  }, [source, slug]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Attach to the same-origin payload frame once it has loaded.
  useEffect(() => {
    const frame = document.querySelector<HTMLIFrameElement>(FRAME_SELECTOR);
    if (!frame) return;
    const attach = () => {
      const content = frame.contentDocument;
      if (!content) return;
      setDoc(content);
      setIndex(buildTextIndex(content.body) as TextIndex);
    };
    if (frame.contentDocument?.readyState === "complete") attach();
    frame.addEventListener("load", attach);
    return () => frame.removeEventListener("load", attach);
  }, []);

  // Track the selection so the toolbar appears and hides with it.
  useEffect(() => {
    if (!doc) return;
    const update = () => setSelection(readSelection(doc, index));
    doc.addEventListener("mouseup", update);
    doc.addEventListener("keyup", update);
    return () => {
      doc.removeEventListener("mouseup", update);
      doc.removeEventListener("keyup", update);
    };
  }, [doc, index]);

  useEffect(() => {
    if (doc && index) paintHighlights(doc, index, view.rows);
  }, [doc, index, view.rows]);

  // A static stylesheet for the highlight pseudo-element. Not user content.
  useEffect(() => {
    if (!doc) return;
    if (!doc.getElementById(ANNOTATION_STYLE_ID)) {
      const style = doc.createElement("style");
      style.id = ANNOTATION_STYLE_ID;
      style.textContent = ANNOTATION_STYLE;
      doc.head.appendChild(style);
    }
  }, [doc]);

  const save = useCallback(
    async (current: Selection, text: string, chosenIntent: string) => {
      setBusy(true);
      setMessage("");
      const outcome = await createAnnotation({
        section,
        source,
        slug,
        selector: { exact: current.exact, prefix: current.prefix, suffix: current.suffix },
        position: { start: current.start, end: current.end },
        quote: current.exact,
        comment: text,
        intent: chosenIntent,
        tags: [],
      });
      setBusy(false);
      if (!outcome.ok) {
        setMessage(
          outcome.reason === "forbidden"
            ? "Read-only: you cannot add notes here."
            : "Could not save that note. Try again shortly.",
        );
        return;
      }
      setComposing(false);
      setComment("");
      setSelection(null);
      await refresh();
    },
    [section, source, slug, refresh],
  );

  // Keyboard-first: Ctrl/Cmd+Shift+L highlights the current selection.
  useEffect(() => {
    if (!doc) return;
    const onKey = (event: KeyboardEvent) => {
      const isShortcut =
        (event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "l";
      if (!isShortcut) return;
      event.preventDefault();
      const current = readSelection(doc, index);
      if (current) void save(current, "", DEFAULT_INTENT);
    };
    doc.addEventListener("keydown", onKey);
    return () => doc.removeEventListener("keydown", onKey);
  }, [doc, index, save]);

  async function onDelete(id: string) {
    setBusy(true);
    setMessage("");
    const outcome = await deleteAnnotation(id);
    setBusy(false);
    if (!outcome.ok) {
      setMessage(
        outcome.reason === "forbidden"
          ? "Read-only: you cannot delete that note."
          : "Could not delete that note.",
      );
      return;
    }
    await refresh();
  }

  function onSubmitComment(event: { preventDefault: () => void }) {
    event.preventDefault();
    if (!selection) return;
    void save(selection, comment, intent);
  }

  const rows = view.rows;

  return (
    <div className="annotations-island" data-annotation-island>
      {message && (
        <p className="annotation-message" role="alert">
          {message}
        </p>
      )}

      {selection && view.canWrite && !composing && (
        <div className="annotation-toolbar" role="toolbar" aria-label="Annotation actions">
          <button type="button" disabled={busy} onClick={() => void save(selection, "", DEFAULT_INTENT)}>
            Highlight
          </button>
          <button type="button" disabled={busy} onClick={() => setComposing(true)}>
            Comment
          </button>
        </div>
      )}

      {selection && composing && view.canWrite && (
        <form className="annotation-toolbar annotation-form" onSubmit={onSubmitComment}>
          <label>
            Comment
            <textarea
              value={comment}
              maxLength={LIMITS.commentMax}
              onChange={(event) => setComment(event.target.value)}
            />
          </label>
          <fieldset>
            <legend>Intent</legend>
            {INTENTS.map((value) => (
              <label key={value} className="annotation-intent-option">
                <input
                  type="radio"
                  name="annotation-intent"
                  value={value}
                  checked={intent === value}
                  onChange={() => setIntent(value)}
                />
                {value}
              </label>
            ))}
          </fieldset>
          <div className="annotation-actions">
            <button type="submit" disabled={busy}>
              Save
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setComposing(false);
                setComment("");
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <section className="annotation-notes" aria-label="Notes on this item">
        <h2>Notes on this item</h2>
        {view.kind === "forbidden" && <p>Read-only: notes are shown but cannot be changed.</p>}
        {view.kind === "error" && <p>Could not load notes. Try again shortly.</p>}
        {view.kind === "ready" && rows.length === 0 && <p>No notes yet. Select text to begin.</p>}
        {rows.length > 0 && (
          <ul>
            {rows.map((note: AnyRecord) => {
              const resolved = index ? resolveNote(note, index.text) : { anchor: "unknown" };
              return (
                <li key={String(note.id)}>
                  <span className="annotation-intent">{String(note.intent ?? DEFAULT_INTENT)}</span>
                  {resolved.anchor === "orphan" && <span className="annotation-orphan">Orphan</span>}
                  <blockquote>{String(note.quote ?? note.selector?.exact ?? "")}</blockquote>
                  {note.comment ? <p className="annotation-comment">{String(note.comment)}</p> : null}
                  {view.canWrite && (
                    <button type="button" disabled={busy} onClick={() => void onDelete(String(note.id))}>
                      Delete
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
