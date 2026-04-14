// Voice profile resolver: walks the four-layer cascade and returns a VoiceProfile | null
// Layers 1–3 are dedicated profile files parsed by parser.mjs.
// Layer 4 is a last-ditch extraction of a voice section from $HOME/.claude/CLAUDE.md,
// handled by claude-md-parser.mjs. If every layer misses, resolveVoice returns null
// and callers (e.g. the /ghost command) bounce the user toward /voice-refresh.

import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { argv } from 'node:process';
import { parseVoiceProfile } from './parser.mjs';
import { parseClaudeMdVoice } from './claude-md-parser.mjs';
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
 * Constant object defining the layer paths for voice profiles.
 * Layers 1–3 are dedicated profile files; layer 4 is CLAUDE.md.
 * Exported for testability and documentation.
 */
export const VOICE_PATHS = {
  local:    (cwd) => join(cwd, '.counterbalance.md'),
  project:  (cwd) => join(cwd, '.claude', 'counterbalance.md'),
  user:     () => join(homeDir(), '.claude', 'plugins', 'data', 'counterbalance', 'profiles', 'default.md'),
  claudeMd: () => join(homeDir(), '.claude', 'CLAUDE.md'),
};

/**
 * Public API: resolve a voice profile from the four-layer cascade.
 * Layers in order: local override, project, user, CLAUDE.md.
 * First match wins; returns null if no profile found at any layer.
 *
 * Layer 4 (CLAUDE.md) is a last-ditch convenience: it extracts a voice section
 * from $HOME/.claude/CLAUDE.md if one exists, rather than requiring a dedicated
 * profile file. Any of the first three layers overrides it.
 *
 * @param {string} cwd - current working directory to search from
 * @returns {Promise<VoiceProfile|null>}
 */
export async function resolveVoice(cwd) {
  const standardLayers = [
    { path: VOICE_PATHS.local(cwd),   source: 'local'   },
    { path: VOICE_PATHS.project(cwd), source: 'project' },
    { path: VOICE_PATHS.user(),       source: 'user'    },
  ];
  const firstHit = await resolveFirstLayer(standardLayers, parseVoiceProfile);
  if (firstHit) return firstHit;

  return parseClaudeMdVoice(VOICE_PATHS.claudeMd(), 'claude-md');
}

/**
 * CLI entry point: invoked as `node lib/resolver.mjs --cwd=$PWD --json`
 * Prints JSON to stdout (or empty string if null) and exits 0.
 * On any internal error, prints "null" and exits 0 (fail-open).
 */
const invokedDirectly = fileURLToPath(import.meta.url) === resolve(argv[1] ?? '');
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
