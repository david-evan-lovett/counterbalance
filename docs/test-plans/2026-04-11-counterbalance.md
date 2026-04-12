# Counterbalance v0.1.0 Human Test Plan

Generated from `docs/implementation-plans/2026-04-11-counterbalance/test-requirements.md` after automated coverage passed (39/39 automatable ACs green). This plan covers the four human-verified criteria plus end-to-end runtime validation of the three slash commands, which can only be exercised inside a live `claude` session.

BASE_SHA: `b5300a0368ec8496736f8de6ba35d2935b8eca80`
HEAD_SHA: `7a1c2a3`

## Prerequisites

- Repo checked out at HEAD (or `v0.1.0` tag) with `npm install` complete.
- Node 22.20.0 available (`node --version`).
- `claude` CLI installed: `npm install -g @anthropic-ai/claude-code@latest` and `claude --version` prints a version.
- `gh` CLI authenticated against `github.com/david-evan-lovett/counterbalance`.
- `node --test tests/*.test.mjs` passes locally before starting (sanity check).
- For the cross-machine sections: a second machine, fresh VM, or clean user profile that does NOT have counterbalance installed. Do NOT run those sections on the dev box.

## Phase 1: v0.1.0 release evidence capture (counterbalance.AC9.1)

Already completed per user direction — `v0.1.0` tag pushed, CI green on tag (GitHub Actions run 24317399445). This phase records the evidence link so the test plan can be re-run as an audit trail.

| Step | Action | Expected |
|------|--------|----------|
| 1.1 | Run `gh run list --branch v0.1.0 --limit 5` | At least one `validate` workflow run with `completed` / `success` status. |
| 1.2 | Run `gh release list --limit 5` | `v0.1.0` visible (if a GitHub Release was cut) OR skip if only the tag exists. |
| 1.3 | Run `git tag --list v0.1.0` | Prints `v0.1.0`. |
| 1.4 | Paste the green-CI run URL into `docs/release-notes/v0.1.0-smoke-test.md` (create if missing) under an `## AC9.1 evidence` heading. | File exists and records the run URL. |

## Phase 2: Deliberate CI breakage evidence capture (counterbalance.AC8.7)

AC8.7 was already verified live during Phase 7 Task 8 (three intentional-breakage sub-steps on a deleted `scratch/verify-ci-failures` branch — see commit `654b2dc ci: verified all AC8 failure paths on scratch/verify-ci-failures` for the full evidence trail with run IDs and catching tests). This phase exists so the evidence can be re-captured by a human at any point as an audit trail. If you're running the plan for the v0.1.0 release itself, you can skip straight to Phase 3 — the automation trail already exists.

### 2.1 Create scratch branch

| Step | Action | Expected |
|------|--------|----------|
| 2.1.1 | `git checkout -b scratch/verify-ci-failures` from main | New branch created. |
| 2.1.2 | Confirm the working tree is clean (`git status`) | Working tree clean. |

### 2.2 Sub-step 1: manifest JSON syntax error

| Step | Action | Expected |
|------|--------|----------|
| 2.2.1 | Edit `plugins/counterbalance/.claude-plugin/plugin.json`. Introduce a syntax error on a known line (e.g., remove a closing quote). Note the exact line number. | File saved with deliberate corruption. |
| 2.2.2 | `git add plugins/counterbalance/.claude-plugin/plugin.json && git commit -m "test: deliberate JSON syntax error for AC8.7"` | Commit created. |
| 2.2.3 | `git push -u origin scratch/verify-ci-failures` and `gh pr create --draft --title "AC8.7 verification" --body "AC8.7 evidence capture — do not merge"` | PR opened as draft. |
| 2.2.4 | Run `gh pr checks` (or watch the PR page) until the `Run unit tests` step finishes. | Step fails with non-zero exit. Note: `claude plugin validate .` does NOT catch plugin.json JSON syntax errors (only marketplace.json); the `tests/manifests.test.mjs` block is the actual gate. |
| 2.2.5 | Open the failed workflow log for the `Run unit tests` step. Read the error message. | Error shows `SyntaxError: Expected ':' after property name in JSON at position N (line N column N)` and names `tests/manifests.test.mjs`. |
| 2.2.6 | Copy the exact failure message into the PR description under a `### Sub-step 1: plugin.json syntax error` heading. | PR description updated with verbatim error. |
| 2.2.7 | `git reset --hard origin/main` to restore plugin.json. Force-push. CI re-runs. | `Run unit tests` step green. |

