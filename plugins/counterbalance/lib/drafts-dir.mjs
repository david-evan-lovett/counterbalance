// Drafts directory resolver for /ghost and /ghost-correct.
//
// Walks a two-layer cascade and returns the absolute path where drafts
// should be written for a given invocation:
//
//   1. --out=<path> (explicit override, resolved against cwd if relative)
//   2. <cwd>/drafts (default — auto-created if missing)
//
// Drafts default to project-local because drafts belong next to the work
// they're about. Auto-creating the folder removes the "mkdir drafts first"
// friction that would otherwise sit between the user and their first /ghost
// run. If the user wants drafts somewhere else, they pass --out=<path>.
//
// There is no user-level fallback. When /ghost runs outside any project
// (e.g., from a shell in the home directory), the resolver will still
// create a drafts folder at the current working directory — which is
// almost always what the user meant by running /ghost there in the first
// place.

import { join, resolve, isAbsolute } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { argv } from 'node:process';

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
  await mkdir(localDraftsDir, { recursive: true });
  return localDraftsDir;
}

// CLI entry point: `node lib/drafts-dir.mjs --cwd="$PWD" [--out=<path>]`
// Prints the resolved absolute path to stdout. Exits 1 on error — there is
// no useful "null" state when the caller needs a real directory to write to.
// A file named "drafts" in cwd (not a directory) surfaces as an EEXIST error
// from mkdir, which the caller can relay to the user.
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
