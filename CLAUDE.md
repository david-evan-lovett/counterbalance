# counterbalance

Last verified: 2026-04-12

A Claude Code plugin that drafts prose in the user's voice and reviews prose against that voice. The drafter walks notes through an intake-analysis-correction loop; the reviewer is a read-only critic that returns line-referenced findings. The reviewer slot is designed as an extension point — adding a second reviewer is a three-file, zero-touch procedure.

This repo is a single-plugin marketplace: the top level is the marketplace, and the plugin itself lives under `plugins/counterbalance/`.

## Tech Stack

- Node.js `>=22.14.0` (engines floor — not 22.20.0; matches `package.json`)
- ES modules (`"type": "module"`)
- `js-yaml` ^4.1.0 is the only runtime dependency
- `node:test` for the test suite; no Vitest, no Jest
- `markdownlint-cli2@0.18.0` for markdown linting (config file is `.markdownlint-cli2.jsonc`, NOT `.markdownlint.jsonc`)
- GitHub Actions CI at `.github/workflows/validate.yml`

## Commands

```bash
npm install                            # pulls js-yaml
claude plugin validate .               # validates marketplace + plugin manifests
node --test tests/*.test.mjs           # runs the full suite (~92 tests across 15 files)
npx markdownlint-cli2@0.18.0           # lints README, CHANGELOG, SKILL.md, references
```

**Test runner gotcha:** `node --test <dir>` does NOT recurse. Always use the file/glob form `node --test tests/*.test.mjs`. A bare `node --test tests/` will silently run zero files.

Run a single test file with `node --test tests/resolver.test.mjs`.

## Project Structure

```
.claude-plugin/marketplace.json       # marketplace manifest (single-plugin marketplace)
plugins/counterbalance/
├── .claude-plugin/plugin.json        # plugin manifest — AUTHORITATIVE for version
├── agents/
│   ├── counterbalance.md             # drafter (Drafting Loop + Voice Discovery modes)
│   └── voice-reviewer.md             # read-only reviewer (tools: Read, Grep, Glob)
├── commands/
│   ├── ghost.md                      # /ghost — dispatches counterbalance in Drafting Loop
│   ├── voice-refresh.md              # /voice-refresh — dispatches Voice Discovery
│   └── voice-check.md                # /voice-check — dispatches voice-reviewer
├── lib/
│   ├── resolver.mjs                  # 3-layer voice profile resolver + CLI entry
│   ├── parser.mjs                    # voice profile frontmatter/body parser
│   ├── cascade.mjs                   # layer-walking helper (first match wins)
│   ├── windows-path.mjs              # forward-slash normalization for glob matching
│   └── reviewers.mjs                 # reviewers.json loader + applicability matcher
├── reviewers.json                    # reviewer registry (extension point)
└── skills/counterbalance/
    ├── SKILL.md
    └── references/                   # 6 genre overlays + 3 benchmarks + 1 fallback
tests/                                # 15 test files, ~92 tests
docs/
├── design-plans/2026-04-11-counterbalance.md
└── implementation-plans/2026-04-11-counterbalance/  # phase_01..phase_08
```

## Architectural Contracts

**Voice profile resolver (`lib/resolver.mjs`) walks three layers in descending precedence:**

1. `./.counterbalance.md` (local override, gitignored by default)
2. `./.claude/counterbalance.md` (project-shared, committed)
3. `~/.claude/plugins/data/counterbalance/profiles/default.md` (user default)

First layer that parses cleanly wins. `resolveVoice(cwd)` returns `VoiceProfile | null`. The CLI form `node lib/resolver.mjs --cwd=$PWD --json` prints the profile as JSON or the literal string `null`, and is fail-open: any internal error exits 0 with `null` on stdout.

**Voice profile shape:** `{ id, path, frontmatter, body, source }`. Frontmatter is optional — a file with no frontmatter is treated as a pure body. Frontmatter must be a YAML mapping (not a scalar or array) or the file is skipped with a warning.

**Reviewer registry:** `plugins/counterbalance/reviewers.json` is the single source of truth for wired reviewers. Each entry has `{id, agent, command, applies_to, description}`. `lib/reviewers.mjs` loads it and `applicableReviewers(registry, filePath)` filters by glob match on forward-slash-normalized paths.

