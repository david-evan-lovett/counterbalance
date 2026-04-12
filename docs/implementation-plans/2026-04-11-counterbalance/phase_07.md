# Counterbalance Phase 7: CI Safety Gate

**Goal:** `.github/workflows/validate.yml` runs on every PR and on tag push. It is the enforcement point for all `AC8.*` criteria. Deliberately broken manifests, missing references, personal data leaks, or a manifest change without a version bump all fail loudly.

**Architecture:** One GitHub Actions workflow + five new tests that the workflow runs alongside the existing `node --test` suite. A `.markdownlint-cli2.jsonc` config tunes markdownlint-cli2 for the project's conventions. The workflow uses an ephemeral Node 22 install + `@anthropic-ai/claude-code` installed as an `npx` target pinned to a specific version.

**Tech Stack:** GitHub Actions (`actions/checkout@v4`, `actions/setup-node@v4`), Node 22.20.0, `markdownlint-cli2` (latest), the Claude Code CLI for `claude plugin validate`. No additional runtime deps — `markdownlint-cli2` is invoked via `npx` without adding it to `package.json`.

**Scope:** 7 of 8 phases.

**Codebase verified:** 2026-04-12. No `.github/` directory exists in counterbalance. Anvil also has no CI (`C:\Users\david\Repos\old_anvil` has no `.github/workflows/`), so this is greenfield CI work with no prior pattern to copy from the sibling plugin.

---

## Acceptance Criteria Coverage

This phase implements and tests:

### counterbalance.AC8: CI safety gate
- **counterbalance.AC8.1 Success:** GitHub Actions workflow runs `claude plugin validate` on both the plugin and the marketplace
- **counterbalance.AC8.2 Success:** CI runs `node --test tests/` and blocks merge on any failure
- **counterbalance.AC8.3 Success:** CI enforces a version bump when `plugin.json` or `marketplace.json` body changed vs base branch
- **counterbalance.AC8.4 Success:** CI scans for personal data leaks against a configurable deny list and blocks on match
- **counterbalance.AC8.5 Success:** CI asserts `LICENSE` exists and contains "MIT", and both manifests declare `"license": "MIT"`
- **counterbalance.AC8.6 Success:** CI runs markdownlint-cli2 against `SKILL.md`, `README.md`, and reference files
- **counterbalance.AC8.7 Failure:** A deliberately malformed `plugin.json` produces a clear, line-referenced CI failure

---

## External Dependency Findings

- ✓ `claude plugin validate <dir>` is a real subcommand. Verified at https://code.claude.com/docs/en/plugin-marketplaces#validation-and-testing. Takes a single directory arg. Checks `plugin.json`, skill/agent/command frontmatter, and `hooks/hooks.json`.
- ⚠ **`claude plugin validate` exit-code behavior is not documented.** The workflow must shell-test this in a spike before relying on non-zero exit as a gate. Plan: run the validate command in a step, capture stderr/stdout, and grep for error-signal strings (`Invalid JSON syntax`, `File not found`, `failed to parse`) as a belt-and-suspenders fallback on top of the exit code.
- ⚠ **`claude plugin validate ./plugins/counterbalance`** (plugin-directory-only mode) is not explicitly documented. The docs show it being run from a marketplace directory. **Plan:** run `claude plugin validate .` at the repo root once (validates the marketplace, which in turn validates plugins under it). This single invocation is enough to satisfy AC8.1. Drop the separate per-plugin invocation from the design doc — it's redundant if the single marketplace-level call covers both.
- ✓ `actions/setup-node@v4` supports Node 22.x. Use `node-version: '22.20.0'` to pin exactly.
- ✓ `markdownlint-cli2` is installed via `npx markdownlint-cli2@0.18.0` (pin exact version). Config file `.markdownlint-cli2.jsonc` is the default name. Source: https://github.com/DavidAnson/markdownlint-cli2.
- ✓ `markdownlint-cli2` MD040 rule has `allowed_languages` config — needed to whitelist `text` as a valid fenced-code language for the diagrams in this repo's design docs. Source: https://github.com/DavidAnson/markdownlint/blob/main/doc/md040.md.
- ✓ Installing Claude Code CLI in CI: `npm install -g @anthropic-ai/claude-code` works in an Actions step, though it's large (~100MB with deps). Alternative: use `npx @anthropic-ai/claude-code@latest plugin validate .`. Pin an exact version so CI is reproducible.

