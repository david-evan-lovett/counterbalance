import { test } from 'node:test';
import assert from 'node:assert';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const commandPath = join(__dirname, '..', 'plugins', 'counterbalance', 'commands', 'prose-review.md');

function extractFrontmatter(content) {
    const match = content.match(/^---\n([\s\S]*?)\n---\n/);
    return match ? yaml.load(match[1]) : null;
}

test('prose-review-suite.AC1.2: prose-review command file exists', async () => {
    await readFile(commandPath, 'utf8');
});

test('prose-review-suite.AC1.2: frontmatter has required fields', async () => {
    const content = await readFile(commandPath, 'utf8');
    const fm = extractFrontmatter(content);
    assert.ok(fm?.description, 'description required');
    assert.ok(fm?.['allowed-tools'], 'allowed-tools required');
    assert.ok(fm?.['argument-hint'], 'argument-hint required');
});

test('prose-review-suite.AC1.2: allowed-tools includes Task, Bash, AskUserQuestion', async () => {
    const content = await readFile(commandPath, 'utf8');
    const fm = extractFrontmatter(content);
    assert.ok(fm['allowed-tools'].includes('Task'));
    assert.ok(fm['allowed-tools'].includes('Bash'));
    assert.ok(fm['allowed-tools'].includes('AskUserQuestion'));
});

test('prose-review-suite.AC1.2: body references mech-review runner', async () => {
    const content = await readFile(commandPath, 'utf8');
    assert.ok(content.includes('bin/mech-review.mjs'));
});

test('prose-review-suite.AC6.2: body references aggregateFindings merge step', async () => {
    const content = await readFile(commandPath, 'utf8');
    assert.ok(content.includes('aggregateFindings'));
});

test('prose-review-suite.AC1.3: body lists the four named presets', async () => {
    const content = await readFile(commandPath, 'utf8');
    for (const preset of ['quick', 'voice', 'mechanical', 'full']) {
        assert.ok(content.includes(preset), `body must mention preset "${preset}"`);
    }
});

test('prose-review-suite.AC1.5: body handles no-applicable-reviewers case', async () => {
    const content = await readFile(commandPath, 'utf8');
    assert.ok(content.toLowerCase().includes('no applicable reviewers'));
});

test('prose-review-suite.AC6.2: body has prose-review render header', async () => {
    const content = await readFile(commandPath, 'utf8');
    assert.ok(content.includes('### Prose review'));
});

test('prose-review-suite.AC6.3: body renders errors section', async () => {
    const content = await readFile(commandPath, 'utf8');
    assert.ok(content.includes('### Reviewer errors') || content.toLowerCase().includes('reviewer errors'));
});
