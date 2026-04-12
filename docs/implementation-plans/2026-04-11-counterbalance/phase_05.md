# Counterbalance Phase 5: Reviewer Pipeline

**Goal:** `/voice-check` dispatches a read-only `voice-reviewer` subagent that emits structured findings against the active voice profile. The reviewer slot is a verified extension point — a fixture test proves that adding a stub second reviewer requires zero changes to existing files.

**Architecture:** Three new files under `plugins/counterbalance/`: `lib/reviewers.mjs` (registry loader + applicability), `reviewers.json` (registry config), `agents/voice-reviewer.md` (read-only subagent), `commands/voice-check.md` (slash-command dispatcher). The reviewer contract — `ReviewerInput`/`ReviewerOutput`/`Finding` — is honored by the subagent's output format and by the applicability logic.

**Tech Stack:** Same as prior phases — Node 22+, ESM `.mjs`, `js-yaml`. `lib/reviewers.mjs` uses `node:path.matchesGlob` (stable in Node 22.20.0) for file-pattern applicability.

**Scope:** 5 of 8 phases.

**Codebase verified:** 2026-04-12. Anvil ships `lib/applicability.mjs` (158 lines, exports `resolveApplicability(reviewerConfig, changedFiles)` returning `"applicable" | "not-applicable" | "judgment-needed"` — see `C:\Users\david\Repos\old_anvil\lib\applicability.mjs:19-34`). Counterbalance lifts the pattern (array of globs + `path.matchesGlob` match) but adapts the API to "which reviewers apply to this single file?" rather than "is this reviewer applicable given a diff?"

---

## Acceptance Criteria Coverage

This phase implements and tests:

### counterbalance.AC5: Reviewer pipeline (/voice-check)
- **counterbalance.AC5.1 Success:** `commands/voice-check.md` exists and dispatches the voice-reviewer subagent via Task
- **counterbalance.AC5.2 Success:** `agents/voice-reviewer.md` frontmatter scopes tools to `Read, Grep, Glob` only — no Write, no Edit, no Bash
- **counterbalance.AC5.3 Success:** voice-reviewer returns findings matching the structured contract: `{reviewer, findings: [{line, severity, rule, quote, message, suggested}]}`
- **counterbalance.AC5.4 Success:** Findings are rendered to the caller as an annotated markdown block with line references and quoted offending text
- **counterbalance.AC5.5 Edge:** Empty draft produces an empty findings list, not an error

### counterbalance.AC6: Reviewer extension point
- **counterbalance.AC6.1 Success:** `reviewers.json` registry lists voice-check with applicability rules (`**/*.md`, `**/*.mdx`)
- **counterbalance.AC6.2 Success:** `lib/reviewers.mjs` enumerates applicable reviewers for a given file path
- **counterbalance.AC6.3 Success:** Fixture test verifies that adding a stub second reviewer (new agent file + new command file + new registry entry) requires zero changes to existing files

Note: `counterbalance.AC6.4 Documented` (README "how to add a reviewer" section) lands in Phase 8 alongside the rest of the README work. It's listed here for completeness but not verified until then.

---

## External Dependency Findings

- ✓ `node:path.matchesGlob(path, pattern)` is stable in Node 22.20.0 (marked stable in v22.20.0 / v24.8.0 per the Node changelog). Signature: `(path: string, pattern: string) → boolean`. Throws `TypeError` on non-string args. **Windows gotcha carries over:** if `filePath` contains backslashes and `pattern` uses forward slashes, the match silently fails. Normalize via `toForwardSlashes` from Phase 2 before matching.
- ✓ Anvil's `lib/applicability.mjs:19-34` uses `path.matchesGlob(file, pattern)` directly (see extracted code block in the Phase 2 investigation). Same pattern works for counterbalance.
- N/A external library research — no new deps introduced.

---

## Task Checklist

<!-- START_SUBCOMPONENT_A (tasks 1-2) -->
Registry config + loader.

<!-- START_TASK_1 -->
### Task 1: `reviewers.json` — registry config

