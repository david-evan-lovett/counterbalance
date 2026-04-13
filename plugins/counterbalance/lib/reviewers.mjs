// Applicability matching inspired by Anvil's lib/applicability.mjs.
// https://github.com/david-evan-lovett/anvil — SPDX-License-Identifier: MIT
// Counterbalance adapts the "any-of globs" pattern for per-file reviewer enumeration
// rather than reviewer-vs-diff resolution.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { toForwardSlashes } from './windows-path.mjs';

export async function loadRegistry(pluginRoot) {
    const registryPath = path.join(pluginRoot, 'reviewers.json');
    let content;
    try {
        content = await readFile(registryPath, 'utf8');
    } catch (err) {
        throw new Error(`[counterbalance] reviewer registry unreadable at ${registryPath}: ${err.message}`);
    }
    let parsed;
    try {
        parsed = JSON.parse(content);
    } catch (err) {
        throw new Error(`[counterbalance] reviewer registry has malformed JSON at ${registryPath}: ${err.message}`);
    }
    if (!parsed || !Array.isArray(parsed.reviewers)) {
        throw new Error(`[counterbalance] reviewer registry missing "reviewers" array at ${registryPath}`);
    }
    if (parsed.presets !== undefined && (typeof parsed.presets !== 'object' || Array.isArray(parsed.presets) || parsed.presets === null)) {
        throw new Error(`[counterbalance] reviewer registry "presets" must be an object at ${registryPath}`);
    }
    return parsed;
}

export function applicableReviewers(registry, filePath) {
    const normalized = toForwardSlashes(filePath);
    return registry.reviewers.filter(reviewer => {
        const patterns = reviewer.applies_to ?? [];
        return patterns.some(pattern => path.matchesGlob(normalized, pattern));
    });
}

export function expandPreset(registry, presetId) {
    const presets = registry.presets ?? {};
    if (!(presetId in presets)) {
        throw new Error(`[counterbalance] unknown preset id: ${presetId}`);
    }
    const list = presets[presetId];
    if (!Array.isArray(list)) {
        throw new Error(`[counterbalance] preset "${presetId}" value must be an array`);
    }
    if (list.length === 1 && list[0] === '*') {
        return [...registry.reviewers];
    }
    const byId = new Map(registry.reviewers.map(r => [r.id, r]));
    const resolved = [];
    for (const id of list) {
        const entry = byId.get(id);
        if (entry) {
            resolved.push(entry);
        } else {
            console.warn(`[counterbalance] preset "${presetId}" references unknown reviewer id: ${id}`);
        }
    }
    return resolved;
}

export function partitionByType(reviewers) {
    const agents = [];
    const libs = [];
    for (const reviewer of reviewers) {
        if (reviewer.type === 'agent') {
            agents.push(reviewer);
        } else if (reviewer.type === 'lib') {
            libs.push(reviewer);
        } else {
            console.warn(`[counterbalance] reviewer "${reviewer.id}" has missing or unknown type, skipping`);
        }
    }
    return { agents, libs };
}

export function aggregateFindings(outputs) {
    if (!Array.isArray(outputs)) {
        return {
            reviewers_run: [],
            findings: [],
            errors: [],
            counts_by_severity: { violation: 0, warning: 0, note: 0 }
        };
    }
    const reviewers_run = [];
    const findings = [];
    const errors = [];
    const counts_by_severity = { violation: 0, warning: 0, note: 0 };

    for (const output of outputs) {
        if (!output || typeof output !== 'object') continue;
        const reviewerId = output.reviewer ?? '<unknown>';
        reviewers_run.push(reviewerId);
        if (output.error) {
            errors.push({ reviewer: reviewerId, error: String(output.error) });
        }
        const outputFindings = Array.isArray(output.findings) ? output.findings : [];
        for (const finding of outputFindings) {
            findings.push({ ...finding, reviewer: reviewerId });
            if (finding && typeof finding.severity === 'string' && finding.severity in counts_by_severity) {
                counts_by_severity[finding.severity] += 1;
            }
        }
    }

    findings.sort((a, b) => {
        const aLine = typeof a.line === 'number' ? a.line : Number.POSITIVE_INFINITY;
        const bLine = typeof b.line === 'number' ? b.line : Number.POSITIVE_INFINITY;
        if (aLine !== bLine) return aLine - bLine;
        const aRev = a.reviewer ?? '';
        const bRev = b.reviewer ?? '';
        if (aRev < bRev) return -1;
        if (aRev > bRev) return 1;
        return 0;
    });

    return { reviewers_run, findings, errors, counts_by_severity };
}
