# Counterbalance Phase 4: Drafting Workflow — Subagent and Commands

**Goal:** `/ghost` and `/voice-refresh` dispatch the counterbalance subagent end-to-end. Voice Discovery's CLAUDE.md pre-flight migration is wired and structurally enforced "never mutate CLAUDE.md."

**Architecture:** One subagent file (`agents/counterbalance.md`) with the full Drafting Loop and Voice Discovery modes embedded. Two command files (`commands/ghost.md`, `commands/voice-refresh.md`) that resolve the active profile via the Phase 2 resolver CLI and dispatch the subagent via the Task tool. The subagent's `tools:` frontmatter is explicit and scoped — no over-broad permissions.

**Tech Stack:** Markdown + YAML frontmatter. Agent is Claude Code's native subagent format. Commands use Claude Code's slash-command format (`description`, `allowed-tools`, `argument-hint`, body).

**Scope:** 4 of 8 phases.

**Codebase verified:** 2026-04-12. `commands/` and `agents/` directories do not exist yet. Anvil ships 17 agents (`C:\Users\david\Repos\old_anvil\agents\*.md`) but zero commands — counterbalance is the first in this lineage with slash commands, so command shape comes from Claude Code docs, not from Anvil. Anvil agent frontmatter uses only `name`, `description`, `model` — counterbalance additionally declares `tools:`, which is a documented but under-used Claude Code field and a deliberate divergence per the design doc for security scoping. Phase 3's `skills/counterbalance/SKILL.md` is the source of truth for the Drafting Loop and Voice Discovery prose — the agent body mirrors it directly rather than re-describing it.

---

## Acceptance Criteria Coverage

This phase implements and tests:

### counterbalance.AC3: Drafting workflow
- **counterbalance.AC3.1 Success:** `commands/ghost.md` exists with `description`, `allowed-tools`, and `argument-hint` frontmatter and dispatches the counterbalance subagent via Task
- **counterbalance.AC3.2 Success:** `/ghost` resolves the active voice profile via `lib/resolver.mjs` and passes the resolved profile to the subagent as context
- **counterbalance.AC3.3 Success:** `commands/voice-refresh.md` exists and dispatches the counterbalance subagent in Voice Discovery mode
- **counterbalance.AC3.4 Success:** `agents/counterbalance.md` body embeds the full Drafting Loop including the `<-` correction operator parsing rules
- **counterbalance.AC3.5 Success:** Subagent frontmatter declares tools explicitly as `Read, Write, Edit, Glob, Grep, Bash, AskUserQuestion, Task` — no over-broad permissions
- **counterbalance.AC3.6 Failure:** When no voice profile resolves and the user declines the CLAUDE.md import, the subagent uses `references/fallback-voice.md`

### counterbalance.AC4: Voice Discovery CLAUDE.md pre-flight migration
- **counterbalance.AC4.1 Success:** Voice Discovery scans `~/.claude/CLAUDE.md` for voice/writing/tone guidance before asking for samples (heading-agnostic detection)
- **counterbalance.AC4.2 Success:** When guidance is found, user is shown extracted content verbatim and the destination path before any write
- **counterbalance.AC4.3 Success:** On user acceptance, content is written to `~/.claude/plugins/data/counterbalance/profiles/default.md`
- **counterbalance.AC4.4 Success:** After import, user is instructed to remove the redundant section from CLAUDE.md themselves — plugin never mutates CLAUDE.md (verified by a grep test against agent/command/lib files)
- **counterbalance.AC4.5 Failure:** When user declines, normal sample-based Voice Discovery proceeds
- **counterbalance.AC4.6 Edge:** When CLAUDE.md has no voice guidance at all, pre-flight is a silent no-op

---

## External Dependency Findings

