#!/usr/bin/env node
// contract/validate-manifest.mjs
//
// The manifest validator used by contract/publish/action.yml, by the hub build
// (phase-2-seams SEAM-1), and by contract/test/validate.test.mjs.
//
// It has NO runtime dependencies, on purpose. It runs inside a satellite's
// workflow, in a repository that holds no credential of ours and that we do not
// want to force through an `npm ci` on every publish. ajv is a devDependency
// here and is used only by the test suite, which cross-checks every fixture
// against ajv so this interpreter can never silently disagree with the schema.
//
// Three checks, in the order contract/publish/action.yml runs them:
//
//   schema  validateManifestShape()  JSON Schema + the two contract rules JSON
//                                    Schema cannot express (slug uniqueness).
//   paths   checkPaths()             every item's path resolves inside dist/,
//                                    symlinks included (ADR-0002).
//   source  checkSource()            the manifest's source equals the input.
//
// Every error names the offending field and, where there is one, the item.

import { existsSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SCHEMA_PATH = fileURLToPath(
  new URL('./manifest.schema.json', import.meta.url),
);

/** Keywords that carry no assertion. */

// Patterns may contain literal control characters (the path pattern excludes
// \\x00-\\x1f as a literal range). Printing one raw emits NUL into CI logs and into
// any transcript pasted downstream, which turns a text file into a binary one.
const showPattern = (p) => String(p).replace(/[\x00-\x1f]/g, (c) =>
  '\\x' + c.charCodeAt(0).toString(16).padStart(2, '0'));
const ANNOTATION_KEYWORDS = new Set([
  '$schema',
  '$id',
  '$comment',
  'title',
  'description',
  'examples',
  'default',
  'deprecated',
  'readOnly',
  'writeOnly',
]);

/**
 * Keywords this interpreter implements. Anything else in the schema throws
 * rather than being ignored: a schema that outgrows the interpreter must fail
 * loudly, never validate less than it claims to.
 */
const SUPPORTED_KEYWORDS = new Set([
  '$ref',
  '$defs',
  'type',
  'const',
  'enum',
  'properties',
  'required',
  'additionalProperties',
  'pattern',
  'minLength',
  'maxLength',
  'items',
  'minItems',
  'maxItems',
  'uniqueItems',
  'allOf',
  'if',
  'then',
  'else',
  'not',
]);

export function loadSchema(schemaPath = SCHEMA_PATH) {
  return JSON.parse(readFileSync(schemaPath, 'utf8'));
}

function jsonType(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (Number.isInteger(value)) return 'integer';
  return typeof value;
}

function typeMatches(value, expected) {
  const actual = jsonType(value);
  if (expected === 'number') return actual === 'number' || actual === 'integer';
  return actual === expected;
}

function childPointer(pointer, key) {
  return pointer === '' ? key : `${pointer}.${key}`;
}

function quoteList(values) {
  return values.map((v) => JSON.stringify(v)).join(', ');
}

function fieldName(pointer) {
  const tail = pointer.split('.').pop();
  return tail === undefined || tail === '' ? pointer : tail;
}

function resolveRef(ref, root) {
  if (!ref.startsWith('#/$defs/')) {
    throw new Error(
      `manifest.schema.json uses the $ref "${ref}", which contract/validate-manifest.mjs does not implement. Only "#/$defs/<name>" is supported.`,
    );
  }
  const name = ref.slice('#/$defs/'.length);
  const resolved = root.$defs?.[name];
  if (!resolved) {
    throw new Error(`manifest.schema.json has a dangling $ref: "${ref}".`);
  }
  return resolved;
}

function assertKeywordsSupported(schema, pointer) {
  for (const keyword of Object.keys(schema)) {
    if (ANNOTATION_KEYWORDS.has(keyword) || keyword === '$defs') continue;
    if (!SUPPORTED_KEYWORDS.has(keyword)) {
      throw new Error(
        `manifest.schema.json uses the keyword "${keyword}" (at schema location for ${pointer === '' ? 'the manifest root' : pointer}), which contract/validate-manifest.mjs does not implement. Implement it before using it, or the publish action would validate less than the schema claims.`,
      );
    }
  }
}

function matches(schema, value, root) {
  const probe = [];
  validateNode(schema, value, '', root, probe);
  return probe.length === 0;
}

function validateNode(schema, value, pointer, root, errors) {
  assertKeywordsSupported(schema, pointer);

  if (schema.$ref !== undefined) {
    validateNode(resolveRef(schema.$ref, root), value, pointer, root, errors);
  }

  if (schema.type !== undefined && !typeMatches(value, schema.type)) {
    errors.push({
      layer: 'json-schema',
      path: pointer,
      message: `must be of type ${schema.type} (got ${jsonType(value)})`,
    });
    // Every further assertion on this node would be noise.
    return;
  }

  if (schema.const !== undefined && JSON.stringify(value) !== JSON.stringify(schema.const)) {
    errors.push({
      layer: 'json-schema',
      path: pointer,
      message: `must be ${JSON.stringify(schema.const)} (got ${JSON.stringify(value)})`,
    });
  }

  if (schema.enum !== undefined) {
    const allowed = schema.enum.some(
      (candidate) => JSON.stringify(candidate) === JSON.stringify(value),
    );
    if (!allowed) {
      errors.push({
        layer: 'json-schema',
        path: pointer,
        message: `"${fieldName(pointer)}" must be one of ${quoteList(schema.enum)} (got ${JSON.stringify(value)})`,
      });
    }
  }

  if (typeof value === 'string') {
    if (schema.pattern !== undefined && !new RegExp(schema.pattern).test(value)) {
      errors.push({
        layer: 'json-schema',
        path: pointer,
        message: `"${fieldName(pointer)}" does not match the required pattern ${showPattern(schema.pattern)} (got ${JSON.stringify(value)})`,
      });
    }
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push({
        layer: 'json-schema',
        path: pointer,
        message: `"${fieldName(pointer)}" must be at least ${schema.minLength} character(s) long`,
      });
    }
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errors.push({
        layer: 'json-schema',
        path: pointer,
        message: `"${fieldName(pointer)}" must be at most ${schema.maxLength} character(s) long (got ${value.length})`,
      });
    }
  }

  if (jsonType(value) === 'object') {
    for (const required of schema.required ?? []) {
      if (!Object.prototype.hasOwnProperty.call(value, required)) {
        errors.push({
          layer: 'json-schema',
          path: childPointer(pointer, required),
          message: `missing required field "${required}"${pointer === '' ? ' on the manifest' : ` on ${pointer}`}`,
        });
      }
    }
    const declared = schema.properties ?? {};
    for (const [key, child] of Object.entries(value)) {
      if (Object.prototype.hasOwnProperty.call(declared, key)) {
        validateNode(declared[key], child, childPointer(pointer, key), root, errors);
      } else if (schema.additionalProperties === false) {
        errors.push({
          layer: 'json-schema',
          path: childPointer(pointer, key),
          message: `unknown field "${key}"${pointer === '' ? ' on the manifest' : ` on ${pointer}`} — the manifest schema declares no such field and additionalProperties is false`,
        });
      }
    }
  }

  if (jsonType(value) === 'array') {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      errors.push({
        layer: 'json-schema',
        path: pointer,
        message: `"${fieldName(pointer)}" must contain at least ${schema.minItems} item(s)`,
      });
    }
    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      errors.push({
        layer: 'json-schema',
        path: pointer,
        message: `"${fieldName(pointer)}" must contain at most ${schema.maxItems} item(s) (got ${value.length})`,
      });
    }
    if (schema.uniqueItems === true) {
      const seen = new Set();
      value.forEach((entry, index) => {
        const key = JSON.stringify(entry);
        if (seen.has(key)) {
          errors.push({
            layer: 'json-schema',
            path: `${pointer}[${index}]`,
            message: `"${fieldName(pointer)}" must not repeat a value (${JSON.stringify(entry)} appears more than once)`,
          });
        }
        seen.add(key);
      });
    }
    if (schema.items !== undefined) {
      value.forEach((entry, index) => {
        validateNode(schema.items, entry, `${pointer}[${index}]`, root, errors);
      });
    }
  }

  for (const subschema of schema.allOf ?? []) {
    validateNode(subschema, value, pointer, root, errors);
  }

  if (schema.if !== undefined) {
    const branch = matches(schema.if, value, root) ? schema.then : schema.else;
    if (branch !== undefined) {
      validateNode(branch, value, pointer, root, errors);
    }
  }

  if (schema.not !== undefined && matches(schema.not, value, root)) {
    const forbidden = schema.not.required;
    errors.push({
      layer: 'json-schema',
      path: pointer,
      message: forbidden
        ? `must not carry the field(s) ${quoteList(forbidden)} — only a format: data item may (ADR-0008 decision 5)`
        : 'must not match the forbidden shape',
    });
  }
}

