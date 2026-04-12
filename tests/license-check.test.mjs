import { test } from 'node:test';
import assert from 'node:assert';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

test('counterbalance.AC8.5: LICENSE file exists and contains "MIT License" heading', async () => {
  const licenseContent = await readFile(path.resolve(repoRoot, 'LICENSE'), 'utf-8');
  assert.ok(licenseContent.includes('MIT License'), 'LICENSE file should contain "MIT License" heading');
});

test('counterbalance.AC8.5: marketplace.json plugin entry declares license "MIT"', async () => {
  const marketplace = JSON.parse(
    await readFile(path.resolve(repoRoot, '.claude-plugin/marketplace.json'), 'utf-8')
  );
  const plugin = marketplace.plugins[0];
  assert.strictEqual(plugin.license, 'MIT', 'marketplace.json plugin entry should declare license "MIT"');
});

test('counterbalance.AC8.5: plugin.json declares license "MIT"', async () => {
  const plugin = JSON.parse(
    await readFile(path.resolve(repoRoot, 'plugins/counterbalance/.claude-plugin/plugin.json'), 'utf-8')
  );
  assert.strictEqual(plugin.license, 'MIT', 'plugin.json should declare license "MIT"');
});
