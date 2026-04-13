import { test } from 'node:test';
import assert from 'node:assert';
import { writeFile, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import {
  parseCorrections,
  findArrowOutsideCode,
  markFencedLines,
} from '../plugins/counterbalance/lib/correction-parser.mjs';

// === findArrowOutsideCode ===

test('findArrowOutsideCode: finds a plain arrow', () => {
  assert.strictEqual(findArrowOutsideCode('original <- replacement'), 9);
});

test('findArrowOutsideCode: returns -1 for a line without an arrow', () => {
  assert.strictEqual(findArrowOutsideCode('no arrow here'), -1);
});

test('findArrowOutsideCode: ignores arrows inside a backtick span', () => {
  assert.strictEqual(findArrowOutsideCode('the `arrow <- op` is the thing'), -1);
});

test('findArrowOutsideCode: finds an arrow AFTER an inline code span that also contains one', () => {
  const line = 'the `x <- y` operator <- the left-arrow operator';
  const idx = findArrowOutsideCode(line);
  assert.ok(idx > 0);
  assert.strictEqual(line.slice(idx, idx + 2), '<-');
  assert.ok(line.slice(0, idx).includes('operator'));
});

test('findArrowOutsideCode: handles an unclosed backtick (treats the rest of the line as code)', () => {
  assert.strictEqual(findArrowOutsideCode('a line with `unclosed <- inside'), -1);
});

// === markFencedLines ===

test('markFencedLines: marks lines inside a fenced block and the fence delimiters themselves', () => {
  const text = [
    'before fence',
    '```js',
    'const x <- y;',
    '```',
    'after fence',
  ].join('\n');

  const mask = markFencedLines(text);
  assert.deepStrictEqual(mask, [false, true, true, true, false]);
});

test('markFencedLines: handles multiple fenced blocks', () => {
  const text = [
    'outside a',
    '```',
    'inside a',
    '```',
    'between',
    '```',
    'inside b',
    '```',
    'outside b',
  ].join('\n');

  const mask = markFencedLines(text);
  assert.deepStrictEqual(mask, [false, true, true, true, false, true, true, true, false]);
});

test('markFencedLines: returns all false for a text with no fences', () => {
  const text = 'line one\nline two\nline three';
  const mask = markFencedLines(text);
  assert.deepStrictEqual(mask, [false, false, false]);
});

// === parseCorrections ===

test('parseCorrections: returns empty array for empty or non-string input', () => {
  assert.deepStrictEqual(parseCorrections(''), []);
  assert.deepStrictEqual(parseCorrections(null), []);
  assert.deepStrictEqual(parseCorrections(undefined), []);
});

test('parseCorrections: returns empty array when no <- is present', () => {
  const text = '# Title\n\nJust some prose.\nNothing to correct.\n';
  assert.deepStrictEqual(parseCorrections(text), []);
});

test('parseCorrections: parses a single correction with 1-indexed line number', () => {
  const text = [
    '# Title',
    '',
    'Everyone should write an agent. <- Everyone should write agents. Plural.',
    '',
    'more prose',
  ].join('\n');

  const result = parseCorrections(text);
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].line, 3);
  assert.strictEqual(result[0].original, 'Everyone should write an agent.');
  assert.strictEqual(result[0].replacement, 'Everyone should write agents. Plural.');
});

test('parseCorrections: parses multiple corrections on different lines', () => {
  const text = [
    'line one original <- line one replacement',
    'line two plain',
    'line three original <- line three replacement',
  ].join('\n');

  const result = parseCorrections(text);
  assert.strictEqual(result.length, 2);
  assert.strictEqual(result[0].line, 1);
  assert.strictEqual(result[1].line, 3);
});

test('parseCorrections: ignores <- inside fenced code blocks', () => {
  const text = [
    'real correction <- should be caught',
    '',
    '```js',
    "const x = 'fake <- not a correction';",
    '```',
    '',
    'another real <- also caught',
  ].join('\n');

  const result = parseCorrections(text);
  assert.strictEqual(result.length, 2);
  assert.ok(result[0].original.includes('real correction'));
  assert.ok(result[1].original.includes('another real'));
});