/**
 * Validate a parsed manifest against contract/manifest.schema.json, then apply
 * the contract rules JSON Schema cannot express.
 *
 * @param {unknown} manifest parsed manifest
 * @param {{schema?: object}} [options]
 * @returns {{layer: string, path: string, message: string}[]} empty when valid
 */
export function validateManifestShape(manifest, options = {}) {
  const schema = options.schema ?? loadSchema();
  const errors = [];
  validateNode(schema, manifest, '', schema, errors);

  // Contract rule, not expressible in JSON Schema (draft 2020-12 has no
  // "unique by property" keyword): slug is unique within a manifest.
  // SEAM-1 requires every mirror of this schema to enforce it too.
  if (Array.isArray(manifest?.items)) {
    const firstSeenAt = new Map();
    manifest.items.forEach((item, index) => {
      const slug = item?.slug;
      if (typeof slug !== 'string') return;
      if (firstSeenAt.has(slug)) {
        errors.push({
          layer: 'contract-rule',
          path: `items[${index}].slug`,
          message: `duplicate slug ${JSON.stringify(slug)} — items[${firstSeenAt.get(slug)}] already uses it, and slug must be unique within a manifest`,
        });
      } else {
        firstSeenAt.set(slug, index);
      }
    });
  }

  return errors;
}