---

## Task Checklist

<!-- START_SUBCOMPONENT_A (tasks 1-5) -->
Test files the CI workflow will run. Write and verify each locally before wiring them into the workflow.

<!-- START_TASK_1 -->
### Task 1: `tests/license-check.test.mjs` — license invariants

**Verifies:** counterbalance.AC8.5

**Files:**
- Create: `c:\Users\david\Repos\counterbalance\tests\license-check.test.mjs` (unit)

**Implementation:**

Three assertions:

1. `LICENSE` exists at repo root, is readable, and contains the literal string `"MIT License"` (the heading of the SPDX MIT text).
2. `.claude-plugin/marketplace.json` plugin entry has `license === "MIT"`.
3. `plugins/counterbalance/.claude-plugin/plugin.json` has `license === "MIT"`.

**Test blocks:**

- `counterbalance.AC8.5: LICENSE file exists and contains "MIT License" heading`
- `counterbalance.AC8.5: marketplace.json plugin entry declares license "MIT"`
- `counterbalance.AC8.5: plugin.json declares license "MIT"`

**Verification:**

```bash
node --test tests/license-check.test.mjs
```

Expected: 3 test blocks pass.

**Commit:** `test: assert LICENSE and manifest license fields are MIT`
<!-- END_TASK_1 -->

<!-- START_TASK_2 -->
### Task 2: `tests/version-bump.test.mjs` — version-bump enforcement

**Verifies:** counterbalance.AC8.3

**Files:**
- Create: `c:\Users\david\Repos\counterbalance\tests\version-bump.test.mjs` (integration — shells out to git)

**Implementation:**

The test reads the base branch (`main` by default, overridable via `BASE_REF` env var) version of both manifests via `git show`, compares them to the current working-tree versions, and asserts:

- If `plugin.json` body (ignoring the `version` field) has changed vs base, then `plugin.json.version` must have incremented.
- Same rule for `marketplace.json`.

"Body changed" means: parse both the base and current versions with `JSON.parse`, drop the `version` key (and for marketplace, drop `plugins[n].version`), stringify with deterministic key ordering, compare the two strings. If they differ, require a version bump.

**Base ref discovery:**

```js
const baseRef = process.env.BASE_REF || 'origin/main';
```

In local dev, `git fetch origin main` must be run first or this test will fail with "unknown revision." In CI, `actions/checkout@v4` with `fetch-depth: 0` ensures the base ref is available.

**Bail-out for the first commit:**

When the base ref is missing (e.g., first push to a fresh repo), the test should log a `[counterbalance] version-bump test: base ref $baseRef not found, skipping` and pass rather than crash. Use a `try`/`catch` around the `git show` call.

**Test blocks:**

- `counterbalance.AC8.3: plugin.json version bumped when body changed` — normal case.
- `counterbalance.AC8.3: marketplace.json version bumped when body changed` — normal case.
- `counterbalance.AC8.3: no version bump required when body identical to base` — control.
- `version-bump: skip cleanly when base ref not available` — first-commit safety.

**Semver comparison:** Use a simple string-split-on-dot comparator; no external `semver` package. For "is newer":

```js
function isBumped(prev, curr) {
    const [pMaj, pMin, pPatch] = prev.split('.').map(Number);
    const [cMaj, cMin, cPatch] = curr.split('.').map(Number);
    if (cMaj > pMaj) return true;
    if (cMaj < pMaj) return false;
    if (cMin > pMin) return true;
    if (cMin < pMin) return false;
    return cPatch > pPatch;
}
```

No pre-release handling for v1 — the rule is "v0.1.0 < v0.1.1 < v0.2.0 etc." Good enough.

**Verification:**

```bash
git fetch origin main
node --test tests/version-bump.test.mjs
```

