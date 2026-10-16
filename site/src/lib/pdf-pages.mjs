// A dependency-free PDF page counter (owner D22, ADR-0024).
//
// The one CV section shows each PDF's page count. The hub has no PDF library
// and adding one for a line of text is not worth the supply-chain surface, so
// this counts page objects directly. It handles the two shapes that matter:
//
//   * plain page dictionaries, e.g. `<< /Type /Page ... >>` (the committed
//     fixtures, and any uncompressed producer); and
//   * the FlateDecode object streams xelatex emits (PDF 1.5+), where the page
//     objects live compressed inside `stream ... endstream`.
//
// It is deliberately small and is unit-tested against both shapes. A PDF whose
// page objects are neither plain nor FlateDecode-inflatable would undercount;
// for the CV's xelatex output it is exact.

import fs from "node:fs";
import zlib from "node:zlib";

// `/Type /Page` but not `/Type /Pages` (the page tree, which also carries
// `/Kids`). Whitespace after `/Type` may be absent (`/Type/Page`).
const PAGE_OBJECT = /\/Type\s*\/Page(?![A-Za-z])/g;

function countInGroup(buf) {
  PAGE_OBJECT.lastIndex = 0;
  let count = 0;
  while (PAGE_OBJECT.exec(buf) !== null) count += 1;
  return count;
}

/** Number of pages in `data` (a Buffer or a UTF-8/byte string of PDF bytes). */
export function countPdfPages(data) {
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
  let total = countInGroup(buf);

  let cursor = 0;
  while ((cursor = buf.indexOf("stream", cursor)) !== -1) {
    // Skip the `stream` keyword and its trailing newline (LF or CRLF).
    let start = cursor + "stream".length;
    if (buf[start] === 0x0d) start += 1;
    if (buf[start] === 0x0a) start += 1;
    const end = buf.indexOf("endstream", start);
    if (end === -1) break;
    try {
      total += countInGroup(zlib.inflateSync(buf.subarray(start, end)));
    } catch {
      // Not a FlateDecode stream (font, image, or uncompressed): ignore.
    }
    cursor = end + "endstream".length;
  }
  return total;
}

/** Number of pages in the PDF at `filePath`. */
export function countPdfPagesFile(filePath) {
  return countPdfPages(fs.readFileSync(filePath));
}