### 2.3 Sub-step 2: missing reference file

| Step | Action | Expected |
|------|--------|----------|
| 2.3.1 | `git rm plugins/counterbalance/skills/counterbalance/references/fallback-voice.md` | File staged for deletion. |
| 2.3.2 | Commit and force-push. | CI runs. |
| 2.3.3 | Watch `Run unit tests` step, specifically `tests/reference-integrity.test.mjs` output. | Test fails with an assertion naming `fallback-voice.md` as the missing file: `error: 'missing reference file: .../fallback-voice.md'`. |
| 2.3.4 | Copy the exact failure message into the PR description under `### Sub-step 2: missing reference file`. | PR description updated. |
| 2.3.5 | Reset to main, force-push. | CI green. |

### 2.4 Sub-step 3: manifest body change without version bump

| Step | Action | Expected |
|------|--------|----------|
| 2.4.1 | Edit `plugins/counterbalance/.claude-plugin/plugin.json` — change a non-version field (e.g., tweak the description) but leave `version` untouched. | File saved. |
| 2.4.2 | Commit and force-push. | CI runs. |
| 2.4.3 | Watch `Run unit tests` step → `tests/version-bump.test.mjs` output. | Test fails with an assertion showing `0.1.0 -> 0.1.0` and explains the body changed without a bump. |
| 2.4.4 | Copy the exact failure message into the PR description under `### Sub-step 3: missing version bump`. | PR description updated. |
| 2.4.5 | Reset to main, force-push. | CI green. |

### 2.5 Close the scratch branch

| Step | Action | Expected |
|------|--------|----------|
| 2.5.1 | `gh pr close <pr-number> --comment "AC8.7 verification complete — failure messages recorded in description" --delete-branch` | PR closed (not merged), branch deleted. |
| 2.5.2 | `git checkout main && git branch -D scratch/verify-ci-failures` | Local branch deleted. |
| 2.5.3 | Link the closed PR URL into `docs/release-notes/v0.1.0-smoke-test.md` under `## AC8.7 evidence`. | Audit trail in place. |

## Phase 3: Cross-machine install smoke test (counterbalance.AC9.2, counterbalance.AC9.3) — DEFERRED TO v0.1.1

Per user direction, AC9.2 and AC9.3 are deferred to v0.1.1. Do NOT run this phase for the v0.1.0 release. The procedure below is kept in place so it can be lifted verbatim into the v0.1.1 test plan.

### 3.1 (Deferred) Marketplace add and plugin install

| Step | Action | Expected |
|------|--------|----------|
| 3.1.1 | On the clean machine: `claude plugin marketplace add david-evan-lovett/counterbalance` | Command succeeds. Marketplace registered. |
| 3.1.2 | `claude plugin install counterbalance@counterbalance` | Plugin installed. No error. |
| 3.1.3 | `claude plugin list` | `counterbalance` appears in the list with version `0.1.0`. |

### 3.2 (Deferred) Command autocomplete and basic runtime

| Step | Action | Expected |
|------|--------|----------|
| 3.2.1 | Open `claude` in a working directory with at least one `.md` file. | Interactive session. |
| 3.2.2 | Type `/gh` and wait. | `/ghost` autocompletes. |
| 3.2.3 | Type `/voice-re` and wait. | `/voice-refresh` autocompletes. |
| 3.2.4 | Type `/voice-ch` and wait. | `/voice-check` autocompletes. |

### 3.3 (Deferred) Evidence capture for v0.1.1

On v0.1.1, commit `docs/release-notes/v0.1.1-smoke-test.md` with the machine (sanitized), date/time, each command tested, and outcome. Commit message: `docs: record v0.1.1 cross-machine smoke test`.

## End-to-End: /voice-refresh pre-flight happy path

**Purpose:** Validate that counterbalance.AC4.1 through counterbalance.AC4.6 actually behave at runtime the way the documented invariants require. The automated tests prove the agent body *says* the right things; this scenario proves the subagent *does* the right things when invoked. Run this locally on the dev machine against a sandbox directory.

