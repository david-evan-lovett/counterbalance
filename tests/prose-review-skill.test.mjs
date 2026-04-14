import { test } from 'node:test';
import assert from 'node:assert';
import { readFile, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const skillPath = join(__dirname, '..', 'plugins', 'counterbalance', 'skills', 'prose-review', 'SKILL.md');

function extractFrontmatter(content) {
    const match = content.match(/^---\n([\s\S]*?)\n---\n/);
    return match ? yaml.load(match[1]) : null;
}

test('prose-review-suite.AC1.2: prose-review SKILL.md exists', async () => {
    const s = await stat(skillPath);
    assert.ok(s.isFile(), 'SKILL.md must be a file');
});

test('prose-review-suite.AC1.2: SKILL.md frontmatter has name and description', async () => {
    const content = await readFile(skillPath, 'utf8');
    const fm = extractFrontmatter(content);
    assert.ok(fm, 'frontmatter required');
    assert.strictEqual(fm.name, 'prose-review', 'name must be "prose-review"');
    assert.ok(typeof fm.description === 'string' && fm.description.length > 0, 'description required');
});

test('prose-review-suite.AC1.2: SKILL.md body describes orchestration policy', async () => {
    const content = await readFile(skillPath, 'utf8');
    // basic sanity: body mentions parallel dispatch, presets, merge
    const body = content.replace(/^---\n[\s\S]*?\n---\n/, '');
    assert.ok(body.toLowerCase().includes('parallel') || body.toLowerCase().includes('fan-out'));
    assert.ok(body.toLowerCase().includes('preset'));
    assert.ok(body.toLowerCase().includes('merge') || body.toLowerCase().includes('aggregate'));
});
