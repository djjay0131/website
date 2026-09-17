// contract/test/validate.test.mjs
//
// Deliverable D5: a runnable check that contract/manifest.schema.json accepts
// contract/examples/manifest.example.json and rejects every fixture under
// contract/examples/invalid/, each for the reason it is named for.
//
// Run with:  cd contract && npm ci && npm test
//
// The suite validates every fixture TWICE: once with ajv (a conformant JSON
// Schema 2020-12 implementation) and once with contract/validate-manifest.mjs
// (the dependency-free interpreter the publish action actually runs), and
// asserts the two agree on every fixture. That is what lets the action ship
// without ajv while still being bound by the schema.
//
// The site stream validates the SAME fixtures against its Zod mirror
// (phase-2-seams SEAM-1). Do not fork these files.

import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  checkPaths,
  checkSource,
  loadSchema,
  validateManifestShape,
} from '../validate-manifest.mjs';

const CONTRACT_DIR = fileURLToPath(new URL('..', import.meta.url));
const EXAMPLE_PATH = path.join(CONTRACT_DIR, 'examples', 'manifest.example.json');
const INVALID_DIR = path.join(CONTRACT_DIR, 'examples', 'invalid');

const schema = loadSchema();
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

const invalidFixtures = readdirSync(INVALID_DIR)
  .filter((name) => name.endsWith('.json'))
  .sort();

// ---------------------------------------------------------------------------
// ajv, used only here: an independent implementation to check the interpreter
// against. It is a devDependency and is never needed at publish time.
// ---------------------------------------------------------------------------

const ajvModule = await import('ajv/dist/2020.js');
const Ajv2020 = ajvModule.default?.default ?? ajvModule.default ?? ajvModule;
// strict: true is on deliberately - it makes ajv reject a typo'd or unknown
// keyword in manifest.schema.json, which is the same guarantee the interpreter
// gives. strictRequired is the one strict-mode lint switched off: it wants a
// property named in `required` to be declared in `properties` at the SAME
// schema level, and ajv does not look across the if/then boundary to see that
// $defs/item/properties already declares schema_version. That is an ajv style
// rule, not a JSON Schema rule, and contorting the schema to satisfy it would
// make every other validator's view of it worse.
const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
const ajvValidate = ajv.compile(schema);

function ajvErrorsFor(manifest) {
  const valid = ajvValidate(manifest);
  return valid ? [] : (ajvValidate.errors ?? []).map(
    (e) => `${e.instancePath || '(manifest root)'} ${e.message}${e.params?.allowedValues ? ` [${e.params.allowedValues.join(', ')}]` : ''}${e.params?.additionalProperty ? ` [${e.params.additionalProperty}]` : ''}${e.params?.missingProperty ? ` [${e.params.missingProperty}]` : ''}`,
  );
}

const render = (errors) => errors.map((e) => `    ${e.path === '' ? '(manifest root)' : e.path}: ${e.message}`).join('\n');

// ---------------------------------------------------------------------------
// The schema itself
// ---------------------------------------------------------------------------

test('the schema declares its draft explicitly and closes every object', () => {
  assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.$defs.item.additionalProperties, false);
});

test('the fixed sets are exactly those SEAM-1 declares', () => {
  const item = schema.$defs.item.properties;
  assert.deepEqual(item.section.enum, ['research', 'projects', 'writing', 'cv', 'phd']);
  assert.deepEqual(item.format.enum, ['md', 'mdx', 'html', 'pdf', 'bundle', 'data']);
  assert.deepEqual(item.visibility.enum, ['public', 'private']);
  assert.deepEqual(schema.required, ['source', 'published', 'items']);
  assert.deepEqual(schema.$defs.item.required, [
    'slug', 'title', 'section', 'format', 'path', 'visibility', 'date',
  ]);
});

// ---------------------------------------------------------------------------
// D5, acceptance: the design doc §4 example
// ---------------------------------------------------------------------------

test('the design doc §4 example manifest is accepted', () => {
  const manifest = readJson(EXAMPLE_PATH);
  const errors = validateManifestShape(manifest, { schema });
  assert.deepEqual(errors, [], `example rejected:\n${render(errors)}`);
  assert.deepEqual(ajvErrorsFor(manifest), [], 'ajv rejected the example');
  console.log('  examples/manifest.example.json: ACCEPTED by both validators');
});