- ✓ Claude Code subagents live at `plugins/<plugin>/agents/<name>.md` by auto-discovery. Frontmatter fields: `name`, `description`, `model`, and optionally `tools` (comma-separated list) and `color`. Source: https://code.claude.com/docs/en/sub-agents.
- ✓ Slash commands live at `plugins/<plugin>/commands/<name>.md` by auto-discovery. Frontmatter fields: `description`, `allowed-tools`, `argument-hint`, `model`. Command body is a prompt-with-templating that Claude interprets at invocation time. `${CLAUDE_PLUGIN_ROOT}` is available inside commands to reference plugin-root-relative paths. Source: https://code.claude.com/docs/en/slash-commands.
- ✓ Subagents are invoked via the Task tool from a command body. The command body says something like "Use the Task tool to dispatch the counterbalance subagent with the following context: …" — the parent Claude interprets this as an instruction to call Task.
- ✓ `AskUserQuestion` is a built-in Claude Code tool available to any subagent that declares it — used by the CLAUDE.md pre-flight for the import-approval question.
- ⚠ The `tools` field on an agent is authoritative: declaring `tools: Read, Grep, Glob` means the agent *cannot* call `Write` or `Edit` — this is structural enforcement, not advisory. Verified by Claude Code's permission model. Used aggressively in Phase 5 (voice-reviewer) and moderately here (counterbalance drafter has Write/Edit because it needs to write voice profiles + potentially drafts to disk).

---

## Task Checklist

<!-- START_SUBCOMPONENT_A (tasks 1-2) -->
Author the drafting subagent with its two modes.

<!-- START_TASK_1 -->
### Task 1: `agents/counterbalance.md` — drafting subagent

**Verifies:** counterbalance.AC3.4, counterbalance.AC3.5, counterbalance.AC3.6, counterbalance.AC4.1, counterbalance.AC4.2, counterbalance.AC4.3, counterbalance.AC4.4, counterbalance.AC4.5, counterbalance.AC4.6

**Files:**
- Create: `c:\Users\david\Repos\counterbalance\plugins\counterbalance\agents\counterbalance.md`

**Implementation:**

The agent body is a prompt that Claude reads when the Task tool dispatches it. It embeds the full Drafting Loop and Voice Discovery modes. **Treat `skills/counterbalance/SKILL.md` as the canonical source** — the agent body should reference and mirror its prose, not diverge. When there's any doubt about what the Drafting Loop says at a given step, go back to SKILL.md.

**Frontmatter:**

```yaml
---
name: counterbalance
description: Use when drafting prose from notes in the user's voice, or when refreshing the active voice profile via Voice Discovery. Owns the Drafting Loop and Voice Discovery modes, including the CLAUDE.md pre-flight migration and the `<-` correction operator.
model: opus
tools: Read, Write, Edit, Glob, Grep, Bash, AskUserQuestion, Task
---
```

Notes on the frontmatter:

- `model: opus` — the drafter benefits from Opus-level language quality. The reviewer in Phase 5 uses Sonnet (cheaper for a structural read-only task).
- `tools: ` is exhaustive: `Read, Write, Edit, Glob, Grep, Bash, AskUserQuestion, Task`. **No `WebFetch`, no `WebSearch`** — the drafter should never pull content from the internet, which is how AI slop gets laundered into "voice" drafts. **No unrestricted tool access.** Match the exact comma-separated order from the design doc so the agent-wiring test can do an exact-string compare.
- `Task` is declared so the drafter can dispatch sub-investigations (e.g., dispatching a codebase-investigator when drafting a code-adjacent piece) — this matches Anvil's orchestration pattern.

**Body structure:**

