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

  // Same heuristic as Phase 3 skill-structure test: `<-` must appear within
  // 500 chars of the word "correction" — catches a stray backtick elsewhere
  // that would otherwise satisfy the weaker "<- is present" check.
  assert.ok(body.includes('<-'), 'body must mention the "<-" operator');

  const arrowIdx = body.indexOf('<-');
  const windowStart = Math.max(0, arrowIdx - 250);
  const windowEnd = Math.min(body.length, arrowIdx + 250);
  const window = body.slice(windowStart, windowEnd).toLowerCase();
  assert.ok(
    window.includes('correction'),
    'the word "correction" must appear within 500 chars of the first "<-" occurrence (Phase 3 heuristic)',
  );
});

test('counterbalance.AC3.6: agent body describes the bounce-on-null behavior in Drafting mode', async () => {
  const agentPath = join(pluginRoot, 'agents', 'counterbalance.md');
  const content = await readFile(agentPath, 'utf-8');
  const body = extractBody(content);

  assert.ok(
    body.includes('/voice-refresh'),
    'agent body must direct users to /voice-refresh when Drafting receives a null profile',
  );
  assert.ok(
    !body.includes('fallback-voice.md'),
    'agent body must NOT reference fallback-voice.md — it was replaced by CLAUDE.md layer 4 + bounce',
  );
});

test('counterbalance.AC3.6: agent body describes the four-layer resolver cascade including CLAUDE.md', async () => {
  const agentPath = join(pluginRoot, 'agents', 'counterbalance.md');
  const content = await readFile(agentPath, 'utf-8');
  const body = extractBody(content);

  assert.ok(body.includes('.counterbalance.md'), 'body must mention local override layer');
  assert.ok(body.includes('.claude/counterbalance.md'), 'body must mention project layer');
  assert.ok(body.includes('plugins/data/counterbalance/profiles/default.md'), 'body must mention user layer');
  assert.ok(body.includes('CLAUDE.md'), 'body must mention CLAUDE.md as the last-ditch fallback');
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

test('drafter agent: body documents the correction-phase dispatch contract', async () => {
  const agentPath = join(pluginRoot, 'agents', 'counterbalance.md');
  const content = await readFile(agentPath, 'utf-8');
  const body = extractBody(content);

  assert.ok(body.includes('phase: "correction"') || body.includes("phase: 'correction'"),
    'agent body must document the phase: "correction" Task input field');
  assert.ok(body.includes('original_draft'), 'agent body must reference the original_draft input field');
  assert.ok(body.includes('corrections'), 'agent body must reference the corrections input field');
  assert.ok(body.toLowerCase().includes('voice guide proposal') || body.toLowerCase().includes('voice-guide proposal'),
    'agent body must describe the voice-guide proposals output section');
  assert.ok(body.toLowerCase().includes('never write to a file') || body.toLowerCase().includes('do not write to'),
    'agent body must forbid file writes in correction mode (command owns persistence)');
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

test('ghost command: bounces to /voice-refresh when resolver returns null', async () => {
  const ghostPath = join(pluginRoot, 'commands', 'ghost.md');
  const content = await readFile(ghostPath, 'utf-8');
  const body = extractBody(content);

  assert.ok(body.includes('/voice-refresh'), 'ghost must point users at /voice-refresh on null');
  assert.ok(
    body.toLowerCase().includes('do not dispatch') || body.toLowerCase().includes("don't dispatch"),
    'ghost must explicitly say not to dispatch the subagent when null',
  );
});

test('ghost command: no longer references fallback-voice.md', async () => {
  const ghostPath = join(pluginRoot, 'commands', 'ghost.md');
  const content = await readFile(ghostPath, 'utf-8');
  const body = extractBody(content);

  assert.ok(
    !body.includes('fallback-voice.md'),
    'ghost must NOT reference fallback-voice.md — the bounce replaced it',
  );
});

test('ghost command: describes the four-layer cascade including CLAUDE.md', async () => {
  const ghostPath = join(pluginRoot, 'commands', 'ghost.md');
  const content = await readFile(ghostPath, 'utf-8');
  const body = extractBody(content);

  assert.ok(body.includes('four layers'), 'ghost must describe the four-layer cascade');
  assert.ok(body.includes('CLAUDE.md'), 'ghost must mention CLAUDE.md as the last-ditch layer');
});

test('ghost command: allowed-tools includes Write (needed to persist the draft)', async () => {
  const ghostPath = join(pluginRoot, 'commands', 'ghost.md');
  const content = await readFile(ghostPath, 'utf-8');
  const fm = extractFrontmatter(content);

  assert.ok(fm['allowed-tools'].includes('Write'), 'ghost must declare Write tool to persist drafts');
});

test('ghost command: invokes lib/drafts-dir.mjs to resolve the drafts directory', async () => {
  const ghostPath = join(pluginRoot, 'commands', 'ghost.md');
  const content = await readFile(ghostPath, 'utf-8');
  const body = extractBody(content);

  assert.ok(body.includes('lib/drafts-dir.mjs'), 'ghost must invoke the drafts-dir resolver');
});

test('ghost command: describes draft filename convention for file-input case', async () => {
  const ghostPath = join(pluginRoot, 'commands', 'ghost.md');
  const content = await readFile(ghostPath, 'utf-8');
  const body = extractBody(content);

  assert.ok(body.includes('.draft.md'), 'ghost must describe the .draft.md filename convention');
});

test('ghost command: describes inline-text draft filename with timestamp', async () => {
  const ghostPath = join(pluginRoot, 'commands', 'ghost.md');
  const content = await readFile(ghostPath, 'utf-8');
  const body = extractBody(content);

  assert.ok(/draft-[^)]*iso/i.test(body) || body.toLowerCase().includes('compact-iso') || body.toLowerCase().includes('compact iso'),
    'ghost must describe timestamp-based filename for inline-text drafts');
});

test('ghost command: describes collision handling via numeric suffix', async () => {
  const ghostPath = join(pluginRoot, 'commands', 'ghost.md');
  const content = await readFile(ghostPath, 'utf-8');
  const body = extractBody(content);

  assert.ok(body.toLowerCase().includes('collision') || body.includes('.2.md'),
    'ghost must describe collision handling (numeric suffix)');
});

test('ghost command: writes a sidecar meta.json alongside the draft', async () => {
  const ghostPath = join(pluginRoot, 'commands', 'ghost.md');
  const content = await readFile(ghostPath, 'utf-8');
  const body = extractBody(content);

  assert.ok(body.includes('.meta.json'), 'ghost must write a sidecar .meta.json file');
  assert.ok(body.includes('voice_profile_source'), 'sidecar must record voice_profile_source');
  assert.ok(body.includes('created_at'), 'sidecar must record created_at timestamp');
  assert.ok(body.includes('input_path'), 'sidecar must record input_path (or null for inline)');
});

test('ghost command: tells the user where the draft was written and how to correct', async () => {
  const ghostPath = join(pluginRoot, 'commands', 'ghost.md');
  const content = await readFile(ghostPath, 'utf-8');
  const body = extractBody(content);

  assert.ok(body.includes('/ghost-correct'), 'ghost must point at /ghost-correct as the correction path');
  assert.ok(body.toLowerCase().includes('<-'), 'ghost must mention the <- marker as the correction mechanism');
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
