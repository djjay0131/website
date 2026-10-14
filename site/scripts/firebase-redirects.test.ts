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

  it("keeps the Fellowship CV behind sign-in (302, never 301)", () => {
    for (const source of [
      "/pdfs/anthropic-fellow.pdf",
      "/cv/anthropic-fellow",
      "/cv/anthropic-fellow/**",
    ]) {
      expect(rule(source), source).toMatchObject({ destination: "/signin/", type: 302 });
    }
  });

  it("never redirects anything TO the private Fellow slug", () => {
    for (const r of redirects) {
      expect(r.destination).not.toContain("anthropic-fellow");
    }
  });
});
