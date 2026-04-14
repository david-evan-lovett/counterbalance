// CLAUDE.md voice-section fallback parser.
//
// The three-layer resolver cascade in resolver.mjs checks dedicated profile
// files. When none of those exist, resolveVoice falls through to this parser
// as a last-ditch convenience — it scans $HOME/.claude/CLAUDE.md for a heading
// matching the voice regex and extracts that section as an ad-hoc voice guide.
//
// This is deliberately coarser than parser.mjs: no frontmatter, no id from
// filename, no YAML. If you want a real voice profile, run /voice-refresh and
// let Voice Discovery migrate CLAUDE.md into the user layer.

import { readFile } from 'node:fs/promises';

const VOICE_HEADING_REGEX = /voice|writing|tone|style|register|sentence/i;

/**
 * Extract a voice section from CLAUDE.md content.
 *
 * Finds the first heading whose text matches the voice regex and captures
 * everything up to (but not including) the next heading of equal or higher
 * level (fewer or same number of leading `#`s). End-of-file also terminates.
 *
 * @param {string} content - raw CLAUDE.md contents
 * @returns {{heading: string, level: number, body: string} | null}
 */
export function extractVoiceSection(content) {
  if (typeof content !== 'string' || content.length === 0) return null;

  const lines = content.split(/\r?\n/);
  const headingRe = /^(#{1,6})\s+(.+?)\s*$/;

  let startIdx = -1;
  let startLevel = 0;
  let startHeadingText = '';

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(headingRe);
    if (!m) continue;
    const headingText = m[2];
    if (VOICE_HEADING_REGEX.test(headingText)) {
      startIdx = i;
      startLevel = m[1].length;
      startHeadingText = headingText;
      break;
    }
  }

  if (startIdx === -1) return null;

  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i++) {
    const m = lines[i].match(headingRe);
    if (!m) continue;
    const level = m[1].length;
    if (level <= startLevel) {
      endIdx = i;
      break;
    }
  }

  const sectionLines = lines.slice(startIdx, endIdx);
  const body = sectionLines.join('\n').replace(/\s+$/, '');

  if (body.trim().length === 0) return null;

  return {
    heading: startHeadingText,
    level: startLevel,
    body,
  };
}

/**
 * Parse CLAUDE.md as a voice profile via voice-section extraction.
 * Returns a VoiceProfile-shaped object or null.
 *
 * The returned profile has:
 *   id: "claude-md-fallback"
 *   path: the CLAUDE.md file path
 *   frontmatter: { heading, level } — NOT YAML-derived, synthesized from the section
 *   body: the extracted section including its heading line
 *   source: the source tag passed in (typically "claude-md")
 *
 * @param {string} filePath - absolute path to a CLAUDE.md file
 * @param {string} source - source tag for the returned profile
 * @returns {Promise<object|null>}
 */
export async function parseClaudeMdVoice(filePath, source) {
  let content;
  try {
    content = await readFile(filePath, 'utf-8');
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.warn(`[counterbalance] Skipping CLAUDE.md voice fallback (unreadable): ${filePath} — ${err.message}`);
    }
    return null;
  }

  const section = extractVoiceSection(content);
  if (!section) return null;

  return {
    id: 'claude-md-fallback',
    path: filePath,
    frontmatter: { heading: section.heading, level: section.level },
    body: section.body,
    source,
  };
}
