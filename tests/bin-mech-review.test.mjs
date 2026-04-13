import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runMechReview } from '../plugins/counterbalance/bin/mech-review.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const binPath = join(__dirname, '..', 'plugins', 'counterbalance', 'bin', 'mech-review.mjs');

// Note: AC4.2 "reviewer throws" coverage is partial — the unknown-id case
// exercises the wrapping path (in-band error shape). A throwing lib module
// would require injecting a mock REVIEWER_MAP, which the current design
// does not support. The per-reviewer tests in Phase 2 cover each reviewer's
// actual throw behavior.

test('AC4.1: runMechReview with all four reviewers returns four outputs in order', async () => {
  const result = await runMechReview({
    reviewerIds: ['readability', 'repetition-check', 'spread-check', 'passive-check'],
    draft: 'The cat sat. The dog ran. The bird flew.',
    voiceProfile: null
  });

  assert.strictEqual(result.outputs.length, 4);
  assert.strictEqual(result.outputs[0].reviewer, 'readability');
  assert.strictEqual(result.outputs[1].reviewer, 'repetition');
  assert.strictEqual(result.outputs[2].reviewer, 'spread');
  assert.strictEqual(result.outputs[3].reviewer, 'passive');
});

test('AC4.1: subset dispatch returns only requested reviewers', async () => {
  const result = await runMechReview({
    reviewerIds: ['readability'],
    draft: 'hello world'
  });

  assert.strictEqual(result.outputs.length, 1);
  assert.strictEqual(result.outputs[0].reviewer, 'readability');
  assert.ok('findings' in result.outputs[0]);
  assert.ok(Array.isArray(result.outputs[0].findings));
});

test('AC4.1: empty reviewer list returns empty outputs array', async () => {
  const result = await runMechReview({
    reviewerIds: [],
    draft: 'test'
  });

  assert.deepStrictEqual(result.outputs, []);
});

test('AC4.2: unknown reviewer id becomes in-band error', async () => {
  const result = await runMechReview({
    reviewerIds: ['readability', 'bogus', 'passive-check'],
    draft: 'hi'
  });

  assert.strictEqual(result.outputs.length, 3);
  assert.strictEqual(result.outputs[1].reviewer, 'bogus');
  assert.ok(result.outputs[1].error);
  assert.ok(result.outputs[1].error.includes('unknown reviewer'));
  assert.deepStrictEqual(result.outputs[1].findings, []);
  // verify the other two still ran
  assert.strictEqual(result.outputs[0].reviewer, 'readability');
  assert.strictEqual(result.outputs[2].reviewer, 'passive');
});

test('AC4.2: runMechReview with empty draft still returns one output per reviewer', async () => {
  const result = await runMechReview({
    reviewerIds: ['readability'],
    draft: ''
  });

  assert.strictEqual(result.outputs.length, 1);
  assert.strictEqual(result.outputs[0].reviewer, 'readability');
  assert.ok('findings' in result.outputs[0]);
  assert.ok(Array.isArray(result.outputs[0].findings));
});

test('AC4.1: runMechReview preserves reviewer id order', async () => {
  const result = await runMechReview({
    reviewerIds: ['passive-check', 'readability', 'spread-check'],
    draft: 'The cat was seen by the dog.'
  });

  assert.strictEqual(result.outputs.length, 3);
  assert.strictEqual(result.outputs[0].reviewer, 'passive');
  assert.strictEqual(result.outputs[1].reviewer, 'readability');
  assert.strictEqual(result.outputs[2].reviewer, 'spread');
});

test('CLI shell smoke test via execFileSync', () => {
  const out = execFileSync('node', [binPath, '--reviewers=readability', '--draft=hello world'], {
    encoding: 'utf8'
  });
  const parsed = JSON.parse(out);

  assert.strictEqual(parsed.outputs.length, 1);
  assert.strictEqual(parsed.outputs[0].reviewer, 'readability');
  assert.ok('findings' in parsed.outputs[0]);
});

test('CLI shell: missing --reviewers flag exits 1', () => {
  let caughtError = false;
  let stderr = '';

  try {
    execFileSync('node', [binPath, '--draft=hi'], {
      encoding: 'utf8'
    });
  } catch (err) {
    caughtError = true;
    assert.strictEqual(err.status, 1);
    stderr = err.stderr || '';
  }

  assert.ok(caughtError, 'should have thrown');
  assert.ok(stderr.includes('missing --reviewers'), `stderr should mention missing --reviewers, got: ${stderr}`);
});

test('CLI shell: multiple reviewers in one call', () => {
  const out = execFileSync('node', [binPath, '--reviewers=readability,passive-check', '--draft=The cat was seen.'], {
    encoding: 'utf8'
  });
  const parsed = JSON.parse(out);

  assert.strictEqual(parsed.outputs.length, 2);
  assert.strictEqual(parsed.outputs[0].reviewer, 'readability');
  assert.strictEqual(parsed.outputs[1].reviewer, 'passive');
  assert.ok('findings' in parsed.outputs[0]);
  assert.ok('findings' in parsed.outputs[1]);
});
