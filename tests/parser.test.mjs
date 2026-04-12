import { test } from 'node:test';
import assert from 'node:assert';
import { writeFile, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import os from 'node:os';
import { parseVoiceProfile } from '../plugins/counterbalance/lib/parser.mjs';

let tempDir;

test('counterbalance.AC2.7: malformed YAML returns null and warns', async (t) => {
  tempDir = await mkdtemp(join(os.tmpdir(), 'counterbalance-parser-'));

  try {
    const testFile = join(tempDir, 'bad.md');
    // Invalid YAML: unclosed bracket
    await writeFile(testFile, '---\nid: [unclosed\n---\nbody\n', 'utf-8');

    // Capture console.warn calls
    let warned = false;
    let warnMessage = '';
    const originalWarn = console.warn;
    console.warn = (msg) => {
      warned = true;
      warnMessage = msg;
    };

    try {
      const result = await parseVoiceProfile(testFile, 'local');
      assert.strictEqual(result, null, 'malformed YAML should return null');
      assert.ok(warned, 'should have called console.warn');
      assert.ok(warnMessage.startsWith('[counterbalance] Skipping voice profile (bad YAML):'), 'warning should have correct prefix');
    } finally {
      console.warn = originalWarn;
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('parseVoiceProfile: valid frontmatter returns flat VoiceProfile shape', async (t) => {
  tempDir = await mkdtemp(join(os.tmpdir(), 'counterbalance-parser-'));

  try {
    const testFile = join(tempDir, 'default.md');
    await writeFile(testFile, '---\nid: default\ntitle: Test\n---\nbody text\n', 'utf-8');

    const result = await parseVoiceProfile(testFile, 'local');

    assert.strictEqual(result.id, 'default', 'id should be "default"');
    assert.strictEqual(result.frontmatter.title, 'Test', 'frontmatter.title should be "Test"');
    assert.strictEqual(result.body, 'body text\n', 'body should be "body text\\n"');
    assert.strictEqual(result.source, 'local', 'source should be "local"');
    assert.strictEqual(result.path, testFile, 'path should be the absolute file path');
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('parseVoiceProfile: no frontmatter treated as pure markdown body', async (t) => {
  tempDir = await mkdtemp(join(os.tmpdir(), 'counterbalance-parser-'));

  try {
    const testFile = join(tempDir, 'custom.md');
    const content = 'Just plain markdown\nwith no frontmatter\n';
    await writeFile(testFile, content, 'utf-8');

    const result = await parseVoiceProfile(testFile, 'project');

    assert.ok(result, 'should return a valid profile');
    assert.deepStrictEqual(result.frontmatter, {}, 'frontmatter should be empty object');
    assert.strictEqual(result.body, content, 'body should be the entire file content');
    assert.strictEqual(result.id, 'custom', 'id should be derived from filename');
    assert.strictEqual(result.source, 'project', 'source should be "project"');
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('parseVoiceProfile: frontmatter null (empty YAML block) returns null', async (t) => {
  tempDir = await mkdtemp(join(os.tmpdir(), 'counterbalance-parser-'));

  try {
    const testFile = join(tempDir, 'empty.md');
    // Empty YAML section parses to undefined, which should be treated as not a mapping
    await writeFile(testFile, '---\n\n---\nbody\n', 'utf-8');

    let warned = false;
    const originalWarn = console.warn;
    console.warn = (msg) => {
      warned = true;
    };

    try {
      const result = await parseVoiceProfile(testFile, 'user');
      assert.strictEqual(result, null, 'empty/null frontmatter should return null');
      assert.ok(warned, 'should have warned');
    } finally {
      console.warn = originalWarn;
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
