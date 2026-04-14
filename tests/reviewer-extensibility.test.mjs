import { test } from 'node:test';
import assert from 'node:assert';
import { readFile, writeFile, rm, cp } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtemp } from 'node:fs';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { loadRegistry, applicableReviewers } from '../plugins/counterbalance/lib/reviewers.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');
const repoRoot = join(__dirname, '..');
const pluginRoot = join(repoRoot, 'plugins', 'counterbalance');

const mkdtempAsync = promisify(mkdtemp);

// Helper to walk a directory and compute sha256 hashes
async function walkAndHash(dir, { exclude = new Set() } = {}) {
  const { readdir, readFile: readFileInternal } = await import('node:fs/promises');
  const path = await import('node:path');

  const hashes = {};

  async function walk(currentDir) {
    const entries = await readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      const relativePath = path.relative(dir, fullPath);

      if (exclude.has(relativePath)) {
        continue;
      }

      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        const content = await readFileInternal(fullPath, 'utf-8');
        const hash = createHash('sha256').update(content).digest('hex');
        hashes[relativePath] = hash;
      }
    }
  }

  await walk(dir);
  return hashes;
}

// Shared fixture setup: drop a second reviewer into a plugin-tree copy.
async function addStubReviewer(tempPluginRoot) {
  const stubAgent = `---
name: stub-reviewer
description: Stub reviewer for extensibility test
model: sonnet
tools: Read, Grep, Glob
---

Stub reviewer for extensibility test.`;

  const stubCommand = `---
description: Stub command for extensibility test
allowed-tools: Task, Read
argument-hint: "[arg]"
---

Stub command for extensibility test.`;

  await writeFile(join(tempPluginRoot, 'agents', 'stub-reviewer.md'), stubAgent);
  await writeFile(join(tempPluginRoot, 'commands', 'stub-check.md'), stubCommand);

  const registryPath = join(tempPluginRoot, 'reviewers.json');
  const registry = JSON.parse(await readFile(registryPath, 'utf-8'));
  registry.reviewers.push({
    id: 'stub-check',
    agent: 'counterbalance:stub-reviewer',
    command: '/counterbalance:stub-check',
    applies_to: ['**/*.md', '**/*.mdx'],
    description: 'Stub reviewer for extensibility test.',
  });
  await writeFile(registryPath, JSON.stringify(registry, null, 2) + '\n');
}

// Shared fixture setup: add a lib-type reviewer into a plugin-tree copy.
async function addStubLibReviewer(pluginRoot) {
  const libPath = join(pluginRoot, 'lib', 'stub-mech.mjs');
  await writeFile(libPath, `export async function review() {
    return { reviewer: 'stub-mech', findings: [] };
}
`, 'utf8');

  const commandPath = join(pluginRoot, 'commands', 'stub-mech.md');
  await writeFile(commandPath, `---
description: Stub mechanical reviewer for extensibility testing.
allowed-tools: Read, Bash
argument-hint: "[draft-file]"
---

Stub mechanical reviewer. Test-only.
`, 'utf8');

  const registryPath = join(pluginRoot, 'reviewers.json');
  const content = await readFile(registryPath, 'utf-8');
  const registry = JSON.parse(content);
  registry.reviewers.push({
    id: 'stub-mech',
    type: 'lib',
    lib: 'stub-mech.mjs',
    command: '/counterbalance:stub-mech',
    applies_to: ['**/*.md'],
    description: 'stub'
  });
  await writeFile(registryPath, JSON.stringify(registry, null, 2) + '\n', 'utf8');
}

