# Counterbalance Phase 1: Repo Scaffold and Manifests

**Goal:** Produce a valid, installable-but-empty plugin + marketplace. `claude plugin validate .` passes at the repo root.

**Architecture:** Single-plugin marketplace repo. Repo root is the marketplace catalog (`.claude-plugin/marketplace.json` with `metadata.pluginRoot: "./plugins"`). The plugin itself lives at `plugins/counterbalance/`. Future plugins slot in as siblings without restructure.

**Tech Stack:** Node ≥ 22.20.0, ESM `.mjs`, `js-yaml ^4.1.0` as sole runtime dep, `node --test` built-in runner. No TypeScript, no bundler, no devDeps.

**Scope:** 1 of 8 phases.

**Codebase verified:** 2026-04-12. Repo currently contains only `.gitignore`, `.claude/settings.local.json`, and `docs/`. No `package.json`, `plugin.json`, or any source files yet. Current `.gitignore` contains two lines: `docs` and `settings.local.json` — the `docs` line must be removed in this phase because the committed design plan lives under `docs/design-plans/`.

---

## Acceptance Criteria Coverage

This is an infrastructure phase. **Verifies: None** — no functionality ACs map to scaffolding. Done-when is purely operational.

---

## External Dependency Findings

- ✓ `js-yaml ^4.1.0` is MIT-licensed and used by the sibling Anvil plugin as its sole runtime dep.
- ✓ `claude plugin validate <dir>` is a real subcommand. Verified at https://code.claude.com/docs/en/plugin-marketplaces#validation-and-testing. It checks `plugin.json`, skill/agent/command frontmatter, and `hooks/hooks.json`. Takes a single directory arg.
- ⚠ `metadata.pluginRoot` shorthand is documented but does NOT validate on the current `@anthropic-ai/claude-code` CLI. Docs claim: "Base directory prepended to relative plugin source paths (for example, `"./plugins"` lets you write `"source": "formatter"` instead of `"source": "./plugins/formatter"`)." Source: <https://code.claude.com/docs/en/plugin-marketplaces#optional-metadata>. **Empirical finding (2026-04-12, validator rejects `"source": "counterbalance"` with `plugins.0.source: Invalid input`):** use the long form `"source": "./plugins/counterbalance"`. `pluginRoot` is still set because it may be honored by future validators and by the installer even if the current validator's schema requires a fully-qualified relative path.
- ✗ The design doc's mention of a `$schema` URL for marketplace.json cannot be verified — Anthropic publishes no official JSON Schema. **Decision:** omit `$schema` from both manifests. Revisit if/when an official schema ships.
- ⚠ Version precedence: per https://code.claude.com/docs/en/plugins-reference#metadata-fields, if both `plugin.json` and the marketplace entry set `version`, `plugin.json` wins. **Decision:** set `version` only in `plugin.json`, omit from the marketplace plugin entry. Phase 8 bumps both in lockstep but this phase keeps it single-sourced.
- ⚠ `claude plugin validate` exit-code contract is undocumented. The validate command is still usable — it prints errors and a non-zero exit in failure cases based on practice — but CI should shell-test it in Phase 7 rather than assume behavior.

---

## Task Checklist

<!-- START_SUBCOMPONENT_A (tasks 1-4) -->
Manifests and metadata.

<!-- START_TASK_1 -->
### Task 1: Update `.gitignore` and stop ignoring `docs/`

**Files:**
- Modify: `c:\Users\david\Repos\counterbalance\.gitignore`

**Step 1: Replace `.gitignore` with the full counterbalance ignore set**

The current file ignores `docs` wholesale, which would exclude the committed design plans. Replace it with:

```gitignore
# Dependencies
node_modules/

# Local, never commit
.claude/settings.local.json
settings.local.json

# Local voice profile override (per design — users drop this next to a repo they want a one-off voice for)
.counterbalance.md

# macOS / editor junk
.DS_Store
```

The existing `settings.local.json` line is preserved (plus the more specific `.claude/settings.local.json`). The `docs` line is removed so `docs/design-plans/` and `docs/implementation-plans/` are tracked going forward.

**Step 2: Verify `git status` shows `docs/` as an untracked directory about to be added**

```bash
git status
```

Expected: `.gitignore` modified, `docs/` listed as untracked.

**Step 3: Commit**

```bash
git add .gitignore
git commit -m "chore: stop ignoring docs/, add plugin-scoped ignores"
```
<!-- END_TASK_1 -->

<!-- START_TASK_2 -->
### Task 2: Create the MIT `LICENSE` file

**Files:**
- Create: `c:\Users\david\Repos\counterbalance\LICENSE`

**Step 1: Create `LICENSE` with the standard MIT text**

Use the SPDX-standard MIT text with "David Lovett" as the copyright holder and the current year (2026):

