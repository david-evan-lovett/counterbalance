import { test } from 'node:test';
import assert from 'node:assert';
import { writeFile, mkdtemp, rm, mkdir, stat } from 'node:fs/promises';
import { join, basename } from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { resolveDraftsDir } from '../plugins/counterbalance/lib/drafts-dir.mjs';

// === resolveDraftsDir unit tests ===

test('resolveDraftsDir: --out= absolute path wins over everything', async () => {
  const tempDir = await mkdtemp(join(os.tmpdir(), 'drafts-dir-'));
  try {
    const outDir = join(tempDir, 'custom');
    const result = await resolveDraftsDir({ cwd: tempDir, outFlag: outDir });
    assert.strictEqual(result, outDir);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('resolveDraftsDir: --out= relative path is resolved against cwd', async () => {
  const tempDir = await mkdtemp(join(os.tmpdir(), 'drafts-dir-'));
  try {
    const result = await resolveDraftsDir({ cwd: tempDir, outFlag: 'my-drafts' });
    assert.strictEqual(result, join(tempDir, 'my-drafts'));
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('resolveDraftsDir: --out= overrides local drafts presence', async () => {
  const tempDir = await mkdtemp(join(os.tmpdir(), 'drafts-dir-'));
  try {
    const localDrafts = join(tempDir, 'drafts');
    await mkdir(localDrafts, { recursive: true });

    const outDir = join(tempDir, 'override');
    const result = await resolveDraftsDir({ cwd: tempDir, outFlag: outDir });
    assert.strictEqual(result, outDir, 'explicit --out must beat local drafts detection');
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('resolveDraftsDir: detects local drafts directory when it exists', async () => {
  const tempDir = await mkdtemp(join(os.tmpdir(), 'drafts-dir-'));
  try {
    const localDrafts = join(tempDir, 'drafts');
    await mkdir(localDrafts, { recursive: true });

    const result = await resolveDraftsDir({ cwd: tempDir });
    assert.strictEqual(result, localDrafts);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('resolveDraftsDir: local drafts wins over user-level when both could apply', async () => {
  const tempDir = await mkdtemp(join(os.tmpdir(), 'drafts-dir-'));
  const homeTemp = await mkdtemp(join(os.tmpdir(), 'drafts-dir-home-'));

  const origHome = process.env.HOME;
  const origUserprofile = process.env.USERPROFILE;

  try {
    const localDrafts = join(tempDir, 'drafts');
    await mkdir(localDrafts, { recursive: true });

    process.env.HOME = homeTemp;
    if (process.env.USERPROFILE) delete process.env.USERPROFILE;

    const result = await resolveDraftsDir({ cwd: tempDir });
    assert.strictEqual(result, localDrafts, 'local drafts should beat user-level default');
  } finally {
    if (origHome) process.env.HOME = origHome;
    else delete process.env.HOME;
    if (origUserprofile) process.env.USERPROFILE = origUserprofile;
    await rm(tempDir, { recursive: true, force: true });
    await rm(homeTemp, { recursive: true, force: true });
  }
});

test('resolveDraftsDir: falls through when a FILE named "drafts" exists (not a directory)', async () => {
  const tempDir = await mkdtemp(join(os.tmpdir(), 'drafts-dir-'));
  const homeTemp = await mkdtemp(join(os.tmpdir(), 'drafts-dir-home-'));

  const origHome = process.env.HOME;
  const origUserprofile = process.env.USERPROFILE;

  try {
    const localDraftsFile = join(tempDir, 'drafts');
    await writeFile(localDraftsFile, 'not a directory', 'utf-8');

    process.env.HOME = homeTemp;
    if (process.env.USERPROFILE) delete process.env.USERPROFILE;

    const result = await resolveDraftsDir({ cwd: tempDir });
    assert.notStrictEqual(result, localDraftsFile, 'a file named drafts must not be treated as the drafts dir');
    assert.ok(result.includes(basename(tempDir)), 'fallthrough should land in user-level with cwd basename');
  } finally {
    if (origHome) process.env.HOME = origHome;
    else delete process.env.HOME;
    if (origUserprofile) process.env.USERPROFILE = origUserprofile;
    await rm(tempDir, { recursive: true, force: true });
    await rm(homeTemp, { recursive: true, force: true });
  }
});

test('resolveDraftsDir: user-level default uses cwd basename and auto-creates the directory', async () => {
  const tempDir = await mkdtemp(join(os.tmpdir(), 'drafts-dir-'));
  const homeTemp = await mkdtemp(join(os.tmpdir(), 'drafts-dir-home-'));

  const origHome = process.env.HOME;
  const origUserprofile = process.env.USERPROFILE;

  try {
    process.env.HOME = homeTemp;
    if (process.env.USERPROFILE) delete process.env.USERPROFILE;

    const result = await resolveDraftsDir({ cwd: tempDir });
    const expected = join(
      homeTemp,
      '.claude',
      'plugins',
      'data',
      'counterbalance',
      'drafts',
      basename(tempDir),
    );
    assert.strictEqual(result, expected);

    const s = await stat(expected);
    assert.ok(s.isDirectory(), 'user-level drafts dir must be auto-created');
  } finally {
    if (origHome) process.env.HOME = origHome;
    else delete process.env.HOME;
    if (origUserprofile) process.env.USERPROFILE = origUserprofile;
    await rm(tempDir, { recursive: true, force: true });
    await rm(homeTemp, { recursive: true, force: true });
  }
});

test('resolveDraftsDir: empty outFlag is treated as no override', async () => {
  const tempDir = await mkdtemp(join(os.tmpdir(), 'drafts-dir-'));
  try {
    const localDrafts = join(tempDir, 'drafts');
    await mkdir(localDrafts, { recursive: true });

    const result = await resolveDraftsDir({ cwd: tempDir, outFlag: '' });
    assert.strictEqual(result, localDrafts, 'empty string should not override, local should win');
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

// === CLI tests ===

test('drafts-dir CLI: prints resolved user-level path and exits 0', async () => {
  const tempDir = await mkdtemp(join(os.tmpdir(), 'drafts-dir-'));
  const homeTemp = await mkdtemp(join(os.tmpdir(), 'drafts-dir-home-'));

  try {
    const result = execFileSync(
      'node',
      [join(process.cwd(), 'plugins/counterbalance/lib/drafts-dir.mjs'), `--cwd=${tempDir}`],
      {
        encoding: 'utf-8',
        env: { ...process.env, HOME: homeTemp, USERPROFILE: homeTemp },
      },
    );

    assert.ok(result.length > 0, 'CLI should print a non-empty path');
    assert.ok(result.includes(basename(tempDir)), 'CLI output should include cwd basename');
  } finally {
    await rm(tempDir, { recursive: true, force: true });
    await rm(homeTemp, { recursive: true, force: true });
  }
});

test('drafts-dir CLI: --out= absolute takes precedence over detection', async () => {
  const tempDir = await mkdtemp(join(os.tmpdir(), 'drafts-dir-'));
  try {
    const outDir = join(tempDir, 'explicit');
    const result = execFileSync(
      'node',
      [
        join(process.cwd(), 'plugins/counterbalance/lib/drafts-dir.mjs'),
        `--cwd=${tempDir}`,
        `--out=${outDir}`,
      ],
      { encoding: 'utf-8' },
    );

    assert.strictEqual(result, outDir);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('drafts-dir CLI: detects local drafts when cwd has one', async () => {
  const tempDir = await mkdtemp(join(os.tmpdir(), 'drafts-dir-'));
  try {
    const localDrafts = join(tempDir, 'drafts');
    await mkdir(localDrafts, { recursive: true });

    const result = execFileSync(
      'node',
      [join(process.cwd(), 'plugins/counterbalance/lib/drafts-dir.mjs'), `--cwd=${tempDir}`],
      { encoding: 'utf-8' },
    );

    assert.strictEqual(result, localDrafts);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
