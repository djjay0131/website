import { describe, it, expect } from "vitest";
import { renderOgCardSvg } from "./og-card.mjs";

// The generated card is RETAINED but no longer the default `og:image` (D16,
// 2026-10-04 restored the research emblem). Before Wave 0c the default was the
// portrait, so this remains the guard that the face does not come back as a link
// preview. The Skeptic Verifier found the path untested; this is that test.
describe("the generated OpenGraph card", () => {
  const svg = renderOgCardSvg({ name: "Jason Cusati", title: "Research hub", affiliation: "Virginia Tech" });

  it("is a 1200x630 SVG with no raster/image element", () => {
    expect(svg).toMatch(/<svg[^>]*width="1200"[^>]*height="630"/);
    expect(svg).not.toMatch(/<image\b/i);
    expect(svg).not.toMatch(/href=/i);
    expect(svg).not.toMatch(/photo/i);
    expect(svg).not.toMatch(/\.jpe?g/i);
  });

  it("carries the name, title and affiliation as text", () => {
    expect(svg).toContain("Jason Cusati");
    expect(svg).toContain("Research hub");
    expect(svg).toContain("Virginia Tech");
  });

  it("ignores any portrait argument, so the card can never embed one", () => {
    const withPortrait = renderOgCardSvg({
      name: "Jason Cusati",
      title: "Research hub",
      affiliation: "Virginia Tech",
      // @ts-expect-error a portrait is deliberately not part of the shape
      portrait: "photo_jason_1.jpeg",
    });
    expect(withPortrait).toBe(svg);
  });
});
