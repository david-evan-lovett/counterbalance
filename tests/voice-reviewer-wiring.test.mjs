import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = join(__dirname, '..');
const pluginRoot = join(repoRoot, 'plugins', 'counterbalance');

function extractFrontmatter(content) {
    const match = content.match(/^---\n([\s\S]*?)\n---\n/);
    if (!match) return null;
    return yaml.load(match[1]);
}

// Hardcoded agent table — fixed after Phase 5.
// If a new agent-type reviewer is added in the future, add it here.
// This is intentionally NOT dynamically loaded from the registry because:
//   (a) top-level await + dynamic test discovery has Node version edge cases
//   (b) the render header is not derivable from registry id alone (different titles)
//   (c) explicit list makes the enforcement intent clear
const AGENT_ENTRIES = [
    { id: 'voice-check',    agentFile: 'voice-reviewer.md',        commandFile: 'voice-check.md',    header: '### Voice check findings' },
    { id: 'cliche-check',   agentFile: 'cliche-hunter.md',         commandFile: 'cliche-check.md',   header: '### Cliche check findings' },
    { id: 'opener-check',   agentFile: 'opener-check.md',          commandFile: 'opener-check.md',   header: '### Opener check findings' },
    { id: 'cut-check',      agentFile: 'cuttability.md',           commandFile: 'cut-check.md',      header: '### Cut check findings' },
    { id: 'concrete-check', agentFile: 'concrete-vs-abstract.md',  commandFile: 'concrete-check.md', header: '### Concrete check findings' },
];

// Sanity check: if future refactors add a new agent-type reviewer to reviewers.json
// without updating AGENT_ENTRIES, this test will surface the gap.
test('prose-review-suite.AC7.1: AGENT_ENTRIES matches registry type=agent count', async () => {
    const { loadRegistry } = await import('../plugins/counterbalance/lib/reviewers.mjs');
    const registry = await loadRegistry(pluginRoot);
    const registryAgents = registry.reviewers.filter(r => r.type === 'agent');
    assert.strictEqual(
        AGENT_ENTRIES.length,
        registryAgents.length,
        `AGENT_ENTRIES has ${AGENT_ENTRIES.length} entries but registry has ${registryAgents.length} agent-type reviewers — update AGENT_ENTRIES in tests/voice-reviewer-wiring.test.mjs`
    );
});

for (const entry of AGENT_ENTRIES) {
    const agentFile = entry.agentFile;
    const commandFile = entry.commandFile;
    const header = entry.header;

    test(`prose-review-suite.AC5.1 & AC7.1 & AC8.1: ${entry.id} agent frontmatter is correct`, async () => {
        const agentPath = join(pluginRoot, 'agents', agentFile);
        const content = await readFile(agentPath, 'utf8');
        const fm = extractFrontmatter(content);
        assert.ok(fm, `${agentFile} must have frontmatter`);
        assert.ok(fm.name, 'name field required');
        assert.ok(fm.description, 'description field required');
        assert.strictEqual(fm.model, 'sonnet', 'model must be sonnet');
        assert.strictEqual(fm.tools, 'Read, Grep, Glob', 'tools must be literally "Read, Grep, Glob"');
        assert.ok(!/\bWrite\b/.test(fm.tools));
        assert.ok(!/\bEdit\b/.test(fm.tools));
        assert.ok(!/\bBash\b/.test(fm.tools));
    });

    test(`prose-review-suite.AC5.3: ${entry.id} agent body documents output contract`, async () => {
        const agentPath = join(pluginRoot, 'agents', agentFile);
        const content = await readFile(agentPath, 'utf8');
        // the JSON block in the body must reference all Finding fields
        for (const field of ['reviewer', 'findings', 'line', 'severity', 'rule', 'quote', 'message', 'suggested']) {
            assert.ok(content.includes(field), `body must mention ${field}`);
        }
    });

    test(`prose-review-suite.AC5.3: ${entry.id} render header is literal "${header}"`, async () => {
        const agentPath = join(pluginRoot, 'agents', agentFile);
        const content = await readFile(agentPath, 'utf8');
        assert.ok(content.includes(header), `body must contain "${header}"`);
    });

    test(`prose-review-suite.AC5.4: ${entry.id} agent body handles empty draft edge case`, async () => {
        const agentPath = join(pluginRoot, 'agents', agentFile);
        const content = await readFile(agentPath, 'utf8');
        assert.ok(content.includes('empty draft'));
        assert.ok(
            content.includes('empty findings') || content.includes('zero violations') || content.includes('"findings": []')
        );
    });

    test(`prose-review-suite.AC1.1: ${entry.id} command file wires to agent`, async () => {
        const commandPath = join(pluginRoot, 'commands', commandFile);
        const content = await readFile(commandPath, 'utf8');
        const fm = extractFrontmatter(content);
        assert.ok(fm?.description, 'description required');
        assert.ok(fm?.['allowed-tools']?.includes('Task'), 'allowed-tools must include Task');
        assert.ok(fm?.['argument-hint'], 'argument-hint required');
        // body should dispatch the agent (by name or file basename)
        const agentBasename = agentFile.replace(/\.md$/, '');
        assert.ok(content.includes(agentBasename), `command must dispatch ${agentBasename}`);
    });
}
