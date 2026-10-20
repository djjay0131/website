import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parsePublishAllowlist } from "../../src/lib/hub-content.mjs";
import { buildItemCatalog, itemKey } from "./catalog.mjs";

// Synthetic names only: this repository is public, and these tests must not
// reveal what private content exists or who it is for.
const SOURCE = "source-a";

let root: string;
let catalog: ReturnType<typeof buildItemCatalog>;

beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "catalog-test-"));
  const sourceDir = path.join(root, SOURCE);
  fs.mkdirSync(path.join(sourceDir, "site"), { recursive: true });
  fs.writeFileSync(path.join(sourceDir, "site", "private.html"), "<h1>Private</h1>");
  fs.writeFileSync(path.join(sourceDir, "site", "public.html"), "<h1>Public</h1>");
  fs.writeFileSync(
    path.join(sourceDir, "manifest.json"),
    JSON.stringify({
      source: SOURCE,
      manifest_version: "1",
      published: "2026-10-19T00:00:00Z",
      items: [
        {
          slug: "slug-private",
          title: "Private Item",
          section: "section-a",
          format: "html",
          path: "site/private.html",
          visibility: "private",
          date: "2026-10-19",
          summary: "A private fixture.",
          tags: [],
        },
        {
          slug: "slug-public",
          title: "Public Item",
          section: "section-a",
          format: "html",
          path: "site/public.html",
          visibility: "public",
          date: "2026-10-19",
          summary: "A public fixture.",
          tags: [],
        },
        {
          slug: "slug-data",
          title: "Data Item",
          section: "section-a",
          format: "data",
          path: "data.json",
          visibility: "private",
          date: "2026-10-19",
          schema_version: "1",
          summary: "A data fixture.",
          tags: [],
        },
      ],
    }),
  );
  catalog = buildItemCatalog({
    sourcesDir: root,
    allowlist: parsePublishAllowlist({
      version: 1,
      items: [{ source: SOURCE, slug: "slug-public" }],
    }),
    base: "/p/",
  });
});

afterAll(() => {
  if (root) fs.rmSync(root, { recursive: true, force: true });
});

describe("the private build's catalog", () => {
  it("lists every non-data item and carries no access decision", () => {
    expect(Object.keys(catalog.items).sort()).toEqual([
      itemKey("section-a", SOURCE, "slug-private"),
      itemKey("section-a", SOURCE, "slug-public"),
    ]);
    for (const item of Object.values(catalog.items)) {
      expect(item).not.toHaveProperty("access");
      expect(item).not.toHaveProperty("groups");
      expect(item).not.toHaveProperty("roles");
    }
  });

  it("uses the /p/ route for a private item and the public route for an allowlisted one", () => {
    const privateItem = catalog.items[itemKey("section-a", SOURCE, "slug-private")];
    const publicItem = catalog.items[itemKey("section-a", SOURCE, "slug-public")];
    expect(privateItem.visibility).toBe("private");
    expect(privateItem.href).toBe("/p/projects/source-a/slug-private/");
    expect(privateItem.entry).toBe("private.html");
    expect(publicItem.visibility).toBe("public");
    expect(publicItem.href).toBe("https://jason.cusati.us/section-a/source-a/slug-public/");
  });

  it("does not treat a manifest 'public' item as public unless allowlisted", () => {
    const unallowlisted = buildItemCatalog({
      sourcesDir: root,
      allowlist: parsePublishAllowlist({ version: 1, items: [] }),
      base: "/p/",
    });
    expect(unallowlisted.items[itemKey("section-a", SOURCE, "slug-public")].visibility).toBe(
      "private",
    );
  });
});
