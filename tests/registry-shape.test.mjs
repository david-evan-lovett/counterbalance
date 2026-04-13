import { test } from 'node:test';
import assert from 'node:assert';
import { writeFile, mkdtemp, rm, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import { loadRegistry, expandPreset, partitionByType } from '../plugins/counterbalance/lib/reviewers.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pluginRoot = join(__dirname, '..', 'plugins', 'counterbalance');

test('prose-review-suite.AC2.1: every reviewer has a type field of "agent" or "lib"', async (t) => {
    const registry = await loadRegistry(pluginRoot);
    for (const reviewer of registry.reviewers) {
        assert.ok(
            reviewer.type === 'agent' || reviewer.type === 'lib',
            `reviewer "${reviewer.id}" must have type "agent" or "lib", got: ${reviewer.type}`
        );
    }
});

test('prose-review-suite.AC2.1: voice-check is type agent', async (t) => {
    const registry = await loadRegistry(pluginRoot);
    const voiceCheck = registry.reviewers.find(r => r.id === 'voice-check');
    assert.ok(voiceCheck, 'voice-check entry must exist');
    assert.strictEqual(voiceCheck.type, 'agent', 'voice-check must have type "agent"');
});

test('prose-review-suite.AC2.2: presets is an object (may be empty until Phase 6)', async (t) => {
    const registry = await loadRegistry(pluginRoot);
    assert.ok(
        typeof registry.presets === 'object' && !Array.isArray(registry.presets) && registry.presets !== null,
        'presets must be an object (not array, not null)'
    );
});

test('prose-review-suite.AC2.2: four named presets exist with valid reviewer ids', async () => {
    const registry = await loadRegistry(pluginRoot);
    const names = ['quick', 'voice', 'mechanical', 'full'];
    for (const name of names) {
        assert.ok(name in registry.presets, `preset "${name}" must exist`);
        assert.ok(Array.isArray(registry.presets[name]), `preset "${name}" must be an array`);
    }
    const ids = new Set(registry.reviewers.map(r => r.id));
    for (const name of names) {
        for (const id of registry.presets[name]) {
            if (id === '*') continue;
            assert.ok(ids.has(id), `preset "${name}" references unknown reviewer id: ${id}`);
        }
    }
    // full preset uses the wildcard
    assert.deepStrictEqual(registry.presets.full, ['*']);
});

test('loadRegistry rejects a registry with non-object presets', async (t) => {
    const tempDir = await mkdtemp(join(os.tmpdir(), 'cbal-test-'));

    try {
        const pluginDir = join(tempDir, 'plugins', 'counterbalance');
        await mkdir(pluginDir, { recursive: true });

        // Write a malformed registry with non-object presets
        const registryPath = join(pluginDir, 'reviewers.json');
        await writeFile(
            registryPath,
            JSON.stringify({
                presets: 'not an object',
                reviewers: []
            }),
            'utf8'
        );

        try {
            await loadRegistry(pluginDir);
            assert.fail('loadRegistry should have thrown');
        } catch (err) {
            assert.ok(
                err.message.includes('presets'),
                `error should mention "presets", got: ${err.message}`
            );
        }
    } finally {
        await rm(tempDir, { recursive: true, force: true });
    }
});

test('expandPreset returns entries for a valid preset on a fixture registry', async (t) => {
    const fixtureRegistry = {
        presets: {
            'test-preset': ['reviewer-a', 'reviewer-b']
        },
        reviewers: [
            { id: 'reviewer-a', type: 'agent' },
            { id: 'reviewer-b', type: 'lib' },
            { id: 'reviewer-c', type: 'agent' }
        ]
    };

    const result = expandPreset(fixtureRegistry, 'test-preset');

    assert.ok(Array.isArray(result), 'expandPreset should return an array');
    assert.strictEqual(result.length, 2, 'should return 2 reviewers');
    assert.strictEqual(result[0].id, 'reviewer-a', 'first reviewer should be reviewer-a');
    assert.strictEqual(result[1].id, 'reviewer-b', 'second reviewer should be reviewer-b');
});

test('partitionByType splits the real registry correctly', async (t) => {
    const registry = await loadRegistry(pluginRoot);
    const { agents, libs } = partitionByType(registry.reviewers);

    assert.strictEqual(agents.length, 5, 'five agents (voice-check, cliche-check, opener-check, cut-check, concrete-check)');
    assert.strictEqual(libs.length, 4, 'four lib reviewers (readability, repetition-check, spread-check, passive-check)');
});
