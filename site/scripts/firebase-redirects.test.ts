import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// owner D22 / ADR-0024: /resumes/ and the retired CV slugs 301 to their
// replacements, and the private Fellow CV keeps its 302-to-/signin/ guard.
const CONFIG = JSON.parse(fs.readFileSync(path.resolve("../firebase.json"), "utf8"));
const redirects: { source: string; destination: string; type: number }[] =
  CONFIG.hosting.redirects;

function rule(source: string) {
  return redirects.find((r) => r.source === source);
}

describe("firebase.json redirects (D22/ADR-0024)", () => {
  it("301s /resumes/ to /cv/", () => {
    expect(rule("/resumes/")).toMatchObject({ destination: "/cv/", type: 301 });
    expect(rule("/resumes/**")).toMatchObject({ destination: "/cv/", type: 301 });
  });

  it("301s every retired CV slug and PDF to its replacement", () => {
    for (const [from, to] of [
      ["/cv/academic", "/cv/research-full"],
      ["/cv/research-professional", "/cv/research-2p"],
      ["/cv/sde-long", "/cv/professional-full"],
      ["/pdfs/academic.pdf", "/pdfs/research-full.pdf"],
      ["/pdfs/research-professional.pdf", "/pdfs/research-2p.pdf"],
      ["/pdfs/sde-long.pdf", "/pdfs/professional-full.pdf"],
    ]) {
      expect(rule(from), from).toMatchObject({ destination: to, type: 301 });
    }
  });

  it("deep-links /resumes/<old-variant>/ to its successor, not the index", () => {
    for (const [from, to] of [
      ["/resumes/academic", "/cv/research-full"],
      ["/resumes/research-professional", "/cv/research-2p"],
      ["/resumes/sde-long", "/cv/professional-full"],
    ]) {
      expect(rule(from), from).toMatchObject({ destination: to, type: 301 });
    }
  });

  // Owner live check (2026-10-14): a redirect for the private Fellow CV made a
  // signed-out visitor's response differ from an unknown path (302 vs 404) -- an
  // existence oracle and a slug leak. The Fellow is served ONLY under /p/; a
  // public request for it must 404 exactly like a missing path.
  it("does NOT redirect any private Fellow path (no existence oracle)", () => {
    for (const r of redirects) {
      expect(r.source, r.source).not.toContain("anthropic-fellow");
      expect(r.destination, r.source).not.toContain("anthropic-fellow");
    }
  });
});