```text
MIT License

Copyright (c) 2026 David Lovett

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

**Step 2: Commit**

```bash
git add LICENSE
git commit -m "chore: add MIT license"
```
<!-- END_TASK_2 -->

<!-- START_TASK_3 -->
### Task 3: Create top-level `package.json` with `js-yaml` as sole dep

**Files:**
- Create: `c:\Users\david\Repos\counterbalance\package.json`

**Step 1: Write the manifest**

Anvil's shape at `C:\Users\david\Repos\old_anvil\package.json` is the pattern — mirror its fields and constraints. No `scripts`, no `devDependencies`, no bundler. Tests will run as `node --test tests/` directly from CI and from the developer's terminal.

```json
{
    "name": "counterbalance",
    "version": "0.0.1",
    "description": "A Claude Code plugin that gives writers a voice-aware drafting engine and an extensible reviewer pipeline.",
    "type": "module",
    "license": "MIT",
    "author": {
        "name": "David Lovett"
    },
    "repository": {
        "type": "git",
        "url": "https://github.com/david-evan-lovett/counterbalance.git"
    },
    "homepage": "https://github.com/david-evan-lovett/counterbalance",
    "bugs": {
        "url": "https://github.com/david-evan-lovett/counterbalance/issues"
    },
    "engines": {
        "node": ">=22.20.0"
    },
    "dependencies": {
        "js-yaml": "^4.1.0"
    }
}
```

**Step 2: Install and verify**

```bash
npm install
```

Expected: creates `node_modules/js-yaml/` and `package-lock.json`. No warnings about peer deps. Exit 0.

```bash
node --version
```

Expected: `v22.20.0` or higher. If not, this is a blocker — do not proceed until Node is upgraded.

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: scaffold package.json with js-yaml dependency"
```

Note: `node_modules/` is gitignored.
<!-- END_TASK_3 -->

<!-- START_TASK_4 -->
### Task 4: Create marketplace catalog and plugin manifest

**Files:**
- Create: `c:\Users\david\Repos\counterbalance\.claude-plugin\marketplace.json`
- Create: `c:\Users\david\Repos\counterbalance\plugins\counterbalance\.claude-plugin\plugin.json`

**Step 1: Create the marketplace catalog**

Use `./plugins/counterbalance` as the `source` (the long form). The docs advertise a `pluginRoot` shorthand (`"source": "counterbalance"`) but the current `claude plugin validate` rejects that form with `plugins.0.source: Invalid input` — see the warning in External Dependency Findings above. Keep `metadata.pluginRoot` set anyway: it's cheap and forward-compatible. Omit `version` from the plugin entry — `plugin.json` is authoritative for version.

Path: `c:\Users\david\Repos\counterbalance\.claude-plugin\marketplace.json`

```json
{
    "name": "counterbalance",
    "owner": {
        "name": "David Lovett"
    },
    "metadata": {
        "description": "A single-plugin marketplace hosting the counterbalance writing plugin.",
        "pluginRoot": "./plugins"
    },
    "plugins": [
        {
            "name": "counterbalance",
            "source": "./plugins/counterbalance",
            "description": "Voice-aware drafter and extensible reviewer pipeline for Claude Code.",
            "author": { "name": "David Lovett" },
            "license": "MIT",
            "keywords": ["writing", "voice", "drafter", "reviewer"]
        }
    ]
}
```

**Step 2: Create the plugin manifest (bare metadata, convention-over-configuration)**

Claude Code auto-discovers `skills/`, `agents/`, `commands/`, and `hooks/hooks.json` from the plugin root when `plugin.json` omits the component arrays. Anvil's manifest pattern applies here — metadata only.

Path: `c:\Users\david\Repos\counterbalance\plugins\counterbalance\.claude-plugin\plugin.json`

```json
{
    "name": "counterbalance",
    "description": "A voice-aware drafter and extensible reviewer pipeline. Provides /ghost, /voice-refresh, and /voice-check.",
    "version": "0.0.1",
    "author": {
        "name": "David Lovett"
    },
    "license": "MIT",
    "keywords": [
        "writing",
        "voice",
        "drafter",
        "reviewer",
        "ghost-writer"
    ]
}
```

**Step 3: Verify both manifests parse and `claude plugin validate` succeeds**

```bash
claude plugin validate .
```

Expected: no error output, exit 0. If you see an error like `Path contains ".."` or `Invalid JSON syntax`, stop and fix before moving on. Docs reference: https://code.claude.com/docs/en/plugin-marketplaces#marketplace-validation-errors.

**Step 4: Commit**

```bash
git add .claude-plugin/marketplace.json plugins/counterbalance/.claude-plugin/plugin.json
git commit -m "feat: scaffold marketplace + plugin manifests"
```
<!-- END_TASK_4 -->
<!-- END_SUBCOMPONENT_A -->

<!-- START_SUBCOMPONENT_B (tasks 5-7) -->
Skeleton docs.

<!-- START_TASK_5 -->
### Task 5: Create `README.md` skeleton

**Files:**
- Create: `c:\Users\david\Repos\counterbalance\README.md`

**Step 1: Write skeleton with sections that Phase 8 will fill**

Just enough to pass markdownlint and for `claude plugin validate` to see a README. Phase 8 fills in the real content.