Expected: all 4 test blocks pass. On a branch with no manifest changes, the "normal case" tests are effectively no-ops (body unchanged, so no bump required) and they pass trivially.

**Commit:** `test: enforce version bump when manifests change`
<!-- END_TASK_2 -->

<!-- START_TASK_3 -->
### Task 3: `tests/personal-data-scan.test.mjs` — personal data leak scan

**Verifies:** counterbalance.AC8.4

**Files:**
- Create: `c:\Users\david\Repos\counterbalance\tests\personal-data-scan.test.mjs` (unit — fs walk + grep)
- Create: `c:\Users\david\Repos\counterbalance\tests\personal-data-deny-list.json` (the deny-list config — committed so it can be audited and updated)

**Implementation:**

**The deny-list file:**

`tests/personal-data-deny-list.json` is a JSON file with one or more literal strings that must NEVER appear in committed plugin files. The content of this file should be a handful of strings the user considers "personal" and wants to catch — things like an email address, a specific anonymized handle, or a snippet of personal voice content known to live only in the user's `~/.claude/CLAUDE.md`.

**Initial content (leave the list empty in v1 — it will fill as the user notices things they want to block):**

```json
{
    "description": "Literal strings that must never appear in committed counterbalance files. Additions should be one-per-line strings — no regexes. The scan is substring-based and case-sensitive.",
    "deny": []
}
```

An empty list is valid — the test passes trivially. Users add entries over time.

**Scan algorithm:**

1. Load the deny list.
2. Walk every committed file under `plugins/`, `tests/`, `README.md`, `CHANGELOG.md`, and the two manifests. **Skip `node_modules/`, `.git/`, `.scratch/`, and anything matching `tests/personal-data-*`** (the deny-list file itself must not be scanned — it contains the forbidden strings by design).
3. For each file, read as UTF-8 and check each deny string as a case-sensitive substring.
4. Collect violations as `{file, denyString}` tuples.
5. Assert the violation list is empty. Failure message names every file+string that matched.

**Self-test:** include one test block that temporarily adds a known string to the deny list, writes a file under a temp dir, asserts the scan catches it, then cleans up. This proves the scanner actually works — an empty deny list would otherwise let any bug sneak past.

**Test blocks:**

- `counterbalance.AC8.4: personal data scan finds no violations against the committed deny list`
- `counterbalance.AC8.4: personal data scan reliably detects a known injected string` (self-test with temp file)
- `counterbalance.AC8.4: deny list file parses as JSON with a "deny" array`

**Verification:**

```bash
node --test tests/personal-data-scan.test.mjs
```

Expected: all 3 test blocks pass on a clean working tree.

**Commit:** `test: add personal data leak scan with configurable deny list`
<!-- END_TASK_3 -->

<!-- START_TASK_4 -->
### Task 4: Upgrade `tests/reference-integrity.test.mjs` to scan more config sources

**Verifies:** counterbalance.AC8.1 (partial — via the reference integrity check that validate also does), counterbalance.AC7.4 (carryover)

**Files:**
- Modify: `c:\Users\david\Repos\counterbalance\tests\reference-integrity.test.mjs`

**Implementation:**

Phase 6 created this file scanning only SKILL.md. Phase 7 extends it to also scan:

1. `plugins/counterbalance/commands/*.md` — bodies may reference `${CLAUDE_PLUGIN_ROOT}/lib/*.mjs` or `${CLAUDE_PLUGIN_ROOT}/skills/.../*.md`. Extract every reference and verify the target exists on disk.
2. `plugins/counterbalance/agents/*.md` — same treatment.
3. `plugins/counterbalance/reviewers.json` — every `agent` field (e.g. `"counterbalance:voice-reviewer"`) must correspond to an existing agent file at `plugins/counterbalance/agents/<name>.md`.

**Add these test blocks:**

- `reference integrity: every ${CLAUDE_PLUGIN_ROOT}-relative path in a command body exists`
- `reference integrity: every ${CLAUDE_PLUGIN_ROOT}-relative path in an agent body exists`
- `reference integrity: every reviewers.json agent entry points to an existing file`

