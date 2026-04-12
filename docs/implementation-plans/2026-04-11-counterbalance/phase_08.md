# Counterbalance Phase 8: Publishing Prep and v0.1.0 Release

**Goal:** The plugin is installable from a public GitHub repo. First-time publishing gotchas are documented in README. `v0.1.0` is tagged from a green-CI main branch. A smoke test confirms `claude plugin marketplace add` and `claude plugin install` succeed on a machine other than the dev machine.

**Architecture:** Documentation + version-bump + git tag. No new code, no new tests. This phase finalizes what Phases 1-7 built and ships it.

**Tech Stack:** Markdown (README, CHANGELOG), JSON (manifest version bumps), git tags.

**Scope:** 8 of 8 phases.

**Codebase verified:** 2026-04-12. Phase 1 installed a `README.md` skeleton and a `CHANGELOG.md` skeleton. Phase 1 also pinned `plugins/counterbalance/.claude-plugin/plugin.json` to `version: "0.0.1"` and intentionally omitted `version` from the marketplace plugin entry (because `plugin.json` is authoritative when both are set — verified at https://code.claude.com/docs/en/plugins-reference#metadata-fields). Phase 8 bumps `plugin.json` to `0.1.0` and leaves the marketplace entry version-less.

---

## Acceptance Criteria Coverage

This phase implements and tests:

### counterbalance.AC9: Publishing and install
- **counterbalance.AC9.1 Success:** `v0.1.0` is tagged from a green-CI `main` branch
- **counterbalance.AC9.2 Success:** `claude plugin marketplace add <user>/counterbalance` succeeds against the public repo
- **counterbalance.AC9.3 Success:** `claude plugin install counterbalance@counterbalance` succeeds and makes `/ghost`, `/voice-refresh`, and `/voice-check` available
- **counterbalance.AC9.4 Documented:** README explains that auto-update is disabled by default for third-party marketplaces
- **counterbalance.AC9.5 Documented:** README explains the version-bump requirement for users to see updates

### counterbalance.AC6: Reviewer extension point (carryover)
- **counterbalance.AC6.4 Documented:** README has a "how to add a reviewer" section that walks through the three-file procedure

---

## External Dependency Findings

- ✓ `claude plugin marketplace add <user>/<repo>` — the GitHub shorthand verified at https://code.claude.com/docs/en/plugin-marketplaces#plugin-marketplace-add. Append `@ref` to pin a branch or tag: `david-evan-lovett/counterbalance@v0.1.0`.
- ✓ `claude plugin install <plugin>@<marketplace>` — verified at https://code.claude.com/docs/en/plugins-reference#plugin-install.
- ✓ Third-party marketplaces have auto-update **disabled** by default. Direct quote from https://code.claude.com/docs/en/discover-plugins#configure-auto-updates: "Official Anthropic marketplaces have auto-update enabled by default. Third-party and local development marketplaces have auto-update disabled by default."
- ✓ `claude plugin update <plugin>` is the manual-update command. `claude plugin marketplace update <name>` refreshes the catalog. Users need both: first refresh the marketplace catalog, then update the installed plugin.
- ⚠ The smoke test for AC9.3 requires a machine other than the dev machine — this is a manual step. The plan documents how to run it but can't automate it.

---

## Task Checklist

<!-- START_SUBCOMPONENT_A (tasks 1-2) -->
Flesh out the README and CHANGELOG.

<!-- START_TASK_1 -->
### Task 1: Fill in `README.md`

**Verifies:** counterbalance.AC9.4, counterbalance.AC9.5, counterbalance.AC6.4

**Files:**
- Modify: `c:\Users\david\Repos\counterbalance\README.md`

**Implementation:**

Replace the Phase 1 skeleton with full content. The README is the public-facing document that both humans and `claude plugin validate` look at — it should be useful as documentation AND structurally sound (no broken internal links).

**Required sections:**

1. **`# counterbalance`** — single H1.
2. **One-paragraph intro** (~3 sentences). Lead with what counterbalance does. Second sentence names the two workflows (drafter + reviewer). Third sentence names the architectural commitment (reviewer extension point).
3. **`## Install`** section:
   - The two-command install:
     ```text
     claude plugin marketplace add david-evan-lovett/counterbalance
     claude plugin install counterbalance@counterbalance
     ```
   - A note: "Counterbalance is a third-party marketplace. Auto-update is disabled by default — run `claude plugin marketplace update counterbalance` and `claude plugin update counterbalance@counterbalance` to pull new versions. If you want automatic updates, enable them in the `/plugin` UI under the Marketplaces tab." (This is the literal AC9.4 requirement.)
   - A second note: "When the plugin manifest changes but the version doesn't, your installed copy stays cached. Maintainers bump the version on every user-visible change; if you don't see a new change, check that you've refreshed the marketplace catalog and that the plugin version incremented." (AC9.5 requirement.)
4. **`## Commands`** section — one-line description of each of `/ghost`, `/voice-refresh`, `/voice-check` with a usage example for each.
5. **`## Voice profiles`** section — explain the three-layer cascade (local override → project → user) with the literal paths. Include a "which layer do I want?" table:

   | You want… | Edit this file |
   |---|---|
   | A one-off voice for a specific repo | `./.counterbalance.md` (gitignored by default) |
   | A shared voice for a project your team works on | `./.claude/counterbalance.md` (committed) |
   | Your personal default voice | `~/.claude/plugins/data/counterbalance/profiles/default.md` |

6. **`## CLAUDE.md migration`** section — one-paragraph explanation of the Voice Discovery pre-flight. Make it crystal clear: the plugin reads CLAUDE.md, shows the user what it found, writes to the plugin data directory on approval, and NEVER mutates CLAUDE.md. Link to the agent file if users want to audit the behavior themselves.
7. **`## How to add a reviewer`** section (AC6.4). Walk through the three-file procedure:

   ```markdown
   ## How to add a reviewer

   Counterbalance is designed so that adding a second reviewer (reading-level, AI-slop, grammar, whatever) requires zero changes to any existing file. The procedure is three files.

   ### 1. Add an agent

   Create `plugins/counterbalance/agents/my-reviewer.md` with frontmatter:

   ​```yaml
   ---
   name: my-reviewer
   description: Use when reviewing a draft for [whatever you check].
   model: sonnet
   tools: Read, Grep, Glob
   ---
   ​```

   The body must document the input shape (`draft`, `filePath`, `voiceProfile`) and emit the output contract (`{reviewer, findings: [{line, severity, rule, quote, message, suggested}]}`). See `agents/voice-reviewer.md` as a template.

   **Tools must be scoped to read-only.** Do not declare Write, Edit, or Bash — reviewers are critics, not drafters.

   ### 2. Add a command

   Create `plugins/counterbalance/commands/my-check.md` that dispatches the new agent via Task. See `commands/voice-check.md` as a template.

   ### 3. Register the reviewer

   Append an entry to `plugins/counterbalance/reviewers.json`:

   ​```json
   {
       "id": "my-check",
       "agent": "counterbalance:my-reviewer",
       "command": "/counterbalance:my-check",
       "applies_to": ["**/*.md", "**/*.mdx"],
       "description": "…"
   }
   ​```

   That's it. Run `node --test tests/reviewer-extensibility.test.mjs` to confirm the new reviewer is picked up. No existing file should need changes — if it does, that's a bug in the extension point, not in your reviewer.
   ```

8. **`## Development`** section — how to run tests locally, how to run `claude plugin validate .`, where to find the design plan. Keep to ~8 lines.
9. **`## License`** — one line, link to `LICENSE`.

**Voice note:** The user's voice-guidance file (`C:\Users\david\.claude\CLAUDE.md`) defines the user's preferred writing style. When fleshing out the README, follow those rules — DO-first sentences, one analogy per idea, no oily copy. This README ships publicly and is the user's public-facing writing sample. If the draft ends up reading like generic plugin documentation, rewrite it.

**Verification:**

```bash
npx markdownlint-cli2@0.18.0
```

Expected: no errors. If MD040 complains about a `text` fence, add `text` to `.markdownlint.jsonc`'s `allowed_languages` (it should already be there from Phase 7).

Manual check:

```bash
grep -q "auto-update" README.md && echo "AC9.4 documented"
grep -q "version" README.md && grep -q "update" README.md && echo "AC9.5 documented"
grep -q "How to add a reviewer" README.md && echo "AC6.4 documented"
```

Expected: all three print confirmation.

**Commit:** `docs: fill in README for v0.1.0 release`
<!-- END_TASK_1 -->

<!-- START_TASK_2 -->
### Task 2: Fill in `CHANGELOG.md` for v0.1.0

**Files:**
- Modify: `c:\Users\david\Repos\counterbalance\CHANGELOG.md`

**Implementation:**

Replace the `## [Unreleased]` section from Phase 1 with a real v0.1.0 entry in Keep-a-Changelog style:

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-04-12

### Added
- Drafting engine: `/ghost` dispatches the `counterbalance` subagent through the full Drafting Loop (intake → silent analysis → draft → correction handling → supporting structure → grammar check), including the `<-` correction operator.
- Voice Discovery: `/voice-refresh` runs the CLAUDE.md pre-flight migration and sample-based profile synthesis. The plugin never mutates CLAUDE.md.
- Reviewer pipeline: `/voice-check` dispatches the read-only `voice-reviewer` subagent with line-referenced findings. Reviewer slot is an extension point verified by a fixture test.
- Voice profile resolver: three-layer cascade (local override → project → user) with first-match-wins precedence. CLI entry point at `plugins/counterbalance/lib/resolver.mjs`.
- Reference library: three fleshed genre overlays (PRD, PR, Slack), three scaffold overlays (ADR, summary, feedback), three benchmark fixtures with paired in-voice and AI-slop examples (story, poem, limerick), and a fallback voice guide.
- CI safety gate: `.github/workflows/validate.yml` runs `claude plugin validate`, `node --test`, `markdownlint-cli2`, license checks, version-bump enforcement, and personal-data-leak scanning on every PR.

### Dependencies
- `js-yaml ^4.1.0` (sole runtime dep)
- Node ≥ 22.20.0

## Prior
- Repo scaffolded; see the design plan at `docs/design-plans/2026-04-11-counterbalance.md` for architectural intent.
```

Note: the `## [Unreleased]` section is absorbed into `## [0.1.0]`. Future releases add a new `## [Unreleased]` at the top when work resumes.

**Verification:**

```bash
grep -q "\[0.1.0\] - 2026" CHANGELOG.md && echo "release entry present"
```

Expected: prints confirmation.

**Commit:** `docs: add v0.1.0 changelog entry`
<!-- END_TASK_2 -->
<!-- END_SUBCOMPONENT_A -->

<!-- START_SUBCOMPONENT_B (tasks 3-4) -->
Version bump, tag, and local verification.

<!-- START_TASK_3 -->
### Task 3: Bump `plugin.json` version to `0.1.0`

**Verifies:** (precondition for AC9.1)

**Files:**
- Modify: `c:\Users\david\Repos\counterbalance\plugins\counterbalance\.claude-plugin\plugin.json`

**Implementation:**

Change the version field from `"0.0.1"` to `"0.1.0"`. Nothing else in the manifest changes.

```diff
-    "version": "0.0.1",
+    "version": "0.1.0",
```

Do NOT add a `version` field to the marketplace plugin entry — `plugin.json` is authoritative. The version-bump test from Phase 7 will detect the body change and verify the version was bumped.

**Verification:**

```bash
node -e "console.log(require('./plugins/counterbalance/.claude-plugin/plugin.json').version)"
```

Expected: `0.1.0`.

```bash
node --test tests/version-bump.test.mjs
```

Expected: passes — body of `plugin.json` hasn't actually changed beyond the version field (README, CHANGELOG, and other files are not manifests, so they don't trip the version-bump rule), so the test should either (a) be a trivial pass because `plugin.json` body minus `version` is identical to base, or (b) detect the version bump and pass on that branch.

