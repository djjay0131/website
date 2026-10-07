#!/usr/bin/env node
// THE ANNOTATION EXPORT RENDERER (AN-EXPORT; contract site-wave-6 requirement 7;
// ADR-0021 decision 5, ADR-0022).
//
//   node scripts/export-notes.mjs --notes notes.json --out build/notes
//   npm ... (there is no npm script: this is run locally, owner-triggered)
//
// WHAT IT DOES. Reads an owner-fetched notes bundle (the JSON of
// `GET /annotations?scope=all`, or a `--notes <file.json>` for offline use),
// applies `site/notes-routing.json`, and writes ONE Markdown file per note
// carrying the item qualified id, a deep link, the quoted passage, the comment
// and the intent. Files are grouped by item under the route's repo and dir.
// `question` notes are skipped and reported.
//
// WHAT IT DELIBERATELY DOES NOT DO (ADR-0022 is a HARD STOP). It never opens a
// remote, never reads a credential, secret, GitHub App or PAT, and never pushes
// or opens a PR. With no credential configured it prints the ADR-0022 stop after
// writing local files and exits 0. The cross-repository delivery waits for the
// owner's decision.
//
// IT EMITS NO RAW HTML. Markdown is a text format, but a quote or comment may
// contain markup; every field is escaped and the passage is a blockquote, so a
// `<script>` in a note stays inert text.
//
// The routing and field logic live in ../src-private/lib/annotations.mjs -- the
// same module the browser island uses -- so the parser the gate is configured
// from is the parser this renderer applies. That module is browser-safe (no
// fs), so importing it from Node is a one-way arrow.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CANONICAL_ORIGIN } from "../src/lib/canonical-url.mjs";
import {
  isIntent,
  isSafeItemIdentity,
  isSafeSegment,
  normalizeIntent,
  parseRouting,
  routeNote,
} from "../src-private/lib/annotations.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = path.resolve(HERE, "..");
const DEFAULT_ROUTING = path.join(SITE_ROOT, "notes-routing.json");

/** Minimal Markdown text escaping, so a note can never inject HTML. */
export function escapeMarkdownText(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** The private item's deep link, the shape ADR-0021 decision 5 fixes. */
export function deepLink(note, origin = CANONICAL_ORIGIN) {
  const base = String(origin ?? CANONICAL_ORIGIN).replace(/\/+$/, "");
  return `${base}/p/${note.section}/${note.source}/${note.slug}/`;
}

/** The item qualified id, which is also the identity a title would stand in for. */
export function qualifiedId(note) {
  return `${note?.section ?? ""}/${note?.source ?? ""}/${note?.slug ?? ""}`;
}

/**
 * One note as Markdown. The quote is a blockquote; the comment is escaped prose.
 *
 * @param {any} note
 * @param {{repo: string, dir: string}} route
 * @param {{origin?: string}} [options]
 */
export function renderNoteMarkdown(note, route, options = {}) {
  const intent = normalizeIntent(note?.intent);
  const quote = escapeMarkdownText(note?.quote ?? note?.selector?.exact ?? "");
  const comment = escapeMarkdownText(note?.comment ?? "");
  const blockquote = quote
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");
  return [
    `# ${escapeMarkdownText(qualifiedId(note))}`,
    "",
    `- **Intent:** ${intent}`,
    `- **Item:** ${escapeMarkdownText(qualifiedId(note))}`,
    `- **Link:** ${deepLink(note, options.origin)}`,
    `- **Created:** ${escapeMarkdownText(note?.created ?? "")}`,
    `- **Note id:** ${escapeMarkdownText(note?.id ?? "")}`,
    `- **Route:** ${escapeMarkdownText(route?.repo ?? "")}/${escapeMarkdownText(route?.dir ?? "")}`,
    "",
    blockquote,
    "",
    comment,
    "",
  ].join("\n");
}

/**
 * Where one note's Markdown lands, relative to the `--out` directory. The path
 * mirrors the route's repo (owner/name), its dir, then the item, so notes are
 * grouped by item. Every segment is re-checked here, so a malformed note cannot
 * write outside the output directory.
 *
 * @returns {string | null} null when a segment is unsafe
 */
export function noteOutputPath(note, route) {
  const [owner, name] = String(route?.repo ?? "").split("/");
  const id = String(note?.id ?? "");
  const segments = [owner, name, ...String(route?.dir ?? "").split("/"), note?.section, note?.source, note?.slug];
  if (!isSafeItemIdentity(note) || !isSafeSegment(id)) return null;
  if (!segments.every(isSafeSegment)) return null;
  return path.posix.join(...segments, `${id}.md`);
}

/**
 * Render every routeable note. Returns one file entry per note plus the skipped
 * notes (question, unrouted, or an unsafe identity) and why.
 *
 * @param {any[]} notes
 * @param {{version: number, routes: Record<string, any>}} routing
 * @param {{origin?: string}} [options]
 */
export function renderNotesBundle(notes, routing, options = {}) {
  const files = [];
  const skipped = [];
  for (const note of Array.isArray(notes) ? notes : []) {
    const intent = isIntent(note?.intent) ? note.intent : null;
    if (intent === null) {
      skipped.push({ note, reason: "unknown intent" });
      continue;
    }
    const decision = routeNote(note, routing);
    if (!decision.render) {
      skipped.push({ note, reason: decision.reason });
      continue;
    }
    const relativePath = noteOutputPath(note, decision.route);
    if (!relativePath) {
      skipped.push({ note, reason: "unsafe item identity" });
      continue;
    }
    files.push({
      repo: decision.route.repo,
      dir: decision.route.dir,
      note,
      relativePath,
      markdown: renderNoteMarkdown(note, decision.route, options),
    });
  }
  return { files, skipped };
}

/**
 * Read a notes bundle from the owner-fetched JSON: a bare array, `{notes: []}`
 * or `{annotations: []}`. Anything else is an empty bundle, never a throw.
 */
export function readNotesBundle(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.notes)) return data.notes;
  if (Array.isArray(data?.annotations)) return data.annotations;
  return [];
}

