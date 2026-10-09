// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mountAnnotationIslands } from "./annotations-island.ts";

// ===========================================================================
// THE MAIN-DOCUMENT CLICK REGRESSION (D20 patch; owner live test 2026-10-09)
// ===========================================================================
// On a page that inlines the item (main-document target), a REAL press on a
// toolbar control did nothing: mousedown cleared the selection, the island
// re-rendered and replaced the button, and mouseup landed on a different node so
// the browser synthesised no `click`. This file drives the island with REAL
// MouseEvents in a DOM (jsdom) and pins the three fixes:
//   - mousedown on the toolbar is defaultPrevented (selection not disturbed);
//   - the toolbar nodes are STABLE across a selectionchange (no replacement);
//   - a real click on a chip changes the intent, and on Highlight saves.
// It FAILS on the pre-patch island, which is the point.

type FetchInit = { method?: string; body?: string };

function response(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

/** Let the island's async refresh settle (fetch resolves on a macrotask). */
async function flush(times = 3): Promise<void> {
  for (let i = 0; i < times; i += 1) await new Promise((r) => setTimeout(r, 0));
}

function setupDom(): void {
  document.body.innerHTML = `
    <main id="main-content">
      <article class="item-body">
        <p id="text">The quick brown fox jumps over the lazy dog and then sleeps.</p>
      </article>
    </main>
    <div class="annotations-island" data-annotation-island
         data-item-section="research" data-item-source="hub"
         data-item-slug="research/soa-agentic-se/agentic-harnesses" hidden></div>`;
  // jsdom has no layout: give Range a zero rect so positioning does not throw.
  if (typeof Range !== "undefined" && !Range.prototype.getBoundingClientRect) {
    (Range.prototype as any).getBoundingClientRect = () => ({
      top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0,
    });
  }
}

function selectText(): void {
  const node = document.getElementById("text")!.firstChild!;
  const range = document.createRange();
  range.setStart(node, 4);
  range.setEnd(node, 15);
  const selection = window.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
}

function chipWithText(label: string): HTMLButtonElement | undefined {
  return [...document.querySelectorAll<HTMLButtonElement>(".annotation-intent-chip")].find(
    (button) => button.textContent === label,
  );
}

function buttonWithText(label: string): HTMLButtonElement | undefined {
  return [...document.querySelectorAll<HTMLButtonElement>(".annotation-toolbar button")].find(
    (button) => button.textContent === label,
  );
}

/** A real press: mousedown, mouseup, click on the same node. */
function realClick(element: HTMLElement): void {
  for (const type of ["mousedown", "mouseup", "click"]) {
    element.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true }));
  }
}

describe("capture island works with real mouse events on the page's own document (D20 patch)", () => {
  beforeEach(async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: unknown, init: FetchInit = {}) => {
        if (init.method === "POST") return response(201, { id: "note-1" });
        if (init.method === "DELETE") return response(200, {});
        return response(200, { notes: [] });
      }),
    );
    setupDom();
    mountAnnotationIslands();
    await flush();
    selectText();
    document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
    window.localStorage.clear();
  });

  it("keeps the toolbar nodes STABLE across a selectionchange (no replace mid-click)", async () => {
    const chip = chipWithText("brainstorm");
    expect(chip, "the toolbar is shown and the brainstorm chip exists").toBeTruthy();
    document.dispatchEvent(new Event("selectionchange"));
    await new Promise((r) => setTimeout(r, 250)); // outlast the 150ms debounce
    expect(chipWithText("brainstorm"), "the chip node must not be replaced").toBe(chip);
  });

  it("defaultPrevents the mousedown so the selection is not collapsed", () => {
    const chip = chipWithText("brainstorm")!;
    const down = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
    const notCancelled = chip.dispatchEvent(down);
    expect(notCancelled, "a handler called preventDefault").toBe(false);
    expect(down.defaultPrevented).toBe(true);
  });

  it("changes the intent on a real click on a chip", () => {
    expect(chipWithText("paper")!.classList.contains("is-active")).toBe(true);
    realClick(chipWithText("brainstorm")!);
    expect(chipWithText("brainstorm")!.classList.contains("is-active")).toBe(true);
    expect(chipWithText("paper")!.classList.contains("is-active")).toBe(false);
  });

  it("saves on a real click on Highlight and shows 'Saved' with Undo", async () => {
    realClick(chipWithText("brainstorm")!);
    realClick(buttonWithText("Highlight")!);
    await flush();
    const toast = document.querySelector(".annotation-toast");
    expect(toast, "the post-save toast appears").toBeTruthy();
    expect(toast!.textContent).toContain("Saved");
    expect(toast!.querySelector("button")?.textContent).toBe("Undo");
    const post = (fetch as any).mock.calls.find(([, init]: [unknown, FetchInit]) => init?.method === "POST");
    expect(post, "a POST /annotations was issued").toBeTruthy();
    expect(JSON.parse(post[1].body).intent).toBe("brainstorm");
  });
});