```markdown
# counterbalance

Voice-aware drafting and extensible review for Claude Code.

> **Status:** alpha. See `docs/design-plans/` for the architectural intent and `docs/implementation-plans/` for in-progress work.

## Install

_Install instructions land in Phase 8 once v0.1.0 is published._

## Commands

- `/ghost` — draft prose from notes in your voice
- `/voice-refresh` — re-run Voice Discovery for the active profile
- `/voice-check` — review a draft against your voice profile

## License

MIT — see [LICENSE](LICENSE).
```

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README skeleton"
```
<!-- END_TASK_5 -->

<!-- START_TASK_6 -->
### Task 6: Create `CHANGELOG.md` skeleton

**Files:**
- Create: `c:\Users\david\Repos\counterbalance\CHANGELOG.md`

**Step 1: Write a Keep-a-Changelog-style skeleton**

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial repo scaffold, marketplace, and plugin manifests.
```

**Step 2: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: add CHANGELOG skeleton"
```
<!-- END_TASK_6 -->

<!-- START_TASK_7 -->
### Task 7: Commit the design plan

**Files:**
- Add: `c:\Users\david\Repos\counterbalance\docs\design-plans\2026-04-11-counterbalance.md` (already on disk, now un-ignored by Task 1)
- Add: `c:\Users\david\Repos\counterbalance\docs\implementation-plans\2026-04-11-counterbalance\` (the in-progress implementation plan directory)

**Step 1: Stage the design plan**

```bash
git add docs/design-plans/2026-04-11-counterbalance.md
git add docs/implementation-plans/2026-04-11-counterbalance/
```

**Step 2: Commit**

```bash
git commit -m "docs: commit design plan and implementation plan stubs"
```
<!-- END_TASK_7 -->
<!-- END_SUBCOMPONENT_B -->

<!-- START_SUBCOMPONENT_C (tasks 8-9) -->
Smoke test for the manifests themselves.

<!-- START_TASK_8 -->
### Task 8: Manifest smoke test

**Files:**
- Create: `c:\Users\david\Repos\counterbalance\tests\manifests.test.mjs`

**Implementation:**

Write a `node --test` file that asserts both manifests parse as JSON and contain the required fields. Follow Anvil's test style exactly: `import { test } from 'node:test'` (not `describe`/`it`), flat module-scope `test(...)` calls, `assert.strictEqual` / `assert.ok`. See `C:\Users\david\Repos\old_anvil\tests\applicability.test.mjs` for one example of the pattern.

Required assertions:

1. `.claude-plugin/marketplace.json` parses.
2. Marketplace has `name: "counterbalance"`, non-empty `owner.name`, `metadata.pluginRoot === "./plugins"`, exactly one entry in `plugins`.
3. The one plugin entry has `name === "counterbalance"` and `license === "MIT"`.
4. `plugins/counterbalance/.claude-plugin/plugin.json` parses.
5. Plugin has `name === "counterbalance"`, `version` is a non-empty string matching semver-lite (`/^\d+\.\d+\.\d+/`), `license === "MIT"`, `author.name` non-empty.

Use `node:fs/promises.readFile` + `JSON.parse` directly — no helper library. Use `import.meta.url` + `fileURLToPath` + `path.resolve` to build absolute paths from the test file's own location, so tests pass regardless of `cwd`.

**Testing:**

Tests verify that the manifests themselves are structurally sound. This is a structural invariant, not an AC. No AC coverage claimed.

**Verification:**

```bash
node --test tests/manifests.test.mjs
```

Expected: `# pass 5` (or however many test blocks you write), exit 0.

**Commit:** `test: assert marketplace and plugin manifests parse with required fields`
<!-- END_TASK_8 -->

<!-- START_TASK_9 -->
### Task 9: Full phase verification

**No file changes.**

**Step 1: Run `claude plugin validate .` one final time**

```bash
claude plugin validate .
```

Expected: no errors, exit 0.

**Step 2: Run the test suite**

```bash
node --test tests/manifests.test.mjs
```

Expected: all tests pass, exit 0.

Note: the file-form is used (rather than `node --test tests/`) because recursive directory discovery for `node --test` landed after Node 22.14.0, which is the declared engines floor.

**Step 3: Run `npm install --dry-run` to confirm package.json is healthy**

```bash
npm install --dry-run
```

Expected: no warnings beyond standard "added N packages" summary.

**Step 4: If all three commands pass, Phase 1 is done.** Proceed to Phase 2.

No commit for this task — verification only.
<!-- END_TASK_9 -->
<!-- END_SUBCOMPONENT_C -->

---

## Phase 1 Done When

- `claude plugin validate .` passes at the repo root
- `npm install` succeeds
- `node --test tests/manifests.test.mjs` passes
- Repo contains `LICENSE`, `README.md`, `CHANGELOG.md`, `package.json`, `.claude-plugin/marketplace.json`, `plugins/counterbalance/.claude-plugin/plugin.json`, and `tests/manifests.test.mjs`
- Design plan and implementation plan directory are tracked by git
