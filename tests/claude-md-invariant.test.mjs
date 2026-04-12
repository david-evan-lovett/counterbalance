import { test } from 'node:test';
import assert from 'node:assert';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');
const repoRoot = join(__dirname, '..');
const pluginRoot = join(repoRoot, 'plugins', 'counterbalance');

// Directories to scan for violations
const scanDirs = [
  join(pluginRoot, 'agents'),
  join(pluginRoot, 'commands'),
  join(pluginRoot, 'lib'),
];

// Pattern to detect violations: Write/Edit operations on CLAUDE.md paths
const violationPattern = /\b(Write|writeFile|fs\.writeFile|Edit|overwrite)\b/;

/**
 * Recursively collect all files in a directory
 */
async function collectFiles(dir) {
  const files = [];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await collectFiles(fullPath)));
      } else {
        files.push(fullPath);
      }
    }
  } catch (err) {
    // Directory doesn't exist, skip
  }
  return files;
}

/**
 * Check a file for CLAUDE.md write violations
 * Returns array of violations: { file, line, offset, window }
 */
async function checkFile(filePath) {
  const content = await readFile(filePath, 'utf-8');
  const violations = [];

  // Find the position of the "NEVER mutate CLAUDE.md" invariant declaration
  const invariantIndex = content.indexOf('NEVER mutate CLAUDE.md');

  // Find all occurrences of CLAUDE.md
  const claudeMdRegex = /CLAUDE\.md/g;
  let match;

  while ((match = claudeMdRegex.exec(content)) !== null) {
    const offset = match.index;
    const windowStart = Math.max(0, offset - 60);
    const windowEnd = Math.min(content.length, offset + 60 + 'CLAUDE.md'.length);
    const window = content.substring(windowStart, windowEnd);

    // Check if this occurrence is within a reasonable context of the invariant declaration
    // (e.g., part of the same paragraph or explanation section)
    // If the invariant declaration exists and this offset is within 500 chars of it,
    // exclude it from violation checking
    if (invariantIndex !== -1 && Math.abs(offset - invariantIndex) < 500) {
      continue;
    }

    // Check if the window contains a violation pattern (actual write/edit operations)
    if (violationPattern.test(window)) {
      violations.push({
        file: filePath,
        offset,
        window,
      });
    }
  }

  return violations;
}

test('counterbalance.AC4.4: no agent/command/lib file writes to CLAUDE.md', async () => {
  const allFiles = [];
  for (const dir of scanDirs) {
    allFiles.push(...(await collectFiles(dir)));
  }

  const violations = [];
  for (const filePath of allFiles) {
    const fileViolations = await checkFile(filePath);
    violations.push(...fileViolations);
  }

  assert.deepStrictEqual(
    violations,
    [],
    `Found ${violations.length} CLAUDE.md write violations:\n${violations.map((v) => `  ${v.file}: ${v.window}`).join('\n')}`,
  );
});

test('counterbalance.AC4.4: counterbalance.md declares the invariant literally', async () => {
  const agentPath = join(pluginRoot, 'agents', 'counterbalance.md');
  const content = await readFile(agentPath, 'utf-8');

  const invariantString = 'NEVER mutate CLAUDE.md';
  assert.ok(
    content.includes(invariantString),
    `Agent body must contain the literal string "${invariantString}"`,
  );
});
