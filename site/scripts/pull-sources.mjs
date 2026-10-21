#!/usr/bin/env node
// PULLED PAGES SOURCES (D28-B).
//
// Some content already lives on its own public GitHub Pages site but is not a
// satellite: there is no publishing identity, no WIF binding and no bucket
// prefix. This script pulls the PUBLIC repository's built Pages content into the
// private build's source tree. It never writes to the content bucket, never
// asks for a credential, and never runs in the public build.
//
// The source is untrusted. The files it copies are rendered through the same
// sanitizer as satellite HTML (src-private/lib/inline-content.mjs). This script's
// own boundary is smaller but still load-bearing:
//
//   * only a configured public repository and branch are read;
//   * only files under the configured `basePath` are copied;
//   * no symlink, no special file, no absolute or `..` path;
//   * file count and byte limits are enforced before anything is staged;
//   * every item is forced to `visibility: private`, section `projects`;
//   * the manifest is generated here, not read from the pulled repository.
//
// The last good copy is kept under site/.pulled-sources/. A failed fetch uses
// that copy and warns; a failed fetch with no copy fails the build. That is how
// the private sync can keep serving the previous revision instead of deleting
// the project because GitHub was briefly unavailable.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SITE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const DEFAULT_CONFIG_PATH = path.join(SITE_ROOT, "pulled-sources.json");
export const DEFAULT_DEST = path.join(SITE_ROOT, "src", "content", "sources");
export const DEFAULT_WORK = path.join(SITE_ROOT, ".pulled-sources");

export const LIMITS = {
  maxFiles: 2000,
  maxTotalBytes: 50 * 1024 * 1024,
  maxFileBytes: 15 * 1024 * 1024,
};

const SOURCE = /^[a-z][a-z0-9-]{0,38}$/;
const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const REF = /^[A-Za-z0-9._/-]+$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const SECTION = /^(?:projects|research|phd|writing)$/;

const GIT_ENV = {
  ...process.env,
  GIT_TERMINAL_PROMPT: "0",
  GIT_CONFIG_NOSYSTEM: "1",
};

export class PulledSourceError extends Error {
  constructor(message) {
    super(message);
    this.name = "PulledSourceError";
  }
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requireString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new PulledSourceError(`pulled sources: ${field} must be a non-empty string`);
  }
  return value.trim();
}

/** A relative POSIX path that cannot leave its root. */
export function validateRelativePath(value, field) {
  const text = requireString(value, field);
  if (text.startsWith("/") || text.includes("\\") || text.includes("\0")) {
    throw new PulledSourceError(`pulled sources: ${field} must be a relative POSIX path`);
  }
  const parts = text.split("/");
  if (parts.some((part) => part === "" || part === "." || part === "..")) {
    throw new PulledSourceError(`pulled sources: ${field} must not contain empty, "." or ".." segments`);
  }
  return text;
}