test('counterbalance.AC6.3: adding a stub reviewer touches zero existing files', async (t) => {
  const tmpDir = await mkdtempAsync(join(tmpdir(), 'cbal-test-'));

  t.after(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  const tempPluginRoot = join(tmpDir, 'plugins', 'counterbalance');
  await cp(pluginRoot, tempPluginRoot, { recursive: true });

  const beforeExclude = new Set(['reviewers.json']);
  const beforeHashes = await walkAndHash(tempPluginRoot, { exclude: beforeExclude });

  await addStubReviewer(tempPluginRoot);

  // walkAndHash keys are OS-native relative paths — use path.join so the
  // exclude set matches on any OS, not just Windows.
  const afterExclude = new Set([
    'reviewers.json',
    join('agents', 'stub-reviewer.md'),
    join('commands', 'stub-check.md'),
  ]);
  const afterHashes = await walkAndHash(tempPluginRoot, { exclude: afterExclude });

  assert.deepStrictEqual(
    beforeHashes,
    afterHashes,
    'adding a stub reviewer must not modify any existing file',
  );
});

test('counterbalance.AC6.3: registry enumeration picks up the stub reviewer without code changes', async (t) => {
  const tmpDir = await mkdtempAsync(join(tmpdir(), 'cbal-test-'));

  t.after(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  const tempPluginRoot = join(tmpDir, 'plugins', 'counterbalance');
  await cp(pluginRoot, tempPluginRoot, { recursive: true });
  await addStubReviewer(tempPluginRoot);

  const loadedRegistry = await loadRegistry(tempPluginRoot);
  const applicableList = applicableReviewers(loadedRegistry, 'foo.md');

  assert.strictEqual(applicableList.length, 10, 'registry enumeration should return 10 reviewers for foo.md (9 baseline + 1 stub)');
});

test('counterbalance.AC6.3: the added stub reviewer is in the registry', async (t) => {
  const tmpDir = await mkdtempAsync(join(tmpdir(), 'cbal-test-'));

  t.after(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  const tempPluginRoot = join(tmpDir, 'plugins', 'counterbalance');
  await cp(pluginRoot, tempPluginRoot, { recursive: true });
  await addStubReviewer(tempPluginRoot);

  const loadedRegistry = await loadRegistry(tempPluginRoot);
  const applicableList = applicableReviewers(loadedRegistry, 'foo.md');

  assert.strictEqual(applicableList[0].id, 'voice-check', 'first reviewer should be voice-check');
  assert.ok(applicableList.some(r => r.id === 'stub-check'), 'stub-check should be in the applicable reviewers list');
});

test('prose-review-suite.AC2.4: adding a lib-type reviewer touches zero pre-existing files', async (t) => {
  const tmpDir = await mkdtempAsync(join(tmpdir(), 'cbal-ext-lib-'));

  t.after(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  const tempPluginRoot = join(tmpDir, 'counterbalance');
  await cp(pluginRoot, tempPluginRoot, { recursive: true });

  const beforeHashes = await walkAndHash(tempPluginRoot, {
    exclude: new Set(['reviewers.json'])
  });

  await addStubLibReviewer(tempPluginRoot);

  const afterHashes = await walkAndHash(tempPluginRoot, {
    exclude: new Set([
      'reviewers.json',
      join('lib', 'stub-mech.mjs'),
      join('commands', 'stub-mech.md')
    ])
  });

  assert.deepStrictEqual(beforeHashes, afterHashes, 'lib-type reviewer addition must not mutate any pre-existing file');
});

test('prose-review-suite.AC2.4: lib stub is applicable via applicableReviewers after registration', async (t) => {
  const tmpDir = await mkdtempAsync(join(tmpdir(), 'cbal-ext-lib-apply-'));

  t.after(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  const tempPluginRoot = join(tmpDir, 'counterbalance');
  await cp(pluginRoot, tempPluginRoot, { recursive: true });
  await addStubLibReviewer(tempPluginRoot);

  const registry = await loadRegistry(tempPluginRoot);
  const applicable = applicableReviewers(registry, 'foo.md');

  assert.strictEqual(applicable.length, 10, 'stub lib reviewer applicable alongside baseline');
  assert.ok(applicable.some(r => r.id === 'stub-mech'), 'stub-mech must be in applicable list');
  assert.strictEqual(applicable[0].id, 'voice-check', 'voice-check remains first');
});
