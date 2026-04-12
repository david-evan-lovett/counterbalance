// Adapted from Anvil's hooks/principle-inject.mjs:75-76
// https://github.com/david-evan-lovett/anvil — SPDX-License-Identifier: MIT

import { sep } from 'node:path';

/**
 * Normalize an OS-native path to forward-slash form.
 * On Windows, path APIs return "src\\api\\file.md" but glob patterns and
 * cross-platform test fixtures use "src/api/file.md". Without this
 * normalization, any code that compares paths across platforms silently
 * breaks on Windows.
 */
export function toForwardSlashes(p) {
    if (typeof p !== 'string') return p;
    return p.split(sep).join('/');
}