**Extraction regex for `${CLAUDE_PLUGIN_ROOT}/...` references:**

```js
const ROOT_REF = /\$\{CLAUDE_PLUGIN_ROOT\}\/([a-zA-Z0-9_./\\-]+)/g;
```

Resolve each captured path against `plugins/counterbalance/` and assert `fs.existsSync(resolved)`.

**For `reviewers.json` agent entries:** the format is `<plugin-namespace>:<agent-name>` (e.g., `counterbalance:voice-reviewer`). Split on `:`, take the second half, assert `plugins/counterbalance/agents/<name>.md` exists.

**Verification:**

```bash
node --test tests/reference-integrity.test.mjs
```

Expected: all prior tests plus the 3 new ones pass.

**Commit:** `test: extend reference integrity to commands, agents, and registry`
<!-- END_TASK_4 -->

<!-- START_TASK_5 -->
### Task 5: `.markdownlint-cli2.jsonc` — lint config for the project

**Verifies:** counterbalance.AC8.6 (precondition — the workflow in Task 6 runs the lint)

**Files:**
- Create: `c:\Users\david\Repos\counterbalance\.markdownlint-cli2.jsonc`

**Implementation:**

Counterbalance's markdown includes fenced code blocks with the `text` language (for ASCII diagrams in the design plan). Default markdownlint MD040 (`fenced-code-language`) accepts any non-empty language, so no relaxation is strictly required — but we also want to whitelist a known set and reject the rest so accidental typos (`markdwon`) fail the lint.

Also relax MD013 (line-length) — design docs and reference overlays have prose lines longer than the 80-char default, and wrapping them hurts readability.

```jsonc
{
    "config": {
        "default": true,
        "MD013": false,
        "MD040": {
            "allowed_languages": [
                "bash",
                "shell",
                "sh",
                "js",
                "javascript",
                "ts",
                "typescript",
                "json",
                "jsonc",
                "yaml",
                "yml",
                "markdown",
                "md",
                "text",
                "diff"
            ]
        },
        "MD033": false,
        "MD041": false
    },
    "globs": [
        "README.md",
        "CHANGELOG.md",
        "plugins/counterbalance/skills/counterbalance/SKILL.md",
        "plugins/counterbalance/skills/counterbalance/references/*.md"
    ],
    "ignores": [
        "node_modules/**",
        ".scratch/**",
        "docs/design-plans/**",
        "docs/implementation-plans/**"
    ]
}
```

**Why ignore `docs/design-plans/` and `docs/implementation-plans/`:** those are author-side work products that live by different rules — they include long prose paragraphs, mid-sentence backticks, and embedded example code that would all trigger lint noise without actually indicating a defect. Linting them adds friction to planning without catching real problems.

**Disabled rules explained:**

- **MD013 (line length):** off entirely. Counterbalance's prose is designed for reading, not for 80-char wrap.
- **MD033 (no inline HTML):** off. SKILL.md uses HTML comment markers (`<!-- START_TASK_N -->`) as structural anchors.
- **MD041 (first line must be heading):** off. Some reference files start with YAML frontmatter.

**Verification:**

```bash
npx markdownlint-cli2@0.18.0
```

Expected: no errors reported. If any errors fire, either fix the offending file or add the rule to the `config` block with a justification.

**Commit:** `chore: add markdownlint-cli2 config`
<!-- END_TASK_5 -->
<!-- END_SUBCOMPONENT_A -->

<!-- START_SUBCOMPONENT_B (task 6) -->
The GitHub Actions workflow itself.

<!-- START_TASK_6 -->
### Task 6: `.github/workflows/validate.yml` — the CI safety gate

**Verifies:** counterbalance.AC8.1, counterbalance.AC8.2, counterbalance.AC8.6, counterbalance.AC8.7 (the workflow itself + the already-built tests from prior tasks cover all AC8 cases)

**Files:**
- Create: `c:\Users\david\Repos\counterbalance\.github\workflows\validate.yml`

**Implementation:**