**Commit:** `chore: bump plugin.json to 0.1.0`
<!-- END_TASK_3 -->

<!-- START_TASK_4 -->
### Task 4: Final local green-check before pushing to main

**Step 1: Run every CI step locally**

```bash
npm install && \
claude plugin validate . && \
node --test tests/ && \
npx markdownlint-cli2@0.18.0 && \
test -f LICENSE && grep -q "MIT License" LICENSE && \
echo "ready-to-ship"
```

Expected: prints `ready-to-ship`.

**Step 2: Review uncommitted changes**

```bash
git status
git diff --stat
```

Expected: README.md, CHANGELOG.md, plugin.json modified. No other files unexpectedly changed.

**Step 3: Commit if not already committed** (Tasks 1-3 should have committed each change, but double-check)

```bash
git log --oneline -10
```

Expected: recent commits for README, CHANGELOG, and plugin.json version bump. If any are missing, commit them now.

**No commit for this task — verification only.**
<!-- END_TASK_4 -->
<!-- END_SUBCOMPONENT_B -->

<!-- START_SUBCOMPONENT_C (tasks 5-7) -->
Merge to main, tag, publish, smoke test.

<!-- START_TASK_5 -->
### Task 5: Merge the release PR and verify green CI on main

**Verifies:** counterbalance.AC8.2 (CI on main), precondition for AC9.1