```markdown
# Counterbalance Drafting Subagent

**Announce at start:** "I'm using the counterbalance subagent to draft in your voice."

## Modes

You operate in exactly one of two modes per invocation:

1. **Drafting Loop** — default when the invocation passes notes or a draft target.
2. **Voice Discovery** — entered when the invocation explicitly requests a voice-profile refresh, or when no voice profile resolves and samples must be gathered fresh.

The mode is set in the Task input. If ambiguous, ask the user via AskUserQuestion.

## Voice profile resolution

Before doing anything in either mode, resolve the active voice profile:

​```bash
node "${CLAUDE_PLUGIN_ROOT}/lib/resolver.mjs" --cwd="$PWD" --json
​```

The resolver prints JSON for a matched profile or the literal string `null`. Three layers, first-match-wins:

1. `./.counterbalance.md` (local override)
2. `./.claude/counterbalance.md` (project voice)
3. `$HOME/.claude/plugins/data/counterbalance/profiles/default.md` (user voice)

### When the resolver returns null

Try Voice Discovery mode first — but only if the caller didn't explicitly ask for Drafting. If the caller asked for Drafting and no profile resolves:

1. Attempt CLAUDE.md pre-flight (below). If it succeeds, re-run the resolver.
2. If CLAUDE.md pre-flight finds nothing or the user declines, load `${CLAUDE_PLUGIN_ROOT}/skills/counterbalance/references/fallback-voice.md` as the active voice guide for this session and proceed. **Never draft with no voice guidance at all.**

## Voice Discovery mode

### Step 1: CLAUDE.md pre-flight migration

Run exactly once at the top of Voice Discovery, before asking for samples:

1. Read `$HOME/.claude/CLAUDE.md`. If the file doesn't exist, skip to Step 2 (silent no-op).
2. Scan the file heading-agnostically for voice/writing/tone guidance. Match headings with regex `/voice|writing|tone|style|register|sentence/i`. Also treat a section as a candidate if its body mentions cadence, analogies, sentence structure, what to avoid, reading level, or length preferences.
3. If any candidate content is found, show the extracted content verbatim to the user alongside the destination path `$HOME/.claude/plugins/data/counterbalance/profiles/default.md`. Ask via AskUserQuestion: "Found voice guidance in your CLAUDE.md. Import it as your counterbalance default profile?" with options: "Yes, import", "No, skip import".
4. On **Yes, import**: create parent directories as needed (`mkdir -p "$HOME/.claude/plugins/data/counterbalance/profiles"`), write the extracted content to the destination file, then tell the user: "Imported to `$HOME/.claude/plugins/data/counterbalance/profiles/default.md`. Please remove the imported section from `~/.claude/CLAUDE.md` yourself — this plugin will never mutate CLAUDE.md."
5. On **No, skip import** (or if Step 2 found nothing): continue to Step 2 of Voice Discovery (sample gathering). Silent no-op if nothing was found.

**NEVER mutate CLAUDE.md.** Do not Write or Edit against any path matching `CLAUDE.md`, `~/.claude/CLAUDE.md`, or `$HOME/.claude/CLAUDE.md`. This is enforced structurally by `tests/claude-md-invariant.test.mjs` (see Task 4 below).

### Step 2: Sample gathering

[Mirror the equivalent section from SKILL.md verbatim.]

### Step 3: Voice profile synthesis

[Mirror the equivalent section from SKILL.md verbatim. Write the synthesized profile to whichever layer the user indicated — default to user layer `$HOME/.claude/plugins/data/counterbalance/profiles/default.md`.]

## Drafting Loop mode

[Mirror the full Drafting Loop from SKILL.md verbatim: intake → silent analysis → draft → correction handling → supporting structure → grammar check.]

### `<-` correction operator

[Mirror the operator parsing rules from SKILL.md verbatim. The rule that matters for tests: any line that starts with `<-` is a correction directive, not new content.]

## Fallback behavior

If the resolved voice profile is null AND CLAUDE.md pre-flight produced nothing AND the user declined or skipped import, use `${CLAUDE_PLUGIN_ROOT}/skills/counterbalance/references/fallback-voice.md`. Read it, treat it as the active voice guide, and proceed with drafting. Cite the fallback in your final report so the user knows you didn't use a real profile.
```

**Why the agent body references `SKILL.md` content rather than duplicating it verbatim in this plan:** two copies of the same prose drift over time. The agent file is the one Claude actually loads; the skill file is the documentation-and-reference version. Duplicate only the minimum needed to make the agent self-contained. At implementation time, copy the exact sections listed `[in brackets]` above from `plugins/counterbalance/skills/counterbalance/SKILL.md`.

