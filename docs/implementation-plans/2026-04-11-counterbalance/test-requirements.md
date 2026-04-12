# Counterbalance Test Requirements

Generated from docs/design-plans/2026-04-11-counterbalance.md. Every acceptance criterion below must map to either a verifiable automated test (unit / integration / e2e) or a documented human-verification procedure. The code-reviewer and test-analyst agents consume this document during execution to validate coverage.

## Automated Test Coverage

### counterbalance.AC1: Skill extraction

| AC | Test type | Test file | Notes |
|---|---|---|---|
| counterbalance.AC1.1 | unit | tests/skill-structure.test.mjs | Parses `plugins/counterbalance/skills/counterbalance/SKILL.md` frontmatter via `js-yaml`; asserts `name === "counterbalance"`, `description` non-empty, `user-invocable === false`. |
| counterbalance.AC1.2 | unit | tests/skill-structure.test.mjs | Asserts SKILL.md body contains literal `"Voice Discovery"`, `"Drafting Loop"`, and the `<-` correction operator (heuristic: `<-` and the word `"correction"` within 500 chars of each other). |
| counterbalance.AC1.3 | unit | tests/skill-structure.test.mjs | `fs.stat` asserts `references/fallback-voice.md` exists with non-zero size AND SKILL.md body contains the literal `"references/fallback-voice.md"`. |

### counterbalance.AC2: Voice profile resolver

| AC | Test type | Test file | Notes |
|---|---|---|---|
| counterbalance.AC2.1 | integration | tests/resolver.test.mjs | `mkdtemp`-backed: creates only `$tmp/.counterbalance.md`, asserts `resolveVoice(tmp).source === "local"` and `path` ends with `.counterbalance.md`. |
| counterbalance.AC2.2 | integration | tests/resolver.test.mjs | Creates only `$tmp/.claude/counterbalance.md`, asserts returned `source === "project"`. |
| counterbalance.AC2.3 | integration | tests/resolver.test.mjs | Overrides `HOME`/`USERPROFILE` to a temp home, creates `.claude/plugins/data/counterbalance/profiles/default.md` there, asserts `source === "user"`. |
| counterbalance.AC2.4 | integration | tests/resolver.test.mjs | Two blocks: (a) all three layers present — asserts `source === "local"` (first-match-wins); (b) project + user present — asserts `source === "project"`. |
| counterbalance.AC2.5 | integration | tests/resolver.test.mjs | Empty temp dir with no HOME override — asserts `resolveVoice(tmp)` returns `null`. |
| counterbalance.AC2.6 | unit + integration | tests/windows-path.test.mjs, tests/resolver.test.mjs | `toForwardSlashes('foo\\bar\\baz.md') === 'foo/bar/baz.md'` on all platforms (unit); Windows-host integration test asserts backslash cwd resolves to an absolute parseable path (`t.skip('Windows only')` on non-Windows). |
| counterbalance.AC2.7 | unit | tests/parser.test.mjs | Writes a file with invalid YAML frontmatter (`---\nid: [unclosed\n---\nbody\n`), asserts `parseVoiceProfile` returns `null` and emits a `[counterbalance] Skipping voice profile (bad YAML):` warning. |

### counterbalance.AC3: Drafting workflow

| AC | Test type | Test file | Notes |
|---|---|---|---|
| counterbalance.AC3.1 | unit | tests/agent-wiring.test.mjs | Parses `commands/ghost.md` frontmatter; asserts `description`, `allowed-tools` (includes `Task`), and `argument-hint` are all present and non-empty; body contains literal `"counterbalance subagent"` (dispatch). |
| counterbalance.AC3.2 | unit | tests/agent-wiring.test.mjs | Asserts `commands/ghost.md` body contains literal `"lib/resolver.mjs"` and the string `"resolved_profile"` (resolver call + profile passed to subagent). |
| counterbalance.AC3.3 | unit | tests/agent-wiring.test.mjs | Asserts `commands/voice-refresh.md` exists with valid frontmatter AND body contains both `"counterbalance"` and `"Voice Discovery"`. |
| counterbalance.AC3.4 | unit | tests/agent-wiring.test.mjs | Asserts `agents/counterbalance.md` body contains `"Drafting Loop"` and the `<-` correction operator instruction (same proximity heuristic as AC1.2). |
| counterbalance.AC3.5 | unit | tests/agent-wiring.test.mjs | Parses agent frontmatter and literally compares `tools` string to `"Read, Write, Edit, Glob, Grep, Bash, AskUserQuestion, Task"`. No over-broad permissions. |
| counterbalance.AC3.6 | unit | tests/agent-wiring.test.mjs | Asserts agent body references `fallback-voice.md` as the null-profile fallback path. |