**Reviewer output contract:** `{reviewer, findings: [{line, severity, rule, quote, message, suggested}]}`.

## Structural Invariants (enforced by tests)

These are not soft rules. Each is asserted by a test file that will fail CI if violated.

- **The plugin NEVER mutates CLAUDE.md.** `tests/claude-md-invariant.test.mjs` greps every agent/command/lib file for CLAUDE.md writes and fails on any match. Voice Discovery reads CLAUDE.md for migration but only writes to the user profile path; users are told to edit their own CLAUDE.md.
- **`voice-reviewer`'s `tools` field is exactly the string `Read, Grep, Glob`.** This is compared literally in `tests/voice-reviewer-wiring.test.mjs`. Do not reorder, add Write/Edit/Bash, or change spacing. Reviewers are read-only critics by construction, enforced at the Claude Code permission layer.
- **Adding a new reviewer touches zero existing files.** `tests/reviewer-extensibility.test.mjs` hashes every existing file, injects a stub reviewer (new agent + new command + appended `reviewers.json` entry), re-hashes, and fails if any pre-existing file's hash changed. The three-file procedure is in README.md under "How to add a reviewer."
- **`plugin.json` is authoritative for version.** `marketplace.json` deliberately omits `version` on the plugin entry — Claude Code reads the version from the plugin manifest itself. `tests/version-bump.test.mjs` enforces this. Do not add a `version` key to the `plugins[]` entry in `marketplace.json`.
- **`package.json` version is NOT the plugin version.** At v0.1.0 release, `plugin.json` is `0.1.0` and `package.json` is still `0.0.1`. That is intentional — `package.json` exists only to pin the `js-yaml` dep and engines floor. If you need the plugin version, read `plugin.json`.

## Key Decisions

- **Three-layer cascade over flag-based selection:** the resolver is silent and path-based, so users can override voice per-repo without editing any config. First match wins; no merging.
- **`parser.mjs` adapted from Anvil's `principles.mjs`** (MIT, attributed in the file header). Changes: returns `VoiceProfile` shape instead of Anvil's flat principle shape, and allows missing frontmatter.
- **Reviewer extensibility as a file-level contract, not a plugin API:** reviewers are just agents + commands + a JSON entry. No programmatic registration, no lifecycle hooks. The test suite is what holds this shape stable.
- **Fail-open resolver CLI:** the CLI exits 0 with `null` on any error, so callers shelling out never see a crash. Errors go to stderr for debugging.

## Boundaries

- Safe to edit: `plugins/counterbalance/`, `tests/`, `docs/`, `README.md`, `CHANGELOG.md`
- Bump version: `plugins/counterbalance/.claude-plugin/plugin.json` only
- Never add: `version` key to `marketplace.json` plugin entries
- Never write: to any CLAUDE.md from plugin code (enforced by test)
- Never declare: Write/Edit/Bash tools on any reviewer agent

## Gotchas

- `path.matchesGlob` is used for reviewer applicability — requires forward-slash paths. Windows paths must be normalized via `lib/windows-path.mjs` first.
- The `parser.mjs` ENOENT branch is intentionally silent. Other fs errors (EACCES, EIO, ELOOP) warn and return null — don't collapse them.
- Voice Discovery's CLAUDE.md migration flow is in `agents/counterbalance.md`, not in a lib file. The match heuristic is a regex on headings matching `/voice|writing|tone|style|register|sentence/i`.
- The skill at `plugins/counterbalance/skills/counterbalance/` has 10 reference files: 6 genre overlays (`genre-*.md`), 3 benchmarks (`benchmark-*.md`), and `fallback-voice.md`. `tests/reference-integrity.test.mjs` enforces that every reference the SKILL.md names actually exists.

## Planning Docs

- `docs/design-plans/2026-04-11-counterbalance.md` — architectural intent and Definition of Done for v0.1.0
- `docs/implementation-plans/2026-04-11-counterbalance/phase_01..phase_08.md` — phased implementation plan (ed3d-plan-and-execute format)