test('a manifest publishing zero items is accepted (withdrawal, not an error)', () => {
  const manifest = { source: 'cv', published: '2026-09-16T09:15:00Z', items: [] };
  assert.deepEqual(validateManifestShape(manifest, { schema }), []);
  assert.deepEqual(ajvErrorsFor(manifest), []);
});

test('a well-formed data item carrying schema_version is accepted', () => {
  const manifest = {
    source: 'cv',
    published: '2026-09-16T09:15:00Z',
    items: [{
      slug: 'cv-data',
      title: 'CV source data',
      section: 'cv',
      format: 'data',
      path: 'cv-data/',
      visibility: 'public',
      date: '2026-09-16',
      schema_version: '1',
    }],
  };
  assert.deepEqual(validateManifestShape(manifest, { schema }), []);
  assert.deepEqual(ajvErrorsFor(manifest), []);
});

// ---------------------------------------------------------------------------
// D5, rejection: every fixture under examples/invalid/
// ---------------------------------------------------------------------------

test('every invalid fixture is rejected, and the error names the offending field', async (t) => {
  assert.ok(invalidFixtures.length >= 8, 'expected the full set of invalid fixtures');

  for (const name of invalidFixtures) {
    await t.test(name, () => {
      const manifest = readJson(path.join(INVALID_DIR, name));
      const errors = validateManifestShape(manifest, { schema });
      assert.ok(errors.length > 0, `${name} was ACCEPTED but must be rejected`);
      console.log(`  ${name}: REJECTED (${errors.map((e) => e.layer).join(', ')})\n${render(errors)}`);
    });
  }
});

test('the reason each fixture is rejected is the reason its name claims', async (t) => {
  const expectations = {
    'manifest-missing-required-field.json': /missing required field "published"/,
    'manifest-version-not-an-integer.json': /manifest_version.*required pattern/,
    'item-missing-required-field.json': /missing required field "date"/,
    'section-out-of-set.json': /"section" must be one of .*"phd".*got "notes"/,
    'format-out-of-set.json': /"format" must be one of .*"data".*got "docx"/,
    'visibility-out-of-set.json': /"visibility" must be one of .*got "secret"/,
    'duplicate-slug.json': /duplicate slug "committee-dossier"/,
    'path-escapes-dist-parent-segment.json': /"path" does not match the required pattern/,
    'path-escapes-dist-absolute.json': /"path" does not match the required pattern/,
    'data-item-without-schema-version.json': /missing required field "schema_version"/,
    'schema-version-on-non-data-item.json': /must not carry the field\(s\) "schema_version"/,
    'unknown-top-level-field.json': /unknown field "dispatch_token"/,
    'unknown-item-field.json': /unknown field "redirect_to"/,
  };

  for (const [name, pattern] of Object.entries(expectations)) {
    await t.test(name, () => {
      const errors = validateManifestShape(readJson(path.join(INVALID_DIR, name)), { schema });
      const joined = errors.map((e) => `${e.path}: ${e.message}`).join('\n');
      assert.match(joined, pattern);
    });
  }

  // Every fixture on disk must be covered by an expectation, so a new fixture
  // cannot be added without saying what it proves.
  assert.deepEqual(invalidFixtures, Object.keys(expectations).sort());
});

test('ajv and the dependency-free interpreter agree on every fixture', async (t) => {
  const all = [
    ['manifest.example.json', readJson(EXAMPLE_PATH)],
    ...invalidFixtures.map((n) => [n, readJson(path.join(INVALID_DIR, n))]),
  ];
  for (const [name, manifest] of all) {
    await t.test(name, () => {
      const ajvRejected = ajvErrorsFor(manifest).length > 0;
      const interpreterRejected = validateManifestShape(manifest, { schema })
        .some((e) => e.layer === 'json-schema');
      assert.equal(
        interpreterRejected,
        ajvRejected,
        `${name}: ajv ${ajvRejected ? 'rejects' : 'accepts'} but the interpreter ${interpreterRejected ? 'rejects' : 'accepts'} at the JSON Schema layer`,
      );
    });
  }
});

