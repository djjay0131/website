import { describe, it, expect } from "vitest";
import {
  PRIVATE_ITEMS_ENDPOINT,
  itemsFromResponse,
  loadPrivateItems,
  shareableItems,
} from "./private-items.mjs";

describe("the viewer's item list", () => {
  it("uses the gate endpoint and same-origin credentials", async () => {
    let seen: any = null;
    const result = await loadPrivateItems({
      fetch: async (url: string, init: any) => {
        seen = { url, init };
        return { ok: true, json: async () => ({ items: [{ slug: "a" }] }) };
      },
    });
    expect(seen.url).toBe(PRIVATE_ITEMS_ENDPOINT);
    expect(seen.init.credentials).toBe("same-origin");
    expect(result).toEqual({ ok: true, items: [{ slug: "a" }] });
  });

  it("treats a refusal or bad body as an empty list, never a static catalogue", async () => {
    expect((await loadPrivateItems({ fetch: async () => ({ ok: false }) })).items).toEqual([]);
    expect(itemsFromResponse({ items: "nope" })).toEqual([]);
    expect(itemsFromResponse(null)).toEqual([]);
  });

  it("offers only private, document-bearing items to the share form", () => {
    const items = [
      { slug: "private", visibility: "private", source: "s", entry: "a.html" },
      { slug: "public", visibility: "public", source: "s", entry: "b.html" },
      { slug: "data", visibility: "private", source: "s", entry: "" },
      { slug: "hub", visibility: "private", source: "hub", entry: "index.html" },
    ];
    expect(shareableItems(items).map((item) => item.slug)).toEqual(["private"]);
  });
});
