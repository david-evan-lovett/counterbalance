// Drafts directory resolver for /ghost and /ghost-correct.
//
// Walks a three-layer cascade and returns the absolute path where drafts
// should be written for a given invocation. First match wins:
//
//   1. --out=<path> (explicit override, resolved against cwd if relative)
//   2. <cwd>/drafts (local opt-in — directory existence is the signal)
//   3. <home>/.claude/plugins/data/counterbalance/drafts/<basename> (user-level default)
//
// Layer 3 is auto-created if missing. Layers 1 and 2 are NOT auto-created —
// if you pass --out, you own the directory; if you opt in locally, you chose
// to make the folder. The drafts/basename collision for layer 3 uses cwd
// basename only (no git-remote or full-path fingerprinting), which accepts
// the rare case where two repos share a basename.

import { join, resolve, isAbsolute, basename } from 'node:path';
import { stat, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { argv } from 'node:process';

function homeDir() {
  return process.env.HOME || process.env.USERPROFILE || '';
}

/**
 * Resolve the drafts directory for a /ghost invocation.
 *
 * @param {{cwd: string, outFlag?: string}} options
 * @returns {Promise<string>} absolute path to the resolved drafts directory
 */
export async function resolveDraftsDir({ cwd, outFlag }) {
  if (outFlag) {
    return isAbsolute(outFlag) ? outFlag : resolve(cwd, outFlag);
  }

  const localDraftsDir = join(cwd, 'drafts');
  try {
    const s = await stat(localDraftsDir);
    if (s.isDirectory()) return localDraftsDir;
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }

  const userDraftsDir = join(
    homeDir(),
    '.claude',
    'plugins',
    'data',
    'counterbalance',
    'drafts',
    basename(cwd),
  );
  await mkdir(userDraftsDir, { recursive: true });
  return userDraftsDir;
}

// CLI entry point: `node lib/drafts-dir.mjs --cwd="$PWD" [--out=<path>]`
// Prints the resolved absolute path to stdout. Exits 1 on error (unlike the
// voice resolver's fail-open design — drafts-dir has no useful "null" state,
// so the caller must handle failures as hard errors).
const invokedDirectly = fileURLToPath(import.meta.url) === resolve(argv[1] ?? '');
if (invokedDirectly) {
  (async () => {
    const cwdArg = argv.find((a) => a.startsWith('--cwd='))?.slice('--cwd='.length) ?? process.cwd();
    const outArg = argv.find((a) => a.startsWith('--out='))?.slice('--out='.length);
    try {
      const path = await resolveDraftsDir({ cwd: cwdArg, outFlag: outArg });
      process.stdout.write(path);
      process.exit(0);
    } catch (err) {
      process.stderr.write(`[counterbalance] drafts-dir failed: ${err.message}\n`);
      process.exit(1);
    }
  })();
}