### counterbalance.AC4: Voice Discovery CLAUDE.md pre-flight migration

| AC | Test type | Test file | Notes |
|---|---|---|---|
| counterbalance.AC4.1 | unit | tests/agent-wiring.test.mjs | Asserts agent body references scanning `$HOME/.claude/CLAUDE.md` AND contains the literal substring `heading-agnostic` (case-insensitive). |
| counterbalance.AC4.2 | unit | tests/agent-wiring.test.mjs | Asserts agent body contains both `"verbatim"` and `"AskUserQuestion"` within 500 chars of each other (show-before-write invariant). |
| counterbalance.AC4.3 | unit | tests/agent-wiring.test.mjs | Asserts agent body references destination `$HOME/.claude/plugins/data/counterbalance/profiles/default.md`. |
| counterbalance.AC4.4 | unit | tests/claude-md-invariant.test.mjs | Walks every file under `plugins/counterbalance/{agents,commands,lib}/`; for each `CLAUDE.md` occurrence, takes a ±60 char window and flags any match against `/\b(Write|writeFile|fs\.writeFile|Edit|overwrite)\b/`. Asserts violation list is empty. Second block: asserts `agents/counterbalance.md` contains the literal `"NEVER mutate CLAUDE.md"`. |
| counterbalance.AC4.5 | unit | tests/agent-wiring.test.mjs | Asserts agent body has a decline-proceeds-normally branch: contains `"No, skip import"` or `"declines"` AND mentions proceeding to sample gathering. |
| counterbalance.AC4.6 | unit | tests/agent-wiring.test.mjs | Asserts agent body contains the literal `"silent no-op"` (pre-flight is a silent no-op when CLAUDE.md has no voice guidance). |

### counterbalance.AC5: Reviewer pipeline (/voice-check)

| AC | Test type | Test file | Notes |
|---|---|---|---|
| counterbalance.AC5.1 | unit | tests/voice-reviewer-wiring.test.mjs | Parses `commands/voice-check.md` frontmatter; asserts `description`, `allowed-tools` (includes `Task`), `argument-hint` present; body contains literal `"voice-reviewer"` (dispatches subagent). |
| counterbalance.AC5.2 | unit | tests/voice-reviewer-wiring.test.mjs | Parses `agents/voice-reviewer.md` frontmatter; literally compares `tools` to `"Read, Grep, Glob"`; asserts none of `Write`, `Edit`, `Bash` appear anywhere in the tools field. Structural enforcement of the read-only contract. |
| counterbalance.AC5.3 | unit | tests/voice-reviewer-wiring.test.mjs | Extracts content between the first ` ```json ` and its closing fence in the "Output contract" section and asserts each of the seven field names (`reviewer`, `findings`, `line`, `severity`, `rule`, `quote`, `message`, `suggested`) appears inside that slice. |
| counterbalance.AC5.4 | unit | tests/voice-reviewer-wiring.test.mjs | Asserts agent body contains the literal `"### Voice check findings"` (documented rendered markdown output format). |
| counterbalance.AC5.5 | unit | tests/voice-reviewer-wiring.test.mjs | Asserts agent body contains the literal `"empty draft"` (case-insensitive) near `"empty findings"` or `"zero violations"` — empty draft handling documented as non-error. |

### counterbalance.AC6: Reviewer extension point

| AC | Test type | Test file | Notes |
|---|---|---|---|
| counterbalance.AC6.1 | unit | tests/reviewers.test.mjs | `loadRegistry` reads the shipped `plugins/counterbalance/reviewers.json` and asserts `registry.reviewers[0].id === "voice-check"` with `applies_to` containing `**/*.md` and `**/*.mdx`. |
| counterbalance.AC6.2 | unit | tests/reviewers.test.mjs | Four blocks: `applicableReviewers` returns voice-check for `docs/foo.md`, for `docs/foo.mdx`, returns `[]` for `src/foo.ts`, and normalizes `docs\\foo.md` (Windows backslashes) correctly. Plus error-path blocks for missing / malformed / no-array registries. |
| counterbalance.AC6.3 | integration | tests/reviewer-extensibility.test.mjs | Copies the entire `plugins/counterbalance/` tree to `mkdtemp`, records sha256 hashes of every file (except `reviewers.json`), drops in stub `agents/stub-reviewer.md` + `commands/stub-check.md` + a second `reviewers.json` entry, re-hashes the same files and asserts equality (zero existing files touched). Second block: `applicableReviewers` returns two entries after the stub is added. |

### counterbalance.AC7: Reference library

| AC | Test type | Test file | Notes |
|---|---|---|---|
| counterbalance.AC7.1 | unit | tests/reference-integrity.test.mjs | Explicit `fs.stat` loop over `genre-prd.md`, `genre-pr.md`, `genre-slack.md`, `genre-adr.md`, `genre-summary.md`, `genre-feedback.md` under `plugins/counterbalance/skills/counterbalance/references/`. |
| counterbalance.AC7.2 | unit | tests/reference-integrity.test.mjs | Explicit `fs.stat` loop over `benchmark-story.md`, `benchmark-poem.md`, `benchmark-limerick.md`. |
| counterbalance.AC7.3 | unit | tests/reference-integrity.test.mjs | For each benchmark file, reads the body and asserts it contains both `## In-voice draft` and `## AI-slop draft` (or loose-regex equivalents). |
| counterbalance.AC7.4 | unit | tests/reference-integrity.test.mjs | Extracts every `references/<name>.md` mention from SKILL.md via regex `/references\/([a-z0-9-]+\.md)/g` and asserts each file exists via `assert.ok(existsSync(p), 'missing reference file: ${p}')`. Phase 7 extends this to scan command bodies, agent bodies, and `reviewers.json` agent entries. |

