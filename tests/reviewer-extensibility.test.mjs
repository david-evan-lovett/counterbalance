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

test('counterbalance.AC6.3: adding a stub reviewer touches zero existing files', async (t) => {
  const tmpDir = await mkdtempAsync(join(tmpdir(), 'cbal-test-'));

  t.after(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  try {
    // Step 1: Copy the entire plugin tree
    const tempPluginRoot = join(tmpDir, 'plugins', 'counterbalance');
    await cp(pluginRoot, tempPluginRoot, { recursive: true });

    // Step 2: Hash all existing files (excluding reviewers.json which will change)
    // Note: walkAndHash returns paths with OS separators, so we need to match those
    const beforeExclude = new Set(['reviewers.json']);
    const beforeHashes = await walkAndHash(tempPluginRoot, { exclude: beforeExclude });

    // Step 3: Write stub reviewer files and update reviewers.json
    // Create stub agent
    const stubAgentContent = `---
name: stub-reviewer
description: Stub reviewer for extensibility test
model: sonnet
tools: Read, Grep, Glob
---

Stub reviewer for extensibility test.`;

    await writeFile(join(tempPluginRoot, 'agents', 'stub-reviewer.md'), stubAgentContent);

    // Create stub command
    const stubCommandContent = `---
description: Stub command for extensibility test
allowed-tools: Task, Read
argument-hint: "[arg]"
---

Stub command for extensibility test.`;

    await writeFile(join(tempPluginRoot, 'commands', 'stub-check.md'), stubCommandContent);

    // Read existing registry and append new entry
    const registryPath = join(tempPluginRoot, 'reviewers.json');
    const registryContent = await readFile(registryPath, 'utf-8');
    const registry = JSON.parse(registryContent);

    registry.reviewers.push({
      id: 'stub-check',
      agent: 'counterbalance:stub-reviewer',
      command: '/counterbalance:stub-check',
      applies_to: ['**/*.md', '**/*.mdx'],
      description: 'Stub reviewer for extensibility test.'
    });

    await writeFile(registryPath, JSON.stringify(registry, null, 2) + '\n');

    // Step 4: Re-hash all files except the new ones and reviewers.json
    // The afterExclude includes the two new stub files we just created
    // Note: walkAndHash returns paths with OS separators (backslashes on Windows)
    const afterExclude = new Set([
      'reviewers.json',
      'agents\\stub-reviewer.md',
      'commands\\stub-check.md'
    ]);
    const afterHashes = await walkAndHash(tempPluginRoot, { exclude: afterExclude });

    // Step 5: Assert hashes are equal
    // This verifies that no existing file was modified to add the stub reviewer
    assert.deepStrictEqual(
      beforeHashes,
      afterHashes,
      'adding a stub reviewer must not modify any existing file'
    );
  } catch (err) {
    throw err;
  }
});

test('counterbalance.AC6.3: registry enumeration picks up the stub reviewer without code changes', async (t) => {
  const tmpDir = await mkdtempAsync(join(tmpdir(), 'cbal-test-'));

  t.after(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  try {
    // Copy the plugin tree
    const tempPluginRoot = join(tmpDir, 'plugins', 'counterbalance');
    await cp(pluginRoot, tempPluginRoot, { recursive: true });

    // Create stub agent
    const stubAgentContent = `---
name: stub-reviewer
description: Stub reviewer for extensibility test
model: sonnet
tools: Read, Grep, Glob
---

Stub reviewer for extensibility test.`;

    await writeFile(join(tempPluginRoot, 'agents', 'stub-reviewer.md'), stubAgentContent);

    // Create stub command
    const stubCommandContent = `---
description: Stub command for extensibility test
allowed-tools: Task, Read
argument-hint: "[arg]"
---

Stub command for extensibility test.`;

    await writeFile(join(tempPluginRoot, 'commands', 'stub-check.md'), stubCommandContent);

    // Read existing registry and append new entry
    const registryPath = join(tempPluginRoot, 'reviewers.json');
    const registryContent = await readFile(registryPath, 'utf-8');
    const registry = JSON.parse(registryContent);

    registry.reviewers.push({
      id: 'stub-check',
      agent: 'counterbalance:stub-reviewer',
      command: '/counterbalance:stub-check',
      applies_to: ['**/*.md', '**/*.mdx'],
      description: 'Stub reviewer for extensibility test.'
    });

    await writeFile(registryPath, JSON.stringify(registry, null, 2) + '\n');

    // Load the modified registry and check applicability
    const loadedRegistry = await loadRegistry(tempPluginRoot);
    const applicableList = applicableReviewers(loadedRegistry, 'foo.md');

    // Should return 2 reviewers now
    assert.strictEqual(
      applicableList.length,
      2,
      'registry enumeration should return 2 reviewers for foo.md'
    );
  } catch (err) {
    throw err;
  }
});

test('counterbalance.AC6.3: the added stub reviewer is the second-listed one in the registry', async (t) => {
  const tmpDir = await mkdtempAsync(join(tmpdir(), 'cbal-test-'));

  t.after(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  try {
    // Copy the plugin tree
    const tempPluginRoot = join(tmpDir, 'plugins', 'counterbalance');
    await cp(pluginRoot, tempPluginRoot, { recursive: true });

    // Create stub agent
    const stubAgentContent = `---
name: stub-reviewer
description: Stub reviewer for extensibility test
model: sonnet
tools: Read, Grep, Glob
---

Stub reviewer for extensibility test.`;

    await writeFile(join(tempPluginRoot, 'agents', 'stub-reviewer.md'), stubAgentContent);

    // Create stub command
    const stubCommandContent = `---
description: Stub command for extensibility test
allowed-tools: Task, Read
argument-hint: "[arg]"
---

Stub command for extensibility test.`;

    await writeFile(join(tempPluginRoot, 'commands', 'stub-check.md'), stubCommandContent);

    // Read existing registry and append new entry
    const registryPath = join(tempPluginRoot, 'reviewers.json');
    const registryContent = await readFile(registryPath, 'utf-8');
    const registry = JSON.parse(registryContent);

    registry.reviewers.push({
      id: 'stub-check',
      agent: 'counterbalance:stub-reviewer',
      command: '/counterbalance:stub-check',
      applies_to: ['**/*.md', '**/*.mdx'],
      description: 'Stub reviewer for extensibility test.'
    });

    await writeFile(registryPath, JSON.stringify(registry, null, 2) + '\n');

    // Load the modified registry and check ordering
    const loadedRegistry = await loadRegistry(tempPluginRoot);
    const applicableList = applicableReviewers(loadedRegistry, 'foo.md');

    // Check that first is voice-check, second is stub-check
    assert.strictEqual(applicableList[0].id, 'voice-check', 'first reviewer should be voice-check');
    assert.strictEqual(applicableList[1].id, 'stub-check', 'second reviewer should be stub-check');
  } catch (err) {
    throw err;
  }
});
