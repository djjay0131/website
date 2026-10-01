// THE PRIVATE SIDE OF THE TWO-OUTPUT BUILD (ADR-0005; ADR-0010; SEAM-1, SEAM-5).
//
// The frame URL, the payload URL and the staging plan are IDENTICAL in both
// outputs: a public html item and a private html item are staged the same way
// and framed at the same route shape. Those three facts now live once, in
// src/lib/frame-content.mjs, which is public-safe by construction. This module
// is the private build's name for them.
//
// It stays under src-private/ on purpose, and the reason is the STRUCTURAL
// guarantee scripts/private-structure.test.ts pins: nothing the public build
// compiles may reach anything under src-private/, and no module that knows what
// "private" means may live inside src/. This file used to hold the
// implementation; it holds none now, but keeping the private build's import at
// this path preserves the one-way arrow the test asserts.
//
// Nothing in src/pages/** may import this file.
export {
  GATE_SEGMENT_PATTERN,
  PAYLOAD_ROOT,
  findUnservablePaths,
  payloadUrlFor,
  routeFor,
  stagingPlanFor,
} from "../../src/lib/frame-content.mjs";
