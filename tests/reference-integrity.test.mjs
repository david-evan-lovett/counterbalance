import { test } from 'node:test';
import assert from 'node:assert';
import { readFile, stat, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const skillPath = path.resolve(repoRoot, 'plugins/counterbalance/skills/counterbalance/SKILL.md');
const referencesDir = path.resolve(repoRoot, 'plugins/counterbalance/skills/counterbalance/references');
const commandsDir = path.resolve(repoRoot, 'plugins/counterbalance/commands');
const agentsDir = path.resolve(repoRoot, 'plugins/counterbalance/agents');
const reviewersPath = path.resolve(repoRoot, 'plugins/counterbalance/reviewers.json');

const ROOT_REF = /\$\{CLAUDE_PLUGIN_ROOT\}\/([a-zA-Z0-9_./\\-]+)/g;

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

test('reference integrity: every ${CLAUDE_PLUGIN_ROOT}-relative path in a command body exists', async () => {
  const commandFiles = await readdir(commandsDir);

  for (const filename of commandFiles) {
    if (!filename.endsWith('.md')) continue;

    const filePath = path.resolve(commandsDir, filename);
    const content = await readFile(filePath, 'utf-8');

    let match;
    const mentions = [];
    while ((match = ROOT_REF.exec(content)) !== null) {
      mentions.push(match[1]);
    }

    for (const mention of mentions) {
      const resolvedPath = path.resolve(repoRoot, 'plugins/counterbalance', mention);
      try {
        await stat(resolvedPath);
      } catch (err) {
        assert.fail(`command ${filename}: referenced path does not exist: ${mention} (resolved to ${resolvedPath})`);
      }
    }
  }
});

test('reference integrity: every ${CLAUDE_PLUGIN_ROOT}-relative path in an agent body exists', async () => {
  const agentFiles = await readdir(agentsDir);

  for (const filename of agentFiles) {
    if (!filename.endsWith('.md')) continue;

    const filePath = path.resolve(agentsDir, filename);
    const content = await readFile(filePath, 'utf-8');

    let match;
    const mentions = [];
    while ((match = ROOT_REF.exec(content)) !== null) {
      mentions.push(match[1]);
    }

    for (const mention of mentions) {
      const resolvedPath = path.resolve(repoRoot, 'plugins/counterbalance', mention);
      try {
        await stat(resolvedPath);
      } catch (err) {
        assert.fail(`agent ${filename}: referenced path does not exist: ${mention} (resolved to ${resolvedPath})`);
      }
    }
  }
});

test('reference integrity: every reviewers.json agent entry points to an existing file', async () => {
  const reviewersContent = await readFile(reviewersPath, 'utf-8');
  const reviewers = JSON.parse(reviewersContent);

  assert.ok(Array.isArray(reviewers.reviewers), 'reviewers.json should have a "reviewers" array');

  for (const reviewer of reviewers.reviewers) {
    if (!reviewer.agent) continue;

    // Format is "plugin-namespace:agent-name"
    const [namespace, agentName] = reviewer.agent.split(':');

    // For counterbalance plugin, resolve to plugins/counterbalance/agents/<name>.md
    if (namespace === 'counterbalance') {
      const agentPath = path.resolve(repoRoot, 'plugins/counterbalance/agents', `${agentName}.md`);
      try {
        await stat(agentPath);
      } catch (err) {
        assert.fail(`reviewers.json: agent "${reviewer.agent}" does not exist at ${agentPath}`);
      }
    }
  }
});

test('prose-review-suite.AC5.3: all rubric reference files exist', async () => {
  const rubricFiles = [
    'rubric-cliche.md',
    'rubric-opener.md',
    'rubric-cuttability.md',
    'rubric-concrete.md'
  ];
  const referencesDir = path.resolve(repoRoot, 'plugins/counterbalance/skills/counterbalance/references');
  for (const file of rubricFiles) {
    const filePath = path.resolve(referencesDir, file);
    const fileStat = await stat(filePath);
    assert.ok(fileStat.isFile(), `rubric file ${file} must exist`);
  }
});

test('prose-review-suite.AC5.3: each rubric is referenced by exactly one agent', async () => {
  const rubricFiles = [
    'rubric-cliche.md',
    'rubric-opener.md',
    'rubric-cuttability.md',
    'rubric-concrete.md'
  ];
  const agentsDir = path.resolve(repoRoot, 'plugins/counterbalance/agents');
  const entries = await readdir(agentsDir);
  const agentFiles = entries.filter(n => n.endsWith('.md'));
  const contents = await Promise.all(agentFiles.map(f => readFile(path.resolve(agentsDir, f), 'utf-8')));

  for (const rubric of rubricFiles) {
    const count = contents.filter(c => c.includes(`references/${rubric}`)).length;
    assert.strictEqual(count, 1, `rubric ${rubric} must be referenced by exactly one agent, found ${count}`);
  }
});
