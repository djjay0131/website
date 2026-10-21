// THE SATELLITE -> REPOSITORY MAP, READ AT PRIVATE-BUILD TIME (D27).
//
// Source of truth is the hub-side satellite config: `infra/terraform.tfvars`
// when present, otherwise the `default` of `var.satellites` in
// `infra/variables.tf`. The map is not a manifest field and is not committed in
// a second place. Private pages render it; the public build never imports this
// module, so no repository name reaches the public output from here.
//
// `HUB_SATELLITE_REPOS` is an optional JSON object (`{"source":"owner/repo"}`)
// used by the synthetic visual check so CI screenshots never carry a real
// private repository name.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));

/** Walk up from `start` until the directory that holds infra/variables.tf. */
export function findRepoRoot(start) {
  let directory = path.resolve(start);
  for (;;) {
    if (fs.existsSync(path.join(directory, "infra", "variables.tf"))) return directory;
    const parent = path.dirname(directory);
    if (parent === directory) return null;
    directory = parent;
  }
}

// Astro/Vite may rewrite import.meta.url to a bundled or virtual path, so the
// build directory (process.cwd(), normally `site/`) is the reliable start.
export const REPO_ROOT =
  findRepoRoot(process.cwd()) ?? findRepoRoot(MODULE_DIR) ?? path.resolve(MODULE_DIR, "../../..");
const SOURCE = /^[a-z][a-z0-9-]{0,38}$/;
const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const ENV_NAME = "HUB_SATELLITE_REPOS";
const cache = new Map();

/** Strip HCL comments; the config blocks we read contain no `#` in values. */
function withoutComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\s)\/\/.*$/gm, "$1")
    .replace(/(^|\s)#.*$/gm, "$1");
}

/** The text inside the brace at `open`, or null when it is unbalanced. */
function braceBlock(text, open) {
  let depth = 0;
  let quoted = false;
  for (let index = open; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === "\\") index += 1;
      else if (char === '"') quoted = false;
      continue;
    }
    if (char === '"') {
      quoted = true;
      continue;
    }
    if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(open + 1, index);
    }
  }
  return null;
}

function blockAfter(text, pattern) {
  const match = pattern.exec(text);
  if (!match) return null;
  const open = match.index + match[0].length - 1;
  return text[open] === "{" ? braceBlock(text, open) : null;
}

/**
 * Extract `source -> owner/repo` from one satellites map block.
 * Malformed entries are ignored: a missing link is better than a wrong one.
 */
export function parseSatelliteRepositories(text) {
  const clean = withoutComments(String(text ?? ""));
  const tfvars = blockAfter(clean, /^[ \t]*satellites[ \t]*=[ \t]*\{/m);
  const variable = /variable[ \t]+"satellites"[ \t]*\{/.exec(clean);
  const defaults = variable
    ? blockAfter(clean.slice(variable.index), /^[ \t]*default[ \t]*=[ \t]*\{/m)
    : null;
  const body = tfvars ?? defaults;
  if (!body) return {};

  const repositories = {};
  const entry = /(?:^|\n)[ \t]*([a-z][a-z0-9-]{0,38})[ \t]*=[ \t]*\{/g;
  let match;
  while ((match = entry.exec(body)) !== null) {
    const open = match.index + match[0].length - 1;
    const inner = braceBlock(body, open);
    if (!inner) continue;
    const repository = /\brepository[ \t]*=[ \t]*"([^"]+)"/.exec(inner);
    if (!repository) continue;
    const name = repository[1].trim();
    if (!SOURCE.test(match[1]) || !REPOSITORY.test(name)) continue;
    repositories[match[1]] = name;
  }
  return repositories;
}

function fromEnvironment(env) {
  const raw = env?.[ENV_NAME];
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const repositories = {};
    for (const [source, repository] of Object.entries(parsed)) {
      if (SOURCE.test(source) && typeof repository === "string" && REPOSITORY.test(repository)) {
        repositories[source] = repository;
      }
    }
    return repositories;
  } catch {
    return {};
  }
}

/** Read the map once per root. An explicit env map wins over the files. */
export function readSatelliteRepositories({ root = REPO_ROOT, env = process.env } = {}) {
  const override = fromEnvironment(env);
  if (override !== null) return override;
  if (cache.has(root)) return cache.get(root);

  let repositories = {};
  for (const relative of ["infra/terraform.tfvars", "infra/variables.tf"]) {
    let text;
    try {
      text = fs.readFileSync(path.join(root, relative), "utf8");
    } catch {
      continue;
    }
    repositories = parseSatelliteRepositories(text);
    if (Object.keys(repositories).length > 0) break;
  }
  cache.set(root, repositories);
  return repositories;
}

/** The owner/repo for one source, or null when the satellite declares none. */
export function repositoryFor(source, options = {}) {
  if (typeof source !== "string" || !SOURCE.test(source)) return null;
  return readSatelliteRepositories(options)[source] ?? null;
}

export function githubRepositoryUrl(repository) {
  return typeof repository === "string" && REPOSITORY.test(repository)
    ? `https://github.com/${repository}`
    : null;
}
