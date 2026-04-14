import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { loadRegistry, applicableReviewers } from '../plugins/counterbalance/lib/reviewers.mjs';
import path from 'node:path';
import { tmpdir } from 'node:os';

const registryFixture = {
    reviewers: [
        {
            id: 'voice-check',
            agent: 'counterbalance:voice-reviewer',
            command: '/counterbalance:voice-check',
            applies_to: ['**/*.md', '**/*.mdx'],
            description: 'Checks a draft against the active voice profile and flags violations as line-referenced findings.'
        }
    ]
};

test('counterbalance.AC6.2: applicableReviewers matches voice-check on .md files', () => {
    const result = applicableReviewers(registryFixture, 'docs/foo.md');
    assert.equal(result.length, 1);
    assert.equal(result[0].id, 'voice-check');
});

test('counterbalance.AC6.2: applicableReviewers matches voice-check on .mdx files', () => {
    const result = applicableReviewers(registryFixture, 'docs/foo.mdx');
    assert.equal(result.length, 1);
    assert.equal(result[0].id, 'voice-check');
});

test('counterbalance.AC6.2: applicableReviewers returns empty on non-matching extension', () => {
    const result = applicableReviewers(registryFixture, 'src/foo.ts');
    assert.equal(result.length, 0);
});

test('counterbalance.AC6.2: applicableReviewers normalizes Windows backslash paths', () => {
    const result = applicableReviewers(registryFixture, 'docs\\foo.md');
    assert.equal(result.length, 1);
    assert.equal(result[0].id, 'voice-check');
});

test('loadRegistry parses the shipped reviewers.json successfully', async () => {
    const pluginRoot = path.resolve('./plugins/counterbalance');
    const registry = await loadRegistry(pluginRoot);
    assert.ok(Array.isArray(registry.reviewers));
    assert.equal(registry.reviewers[0].id, 'voice-check');
});

test('loadRegistry throws a clear error on missing registry file', async () => {
    try {
        await loadRegistry('/nonexistent/path');
        assert.fail('should have thrown');
    } catch (err) {
        assert.ok(err.message.includes('[counterbalance]'));
        assert.ok(err.message.includes('unreadable'));
    }
});

test('loadRegistry throws a clear error on malformed JSON', async () => {
    const { writeFile, rm } = await import('node:fs/promises');
    const { mkdtemp } = await import('node:fs');
    const { promisify } = await import('node:util');
    const mkdtempAsync = promisify(mkdtemp);

    const tmpDir = await mkdtempAsync(path.join(tmpdir(), 'cbal-test-'));
    try {
        await writeFile(path.join(tmpDir, 'reviewers.json'), '{not valid json}');
        await loadRegistry(tmpDir);
        assert.fail('should have thrown');
    } catch (err) {
        assert.ok(err.message.includes('[counterbalance]'));
        assert.ok(err.message.includes('malformed JSON'));
    } finally {
        await rm(tmpDir, { recursive: true, force: true });
    }
});

test('loadRegistry throws a clear error when the reviewers array is missing', async () => {
    const { writeFile, rm } = await import('node:fs/promises');
    const { mkdtemp } = await import('node:fs');
    const { promisify } = await import('node:util');
    const mkdtempAsync = promisify(mkdtemp);

    const tmpDir = await mkdtempAsync(path.join(tmpdir(), 'cbal-test-'));
    try {
        await writeFile(path.join(tmpDir, 'reviewers.json'), JSON.stringify({}));
        await loadRegistry(tmpDir);
        assert.fail('should have thrown');
    } catch (err) {
        assert.ok(err.message.includes('[counterbalance]'));
        assert.ok(err.message.includes('missing'));
        assert.ok(err.message.includes('reviewers'));
    } finally {
        await rm(tmpDir, { recursive: true, force: true });
    }
});
