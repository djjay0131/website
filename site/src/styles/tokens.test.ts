import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  checkContrast,
  contrastRatio,
  parseDeclarations,
  parseThemes,
  AA_NORMAL_TEXT,
  TEXT_PAIRS,
  TOKEN_SOURCES,
} from "../../scripts/contrast.mjs";

const css = fs.readFileSync(path.resolve("src/styles/tokens.css"), "utf8");

// The tracker and dossier palette, as contract site-phase-1 D2 (amended
// 2026-09-15) states it.
const TRACKER_PALETTE: Record<"light" | "dark", Record<string, string>> = {
  light: {
    paper: "#F4F5F1", "paper-2": "#EAEBE5", card: "#FBFBF8",
    ink: "#14181B", "ink-2": "#3C4448", "ink-3": "#6B7370",
    rule: "#D7D9D1", "rule-2": "#C3C6BC",
    petrol: "#0F5C5A", "petrol-soft": "#DDE9E7",
    brass: "#8A6512", "brass-soft": "#F0E7D2",
    clay: "#9C3B2E", "clay-soft": "#F3E0DC",
  },
  dark: {
    paper: "#111413", "paper-2": "#181C1B", card: "#1A1F1E",
    ink: "#EDEEE9", "ink-2": "#C0C5C0", "ink-3": "#8A918C",
    rule: "#2B312F", "rule-2": "#3A423F",
    petrol: "#6FC4BE", "petrol-soft": "#16302E",
    brass: "#D8AC5A", "brass-soft": "#2E2718",
    clay: "#E08A79", "clay-soft": "#33201C",
  },
};

describe("design tokens", () => {
  it("computes WCAG contrast correctly", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#777777", "#ffffff")).toBeCloseTo(4.48, 2);
  });

  it("uses the petrol accent #0F5C5A in the light theme", () => {
    expect(parseThemes(css).light["color-accent"]).toBe("#0f5c5a");
  });

  it("carries over the tracker palette verbatim in both themes", () => {
    const themes = parseThemes(css);
    for (const theme of ["light", "dark"] as const) {
      for (const [name, hex] of Object.entries(TRACKER_PALETTE[theme])) {
        expect(themes[theme][`tracker-${name}`], `${theme} --tracker-${name}`).toBe(hex.toLowerCase());
      }
    }
  });

  it("maps each site token onto its tracker colour, departing only for AA", () => {
    const declarations = parseDeclarations(css);
    const themes = parseThemes(css);
    for (const theme of ["light", "dark"] as const) {
      for (const [token, source] of Object.entries(TOKEN_SOURCES)) {
        if (declarations[theme][token] === `var(--${source})`) continue;
        // A literal value is allowed only where the carried-over colour fails
        // a checked text pair for this token, and the replacement passes.
        const tokens = themes[theme];
        const pairs = TEXT_PAIRS.filter(([fg]) => fg === token);
        const sourceFails = pairs.some(([, bg]) => contrastRatio(tokens[source], tokens[bg]) < AA_NORMAL_TEXT);
        expect(sourceFails, `${theme} --${token} departs from --${source} without an AA failure`).toBe(true);
      }
    }
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