**Note on nested fenced code blocks in this plan:** the body snippet above uses `​```bash` (with a leading zero-width space) to escape nested triple-backticks inside this markdown document. When authoring the actual agent file, **strip the zero-width space** — the written file should contain plain triple-backtick fences. The same note applies to every command/agent body quoted in Phases 4 and 5.

**Testing:**

No unit test for the agent body itself — it's prose that Claude interprets at runtime. Structural assertions live in Task 4 (agent-wiring.test.mjs) and Task 5 (claude-md-invariant.test.mjs).

**Verification:**

```bash
head -8 plugins/counterbalance/agents/counterbalance.md
```

Expected: frontmatter block with `name: counterbalance`, `tools: Read, Write, Edit, Glob, Grep, Bash, AskUserQuestion, Task` (exact order).

**Commit:** `feat: add counterbalance drafting subagent`
<!-- END_TASK_1 -->

<!-- START_TASK_2 -->
### Task 2: `commands/ghost.md` — drafting entry point

**Verifies:** counterbalance.AC3.1, counterbalance.AC3.2

**Files:**
- Create: `c:\Users\david\Repos\counterbalance\plugins\counterbalance\commands\ghost.md`

**Implementation:**

Slash commands in Claude Code are markdown files with frontmatter + a prompt body. The body is interpreted as instructions to the parent Claude session — you instruct it to resolve the voice profile, then dispatch the counterbalance subagent via the Task tool. The parent session has access to `Task`, `Read`, `Bash`, `Glob` per `allowed-tools`.

**Frontmatter:**

```yaml
---
description: Draft prose in your voice from notes, dictation, or rough bullets via the counterbalance drafting subagent.
allowed-tools: Task, Read, Bash, Glob
argument-hint: "[notes-file-or-inline-notes]"
---
```

**Body:**

```markdown
You are dispatching the counterbalance drafting subagent. Follow these steps exactly.

## Step 1: Resolve the active voice profile

Run the counterbalance resolver to find the active voice profile:

​```bash
node "${CLAUDE_PLUGIN_ROOT}/lib/resolver.mjs" --cwd="$PWD" --json
​```

Capture the JSON output. If the resolver prints the literal string `null`, there is no resolved profile — note this and pass it along in Step 3.

## Step 2: Load the input notes

The user's notes are in `$ARGUMENTS`. Interpret them as one of:

- A file path → read the file contents with Read
- Inline text → treat the argument itself as the notes
- Empty → ask the user via AskUserQuestion what to draft (or abort cleanly)

## Step 3: Dispatch the counterbalance subagent

Use the Task tool to dispatch the `counterbalance` subagent in **Drafting Loop** mode. Pass these fields in the Task prompt:

- `mode`: `"drafting"`
- `notes`: the text from Step 2
- `resolved_profile`: the JSON from Step 1 (or `null`)
- `cwd`: `$PWD`

Relay the subagent's output back to the user unchanged.

## Step 4: If the subagent reports it fell back to `references/fallback-voice.md`

Surface this to the user: "No voice profile resolved. Drafted using the fallback voice guide at `references/fallback-voice.md`. Run `/voice-refresh` to set up a real profile."
```

**Key elements the agent-wiring test will assert:**

1. Frontmatter parses and contains `description`, `allowed-tools`, `argument-hint`.
2. `allowed-tools` includes `Task`.
3. Body references `lib/resolver.mjs` literally.
4. Body instructs dispatching the `counterbalance` subagent literally (by name).
5. Body passes `resolved_profile` (the AC3.2 invariant).

**Verification:**

```bash
head -5 plugins/counterbalance/commands/ghost.md
grep -q "lib/resolver.mjs" plugins/counterbalance/commands/ghost.md && echo "resolver wired"
grep -q "counterbalance subagent" plugins/counterbalance/commands/ghost.md && echo "subagent wired"
```

Expected: frontmatter visible, both greps print confirmation.

**Commit:** `feat: add /ghost command`
<!-- END_TASK_2 -->
<!-- END_SUBCOMPONENT_A -->

<!-- START_TASK_3 -->
### Task 3: `commands/voice-refresh.md` — Voice Discovery entry point

**Verifies:** counterbalance.AC3.3

**Files:**
- Create: `c:\Users\david\Repos\counterbalance\plugins\counterbalance\commands\voice-refresh.md`

**Implementation:**

Same shape as `/ghost` but dispatches the subagent in Voice Discovery mode instead of Drafting Loop mode. `/voice-refresh` takes no arguments (or an optional layer selector — punt on that for v1).

**Frontmatter:**

```yaml
---
description: Re-run Voice Discovery against the active voice profile. Includes the CLAUDE.md pre-flight migration on first run.
allowed-tools: Task, Read, Bash
argument-hint: "(no arguments)"
---
```

**Body:**

```markdown
You are dispatching the counterbalance subagent in Voice Discovery mode.

## Step 1: Resolve the current active profile (for context, not gating)

​```bash
node "${CLAUDE_PLUGIN_ROOT}/lib/resolver.mjs" --cwd="$PWD" --json
​```

