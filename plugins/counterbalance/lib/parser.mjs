// Adapted from Anvil's lib/principles.mjs
// https://github.com/david-evan-lovett/anvil — SPDX-License-Identifier: MIT
// Changes: returns VoiceProfile shape with {id, path, frontmatter, body, source}
// instead of Anvil's flat principle shape, and allows missing frontmatter.

import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import yaml from 'js-yaml';

/**
 * Parse a single voice profile file into structured data.
 * @param {string} filePath - absolute path to .md file
 * @param {string} source - one of "local", "project", "user"
 * @returns {Promise<VoiceProfile|null>} parsed profile or null if malformed
 */
export async function parseVoiceProfile(filePath, source) {
    let content;
    try {
        content = await readFile(filePath, 'utf-8');
    } catch {
        console.warn(`[counterbalance] Skipping voice profile (unreadable): ${filePath}`);
        return null;
    }

    // Extract frontmatter using the regex from Anvil's principles.mjs
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);

    let frontmatter = {};
    let body = content;

    if (match) {
        // Frontmatter section found, try to parse YAML
        try {
            const parsed = yaml.load(match[1]);

            // Branch 4: frontmatter parsed but is not an object
            if (parsed !== null && parsed !== undefined && typeof parsed !== 'object') {
                console.warn(`[counterbalance] Skipping voice profile (frontmatter is not a mapping): ${filePath}`);
                return null;
            }

            // Branch 4b: frontmatter is null or undefined
            if (parsed === null || parsed === undefined) {
                console.warn(`[counterbalance] Skipping voice profile (frontmatter is not a mapping): ${filePath}`);
                return null;
            }

            // Happy path: frontmatter is a valid object
            frontmatter = parsed;
            body = content.slice(match[0].length).trimStart();
        } catch (err) {
            // Branch 3: bad YAML
            console.warn(`[counterbalance] Skipping voice profile (bad YAML): ${filePath} — ${err.message}`);
            return null;
        }
    } else {
        // Branch 2: no frontmatter section, treat whole file as body
        body = content;
    }

    // Derive id: prefer frontmatter.id if non-empty string, otherwise from filename
    let id;
    if (typeof frontmatter.id === 'string' && frontmatter.id.trim()) {
        id = frontmatter.id;
    } else {
        // Strip leading dot and .md extension, lowercase
        id = basename(filePath)
            .replace(/^\./, '')
            .replace(/\.md$/, '')
            .toLowerCase();
    }

    return {
        id,
        path: filePath,
        frontmatter,
        body,
        source,
    };
}