**Steps:**

1. **Open the release PR** if not already open:

   ```bash
   gh pr create --title "Release v0.1.0" --body "$(cat <<'EOF'
   ## Summary
   - Fleshed README with install, commands, voice profiles, CLAUDE.md migration, and "how to add a reviewer" sections
   - CHANGELOG entry for v0.1.0
   - plugin.json bumped to 0.1.0

   ## Test plan
   - [x] Local green on all CI steps
   - [x] `claude plugin validate .` passes
   - [x] All tests pass

   🤖 Generated with Claude Code
   EOF
   )"
   ```

2. **Wait for CI to pass** on the PR. If any step fails, fix before merging — do not merge red.

3. **Merge to main** using the squash or merge strategy the repo prefers. Once merged, CI runs again on main — verify it's green there too. If CI on main fails after the merge, investigate before tagging.

**No commit for this task — it's git workflow.**
<!-- END_TASK_5 -->

<!-- START_TASK_6 -->
### Task 6: Tag `v0.1.0` and push the tag

**Verifies:** counterbalance.AC9.1

**Steps:**

1. **Pull latest main:**

   ```bash
   git checkout main
   git pull origin main
   ```

2. **Confirm the merged commit has the v0.1.0 version bump:**

   ```bash
   node -e "console.log(require('./plugins/counterbalance/.claude-plugin/plugin.json').version)"
   ```

   Expected: `0.1.0`. If it prints anything else, something went wrong with the merge — stop and investigate.