const ADR_0022_STOP =
  "export-notes: ADR-0022 STOP — no cross-repository credential is configured in v1. " +
  "No remote was contacted and no PR was opened. The owner must choose the export " +
  "transport (ADR-0022) before automated delivery exists.";

function parseArgs(argv) {
  const args = { notes: null, out: null, routing: null, origin: CANONICAL_ORIGIN };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--notes") args.notes = argv[++i];
    else if (argv[i] === "--out") args.out = argv[++i];
    else if (argv[i] === "--routing") args.routing = argv[++i];
    else if (argv[i] === "--origin") args.origin = argv[++i];
    else throw new Error(`unknown argument: ${argv[i]}`);
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const routingPath = args.routing ? path.resolve(args.routing) : DEFAULT_ROUTING;

  let routing;
  try {
    routing = parseRouting(JSON.parse(fs.readFileSync(routingPath, "utf8")));
  } catch (error) {
    console.error(`export-notes: ${error.message}`);
    process.exit(2);
  }

  // No owner-fetched bundle: nothing to write, only the stop. This is the
  // credential-free v1 path and it exits 0 by design.
  if (!args.notes) {
    console.log(ADR_0022_STOP);
    console.log(
      "export-notes: pass --notes <file.json> (the JSON of GET /annotations?scope=all) to " +
        "render local Markdown; --out <dir> chooses where it lands.",
    );
    process.exit(0);
  }

  if (!args.out) {
    console.error("export-notes: --out <dir> is required to write the local Markdown bundle");
    process.exit(2);
  }

  let notes;
  try {
    notes = readNotesBundle(JSON.parse(fs.readFileSync(path.resolve(args.notes), "utf8")));
  } catch (error) {
    console.error(`export-notes: could not read --notes ${args.notes}: ${error.message}`);
    process.exit(2);
  }

  const outDir = path.resolve(args.out);
  const { files, skipped } = renderNotesBundle(notes, routing, { origin: args.origin });
  for (const file of files) {
    const target = path.join(outDir, file.relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, file.markdown);
  }

  const byRepo = new Map();
  for (const file of files) byRepo.set(file.repo, (byRepo.get(file.repo) ?? 0) + 1);
  console.log(
    `export-notes: wrote ${files.length} Markdown file(s) to ${path.relative(process.cwd(), outDir) || "."}` +
      `${files.length > 0 ? ` (${[...byRepo].map(([repo, n]) => `${repo}: ${n}`).join(", ")})` : ""}`,
  );
  for (const entry of skipped) {
    console.log(
      `export-notes: skipped ${entry.note?.id ?? "(no id)"} (${qualifiedId(entry.note)}): ${entry.reason}`,
    );
  }
  console.log(ADR_0022_STOP);
  process.exit(0);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