### counterbalance.AC8: CI safety gate

| AC | Test type | Test file | Notes |
|---|---|---|---|
| counterbalance.AC8.1 | e2e (CI workflow) | .github/workflows/validate.yml | `validate marketplace and plugin manifests` step runs `claude plugin validate .` at the repo root (single invocation validates marketplace + nested plugin). Belt-and-suspenders: greps output for `Invalid JSON syntax\|File not found\|failed to parse\|Duplicate plugin name\|Path contains` and exits 1 on match, in addition to honoring a non-zero exit code. |
| counterbalance.AC8.2 | e2e (CI workflow) | .github/workflows/validate.yml | `run unit tests` step executes `node --test tests/` with `BASE_REF` set from `github.event.pull_request.base.sha`. Any test failure blocks the merge via the GitHub required-check. |
| counterbalance.AC8.3 | integration | tests/version-bump.test.mjs | Reads base-ref version of `plugin.json` and `marketplace.json` via `git show`, drops the `version` key, deterministically stringifies, compares. If body differs, asserts version was bumped via string-split semver comparator. Four blocks: plugin.json bump, marketplace.json bump, no-bump-needed control, and base-ref-missing skip-clean safety. |
| counterbalance.AC8.4 | unit | tests/personal-data-scan.test.mjs | Loads `tests/personal-data-deny-list.json`, walks `plugins/`, `tests/`, `README.md`, `CHANGELOG.md`, and both manifests (skipping `node_modules`, `.git`, `.scratch`, and `tests/personal-data-*`), asserts no committed file contains any deny-list substring. Three blocks including a self-test that injects a known string into a temp file and verifies the scanner catches it. |
| counterbalance.AC8.5 | unit + e2e | tests/license-check.test.mjs + .github/workflows/validate.yml | Three test blocks: LICENSE file exists and contains literal `"MIT License"`, marketplace.json plugin entry has `license === "MIT"`, plugin.json has `license === "MIT"`. Workflow also re-greps LICENSE in the `License sanity check` step for a clearer CI failure signal. |
| counterbalance.AC8.6 | e2e (CI workflow) | .github/workflows/validate.yml | `Lint markdown` step runs `npx markdownlint-cli2@0.18.0`. `.markdownlint.jsonc` globs scope the lint to `README.md`, `CHANGELOG.md`, `SKILL.md`, and `references/*.md`. |
| counterbalance.AC8.7 | manual (one-time, Phase 7 Task 8) | Phase 7 Task 8 sub-steps | Scratch branch introduces a syntax error in `plugins/counterbalance/.claude-plugin/plugin.json`, pushes, opens PR, verifies the `validate marketplace and plugin manifests` step fails with a clear line-referenced error naming the file. Exact failure message copied into the PR description as evidence. Sub-steps 2 and 3 additionally verify reference-integrity and version-bump gates fail loudly on deliberate breakage. See Human Verification section below — this is a one-time test of the gate, not an ongoing automated test. |

#### Documentation Verification

These criteria are marked "Documented" in the design — verified by README content, not by executable behavior. Phase 8 Task 1 includes grep checks, and they are also covered by markdownlint-cli2 parsing in CI (AC8.6) for structural validity.

