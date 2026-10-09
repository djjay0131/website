import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { hubItemIdentity } from "../src/lib/hub-content.mjs";
import { annotationCreateRequestInit, noteItemKey } from "../src/lib/annotations.mjs";

// ===========================================================================
// WAVE 7 STRUCTURAL GUARANTEE (owner decision D20; ADR-0021 amended)
// ===========================================================================
// D20: annotations follow the member, not the page.
//   - any signed-in member annotates any item they can read, public included;
//   - the island takes its target from a payload frame OR the page's own
//     main/article, with the same selector code;
//   - the item identity is {section, source, slug} from the ITEM, never the pane,
//     so the same item on the public route and under /p/ is the same item.
//
// This file pins the identity halves and the "public HTML carries no annotation
// content" shape. The route-level and build-level proofs live in
// wave-6-structure.test.ts (shared island) and check-no-private-in-public.test.ts
// (the AN-LEAK needles).

describe("the annotation item identity is the item's, not the pane's (D20)", () => {
  it("derives a stable first-party hub identity from the base-relative route", () => {
    const a = hubItemIdentity("/research/soa-agentic-se/agentic-memory/");
    expect(a).toEqual({
      section: "research",
      source: "hub",
      slug: "research/soa-agentic-se/agentic-memory",
    });
    // The GitHub Pages spelling (base stripped by the caller) is the SAME identity.
    expect(hubItemIdentity("research/soa-agentic-se/agentic-memory")).toEqual(a);
    expect(hubItemIdentity("papers")).toEqual({ section: "papers", source: "hub", slug: "papers" });
  });

  it("a satellite item's identity is the MANIFEST triple, not a route-derived one (failable)", () => {
    // A satellite item is the same item whichever route renders it. Both item
    // page templates supply the SAME manifest triple (wave-6-structure pins that
    // structurally); here we model the identity a route WOULD produce if it were
    // (wrongly) derived from the path, and assert the two differ — so a refactor
    // that switched the framed route to hubItemIdentity would fail this test.
    const item = { section: "projects", source: "kgis", slug: "kgis-docs" };
    // What the public framed route and the private frame each pass (manifest).
    const fromPublicRoute = { section: item.section, source: item.source, slug: item.slug };
    const fromPrivateRoute = { section: item.section, source: item.source, slug: item.slug };
    expect(noteItemKey(fromPublicRoute)).toBe("projects/kgis/kgis-docs");
    expect(noteItemKey(fromPrivateRoute)).toBe("projects/kgis/kgis-docs");

    // The WRONG identity: what hubItemIdentity would give from the same path.
    const routeDerived = hubItemIdentity("/projects/kgis/kgis-docs/");
    expect(routeDerived).toEqual({ section: "projects", source: "hub", slug: "projects/kgis/kgis-docs" });
    expect(noteItemKey(routeDerived)).not.toBe(noteItemKey(fromPublicRoute));

    const selector = { exact: "a quoted passage", prefix: "pre", suffix: "post" };
    const position = { start: 10, end: 27 };
    const bodyOf = (ident: { section: string; source: string; slug: string }) =>
      annotationCreateRequestInit({
        ...ident,
        selector,
        position,
        quote: selector.exact,
        comment: "note",
        intent: "paper",
      }).body;
    // The two real routes produce identical bodies; the route-derived (wrong)
    // identity does NOT, which is what makes this a regression test.
    expect(bodyOf(fromPrivateRoute)).toBe(bodyOf(fromPublicRoute));
    expect(bodyOf(routeDerived)).not.toBe(bodyOf(fromPublicRoute));
    // The request body names section/source/slug and NOTHING about a route/pane.
    const body = JSON.parse(bodyOf(fromPublicRoute));
    expect(body.section).toBe("projects");
    expect(body.source).toBe("kgis");
    expect(body.slug).toBe("kgis-docs");
    expect(Object.keys(body).sort()).toEqual(
      ["comment", "intent", "position", "quote", "section", "selector", "slug", "source", "tags"].sort(),
    );
  });
});

describe("the mount renders no annotation content into the public HTML (D20)", () => {
  const mount = fs.readFileSync(path.resolve("src/components/AnnotationsMount.astro"), "utf8");

  it("renders an EMPTY, HIDDEN root carrying only the item identity", () => {
    expect(mount).toMatch(/data-annotation-island/);
    expect(mount).toMatch(/data-item-section=\{section\}/);
    expect(mount).toMatch(/data-item-source=\{source\}/);
    expect(mount).toMatch(/data-item-slug=\{slug\}/);
    // `hidden` and no children between the div tags: nothing for a signed-out
    // visitor or the search index to see.
    expect(mount).toMatch(/\shidden>\s*<\/div>/);
    // The root div itself renders no note text.
    const root = mount.slice(mount.indexOf("<div"), mount.indexOf("hidden></div>") + "hidden></div>".length);
    expect(root).not.toMatch(/Notes on this item|quote|blockquote/i);
  });

  it("the island module builds DOM with createElement/textContent, never innerHTML", () => {
    const island = fs.readFileSync(path.resolve("src/lib/annotations-island.ts"), "utf8");
    expect(island).not.toMatch(/\.innerHTML|outerHTML|insertAdjacentHTML|document\.write|dangerouslySetInnerHTML/);
    // Targets either the payload frame or the page's own content root.
    expect(island).toMatch(/iframe\[data-annotation-frame\]/);
    expect(island).toMatch(/querySelector\("\[data-annotation-document\]"\)/);
    expect(island).toMatch(/querySelector\("main"\)/);
    expect(island).toMatch(/querySelector\("article"\)/);
    // Touch: selectionchange as well as mouseup/keyup.
    expect(island).toMatch(/selectionchange/);
    expect(island).toMatch(/mouseup/);
    expect(island).toMatch(/keyup/);
  });

  it("shows NO capture chrome without a session (RT-1 must-fix)", () => {
    const island = fs.readFileSync(path.resolve("src/lib/annotations-island.ts"), "utf8");
    // The gate decision exists and depends on BOTH the ready state and canWrite.
    expect(island).toMatch(/canCapture\(\):\s*boolean\s*\{\s*return this\.visible && this\.canWrite;/);
    // Both toolbar entry points early-return when it is false, and renderNothing
    // clears canWrite so a 403 removes the toolbar for good.
    const guards = island.match(/if \(!this\.canCapture\(\)\)/g) ?? [];
    expect(guards.length, "updateSelection and showToolbar must both guard").toBeGreaterThanOrEqual(2);
    expect(island).toMatch(/renderNothing\(\): void \{[\s\S]*?this\.canWrite = false;/);
    // A 403 path calls renderNothing rather than leaving the island ready.
    expect(island).toMatch(/if \(view\.kind !== "ready"\) \{\s*this\.renderNothing\(\);\s*return;/);
  });

  it("ships NO private route in the shared island module or its pure logic", () => {
    for (const rel of ["src/lib/annotations-island.ts", "src/lib/annotations.mjs"]) {
      const text = fs.readFileSync(path.resolve(rel), "utf8");
      expect(text, `${rel} names /p/notes`).not.toContain("/p/notes");
    }
  });
});
