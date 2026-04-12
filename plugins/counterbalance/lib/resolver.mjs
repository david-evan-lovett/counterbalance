// Voice profile resolver: walks the three-layer cascade and returns a VoiceProfile | null
// Uses parser.mjs and cascade.mjs to implement the resolution logic.

import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { argv } from 'node:process';
import { parseVoiceProfile } from './parser.mjs';
import { resolveFirstLayer } from './cascade.mjs';

/**
 * Helper to get the user's home directory.
 * On Windows, returns USERPROFILE; on Unix, returns HOME.
 * Returns empty string if neither is set.
 */
function homeDir() {
  return process.env.HOME || process.env.USERPROFILE || '';
}

/**
 * Constant object defining the three layer paths for voice profiles.
 * Exported for testability and documentation.
 */
export const VOICE_PATHS = {
  local:   (cwd) => join(cwd, '.counterbalance.md'),
  project: (cwd) => join(cwd, '.claude', 'counterbalance.md'),
  user:    () => join(homeDir(), '.claude', 'plugins', 'data', 'counterbalance', 'profiles', 'default.md'),
};

/**
 * Public API: resolve a voice profile from the three-layer cascade.
 * Layers in order: local override, project, user.
 * First match wins; returns null if no profile found.
 *
 * @param {string} cwd - current working directory to search from
 * @returns {Promise<VoiceProfile|null>}
 */
export async function resolveVoice(cwd) {
  const layers = [
    { path: VOICE_PATHS.local(cwd),   source: 'local'   },
    { path: VOICE_PATHS.project(cwd), source: 'project' },
    { path: VOICE_PATHS.user(),       source: 'user'    },
  ];
  return resolveFirstLayer(layers, parseVoiceProfile);
}

/**
 * CLI entry point: invoked as `node lib/resolver.mjs --cwd=$PWD --json`
 * Prints JSON to stdout (or empty string if null) and exits 0.
 * On any internal error, prints "null" and exits 0 (fail-open).
 */
const invokedDirectly = fileURLToPath(import.meta.url) === (await import('node:path')).resolve(argv[1] ?? '');
if (invokedDirectly) {
  (async () => {
    const cwdArg = argv.find(a => a.startsWith('--cwd='))?.slice('--cwd='.length) ?? process.cwd();
    const wantJson = argv.includes('--json');
    try {
      const profile = await resolveVoice(cwdArg);
      if (wantJson) {
        process.stdout.write(profile ? JSON.stringify(profile) : 'null');
      } else {
        process.stdout.write(profile ? profile.path : '');
      }
      process.exit(0);
    } catch (err) {
      process.stderr.write(`[counterbalance] resolver failed: ${err.message}\n`);
      process.stdout.write(wantJson ? 'null' : '');
      process.exit(0); // fail-open
    }
  })();
}