/**
 * Verify every item's path resolves inside dist/ (ADR-0002). Rejects absolute
 * paths, ".." segments, paths that do not exist, and anything that leaves dist/
 * through a symlink.
 *
 * @param {object} manifest
 * @param {string} distDir
 */
export function checkPaths(manifest, distDir) {
  const errors = [];
  if (!existsSync(distDir)) {
    return [
      {
        layer: 'contract-rule',
        path: 'dist',
        message: `the dist directory ${JSON.stringify(distDir)} does not exist`,
      },
    ];
  }
  const distReal = realpathSync(distDir);

  (manifest?.items ?? []).forEach((item, index) => {
    const pointer = `items[${index}].path`;
    const raw = item?.path;
    if (typeof raw !== 'string' || raw.length === 0) {
      errors.push({
        layer: 'contract-rule',
        path: pointer,
        message: 'path is missing or not a string',
      });
      return;
    }
    if (path.posix.isAbsolute(raw) || path.win32.isAbsolute(raw)) {
      errors.push({
        layer: 'contract-rule',
        path: pointer,
        message: `path ${JSON.stringify(raw)} is absolute; path is relative to dist/ and must not escape it`,
      });
      return;
    }
    if (raw.split(/[\\/]/).includes('..')) {
      errors.push({
        layer: 'contract-rule',
        path: pointer,
        message: `path ${JSON.stringify(raw)} contains a ".." segment; path is relative to dist/ and must not escape it`,
      });
      return;
    }
    const resolved = path.resolve(distReal, raw);
    if (!existsSync(resolved)) {
      errors.push({
        layer: 'contract-rule',
        path: pointer,
        message: `path ${JSON.stringify(raw)} does not exist under dist/ (looked for ${resolved})`,
      });
      return;
    }
    const real = realpathSync(resolved);
    if (real !== distReal && !real.startsWith(distReal + path.sep)) {
      errors.push({
        layer: 'contract-rule',
        path: pointer,
        message: `path ${JSON.stringify(raw)} resolves outside dist/ (a symlink leads to ${real}); path must stay inside dist/`,
      });
    }
  });

  return errors;
}