export function validateConfig(raw) {
  if (!isPlainObject(raw)) throw new PulledSourceError("pulled sources: config must be an object");
  if (raw.version !== 1) throw new PulledSourceError("pulled sources: version must be 1");
  if (!Array.isArray(raw.sources) || raw.sources.length === 0) {
    throw new PulledSourceError("pulled sources: sources must be a non-empty array");
  }
  const seen = new Set();
  const sources = raw.sources.map((entry, index) => {
    const at = `sources[${index}]`;
    if (!isPlainObject(entry)) throw new PulledSourceError(`pulled sources: ${at} must be an object`);
    const source = requireString(entry.source, `${at}.source`);
    if (!SOURCE.test(source)) {
      throw new PulledSourceError(`pulled sources: ${at}.source is not a valid source key`);
    }
    if (seen.has(source)) throw new PulledSourceError(`pulled sources: duplicate source ${source}`);
    seen.add(source);

    const repo = requireString(entry.repo, `${at}.repo`);
    if (!REPOSITORY.test(repo)) {
      throw new PulledSourceError(`pulled sources: ${at}.repo must be owner/name`);
    }
    const ref = requireString(entry.ref ?? "main", `${at}.ref`);
    if (!REF.test(ref) || ref.startsWith("refs/")) {
      throw new PulledSourceError(`pulled sources: ${at}.ref must be a bare branch name`);
    }
    const basePath = validateRelativePath(entry.basePath, `${at}.basePath`);
    const stageDir = entry.stageDir === undefined ? "site" : validateRelativePath(entry.stageDir, `${at}.stageDir`);
    const section = entry.section === undefined ? "projects" : requireString(entry.section, `${at}.section`);
    if (!SECTION.test(section)) {
      throw new PulledSourceError(`pulled sources: ${at}.section is not a project section`);
    }
    const repositoryNote =
      entry.repositoryNote === undefined ? undefined : requireString(entry.repositoryNote, `${at}.repositoryNote`);
    if (repositoryNote && repositoryNote.length > 300) {
      throw new PulledSourceError(`pulled sources: ${at}.repositoryNote is longer than 300 characters`);
    }

    if (!Array.isArray(entry.pages) || entry.pages.length === 0) {
      throw new PulledSourceError(`pulled sources: ${at}.pages must be a non-empty array`);
    }
    const slugs = new Set();
    const pages = entry.pages.map((page, pageIndex) => {
      const pageAt = `${at}.pages[${pageIndex}]`;
      if (!isPlainObject(page)) throw new PulledSourceError(`pulled sources: ${pageAt} must be an object`);
      const slug = requireString(page.slug, `${pageAt}.slug`);
      if (!SLUG.test(slug) || slug.length > 64) {
        throw new PulledSourceError(`pulled sources: ${pageAt}.slug is not slug-shaped`);
      }
      if (slugs.has(slug)) throw new PulledSourceError(`pulled sources: duplicate page slug ${slug}`);
      slugs.add(slug);
      const title = requireString(page.title, `${pageAt}.title`);
      if (title.length > 200) throw new PulledSourceError(`pulled sources: ${pageAt}.title is too long`);
      const pagePath = validateRelativePath(page.path, `${pageAt}.path`);
      if (page.date !== undefined && !DATE.test(String(page.date))) {
        throw new PulledSourceError(`pulled sources: ${pageAt}.date must be YYYY-MM-DD`);
      }
      const summary = page.summary === undefined ? undefined : requireString(page.summary, `${pageAt}.summary`);
      if (summary && summary.length > 500) {
        throw new PulledSourceError(`pulled sources: ${pageAt}.summary is too long`);
      }
      const order = page.order === undefined ? pageIndex : page.order;
      if (!Number.isInteger(order) || order < 0) {
        throw new PulledSourceError(`pulled sources: ${pageAt}.order must be a non-negative integer`);
      }
      return {
        slug,
        title,
        path: pagePath,
        ...(page.date === undefined ? {} : { date: String(page.date) }),
        ...(summary === undefined ? {} : { summary }),
        order,
      };
    });

    return { source, repo, ref, basePath, stageDir, section, repositoryNote, pages };
  });
  return { version: 1, sources };
}

export function readConfig(file = DEFAULT_CONFIG_PATH) {
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    throw new PulledSourceError(`pulled sources: cannot read ${file}: ${error.message}`);
  }
  return validateConfig(raw);
}

export function defaultLsRemote(source) {
  const output = execFileSync(
    "git",
    ["ls-remote", `https://github.com/${source.repo}.git`, `refs/heads/${source.ref}`],
    { encoding: "utf8", env: GIT_ENV, timeout: 60_000 },
  ).trim();
  const first = output.split("\n").find(Boolean);
  if (!first) throw new PulledSourceError(`pulled sources: ${source.repo} has no branch ${source.ref}`);
  return first.split(/\s+/)[0];
}

/** Deterministic over source, repository, branch and commit SHAs. */
export function fingerprintFor(config, { lsRemote = defaultLsRemote } = {}) {
  const rows = config.sources
    .map((source) => `${source.source}\t${source.repo}\t${source.ref}\t${lsRemote(source)}`)
    .sort();
  return crypto.createHash("sha256").update(rows.join("\n")).digest("hex");
}

