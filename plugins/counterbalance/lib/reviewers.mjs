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
    return parsed;
}

export function applicableReviewers(registry, filePath) {
    const normalized = toForwardSlashes(filePath);
    return registry.reviewers.filter(reviewer => {
        const patterns = reviewer.applies_to ?? [];
        return patterns.some(pattern => path.matchesGlob(normalized, pattern));
    });
}

export function aggregateFindings(outputs) {
    // v1 stub — multi-reviewer aggregation lands in v2.
    return outputs;
}
