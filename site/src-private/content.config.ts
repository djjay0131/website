/**
 * The private build's content configuration.
 *
 * Astro resolves the content config at `<srcDir>/content.config.ts`, and the
 * private build sets `srcDir: ./src-private` (astro.config.mjs). There is still
 * exactly ONE collection definition, one Zod mirror of the manifest schema and
 * one validation path: this file re-exports `src/content.config.ts` rather than
 * restating any of it. A second definition of the manifest schema is precisely
 * the drift SEAM-1 exists to prevent.
 */
export { collections } from "../src/content.config";