function cloneSource(source, destination) {
  execFileSync(
    "git",
    [
      "clone",
      "--quiet",
      "--depth",
      "1",
      "--single-branch",
      "--branch",
      source.ref,
      `https://github.com/${source.repo}.git`,
      destination,
    ],
    { env: GIT_ENV, stdio: "pipe", timeout: 120_000 },
  );
}

function revisionInfo(repoDir) {
  const sha = execFileSync("git", ["-C", repoDir, "rev-parse", "HEAD"], {
    encoding: "utf8",
    env: GIT_ENV,
  }).trim();
  const published = execFileSync("git", ["-C", repoDir, "log", "-1", "--format=%cI"], {
    encoding: "utf8",
    env: GIT_ENV,
  }).trim();
  if (!ISO.test(published)) {
    throw new PulledSourceError(`pulled sources: git returned an unusable commit date ${published}`);
  }
  return { sha, published };
}

function walkFiles(root) {
  const files = [];
  let total = 0;
  const visit = (relative) => {
    const directory = path.join(root, relative);
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const child = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.name === ".git" || entry.name === "node_modules") continue;
      if (entry.isSymbolicLink()) {
        throw new PulledSourceError(`pulled sources: refusing symlink ${child}`);
      }
      if (entry.isDirectory()) {
        visit(child);
        continue;
      }
      if (!entry.isFile()) {
        throw new PulledSourceError(`pulled sources: refusing special file ${child}`);
      }
      const size = fs.statSync(path.join(root, child)).size;
      if (size > LIMITS.maxFileBytes) {
        throw new PulledSourceError(
          `pulled sources: ${child} is ${size} bytes, over the ${LIMITS.maxFileBytes}-byte file limit`,
        );
      }
      total += size;
      if (total > LIMITS.maxTotalBytes) {
        throw new PulledSourceError(
          `pulled sources: the staged tree exceeds the ${LIMITS.maxTotalBytes}-byte total limit`,
        );
      }
      files.push({ relative: child, size });
      if (files.length > LIMITS.maxFiles) {
        throw new PulledSourceError(
          `pulled sources: the staged tree exceeds the ${LIMITS.maxFiles}-file limit`,
        );
      }
    }
  };
  visit("");
  return files;
}

export function buildManifest(source, published) {
  return {
    source: source.source,
    manifest_version: "1",
    published,
    items: source.pages
      .slice()
      .sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug))
      .map((page) => ({
        slug: page.slug,
        title: page.title,
        section: source.section,
        format: "html",
        path: `${source.stageDir}/${page.path}`,
        visibility: "private",
        date: page.date ?? published.slice(0, 10),
        ...(page.summary === undefined ? {} : { summary: page.summary }),
      })),
  };
}

/**
 * Copy one checked-out repository's Pages tree into a work directory.
 *
 * The work directory is the last good copy: it is only replaced after every
 * file has been validated and copied, so a failed pull cannot destroy it.
 */
export function stageCheckout(source, repoDir, workDir, options = {}) {
  const base = path.join(repoDir, source.basePath);
  if (!fs.existsSync(base) || !fs.statSync(base).isDirectory()) {
    throw new PulledSourceError(`pulled sources: ${source.repo} has no directory ${source.basePath}`);
  }
  const files = walkFiles(base);
  for (const page of source.pages) {
    if (!files.some((file) => file.relative === page.path)) {
      throw new PulledSourceError(
        `pulled sources: ${source.repo} does not contain ${source.basePath}/${page.path}`,
      );
    }
  }
  const { sha, published } = options.revision ?? revisionInfo(repoDir);

  const parent = path.dirname(workDir);
  const next = path.join(parent, `.next-${process.pid}-${source.source}`);
  fs.rmSync(next, { recursive: true, force: true });
  fs.mkdirSync(path.join(next, source.stageDir), { recursive: true });
  for (const file of files) {
    const from = path.join(base, file.relative);
    const to = path.join(next, source.stageDir, file.relative);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
  }
  fs.writeFileSync(
    path.join(next, "meta.json"),
    `${JSON.stringify({ repo: source.repo, ref: source.ref, sha, published }, null, 2)}\n`,
  );

  fs.rmSync(workDir, { recursive: true, force: true });
  fs.renameSync(next, workDir);
  return { sha, published };
}

