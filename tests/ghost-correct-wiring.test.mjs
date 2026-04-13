import { test } from 'node:test';
import assert from 'node:assert';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');
const repoRoot = join(__dirname, '..');
const commandPath = join(repoRoot, 'plugins', 'counterbalance', 'commands', 'ghost-correct.md');

function extractFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) throw new Error('No frontmatter found');
  return yaml.load(match[1]);
}

function extractBody(content) {
  const match = content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
  return match ? match[1] : content;
}

// === Frontmatter ===

test('ghost-correct command: has description, allowed-tools, argument-hint', async () => {
  const content = await readFile(commandPath, 'utf-8');
  const fm = extractFrontmatter(content);

  assert.ok(fm.description && fm.description.length > 0);
  assert.ok(fm['allowed-tools'] && fm['allowed-tools'].length > 0);
  assert.ok(fm['argument-hint'] && fm['argument-hint'].length > 0);
});

test('ghost-correct command: allowed-tools includes Task, Read, Write, Bash, AskUserQuestion', async () => {
  const content = await readFile(commandPath, 'utf-8');
  const fm = extractFrontmatter(content);

  for (const tool of ['Task', 'Read', 'Write', 'Bash', 'AskUserQuestion']) {
    assert.ok(fm['allowed-tools'].includes(tool), `allowed-tools must include ${tool}`);
  }
});

// === Body invariants ===

test('ghost-correct command: dispatches the counterbalance subagent', async () => {
  const content = await readFile(commandPath, 'utf-8');
  const body = extractBody(content);

  assert.ok(
    body.includes('counterbalance` subagent') || body.includes('counterbalance subagent'),
    'body must dispatch the counterbalance subagent',
  );
});

test('ghost-correct command: invokes lib/correction-parser.mjs', async () => {
  const content = await readFile(commandPath, 'utf-8');
  const body = extractBody(content);

  assert.ok(body.includes('lib/correction-parser.mjs'), 'body must shell out to the correction parser CLI');
});

test('ghost-correct command: invokes lib/resolver.mjs to re-resolve the voice profile', async () => {
  const content = await readFile(commandPath, 'utf-8');
  const body = extractBody(content);

  assert.ok(body.includes('lib/resolver.mjs'), 'body must re-resolve the voice profile before dispatching');
});

test('ghost-correct command: reads and requires the sidecar metadata', async () => {
  const content = await readFile(commandPath, 'utf-8');
  const body = extractBody(content);

  assert.ok(body.includes('.meta.json'), 'body must reference the sidecar .meta.json path');
  assert.ok(body.toLowerCase().includes('sidecar'), 'body must describe sidecar handling');
});

test('ghost-correct command: bounces when zero corrections are found', async () => {
  const content = await readFile(commandPath, 'utf-8');
  const body = extractBody(content);

  assert.ok(body.toLowerCase().includes('no `<-` markers') || body.toLowerCase().includes('no <- markers'),
    'body must describe the zero-markers bounce path');
});

test('ghost-correct command: confirms corrections via AskUserQuestion before dispatching', async () => {
  const content = await readFile(commandPath, 'utf-8');
  const body = extractBody(content);

  assert.ok(body.includes('AskUserQuestion'), 'body must use AskUserQuestion for confirmation');
  assert.ok(body.toLowerCase().includes('apply these'), 'body must phrase the confirmation as "Apply these ... corrections"');
});

test('ghost-correct command: bounces on null voice profile (same pattern as /ghost)', async () => {
  const content = await readFile(commandPath, 'utf-8');
  const body = extractBody(content);

  assert.ok(body.includes('/voice-refresh'), 'body must point at /voice-refresh on null profile');
  assert.ok(body.includes('null'), 'body must describe the null-profile path');
});

test('ghost-correct command: saves a .bak before overwriting the draft', async () => {
  const content = await readFile(commandPath, 'utf-8');
  const body = extractBody(content);

  assert.ok(body.includes('.bak.md'), 'body must describe the .bak.md backup filename');
  assert.ok(body.toLowerCase().includes('single-level undo'), 'body must explicitly state single-level undo');
});

test('ghost-correct command: documents that deeper history requires git', async () => {
  const content = await readFile(commandPath, 'utf-8');
  const body = extractBody(content);

  assert.ok(body.toLowerCase().includes('git'), 'body must mention git as the path to deeper history');
});

test('ghost-correct command: passes corrections and original_draft to the subagent', async () => {
  const content = await readFile(commandPath, 'utf-8');
  const body = extractBody(content);

  assert.ok(body.includes('corrections'), 'body must pass corrections field in Task dispatch');
  assert.ok(body.includes('original_draft'), 'body must pass original_draft field in Task dispatch');
  assert.ok(body.includes('resolved_profile'), 'body must pass resolved_profile field in Task dispatch');
});

test('ghost-correct command: flags phase=correction in the dispatch', async () => {
  const content = await readFile(commandPath, 'utf-8');
  const body = extractBody(content);

  assert.ok(body.includes('"correction"') || body.includes('correction'),
    'body must set phase=correction on the Task dispatch for subagent disambiguation');
});

test('ghost-correct command: writes corrected draft back to the original path', async () => {
  const content = await readFile(commandPath, 'utf-8');
  const body = extractBody(content);

  assert.ok(body.toLowerCase().includes('overwrit') || body.toLowerCase().includes('write the subagent'),
    'body must describe writing the corrected output back to the draft path');
});

test('ghost-correct command: reports the draft path and backup path in the final output', async () => {
  const content = await readFile(commandPath, 'utf-8');
  const body = extractBody(content);

  assert.ok(body.toLowerCase().includes('corrected draft written'),
    'body must print a "Corrected draft written" footer');
});
