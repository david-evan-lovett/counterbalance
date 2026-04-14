import { test } from 'node:test';
import assert from 'node:assert';
import { writeFile, mkdtemp, rm, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { platform } from 'node:process';
import { resolveVoice, VOICE_PATHS } from '../plugins/counterbalance/lib/resolver.mjs';

test('counterbalance.AC2.1: local override wins — returns source=local', async (t) => {
  const tempDir = await mkdtemp(join(os.tmpdir(), 'counterbalance-resolver-'));

  try {
    // Create only local override
    const localFile = join(tempDir, '.counterbalance.md');
    await writeFile(localFile, '---\nid: local-test\n---\nLocal voice content\n', 'utf-8');

    const profile = await resolveVoice(tempDir);

    assert.ok(profile, 'should return a profile');
    assert.strictEqual(profile.source, 'local', 'source should be "local"');
    assert.ok(profile.path.endsWith('.counterbalance.md'), 'path should end with .counterbalance.md');
    assert.strictEqual(profile.id, 'local-test', 'id should be from frontmatter');
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('counterbalance.AC2.2: project layer — returns source=project', async (t) => {
  const tempDir = await mkdtemp(join(os.tmpdir(), 'counterbalance-resolver-'));

  try {
    // Create only project layer
    const projectFile = join(tempDir, '.claude', 'counterbalance.md');
    await mkdir(dirname(projectFile), { recursive: true });
    await writeFile(projectFile, '---\nid: project-test\n---\nProject voice content\n', 'utf-8');

    const profile = await resolveVoice(tempDir);

    assert.ok(profile, 'should return a profile');
    assert.strictEqual(profile.source, 'project', 'source should be "project"');
    assert.ok(profile.path.includes('.claude'), 'path should include .claude');
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('counterbalance.AC2.3: user layer — returns source=user', async (t) => {
  const tempDir = await mkdtemp(join(os.tmpdir(), 'counterbalance-resolver-'));
  const homeTemp = await mkdtemp(join(os.tmpdir(), 'counterbalance-home-'));

  const origHome = process.env.HOME;
  const origUserprofile = process.env.USERPROFILE;

  try {
    // Set up home directory structure
    const userFile = join(homeTemp, '.claude', 'plugins', 'data', 'counterbalance', 'profiles', 'default.md');
    await mkdir(dirname(userFile), { recursive: true });
    await writeFile(userFile, '---\nid: user-test\n---\nUser voice content\n', 'utf-8');

    // Override HOME env var
    process.env.HOME = homeTemp;
    if (process.env.USERPROFILE) delete process.env.USERPROFILE;

    const profile = await resolveVoice(tempDir);

    assert.ok(profile, 'should return a profile');
    assert.strictEqual(profile.source, 'user', 'source should be "user"');
  } finally {
    // Restore env vars
    if (origHome) process.env.HOME = origHome;
    else delete process.env.HOME;
    if (origUserprofile) process.env.USERPROFILE = origUserprofile;

    await rm(tempDir, { recursive: true, force: true });
    await rm(homeTemp, { recursive: true, force: true });
  }
});

test('counterbalance.AC2.4: all three exist — local wins (first-match-wins)', async (t) => {
  const tempDir = await mkdtemp(join(os.tmpdir(), 'counterbalance-resolver-'));
  const homeTemp = await mkdtemp(join(os.tmpdir(), 'counterbalance-home-'));

  const origHome = process.env.HOME;
  const origUserprofile = process.env.USERPROFILE;

  try {
    // Create all three layers
    const localFile = join(tempDir, '.counterbalance.md');
    await writeFile(localFile, '---\nid: local\n---\nLocal\n', 'utf-8');

    const projectFile = join(tempDir, '.claude', 'counterbalance.md');
    await mkdir(dirname(projectFile), { recursive: true });
    await writeFile(projectFile, '---\nid: project\n---\nProject\n', 'utf-8');

    const userFile = join(homeTemp, '.claude', 'plugins', 'data', 'counterbalance', 'profiles', 'default.md');
    await mkdir(dirname(userFile), { recursive: true });
    await writeFile(userFile, '---\nid: user\n---\nUser\n', 'utf-8');

    process.env.HOME = homeTemp;
    if (process.env.USERPROFILE) delete process.env.USERPROFILE;

    const profile = await resolveVoice(tempDir);

    assert.ok(profile, 'should return a profile');
    assert.strictEqual(profile.source, 'local', 'local should win');
    assert.strictEqual(profile.id, 'local', 'id should be from local');
  } finally {
    if (origHome) process.env.HOME = origHome;
    else delete process.env.HOME;
    if (origUserprofile) process.env.USERPROFILE = origUserprofile;

    await rm(tempDir, { recursive: true, force: true });
    await rm(homeTemp, { recursive: true, force: true });
  }
});

test('counterbalance.AC2.4: project wins when local absent', async (t) => {
  const tempDir = await mkdtemp(join(os.tmpdir(), 'counterbalance-resolver-'));
  const homeTemp = await mkdtemp(join(os.tmpdir(), 'counterbalance-home-'));

  const origHome = process.env.HOME;
  const origUserprofile = process.env.USERPROFILE;

  try {
    // Create only project and user layers (no local)
    const projectFile = join(tempDir, '.claude', 'counterbalance.md');
    await mkdir(dirname(projectFile), { recursive: true });
    await writeFile(projectFile, '---\nid: project\n---\nProject\n', 'utf-8');

    const userFile = join(homeTemp, '.claude', 'plugins', 'data', 'counterbalance', 'profiles', 'default.md');
    await mkdir(dirname(userFile), { recursive: true });
    await writeFile(userFile, '---\nid: user\n---\nUser\n', 'utf-8');

    process.env.HOME = homeTemp;
    if (process.env.USERPROFILE) delete process.env.USERPROFILE;

    const profile = await resolveVoice(tempDir);

    assert.ok(profile, 'should return a profile');
    assert.strictEqual(profile.source, 'project', 'project should win when local absent');
    assert.strictEqual(profile.id, 'project', 'id should be from project');
  } finally {
    if (origHome) process.env.HOME = origHome;
    else delete process.env.HOME;
    if (origUserprofile) process.env.USERPROFILE = origUserprofile;

    await rm(tempDir, { recursive: true, force: true });
    await rm(homeTemp, { recursive: true, force: true });
  }
});

test('counterbalance.AC2.5: nothing exists — returns null', async (t) => {
  const tempDir = await mkdtemp(join(os.tmpdir(), 'counterbalance-resolver-'));
  const homeTemp = await mkdtemp(join(os.tmpdir(), 'counterbalance-home-'));

  const origHome = process.env.HOME;
  const origUserprofile = process.env.USERPROFILE;

  try {
    // Point HOME at a clean temp dir so layer 4 (CLAUDE.md) also misses
    process.env.HOME = homeTemp;
    if (process.env.USERPROFILE) delete process.env.USERPROFILE;

    const profile = await resolveVoice(tempDir);

    assert.strictEqual(profile, null, 'should return null when nothing exists at any layer');
  } finally {
    if (origHome) process.env.HOME = origHome;
    else delete process.env.HOME;
    if (origUserprofile) process.env.USERPROFILE = origUserprofile;

    await rm(tempDir, { recursive: true, force: true });
    await rm(homeTemp, { recursive: true, force: true });
  }
});

// === Layer 4: CLAUDE.md fallback ===

test('counterbalance.AC2.7: layer 4 fires when CLAUDE.md has a voice section and nothing else exists', async () => {
  const tempDir = await mkdtemp(join(os.tmpdir(), 'counterbalance-resolver-'));
  const homeTemp = await mkdtemp(join(os.tmpdir(), 'counterbalance-home-'));

  const origHome = process.env.HOME;
  const origUserprofile = process.env.USERPROFILE;

  try {
    const claudeMdPath = join(homeTemp, '.claude', 'CLAUDE.md');
    await mkdir(join(homeTemp, '.claude'), { recursive: true });
    await writeFile(
      claudeMdPath,
      '# Global CLAUDE.md\n\n## My Voice\n\nLead with the verb.\n',
      'utf-8',
    );

    process.env.HOME = homeTemp;
    if (process.env.USERPROFILE) delete process.env.USERPROFILE;

    const profile = await resolveVoice(tempDir);

    assert.ok(profile, 'should return a profile from CLAUDE.md');
    assert.strictEqual(profile.source, 'claude-md');
    assert.strictEqual(profile.id, 'claude-md-fallback');
    assert.ok(profile.body.includes('Lead with the verb.'));
    assert.strictEqual(profile.frontmatter.heading, 'My Voice');
  } finally {
    if (origHome) process.env.HOME = origHome;
    else delete process.env.HOME;
    if (origUserprofile) process.env.USERPROFILE = origUserprofile;

    await rm(tempDir, { recursive: true, force: true });
    await rm(homeTemp, { recursive: true, force: true });
  }
});

test('counterbalance.AC2.7: layer 4 does NOT fire when CLAUDE.md exists but has no voice section', async () => {
  const tempDir = await mkdtemp(join(os.tmpdir(), 'counterbalance-resolver-'));
  const homeTemp = await mkdtemp(join(os.tmpdir(), 'counterbalance-home-'));

  const origHome = process.env.HOME;
  const origUserprofile = process.env.USERPROFILE;

  try {
    const claudeMdPath = join(homeTemp, '.claude', 'CLAUDE.md');
    await mkdir(join(homeTemp, '.claude'), { recursive: true });
    await writeFile(claudeMdPath, '# Global CLAUDE.md\n\n## Projects\n\nNothing about voice.\n', 'utf-8');

    process.env.HOME = homeTemp;
    if (process.env.USERPROFILE) delete process.env.USERPROFILE;

    const profile = await resolveVoice(tempDir);

    assert.strictEqual(profile, null, 'should return null when CLAUDE.md has no voice section');
  } finally {
    if (origHome) process.env.HOME = origHome;
    else delete process.env.HOME;
    if (origUserprofile) process.env.USERPROFILE = origUserprofile;

    await rm(tempDir, { recursive: true, force: true });
    await rm(homeTemp, { recursive: true, force: true });
  }
});

test('counterbalance.AC2.7: layers 1-3 override layer 4 when both exist', async () => {
  const tempDir = await mkdtemp(join(os.tmpdir(), 'counterbalance-resolver-'));
  const homeTemp = await mkdtemp(join(os.tmpdir(), 'counterbalance-home-'));

  const origHome = process.env.HOME;
  const origUserprofile = process.env.USERPROFILE;

  try {
    // Set up a user-layer profile AND a CLAUDE.md voice section
    const userFile = join(homeTemp, '.claude', 'plugins', 'data', 'counterbalance', 'profiles', 'default.md');
    await mkdir(dirname(userFile), { recursive: true });
    await writeFile(userFile, '---\nid: real-profile\n---\nReal voice content\n', 'utf-8');

    const claudeMdPath = join(homeTemp, '.claude', 'CLAUDE.md');
    await writeFile(claudeMdPath, '## My Voice\n\nFallback voice content.\n', 'utf-8');

    process.env.HOME = homeTemp;
    if (process.env.USERPROFILE) delete process.env.USERPROFILE;

    const profile = await resolveVoice(tempDir);

    assert.ok(profile);
    assert.strictEqual(profile.source, 'user', 'user layer must override CLAUDE.md layer');
    assert.strictEqual(profile.id, 'real-profile');
  } finally {
    if (origHome) process.env.HOME = origHome;
    else delete process.env.HOME;
    if (origUserprofile) process.env.USERPROFILE = origUserprofile;

    await rm(tempDir, { recursive: true, force: true });
    await rm(homeTemp, { recursive: true, force: true });
  }
});

test('counterbalance.AC2.6: Windows-style backslash path in cwd resolves correctly', async (t) => {
  if (platform !== 'win32') {
    t.skip('Windows only');
    return;
  }

  const tempDir = await mkdtemp(join(os.tmpdir(), 'counterbalance-resolver-'));

  try {
    const localFile = join(tempDir, '.counterbalance.md');
    await writeFile(localFile, '---\nid: default\n---\nContent\n', 'utf-8');

    // Pass cwd with backslashes as would be returned by process.cwd() on Windows
    const profile = await resolveVoice(tempDir);

    assert.ok(profile, 'should resolve with Windows path');
    assert.ok(profile.path, 'path should be defined');
    // Path should be absolute and properly formatted
    assert.ok(profile.path.startsWith('C:') || profile.path.startsWith('D:'), 'path should be absolute');
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('resolver CLI: --cwd with no match prints "null" and exits 0', async (t) => {
  const tempDir = await mkdtemp(join(os.tmpdir(), 'counterbalance-resolver-'));
  const homeTemp = await mkdtemp(join(os.tmpdir(), 'counterbalance-home-'));

  try {
    // Point HOME at a clean temp dir so layer 4 (CLAUDE.md) also misses —
    // without this, the test inherits the real developer HOME and a voice
    // section in ~/.claude/CLAUDE.md would flip this expectation.
    const result = execFileSync('node', [
      join(process.cwd(), 'plugins/counterbalance/lib/resolver.mjs'),
      `--cwd=${tempDir}`,
      '--json'
    ], {
      encoding: 'utf-8',
      env: { ...process.env, HOME: homeTemp, USERPROFILE: homeTemp },
    });

    assert.strictEqual(result, 'null', 'should print "null"');
  } finally {
    await rm(tempDir, { recursive: true, force: true });
    await rm(homeTemp, { recursive: true, force: true });
  }
});

test('resolver CLI: --cwd with a match prints JSON containing "source":"local" and exits 0', async (t) => {
  const tempDir = await mkdtemp(join(os.tmpdir(), 'counterbalance-resolver-'));

  try {
    const localFile = join(tempDir, '.counterbalance.md');
    await writeFile(localFile, '---\nid: cli-test\n---\nCLI content\n', 'utf-8');

    const result = execFileSync('node', [
      join(process.cwd(), 'plugins/counterbalance/lib/resolver.mjs'),
      `--cwd=${tempDir}`,
      '--json'
    ], { encoding: 'utf-8' });

    const parsed = JSON.parse(result);
    assert.strictEqual(parsed.source, 'local', 'parsed JSON should have source=local');
    assert.strictEqual(parsed.id, 'cli-test', 'parsed JSON should have correct id');
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('resolver CLI: --cwd with unreadable HOME fails open (exit 0, prints null)', async (t) => {
  const tempDir = await mkdtemp(join(os.tmpdir(), 'counterbalance-resolver-'));

  try {
    // No profiles anywhere, no valid HOME
    const result = execFileSync('node', [
      join(process.cwd(), 'plugins/counterbalance/lib/resolver.mjs'),
      `--cwd=${tempDir}`,
      '--json'
    ], {
      encoding: 'utf-8',
      env: { ...process.env, HOME: '', USERPROFILE: '' }
    });

    assert.strictEqual(result, 'null', 'should print "null" and not throw');
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
