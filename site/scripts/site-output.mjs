// WHICH OF THE TWO OUTPUTS THIS BUILD IS (ADR-0005 decision 1; SEAM-4).
//
//   HUB_OUTPUT unset  ->  public  ->  site/dist-public   (Firebase Hosting)
//   HUB_OUTPUT=public ->  public  ->  site/dist-public
//   HUB_OUTPUT=private -> private ->  site/dist-private  (the private bucket)
//
// One source tree, two builds, selected by one variable. Imported by
// astro.config.mjs, scripts/check-no-private-in-public.mjs,
// scripts/sync-private.mjs and the tests, so there is exactly one declaration
// of what the variable means. Plain JavaScript, like scripts/site-env.mjs and
// src/lib/hub-content.mjs, because both .ts modules and .mjs build scripts
// import it.
//
// TWO SAFETY PROPERTIES, BOTH DELIBERATE AND BOTH TESTED:
//
//   1. UNSET MEANS PUBLIC. Phase 2 had one build and one output directory, and
//      nothing about it may change by accident (site-phase-3 contract D1). A
//      checkout, a local `npm run build`, and every Phase 2 CI step that never
//      heard of this variable must keep producing exactly dist-public.
//
//   2. AN UNRECOGNISED VALUE IS A HARD ERROR, never a fallback. The tempting
//      shape -- `env.HUB_OUTPUT === "private" ? private : public` -- treats
//      every typo as "public", which is the safe direction only until someone
//      writes the mirror of it. A build that was asked for something this file
//      does not understand has no correct answer, so it stops. `HUB_OUTPUT=Private`
//      (capital P) must not quietly deploy the private navigation's absence, and
//      it must not quietly publish anything either.

/** The two outputs, in the order the contract names them. */
export const HUB_OUTPUTS = ["public", "private"];

/** The output a build with no HUB_OUTPUT set produces (Phase 2's behaviour). */
export const DEFAULT_HUB_OUTPUT = "public";

/** Output directory per output, relative to site/. Both are gitignored. */
export const OUTPUT_DIRS = {
  public: "dist-public",
  private: "dist-private",
};

/**
 * Resolve the build's output from the environment.
 *
 * @param {Record<string, string | undefined>} [env]
 * @returns {{ output: "public" | "private", outDir: string, isPrivate: boolean }}
 *   `outDir` is relative to site/ and carries the leading "./" Astro's `outDir`
 *   expects.
 * @throws {Error} on any value that is not exactly "public" or "private".
 */
export function resolveHubOutput(env = process.env) {
  const raw = String(env.HUB_OUTPUT ?? "").trim();
  const output = raw === "" ? DEFAULT_HUB_OUTPUT : raw;

  if (!HUB_OUTPUTS.includes(output)) {
    throw new Error(
      `HUB_OUTPUT must be one of ${HUB_OUTPUTS.map((o) => JSON.stringify(o)).join(", ")} ` +
        `(got ${JSON.stringify(raw)}). Leave it unset for the public build. This is deliberately ` +
        `an error rather than a fallback: a build asked for an output this repository does not ` +
        `define has no correct answer, and guessing one is how a private build gets deployed to ` +
        `a public host (ADR-0005).`,
    );
  }

  return {
    output: /** @type {"public" | "private"} */ (output),
    outDir: `./${OUTPUT_DIRS[output]}`,
    isPrivate: output === "private",
  };
}
