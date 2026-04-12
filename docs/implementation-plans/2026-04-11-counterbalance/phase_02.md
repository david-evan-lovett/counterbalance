# Counterbalance Phase 2: Voice Profile Resolver

**Goal:** `resolveVoice(cwd)` walks the three-layer cascade (local override → project → user) and returns a `VoiceProfile | null`. CLI entry point: `node plugins/counterbalance/lib/resolver.mjs --cwd=$PWD --json`. Invocable from commands and subagents as a subprocess.

**Architecture:** Four small `.mjs` modules in `plugins/counterbalance/lib/`. `cascade.mjs` and `parser.mjs` are lifted from Anvil with attribution headers and adapted to the `voices` kind and `VoiceProfile` shape respectively. `windows-path.mjs` is a ~10-line helper lifted from `hooks/principle-inject.mjs`. `resolver.mjs` is the public entry point + CLI.

**Tech Stack:** Node ≥ 22.20.0, ESM `.mjs`, `js-yaml`, `node:fs/promises`, `node:path`. No new dependencies.

**Scope:** 2 of 8 phases.

**Codebase verified:** 2026-04-12. Anvil source is at `C:\Users\david\Repos\old_anvil\`. Key files confirmed: `lib/cascade.mjs` (225 lines, exports `loadArtifacts(kind, projectDir, pluginRoot, opts)`), `lib/principles.mjs` (71 lines, flat-shape parser with `parsePrincipleFile` + `loadPrinciplesFromDir`), `hooks/principle-inject.mjs` lines 75-76 (the Windows normalization two-liner). **Parser-shape divergence noted:** Anvil's parser returns a flat record `{id, title, severity, scope, tags, body, source}` — counterbalance needs `VoiceProfile` shape `{id, path, frontmatter, body, source}`, which is a deliberate change, not a literal lift. Task 2 spells out the exact adaptation.

---

## Acceptance Criteria Coverage

This phase implements and tests:

### counterbalance.AC2: Voice profile resolver
- **counterbalance.AC2.1 Success:** When `./.counterbalance.md` exists, resolver returns local-layer profile with `source: "local"`
- **counterbalance.AC2.2 Success:** When only `./.claude/counterbalance.md` exists, resolver returns project-layer profile
- **counterbalance.AC2.3 Success:** When only `~/.claude/plugins/data/counterbalance/profiles/default.md` exists, resolver returns user-layer profile
- **counterbalance.AC2.4 Success:** When multiple layers exist simultaneously, local wins over project wins over user (first-match-wins)
- **counterbalance.AC2.5 Failure:** When no layer has a profile, resolver returns `null` and the drafter falls back to `references/fallback-voice.md`
- **counterbalance.AC2.6 Edge:** Windows paths with backslashes resolve correctly (normalization applied before glob matching)
- **counterbalance.AC2.7 Edge:** Malformed YAML frontmatter produces a clear error, not a silent misread

---

## External Dependency Findings

- ✓ `js-yaml ^4.1.0` provides `yaml.load(string)` which throws `YAMLException` on malformed YAML. Error messages include line numbers. Use that exception's `.message` verbatim in the parser's warning path.
- ✓ `node:fs/promises.mkdtemp(prefix)` creates a unique temp directory (used by tests). `os.tmpdir()` for the prefix base. Returns the full path.
- ✓ Node 22.20.0 marks `path.matchesGlob` as stable (backported from 24.8.0). For this phase we don't need glob matching — resolution is three fixed paths — so there's no glob-matching dependency.
- ⚠ **Windows-path gotcha carryover:** even though Phase 2 doesn't glob, the `HOME`/`USERPROFILE` env var returns a Windows path with backslashes, and joining it with `.claude/plugins/...` needs to use `node:path` (which picks the right separator). Tests on Windows must assert that the resolved `path` field is an absolute, correctly-separated path.

---

## Task Checklist

<!-- START_SUBCOMPONENT_A (tasks 1-3) -->
Library modules — build `parser.mjs`, `cascade.mjs`, `windows-path.mjs` first.

<!-- START_TASK_1 -->
### Task 1: `parser.mjs` — voice profile file parser

**Verifies:** counterbalance.AC2.7

**Files:**
- Create: `c:\Users\david\Repos\counterbalance\plugins\counterbalance\lib\parser.mjs`
- Test: `c:\Users\david\Repos\counterbalance\tests\parser.test.mjs` (unit)

**Implementation:**

Adapt Anvil's `lib/principles.mjs` (`C:\Users\david\Repos\old_anvil\lib\principles.mjs`, 71 lines) to return the `VoiceProfile` shape. Preserve the regex, the `js-yaml` import, and the warn-and-return-null posture, but flatten the return to the four fields counterbalance needs plus `source`.

**Exports:**

- `parseVoiceProfile(filePath, source) → Promise<VoiceProfile | null>` — parses one file. `source` is one of `"local" | "project" | "user"`. Returns `null` on unreadable file, unmatched frontmatter, or malformed YAML (each case logs a distinct `console.warn` to stderr with `[counterbalance] ` prefix).
- `parseVoiceProfileSync(filePath, source)` — **omit this.** The whole pipeline is async; no caller needs sync.

**`VoiceProfile` shape (from design doc lines 304-312):**

```text
{
  id:           string    // v1: always "default" (derived from frontmatter.id or filename)
  path:         string    // absolute path to the matched file
  frontmatter:  object    // parsed YAML (or {} if no frontmatter section at all)
  body:         string    // markdown after the closing ---, left-trimmed
  source:       "local" | "project" | "user"
}
```

**Frontmatter extraction regex** (copy from `C:\Users\david\Repos\old_anvil\lib\principles.mjs:18` verbatim):

```js
const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
```

**Behavior branches:**

1. File unreadable → warn `[counterbalance] Skipping voice profile (unreadable): ${filePath}` and return `null`.
2. No `---` frontmatter section found → treat the whole file as body, set `frontmatter = {}`, derive `id` from the filename stem (e.g. `default.md` → `"default"`, `.counterbalance.md` → `"default"` since the local override is conventionally treated as the default profile), return a valid `VoiceProfile`. **This is a deliberate divergence from Anvil's `principles.mjs`**, which requires frontmatter. Voice profiles are allowed to be pure markdown with no metadata.
3. `---` section found but `yaml.load` throws → warn `[counterbalance] Skipping voice profile (bad YAML): ${filePath} — ${err.message}` and return `null`. **This is the failure path that AC2.7 verifies.**
4. `---` section parses but result is not an object (e.g. `null`, a scalar, or an array) → warn `[counterbalance] Skipping voice profile (frontmatter is not a mapping): ${filePath}` and return `null`.
5. Happy path → return `{id, path: filePath, frontmatter, body, source}`.

**`id` derivation:** prefer `frontmatter.id` if it's a non-empty string. Otherwise derive from `basename(filePath)` — strip leading `.`, strip `.md`, lowercase. For the three canonical layer paths, the id will always be `"default"` or `"counterbalance"`; for v1 that's fine.

**Attribution header (every lifted file MUST start with this block):**

```js
// Adapted from Anvil's lib/principles.mjs
// https://github.com/david-evan-lovett/anvil — SPDX-License-Identifier: MIT
// Changes: returns VoiceProfile shape with {id, path, frontmatter, body, source}
// instead of Anvil's flat principle shape, and allows missing frontmatter.
```

**Imports:**

```js
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import yaml from 'js-yaml';
```

**Testing:**

Tests must verify each AC listed above. This task only verifies `AC2.7`; the remaining AC2 cases are verified by the integrated resolver test in Task 4.

Write the test file using Anvil's test style (see `C:\Users\david\Repos\old_anvil\tests\applicability.test.mjs`): `import { test } from 'node:test'`, `import assert from 'node:assert'`, flat `test(...)` calls at module scope, test names prefixed with AC identifiers.

Tests (use `fs/promises.mkdtemp` + `os.tmpdir` to create throwaway files):

- `counterbalance.AC2.7: malformed YAML returns null and warns` — write a file whose frontmatter contains invalid YAML (e.g. `---\nid: [unclosed\n---\nbody\n`), assert the parser returns `null`. Capture stderr via a stub on `process.stderr.write` or by temporarily replacing `console.warn` and assert the warning message begins with `[counterbalance] Skipping voice profile (bad YAML):`.
- `parseVoiceProfile: valid frontmatter returns flat VoiceProfile shape` — write `---\nid: default\ntitle: Test\n---\nbody text\n` and assert returned `id === "default"`, `frontmatter.title === "Test"`, `body === "body text\n"`, `source === "local"`, `path` is the absolute path.
- `parseVoiceProfile: no frontmatter treated as pure markdown body` — write a file with no `---` block at all, assert returned `frontmatter === {}` and `body` is the full content, `id` derived from filename.
- `parseVoiceProfile: frontmatter null (---\n---\nbody) returns null` — edge case: empty frontmatter parses to `null`, which must trigger branch 4.

Follow project testing patterns per CLAUDE.md discovery — **none found** in the counterbalance tree or any parent. Anvil's style is the precedent; match it.

**Verification:**

```bash
node --test tests/parser.test.mjs
```

Expected: all 4 test blocks pass, exit 0.

**Commit:** `feat: add voice profile parser with AC2.7 coverage`
<!-- END_TASK_1 -->

<!-- START_TASK_2 -->
### Task 2: `windows-path.mjs` — path normalization helper

**Verifies:** counterbalance.AC2.6 (part 1 — this module is the isolated unit)

**Files:**
- Create: `c:\Users\david\Repos\counterbalance\plugins\counterbalance\lib\windows-path.mjs`
- Test: `c:\Users\david\Repos\counterbalance\tests\windows-path.test.mjs` (unit)

**Implementation:**

Lift the normalization pattern from `C:\Users\david\Repos\old_anvil\hooks\principle-inject.mjs:75-76`:

```js
let relativePath = isAbsolute(filePath) ? relative(cwd, filePath) : filePath;
relativePath = relativePath.split(sep).join('/');
```

In counterbalance, package this as a pure function with no dependency on `cwd`:

```js
// Adapted from Anvil's hooks/principle-inject.mjs:75-76
// https://github.com/david-evan-lovett/anvil — SPDX-License-Identifier: MIT

import { sep } from 'node:path';

/**
 * Normalize an OS-native path to forward-slash form.
 * On Windows, path APIs return "src\\api\\file.md" but glob patterns and
 * cross-platform test fixtures use "src/api/file.md". Without this
 * normalization, any code that compares paths across platforms silently
 * breaks on Windows.
 */
export function toForwardSlashes(p) {
    if (typeof p !== 'string') return p;
    return p.split(sep).join('/');
}
```

**Testing:**

Tests must verify each AC listed above:
- `counterbalance.AC2.6: toForwardSlashes normalizes backslash-separated paths` — assert `toForwardSlashes('foo\\bar\\baz.md')` returns `'foo/bar/baz.md'` on all platforms. Use literal backslashes in the input (escaped as `\\`), not `path.join`, so the test is deterministic regardless of the host OS.
- `toForwardSlashes: forward-slash input passes through unchanged`
- `toForwardSlashes: empty string returns empty string`
- `toForwardSlashes: non-string returns the input unchanged` (covers defensive branch)

**Verification:**

```bash
node --test tests/windows-path.test.mjs
```

Expected: all test blocks pass.

**Commit:** `feat: add windows-path normalizer lifted from Anvil`
<!-- END_TASK_2 -->

<!-- START_TASK_3 -->
### Task 3: `cascade.mjs` — generic layered cascade for voices

**Verifies:** (foundation only — cascade is exercised by the resolver test in Task 4)

**Files:**
- Create: `c:\Users\david\Repos\counterbalance\plugins\counterbalance\lib\cascade.mjs`
- Test: `c:\Users\david\Repos\counterbalance\tests\cascade.test.mjs` (unit)

**Implementation:**

Lift-and-simplify Anvil's `lib/cascade.mjs` (`C:\Users\david\Repos\old_anvil\lib\cascade.mjs`, 225 lines). For counterbalance we do not need the `principles`/`checks` kinds, severity sorting, tag matching, subtree walking, or the file-pattern applicability logic — all of that lives in the Anvil orchestrator hook. We need a much smaller piece: **given three candidate file paths in descending precedence order, return the first one that parses into a valid record.**

**Exports:**

```js
/**
 * Walk an ordered list of (path, source) layers and return the first one
 * that parses cleanly. "First match wins" — later layers are not consulted
 * once an earlier layer has produced a valid record.
 *
 * @param {Array<{path: string, source: string}>} layers
 * @param {function(string, string): Promise<object|null>} parse
 *        — parse(filePath, source) returning a record or null
 * @returns {Promise<object|null>}
 */
export async function resolveFirstLayer(layers, parse) {
    for (const { path, source } of layers) {
        const record = await parse(path, source);
        if (record) return record;
    }
    return null;
}
```

That's the entire module. Add the Anvil attribution header:

```js
// Inspired by Anvil's lib/cascade.mjs ordered-layer resolution pattern.
// https://github.com/david-evan-lovett/anvil — SPDX-License-Identifier: MIT
// Counterbalance drops severity sorting, tag matching, and subtree walking —
// it only needs first-match-wins across three fixed paths.
```

**Why this is a rewrite rather than a literal lift:** Anvil's `loadArtifacts` takes a kind + project dir + plugin root and iterates directory contents through a KINDS config table (see `C:\Users\david\Repos\old_anvil\lib\cascade.mjs:11-22`). That's the right shape when you have many principles merging across layers. Counterbalance wants exactly one profile per run, with fixed path candidates chosen by the caller — so the KINDS indirection is dead weight. The ordering-and-first-match idea is the borrowed concept; the implementation is simpler on purpose.

**Testing:**

Tests must verify first-match-wins order:

- `cascade: returns first layer that parses` — pass a layers array where the first layer's parse returns a record; assert the returned record comes from layer 1.
- `cascade: skips layers whose parse returns null and returns second` — first layer parses to `null`, second layer parses to a record; assert second record returned.
- `cascade: returns null when all layers return null`
- `cascade: empty layers array returns null`

Use a stub parse function (takes `(path, source)`, returns `{id: path, source}` or `null` per test).

**Verification:**

```bash
node --test tests/cascade.test.mjs
```

**Commit:** `feat: add cascade ordered-layer resolver`
<!-- END_TASK_3 -->
<!-- END_SUBCOMPONENT_A -->

<!-- START_SUBCOMPONENT_B (task 4) -->
Public entry point that ties it together.

<!-- START_TASK_4 -->
### Task 4: `resolver.mjs` — `resolveVoice(cwd)` + CLI

**Verifies:** counterbalance.AC2.1, counterbalance.AC2.2, counterbalance.AC2.3, counterbalance.AC2.4, counterbalance.AC2.5, counterbalance.AC2.6

**Files:**
- Create: `c:\Users\david\Repos\counterbalance\plugins\counterbalance\lib\resolver.mjs`
- Test: `c:\Users\david\Repos\counterbalance\tests\resolver.test.mjs` (integration — touches real fs via mkdtemp)

**Implementation:**

`resolver.mjs` composes `parser.mjs` + `cascade.mjs` into the public API. Layers (in order): local override, project voice, user voice. Exit point of the plugin-to-Node bridge.

**Exports:**

- `resolveVoice(cwd) → Promise<VoiceProfile | null>` — programmatic API
- `VOICE_PATHS` — exported constant object for testability and documentation:
  ```js
  export const VOICE_PATHS = {
      local:   (cwd) => path.join(cwd, '.counterbalance.md'),
      project: (cwd) => path.join(cwd, '.claude', 'counterbalance.md'),
      user:    () => path.join(homeDir(), '.claude', 'plugins', 'data', 'counterbalance', 'profiles', 'default.md'),
  };
  ```
- CLI entry point: when invoked as `node lib/resolver.mjs --cwd=$PWD --json`, prints JSON to stdout (or empty string if null) and exits 0. On any internal error, prints `null` and exits 0 — **fail-open**, matching Anvil's hook pattern (`C:\Users\david\Repos\old_anvil\hooks\principle-inject.mjs` top-level try/catch).

**`homeDir()` helper:**

```js
function homeDir() {
    return process.env.HOME || process.env.USERPROFILE || '';
}
```

Anvil uses the same pattern at `lib/cascade.mjs:28-30`. If neither env var is set, `homeDir()` returns `''` and the user-layer path becomes `.claude/plugins/data/counterbalance/profiles/default.md` relative to cwd — which will almost certainly not exist, so the resolver cleanly falls through to null. Tests can force this by `delete process.env.HOME; delete process.env.USERPROFILE;` in a sandboxed block.

**`resolveVoice(cwd)` logic:**

```js
export async function resolveVoice(cwd) {
    const layers = [
        { path: VOICE_PATHS.local(cwd),   source: 'local'   },
        { path: VOICE_PATHS.project(cwd), source: 'project' },
        { path: VOICE_PATHS.user(),       source: 'user'    },
    ];
    return resolveFirstLayer(layers, parseVoiceProfile);
}
```

**CLI main:**

```js
// At the bottom of the file:
import { fileURLToPath } from 'node:url';
import { argv } from 'node:process';

const invokedDirectly = fileURLToPath(import.meta.url) === path.resolve(argv[1] ?? '');
if (invokedDirectly) {
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
}
```

Anvil's `lib/applicability.mjs:144-150` uses the same `fileURLToPath(import.meta.url) === path.resolve(process.argv[1])` idiom for detecting "invoked as CLI vs imported as a module." Copy it here.

**Testing:**

Each test spins up a temp directory via `fs.mkdtemp(path.join(os.tmpdir(), 'counterbalance-resolver-'))`, writes the file combinations, calls `resolveVoice(tempDir)`, asserts the outcome, and tears the temp dir down in a `t.after` hook.

For the user-layer tests, override `HOME` / `USERPROFILE` in the test block to point at a second mkdtemp directory that contains `.claude/plugins/data/counterbalance/profiles/default.md`. Restore the env vars in `t.after`.

Required test blocks (one per AC):

- `counterbalance.AC2.1: local override wins — returns source=local` — create only `$tmp/.counterbalance.md` with valid content, assert resolved profile has `source === 'local'` and `path` ends with `.counterbalance.md`.
- `counterbalance.AC2.2: project layer — returns source=project` — create only `$tmp/.claude/counterbalance.md`, assert `source === 'project'`.
- `counterbalance.AC2.3: user layer — returns source=user` — create only `$tmp_home/.claude/plugins/data/counterbalance/profiles/default.md`, override `HOME`, assert `source === 'user'`.
- `counterbalance.AC2.4: all three exist — local wins (first-match-wins)` — create all three, assert `source === 'local'`.
- `counterbalance.AC2.4 (follow-up): project wins when local absent` — create project + user, assert `source === 'project'`.
- `counterbalance.AC2.5: nothing exists — returns null` — empty temp dir, no HOME override, assert `resolveVoice(tempDir)` returns `null`.
- `counterbalance.AC2.6: Windows-style backslash path in cwd resolves correctly` — on Windows hosts, pass `cwd` with backslashes as returned by `process.cwd()`; assert the returned `profile.path` is absolute and parseable by `node:path`. On non-Windows hosts this test runs as a no-op with a `t.skip('Windows only')` guard.

CLI tests (separate test blocks, invoked as subprocess via `child_process.execFileSync`):

- `resolver CLI: --cwd with no match prints "null" and exits 0`
- `resolver CLI: --cwd with a match prints JSON containing "source":"local" and exits 0`
- `resolver CLI: --cwd with unreadable HOME fails open (exit 0, prints null)`

**Verification:**

```bash
node --test tests/resolver.test.mjs
```

Expected: all test blocks pass, exit 0. Running the CLI directly as a smoke check:

```bash
node plugins/counterbalance/lib/resolver.mjs --cwd=$(pwd) --json
```

Expected: prints `null` on the bare repo (no profiles anywhere), exit 0.

**Commit:** `feat: voice profile resolver with AC2 coverage`
<!-- END_TASK_4 -->
<!-- END_SUBCOMPONENT_B -->

<!-- START_TASK_5 -->
### Task 5: Phase verification

**No file changes.**

**Step 1: Run the full test suite**

```bash
node --test tests/
```

Expected: every test from Phases 1 and 2 passes.

**Step 2: Re-run `claude plugin validate .`**

```bash
claude plugin validate .
```

Expected: no regression from Phase 1. Adding `lib/*.mjs` files under `plugins/counterbalance/lib/` should not affect validation (those directories are not in the Claude Code auto-discovery list).

**Step 3: CLI smoke test**

From the repo root:

```bash
node plugins/counterbalance/lib/resolver.mjs --cwd=$(pwd) --json
```

Expected output: literal string `null` (no profile exists in the scaffold yet), exit 0.

**No commit for this task — verification only.**
<!-- END_TASK_5 -->

---

## Phase 2 Done When

- All AC2 cases verified by passing tests in `tests/resolver.test.mjs`, `tests/parser.test.mjs`, `tests/windows-path.test.mjs`, and `tests/cascade.test.mjs`
- `resolveVoice(cwd)` is importable and invocable as both module and CLI
- The CLI returns `null` cleanly on a bare repo (fail-open verified)
- `claude plugin validate .` still passes
- Windows-specific path test is present and gated with `t.skip('Windows only')` on non-Windows hosts
