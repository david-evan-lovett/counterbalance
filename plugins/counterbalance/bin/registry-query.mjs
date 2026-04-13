import { readFile } from 'node:fs/promises';
import { resolve as resolvePath, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    loadRegistry,
    applicableReviewers,
    expandPreset,
    partitionByType
} from '../lib/reviewers.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolvePath(__dirname, '..');

async function main(argv) {
    const [cmd, ...rest] = argv;
    const registry = await loadRegistry(pluginRoot);

    if (cmd === 'applicable') {
        const [filePath] = rest;
        if (!filePath) throw new Error('usage: applicable <filePath>');
        const applicable = applicableReviewers(registry, filePath);
        return { applicable };
    }

    if (cmd === 'expand') {
        const [presetId] = rest;
        if (!presetId) throw new Error('usage: expand <presetId>');
        const entries = expandPreset(registry, presetId);
        return { ids: entries.map(e => e.id) };
    }

    if (cmd === 'intersect') {
        const [presetId, applicableFile] = rest;
        if (!presetId || !applicableFile) throw new Error('usage: intersect <presetId> <applicableIdsJsonFile>');
        const applicableIds = new Set(JSON.parse(await readFile(applicableFile, 'utf8')));
        const expanded = expandPreset(registry, presetId);
        return { ids: expanded.filter(e => applicableIds.has(e.id)).map(e => e.id) };
    }

    if (cmd === 'partition') {
        const [idsFile] = rest;
        if (!idsFile) throw new Error('usage: partition <idsJsonFile>');
        const ids = JSON.parse(await readFile(idsFile, 'utf8'));
        const entries = ids.map(id => registry.reviewers.find(r => r.id === id)).filter(Boolean);
        const parts = partitionByType(entries);
        return {
            agents: parts.agents.map(r => ({ id: r.id, agent: r.agent, command: r.command })),
            libs: parts.libs.map(r => r.id)
        };
    }

    throw new Error(`unknown subcommand: ${cmd}. Valid: applicable, expand, intersect, partition`);
}

try {
    const result = await main(process.argv.slice(2));
    process.stdout.write(JSON.stringify(result) + '\n');
    process.exit(0);
} catch (err) {
    process.stderr.write(`[counterbalance:registry-query] ${err.message}\n`);
    process.exit(1);
}
