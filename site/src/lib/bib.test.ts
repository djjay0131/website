import { describe, it, expect } from "vitest";
import path from "node:path";
import { parseBib, parseBibFlat } from "./bib";

const BIB_PATH = path.resolve("data/own-bib.bib");

describe("parseBib", () => {
  it("parses real own-bib.bib into grouped entries", () => {
    const groups = parseBib(BIB_PATH);
    const all = [...groups.articles, ...groups.proceedings, ...groups.books, ...groups.other];
    expect(all.length).toBeGreaterThan(0);
  });

  it("extracts title and authors", () => {
    const all = parseBibFlat(BIB_PATH);
    const entry = all[0];
    expect(entry.title).toBeTruthy();
    expect(entry.authors.length).toBeGreaterThan(0);
    expect(entry.year).toBeGreaterThan(2000);
  });

  it("includes Jason as author", () => {
    const all = parseBibFlat(BIB_PATH);
    const jasonPaper = all.find((p) =>
      p.authors.some((a) => a.includes("Cusati"))
    );
    expect(jasonPaper).toBeTruthy();
  });

  it("has url field from bib", () => {
    const all = parseBibFlat(BIB_PATH);
    const withUrl = all.find((p) => p.url);
    expect(withUrl).toBeTruthy();
    expect(withUrl!.url).toContain("http");
  });

  it("entries without github field have undefined github", () => {
    const all = parseBibFlat(BIB_PATH);
    const noGh = all.find((p) => !p.github);
    expect(noGh).toBeTruthy();
    expect(noGh!.github).toBeUndefined();
  });
});