test('duplicate slug is a contract rule, not a JSON Schema rule', () => {
  // Recorded deliberately: JSON Schema 2020-12 has no "unique by property"
  // keyword, so ajv accepts duplicate-slug.json. Every mirror of this schema
  // must enforce slug uniqueness separately (SEAM-1).
  const manifest = readJson(path.join(INVALID_DIR, 'duplicate-slug.json'));
  assert.deepEqual(ajvErrorsFor(manifest), []);
  const errors = validateManifestShape(manifest, { schema });
  assert.equal(errors.length, 1);
  assert.equal(errors[0].layer, 'contract-rule');
});

// ---------------------------------------------------------------------------
// Path containment (ADR-0002) - the publish action's step (b). Unit-tested
// against a real directory tree, because only the filesystem knows where a
// symlink points. SEAM-7 requires this test.
// ---------------------------------------------------------------------------

function buildDistFixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'hub-contract-'));
  const dist = path.join(root, 'dist');
  const outside = path.join(root, 'outside');
  mkdirSync(path.join(dist, 'committee'), { recursive: true });
  mkdirSync(outside, { recursive: true });
  writeFileSync(path.join(dist, 'committee', 'index.html'), '<!doctype html>\n');
  writeFileSync(path.join(dist, 'manifest.json'), '{}\n');
  writeFileSync(path.join(outside, 'secrets.txt'), 'private\n');
  symlinkSync(path.join(outside, 'secrets.txt'), path.join(dist, 'escape.html'));
  symlinkSync(path.join(dist, 'committee', 'index.html'), path.join(dist, 'alias.html'));
  return { root, dist };
}

const withItem = (p) => ({
  source: 'phd-milestones',
  published: '2026-09-10T14:02:11Z',
  items: [{
    slug: 'committee-dossier',
    title: 'External Committee Dossier',
    section: 'phd',
    format: 'html',
    path: p,
    visibility: 'private',
    date: '2026-08-31',
  }],
});

test('a path inside dist/ is accepted', () => {
  const { dist } = buildDistFixture();
  assert.deepEqual(checkPaths(withItem('committee/index.html'), dist), []);
});

test('a symlink that stays inside dist/ is accepted', () => {
  const { dist } = buildDistFixture();
  assert.deepEqual(checkPaths(withItem('alias.html'), dist), []);
});

test('an absolute path is rejected', () => {
  const { dist } = buildDistFixture();
  const errors = checkPaths(withItem('/etc/passwd'), dist);
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /is absolute/);
  assert.equal(errors[0].path, 'items[0].path');
  console.log(`  absolute path: ${errors[0].path}: ${errors[0].message}`);
});

test('a ".." segment is rejected', () => {
  const { dist } = buildDistFixture();
  const errors = checkPaths(withItem('../outside/secrets.txt'), dist);
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /contains a "\.\." segment/);
  console.log(`  parent segment: ${errors[0].path}: ${errors[0].message}`);
});

test('a symlink that leaves dist/ is rejected', () => {
  const { dist } = buildDistFixture();
  const errors = checkPaths(withItem('escape.html'), dist);
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /resolves outside dist\//);
  console.log(`  symlink escape: ${errors[0].path}: ${errors[0].message}`);
});

test('a path that does not exist under dist/ is rejected', () => {
  const { dist } = buildDistFixture();
  const errors = checkPaths(withItem('committee/missing.html'), dist);
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /does not exist under dist\//);
});

// ---------------------------------------------------------------------------
// Source agreement - the publish action's step (c)
// ---------------------------------------------------------------------------

test('a manifest whose source differs from the action input is rejected', () => {
  const errors = checkSource(readJson(EXAMPLE_PATH), 'cv');
  assert.equal(errors.length, 1);
  assert.equal(errors[0].path, 'source');
  console.log(`  source mismatch: ${errors[0].path}: ${errors[0].message}`);
});

test('a manifest whose source matches the action input is accepted', () => {
  assert.deepEqual(checkSource(readJson(EXAMPLE_PATH), 'phd-milestones'), []);
});
