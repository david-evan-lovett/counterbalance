// Correction parser for /ghost-correct.
//
// Walks a draft file line-by-line, finds lines with a `<-` marker OUTSIDE
// any fenced code block and outside any inline backtick span, and returns
// a list of {line, original, replacement} objects. This is the contract
// between the user's in-file edits and the drafting subagent that will
// re-apply them.
//
// Skipping rules:
// - Lines inside ``` fenced code blocks are ignored. Fence open and close
//   lines themselves are also ignored.
// - `<-` occurrences inside inline `...` backtick spans are ignored. A line
//   with ONLY code-span arrows and no real arrow is skipped entirely.
// - Lines where the text BEFORE the arrow trims to empty (a line that
//   starts with `<-`) are skipped — per the drafter SKILL.md, those are
//   general structural notes, not corrections.
// - Lines where the text AFTER the arrow trims to empty (missing
//   replacement) are skipped — a correction without a replacement is
//   almost always a typo, and the confirm-before-dispatch step is a
//   better place to surface it than here.

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { argv } from 'node:process';

/**
 * Find the index of the first `<-` in `line` that sits OUTSIDE any inline
 * backtick span. Returns -1 if every `<-` on the line is inside code.
 *
 * @param {string} line
 * @returns {number} zero-based index, or -1
 */
export function findArrowOutsideCode(line) {
  let inCode = false;
  for (let i = 0; i < line.length - 1; i++) {
    if (line[i] === '`') {
      inCode = !inCode;
      continue;
    }
    if (!inCode && line[i] === '<' && line[i + 1] === '-') {
      return i;
    }
  }
  return -1;
}

/**
 * Walk `draftText` and return a boolean array the same length as the
 * line count, marking which lines are inside a fenced code block. Lines
 * that are themselves a ``` fence delimiter are also marked.
 *
 * @param {string} draftText
 * @returns {boolean[]}
 */
export function markFencedLines(draftText) {
  const lines = draftText.split(/\r?\n/);
  const fenceMask = new Array(lines.length).fill(false);
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*```/.test(lines[i])) {
      fenceMask[i] = true;
      inFence = !inFence;
    } else {
      fenceMask[i] = inFence;
    }
  }
  return fenceMask;
}

/**
 * Parse `<-` corrections out of a draft text.
 *
 * @param {string} draftText
 * @returns {Array<{line: number, original: string, replacement: string}>}
 *   Corrections in the order they appear in the draft. Line numbers are
 *   1-indexed and reference the source draft file directly.
 */
export function parseCorrections(draftText) {
  if (typeof draftText !== 'string' || draftText.length === 0) return [];

  const lines = draftText.split(/\r?\n/);
  const fenceMask = markFencedLines(draftText);
  const corrections = [];

  for (let i = 0; i < lines.length; i++) {
    if (fenceMask[i]) continue;

    const line = lines[i];
    const arrowIdx = findArrowOutsideCode(line);
    if (arrowIdx === -1) continue;

    const original = line.slice(0, arrowIdx).trim();
    const replacement = line.slice(arrowIdx + 2).trim();

    if (original === '') continue;
    if (replacement === '') continue;

    corrections.push({
      line: i + 1,
      original,
      replacement,
    });
  }

  return corrections;
}

// CLI entry point: `node lib/correction-parser.mjs --file=<draft-path>`
// Prints a JSON array of corrections to stdout. Exits 1 on read error or
// invalid args. Unlike the voice resolver, this CLI is not fail-open —
// if the user pointed /ghost-correct at a missing file, they want to know.
const invokedDirectly = fileURLToPath(import.meta.url) === resolve(argv[1] ?? '');
if (invokedDirectly) {
  (async () => {
    const fileArg = argv.find((a) => a.startsWith('--file='))?.slice('--file='.length);
    if (!fileArg) {
      process.stderr.write('[counterbalance] correction-parser: --file=<path> is required\n');
      process.exit(1);
    }
    try {
      const content = await readFile(fileArg, 'utf-8');
      const corrections = parseCorrections(content);
      process.stdout.write(JSON.stringify(corrections));
      process.exit(0);
    } catch (err) {
      process.stderr.write(`[counterbalance] correction-parser failed: ${err.message}\n`);
      process.exit(1);
    }
  })();
}
