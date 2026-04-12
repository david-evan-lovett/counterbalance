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
    } catch (err) {
        // ENOENT is the normal "no profile configured at this layer" signal —
        // the cascade's whole job is to try the next layer. Silencing ENOENT
        // keeps real errors (EACCES, EIO, ELOOP, ...) visible instead of
        // drowning them in noise on every bare-repo invocation.
        if (err.code !== 'ENOENT') {
            console.warn(`[counterbalance] Skipping voice profile (unreadable): ${filePath} — ${err.message}`);
        }
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

            // Branch 4: frontmatter must be a mapping — reject null, scalars, arrays.
            // typeof [] === 'object' so Array.isArray is the only way to catch arrays.
            if (parsed === null || parsed === undefined || typeof parsed !== 'object' || Array.isArray(parsed)) {
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
