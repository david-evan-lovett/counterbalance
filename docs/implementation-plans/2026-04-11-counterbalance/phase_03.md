# Counterbalance Phase 3: Skill Extraction

**Goal:** The ghost-writer skill lives at the canonical plugin path `plugins/counterbalance/skills/counterbalance/SKILL.md` with references intact, frontmatter rewritten for the plugin, and body minimally adjusted to reference the counterbalance resolver CLI and the Voice Discovery pre-flight CLAUDE.md migration step. The `.skill` zip becomes obsolete.

**Architecture:** One skill directory under `plugins/counterbalance/skills/counterbalance/` following Claude Code's auto-discovery convention. Always-loaded core in `SKILL.md`; on-demand reference detail in `references/*.md`. Matches Anvil's `skills/anvil/SKILL.md` + `skills/anvil/references/workflow.md` two-tier pattern.

**Tech Stack:** Pure markdown + YAML frontmatter. No code changes. Uses `unzip` or Node's `zlib` at extraction time; zip is consumed once and discarded.

**Scope:** 3 of 8 phases.

**Codebase verified:** 2026-04-12. `C:\Users\david\Repos\old_anvil\ghost-writer.skill` is a ZIP archive containing exactly two files: `ghost-writer/SKILL.md` (11,456 bytes, last modified 2026-04-12) and `ghost-writer/references/fallback-voice.md` (1,529 bytes). No other reference files. The zip is a packaged-skill format — a single skill directory compressed. The destination directory `plugins/counterbalance/skills/counterbalance/` does not exist yet (Phase 1 creates the plugin root but not this subtree).

---

## Acceptance Criteria Coverage

This phase implements and tests:

### counterbalance.AC1: Skill extraction
- **counterbalance.AC1.1 Success:** Counterbalance skill exists at `plugins/counterbalance/skills/counterbalance/SKILL.md` with valid YAML frontmatter (`name`, `description`, `user-invocable: false`)
- **counterbalance.AC1.2 Success:** SKILL.md body contains both Voice Discovery and Drafting Loop modes, plus `<-` correction operator instructions
- **counterbalance.AC1.3 Success:** `references/fallback-voice.md` exists and is referenced from SKILL.md

---

## External Dependency Findings

- ✓ Claude Code auto-discovers skills at `plugins/<plugin>/skills/<name>/SKILL.md`. No `plugin.json` update needed to register the skill. Source: https://code.claude.com/docs/en/plugins-reference#plugin-directory-structure.
- ✓ SKILL.md frontmatter requires `name` + `description`; `user-invocable` is optional and defaults to `true`. Counterbalance explicitly sets it to `false` so invocation goes through `/ghost` and `/voice-refresh` rather than by typing the skill name.
- ✓ `unzip` is available on Windows developer machines via Git Bash (which ships with it). If it isn't, `tar -xf archive.zip` works on Windows 10+ natively. The executor should fall back cleanly.
- N/A external library research — this phase is file movement and markdown edits.

---

## Task Checklist

<!-- START_TASK_1 -->
### Task 1: Extract the `.skill` archive to a scratch location

**Verifies:** (foundation — no direct AC, sets up Task 2)

**Files:**
- Read only: `C:\Users\david\Repos\old_anvil\ghost-writer.skill`
- Create in scratch (not committed): `C:\Users\david\Repos\counterbalance\.scratch\ghost-writer\SKILL.md`
- Create in scratch: `C:\Users\david\Repos\counterbalance\.scratch\ghost-writer\references\fallback-voice.md`

**Step 1: Make the scratch directory**

```bash
mkdir -p .scratch
```

**Step 2: Extract the zip**

```bash
unzip -o "C:/Users/david/Repos/old_anvil/ghost-writer.skill" -d .scratch/
```

Expected: creates `.scratch/ghost-writer/SKILL.md` and `.scratch/ghost-writer/references/fallback-voice.md`. `unzip` prints `inflating: ...` for each file.

If `unzip` is not available:

