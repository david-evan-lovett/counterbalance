import { test } from 'node:test';
import assert from 'node:assert';
import { toForwardSlashes } from '../plugins/counterbalance/lib/windows-path.mjs';

test('counterbalance.AC2.6: toForwardSlashes normalizes backslash-separated paths', () => {
  const result = toForwardSlashes('foo\\bar\\baz.md');
  assert.strictEqual(result, 'foo/bar/baz.md', 'should convert backslashes to forward slashes');
});

test('toForwardSlashes: forward-slash input passes through unchanged', () => {
  const result = toForwardSlashes('foo/bar/baz.md');
  assert.strictEqual(result, 'foo/bar/baz.md', 'should leave forward slashes alone');
});

test('toForwardSlashes: empty string returns empty string', () => {
  const result = toForwardSlashes('');
  assert.strictEqual(result, '', 'should return empty string');
});

test('toForwardSlashes: non-string returns the input unchanged', () => {
  assert.strictEqual(toForwardSlashes(null), null, 'null should pass through');
  assert.strictEqual(toForwardSlashes(undefined), undefined, 'undefined should pass through');
  assert.strictEqual(toForwardSlashes(42), 42, 'number should pass through');
  assert.deepStrictEqual(toForwardSlashes({ path: 'test' }), { path: 'test' }, 'object should pass through');
});