/**
 * Verify the manifest's source equals the source the workflow declared. The
 * bucket prefix is derived from the input, so a mismatch would publish one
 * source's content under another's prefix — or, far more often, fail with a
 * 403 that is hard to read (SEAM-2).
 */
export function checkSource(manifest, expectedSource) {
  if (manifest?.source !== expectedSource) {
    return [
      {
        layer: 'contract-rule',
        path: 'source',
        message: `the manifest's "source" is ${JSON.stringify(manifest?.source)} but the action was called with source: ${JSON.stringify(expectedSource)}; they must be identical, because the upload prefix comes from the input`,
      },
    ];
  }
  return [];
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { check: 'all' };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (!flag.startsWith('--')) {
      throw new Error(`unexpected argument ${JSON.stringify(flag)}`);
    }
    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--')) {
      throw new Error(`flag ${flag} needs a value`);
    }
    args[flag.slice(2)] = value;
    i += 1;
  }
  return args;
}

function report(checkName, errors) {
  const inActions = process.env.GITHUB_ACTIONS === 'true';
  process.stderr.write(
    `\nManifest check "${checkName}" FAILED with ${errors.length} error(s):\n`,
  );
  for (const error of errors) {
    const where = error.path === '' ? '(manifest root)' : error.path;
    const line = `  ${where}: ${error.message}`;
    process.stderr.write(`${line}\n`);
    if (inActions) {
      process.stdout.write(`::error title=Invalid manifest::${where}: ${error.message}\n`);
    }
  }
  process.stderr.write(
    '\nThe manifest was rejected before anything was uploaded. See contract/README.md.\n',
  );
}

function main(argv) {
  const args = parseArgs(argv);
  const dist = args.dist ?? './dist';
  const manifestPath = args.manifest ?? path.join(dist, 'manifest.json');

  if (!existsSync(manifestPath)) {
    process.stderr.write(
      `\nNo manifest at ${manifestPath}. A satellite publishes a finished dist/ whose root contains manifest.json. See contract/README.md.\n`,
    );
    return 1;
  }

  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    process.stderr.write(`\n${manifestPath} is not valid JSON: ${error.message}\n`);
    return 1;
  }

  const checks = args.check === 'all' ? ['schema', 'paths', 'source'] : [args.check];

  for (const check of checks) {
    let errors;
    switch (check) {
      case 'schema':
        errors = validateManifestShape(manifest);
        break;
      case 'paths':
        errors = checkPaths(manifest, dist);
        break;
      case 'source':
        if (args.source === undefined) {
          process.stderr.write('\nThe "source" check needs --source <name>.\n');
          return 1;
        }
        errors = checkSource(manifest, args.source);
        break;
      default:
        process.stderr.write(
          `\nUnknown check ${JSON.stringify(check)}; expected one of schema, paths, source, all.\n`,
        );
        return 1;
    }
    if (errors.length > 0) {
      report(check, errors);
      return 1;
    }
    process.stdout.write(`Manifest check "${check}" passed (${manifestPath}).\n`);
  }

  return 0;
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let code;
  try {
    code = main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`\n${error.message}\n`);
    code = 1;
  }
  process.exit(code);
}
