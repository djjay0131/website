// THE CAPTURE ISLAND — one island, two targets (D20/Wave 7; ADR-0021).
//
// Wave 6 built this as a React island that lived only under src-private/ and
// only read the private payload <iframe>. D20 changed the scope: ANY signed-in
// member annotates ANY item they can read — public items included — and the
// island must work on a page's own document, not just inside the frame. So the
// island is rewritten framework-free and moved into the SHARED public tree
// (src/lib, src/components), which lets ONE module mount on both outputs:
//
//   - the private framed item (src-private/pages/[...itemPath].astro), where the
//     target is `iframe[data-annotation-frame]`; and
//   - a public item page (layouts/ItemPage.astro and the public framed route),
//     where the target is the page's own `main`/`article` content root.
//
// WHY NO REACT. The public build deliberately never runs the React plugin
// (SEAM-S6; ADR-0003), and shipping the whole React runtime to every public page
// to draw one toolbar is a poor trade. This module is plain DOM: it builds every
// node with createElement()/textContent and NEVER assigns innerHTML, so a stored
// `<script>` in a quote or comment stays inert text (AN-ADVERSARIAL 2). All the
// security, validation and anchoring decisions still live in ./annotations.mjs
// and are unit-tested there without a DOM; this file only drives the DOM.
//
// PUBLIC-SAFE BY CONSTRUCTION. This file and the module it imports are bundled
// into dist-public, so they name only `/annotations` (member-gated), the island's
// own `data-annotation-*` hooks, the intent vocabulary and the field bounds. The
// private members' notes ROUTE and the My notes surface stay under src-private/.
// The leak check (AN-LEAK, updated for D20) allows this tooling in the public
// bundle and still refuses that private route.
//
// THE PLANE RULE (ADR-0021 decision 3). Every request is same-origin and carries
// `credentials: "same-origin"`. The gate takes `member` from the verified session
// and never from this code. A 403 (`GET /annotations` refusing a caller with no
// session, or a member without write capability) makes the island render NOTHING:
// a signed-out visitor sees no toolbar, no list, no count.
import {
  DEFAULT_INTENT,
  INTENTS,
  INTENT_PREFERENCE_KEY,
  LIMITS,
  SELECTOR_CONTEXT,
  annotationsView,
  buildTextIndex,
  createAnnotation,
  deleteAnnotation,
  listAnnotations,
  locateOffset,
  normalizeIntent,
  resolveNote,
  selectorFromRangeInIndex,
} from "./annotations.mjs";

type AnyRecord = Record<string, any>;
type TextIndex = { text: string; segments: { node: any; start: number; end: number }[] };
type Selection = { exact: string; prefix: string; suffix: string; start: number; end: number; rect: ClientRectish };
type ClientRectish = { top: number; left: number; right: number; bottom: number; width: number; height: number };

const FRAME_SELECTOR = "iframe[data-annotation-frame]";
const ISLAND_SELECTOR = "[data-annotation-island]";
const HIGHLIGHT_NAME = "hub-annotation";
const ANNOTATION_STYLE_ID = "hub-annotation-style";
// D20: raised from 0.30 so the painted range reads on white AND in dark mode,
// and given an underline as a second cue for anyone who cannot see the tint.
const ANNOTATION_STYLE =
  "::highlight(hub-annotation){background-color:rgba(230,117,31,0.45);text-decoration:underline;text-decoration-color:rgba(150,70,10,0.85);text-underline-offset:2px;}";