3. **Tag:**

   ```bash
   git tag -a v0.1.0 -m "v0.1.0 — first public release of counterbalance"
   ```

4. **Push the tag:**

   ```bash
   git push origin v0.1.0
   ```

   The `validate` workflow's `on.push.tags: ['v*']` trigger will fire and run CI on the tag. Wait for it to go green.

5. **Verify the tag is visible on GitHub:**

   ```bash
   gh release list  # Or check the Tags view in the web UI.
   ```

   Expected: `v0.1.0` appears. Optionally create a GitHub Release from the tag using the CHANGELOG entry as the release notes:

   ```bash
   gh release create v0.1.0 --title "v0.1.0" --notes-file <(sed -n '/^## \[0.1.0\]/,/^## /p' CHANGELOG.md | head -n -1)
   ```

**No commit for this task — git workflow.**
<!-- END_TASK_6 -->

<!-- START_TASK_7 -->
### Task 7: Cross-machine smoke test (AC9.2, AC9.3)

**Verifies:** counterbalance.AC9.2, counterbalance.AC9.3

**This is a MANUAL step that cannot be automated.** It runs on a machine other than the dev machine (per the design doc's Definition of Done).

**Setup:** Use a second development machine, a fresh VM, or a clean user profile. Anywhere that doesn't already have counterbalance installed.

**Step 1: Register the marketplace**

```bash
claude plugin marketplace add david-evan-lovett/counterbalance
```

Expected: the command prints confirmation, exit 0. The marketplace is registered at user scope by default.

**If this fails:**
- Wrong GitHub org/repo — confirm the exact public URL
- Repo is private — make it public
- `marketplace.json` malformed — Claude Code validates on add; fix and re-tag

**Step 2: Install the plugin**

```bash
claude plugin install counterbalance@counterbalance
```

Expected: exit 0, installation confirmation. The plugin files are downloaded to `~/.claude/plugins/cache/...`.

**Step 3: Verify commands are available**

Open Claude Code (`claude`). Type `/ghost`. Expected: the command autocompletes and runs (prompting for input). Repeat for `/voice-refresh` and `/voice-check`.

If any command is missing:
- Run `/reload-plugins` in-session
- If still missing, check `plugin.json`'s `commands` field — it should be absent (auto-discovery), not set to a wrong path

**Step 4: End-to-end sanity**

Run `/voice-refresh` — expected: subagent dispatches, CLAUDE.md pre-flight runs (or skips silently if no CLAUDE.md on the test machine). No errors.

Run `/voice-check` against a short test markdown file — expected: reviewer dispatches, returns findings (or an empty list), does not error.

Run `/ghost` with a one-sentence prompt — expected: drafter dispatches, produces output.

**Step 5: Record the smoke test result**

Create a file `docs/release-notes/v0.1.0-smoke-test.md` summarizing:

- Machine used (sanitized — don't commit machine names if they're personal)
- Date/time of smoke test
- Each command tested and outcome
- Any issues found and their fix (or follow-up issue link)

Commit this file with: `docs: record v0.1.0 cross-machine smoke test`.

**If the smoke test fails:** counterbalance v0.1.0 is broken in the wild. Tag `v0.1.0` becomes the canonical "known-broken" tag — don't force-push it. Fix the issue, bump to `0.1.1`, release again.

**No code commit for this task unless the smoke-test result file is added.**
<!-- END_TASK_7 -->
<!-- END_SUBCOMPONENT_C -->

---

## Phase 8 Done When

- `README.md` documents install, commands, voice profiles, CLAUDE.md migration, "how to add a reviewer", and auto-update/version-bump gotchas
- `CHANGELOG.md` has a filled-in `[0.1.0]` section
- `plugin.json` is at version `0.1.0`
- Release PR merged into `main` with green CI
- Tag `v0.1.0` pushed and visible on GitHub; CI on the tag is green
- Cross-machine smoke test confirms `claude plugin marketplace add` and `claude plugin install` succeed, and `/ghost`, `/voice-refresh`, `/voice-check` are available
- Every AC9.* case has documentation or evidence backing it
