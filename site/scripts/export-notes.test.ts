import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseRouting } from "../src-private/lib/annotations.mjs";
import {
  deepLink,
  noteOutputPath,
  qualifiedId,
  readNotesBundle,
  renderNoteMarkdown,
  renderNotesBundle,
} from "./export-notes.mjs";

// ===========================================================================
// The annotation export renderer (AN-EXPORT; contract site-wave-6 requirement 7;
// ADR-0021, ADR-0022). The credential is a HARD STOP: v1 writes local Markdown
// and touches no remote.
// ===========================================================================

const ROUTING_FILE = path.resolve("notes-routing.json");
const SCRIPT = path.resolve("scripts/export-notes.mjs");
const ORIGIN = "https://jason.cusati.us";
const routing = parseRouting(JSON.parse(fs.readFileSync(ROUTING_FILE, "utf8")));

const INJECTION = "<script>alert(1)</script>";

const NOTES = [
  {
    id: "noteP1",
    section: "phd",
    source: "phd-milestones",
    slug: "milestones",
    intent: "paper",
    quote: `the quoted <script>alert(1)</script> passage`,
    comment: "a paper note <img src=x onerror=alert(1)>",
    created: "2026-10-01T09:00:00Z",
  },
  {
    id: "noteE1",
    section: "phd",
    source: "phd-milestones",
    slug: "milestones",
    intent: "experiment",
    quote: "an experiment quote",
    comment: "",
    created: "2026-10-02T09:00:00Z",
  },
  {
    id: "noteB1",
    section: "projects",
    source: "construction-ai",
    slug: "construction-ai-site",
    intent: "brainstorm",
    quote: "a brainstorm quote",
    comment: "try this",
    created: "2026-10-03T09:00:00Z",
  },
  {
    id: "noteQ1",
    section: "phd",
    source: "phd-milestones",
    slug: "milestones",
    intent: "question",
    quote: "a question quote",
    comment: "what about this?",
    created: "2026-10-04T09:00:00Z",
  },
];

