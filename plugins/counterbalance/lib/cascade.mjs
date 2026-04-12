// Inspired by Anvil's lib/cascade.mjs ordered-layer resolution pattern.
// https://github.com/david-evan-lovett/anvil — SPDX-License-Identifier: MIT
// Counterbalance drops severity sorting, tag matching, and subtree walking —
// it only needs first-match-wins across three fixed paths.

/**
 * Walk an ordered list of (path, source) layers and return the first one
 * that parses cleanly. "First match wins" — later layers are not consulted
 * once an earlier layer has produced a valid record.
 *
 * @param {Array<{path: string, source: string}>} layers
 * @param {function(string, string): Promise<object|null>} parse
 *        — parse(filePath, source) returning a record or null
 * @returns {Promise<object|null>}
 */
export async function resolveFirstLayer(layers, parse) {
    for (const { path, source } of layers) {
        const record = await parse(path, source);
        if (record) return record;
    }
    return null;
}
