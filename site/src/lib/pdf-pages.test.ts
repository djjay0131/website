import zlib from "node:zlib";
import { describe, expect, it } from "vitest";
import { countPdfPages, countPdfPagesFile } from "./pdf-pages.mjs";

function plainPages(n: number): string {
  let body = "%PDF-1.4\n2 0 obj\n<< /Type /Pages /Kids [] /Count 0 >>\nendobj\n";
  for (let i = 0; i < n; i += 1) {
    body += `${10 + i} 0 obj\n<< /Type /Page /Parent 2 0 R >>\nendobj\n`;
  }
  return body;
}

describe("countPdfPages", () => {
  it("counts plain page dictionaries and ignores the page tree", () => {
    expect(countPdfPages(plainPages(3))).toBe(3);
    expect(countPdfPages(plainPages(1))).toBe(1);
  });

  it("handles the no-whitespace `/Type/Page` spelling", () => {
    const body = "3 0 obj\n<< /Type/Page >>\nendobj\n4 0 obj\n<< /Type/Page >>\nendobj";
    expect(countPdfPages(body)).toBe(2);
  });

  it("counts page objects inside a FlateDecode object stream", () => {
    const inner = "1 0 obj << /Type /Page >> endobj 2 0 obj << /Type /Page >> endobj";
    const compressed = zlib.deflateSync(Buffer.from(inner, "latin1"));
    const pdf = Buffer.concat([
      Buffer.from("%PDF-1.5\n5 0 obj\n<< /Length 0 /Filter /FlateDecode >>\nstream\n", "latin1"),
      compressed,
      Buffer.from("\nendstream\nendobj\n", "latin1"),
    ]);
    expect(countPdfPages(pdf)).toBe(2);
  });

  it("returns 0 for a non-PDF buffer", () => {
    expect(countPdfPages("not a pdf at all")).toBe(0);
  });
});

describe("countPdfPagesFile", () => {
  it("reads the committed fixture PDF (1 page)", () => {
    const fixture = new URL("../../fixtures/content/sources/cv/research-full.pdf", import.meta.url);
    expect(countPdfPagesFile(fixture.pathname)).toBe(1);
  });
});