describe("the export renderer routes by intent and skips question", () => {
  const { files, skipped } = renderNotesBundle(NOTES, routing, { origin: ORIGIN });

  it("writes one file per routeable note and skips question", () => {
    expect(files).toHaveLength(3);
    expect(skipped).toHaveLength(1);
    expect(skipped[0].note.id).toBe("noteQ1");
    expect(skipped[0].reason).toMatch(/question/);
  });

  it("assigns paper to soa-agentic-se and experiment/brainstorm to agentic-kg-research", () => {
    const byRepo = Object.fromEntries(files.map((f) => [f.note.id, f.repo]));
    expect(byRepo.noteP1).toBe("djjay0131/soa-agentic-se");
    expect(byRepo.noteE1).toBe("djjay0131/agentic-kg-research");
    expect(byRepo.noteB1).toBe("djjay0131/agentic-kg-research");
  });

  it("groups files by item under the route's repo and dir", () => {
    const paths = files.map((f) => f.relativePath).sort();
    expect(paths).toEqual([
      "djjay0131/agentic-kg-research/notes/phd/phd-milestones/milestones/noteE1.md",
      "djjay0131/agentic-kg-research/notes/projects/construction-ai/construction-ai-site/noteB1.md",
      "djjay0131/soa-agentic-se/notes/phd/phd-milestones/milestones/noteP1.md",
    ]);
  });

  it("carries the qualified id, deep link, quote, comment and intent", () => {
    const entry = files.find((f) => f.note.id === "noteP1")!;
    expect(entry.markdown).toContain("# phd/phd-milestones/milestones");
    expect(entry.markdown).toContain(`- **Link:** ${ORIGIN}/p/phd/phd-milestones/milestones/`);
    expect(entry.markdown).toContain("- **Intent:** paper");
    expect(entry.markdown).toContain('> the quoted &lt;script&gt;alert(1)&lt;/script&gt; passage');
    expect(entry.markdown).toContain("a paper note &lt;img src=x onerror=alert(1)&gt;");
  });

  it("emits NO raw HTML, so an injected script stays inert text", () => {
    for (const file of files) {
      expect(file.markdown).not.toContain("<script>");
      expect(file.markdown).not.toContain("<img");
      // The dangerous markup survives only as escaped text.
      if (file.note.id === "noteP1") {
        expect(file.markdown).toContain("&lt;img src=x onerror=alert(1)&gt;");
      }
    }
  });

  it("deepLink and qualifiedId are the documented shapes", () => {
    expect(deepLink(NOTES[0], ORIGIN)).toBe("https://jason.cusati.us/p/phd/phd-milestones/milestones/");
    expect(deepLink(NOTES[0], "https://jason.cusati.us/")).toBe(
      "https://jason.cusati.us/p/phd/phd-milestones/milestones/",
    );
    expect(qualifiedId(NOTES[0])).toBe("phd/phd-milestones/milestones");
  });

  it("renderNoteMarkdown escapes a standalone quote too", () => {
    const markdown = renderNoteMarkdown(
      { ...NOTES[0], quote: INJECTION, comment: "" },
      { repo: "a/b", dir: "notes" },
      { origin: ORIGIN },
    );
    expect(markdown).toContain("&lt;script&gt;");
    expect(markdown).not.toContain("<script>");
  });

  it("neutralises Markdown link, image, code and block injection (RT6-06)", () => {
    const markdown = renderNoteMarkdown(
      {
        ...NOTES[0],
        quote: "[x](javascript:alert(1))",
        comment: "# not a heading\n- not a list\n![beacon](https://evil.example/p?u=1)\n`code`",
      },
      { repo: "a/b", dir: "notes" },
      { origin: ORIGIN },
    );
    // The brackets are escaped, so no link/image can form; the parens are then
    // ordinary text. Assert the unescaped openers are absent.
    expect(markdown).not.toContain("[x](");
    expect(markdown).not.toContain("![beacon](");
    expect(markdown).toContain("\\[x\\](javascript:");
    expect(markdown).not.toContain("`code`");
    // Every comment line is quoted, so nothing opens a top-level block.
    expect(markdown).not.toMatch(/^# not a heading/m);
    expect(markdown).not.toMatch(/^- not a list/m);
    expect(markdown).toContain("> # not a heading");
  });
});

describe("the output path is re-validated, so a malformed note cannot escape --out", () => {
  it("refuses an unsafe item identity or note id", () => {
    const route = { repo: "a/b", dir: "notes" };
    expect(noteOutputPath({ id: "x", section: "phd", source: "s", slug: "../escape" }, route)).toBeNull();
    expect(noteOutputPath({ id: "../../x", section: "phd", source: "s", slug: "y" }, route)).toBeNull();
  });

  it("reports an unsafe note as skipped rather than writing it", () => {
    const { files, skipped } = renderNotesBundle(
      [{ id: "ok", section: "phd", source: "s", slug: "y", intent: "paper", quote: "q" },
       { id: "bad", section: "phd", source: "s", slug: "../z", intent: "paper", quote: "q" }],
      routing,
      { origin: ORIGIN },
    );
    expect(files).toHaveLength(1);
    expect(skipped.some((s) => s.reason === "unsafe item identity")).toBe(true);
  });

  it("writes a multi-segment slug as nested directories (R2-09)", () => {
    const route = { repo: "djjay0131/soa-agentic-se", dir: "notes" };
    expect(
      noteOutputPath(
        { id: "n1", section: "hub", source: "hub", slug: "research/soa-agentic-se" },
        route,
      ),
    ).toBe("djjay0131/soa-agentic-se/notes/hub/hub/research/soa-agentic-se/n1.md");
  });

  it("collapses a newline in a metadata field so it cannot open a block (R2-02)", () => {
    const markdown = renderNoteMarkdown(
      { ...NOTES[0], id: "n1", created: "2026-10-01\n# injected" },
      { repo: "a/b", dir: "notes" },
      { origin: ORIGIN },
    );
    expect(markdown).not.toMatch(/^# injected/m);
    expect(markdown).toContain("- **Created:** 2026-10-01 # injected");
  });
});

describe("readNotesBundle accepts the shapes the gate and a saved file can take", () => {
  it("accepts a bare array, {notes}, {annotations} and rejects anything else", () => {
    expect(readNotesBundle([1, 2])).toEqual([1, 2]);
    expect(readNotesBundle({ notes: [1] })).toEqual([1]);
    expect(readNotesBundle({ annotations: [2] })).toEqual([2]);
    expect(readNotesBundle({ nope: true })).toEqual([]);
    expect(readNotesBundle(null)).toEqual([]);
  });
});

describe("the CLI writes local files, skips question, and never contacts a remote", () => {
  it("exits 0, writes the routeable notes, and prints the ADR-0022 stop", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "export-notes-"));
    try {
      const notesFile = path.join(dir, "notes.json");
      const outDir = path.join(dir, "out");
      fs.writeFileSync(notesFile, JSON.stringify({ notes: NOTES }));
      const run = spawnSync(process.execPath, [SCRIPT, "--notes", notesFile, "--out", outDir], {
        encoding: "utf8",
      });
      expect(run.status, run.stderr).toBe(0);
      expect(run.stdout).toContain("ADR-0022 STOP");
      expect(run.stdout).toContain("skipped noteQ1");
      expect(run.stdout).toMatch(/wrote 3 Markdown file/);
      expect(
        fs.existsSync(
          path.join(outDir, "djjay0131/soa-agentic-se/notes/phd/phd-milestones/milestones/noteP1.md"),
        ),
      ).toBe(true);
      expect(fs.existsSync(path.join(outDir, "djjay0131/soa-agentic-se/notes/phd/phd-milestones/milestones/noteQ1.md"))).toBe(false);
      const written = fs.readFileSync(
        path.join(outDir, "djjay0131/soa-agentic-se/notes/phd/phd-milestones/milestones/noteP1.md"),
        "utf8",
      );
      expect(written).not.toContain("<script>");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("prints the stop and exits 0 with no --notes, having touched nothing", () => {
    const run = spawnSync(process.execPath, [SCRIPT], { encoding: "utf8" });
    expect(run.status).toBe(0);
    expect(run.stdout).toContain("ADR-0022 STOP");
  });

  it("the renderer source carries no credential or remote call", () => {
    const source = fs.readFileSync(SCRIPT, "utf8");
    const code = source
      .split("\n")
      .map((line) => line.replace(/\/\/.*$/, ""))
      .join("\n");
    expect(code).not.toMatch(/\bfetch\s*\(/);
    expect(code).not.toContain("Authorization");
    expect(code).not.toContain("api.github.com");
    expect(code).not.toMatch(/process\.env\.(GITHUB|NOTES_EXPORT|GH_)/);
  });
});