/** Framework-free element helper; NEVER innerHTML. */
function el(tag: string, props: AnyRecord = {}, ...children: (Node | string | null | false)[]): HTMLElement {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === "class") node.className = String(value);
    else if (key === "text") node.textContent = String(value);
    else if (key.startsWith("on") && typeof value === "function") {
      node.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
    } else if (key === "dataset") {
      for (const [dataKey, dataValue] of Object.entries(value as AnyRecord)) {
        if (dataValue !== undefined && dataValue !== null) node.dataset[dataKey] = String(dataValue);
      }
    } else node.setAttribute(key, String(value));
  }
  for (const child of children) {
    if (child === null || child === false) continue;
    node.append(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return node;
}

/** The last-used intent, remembered locally (D20); never sent to the server. */
function readStoredIntent(): string {
  try {
    const value = window.localStorage.getItem(INTENT_PREFERENCE_KEY);
    return value ? normalizeIntent(value) : DEFAULT_INTENT;
  } catch {
    return DEFAULT_INTENT;
  }
}

function storeIntent(intent: string): void {
  try {
    window.localStorage.setItem(INTENT_PREFERENCE_KEY, normalizeIntent(intent));
  } catch {
    /* a locked-down profile: the preference simply does not persist */
  }
}

class AnnotationIsland {
  root: HTMLElement;
  section: string;
  source: string;
  slug: string;

  targetDoc: Document | null = null;
  targetWin: Window | null = null;
  indexRoot: Element | null = null;
  frame: HTMLIFrameElement | null = null;
  index: TextIndex | null = null;

  rows: AnyRecord[] = [];
  canWrite = false;
  visible = false;
  intent = DEFAULT_INTENT;
  selection: Selection | null = null;
  composing = false;
  comment = "";
  busy = false;
  message = "";
  confirm: { intent: string; id: string } | null = null;
  confirmTimer: ReturnType<typeof setTimeout> | null = null;

  // The toolbar is built ONCE and its nodes are REUSED (never replaced on a
  // re-render), so a click that starts on a chip and ends on the same node still
  // synthesises a `click` (the main-document-mode bug, D20 patch).
  toolbar: HTMLElement | null = null;
  highlightBtn: HTMLButtonElement | null = null;
  commentBtn: HTMLButtonElement | null = null;
  intentsEl: HTMLElement | null = null;
  chipButtons: Map<string, HTMLButtonElement> = new Map();
  formEl: HTMLFormElement | null = null;
  textareaEl: HTMLTextAreaElement | null = null;
  saveBtn: HTMLButtonElement | null = null;
  cancelBtn: HTMLButtonElement | null = null;
  toast: HTMLElement | null = null;

  constructor(root: HTMLElement, intent: string) {
    this.root = root;
    this.section = root.dataset.itemSection ?? "";
    this.source = root.dataset.itemSource ?? "";
    this.slug = root.dataset.itemSlug ?? "";
    this.intent = intent;
  }

  init(): void {
    this.resolveTarget();
    void this.refresh();
  }

  // --- Target: the payload frame, or the page's own document (D20) ----------

  resolveTarget(): void {
    const frame = document.querySelector<HTMLIFrameElement>(FRAME_SELECTOR);
    if (frame) {
      this.frame = frame;
      const attach = () => {
        const content = frame.contentDocument;
        if (!content) return;
        this.setTarget(content, content.body);
      };
      if (frame.contentDocument?.readyState === "complete") attach();
      frame.addEventListener("load", attach);
      if (frame.contentDocument) attach();
      return;
    }
    // No frame: the page inlines the item. Index the CONTENT ROOT, never the
    // whole body, so the island's own chrome and the site nav are outside the
    // index (a selection of nav text must not become an annotation).
    const contentRoot =
      document.querySelector("[data-annotation-document]") ??
      document.querySelector("main") ??
      document.querySelector("article") ??
      document.body;
    this.setTarget(document, contentRoot as Element);
  }

  setTarget(doc: Document, indexRoot: Element): void {
    this.targetDoc = doc;
    this.targetWin = doc.defaultView ?? window;
    this.indexRoot = indexRoot ?? doc.body;
    this.index = this.buildIndex();
    this.injectStyle();
    this.attachSelectionListeners();
    this.repaint();
    this.renderList();
  }

  /**
   * The item text index. Excludes the island's OWN chrome so that when the
   * target is the page's own `main`/`article` (D20), the words "Notes on this
   * item" and the note rows do not enter the item's text — otherwise a rebuilt
   * index would shift every offset and a selection of the island UI could be
   * annotated.
   */
  buildIndex(): TextIndex {
    if (!this.indexRoot) return { text: "", segments: [] };
    const root = this.root;
    return buildTextIndex(this.indexRoot, {
      skip: (node: any) =>
        node === root ||
        (typeof node.getAttribute === "function" && node.getAttribute("data-annotation-chrome") !== null),
    }) as TextIndex;
  }

  /** True when an event's target is one of the island's own controls. */
  isIslandEvent(event: Event): boolean {
    const target = event.target as Node | null;
    if (!target) return false;
    const element = target.nodeType === 1 ? (target as Element) : target.parentElement;
    return typeof element?.closest === "function" && element.closest("[data-annotation-chrome]") !== null;
  }

  attachSelectionListeners(): void {
    const doc = this.targetDoc;
    if (!doc) return;
    // Ignore events that land on the island's own chrome: a press on a toolbar
    // control must not be read as "the selection changed" (the main-document
    // bug). Keyup/mouseup carry the event; selectionchange does not, so it is
    // additionally guarded by the toolbar holding focus.
    const update = (event?: Event) => {
      if (event && this.isIslandEvent(event)) return;
      this.updateSelection();
    };
    doc.addEventListener("mouseup", (event) => update(event));
    doc.addEventListener("keyup", (event) => update(event));
    // Touch: phones and iPads update the selection without a mouseup (D20).
    // `selectionchange` is debounced so a drag does not fire the handler per word.
    let debounce: ReturnType<typeof setTimeout> | null = null;
    doc.addEventListener("selectionchange", () => {
      if (this.toolbar && doc.activeElement && this.toolbar.contains(doc.activeElement)) return;
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => update(), 150);
    });
  }

  injectStyle(): void {
    const doc = this.targetDoc;
    if (!doc) return;
    if (doc.getElementById(ANNOTATION_STYLE_ID)) return;
    const style = doc.createElement("style");
    style.id = ANNOTATION_STYLE_ID;
    style.textContent = ANNOTATION_STYLE;
    doc.head?.appendChild(style);
  }

  // --- Data ----------------------------------------------------------------

  async refresh(): Promise<void> {
    const result = await listAnnotations({ source: this.source, slug: this.slug });
    const view = annotationsView(result);
    // A 403 means "no member session, or no write capability". Render NOTHING:
    // a signed-out visitor must not even learn the feature is here.
    if (view.kind !== "ready") {
      this.renderNothing();
      return;
    }
    // Defense in depth: the gate filters by (source, slug), which ADR-0021 says
    // is unique across the hub; also match `section` so a row from a same-named
    // item under another section can never be shown here.
    this.rows = (view.rows as AnyRecord[]).filter(
      (row) =>
        (row.section === undefined || row.section === this.section) &&
        (row.source === undefined || row.source === this.source) &&
        (row.slug === undefined || row.slug === this.slug),
    );
    this.canWrite = view.canWrite;
    this.visible = true;
    this.root.hidden = false;
    this.renderList();
    this.repaint();
  }

  /**
   * Whether the capture UI may be shown at all. False until the gate has
   * answered with a session AND write capability, and false again after a 403.
   * THE 403 RENDERS NOTHING (D20): a signed-out visitor who selects text must not
   * see a toolbar, and clicking it must never POST. Wave 6's React island gated
   * its toolbar on `view.canWrite`; the rewrite must keep that gate.
   */
  canCapture(): boolean {
    return this.visible && this.canWrite;
  }

  renderNothing(): void {
    this.visible = false;
    this.canWrite = false;
    this.rows = [];
    this.selection = null;
    this.hideToolbar();
    this.clearConfirm();
    this.root.replaceChildren();
    this.root.hidden = true;
    if (this.targetDoc) {
      try {
        (this.targetDoc.defaultView as any)?.CSS?.highlights?.delete(HIGHLIGHT_NAME);
      } catch {
        /* no Highlight API */
      }
    }
  }

  // --- Selection and toolbar ----------------------------------------------

  updateSelection(): void {
    // No session (or no write capability): never show the capture chrome.
    if (!this.canCapture()) {
      this.hideToolbar();
      return;
    }
    const doc = this.targetDoc;
    const win = this.targetWin;
    if (!doc || !win) return;
    const selection = win.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      this.hideToolbar();
      return;
    }
    const range = selection.getRangeAt(0);
    if (this.indexRoot && !this.indexRoot.contains(range.commonAncestorContainer)) {
      this.hideToolbar();
      return;
    }
    const index = this.buildIndex();
    this.index = index;
    const selector = selectorFromRangeInIndex(range, index, { context: SELECTOR_CONTEXT });
    if (!selector || selector.exact.trim() === "") {
      this.hideToolbar();
      return;
    }
    this.selection = { ...selector, rect: this.rangeRect(range) };
    this.showToolbar();
  }

  rangeRect(range: Range): ClientRectish {
    const rect = range.getBoundingClientRect();
    if (this.frame) {
      const frameRect = this.frame.getBoundingClientRect();
      return {
        top: rect.top + frameRect.top,
        left: rect.left + frameRect.left,
        right: rect.right + frameRect.left,
        bottom: rect.bottom + frameRect.top,
        width: rect.width,
        height: rect.height,
      };
    }
    return { top: rect.top, left: rect.left, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height };
  }

  /**
   * Build the toolbar ONCE and keep its nodes for the island's lifetime. Every
   * control gets its OWN click handler, and the whole toolbar swallows
   * mousedown/mouseup/pointerdown/pointerup with preventDefault + stopPropagation
   * so the selection is not collapsed and focus does not move. Together these are
   * the D20 main-document fix: without them, a press on a chip collapses the
   * selection on mousedown, the island re-renders and REPLACES the button, and
   * mouseup lands on a different node so the browser synthesises NO click.
   */
  ensureToolbar(): HTMLElement {
    if (!this.toolbar) {
      const toolbar = el("div", {
        class: "annotation-toolbar",
        role: "toolbar",
        "aria-label": "Annotation actions",
        "data-annotation-toolbar": "1",
        "data-annotation-chrome": "1",
      });
      const hold = (event: Event) => {
        event.preventDefault();
        event.stopPropagation();
      };
      for (const type of ["mousedown", "mouseup", "pointerdown", "pointerup"]) {
        toolbar.addEventListener(type, hold);
      }

      this.highlightBtn = el("button", { type: "button", class: "annotation-btn is-primary" }, "Highlight") as HTMLButtonElement;
      this.highlightBtn.addEventListener("click", (event) => {
        event.preventDefault();
        void this.save("");
      });
      this.commentBtn = el("button", { type: "button", class: "annotation-btn" }, "Comment") as HTMLButtonElement;
      this.commentBtn.addEventListener("click", (event) => {
        event.preventDefault();
        this.composing = true;
        this.syncToolbar();
      });

      this.intentsEl = el("div", { class: "annotation-intents", role: "radiogroup", "aria-label": "Intent" });
      for (const value of INTENTS) {
        const chip = el(
          "button",
          { type: "button", class: "annotation-intent-chip", role: "radio", "aria-checked": "false" },
          value,
        ) as HTMLButtonElement;
        chip.addEventListener("click", (event) => {
          event.preventDefault();
          this.intent = normalizeIntent(value);
          storeIntent(this.intent);
          this.syncToolbar();
        });
        this.chipButtons.set(value, chip);
        this.intentsEl.append(chip);
      }

      this.textareaEl = el("textarea", {
        class: "annotation-comment-input",
        maxlength: String(LIMITS.commentMax),
      }) as HTMLTextAreaElement;
      this.textareaEl.addEventListener("input", () => {
        this.comment = this.textareaEl?.value ?? "";
      });
      this.saveBtn = el("button", { type: "submit", class: "annotation-btn is-primary" }, "Save") as HTMLButtonElement;
      this.cancelBtn = el("button", { type: "button", class: "annotation-btn" }, "Cancel") as HTMLButtonElement;
      this.cancelBtn.addEventListener("click", (event) => {
        event.preventDefault();
        this.composing = false;
        this.comment = "";
        this.syncToolbar();
      });
      this.formEl = el(
        "form",
        { class: "annotation-form" },
        el("label", { class: "annotation-form-label", text: "Comment" }),
        this.textareaEl,
        el("div", { class: "annotation-actions" }, this.saveBtn, this.cancelBtn),
      ) as HTMLFormElement;
      this.formEl.addEventListener("submit", (event) => {
        event.preventDefault();
        void this.save(this.comment);
      });

      toolbar.append(this.highlightBtn, this.commentBtn, this.intentsEl, this.formEl);
      this.toolbar = toolbar;
    }
    // Re-attach the SAME node if a previous hide detached it (node identity is
    // what keeps the click alive across a hide/show).
    if (this.toolbar.parentNode !== document.body) document.body.append(this.toolbar);
    return this.toolbar;
  }

  /** Update the persistent toolbar's state WITHOUT replacing any node. */
  syncToolbar(): void {
    for (const [value, chip] of this.chipButtons) {
      const active = this.intent === value;
      chip.classList.toggle("is-active", active);
      chip.setAttribute("aria-checked", active ? "true" : "false");
      chip.disabled = this.busy;
    }
    if (this.highlightBtn) {
      this.highlightBtn.disabled = this.busy;
      this.highlightBtn.style.display = this.composing ? "none" : "";
    }
    if (this.commentBtn) {
      this.commentBtn.disabled = this.busy;
      this.commentBtn.style.display = this.composing ? "none" : "";
    }
    if (this.saveBtn) this.saveBtn.disabled = this.busy;
    if (this.cancelBtn) this.cancelBtn.disabled = this.busy;
    if (this.formEl) this.formEl.style.display = this.composing ? "flex" : "none";
    if (this.textareaEl) this.textareaEl.value = this.comment;
  }

  hideToolbar(): void {
    this.selection = null;
    this.composing = false;
    // Detach but KEEP the node (and its stable children) for the next selection.
    if (this.toolbar) this.toolbar.remove();
  }

  showToolbar(): void {
    // The single choke point: no session → the toolbar is never drawn.
    if (!this.canCapture()) {
      this.hideToolbar();
      return;
    }
    this.ensureToolbar();
    this.syncToolbar();
    this.positionToolbar();
  }

  /** Anchor the toolbar above (else below) the selection, clamped to the viewport. */
  positionToolbar(): void {
    const toolbar = this.toolbar;
    if (!toolbar) return;
    toolbar.style.visibility = "hidden";
    toolbar.style.display = "flex";
    const tw = toolbar.offsetWidth;
    const th = toolbar.offsetHeight;
    const rect = this.selection?.rect;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = rect ? rect.left + rect.width / 2 - tw / 2 : vw / 2 - tw / 2;
    left = Math.max(8, Math.min(left, vw - tw - 8));
    let top = rect ? rect.top - th - 10 : 8;
    if (top < 8) top = rect ? rect.bottom + 10 : 8;
    top = Math.max(8, Math.min(top, vh - th - 8));
    toolbar.style.left = `${Math.round(left)}px`;
    toolbar.style.top = `${Math.round(top)}px`;
    toolbar.style.visibility = "visible";
  }

  // --- Save / undo / delete -----------------------------------------------

  async save(text: string): Promise<void> {
    const current = this.selection;
    if (!current) return;
    const index = this.index ?? this.buildIndex();
    if (!index.text) return;
    this.busy = true;
    this.message = "";
    const chosenIntent = normalizeIntent(this.intent);
    const outcome = await createAnnotation({
      section: this.section,
      source: this.source,
      slug: this.slug,
      selector: { exact: current.exact, prefix: current.prefix, suffix: current.suffix },
      position: { start: current.start, end: current.end },
      quote: current.exact,
      comment: text,
      intent: chosenIntent,
      tags: [],
    });
    this.busy = false;
    if (!outcome.ok) {
      this.message =
        outcome.reason === "forbidden"
          ? "Read-only: you cannot add notes here."
          : "Could not save that note. Try again shortly.";
      this.showToolbar();
      return;
    }
    storeIntent(chosenIntent);
    // Optimistic row so the highlight is painted IMMEDIATELY, before the refetch.
    const row: AnyRecord = {
      id: outcome.id,
      section: this.section,
      source: this.source,
      slug: this.slug,
      intent: chosenIntent,
      selector: { type: "TextQuoteSelector", exact: current.exact, prefix: current.prefix, suffix: current.suffix },
      position: { type: "TextPositionSelector", start: current.start, end: current.end },
      quote: current.exact,
      comment: text,
      tags: [],
      created: new Date().toISOString(),
    };
    this.rows = [row, ...this.rows];
    // COLLAPSE THE SELECTION so the browser's own blue selection overlay does not
    // sit on top of the painted highlight and hide the colour (D20).
    try {
      this.targetWin?.getSelection()?.removeAllRanges();
    } catch {
      /* an engine without getSelection on the target */
    }
    this.selection = null;
    this.composing = false;
    this.comment = "";
    this.hideToolbar();
    this.repaint();
    this.renderList();
    this.showConfirm(chosenIntent, outcome.id);
    void this.refresh();
  }

  showConfirm(intent: string, id: string): void {
    this.clearConfirm();
    this.confirm = { intent, id };
    this.toast = el(
      "div",
      { class: "annotation-toast", role: "status", "data-annotation-toast": "1", "data-annotation-chrome": "1" },
      el("span", { class: "annotation-toast-text", text: `Saved · ${intent}` }),
      el(
        "button",
        {
          type: "button",
          class: "annotation-btn",
          onclick: () => void this.undo(),
        },
        "Undo",
      ),
    );
    document.body.append(this.toast);
    this.confirmTimer = setTimeout(() => this.clearConfirm(), 6000);
  }

  clearConfirm(): void {
    if (this.confirmTimer) clearTimeout(this.confirmTimer);
    this.confirmTimer = null;
    this.confirm = null;
    if (this.toast) {
      this.toast.remove();
      this.toast = null;
    }
  }

  async undo(): Promise<void> {
    const confirm = this.confirm;
    this.clearConfirm();
    if (!confirm) return;
    const outcome = await deleteAnnotation(confirm.id);
    if (outcome.ok) {
      this.rows = this.rows.filter((row) => row.id !== confirm.id);
      this.repaint();
      this.renderList();
    } else {
      await this.refresh();
    }
  }

  async onDelete(id: string): Promise<void> {
    this.busy = true;
    this.message = "";
    const outcome = await deleteAnnotation(id);
    this.busy = false;
    if (!outcome.ok) {
      this.message =
        outcome.reason === "forbidden" ? "Read-only: you cannot delete that note." : "Could not delete that note.";
      this.renderList();
      return;
    }
    this.rows = this.rows.filter((row) => row.id !== id);
    this.repaint();
    this.renderList();
  }

  // --- Painting and list ---------------------------------------------------

  repaint(): void {
    const doc = this.targetDoc;
    const win = doc?.defaultView as any;
    const index = this.index;
    if (!doc || !index) return;
    const registry = win?.CSS?.highlights;
    const HighlightCtor = win?.Highlight;
    if (!registry || !HighlightCtor) return;
    const ranges: any[] = [];
    for (const note of this.rows) {
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
        /* an unrepresentable anchor is still listed as text in the panel */
      }
    }
    try {
      if (ranges.length === 0) registry.delete(HIGHLIGHT_NAME);
      else registry.set(HIGHLIGHT_NAME, new HighlightCtor(...ranges));
    } catch {
      /* an engine without the API: the panel still lists every note */
    }
  }

  renderList(): void {
    if (!this.visible) return;
    const panel = el("section", { class: "annotation-notes", "aria-label": "Notes on this item" });
    panel.append(el("h2", { class: "annotation-notes-title", text: "Notes on this item" }));
    if (this.message) panel.append(el("p", { class: "annotation-message", role: "alert", text: this.message }));
    if (this.rows.length === 0) panel.append(el("p", { class: "annotation-empty", text: "No notes yet. Select text to begin." }));

    if (this.rows.length > 0) {
      const list = el("ul", { class: "annotation-list" });
      for (const note of this.rows) {
        const resolved = this.index ? resolveNote(note, this.index.text) : { anchor: "unknown" };
        const item = el("li", { class: "annotation-note" });
        const head = el("div", { class: "annotation-note-head" });
        head.append(el("span", { class: "annotation-intent", text: String(note.intent ?? DEFAULT_INTENT) }));
        if (resolved.anchor === "orphan") head.append(el("span", { class: "annotation-orphan", text: "Orphan" }));
        item.append(head);
        item.append(el("blockquote", { class: "annotation-quote", text: String(note.quote ?? note.selector?.exact ?? "") }));
        if (note.comment) item.append(el("p", { class: "annotation-comment", text: String(note.comment) }));
        if (this.canWrite) {
          item.append(
            el(
              "button",
              {
                type: "button",
                class: "annotation-btn",
                disabled: this.busy,
                onclick: () => void this.onDelete(String(note.id)),
              },
              "Delete",
            ),
          );
        }
        list.append(item);
      }
      panel.append(list);
    }

    const toggle = el(
      "button",
      {
        type: "button",
        class: "annotation-notes-toggle",
        "aria-expanded": "false",
        onclick: (event: Event) => {
          const button = event.currentTarget as HTMLButtonElement;
          const open = panel.classList.toggle("is-open");
          button.setAttribute("aria-expanded", open ? "true" : "false");
        },
      },
      `Notes (${this.rows.length})`,
    );

    this.root.replaceChildren(toggle, panel);
  }
}

/**
 * Mount every `[data-annotation-island]` on the page. Idempotent: a root
 * already marked mounted is skipped, so a second call (or a partial hydration)
 * cannot double-attach listeners.
 */
export function mountAnnotationIslands(): void {
  const intent = readStoredIntent();
  document.querySelectorAll<HTMLElement>(ISLAND_SELECTOR).forEach((root) => {
    if (root.dataset.annotationMounted) return;
    root.dataset.annotationMounted = "1";
    new AnnotationIsland(root, intent).init();
  });
}
