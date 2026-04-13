import { test } from 'node:test';
import assert from 'node:assert';
import { writeFile, mkdtemp, rm, mkdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { resolveDraftsDir } from '../plugins/counterbalance/lib/drafts-dir.mjs';

// === resolveDraftsDir unit tests ===

test('resolveDraftsDir: --out= absolute path wins and is returned as-is', async () => {
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

test('resolveDraftsDir: --out= overrides the default ./drafts/ creation', async () => {
  const tempDir = await mkdtemp(join(os.tmpdir(), 'drafts-dir-'));
  try {
    const outDir = join(tempDir, 'override');
    const result = await resolveDraftsDir({ cwd: tempDir, outFlag: outDir });
    assert.strictEqual(result, outDir, 'explicit --out must beat the default');

    // The default ./drafts/ should NOT have been auto-created when --out= is passed
    const defaultPath = join(tempDir, 'drafts');
    let created = false;
    try {
      await stat(defaultPath);
      created = true;
    } catch {
      // expected — not created
    }
    assert.strictEqual(created, false, '--out= must not trigger default dir creation');
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('resolveDraftsDir: creates ./drafts/ in cwd when it is missing and returns that path', async () => {
  const tempDir = await mkdtemp(join(os.tmpdir(), 'drafts-dir-'));
  try {
    const result = await resolveDraftsDir({ cwd: tempDir });
    const expected = join(tempDir, 'drafts');
    assert.strictEqual(result, expected);

    const s = await stat(expected);
    assert.ok(s.isDirectory(), './drafts/ must be auto-created on first use');
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('resolveDraftsDir: returns existing ./drafts/ without error when the directory already exists', async () => {
  const tempDir = await mkdtemp(join(os.tmpdir(), 'drafts-dir-'));
  try {
    const localDrafts = join(tempDir, 'drafts');
    await mkdir(localDrafts, { recursive: true });

    // Pre-existing file inside the dir must survive the resolve call (mkdir recursive is a no-op)
    const existingFile = join(localDrafts, 'pre-existing.md');
    await writeFile(existingFile, 'do not delete me', 'utf-8');

    const result = await resolveDraftsDir({ cwd: tempDir });
    assert.strictEqual(result, localDrafts);

    const s = await stat(existingFile);
    assert.ok(s.isFile(), 'pre-existing files inside ./drafts/ must not be touched');
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('resolveDraftsDir: throws when a FILE named "drafts" exists in cwd', async () => {
  const tempDir = await mkdtemp(join(os.tmpdir(), 'drafts-dir-'));
  try {
    const localDraftsFile = join(tempDir, 'drafts');
    await writeFile(localDraftsFile, 'not a directory', 'utf-8');

    await assert.rejects(
      async () => resolveDraftsDir({ cwd: tempDir }),
      (err) => {
        assert.ok(err, 'must throw on file collision');
        // EEXIST or ENOTDIR depending on platform — both are acceptable signals
        assert.ok(
          err.code === 'EEXIST' || err.code === 'ENOTDIR',
          `expected EEXIST or ENOTDIR, got ${err.code}`,
        );
        return true;
      },
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('resolveDraftsDir: empty outFlag is treated as no override and falls through to ./drafts/', async () => {
  const tempDir = await mkdtemp(join(os.tmpdir(), 'drafts-dir-'));
  try {
    const result = await resolveDraftsDir({ cwd: tempDir, outFlag: '' });
    assert.strictEqual(result, join(tempDir, 'drafts'));
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

// === CLI tests ===

test('drafts-dir CLI: prints the resolved ./drafts/ path and exits 0', async () => {
  const tempDir = await mkdtemp(join(os.tmpdir(), 'drafts-dir-'));
  try {
    const result = execFileSync(
      'node',
      [join(process.cwd(), 'plugins/counterbalance/lib/drafts-dir.mjs'), `--cwd=${tempDir}`],
      { encoding: 'utf-8' },
    );

    assert.strictEqual(result, join(tempDir, 'drafts'));

    // Verify the directory was actually created on disk by the CLI call
    const s = await stat(join(tempDir, 'drafts'));
    assert.ok(s.isDirectory());
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('drafts-dir CLI: --out= absolute takes precedence and is printed verbatim', async () => {
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

test('drafts-dir CLI: exits 1 when cwd contains a file named drafts (not a directory)', async () => {
  const tempDir = await mkdtemp(join(os.tmpdir(), 'drafts-dir-'));
  try {
    await writeFile(join(tempDir, 'drafts'), 'not a directory', 'utf-8');

    let threw = false;
    try {
      execFileSync(
        'node',
        [join(process.cwd(), 'plugins/counterbalance/lib/drafts-dir.mjs'), `--cwd=${tempDir}`],
        { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] },
      );
    } catch (err) {
      threw = true;
      assert.strictEqual(err.status, 1);
    }
    assert.ok(threw, 'CLI must exit non-zero when drafts is a file');
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
