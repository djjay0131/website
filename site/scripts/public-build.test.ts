import { describe, it, expect } from "vitest";
import { mixedSourceError } from "./public-build.mjs";

const publicRoot = { visibility: "public", format: "html", path: "index.html" };
const privateItem = { visibility: "private", format: "html", path: "site/secret.html" };
const publicNamed = { visibility: "public", format: "html", path: "site/index.html" };
const publicPdf = { visibility: "public", format: "pdf", path: "academic.pdf" };

describe("mixedSourceError refuses to stage a folder that may hold private bytes", () => {
  it("allows a source whose items are all public (the kgis case)", () => {
    expect(mixedSourceError([publicRoot], "kgis")).toBeNull();
  });

  it("SHOWS RED on a private item plus a prefix-root framed public item", () => {
    // The prefix-root rule stages the whole source prefix; the hub cannot tell
    // which bytes are private. It must fail closed rather than copy them.
    const error = mixedSourceError([privateItem, publicRoot], "mixed");
    expect(error).toMatch(/mixes visibility/);
    expect(error).toMatch(/prefix root/);
  });

  it("allows a private item plus a framed item in a NAMED subdirectory", () => {
    // The named-directory rule filters withdrawn documents and does not walk the
    // whole prefix, so the ambiguity does not arise.
    expect(mixedSourceError([privateItem, publicNamed], "mixed")).toBeNull();
  });

  it("ignores non-framed public items", () => {
    expect(mixedSourceError([privateItem, publicPdf], "mixed")).toBeNull();
  });
});