| AC | Test type | Test file / check | Notes |
|---|---|---|---|
| counterbalance.AC6.4 | docs grep | Phase 8 Task 1 verification: `grep -q "How to add a reviewer" README.md` | Asserts README has the "How to add a reviewer" section walking through the three-file procedure (agent + command + `reviewers.json` entry). Can be promoted to a `tests/readme-sections.test.mjs` regex scan if desired — currently verified by the Phase 8 Task 1 grep gate before release. |
| counterbalance.AC9.4 | docs grep | Phase 8 Task 1 verification: `grep -q "auto-update" README.md` | Asserts README explains auto-update is disabled by default for third-party marketplaces. |
| counterbalance.AC9.5 | docs grep | Phase 8 Task 1 verification: `grep -q "version" README.md && grep -q "update" README.md` | Asserts README explains the version-bump requirement for users to see updates. |

## Human Verification Required

Some criteria cannot be fully automated. These require manual verification at release time.

### counterbalance.AC8.7 — Deliberate CI breakage evidence capture

**Why not fully automated:** This AC verifies that CI fails *loudly* on a malformed manifest. The test itself is an automated tool (`claude plugin validate`), but the evidence capture — "the failure message is clear and line-referenced" — is a human readability judgment that has to be observed once.

**Verification procedure:** See Phase 7 Task 8. On a `scratch/verify-ci-failures` branch, introduce a JSON syntax error in `plugins/counterbalance/.claude-plugin/plugin.json`, push, open a PR, and confirm the CI `validate marketplace and plugin manifests` step fails with a clear error naming the file and line. Repeat for sub-step 2 (delete `fallback-voice.md` and confirm `tests/reference-integrity.test.mjs` fails naming the missing file) and sub-step 3 (change a manifest body without bumping and confirm `tests/version-bump.test.mjs` fails).

**Evidence to capture:** Paste the exact failure message from each sub-step into the PR description on `scratch/verify-ci-failures` before discarding the branch. Keep the PR closed-without-merge as the audit trail.

### counterbalance.AC9.1 — v0.1.0 tagged from green-CI main

**Why not automated:** This is a git-workflow event ("tag was created after a green CI run on main"), not a property of the code. No test inside the repo can retroactively verify the CI color of the tagged commit without querying GitHub state, and the release flow itself is a one-shot manual gate.

**Verification procedure:** See Phase 8 Tasks 5 and 6. Open the release PR, wait for `validate` workflow to go green, merge to main, wait for `validate` to go green on main, then `git tag -a v0.1.0` and `git push origin v0.1.0`. Wait for the tag-triggered workflow run to go green.

**Evidence to capture:** Screenshot or `gh run list --branch v0.1.0` output showing the green CI run on the tag. `gh release list` showing `v0.1.0` is visible. Optional `gh release create v0.1.0` release notes.

### counterbalance.AC9.2, counterbalance.AC9.3 — Cross-machine install smoke test

**Why not automated:** Requires a machine other than the dev machine. Can't be reliably run inside GitHub Actions against a public marketplace that doesn't exist yet at PR time, and requires interactive `claude` CLI access.

**Verification procedure:** See Phase 8 Task 7. On a clean machine (second dev box, fresh VM, or clean user profile), run `claude plugin marketplace add david-evan-lovett/counterbalance` followed by `claude plugin install counterbalance@counterbalance`, then open `claude` and type `/ghost`, `/voice-refresh`, and `/voice-check` to confirm each autocompletes and runs. End-to-end sanity: run `/voice-refresh` (pre-flight runs or silently skips), `/voice-check` against a short markdown file (returns findings or empty list without error), and `/ghost` with a one-sentence prompt (produces output).

**Evidence to capture:** Commit `docs/release-notes/v0.1.0-smoke-test.md` summarizing the machine used (sanitized), date/time, each command tested, outcome, and any issues found plus follow-up links. Commit message: `docs: record v0.1.0 cross-machine smoke test`.

## Coverage Summary

- Total ACs in design: 43
- Automated (including documentation grep checks): 39
- Human-verified: 4 (AC8.7 evidence capture, AC9.1, AC9.2, AC9.3)
- Uncovered: 0

Note: AC8.7 appears in both the Automated table (via the CI workflow's grep-based error detection in Phase 7 Task 6) and the Human Verification section (via the one-time evidence-capture procedure in Phase 7 Task 8). The gate itself is automated; the one-time verification that the gate's failure message is clear and line-referenced is manual. It is counted once — under Human Verification — in the totals above.