```yaml
name: validate

on:
    pull_request:
        branches: [main]
    push:
        branches: [main]
        tags: ['v*']

jobs:
    validate:
        runs-on: ubuntu-latest
        steps:
            - name: Checkout
              uses: actions/checkout@v4
              with:
                  # fetch-depth: 0 ensures version-bump test can see the base ref
                  fetch-depth: 0

            - name: Set up Node
              uses: actions/setup-node@v4
              with:
                  node-version: '22.20.0'

            - name: Install dependencies
              run: npm install

            - name: Install Claude Code CLI
              run: npm install -g @anthropic-ai/claude-code@latest
              # NOTE: pin exact version once you have a known-good one.
              # Leaving @latest for the initial v0.1.0 release; tighten in a follow-up.

            - name: Validate marketplace and plugin manifests
              run: |
                  set -o pipefail
                  # Capture both stdout and stderr so we can inspect the output
                  # even if the exit-code contract is unreliable.
                  OUT=$(claude plugin validate . 2>&1) || RC=$?
                  echo "$OUT"
                  # Belt-and-suspenders: grep for known error-signal strings from
                  # https://code.claude.com/docs/en/plugin-marketplaces#marketplace-validation-errors
                  if echo "$OUT" | grep -Eiq "Invalid JSON syntax|File not found|failed to parse|Duplicate plugin name|Path contains"; then
                      echo "::error ::claude plugin validate reported errors (see above)"
                      exit 1
                  fi
                  # If exit code was non-zero, honor it.
                  if [ "${RC:-0}" != "0" ]; then
                      echo "::error ::claude plugin validate exited ${RC}"
                      exit "${RC}"
                  fi

            - name: Run unit tests
              env:
                  BASE_REF: ${{ github.event.pull_request.base.sha || 'origin/main' }}
              run: node --test tests/

            - name: Lint markdown
              run: npx markdownlint-cli2@0.18.0

            - name: License sanity check
              # Redundant with tests/license-check.test.mjs but provides a clearer
              # failure signal in the CI log if the LICENSE file is ever deleted.
              run: |
                  test -f LICENSE && grep -q "MIT License" LICENSE
```

**Key notes:**

- `fetch-depth: 0` is load-bearing for `tests/version-bump.test.mjs` — without it, `git show origin/main:path` will fail with "unknown revision."
- `BASE_REF` env var is set from the PR base SHA. For push events there's no PR base, so it falls back to `origin/main`.
- The license sanity check is a second-layer gate (the test covers it, but a shell check in the workflow output makes a license deletion instantly readable in the CI log).
- The workflow deliberately does NOT have a separate "install smoke test" step — that's the AC8 stretch item, deferred to v1.1 per the design doc.

**Verification:**

Local verification is tricky since CI only runs on GitHub. Best we can do locally:

```bash
# Run each step manually to confirm it works
npm install
claude plugin validate .
node --test tests/
npx markdownlint-cli2@0.18.0
test -f LICENSE && grep -q "MIT License" LICENSE && echo "license ok"
```

Expected: each command succeeds on a clean working tree. If any fail, fix before pushing.

Full CI verification happens in Task 8 with the intentional-breakage test.

**Commit:** `ci: add GitHub Actions validation workflow`
<!-- END_TASK_6 -->
<!-- END_SUBCOMPONENT_B -->

<!-- START_TASK_7 -->
### Task 7: Run everything locally one more time

**Step 1: Dry-run every CI step in the local shell**

```bash
npm install && \
claude plugin validate . && \
node --test tests/ && \
npx markdownlint-cli2@0.18.0 && \
test -f LICENSE && grep -q "MIT License" LICENSE && \
echo "all-green"
```

Expected: prints `all-green`. Any failure → fix and repeat until green.

**Step 2: Push to a branch and open a PR**

```bash
git push -u origin $(git branch --show-current)
```

Then open a PR in GitHub (via the `gh` CLI or the web UI). The `validate` workflow should fire automatically on PR open.

Do NOT merge yet. Task 8 is next — it deliberately breaks things to verify the gate.

**No commit for this task — verification only.**
<!-- END_TASK_7 -->