Capture the JSON output. Voice Discovery runs regardless — this step is purely informational (so the subagent can show the user what's currently active).

## Step 2: Dispatch the counterbalance subagent

Use the Task tool to dispatch the `counterbalance` subagent in **Voice Discovery** mode:

- `mode`: `"voice-discovery"`
- `current_profile`: the JSON from Step 1 (or `null`)
- `cwd`: `$PWD`

The subagent will run the CLAUDE.md pre-flight migration as its first step, then proceed to sample gathering (or skip sample gathering if the user accepted the CLAUDE.md import and the synthesized profile is sufficient).
```

**Verification:**

```bash
grep -q "Voice Discovery" plugins/counterbalance/commands/voice-refresh.md && echo "mode wired"
grep -q "counterbalance" plugins/counterbalance/commands/voice-refresh.md && echo "subagent wired"
```

Expected: both print confirmation.

**Commit:** `feat: add /voice-refresh command`
<!-- END_TASK_3 -->

<!-- START_SUBCOMPONENT_B (tasks 4-5) -->
Structural tests that enforce agent + command wiring invariants.

<!-- START_TASK_4 -->
### Task 4: `tests/claude-md-invariant.test.mjs` — never-mutate-CLAUDE.md grep test

**Verifies:** counterbalance.AC4.4

**Files:**
- Create: `c:\Users\david\Repos\counterbalance\tests\claude-md-invariant.test.mjs` (unit — string search over fs)

**Implementation:**

Walk every file under `plugins/counterbalance/agents/`, `plugins/counterbalance/commands/`, and `plugins/counterbalance/lib/`, read it as text, and assert **none** of them contain a Write or Edit invocation against `CLAUDE.md` paths.

**What constitutes a violation** (the grep patterns the test must detect as forbidden):

1. The literal string `CLAUDE.md` appearing on the same line as `Write`, `writeFile`, `fs.writeFile`, `Edit`, or `overwrite`.
2. The string `"$HOME/.claude/CLAUDE.md"` or `"~/.claude/CLAUDE.md"` appearing as an argument to any write/edit operation.

**What's NOT a violation** (allowed):

- The invariant statement itself, which IS the literal `"NEVER mutate CLAUDE.md"` — this must be present in `agents/counterbalance.md`, so the test should find that exact string and exclude it from the violation scan.
- References to `CLAUDE.md` in the context of Read-only operations (the pre-flight reads CLAUDE.md, which is fine).

**Algorithm:**

```text
1. Collect all files under plugins/counterbalance/{agents,commands,lib}/
2. For each file:
   a. Read as UTF-8 string
   b. Find all occurrences of "CLAUDE.md" in the text
   c. For each occurrence, take a ±60 character window
   d. If the window matches /\b(Write|writeFile|fs\.writeFile|Edit|overwrite)\b/ → VIOLATION
3. Assert the violation list is empty
4. Separately: assert that plugins/counterbalance/agents/counterbalance.md contains the literal string "NEVER mutate CLAUDE.md"
```

**Test blocks:**

- `counterbalance.AC4.4: no agent/command/lib file writes to CLAUDE.md` — assert violation list is empty.
- `counterbalance.AC4.4: counterbalance.md declares the invariant literally` — assert the "NEVER mutate CLAUDE.md" string exists in the agent body.

**Verification:**

```bash
node --test tests/claude-md-invariant.test.mjs
```

Expected: 2 test blocks pass.

**Commit:** `test: enforce never-mutate-CLAUDE.md invariant`
<!-- END_TASK_4 -->

<!-- START_TASK_5 -->
### Task 5: `tests/agent-wiring.test.mjs` — agent + command structural assertions

**Verifies:** counterbalance.AC3.1, counterbalance.AC3.2, counterbalance.AC3.3, counterbalance.AC3.4, counterbalance.AC3.5, counterbalance.AC3.6, counterbalance.AC4.1, counterbalance.AC4.2, counterbalance.AC4.3, counterbalance.AC4.5, counterbalance.AC4.6

**Files:**
- Create: `c:\Users\david\Repos\counterbalance\tests\agent-wiring.test.mjs` (unit)

**Implementation:**

Parse the agent frontmatter and each command file's frontmatter with `js-yaml`. Assert structural invariants.

**Required test blocks (one per AC case where feasible; some cases share a test):**

Agent frontmatter:

- `counterbalance.AC3.5: counterbalance agent tools field is exactly "Read, Write, Edit, Glob, Grep, Bash, AskUserQuestion, Task"` — parse frontmatter, compare `tools` string literally. No over-broad permissions.
- `agent frontmatter has name === "counterbalance", model === "opus", description is non-empty`

Agent body:

- `counterbalance.AC3.4: agent body contains "Drafting Loop"`
- `counterbalance.AC3.4: agent body contains "<-" correction operator instruction` — same heuristic as Phase 3 (within 500 chars of the word "correction")
- `counterbalance.AC3.6: agent body references fallback-voice.md as the null-profile fallback path`
- `counterbalance.AC4.1: agent body references scanning $HOME/.claude/CLAUDE.md`
- `counterbalance.AC4.1: agent body declares heading-agnostic matching` — body contains the literal substring `heading-agnostic` (case-insensitive)
- `counterbalance.AC4.2: agent body instructs showing extracted content verbatim before any write` — body contains both "verbatim" and "AskUserQuestion" within 500 chars of each other
- `counterbalance.AC4.3: agent body references destination $HOME/.claude/plugins/data/counterbalance/profiles/default.md`
- `counterbalance.AC4.5: agent body has a decline-proceeds-normally branch` — body contains "No, skip import" or "declines" AND mentions proceeding to sample gathering
- `counterbalance.AC4.6: agent body says pre-flight is a silent no-op when CLAUDE.md has no voice guidance` — body contains "silent no-op"

`/ghost` command:

- `counterbalance.AC3.1: commands/ghost.md has description, allowed-tools, argument-hint` — parse frontmatter, assert all three keys present with non-empty values
- `counterbalance.AC3.1: commands/ghost.md allowed-tools includes Task`
- `counterbalance.AC3.1: commands/ghost.md dispatches counterbalance subagent` — body contains literal "counterbalance subagent" or "dispatch the `counterbalance` subagent"
- `counterbalance.AC3.2: commands/ghost.md invokes lib/resolver.mjs` — body contains literal "lib/resolver.mjs"
- `counterbalance.AC3.2: commands/ghost.md passes resolved_profile to subagent` — body contains literal "resolved_profile"

`/voice-refresh` command:

- `counterbalance.AC3.3: commands/voice-refresh.md exists and has valid frontmatter`
- `counterbalance.AC3.3: commands/voice-refresh.md dispatches counterbalance subagent in Voice Discovery mode` — body contains both "counterbalance" and "Voice Discovery" (case-sensitive)

**Path resolution:** build all paths from `import.meta.url` so tests work regardless of `cwd`.

**Verification:**

```bash
node --test tests/agent-wiring.test.mjs
```

Expected: all 15 or so test blocks pass.

**Commit:** `test: enforce agent and command wiring invariants for AC3 and AC4`
<!-- END_TASK_5 -->
<!-- END_SUBCOMPONENT_B -->

<!-- START_TASK_6 -->
### Task 6: Phase verification

**Step 1: Full suite**

```bash
node --test tests/
```

Expected: all tests from Phases 1-4 pass.

**Step 2: Re-run `claude plugin validate .`**

```bash
claude plugin validate .
```

Expected: validator accepts the new agent and two commands. If you see `YAML frontmatter failed to parse`, fix the failing file before proceeding — commonly caused by unescaped backticks or colons in the `description` field.

**Step 3: Structural smoke test**

Confirm the plugin layout is what Claude Code expects to auto-discover:

```bash
ls plugins/counterbalance/agents/
ls plugins/counterbalance/commands/
```

Expected: `counterbalance.md` in agents/, `ghost.md` and `voice-refresh.md` in commands/. No extra files.

**No commit for this task — verification only.**
<!-- END_TASK_6 -->

---

## Phase 4 Done When

- All tests from `tests/agent-wiring.test.mjs` and `tests/claude-md-invariant.test.mjs` pass
- `plugins/counterbalance/agents/counterbalance.md` exists with the full Drafting Loop, Voice Discovery mode, CLAUDE.md pre-flight, and `<-` operator sections
- `plugins/counterbalance/commands/ghost.md` and `voice-refresh.md` exist and wire through the resolver + Task tool
- `claude plugin validate .` passes
- Every AC3.* and AC4.* case has at least one corresponding test assertion
