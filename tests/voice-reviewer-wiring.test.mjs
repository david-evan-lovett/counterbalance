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

// Helper to extract the JSON block from a markdown section
function extractJsonBlock(content) {
  const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
  if (!jsonMatch) {
    throw new Error('No JSON block found');
  }
  return jsonMatch[1];
}

// === VOICE-REVIEWER AGENT TESTS ===

test('counterbalance.AC5.2: voice-reviewer tools field is exactly "Read, Grep, Glob"', async () => {
  const agentPath = join(pluginRoot, 'agents', 'voice-reviewer.md');
  const content = await readFile(agentPath, 'utf-8');
  const fm = extractFrontmatter(content);

  const expectedTools = 'Read, Grep, Glob';
  assert.strictEqual(fm.tools, expectedTools, `tools field must be exactly "${expectedTools}"`);
});

test('counterbalance.AC5.2: voice-reviewer does NOT declare Write, Edit, or Bash in tools', async () => {
  const agentPath = join(pluginRoot, 'agents', 'voice-reviewer.md');
  const content = await readFile(agentPath, 'utf-8');
  const fm = extractFrontmatter(content);
  const toolsField = fm.tools;

  assert.ok(!toolsField.includes('Write'), 'tools field must NOT contain "Write"');
  assert.ok(!toolsField.includes('Edit'), 'tools field must NOT contain "Edit"');
  assert.ok(!toolsField.includes('Bash'), 'tools field must NOT contain "Bash"');
});

test('counterbalance.AC5.3: voice-reviewer body documents the output contract field names in JSON block', async () => {
  const agentPath = join(pluginRoot, 'agents', 'voice-reviewer.md');
  const content = await readFile(agentPath, 'utf-8');
  const body = extractBody(content);

  // Extract the JSON block from the Output contract section
  const jsonBlock = extractJsonBlock(body);

  // Check that each field name appears in the JSON block
  const requiredFields = ['reviewer', 'findings', 'line', 'severity', 'rule', 'quote', 'message', 'suggested'];
  for (const field of requiredFields) {
    assert.ok(
      jsonBlock.includes(`"${field}"`),
      `JSON block must contain the field name "${field}"`
    );
  }
});

test('counterbalance.AC5.4: voice-reviewer body documents the rendered markdown output format', async () => {
  const agentPath = join(pluginRoot, 'agents', 'voice-reviewer.md');
  const content = await readFile(agentPath, 'utf-8');
  const body = extractBody(content);

  assert.ok(
    body.includes('### Voice check findings'),
    'body must contain literal "### Voice check findings"'
  );
});

test('counterbalance.AC5.5: voice-reviewer body handles empty draft as empty findings, not error', async () => {
  const agentPath = join(pluginRoot, 'agents', 'voice-reviewer.md');
  const content = await readFile(agentPath, 'utf-8');
  const body = extractBody(content);

  // Case-insensitive search for "empty draft" or nearby "empty findings" / "zero violations"
  const lowerBody = body.toLowerCase();
  const hasEmptyDraft = lowerBody.includes('empty draft');
  const hasEmptyFindings = lowerBody.includes('empty findings');
  const hasZeroViolations = lowerBody.includes('zero violations');

  assert.ok(
    hasEmptyDraft && (hasEmptyFindings || hasZeroViolations),
    'body must mention "empty draft" near "empty findings" or "zero violations"'
  );
});

// === VOICE-CHECK COMMAND TESTS ===

test('counterbalance.AC5.1: commands/voice-check.md exists with description, allowed-tools, argument-hint', async () => {
  const cmdPath = join(pluginRoot, 'commands', 'voice-check.md');
  const content = await readFile(cmdPath, 'utf-8');
  const fm = extractFrontmatter(content);

  assert.ok(fm.description && fm.description.length > 0, 'voice-check command must have a non-empty description');
  assert.ok(fm['allowed-tools'] && fm['allowed-tools'].length > 0, 'voice-check command must have allowed-tools');
  assert.ok(fm['argument-hint'] && fm['argument-hint'].length > 0, 'voice-check command must have argument-hint');
});

test('counterbalance.AC5.1: commands/voice-check.md allowed-tools includes Task', async () => {
  const cmdPath = join(pluginRoot, 'commands', 'voice-check.md');
  const content = await readFile(cmdPath, 'utf-8');
  const fm = extractFrontmatter(content);

  assert.ok(fm['allowed-tools'].includes('Task'), 'voice-check allowed-tools must include Task');
});

test('counterbalance.AC5.1: commands/voice-check.md dispatches voice-reviewer subagent', async () => {
  const cmdPath = join(pluginRoot, 'commands', 'voice-check.md');
  const content = await readFile(cmdPath, 'utf-8');
  const body = extractBody(content);

  assert.ok(
    body.includes('voice-reviewer'),
    'voice-check command body must contain literal "voice-reviewer"'
  );
});
