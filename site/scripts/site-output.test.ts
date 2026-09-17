import { describe, it, expect } from "vitest";
import { DEFAULT_HUB_OUTPUT, HUB_OUTPUTS, OUTPUT_DIRS, resolveHubOutput } from "./site-output.mjs";

describe("HUB_OUTPUT selects the build's output (ADR-0005 decision 1)", () => {
  it("defaults to the PUBLIC build when unset, empty or whitespace", () => {
    // This is the property that keeps every Phase 2 invocation behaving exactly
    // as it did: a checkout, a local `npm run build`, and every CI step that
    // never heard of this variable.
    for (const env of [{}, { HUB_OUTPUT: "" }, { HUB_OUTPUT: "   " }]) {
      const resolved = resolveHubOutput(env);
      expect(resolved.output).toBe("public");
      expect(resolved.outDir).toBe("./dist-public");
      expect(resolved.isPrivate).toBe(false);
    }
    expect(DEFAULT_HUB_OUTPUT).toBe("public");
  });

  it("selects each declared output and its directory", () => {
    expect(resolveHubOutput({ HUB_OUTPUT: "public" })).toEqual({
      output: "public",
      outDir: "./dist-public",
      isPrivate: false,
    });
    expect(resolveHubOutput({ HUB_OUTPUT: "private" })).toEqual({
      output: "private",
      outDir: "./dist-private",
      isPrivate: true,
    });
    expect(HUB_OUTPUTS).toEqual(["public", "private"]);
    expect(OUTPUT_DIRS).toEqual({ public: "dist-public", private: "dist-private" });
  });

  it("THROWS on an unrecognised value rather than falling back", () => {
    // The tempting shape is `x === "private" ? private : public`, which treats
    // every typo as public. That is safe only until someone writes its mirror;
    // a build asked for an output this repo does not define has no right answer.
    for (const bad of ["Private", "PUBLIC", "priv", "both", "1", "public;private"]) {
      expect(() => resolveHubOutput({ HUB_OUTPUT: bad }), bad).toThrow(/HUB_OUTPUT must be one of/);
    }
  });

  it("trims surrounding whitespace, which a CI variable easily picks up", () => {
    // Deliberately NOT an error: `HUB_OUTPUT: "private "` out of a YAML variable
    // means private, and failing there would be pedantry rather than safety.
    expect(resolveHubOutput({ HUB_OUTPUT: " private " }).output).toBe("private");
    expect(resolveHubOutput({ HUB_OUTPUT: "public\n" }).output).toBe("public");
  });

  it("names the offending value in the error, so a typo is obvious", () => {
    expect(() => resolveHubOutput({ HUB_OUTPUT: "Private" })).toThrow(/"Private"/);
  });
});