**Setup:**

1. `mkdir -p /tmp/counterbalance-e2e-refresh && cd /tmp/counterbalance-e2e-refresh`
2. Ensure `$HOME/.claude/CLAUDE.md` exists. If it doesn't, create a temporary one with a short voice section (e.g., `# Voice\n\nShort, declarative sentences. No emoji.\n`). Back up any existing CLAUDE.md first.
3. `rm -f $HOME/.claude/plugins/data/counterbalance/profiles/default.md` so the destination is empty.

**Steps:**

| Step | Action | Expected |
|------|--------|----------|
| E1.1 | Launch `claude` in `/tmp/counterbalance-e2e-refresh`. | Session starts. |
| E1.2 | Type `/voice-refresh` and press enter. | Subagent dispatches. Voice Discovery begins. |
| E1.3 | Watch for the pre-flight CLAUDE.md scan output. | Agent displays the extracted voice section(s) **verbatim** before offering to write anything. |
| E1.4 | Confirm the agent uses AskUserQuestion to ask permission to import. | AskUserQuestion prompt appears with yes/no (or `No, skip import`) option. |
| E1.5 | Choose "No, skip import". | Agent does NOT write to `$HOME/.claude/plugins/data/counterbalance/profiles/default.md`. Agent proceeds to the sample-gathering step of Voice Discovery. |
| E1.6 | `ls $HOME/.claude/plugins/data/counterbalance/profiles/` | `default.md` does NOT exist (decline honored). |
| E1.7 | `cat $HOME/.claude/CLAUDE.md` (and diff against the pre-run backup). | CLAUDE.md is BYTE-FOR-BYTE identical to the pre-run backup. The `NEVER mutate CLAUDE.md` invariant held at runtime, not just in the agent prose. |
| E1.8 | Re-run `/voice-refresh`. This time accept the import. | Agent writes `default.md` to the destination. Again, CLAUDE.md itself is unchanged. |
| E1.9 | `cat $HOME/.claude/plugins/data/counterbalance/profiles/default.md` | File exists, contains the voice guidance from CLAUDE.md. |
| E1.10 | Restore the original `$HOME/.claude/CLAUDE.md` from backup. Delete the temporary profile. | Environment restored. |

## End-to-End: /voice-refresh silent no-op path

**Purpose:** Validate counterbalance.AC4.6 — when CLAUDE.md has no voice guidance, the pre-flight is a silent no-op and Voice Discovery proceeds to sample gathering without prompting.

**Setup:**

1. Back up `$HOME/.claude/CLAUDE.md`.
2. Replace CLAUDE.md with a short file that has NO voice guidance (e.g., `# Project notes\n\nSome unrelated bullet points.\n`).

**Steps:**

| Step | Action | Expected |
|------|--------|----------|
| E2.1 | `claude` in a clean temp dir. | Session starts. |
| E2.2 | `/voice-refresh` | Voice Discovery starts. Agent either makes no visible statement about pre-flight OR makes a single "no voice guidance found in CLAUDE.md, skipping" line — NOT a prompt asking the user. |
| E2.3 | Watch until the sample-gathering step begins. | Pre-flight did not block or interrupt. |
| E2.4 | Ctrl+C / exit. Restore backup. | Environment restored. |

## End-to-End: /voice-check on a short markdown file

**Purpose:** Exercise counterbalance.AC5.1 through counterbalance.AC5.5 at runtime: command dispatches the read-only `voice-reviewer` agent, the rendered output matches the documented `### Voice check findings` format, and an empty/clean draft returns empty findings without error.

**Setup:**

1. `mkdir -p /tmp/counterbalance-e2e-check && cd /tmp/counterbalance-e2e-check`
2. Write `/tmp/counterbalance-e2e-check/clean.md` with a short passage that matches an in-voice benchmark (see `plugins/counterbalance/skills/counterbalance/references/benchmark-story.md` for a model).
3. Write `/tmp/counterbalance-e2e-check/sloppy.md` with two or three obvious AI-slop tells (e.g., "In today's fast-paced world, it's more important than ever to leverage cutting-edge solutions.").
4. Write `/tmp/counterbalance-e2e-check/empty.md` as an empty file (`: > empty.md`).

