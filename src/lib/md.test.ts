import { describe, it, expect } from "vitest";
import { mdToHtml } from "./md";

describe("mdToHtml", () => {
  it("returns empty string unchanged", () => {
    expect(mdToHtml("")).toBe("");
  });

  it("returns plain text unchanged", () => {
    expect(mdToHtml("hello world")).toBe("hello world");
  });

  it("converts bold", () => {
    expect(mdToHtml("**MVP**")).toBe("<strong>MVP</strong>");
  });

  it("converts italic", () => {
    expect(mdToHtml("*key*")).toBe("<em>key</em>");
  });

  it("converts code", () => {
    expect(mdToHtml("`x`")).toBe("<code>x</code>");
  });

  it("escapes HTML specials", () => {
    expect(mdToHtml("A & B")).toBe("A &amp; B");
    expect(mdToHtml("a < b > c")).toBe("a &lt; b &gt; c");
    expect(mdToHtml('"x"')).toBe("&quot;x&quot;");
  });

  it("escapes inside bold", () => {
    expect(mdToHtml("**A & B**")).toBe("<strong>A &amp; B</strong>");
  });

  it("does not escape percent", () => {
    expect(mdToHtml("50%")).toBe("50%");
  });

  it("preserves unicode", () => {
    expect(mdToHtml("2024–2025 café")).toBe("2024–2025 café");
  });
});
