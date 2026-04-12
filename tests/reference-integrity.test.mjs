import { test } from 'node:test';
import assert from 'node:assert';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const skillPath = path.resolve(repoRoot, 'plugins/counterbalance/skills/counterbalance/SKILL.md');
const referencesDir = path.resolve(repoRoot, 'plugins/counterbalance/skills/counterbalance/references');

// Read SKILL.md
const skillContent = await readFile(skillPath, 'utf-8');

// Extract all references using the specified regex pattern
const referenceRegex = /references\/([a-z0-9-]+\.md)/g;
const mentionedFilenames = new Set();
let match;
while ((match = referenceRegex.exec(skillContent)) !== null) {
  mentionedFilenames.add(match[1]);
}

test('counterbalance.AC7.4: every references/*.md mentioned in SKILL.md exists on disk', async () => {
  assert.ok(mentionedFilenames.size > 0, 'SKILL.md should mention at least one reference file');

  for (const filename of mentionedFilenames) {
    const filePath = path.resolve(referencesDir, filename);
    try {
      await stat(filePath);
    } catch (err) {
      assert.fail(`missing reference file: ${filePath}`);
    }
  }
});

test('counterbalance.AC7.1: all six genre reference files exist', async () => {
  const genreFiles = [
    'genre-prd.md',
    'genre-pr.md',
    'genre-slack.md',
    'genre-adr.md',
    'genre-summary.md',
    'genre-feedback.md'
  ];

  for (const filename of genreFiles) {
    const filePath = path.resolve(referencesDir, filename);
    try {
      await stat(filePath);
    } catch (err) {
      assert.fail(`missing reference file: ${filePath}`);
    }
  }
});

test('counterbalance.AC7.2: all three benchmark reference files exist', async () => {
  const benchmarkFiles = [
    'benchmark-story.md',
    'benchmark-poem.md',
    'benchmark-limerick.md'
  ];

  for (const filename of benchmarkFiles) {
    const filePath = path.resolve(referencesDir, filename);
    try {
      await stat(filePath);
    } catch (err) {
      assert.fail(`missing reference file: ${filePath}`);
    }
  }
});

test('counterbalance.AC7.3: each benchmark file contains both an in-voice and an AI-slop section', async () => {
  const benchmarkFiles = [
    'benchmark-story.md',
    'benchmark-poem.md',
    'benchmark-limerick.md'
  ];

  for (const filename of benchmarkFiles) {
    const filePath = path.resolve(referencesDir, filename);
    const content = await readFile(filePath, 'utf-8');

    const hasInVoice = /##\s+In-voice draft/i.test(content);
    const hasAISlop = /##\s+AI-slop draft/i.test(content);

    assert.ok(hasInVoice, `${filename} should contain "## In-voice draft" section`);
    assert.ok(hasAISlop, `${filename} should contain "## AI-slop draft" section`);
  }
});