**Verifies:** counterbalance.AC6.1

**Files:**
- Create: `c:\Users\david\Repos\counterbalance\plugins\counterbalance\reviewers.json`

**Implementation:**

A single JSON file listing every reviewer. v1 has one entry; the design is optimized for "adding a second reviewer is a new file + new entry" (Task 6).

```json
{
    "reviewers": [
        {
            "id": "voice-check",
            "agent": "counterbalance:voice-reviewer",
            "command": "/counterbalance:voice-check",
            "applies_to": [
                "**/*.md",
                "**/*.mdx"
            ],
            "description": "Checks a draft against the active voice profile and flags violations as line-referenced findings."
        }
    ]
}
```

**Notes on the shape:**

- `id` is the unique slug used in `ReviewerOutput.reviewer` — must match `output.reviewer` at runtime.
- `agent` uses the Claude Code namespaced syntax `plugin:agent-name` so a future multi-reviewer plugin can disambiguate.
- `command` is the user-facing slash command with the same namespacing convention.
- `applies_to` is a plain array of globs. No `"always"` or `"judgment"` special strings (Anvil uses those — counterbalance doesn't need them for v1).
- `description` is documentation-only; the registry loader doesn't consume it.

**Verification:**

```bash
node -e "console.log(JSON.parse(require('node:fs').readFileSync('plugins/counterbalance/reviewers.json','utf8')))"
```

Expected: prints the parsed object, no JSON parse errors.

**Commit:** `feat: add reviewers.json registry with voice-check entry`
<!-- END_TASK_1 -->

<!-- START_TASK_2 -->
### Task 2: `lib/reviewers.mjs` — registry loader and applicability

**Verifies:** counterbalance.AC6.2

**Files:**
- Create: `c:\Users\david\Repos\counterbalance\plugins\counterbalance\lib\reviewers.mjs`
- Test: `c:\Users\david\Repos\counterbalance\tests\reviewers.test.mjs` (unit)

**Implementation:**

**Attribution header:**

```js
// Applicability matching inspired by Anvil's lib/applicability.mjs.
// https://github.com/david-evan-lovett/anvil — SPDX-License-Identifier: MIT
// Counterbalance adapts the "any-of globs" pattern for per-file reviewer enumeration
// rather than reviewer-vs-diff resolution.
```

**Exports:**

- `loadRegistry(pluginRoot) → Promise<Registry>` — reads `${pluginRoot}/reviewers.json` and returns the parsed object. Throws a clear error on unreadable file or malformed JSON (**don't** swallow these — a broken registry should halt the reviewer pipeline loudly, not silently).
- `applicableReviewers(registry, filePath) → Reviewer[]` — returns every reviewer from `registry.reviewers` whose `applies_to` globs match `filePath`. Normalizes `filePath` via `toForwardSlashes` from `windows-path.mjs` before matching. Returns `[]` when nothing matches.
- `aggregateFindings(outputs) → ReviewerOutput[]` — stub for v2 multi-reviewer runs. v1 has one reviewer so this is effectively an identity passthrough. Export it so the shape is established early.

**Code sketch:**

```js
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { toForwardSlashes } from './windows-path.mjs';

export async function loadRegistry(pluginRoot) {
    const registryPath = path.join(pluginRoot, 'reviewers.json');
    let content;
    try {
        content = await readFile(registryPath, 'utf8');
    } catch (err) {
        throw new Error(`[counterbalance] reviewer registry unreadable at ${registryPath}: ${err.message}`);
    }
    let parsed;
    try {
        parsed = JSON.parse(content);
    } catch (err) {
        throw new Error(`[counterbalance] reviewer registry has malformed JSON at ${registryPath}: ${err.message}`);
    }
    if (!parsed || !Array.isArray(parsed.reviewers)) {
        throw new Error(`[counterbalance] reviewer registry missing "reviewers" array at ${registryPath}`);
    }
    return parsed;
}

export function applicableReviewers(registry, filePath) {
    const normalized = toForwardSlashes(filePath);
    return registry.reviewers.filter(reviewer => {
        const patterns = reviewer.applies_to ?? [];
        return patterns.some(pattern => path.matchesGlob(normalized, pattern));
    });
}

export function aggregateFindings(outputs) {
    // v1 stub — multi-reviewer aggregation lands in v2.
    return outputs;
}
```

**Testing:**

Tests must verify each AC listed above:

- `counterbalance.AC6.2: applicableReviewers matches voice-check on .md files` — build a registry in-memory with the voice-check entry, call `applicableReviewers(registry, 'docs/foo.md')`, assert the returned array contains exactly the voice-check entry.
- `counterbalance.AC6.2: applicableReviewers matches voice-check on .mdx files`
- `counterbalance.AC6.2: applicableReviewers returns empty on non-matching extension` — pass `'src/foo.ts'`, assert `[]`.
- `counterbalance.AC6.2: applicableReviewers normalizes Windows backslash paths` — pass `'docs\\foo.md'` as input, assert the match still succeeds (uses the Phase 2 `toForwardSlashes` helper).
- `loadRegistry parses the shipped reviewers.json successfully` — read the real file from disk, assert `registry.reviewers[0].id === 'voice-check'`.
- `loadRegistry throws a clear error on missing registry file`
- `loadRegistry throws a clear error on malformed JSON`
- `loadRegistry throws a clear error when the reviewers array is missing`

**Verification:**

```bash
node --test tests/reviewers.test.mjs
```

Expected: all 8 test blocks pass.

**Commit:** `feat: add reviewer registry loader and applicability`
<!-- END_TASK_2 -->
<!-- END_SUBCOMPONENT_A -->

<!-- START_SUBCOMPONENT_B (tasks 3-4) -->
Read-only subagent + its command.

<!-- START_TASK_3 -->
### Task 3: `agents/voice-reviewer.md` — read-only reviewer subagent

**Verifies:** counterbalance.AC5.2, counterbalance.AC5.3, counterbalance.AC5.4, counterbalance.AC5.5

**Files:**
- Create: `c:\Users\david\Repos\counterbalance\plugins\counterbalance\agents\voice-reviewer.md`

**Implementation:**

**Frontmatter:**

```yaml
---
name: voice-reviewer
description: Use when reviewing a draft against the active voice profile. Produces line-referenced findings in a structured contract. Never rewrites — review only.
model: sonnet
tools: Read, Grep, Glob
---
```

**Critical:** `tools: Read, Grep, Glob` is exhaustive. **No `Write`, no `Edit`, no `Bash`, no `WebFetch`, no `WebSearch`, no `Task`.** Exact comma-separated order for test compatibility. This is structural enforcement — declaring the tools field means the subagent literally cannot call the undeclared tools at runtime. The reviewer is critic-only by construction, not by instruction.

**Body:**

```markdown
# Voice Reviewer Subagent

**Announce at start:** "I'm using the voice-reviewer subagent to review this draft against your voice profile. I will not rewrite."

## Your job

Read a draft. Compare against the active voice profile. Return a structured findings list. **Never rewrite.** You do not have Write or Edit tools. Do not suggest rewrites in free prose — put suggestions in the `suggested` field of each finding, where they belong.

## Input contract

You receive a Task prompt containing:

- `draft`: the text to review (string)
- `filePath`: optional path to the draft's source file (string | undefined)
- `voiceProfile`: the resolved VoiceProfile JSON from `lib/resolver.mjs`, or `null`

If `voiceProfile` is null, fall back to `${CLAUDE_PLUGIN_ROOT}/skills/counterbalance/references/fallback-voice.md` — read it with the Read tool.

## Review protocol

1. **Read the voice profile body** (either from `voiceProfile.body` or the fallback file).
2. **Read the draft** — either from `draft` string or by Reading `filePath` if the draft was passed by path.
3. **Walk the draft line by line.** For each line, check for violations of the voice profile's rules. Focus on concrete, testable violations — not subjective "vibes."
4. **Build a Finding for each violation:**
   - `line`: 1-indexed line number
   - `severity`: "violation" | "warning" | "note"
   - `rule`: machine-readable rule id (e.g., "no-em-dash-overuse", "no-ai-slop-pattern")
   - `quote`: the exact offending text from the draft, quoted verbatim
   - `message`: human-readable explanation of why this violates the voice profile
   - `suggested`: (optional) a suggested rewrite hint — a phrase, not a full sentence

## Output contract

Return a JSON-shaped object matching:

​```json
{
    "reviewer": "voice-check",
    "findings": [
        {
            "line": 12,
            "severity": "violation",
            "rule": "no-em-dash-overuse",
            "quote": "— a thing that — another thing",
            "message": "Three em-dashes in one sentence. Voice profile flags this as a tell.",
            "suggested": "split into two sentences"
        }
    ]
}
​```

**Edge case: empty draft.** If the draft is empty, zero-length, or whitespace-only, return:

​```json
{ "reviewer": "voice-check", "findings": [] }
​```

This is NOT an error. An empty draft has zero violations by definition. Return the empty findings list and exit cleanly.

## Rendering to the user

After you have the structured output, also produce a user-facing rendered view in this markdown format:

​```markdown
### Voice check findings — 3 total

**Line 12** — `violation` — _no-em-dash-overuse_
> — a thing that — another thing

Three em-dashes in one sentence. Voice profile flags this as a tell.
→ Suggested: split into two sentences

**Line 17** — `warning` — _oily-cadence_
> ...
​```

If the findings list is empty, render:

​```markdown
### Voice check findings — none

No violations found. The draft aligns with the active voice profile.
​```

## Never rewrite

You do not have Write or Edit. If you feel the urge to rewrite, put that urge into a `suggested` field on a finding. **A reviewer that rewrites is a drafter that forgot its job.**
```

**Verification:**

```bash
head -8 plugins/counterbalance/agents/voice-reviewer.md
```

Expected: frontmatter shows `tools: Read, Grep, Glob` — verify literally that `Write`, `Edit`, and `Bash` do NOT appear anywhere in the frontmatter block.

**Commit:** `feat: add voice-reviewer subagent with read-only tool scope`
<!-- END_TASK_3 -->

<!-- START_TASK_4 -->
### Task 4: `commands/voice-check.md` — `/voice-check` entry point

**Verifies:** counterbalance.AC5.1

**Files:**
- Create: `c:\Users\david\Repos\counterbalance\plugins\counterbalance\commands\voice-check.md`

**Implementation:**

**Frontmatter:**

```yaml
---
description: Review a draft against the active voice profile. Returns line-referenced findings. Does not rewrite.
allowed-tools: Task, Read, Bash, Glob
argument-hint: "[draft-file-or-inline-text]"
---
```

**Body:**

```markdown
You are dispatching the counterbalance voice-reviewer subagent. Follow these steps exactly.

## Step 1: Resolve the active voice profile

​```bash
node "${CLAUDE_PLUGIN_ROOT}/lib/resolver.mjs" --cwd="$PWD" --json
​```

Capture the JSON output. If the resolver prints `null`, the voice-reviewer will fall back to `references/fallback-voice.md`. Note this for the user in Step 4.

## Step 2: Load the draft

The draft is in `$ARGUMENTS`. Interpret as one of:

- A file path → use Read to get the contents, keep the path for `filePath`
- Inline text → use the argument text directly as `draft`, leave `filePath` undefined
- Empty → ask the user via AskUserQuestion for a draft file or abort

## Step 3: Dispatch the voice-reviewer subagent

Use the Task tool to dispatch the `voice-reviewer` subagent with:

- `draft`: the draft text from Step 2
- `filePath`: the source file path, or undefined
- `voiceProfile`: the resolved profile JSON from Step 1, or `null`

The subagent will return a structured JSON output and a markdown-rendered view.

## Step 4: Relay output

Print the rendered markdown view to the user. If the active profile was null and the subagent fell back, append a note: "No voice profile resolved for this directory. Reviewed against `references/fallback-voice.md`. Run `/voice-refresh` to set up a real profile."

If the findings list is empty, make sure the user sees the "No violations found" message — don't swallow it.
```

**Verification:**

```bash
grep -q "voice-reviewer" plugins/counterbalance/commands/voice-check.md && echo "subagent wired"
grep -q "lib/resolver.mjs" plugins/counterbalance/commands/voice-check.md && echo "resolver wired"
grep -q "Task" plugins/counterbalance/commands/voice-check.md && echo "Task tool referenced"
```

Expected: all three print confirmation.

**Commit:** `feat: add /voice-check command`
<!-- END_TASK_4 -->
<!-- END_SUBCOMPONENT_B -->

<!-- START_SUBCOMPONENT_C (tasks 5-6) -->
Tests that enforce the read-only contract and the extensibility property.

<!-- START_TASK_5 -->
### Task 5: `tests/voice-reviewer-wiring.test.mjs` — structural assertions

**Verifies:** counterbalance.AC5.1, counterbalance.AC5.2, counterbalance.AC5.3, counterbalance.AC5.4, counterbalance.AC5.5

**Files:**
- Create: `c:\Users\david\Repos\counterbalance\tests\voice-reviewer-wiring.test.mjs` (unit)

**Implementation:**

Parse frontmatter and body of `agents/voice-reviewer.md` and `commands/voice-check.md`. Assert structural invariants.

**Required test blocks:**

- `counterbalance.AC5.2: voice-reviewer tools field is exactly "Read, Grep, Glob"` — parse frontmatter, compare literally.
- `counterbalance.AC5.2: voice-reviewer does NOT declare Write, Edit, or Bash in tools` — assert none of those substrings appear in the tools field. This is the structural enforcement of the read-only contract.
- `counterbalance.AC5.1: commands/voice-check.md exists with description, allowed-tools, argument-hint`
- `counterbalance.AC5.1: commands/voice-check.md allowed-tools includes Task`
- `counterbalance.AC5.1: commands/voice-check.md dispatches voice-reviewer subagent` — body contains literal "voice-reviewer"
- `counterbalance.AC5.3: voice-reviewer body documents the output contract {reviewer, findings: [{line, severity, rule, quote, message, suggested}]}` — body contains each of those seven field names (`reviewer`, `findings`, `line`, `severity`, `rule`, `quote`, `message`, `suggested`). **Scope the assertion to the JSON example fence region** — extract the content between the first ` ```json ` and its closing ` ``` ` in the "Output contract" section and assert each name appears inside that slice. This avoids false-positives from the field names being mentioned in surrounding prose.
- `counterbalance.AC5.4: voice-reviewer body documents the rendered markdown output format` — body contains literal "### Voice check findings"
- `counterbalance.AC5.5: voice-reviewer body handles empty draft as empty findings, not error` — body contains literal "empty draft" (case-insensitive) near "empty findings" or "zero violations"

**Verification:**

```bash
node --test tests/voice-reviewer-wiring.test.mjs
```

Expected: all test blocks pass.

**Commit:** `test: enforce voice-reviewer contract invariants`
<!-- END_TASK_5 -->

<!-- START_TASK_6 -->
### Task 6: `tests/reviewer-extensibility.test.mjs` — fixture test for the extension point

**Verifies:** counterbalance.AC6.3

**Files:**
- Create: `c:\Users\david\Repos\counterbalance\tests\reviewer-extensibility.test.mjs` (integration — copies plugin files into a temp dir)

**Implementation:**

This is the load-bearing test that verifies the reviewer slot is a real extension point. The property under test: **adding a second reviewer (new agent file + new command file + new `reviewers.json` entry) must require zero changes to any existing file.**

**Algorithm:**

1. Create a temp dir via `fs.mkdtemp`.
2. Copy the entire `plugins/counterbalance/` tree to `$tmp/plugins/counterbalance/` using `fs.cp` with `{ recursive: true }`.
3. Record the sha256 hashes of every file under `$tmp/plugins/counterbalance/` (except `reviewers.json`, which will change legitimately). Call this `beforeHashes`.
4. Write a stub second reviewer:
   - `$tmp/plugins/counterbalance/agents/stub-reviewer.md` — valid frontmatter with `name: stub-reviewer`, `model: sonnet`, `tools: Read, Grep, Glob`, minimal body `"Stub reviewer for extensibility test."`
   - `$tmp/plugins/counterbalance/commands/stub-check.md` — valid frontmatter with `description`, `allowed-tools: Task`, `argument-hint: "[draft]"`, minimal body
   - Append a second entry to `$tmp/plugins/counterbalance/reviewers.json` for `stub-check`
5. Re-hash every file in `$tmp/plugins/counterbalance/` except `reviewers.json`, `agents/stub-reviewer.md`, `commands/stub-check.md`. Call this `afterHashes`.
6. Assert `beforeHashes` equals `afterHashes` — no existing file was touched to add the stub reviewer.
7. Additionally: run `loadRegistry($tmp/plugins/counterbalance)` and `applicableReviewers(registry, 'foo.md')` — assert the returned array has **two** entries (voice-check + stub-check), proving the enumeration picks up the new reviewer with no code changes.

**Why this is the right test:** If the extensibility property ever breaks (e.g., someone hardcodes the voice-check reviewer into `lib/reviewers.mjs` or into a command body), this test will fail because either the hash of the edited file changes, or the enumeration will fail to pick up the stub entry. The test is a structural tripwire for the plugin's core architectural claim.

**Test blocks:**

- `counterbalance.AC6.3: adding a stub reviewer touches zero existing files` — hash comparison.
- `counterbalance.AC6.3: registry enumeration picks up the stub reviewer without code changes` — assert 2 reviewers returned.
- `counterbalance.AC6.3: the added stub reviewer is the second-listed one in the registry` — sanity check on ordering.

**Cleanup:** `t.after(() => fs.rm(tmpDir, { recursive: true, force: true }))`.

**Verification:**

```bash
node --test tests/reviewer-extensibility.test.mjs
```

Expected: 3 test blocks pass.

**Commit:** `test: prove reviewer slot is a zero-touch extension point`
<!-- END_TASK_6 -->
<!-- END_SUBCOMPONENT_C -->

<!-- START_TASK_7 -->
### Task 7: Phase verification

**Step 1: Full suite**

```bash
node --test tests/
```

Expected: all tests from Phases 1-5 pass.

**Step 2: `claude plugin validate .`**

```bash
claude plugin validate .
```

Expected: the new agent (`voice-reviewer.md`) and command (`voice-check.md`) parse cleanly. If validation fails, check the `tools` field — the plugin validator may complain about unrecognized tool names (they're case-sensitive).

**Step 3: Dry-run the registry loader from the command line**

```bash
node -e "import('./plugins/counterbalance/lib/reviewers.mjs').then(m => m.loadRegistry('./plugins/counterbalance').then(r => console.log(JSON.stringify(r, null, 2))))"
```

Expected: prints the parsed registry, shows one reviewer (`voice-check`).

**No commit for this task — verification only.**
<!-- END_TASK_7 -->

---

## Phase 5 Done When

- `plugins/counterbalance/reviewers.json` exists with the voice-check entry
- `plugins/counterbalance/lib/reviewers.mjs` exports `loadRegistry`, `applicableReviewers`, `aggregateFindings`
- `plugins/counterbalance/agents/voice-reviewer.md` exists with `tools: Read, Grep, Glob` (strictly)
- `plugins/counterbalance/commands/voice-check.md` exists and dispatches voice-reviewer via Task
- All AC5.1–5.5 and AC6.1–6.3 cases verified by passing tests
- Reviewer extensibility fixture test passes — stub reviewer picked up with zero changes to existing files