<!-- START_TASK_8 -->
### Task 8: Intentional-breakage verification (AC8.7)

**Verifies:** counterbalance.AC8.7

**This task mutates the repo temporarily to verify each gate fails loudly, then reverts every change.** Do each sub-step on a scratch branch, not on main.

**Sub-step 1: Break `plugin.json` JSON syntax**

```bash
git checkout -b scratch/verify-ci-failures
# Edit plugins/counterbalance/.claude-plugin/plugin.json and introduce a
# syntax error (e.g., remove a closing quote from the "name" field).
git add plugins/counterbalance/.claude-plugin/plugin.json
git commit -m "DO NOT MERGE: deliberately broken plugin.json for AC8.7 verification"
git push origin scratch/verify-ci-failures
# Open a PR, wait for CI to run.
```

Expected: the `validate marketplace and plugin manifests` step fails. The failure log contains a clear message referencing `plugins/counterbalance/.claude-plugin/plugin.json` and a JSON parse error. **Copy the exact failure message into the PR description** — this is the proof that AC8.7 is satisfied.

**Sub-step 2: Delete a referenced file**

```bash
git reset --hard main  # revert sub-step 1
rm plugins/counterbalance/skills/counterbalance/references/fallback-voice.md
git add -A
git commit -m "DO NOT MERGE: delete fallback-voice.md for integrity test verification"
git push origin scratch/verify-ci-failures --force-with-lease
```

Expected: the `run unit tests` step fails. The failure log names `fallback-voice.md` via `tests/reference-integrity.test.mjs`.

**Sub-step 3: Change manifest body without bumping version**

```bash
git reset --hard main
# Edit plugins/counterbalance/.claude-plugin/plugin.json and change the "description"
# field without touching "version".
git add -A
git commit -m "DO NOT MERGE: change plugin.json body without version bump"
git push origin scratch/verify-ci-failures --force-with-lease
```

Expected: `tests/version-bump.test.mjs` fails in CI.

**Sub-step 4: Cleanup**

```bash
git reset --hard main
git push origin scratch/verify-ci-failures --force-with-lease
# Or just delete the scratch branch entirely:
git push origin --delete scratch/verify-ci-failures
git branch -D scratch/verify-ci-failures
```

**Record the results.** Add a single commit to the main CI PR with a note summarizing the three scratch-branch verifications:

```text
ci: verified all AC8 failure paths

Intentional breakage verified on scratch/verify-ci-failures:
- malformed plugin.json → `claude plugin validate .` fails with line-referenced error
- missing fallback-voice.md → reference-integrity test fails
- manifest body change w/o version bump → version-bump test fails

Scratch branch deleted. See PR comments for reproduced error output.
```

**No commit for this task beyond the summary note.**
<!-- END_TASK_8 -->

---

## Phase 7 Done When

- `.github/workflows/validate.yml` exists and runs on PR + push to main + tag push
- Five new test files from Tasks 1-4 exist and pass locally
- `.markdownlint-cli2.jsonc` exists and `npx markdownlint-cli2` runs clean
- All AC8.1–8.7 cases verified — AC8.7 specifically verified by Task 8 (intentional breakage)
- CI passes green on a clean main-branch PR

### Documented divergence from the design

**AC8.1 says CI runs `claude plugin validate` on "both the plugin and the marketplace" (two invocations).** This phase intentionally consolidates to a single `claude plugin validate .` at the repo root. Justification:

- The [docs](https://code.claude.com/docs/en/plugin-marketplaces#validation-and-testing) show the marketplace-directory invocation walking into plugins under it, so the single call covers both scopes.
- The per-plugin `claude plugin validate ./plugins/counterbalance` invocation is not explicitly documented and its behavior against a plugin-directory-only target is unverified — running it risks a false negative (the CLI may not support the mode).
- The validation output and error coverage appear equivalent based on the documented error strings.

If later empirical testing shows the single invocation misses something the per-plugin invocation catches, add the second call back in a v0.1.1 follow-up. This divergence is tracked in the PR description for the CI phase and should be linked to an open issue at release time.