```bash
tar -xf "C:/Users/david/Repos/old_anvil/ghost-writer.skill" -C .scratch/
```

Expected: same result. Note: despite the `.skill` extension, `tar` handles ZIP archives on Windows 10+.

**Step 3: Verify the extraction**

```bash
ls -la .scratch/ghost-writer/
ls -la .scratch/ghost-writer/references/
```

Expected: `SKILL.md` present (~11K), `references/fallback-voice.md` present (~1.5K).

**Step 4: Read the extracted `SKILL.md`** (for use in Task 2)

```bash
cat .scratch/ghost-writer/SKILL.md
```

Note the frontmatter `name:` field (probably `ghost-writer`), the body sections (Voice Discovery, Drafting Loop, `<-` operator), and any references to `fallback-voice.md`. You will rewrite the frontmatter and make targeted body edits in Task 2.

**No commit.** `.scratch/` is added to `.gitignore` in this same step:

Append to `c:\Users\david\Repos\counterbalance\.gitignore`:

```gitignore
# Scratch workspace for intermediate artifacts
.scratch/
```

```bash
git add .gitignore
git commit -m "chore: ignore .scratch/ workspace"
```
<!-- END_TASK_1 -->

<!-- START_TASK_2 -->
### Task 2: Install SKILL.md with adapted frontmatter and body

**Verifies:** counterbalance.AC1.1, counterbalance.AC1.2

**Files:**
- Create: `c:\Users\david\Repos\counterbalance\plugins\counterbalance\skills\counterbalance\SKILL.md`

**Implementation:**

Take the body of `.scratch/ghost-writer/SKILL.md` as the starting point. Apply three classes of change, in order:

**Change 1 — replace the frontmatter block entirely.** Whatever the zipped SKILL.md declares, overwrite it with:

```yaml
---
name: counterbalance
description: Use when drafting prose from notes in the user's voice, or when re-running Voice Discovery to refresh the active voice profile. Owns the Drafting Loop (intake → silent analysis → draft → correction → supporting structure → grammar check) and Voice Discovery mode, including the `<-` correction operator.
user-invocable: false
---
```

The `description` is third-person ("Use when…") per Claude Code agent/skill description conventions (see `C:\Users\david\Repos\old_anvil\skills\anvil\SKILL.md:4` for the pattern).

`user-invocable: false` is explicit and load-bearing: it stops `/skill counterbalance` from working as a direct invocation. All entry points go through `/ghost` (Phase 4) or `/voice-refresh` (Phase 4).

**Change 2 — minimal body edits.** Do NOT rewrite the body for voice or style. Do NOT restructure sections. The changes are surgical:

1. **Rename references to "ghost-writer"** in the body to `counterbalance`. Do this with a literal search-and-replace of the word "ghost-writer" → "counterbalance" in the body only (not inside fenced code blocks that contain example commands, if any exist — check for and skip those). Similarly, any reference to "ghostwriter" (one word) becomes "counterbalance".

