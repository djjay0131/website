import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { checkContrast, contrastRatio, parseThemes, AA_NORMAL_TEXT } from "../../scripts/contrast.mjs";

const css = fs.readFileSync(path.resolve("src/styles/tokens.css"), "utf8");

describe("design tokens", () => {
  it("computes WCAG contrast correctly", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#777777", "#ffffff")).toBeCloseTo(4.48, 2);
  });

  it("uses the petrol accent #0F5C5A in the light theme", () => {
    expect(parseThemes(css).light["color-accent"]).toBe("#0f5c5a");
  });

  it("defines a dark palette that differs from the light one", () => {
    const { light, dark } = parseThemes(css);
    expect(dark["color-bg"]).not.toBe(light["color-bg"]);
    expect(dark["color-text"]).not.toBe(light["color-text"]);
  });

  it("switches theme with prefers-color-scheme, not JavaScript", () => {
    expect(css).toMatch(/@media\s*\(\s*prefers-color-scheme:\s*dark\s*\)/);
    expect(css).not.toMatch(/\[data-theme/);
  });

  it("names the three §5 typefaces", () => {
    expect(css).toMatch(/--font-display:\s*"Spectral"/);
    expect(css).toMatch(/--font-body:\s*"IBM Plex Sans"/);
    expect(css).toMatch(/--font-mono:\s*"IBM Plex Mono"/);
  });

  it("keeps every text pair at WCAG AA in both themes", () => {
    const failing = checkContrast(css)
      .filter((r) => !r.pass)
      .map((r) => `${r.theme}: --${r.fg} on --${r.bg} = ${r.ratio.toFixed(2)}`);
    expect(failing, `below ${AA_NORMAL_TEXT}:1`).toEqual([]);
  });
});
