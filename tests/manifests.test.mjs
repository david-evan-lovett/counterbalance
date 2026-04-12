import { test } from 'node:test';
import assert from 'node:assert';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

test('marketplace.json parses as valid JSON', async () => {
  const marketplaceContent = await readFile(
    path.resolve(repoRoot, '.claude-plugin/marketplace.json'),
    'utf-8'
  );
  const marketplace = JSON.parse(marketplaceContent);
  assert.ok(marketplace, 'marketplace should parse');
});

test('marketplace has required fields: name, owner.name, metadata.pluginRoot, and exactly one plugin', async () => {
  const marketplaceContent = await readFile(
    path.resolve(repoRoot, '.claude-plugin/marketplace.json'),
    'utf-8'
  );
  const marketplace = JSON.parse(marketplaceContent);

  assert.strictEqual(marketplace.name, 'counterbalance', 'marketplace.name should be counterbalance');
  assert.ok(marketplace.owner && marketplace.owner.name, 'marketplace.owner.name should be non-empty');
  assert.strictEqual(marketplace.metadata.pluginRoot, './plugins', 'metadata.pluginRoot should be ./plugins');
  assert.strictEqual(marketplace.plugins.length, 1, 'should have exactly one plugin entry');
});

test('plugin entry in marketplace has name and license', async () => {
  const marketplaceContent = await readFile(
    path.resolve(repoRoot, '.claude-plugin/marketplace.json'),
    'utf-8'
  );
  const marketplace = JSON.parse(marketplaceContent);
  const plugin = marketplace.plugins[0];

  assert.strictEqual(plugin.name, 'counterbalance', 'plugin.name should be counterbalance');
  assert.strictEqual(plugin.license, 'MIT', 'plugin.license should be MIT');
});

test('plugin.json parses as valid JSON', async () => {
  const pluginContent = await readFile(
    path.resolve(repoRoot, 'plugins/counterbalance/.claude-plugin/plugin.json'),
    'utf-8'
  );
  const plugin = JSON.parse(pluginContent);
  assert.ok(plugin, 'plugin should parse');
});

test('plugin.json has required fields: name, version (semver), license, and author.name', async () => {
  const pluginContent = await readFile(
    path.resolve(repoRoot, 'plugins/counterbalance/.claude-plugin/plugin.json'),
    'utf-8'
  );
  const plugin = JSON.parse(pluginContent);

  assert.strictEqual(plugin.name, 'counterbalance', 'plugin.name should be counterbalance');
  assert.ok(typeof plugin.version === 'string' && plugin.version.length > 0, 'plugin.version should be a non-empty string');
  assert.ok(/^\d+\.\d+\.\d+/.test(plugin.version), 'plugin.version should match semver-lite (/^\\d+\\.\\d+\\.\\d+/)');
  assert.strictEqual(plugin.license, 'MIT', 'plugin.license should be MIT');
  assert.ok(plugin.author && plugin.author.name && plugin.author.name.length > 0, 'plugin.author.name should be non-empty');
});
