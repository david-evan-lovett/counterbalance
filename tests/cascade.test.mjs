import { test } from 'node:test';
import assert from 'node:assert';
import { resolveFirstLayer } from '../plugins/counterbalance/lib/cascade.mjs';

test('cascade: returns first layer that parses', async () => {
  const layers = [
    { path: '/path/1', source: 'local' },
    { path: '/path/2', source: 'project' },
  ];

  const parse = async (path, source) => {
    if (path === '/path/1') {
      return { id: 'profile', source };
    }
    return null;
  };

  const result = await resolveFirstLayer(layers, parse);

  assert.ok(result, 'should return a result');
  assert.strictEqual(result.id, 'profile', 'should return the first layer result');
  assert.strictEqual(result.source, 'local', 'should be from local layer');
});

test('cascade: skips layers whose parse returns null and returns second', async () => {
  const layers = [
    { path: '/path/1', source: 'local' },
    { path: '/path/2', source: 'project' },
  ];

  const parse = async (path, source) => {
    if (path === '/path/2') {
      return { id: 'profile', source };
    }
    return null;
  };

  const result = await resolveFirstLayer(layers, parse);

  assert.ok(result, 'should return a result');
  assert.strictEqual(result.id, 'profile', 'should return the second layer result');
  assert.strictEqual(result.source, 'project', 'should be from project layer');
});

test('cascade: returns null when all layers return null', async () => {
  const layers = [
    { path: '/path/1', source: 'local' },
    { path: '/path/2', source: 'project' },
  ];

  const parse = async (path, source) => null;

  const result = await resolveFirstLayer(layers, parse);

  assert.strictEqual(result, null, 'should return null when all layers return null');
});

test('cascade: empty layers array returns null', async () => {
  const layers = [];

  const parse = async (path, source) => {
    return { id: 'profile', source };
  };

  const result = await resolveFirstLayer(layers, parse);

  assert.strictEqual(result, null, 'should return null for empty layers array');
});
