import { test } from 'node:test';
import assert from 'node:assert';
import { writeFile, mkdtemp, rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import os from 'node:os';
import {
  extractVoiceSection,
  parseClaudeMdVoice,
} from '../plugins/counterbalance/lib/claude-md-parser.mjs';

// === extractVoiceSection unit tests ===

test('extractVoiceSection: matches a level-2 heading containing "Voice"', () => {
  const content = [
    '# Some CLAUDE.md',
    '',
    '## My Voice',
    '',
    'Body paragraph.',
    '',
    '## Other Section',
    '',
    'Other body.',
  ].join('\n');

  const result = extractVoiceSection(content);
  assert.ok(result, 'should find a voice section');
  assert.strictEqual(result.level, 2);
  assert.strictEqual(result.heading, 'My Voice');
  assert.ok(result.body.includes('Body paragraph.'));
  assert.ok(!result.body.includes('Other body.'), 'should stop at the next ## heading');
});

test('extractVoiceSection: matches on any of voice|writing|tone|style|register|sentence', () => {
  for (const keyword of ['Writing', 'Tone', 'Style Guide', 'Register', 'Sentence Rules']) {
    const content = `## ${keyword}\n\nSome content.\n`;
    const result = extractVoiceSection(content);
    assert.ok(result, `should match "${keyword}"`);
    assert.strictEqual(result.heading, keyword);
  }
});

test('extractVoiceSection: captures nested subheadings under the matched section', () => {
  const content = [
    '## My Voice',
    '',
    'Intro paragraph.',
    '',
    '### Subsection A',
    '',
    'A body.',
    '',
    '### Subsection B',
    '',
    'B body.',
    '',
    '## Unrelated',
    '',
    'Unrelated body.',
  ].join('\n');

  const result = extractVoiceSection(content);
  assert.ok(result);
  assert.ok(result.body.includes('### Subsection A'));
  assert.ok(result.body.includes('B body.'));
  assert.ok(!result.body.includes('Unrelated body.'));
});

test('extractVoiceSection: terminates at a heading of EQUAL level, not just higher', () => {
  const content = [
    '## Voice',
    'First.',
    '## Not Voice',
    'Second.',
  ].join('\n');

  const result = extractVoiceSection(content);
  assert.ok(result);
  assert.ok(result.body.includes('First.'));
  assert.ok(!result.body.includes('Second.'));
});

test('extractVoiceSection: terminates at a HIGHER level (# vs ##)', () => {
  const content = [
    '## Voice',
    'Voice body.',
    '# Top Level',
    'Top body.',
  ].join('\n');

  const result = extractVoiceSection(content);
  assert.ok(result);
  assert.ok(result.body.includes('Voice body.'));
  assert.ok(!result.body.includes('Top body.'));
});

test('extractVoiceSection: returns null when no matching heading exists', () => {
  const content = '# Random\n\nBody.\n\n## Other\n\nOther body.\n';
  assert.strictEqual(extractVoiceSection(content), null);
});

test('extractVoiceSection: returns null on empty or non-string input', () => {
  assert.strictEqual(extractVoiceSection(''), null);
  assert.strictEqual(extractVoiceSection(null), null);
  assert.strictEqual(extractVoiceSection(undefined), null);
});

test('extractVoiceSection: case-insensitive heading match', () => {
  const content = '## my VOICE guide\n\nBody.\n';
  const result = extractVoiceSection(content);
  assert.ok(result);
  assert.strictEqual(result.heading, 'my VOICE guide');
});

test('extractVoiceSection: picks the FIRST matching heading, even if multiple exist', () => {
  const content = [
    '## Voice One',
    'First.',
    '## Voice Two',
    'Second.',
  ].join('\n');

  const result = extractVoiceSection(content);
  assert.ok(result);
  assert.strictEqual(result.heading, 'Voice One');
  assert.ok(result.body.includes('First.'));
  assert.ok(!result.body.includes('Second.'));
});

// === parseClaudeMdVoice integration tests ===

test('parseClaudeMdVoice: returns a profile shape when voice section found', async () => {
  const tempDir = await mkdtemp(join(os.tmpdir(), 'claude-md-parser-'));
  try {
    const filePath = join(tempDir, 'CLAUDE.md');
    await writeFile(filePath, '# CLAUDE.md\n\n## My Voice\n\nVoice body content.\n', 'utf-8');

    const profile = await parseClaudeMdVoice(filePath, 'claude-md');
    assert.ok(profile);
    assert.strictEqual(profile.id, 'claude-md-fallback');
    assert.strictEqual(profile.path, filePath);
    assert.strictEqual(profile.source, 'claude-md');
    assert.strictEqual(profile.frontmatter.heading, 'My Voice');
    assert.strictEqual(profile.frontmatter.level, 2);
    assert.ok(profile.body.includes('## My Voice'));
    assert.ok(profile.body.includes('Voice body content.'));
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('parseClaudeMdVoice: returns null when file does not exist (ENOENT is silent)', async () => {
  const tempDir = await mkdtemp(join(os.tmpdir(), 'claude-md-parser-'));
  try {
    const filePath = join(tempDir, 'NOPE.md');
    const profile = await parseClaudeMdVoice(filePath, 'claude-md');
    assert.strictEqual(profile, null);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('parseClaudeMdVoice: returns null when file exists but has no voice section', async () => {
  const tempDir = await mkdtemp(join(os.tmpdir(), 'claude-md-parser-'));
  try {
    const filePath = join(tempDir, 'CLAUDE.md');
    await writeFile(filePath, '# CLAUDE.md\n\n## Projects\n\nOther stuff.\n', 'utf-8');

    const profile = await parseClaudeMdVoice(filePath, 'claude-md');
    assert.strictEqual(profile, null);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('parseClaudeMdVoice: propagates the source argument to the returned profile', async () => {
  const tempDir = await mkdtemp(join(os.tmpdir(), 'claude-md-parser-'));
  try {
    const filePath = join(tempDir, 'CLAUDE.md');
    await writeFile(filePath, '## Voice\n\nBody.\n', 'utf-8');

    const profile = await parseClaudeMdVoice(filePath, 'custom-source');
    assert.ok(profile);
    assert.strictEqual(profile.source, 'custom-source');
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
