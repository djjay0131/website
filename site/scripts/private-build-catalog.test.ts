import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { privateBuild } from "./private-build.mjs";
import { CATALOG_OBJECT } from "../src-private/lib/catalog.mjs";

// Synthetic names only: the repository is public.
const SOURCE = "source-a";
const ITEM = "section-a/source-a/slug-private";

let sources: string;
let outDir: string;

beforeAll(async () => {
  sources = fs.mkdtempSync(path.join(os.tmpdir(), "private-catalog-sources-"));
  outDir = fs.mkdtempSync(path.join(os.tmpdir(), "private-catalog-out-"));
  const dir = path.join(sources, SOURCE);
  fs.mkdirSync(path.join(dir, "site"), { recursive: true });
  fs.writeFileSync(path.join(dir, "site", "private.html"), "<h1>Private</h1>");
  fs.writeFileSync(
    path.join(dir, "manifest.json"),
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
      ],
    }),
  );
  const integration = privateBuild({ sourcesDir: sources });
  const done = integration.hooks["astro:build:done"] as unknown as (ctx: {
    dir: URL;
    pages: unknown[];
    logger: { info: (message: string) => void };
  }) => Promise<void>;
  await done({ dir: pathToFileURL(outDir), pages: [], logger: { info: () => {} } });
});

afterAll(() => {
  for (const dir of [sources, outDir]) {
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("the private build's _hub catalog", () => {
  const catalog = () =>
    JSON.parse(fs.readFileSync(path.join(outDir, CATALOG_OBJECT), "utf8"));

  it("writes item metadata and an object -> item map", () => {
    const document = catalog();
    expect(document.version).toBe(2);
    expect(document.items[ITEM].visibility).toBe("private");
    expect(document.objects[`_payload/${SOURCE}/site/private.html`]).toEqual([ITEM]);
    expect(document.objects[`${ITEM}/_doc/private.html`]).toEqual([ITEM]);
  });

  it("carries no groups or roles and does not write the old access object", () => {
    const document = catalog();
    for (const item of Object.values(document.items) as Record<string, unknown>[]) {
      expect(item).not.toHaveProperty("access");
      expect(item).not.toHaveProperty("groups");
      expect(item).not.toHaveProperty("roles");
    }
    for (const keys of Object.values(document.objects)) {
      expect(Array.isArray(keys)).toBe(true);
    }
    expect(fs.existsSync(path.join(outDir, "_hub/access.json"))).toBe(false);
  });
});