test('parseCorrections: ignores <- inside inline backtick spans', () => {
  const text = 'the `x <- y` operator is what Haskell uses\n';
  const result = parseCorrections(text);
  assert.deepStrictEqual(result, []);
});

test('parseCorrections: finds a real <- even when an inline code span on the same line also contains one', () => {
  const text = 'Haskell writes `x <- y` but we mean it differently <- we use <- for corrections\n';
  const result = parseCorrections(text);
  assert.strictEqual(result.length, 1);
  assert.ok(result[0].original.includes('we mean it differently'));
  assert.ok(result[0].replacement.includes('we use'));
});

test('parseCorrections: skips general-note lines (line starts with <-)', () => {
  const text = [
    '<- this is a general structural note, not a correction',
    'real correction <- replacement text',
  ].join('\n');

  const result = parseCorrections(text);
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].line, 2);
});

test('parseCorrections: skips lines where replacement is empty (trailing arrow)', () => {
  const text = [
    'original text with missing replacement <-',
    'real <- real replacement',
  ].join('\n');

  const result = parseCorrections(text);
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].line, 2);
});

test('parseCorrections: handles CRLF line endings', () => {
  const text = 'line one <- fixed line one\r\nline two\r\nline three <- fixed line three\r\n';
  const result = parseCorrections(text);
  assert.strictEqual(result.length, 2);
  assert.strictEqual(result[0].line, 1);
  assert.strictEqual(result[1].line, 3);
});

test('parseCorrections: trims whitespace around original and replacement', () => {
  const text = '    original text    <-    replacement text    \n';
  const result = parseCorrections(text);
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].original, 'original text');
  assert.strictEqual(result[0].replacement, 'replacement text');
});

test('parseCorrections: uses the first <- on a line when multiple appear outside code', () => {
  const text = 'a <- b <- c\n';
  const result = parseCorrections(text);
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].original, 'a');
  assert.strictEqual(result[0].replacement, 'b <- c');
});

// === CLI ===

test('correction-parser CLI: prints JSON array and exits 0', async () => {
  const tempDir = await mkdtemp(join(os.tmpdir(), 'correction-parser-'));
  try {
    const draftPath = join(tempDir, 'draft.md');
    await writeFile(draftPath, 'a line <- a fix\nanother line <- another fix\n', 'utf-8');

    const result = execFileSync(
      'node',
      [
        join(process.cwd(), 'plugins/counterbalance/lib/correction-parser.mjs'),
        `--file=${draftPath}`,
      ],
      { encoding: 'utf-8' },
    );

    const parsed = JSON.parse(result);
    assert.strictEqual(parsed.length, 2);
    assert.strictEqual(parsed[0].line, 1);
    assert.strictEqual(parsed[0].original, 'a line');
    assert.strictEqual(parsed[0].replacement, 'a fix');
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('correction-parser CLI: prints empty array for a file with no markers', async () => {
  const tempDir = await mkdtemp(join(os.tmpdir(), 'correction-parser-'));
  try {
    const draftPath = join(tempDir, 'draft.md');
    await writeFile(draftPath, '# Title\n\nJust prose.\n', 'utf-8');

    const result = execFileSync(
      'node',
      [
        join(process.cwd(), 'plugins/counterbalance/lib/correction-parser.mjs'),
        `--file=${draftPath}`,
      ],
      { encoding: 'utf-8' },
    );

    assert.strictEqual(result, '[]');
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('correction-parser CLI: exits 1 on missing file', async () => {
  let threw = false;
  try {
    execFileSync(
      'node',
      [
        join(process.cwd(), 'plugins/counterbalance/lib/correction-parser.mjs'),
        '--file=/nonexistent/path/definitely-not-here.md',
      ],
      { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
  } catch (err) {
    threw = true;
    assert.strictEqual(err.status, 1);
  }
  assert.ok(threw, 'CLI must exit non-zero on a missing file');
});

test('correction-parser CLI: exits 1 when --file is not provided', async () => {
  let threw = false;
  try {
    execFileSync(
      'node',
      [join(process.cwd(), 'plugins/counterbalance/lib/correction-parser.mjs')],
      { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
  } catch (err) {
    threw = true;
    assert.strictEqual(err.status, 1);
  }
  assert.ok(threw, 'CLI must exit non-zero when --file is missing');
});