**Steps:**

| Step | Action | Expected |
|------|--------|----------|
| E3.1 | `claude` in the e2e dir. | Session starts. |
| E3.2 | `/voice-check clean.md` | Reviewer runs. Rendered output starts with the literal heading `### Voice check findings` and reports zero violations OR a small number of low-severity findings. No error. |
| E3.3 | `/voice-check sloppy.md` | Reviewer returns one or more findings. Each finding has `line`, `severity`, `rule`, `quote`, `message`, `suggested`. Rendered markdown is readable. |
| E3.4 | `/voice-check empty.md` | Reviewer returns empty findings (documented `empty draft` handling). Does NOT error. Output still begins with `### Voice check findings` and an empty list. |
| E3.5 | During step E3.3, while the reviewer is running, check that it does not write or edit any file in the cwd (`git status` on a known-clean git dir before and after, if possible). | No file modifications. Read-only contract held at runtime. |

## End-to-End: /ghost drafting loop

**Purpose:** Exercise counterbalance.AC3.1 through counterbalance.AC3.6 at runtime. `/ghost` should resolve a voice profile (or fall back to `fallback-voice.md`), dispatch the counterbalance subagent, and produce an output draft.

**Setup:**

1. `mkdir -p /tmp/counterbalance-e2e-ghost && cd /tmp/counterbalance-e2e-ghost`
2. Do NOT create any `.counterbalance.md` or `.claude/counterbalance.md` — force the resolver to fall through to the user layer or to null.
3. Ensure `$HOME/.claude/plugins/data/counterbalance/profiles/default.md` EXISTS (run the happy path above if needed).

**Steps:**

| Step | Action | Expected |
|------|--------|----------|
| E4.1 | `claude` in the e2e dir. | Session starts. |
| E4.2 | `/ghost write a one-paragraph changelog entry for a trivial typo fix` | Resolver runs. Subagent dispatches. Output draft appears. |
| E4.3 | Read the output. | Draft is a reasonable changelog paragraph. Not blank. Not an error. |
| E4.4 | Delete `$HOME/.claude/plugins/data/counterbalance/profiles/default.md`. Also confirm no project/local profiles exist. | No profile available. |
| E4.5 | Re-run `/ghost write one sentence about hats` | Subagent runs. Output draft appears. Agent either cites `fallback-voice.md` or clearly communicates no profile was found and used the fallback. No crash. |
| E4.6 | Restore the deleted profile (re-run `/voice-refresh` happy path) or leave it empty per preference. | Environment in a known state. |

## Human Verification Required (traceability)

| Criterion | Why manual | Test plan section |
|-----------|------------|-------------------|
| counterbalance.AC8.7 | Failure message readability is a human judgment. Already verified live during Phase 7 Task 8 (commit `654b2dc`); re-runnable via Phase 2. | Phase 2 |
| counterbalance.AC9.1 | Git-workflow event, not a property of the code. Verified during Phase 8 tag push. | Phase 1 |
| counterbalance.AC9.2 | Requires a machine other than the dev box. | Phase 3 (deferred to v0.1.1) |
| counterbalance.AC9.3 | Requires a machine other than the dev box + interactive `claude` CLI. | Phase 3 (deferred to v0.1.1) |

## Traceability: acceptance criteria to verification

