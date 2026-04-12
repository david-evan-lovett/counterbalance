import { test } from 'node:test';
import assert from 'node:assert';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');
const repoRoot = join(__dirname, '..');
const pluginRoot = join(repoRoot, 'plugins', 'counterbalance');

// Helper to extract frontmatter from markdown
function extractFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) {
    throw new Error('No frontmatter found');
  }
  return yaml.load(match[1]);
}

// Helper to get body content (everything after frontmatter)
function extractBody(content) {
  const match = content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
  return match ? match[1] : content;
}

// === AGENT TESTS ===

test('counterbalance.AC3.5: counterbalance agent tools field is exactly "Read, Write, Edit, Glob, Grep, Bash, AskUserQuestion, Task"', async () => {
  const agentPath = join(pluginRoot, 'agents', 'counterbalance.md');
  const content = await readFile(agentPath, 'utf-8');
  const fm = extractFrontmatter(content);

  const expectedTools = 'Read, Write, Edit, Glob, Grep, Bash, AskUserQuestion, Task';
  assert.strictEqual(fm.tools, expectedTools, `tools field must be exactly "${expectedTools}"`);
});

test('agent frontmatter has name === "counterbalance", model === "opus", description is non-empty', async () => {
  const agentPath = join(pluginRoot, 'agents', 'counterbalance.md');
  const content = await readFile(agentPath, 'utf-8');
  const fm = extractFrontmatter(content);

  assert.strictEqual(fm.name, 'counterbalance', 'name must be "counterbalance"');
  assert.strictEqual(fm.model, 'opus', 'model must be "opus"');
  assert.ok(fm.description && fm.description.length > 0, 'description must be non-empty');
});

test('counterbalance.AC3.4: agent body contains "Drafting Loop"', async () => {
  const agentPath = join(pluginRoot, 'agents', 'counterbalance.md');
  const content = await readFile(agentPath, 'utf-8');
  const body = extractBody(content);

  assert.ok(body.includes('Drafting Loop'), 'agent body must contain "Drafting Loop"');
});

test('counterbalance.AC3.4: agent body contains "<-" correction operator instruction', async () => {
  const agentPath = join(pluginRoot, 'agents', 'counterbalance.md');
  const content = await readFile(agentPath, 'utf-8');
  const body = extractBody(content);

  // Look for the section header "## `<-` correction operator" or similar
  const operatorSectionExists = body.includes('`<-`') || body.includes('`<-` correction');
  assert.ok(operatorSectionExists, 'body must have a dedicated "<-" correction operator section');

  assert.ok(body.includes('<-'), 'body must mention the "<-" operator');
});

test('counterbalance.AC3.6: agent body references fallback-voice.md as the null-profile fallback path', async () => {
  const agentPath = join(pluginRoot, 'agents', 'counterbalance.md');
  const content = await readFile(agentPath, 'utf-8');
  const body = extractBody(content);

  assert.ok(
    body.includes('fallback-voice.md'),
    'agent body must reference "fallback-voice.md" for null-profile fallback',
  );
});

test('counterbalance.AC4.1: agent body references scanning $HOME/.claude/CLAUDE.md', async () => {
  const agentPath = join(pluginRoot, 'agents', 'counterbalance.md');
  const content = await readFile(agentPath, 'utf-8');
  const body = extractBody(content);

  assert.ok(
    body.includes('$HOME/.claude/CLAUDE.md') || body.includes('~/.claude/CLAUDE.md'),
    'agent body must reference CLAUDE.md path for pre-flight scanning',
  );
});

test('counterbalance.AC4.1: agent body declares heading-agnostic matching', async () => {
  const agentPath = join(pluginRoot, 'agents', 'counterbalance.md');
  const content = await readFile(agentPath, 'utf-8');
  const body = extractBody(content);

  assert.ok(
    body.toLowerCase().includes('heading-agnostic'),
    'agent body must declare "heading-agnostic" matching for CLAUDE.md scanning',
  );
});

test('counterbalance.AC4.2: agent body instructs showing extracted content verbatim before any write', async () => {
  const agentPath = join(pluginRoot, 'agents', 'counterbalance.md');
  const content = await readFile(agentPath, 'utf-8');
  const body = extractBody(content);

  assert.ok(body.includes('verbatim'), 'agent body must mention showing content "verbatim"');
  assert.ok(body.includes('AskUserQuestion'), 'agent body must mention AskUserQuestion for approval');

  // These should be reasonably close (within 500 chars) in the flow
  const verbatimIndex = body.indexOf('verbatim');
  const askIndex = body.indexOf('AskUserQuestion');
  assert.ok(
    Math.abs(verbatimIndex - askIndex) < 500,
    'verbatim and AskUserQuestion should be near each other in the pre-flight flow',
  );
});