2. **Add a "Voice profile resolution" block** near the top of the Voice Discovery section (before the sample-gathering step), with this literal content:

   ```markdown
   ### Voice profile resolution

   Before gathering samples, resolve the active voice profile by shelling out to the counterbalance resolver:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/lib/resolver.mjs" --cwd="$PWD" --json
   ```

   The resolver prints JSON for a matched profile or the literal string `null`. Three layers are checked in descending precedence: local override (`./.counterbalance.md`), project (`./.claude/counterbalance.md`), user (`$HOME/.claude/plugins/data/counterbalance/profiles/default.md`). If the resolver returns `null`, fall back to `references/fallback-voice.md` as your voice guide — never operate with no voice guidance at all.
   ```

3. **Add a "CLAUDE.md pre-flight migration" block** as the FIRST step of Voice Discovery mode, before the voice-profile-resolution block. Literal content:

   ```markdown
   ### CLAUDE.md pre-flight migration

   Voice Discovery runs this step exactly once per invocation, before any sample gathering:

   1. Read `$HOME/.claude/CLAUDE.md` if it exists.
   2. Scan for voice/writing/tone guidance — look for headings matching `/voice|writing|tone|style|register|sentence/i`, and for section bodies that talk about cadence, sentence structure, analogies, what to avoid, etc. Heading-agnostic: don't require a specific heading string.
   3. If candidate content is found, show the extracted content verbatim to the user alongside the destination path `$HOME/.claude/plugins/data/counterbalance/profiles/default.md`. Ask for import approval via AskUserQuestion.
   4. On acceptance, write the extracted content to the destination path (creating parent directories as needed). Then instruct the user to remove the redundant section from `~/.claude/CLAUDE.md` themselves. **NEVER mutate CLAUDE.md from this skill or from any code in this plugin.**
   5. On decline, or if no candidate content is found, continue to normal sample-based Voice Discovery.
   ```

   The "NEVER mutate CLAUDE.md" line is load-bearing — Phase 4's `tests/agent-wiring.test.mjs` greps for it as a structural invariant.

4. **Add a closing reference block** (append to end of file) pointing at the fallback:

   ```markdown
   ---

   ### Fallback voice

   When no voice profile resolves, read [`references/fallback-voice.md`](references/fallback-voice.md) and use it as the active voice guide for the session.
   ```

**Change 3 — preserve the `<-` correction operator section verbatim.** Whatever the original skill body says about the `<-` operator, keep it word-for-word. Phase 4's agent-wiring test asserts it's present.

**Verification:**

```bash
node --check plugins/counterbalance/skills/counterbalance/SKILL.md 2>/dev/null || true
```

Markdown isn't JS, so `node --check` won't parse it — that's fine. Do a structural read-back instead:

```bash
head -5 plugins/counterbalance/skills/counterbalance/SKILL.md
```

Expected: frontmatter block starts with `---`, contains `name: counterbalance`, `description:` line, `user-invocable: false`, then closing `---`.

```bash
grep -q "Voice Discovery" plugins/counterbalance/skills/counterbalance/SKILL.md && echo "Voice Discovery present"
grep -q "Drafting Loop" plugins/counterbalance/skills/counterbalance/SKILL.md && echo "Drafting Loop present"
grep -q "<-" plugins/counterbalance/skills/counterbalance/SKILL.md && echo "correction operator present"
grep -q "NEVER mutate CLAUDE.md" plugins/counterbalance/skills/counterbalance/SKILL.md && echo "mutation invariant present"
```

All four lines should print their "present" confirmation. If any don't, your body edits missed the mark — fix and re-verify.

**Commit:** `feat: extract counterbalance skill with Voice Discovery + Drafting Loop`
<!-- END_TASK_2 -->

<!-- START_TASK_3 -->
### Task 3: Install `references/fallback-voice.md`

**Verifies:** counterbalance.AC1.3

**Files:**
- Create: `c:\Users\david\Repos\counterbalance\plugins\counterbalance\skills\counterbalance\references\fallback-voice.md`

**Step 1: Copy the file verbatim from the scratch extraction**

```bash
mkdir -p plugins/counterbalance/skills/counterbalance/references
cp .scratch/ghost-writer/references/fallback-voice.md plugins/counterbalance/skills/counterbalance/references/fallback-voice.md
```

No content changes. The fallback voice is a generic voice guide intended to prevent the drafter from running with zero voice context — it doesn't reference "ghost-writer" or any plugin-specific names and can be copied as-is.

**Step 2: Verify**

```bash
ls -la plugins/counterbalance/skills/counterbalance/references/fallback-voice.md
```

Expected: file exists, size ~1.5K.

**Step 3: Cross-reference from SKILL.md is already in place** (Task 2 appended the closing reference block). Confirm:

```bash
grep -q "references/fallback-voice.md" plugins/counterbalance/skills/counterbalance/SKILL.md && echo "linked"
```

Expected: prints `linked`.

**Commit:** `feat: add fallback voice reference`
<!-- END_TASK_3 -->

<!-- START_TASK_4 -->
### Task 4: `tests/skill-structure.test.mjs` — structural invariants

**Verifies:** counterbalance.AC1.1, counterbalance.AC1.2, counterbalance.AC1.3

**Files:**
- Create: `c:\Users\david\Repos\counterbalance\tests\skill-structure.test.mjs` (unit — pure string + yaml parsing, no filesystem beyond reads)

**Implementation:**

Read `plugins/counterbalance/skills/counterbalance/SKILL.md` from disk, parse its frontmatter using `js-yaml` (counterbalance's sole runtime dep, already installed in Phase 1), and assert the structural invariants. Use the same frontmatter extraction regex the parser module uses (`/^---\r?\n([\s\S]*?)\r?\n---/`).

**Test style:** Anvil-style `node --test`, flat module-scope tests, AC-prefixed names.

**Required test blocks:**

- `counterbalance.AC1.1: SKILL.md has valid YAML frontmatter with required fields` — parse frontmatter, assert `name === "counterbalance"`, `description` is a non-empty string, `user-invocable === false`.
- `counterbalance.AC1.2: SKILL.md body contains Voice Discovery section` — assert body contains the literal string `"Voice Discovery"` (case-sensitive heading).
- `counterbalance.AC1.2: SKILL.md body contains Drafting Loop section` — assert body contains literal `"Drafting Loop"`.
- `counterbalance.AC1.2: SKILL.md body contains <- correction operator instructions` — assert body contains both `"<-"` AND the word `"correction"` within 500 characters of each other (heuristic: find the first `<-` index, slice ±250 chars, grep for `correction`).
- `counterbalance.AC1.3: references/fallback-voice.md exists on disk` — use `fs.stat` to assert the file exists and has non-zero size.
- `counterbalance.AC1.3: SKILL.md references fallback-voice.md` — assert body contains literal `"references/fallback-voice.md"`.

Path resolution: build absolute paths from `import.meta.url` (same pattern as `tests/manifests.test.mjs` in Phase 1) — do not rely on `process.cwd()`.

**Verification:**

```bash
node --test tests/skill-structure.test.mjs
```

Expected: all 6 test blocks pass, exit 0.

**Commit:** `test: assert SKILL.md structural invariants for AC1`
<!-- END_TASK_4 -->

<!-- START_TASK_5 -->
### Task 5: Phase verification and scratch cleanup

**Step 1: Run the full test suite**

```bash
node --test tests/
```

Expected: all tests from Phases 1, 2, and 3 pass.

**Step 2: Re-run `claude plugin validate .`**

```bash
claude plugin validate .
```

Expected: no errors, exit 0. The validator now walks into the new skill directory and checks `SKILL.md` frontmatter.

**Step 3: Clean up the scratch extraction**

```bash
rm -rf .scratch/
```

`.scratch/` is gitignored so this is local-only. The scratch artifacts served their purpose in Tasks 1-3 and can be discarded.

**Step 4: Confirm the `.skill` zip is no longer referenced anywhere in the committed repo**

```bash
grep -rI "ghost-writer.skill" plugins/ tests/ docs/design-plans/ docs/implementation-plans/ 2>/dev/null || echo "no references"
```

Expected: prints `no references` (or lines from the design doc that reference it historically — those are allowed, they're documentation of the prior state, not live references).

**No commit for this task — verification only.**
<!-- END_TASK_5 -->

---

## Phase 3 Done When

- `plugins/counterbalance/skills/counterbalance/SKILL.md` exists with `name: counterbalance`, `user-invocable: false`, and body containing Voice Discovery, Drafting Loop, `<-` operator, and CLAUDE.md pre-flight sections
- `plugins/counterbalance/skills/counterbalance/references/fallback-voice.md` exists and is linked from SKILL.md
- `tests/skill-structure.test.mjs` passes all 6 assertions
- `claude plugin validate .` passes
- `.scratch/` is cleaned up; `ghost-writer.skill` is not referenced anywhere in live plugin code