/** Copy the last good work tree into the build's source tree. */
export function stageIntoDest(source, workDir, destRoot) {
  const metaPath = path.join(workDir, "meta.json");
  const sourceDir = path.join(workDir, source.stageDir);
  if (!fs.existsSync(metaPath) || !fs.existsSync(sourceDir)) {
    throw new PulledSourceError(`pulled sources: no staged copy for ${source.source}`);
  }
  const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
  if (!ISO.test(String(meta.published))) {
    throw new PulledSourceError(`pulled sources: ${source.source} has no usable publish date`);
  }
  const destination = path.join(destRoot, source.source);
  fs.rmSync(destination, { recursive: true, force: true });
  fs.mkdirSync(destination, { recursive: true });
  fs.cpSync(sourceDir, path.join(destination, source.stageDir), { recursive: true });
  const manifest = buildManifest(source, meta.published);
  fs.writeFileSync(path.join(destination, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  return { manifest, meta };
}

export function pullSource(source, options = {}) {
  const workRoot = options.workRoot ?? DEFAULT_WORK;
  const destRoot = options.destRoot ?? DEFAULT_DEST;
  const allowStale = options.allowStale ?? false;
  const clone = options.clone ?? cloneSource;
  const workDir = path.join(workRoot, source.source);
  fs.mkdirSync(workRoot, { recursive: true });
  const temp = path.join(workRoot, `.clone-${process.pid}-${source.source}`);
  fs.rmSync(temp, { recursive: true, force: true });

  let stale = false;
  try {
    clone(source, temp);
    stageCheckout(source, temp, workDir);
    fs.rmSync(temp, { recursive: true, force: true });
  } catch (error) {
    fs.rmSync(temp, { recursive: true, force: true });
    if (!allowStale || !fs.existsSync(path.join(workDir, "meta.json"))) throw error;
    stale = true;
    console.warn(`pulled sources: ${source.source} fetch failed; keeping the last good copy (${error.message})`);
  }

  const staged = stageIntoDest(source, workDir, destRoot);
  return { source: source.source, stale, ...staged };
}

function parseArgs(argv) {
  const options = {
    config: DEFAULT_CONFIG_PATH,
    dest: DEFAULT_DEST,
    work: DEFAULT_WORK,
    fingerprint: false,
    allowStale: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case "--config":
        options.config = path.resolve(argv[++index]);
        break;
      case "--dest":
        options.dest = path.resolve(argv[++index]);
        break;
      case "--work":
        options.work = path.resolve(argv[++index]);
        break;
      case "--fingerprint":
        options.fingerprint = true;
        break;
      case "--allow-stale":
        options.allowStale = true;
        break;
      case "-h":
      case "--help":
        console.log(
          "usage: pull-sources.mjs [--config FILE] [--dest DIR] [--work DIR] [--fingerprint] [--allow-stale]",
        );
        process.exit(0);
        break;
      default:
        throw new PulledSourceError(`pulled sources: unknown argument ${arg}`);
    }
  }
  return options;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const config = readConfig(options.config);
  if (options.fingerprint) {
    try {
      console.log(fingerprintFor(config));
    } catch (error) {
      console.log("unavailable");
      console.error(`pulled sources: fingerprint unavailable: ${error.message}`);
    }
    return;
  }
  for (const source of config.sources) {
    const result = pullSource(source, {
      workRoot: options.work,
      destRoot: options.dest,
      allowStale: options.allowStale,
    });
    console.log(
      `pulled sources: ${source.source} ${result.manifest.items.length} item(s) from ${source.repo}@${result.meta.sha.slice(0, 7)}` +
        `${result.stale ? " (last good copy)" : ""}`,
    );
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