| Acceptance Criterion | Automated Test | Manual Step |
|----------------------|----------------|-------------|
| counterbalance.AC1.1 | `tests/skill-structure.test.mjs` | — |
| counterbalance.AC1.2 | `tests/skill-structure.test.mjs` | — |
| counterbalance.AC1.3 | `tests/skill-structure.test.mjs` | — |
| counterbalance.AC2.1 | `tests/resolver.test.mjs` | — |
| counterbalance.AC2.2 | `tests/resolver.test.mjs` | — |
| counterbalance.AC2.3 | `tests/resolver.test.mjs` | — |
| counterbalance.AC2.4 | `tests/resolver.test.mjs` | — |
| counterbalance.AC2.5 | `tests/resolver.test.mjs` | — |
| counterbalance.AC2.6 | `tests/windows-path.test.mjs` + `tests/resolver.test.mjs` | — |
| counterbalance.AC2.7 | `tests/parser.test.mjs` | — |
| counterbalance.AC3.1 | `tests/agent-wiring.test.mjs` | E2E /ghost (E4) |
| counterbalance.AC3.2 | `tests/agent-wiring.test.mjs` | E2E /ghost (E4.2) |
| counterbalance.AC3.3 | `tests/agent-wiring.test.mjs` | E2E /voice-refresh (E1, E2) |
| counterbalance.AC3.4 | `tests/agent-wiring.test.mjs` | E2E /ghost (E4.2) |
| counterbalance.AC3.5 | `tests/agent-wiring.test.mjs` | — |
| counterbalance.AC3.6 | `tests/agent-wiring.test.mjs` | E2E /ghost null-profile (E4.4–E4.5) |
| counterbalance.AC4.1 | `tests/agent-wiring.test.mjs` | E2E /voice-refresh (E1.3) |
| counterbalance.AC4.2 | `tests/agent-wiring.test.mjs` | E2E /voice-refresh (E1.3–E1.4) |
| counterbalance.AC4.3 | `tests/agent-wiring.test.mjs` | E2E /voice-refresh (E1.8–E1.9) |
| counterbalance.AC4.4 | `tests/claude-md-invariant.test.mjs` | E2E /voice-refresh (E1.7) — runtime confirmation of invariant |
| counterbalance.AC4.5 | `tests/agent-wiring.test.mjs` | E2E /voice-refresh (E1.5) |
| counterbalance.AC4.6 | `tests/agent-wiring.test.mjs` | E2E /voice-refresh silent no-op (E2) |
| counterbalance.AC5.1 | `tests/voice-reviewer-wiring.test.mjs` | E2E /voice-check (E3.2) |
| counterbalance.AC5.2 | `tests/voice-reviewer-wiring.test.mjs` | E2E /voice-check read-only check (E3.5) |
| counterbalance.AC5.3 | `tests/voice-reviewer-wiring.test.mjs` | E2E /voice-check (E3.3) |
| counterbalance.AC5.4 | `tests/voice-reviewer-wiring.test.mjs` | E2E /voice-check (E3.2) |
| counterbalance.AC5.5 | `tests/voice-reviewer-wiring.test.mjs` | E2E /voice-check (E3.4) |
| counterbalance.AC6.1 | `tests/reviewers.test.mjs` | — |
| counterbalance.AC6.2 | `tests/reviewers.test.mjs` | — |
| counterbalance.AC6.3 | `tests/reviewer-extensibility.test.mjs` | — |
| counterbalance.AC6.4 | `README.md` (Phase 8 Task 1 grep) | — |
| counterbalance.AC7.1 | `tests/reference-integrity.test.mjs` | — |
| counterbalance.AC7.2 | `tests/reference-integrity.test.mjs` | — |
| counterbalance.AC7.3 | `tests/reference-integrity.test.mjs` | — |
| counterbalance.AC7.4 | `tests/reference-integrity.test.mjs` | — |
| counterbalance.AC8.1 | `.github/workflows/validate.yml` | Phase 2 sub-step 1 |
| counterbalance.AC8.2 | `.github/workflows/validate.yml` | — |
| counterbalance.AC8.3 | `tests/version-bump.test.mjs` | Phase 2 sub-step 3 |
| counterbalance.AC8.4 | `tests/personal-data-scan.test.mjs` | — |
| counterbalance.AC8.5 | `tests/license-check.test.mjs` + `validate.yml` | — |
| counterbalance.AC8.6 | `.github/workflows/validate.yml` + `.markdownlint-cli2.jsonc` | — |
| counterbalance.AC8.7 | `.github/workflows/validate.yml` (gate itself) | Phase 2 (evidence capture) |
| counterbalance.AC9.1 | — | Phase 1 |
| counterbalance.AC9.2 | — | Phase 3 (deferred v0.1.1) |
| counterbalance.AC9.3 | — | Phase 3 (deferred v0.1.1) |
| counterbalance.AC9.4 | `README.md` (Phase 8 Task 1 grep) | — |
| counterbalance.AC9.5 | `README.md` (Phase 8 Task 1 grep) | — |
