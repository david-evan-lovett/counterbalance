import { test } from 'node:test';
import assert from 'node:assert';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const skillPath = path.resolve(repoRoot, 'plugins/counterbalance/skills/counterbalance/SKILL.md');

// Read skill file and extract frontmatter
const skillContent = await readFile(skillPath, 'utf-8');
const frontmatterMatch = skillContent.match(/^---\r?\n([\s\S]*?)\r?\n---/);
let frontmatter = {};
let body = skillContent;

if (frontmatterMatch) {
  try {
    const parsed = yaml.load(frontmatterMatch[1]);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      frontmatter = parsed;
      body = skillContent.slice(frontmatterMatch[0].length).trimStart();
    }
  } catch (err) {
    // Parsing error — will fail the test
  }
}

test('counterbalance.AC1.1: SKILL.md has valid YAML frontmatter with required fields', () => {
  assert.ok(frontmatterMatch, 'frontmatter block should exist');
  assert.strictEqual(frontmatter.name, 'counterbalance', 'name should be "counterbalance"');
  assert.ok(typeof frontmatter.description === 'string' && frontmatter.description.length > 0, 'description should be a non-empty string');
  assert.strictEqual(frontmatter['user-invocable'], false, 'user-invocable should be false');
});

test('counterbalance.AC1.2: SKILL.md body contains Voice Discovery section', () => {
  assert.ok(body.includes('Voice Discovery'), 'body should contain literal string "Voice Discovery"');
});

test('counterbalance.AC1.2: SKILL.md body contains Drafting Loop section', () => {
  assert.ok(body.includes('Drafting Loop'), 'body should contain literal string "Drafting Loop"');
});

test('counterbalance.AC1.2: SKILL.md body contains <- correction operator instructions', () => {
  const correctionIndex = body.indexOf('<-');
  assert.ok(correctionIndex !== -1, 'body should contain "<-"');

  // Check if "correction" or "Correction" appears within 1000 characters of the "<-" operator
  const slice = body.substring(Math.max(0, correctionIndex - 500), Math.min(body.length, correctionIndex + 500));
  assert.ok(slice.toLowerCase().includes('correction'), 'body should contain "correction" within 1000 characters of "<-"');
});

test('counterbalance.AC1.3: SKILL.md describes the four-layer fallback ladder', () => {
  assert.ok(body.includes('.counterbalance.md'),       'body should reference the local override layer');
  assert.ok(body.includes('.claude/counterbalance.md'), 'body should reference the project layer');
  assert.ok(body.includes('plugins/data/counterbalance/profiles/default.md'), 'body should reference the user layer');
  assert.ok(body.includes('CLAUDE.md'),                'body should reference CLAUDE.md as the last-ditch layer');
});

test('counterbalance.AC1.3: SKILL.md bounces rather than silently falling back when all layers miss', () => {
  const bodyLower = body.toLowerCase();
  assert.ok(bodyLower.includes('/voice-refresh'),
    'body should direct users to /voice-refresh when resolution fails');
  assert.ok(bodyLower.includes('bounce') || bodyLower.includes('never operate with no voice'),
    'body should state the bounce-on-null behavior');
});

test('counterbalance.AC1.3: SKILL.md no longer references fallback-voice.md as a silent fallback', () => {
  assert.ok(!body.includes('references/fallback-voice.md'),
    'body should NOT reference fallback-voice.md — the four-layer ladder + bounce replaced it');
});
