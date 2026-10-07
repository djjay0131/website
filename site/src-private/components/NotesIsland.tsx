// THE MY NOTES ISLAND (AN-USE; contract site-wave-6 requirement 4).
//
// Private build only. Lists GET /annotations (the caller's own notes) grouped by
// item, filterable by intent and by created date, and links each item to its
// frame. A note whose item is not in this build is badged orphan and shows its
// qualified id, because ADR-0021 stores no title.
//
// Thin, like the capture island: grouping, filtering and orphan detection live
// in ../lib/annotations.mjs. Every quote and comment is a React text node, so a
// stored `<script>` stays inert.
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_INTENT,
  annotationsView,
  filterNotes,
  groupNotesByItem,
  isOrphanNote,
  listAnnotations,
  noteItemKey,
} from "../lib/annotations.mjs";

type AnyRecord = Record<string, any>;
type Item = { section: string; source: string; slug: string; title: string; href: string | null };

export default function NotesIsland({ items = [] }: { items?: Item[] }) {
  const [view, setView] = useState<{ kind: string; rows: AnyRecord[]; canWrite: boolean }>({
    kind: "loading",
    rows: [],
    canWrite: false,
  });
  const [intent, setIntent] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const refresh = useCallback(async () => {
    const result = await listAnnotations();
    setView(annotationsView(result));
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const byKey = useMemo(() => {
    const map = new Map<string, Item>();
    for (const item of items) map.set(noteItemKey(item), item);
    return map;
  }, [items]);

  const filtered = filterNotes(view.rows, {
    intent: intent || null,
    from: from || null,
    to: to || null,
  });
  const grouped = groupNotesByItem(filtered);

  return (
    <div className="notes-island">
      <div className="notes-filters" role="search" aria-label="Filter notes">
        <label>
          Intent
          <select value={intent} onChange={(event) => setIntent(event.target.value)}>
            <option value="">All</option>
            <option value="paper">paper</option>
            <option value="experiment">experiment</option>
            <option value="brainstorm">brainstorm</option>
            <option value="question">question</option>
          </select>
        </label>
        <label>
          From
          <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </label>
        <label>
          To
          <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </label>
      </div>

      {view.kind === "loading" && <p className="notes-note">Loading notes…</p>}
      {view.kind === "error" && <p className="notes-note" role="alert">Could not load notes. Try again shortly.</p>}
      {view.kind === "forbidden" && <p className="notes-note">Notes are not available for this account.</p>}
      {view.kind === "ready" && grouped.length === 0 && (
        <p className="notes-note">No notes match. Annotate a private item to see it here.</p>
      )}

      {grouped.map((group) => {
        const item = byKey.get(noteItemKey(group.item));
        const orphan = isOrphanNote(group.item, byKey);
        return (
          <section key={noteItemKey(group.item)} className="notes-group">
            <h2>
              {item?.href ? <a href={item.href}>{item.title}</a> : item?.title ?? noteItemKey(group.item)}
              {orphan && <span className="notes-orphan">Orphan</span>}
            </h2>
            <p className="notes-item-id">{noteItemKey(group.item)}</p>
            <ul>
              {group.notes.map((note: AnyRecord) => (
                <li key={String(note.id)}>
                  <span className="notes-intent">{String(note.intent ?? DEFAULT_INTENT)}</span>
                  <time dateTime={String(note.created ?? "")}>{String(note.created ?? "").slice(0, 10)}</time>
                  <blockquote>{String(note.quote ?? note.selector?.exact ?? "")}</blockquote>
                  {note.comment ? <p className="notes-comment">{String(note.comment)}</p> : null}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
