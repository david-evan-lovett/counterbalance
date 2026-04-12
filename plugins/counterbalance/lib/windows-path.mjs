// Adapted from Anvil's hooks/principle-inject.mjs:75-76
// https://github.com/david-evan-lovett/anvil — SPDX-License-Identifier: MIT
// Counterbalance divergence: replace backslashes with forward slashes via
// a literal regex rather than `split(path.sep).join('/')`. The Anvil approach
// is OS-dependent — on Linux, path.sep is '/', so splitting a Windows-style
// path like 'foo\\bar\\baz.md' on '/' finds no separators and returns the
// input unchanged. The regex form normalizes on every platform, which is
// what the cross-platform test fixtures actually need.

/**
 * Normalize an OS-native or Windows-style path to forward-slash form.
 * Replaces every backslash with a forward slash regardless of host OS.
 * Non-string inputs pass through unchanged.
 */
export function toForwardSlashes(p) {
    if (typeof p !== 'string') return p;
    return p.replace(/\\/g, '/');
}