test('counterbalance.AC4.3: agent body references destination $HOME/.claude/plugins/data/counterbalance/profiles/default.md', async () => {
  const agentPath = join(pluginRoot, 'agents', 'counterbalance.md');
  const content = await readFile(agentPath, 'utf-8');
  const body = extractBody(content);

  assert.ok(
    body.includes('$HOME/.claude/plugins/data/counterbalance/profiles/default.md'),
    'agent body must reference the destination profile path',
  );
});

test('counterbalance.AC4.5: agent body has a decline-proceeds-normally branch', async () => {
  const agentPath = join(pluginRoot, 'agents', 'counterbalance.md');
  const content = await readFile(agentPath, 'utf-8');
  const body = extractBody(content);

  const hasDecline = body.includes('No, skip import') || body.includes('declines');
  const hasSampleGathering = body.toLowerCase().includes('sample');

  assert.ok(hasDecline, 'agent body must have a decline branch (e.g., "No, skip import")');
  assert.ok(hasSampleGathering, 'agent body must mention proceeding to sample gathering');
});

test('counterbalance.AC4.6: agent body says pre-flight is a silent no-op when CLAUDE.md has no voice guidance', async () => {
  const agentPath = join(pluginRoot, 'agents', 'counterbalance.md');
  const content = await readFile(agentPath, 'utf-8');
  const body = extractBody(content);

  assert.ok(
    body.includes('silent no-op'),
    'agent body must state that pre-flight is a "silent no-op" when no guidance is found',
  );
});

// === GHOST COMMAND TESTS ===

test('counterbalance.AC3.1: commands/ghost.md has description, allowed-tools, argument-hint', async () => {
  const ghostPath = join(pluginRoot, 'commands', 'ghost.md');
  const content = await readFile(ghostPath, 'utf-8');
  const fm = extractFrontmatter(content);

  assert.ok(fm.description && fm.description.length > 0, 'ghost command must have a non-empty description');
  assert.ok(fm['allowed-tools'] && fm['allowed-tools'].length > 0, 'ghost command must have allowed-tools');
  assert.ok(fm['argument-hint'] && fm['argument-hint'].length > 0, 'ghost command must have argument-hint');
});

test('counterbalance.AC3.1: commands/ghost.md allowed-tools includes Task', async () => {
  const ghostPath = join(pluginRoot, 'commands', 'ghost.md');
  const content = await readFile(ghostPath, 'utf-8');
  const fm = extractFrontmatter(content);

  assert.ok(fm['allowed-tools'].includes('Task'), 'ghost allowed-tools must include Task');
});

test('counterbalance.AC3.1: commands/ghost.md dispatches counterbalance subagent', async () => {
  const ghostPath = join(pluginRoot, 'commands', 'ghost.md');
  const content = await readFile(ghostPath, 'utf-8');
  const body = extractBody(content);

  const hasCounterbalance = body.includes('counterbalance subagent') || body.includes('`counterbalance` subagent');
  assert.ok(hasCounterbalance, 'ghost command body must mention dispatching the counterbalance subagent');
});

test('counterbalance.AC3.2: commands/ghost.md invokes lib/resolver.mjs', async () => {
  const ghostPath = join(pluginRoot, 'commands', 'ghost.md');
  const content = await readFile(ghostPath, 'utf-8');
  const body = extractBody(content);

  assert.ok(body.includes('lib/resolver.mjs'), 'ghost command must invoke lib/resolver.mjs');
});

test('counterbalance.AC3.2: commands/ghost.md passes resolved_profile to subagent', async () => {
  const ghostPath = join(pluginRoot, 'commands', 'ghost.md');
  const content = await readFile(ghostPath, 'utf-8');
  const body = extractBody(content);

  assert.ok(body.includes('resolved_profile'), 'ghost command must pass resolved_profile to the subagent');
});

// === VOICE-REFRESH COMMAND TESTS ===

test('counterbalance.AC3.3: commands/voice-refresh.md exists and has valid frontmatter', async () => {
  const voiceRefreshPath = join(pluginRoot, 'commands', 'voice-refresh.md');
  const content = await readFile(voiceRefreshPath, 'utf-8');
  const fm = extractFrontmatter(content);

  assert.ok(fm.description, 'voice-refresh command must have a description');
  assert.ok(fm['allowed-tools'], 'voice-refresh command must have allowed-tools');
});

test('counterbalance.AC3.3: commands/voice-refresh.md dispatches counterbalance subagent in Voice Discovery mode', async () => {
  const voiceRefreshPath = join(pluginRoot, 'commands', 'voice-refresh.md');
  const content = await readFile(voiceRefreshPath, 'utf-8');
  const body = extractBody(content);

  assert.ok(body.includes('counterbalance'), 'voice-refresh must mention dispatching counterbalance subagent');
  assert.ok(body.includes('Voice Discovery'), 'voice-refresh must mention Voice Discovery mode (case-sensitive)');
});
