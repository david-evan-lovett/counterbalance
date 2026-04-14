# counterbalance

Last verified: 2026-04-13

A Claude Code plugin that drafts prose in the user's voice and reviews prose against that voice via a multi-reviewer pipeline. The drafter walks notes through an intake-analysis-correction loop. Reviewers are read-only critics that return line-referenced findings; `/prose-review` is a meta-command that dispatches a selected subset of reviewers in parallel and merges the output. The reviewer slot is designed as an extension point — adding a new reviewer is a three-file, zero-touch procedure for both agent-type and lib-type reviewers.

This repo is a single-plugin marketplace: the top level is the marketplace, and the plugin itself lives under `plugins/counterbalance/`.

## Tech Stack

- Node.js `>=22.14.0` (engines floor — not 22.20.0; matches `package.json`)
- ES modules (`"type": "module"`)
- Runtime dependencies: `js-yaml` ^4.1.0 (voice profile parsing), `flesch-kincaid` ^2.0.1, `syllable` ^5.0.1, `sbd` ^1.0.19 (all three used by the mechanical lib reviewers)
- `node:test` for the test suite; no Vitest, no Jest
- `markdownlint-cli2@0.18.0` for markdown linting (config file is `.markdownlint-cli2.jsonc`, NOT `.markdownlint.jsonc`)
- GitHub Actions CI at `.github/workflows/validate.yml`

## Commands

```bash
npm install                            # pulls js-yaml + flesch-kincaid + syllable + sbd
claude plugin validate .               # validates marketplace + plugin manifests
node --test tests/*.test.mjs           # runs the full suite (217 tests across 25 files)
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
│   ├── voice-reviewer.md             # voice profile critic
│   ├── cliche-hunter.md              # AI-slop / stock metaphor critic (Sonnet)
│   ├── opener-check.md               # forbidden-opener critic (Sonnet)
│   ├── cuttability.md                # filler / redundancy critic (Sonnet)
│   └── concrete-vs-abstract.md       # evidence-vs-evaluation critic (Sonnet)
├── commands/
│   ├── ghost.md                      # /ghost — drafts prose to a file with sidecar metadata
│   ├── ghost-correct.md              # /ghost-correct — applies <- corrections to a draft in place
│   ├── voice-refresh.md              # /voice-refresh — dispatches Voice Discovery
│   ├── prose-review.md               # /prose-review — meta-command, orchestrates parallel review
│   ├── voice-check.md                # /voice-check — single agent reviewer
│   ├── cliche-check.md               # /cliche-check — single agent reviewer
│   ├── opener-check.md               # /opener-check — single agent reviewer
│   ├── cut-check.md                  # /cut-check — single agent reviewer
│   ├── concrete-check.md             # /concrete-check — single agent reviewer
│   ├── readability.md                # /readability — single lib reviewer (shells mech-review)
│   ├── repetition-check.md           # /repetition-check — single lib reviewer
│   ├── spread-check.md               # /spread-check — single lib reviewer
│   └── passive-check.md              # /passive-check — single lib reviewer
├── lib/
│   ├── resolver.mjs                  # 4-layer voice profile resolver + CLI entry
│   ├── parser.mjs                    # voice profile frontmatter/body parser
│   ├── claude-md-parser.mjs          # layer-4 parser: extracts a voice section from CLAUDE.md
│   ├── cascade.mjs                   # layer-walking helper (first match wins)
│   ├── windows-path.mjs              # forward-slash normalization for glob matching
│   ├── drafts-dir.mjs                # 3-layer drafts directory resolver + CLI entry
│   ├── correction-parser.mjs         # parses <- markers out of a draft (strips code fences) + CLI
│   ├── reviewers.mjs                 # registry loader, applicability, expandPreset, partitionByType, aggregateFindings
│   ├── md-preprocess.mjs             # stripMarkdown — shared preprocessor for lib reviewers
│   ├── stopwords.mjs                 # STOPWORDS set + isStopword
│   ├── readability.mjs               # lib reviewer — Flesch-Kincaid 9–13 band
│   ├── repetition.mjs                # lib reviewer — 5-sentence window overuse
│   ├── spread.mjs                    # lib reviewer — 4+ same-length-bucket runs
│   └── passive.mjs                   # lib reviewer — to-be + past-participle heuristic
├── bin/
│   ├── mech-review.mjs               # parallel lib-reviewer runner (one Bash invocation for all libs)
│   └── registry-query.mjs            # registry helper for /prose-review (applicable, expand, intersect, partition)
├── reviewers.json                    # reviewer registry + presets (extension point)
├── skills/
│   ├── counterbalance/
│   │   ├── SKILL.md                  # drafter skill
│   │   └── references/               # 6 genre overlays + 3 benchmarks + 4 rubrics
│   └── prose-review/
│       └── SKILL.md                  # orchestration skill for /prose-review
└── package.json                      # pins engines floor + lib-reviewer deps (NOT plugin version)
tests/                                # 28 test files, 295 tests
docs/
├── design-plans/2026-04-11-counterbalance.md
└── implementation-plans/2026-04-11-counterbalance/  # phase_01..phase_08
```

## Architectural Contracts

**Voice profile resolver (`lib/resolver.mjs`) walks four layers in descending precedence:**

1. `./.counterbalance.md` (local override, gitignored by default)
2. `./.claude/counterbalance.md` (project-shared, committed)
3. `~/.claude/plugins/data/counterbalance/profiles/default.md` (user default)
4. A voice-section extraction from `~/.claude/CLAUDE.md` via `lib/claude-md-parser.mjs` — last-ditch convenience for users who already keep a voice section in their global CLAUDE.md

First layer that parses cleanly wins. `resolveVoice(cwd)` returns `VoiceProfile | null`. When layer 4 fires, the returned profile has `source: "claude-md"` and its body is the extracted section verbatim (including the matched heading line). Layer 4 is terminated by the next heading of equal-or-higher level. The CLI form `node lib/resolver.mjs --cwd=$PWD --json` prints the profile as JSON or the literal string `null`, and is fail-open: any internal error exits 0 with `null` on stdout.

**Null resolution is a bounce, not a fallback.** If all four layers miss, `/ghost` and `/voice-check` refuse to dispatch and point the user at `/voice-refresh`. There is no generic fallback voice — `references/fallback-voice.md` was deleted along with the old "silent fallback" pattern. The voice-reviewer agent handles null as a structured `{findings: [], error: ...}` payload so `/prose-review` can still run a multi-reviewer batch and surface the error in its errors section.

**Drafts directory resolver (`lib/drafts-dir.mjs`) walks two layers:**

1. `--out=<path>` (explicit flag, resolved against cwd if relative)
2. `<cwd>/drafts` (default — auto-created if missing)

Drafts default to project-local because drafts belong next to the work they're about. The cascade used to have a user-level fallback at `~/.claude/plugins/data/counterbalance/drafts/<cwd-basename>/` but that was removed after the first real dogfood run — the fallback path was unfriendly to type and surprising in practice. When `/ghost` runs outside any project (e.g., from a shell in the home directory), the resolver still creates a `drafts/` folder at the current working directory, which is almost always what the user meant by running `/ghost` there.

`resolveDraftsDir({cwd, outFlag})` returns an absolute path. The CLI form `node lib/drafts-dir.mjs --cwd=$PWD [--out=<path>]` prints the resolved path. Drafts-dir exits non-zero on any failure — most notably when a FILE named `drafts` already exists in cwd (surfaces as `EEXIST`/`ENOTDIR` from the underlying `mkdir`), which is a clear error the caller can relay verbatim.

**Correction parser (`lib/correction-parser.mjs`)** extracts `<-` markers out of a draft file for `/ghost-correct`. Parses lines outside fenced code blocks and inline backtick spans, returns `{line, original, replacement}[]` with 1-indexed line numbers. Lines where either side of the arrow trims to empty are dropped (starts-with-`<-` is a general note per the drafter SKILL.md, ends-with-`<-` is a typo). The module ships as both ESM and a CLI: `node lib/correction-parser.mjs --file=<draft-path>` prints the parsed JSON array.

**Voice profile shape:** `{ id, path, frontmatter, body, source }`. Frontmatter is optional — a file with no frontmatter is treated as a pure body. Frontmatter must be a YAML mapping (not a scalar or array) or the file is skipped with a warning.

**Reviewer registry:** `plugins/counterbalance/reviewers.json` is the single source of truth for wired reviewers. It has two top-level keys: `presets` (named bundles) and `reviewers` (array). Each reviewer entry has `{id, type, command, applies_to, description}` plus one of `agent` (if `type === "agent"`) or `lib` (if `type === "lib"`). `lib/reviewers.mjs` exports `loadRegistry`, `applicableReviewers`, `expandPreset`, `partitionByType`, and `aggregateFindings`. `loadRegistry` validates that `presets` (if present) is an object, not an array or scalar.

**Presets:** `reviewers.json` ships four named bundles — `quick`, `voice`, `mechanical`, `full`. Values are arrays of reviewer ids; the single-element `['*']` means "every wired reviewer". `expandPreset(registry, presetId)` returns the resolved reviewer entries; unknown ids in a preset log a warning and are skipped rather than throwing.

**Reviewer type model:** reviewers are either `agent` (dispatched via the Task tool to a subagent) or `lib` (pure ESM module in `lib/` with a `review({draft, filePath, voiceProfile})` export). `partitionByType(reviewers)` splits an entry list into `{agents, libs}` for dispatch. Entries with a missing or unknown type are logged and dropped, not thrown.

**Mech reviewer module contract:** a lib reviewer exports `async function review({draft, filePath, voiceProfile})` and returns `{reviewer: '<self-id>', findings: [...]}`. It must also be runnable as a CLI, so every lib reviewer file has a CLI guard at the bottom using the pattern `fileURLToPath(import.meta.url) === resolvePath(process.argv[1] ?? '')` — do NOT use the broken `file://${resolvePath(...)}` template-literal pattern. The CLI supports `--file=`, `--draft=`, and `--voice-profile-file=` flags and prints one JSON line to stdout.

**mech-review runner (`bin/mech-review.mjs`):** single Bash entry point that imports a set of lib reviewers in parallel (`Promise.allSettled`) and returns `{outputs: [...]}` to stdout. Exports `runMechReview({reviewerIds, draft, filePath, voiceProfile})` and the `REVIEWER_MAP` table that maps registry ids (e.g., `repetition-check`) to module filenames (e.g., `repetition.mjs`). This asymmetry is intentional: each lib module self-identifies with a shorter `reviewer` field than its registry id; callers correlating findings back to the registry must map through `REVIEWER_MAP`. A reviewer whose module import or `review()` call fails is wrapped as `{reviewer: id, findings: [], error: ...}` — failures never crash the batch.

**registry-query helper (`bin/registry-query.mjs`):** Bash-friendly CLI wrapper around `lib/reviewers.mjs` with four subcommands: `applicable <filePath>`, `expand <presetId>`, `intersect <presetId> <applicableIdsJsonFile>`, `partition <idsJsonFile>`. Used by `/prose-review` to keep all registry logic out of the command markdown.

**aggregateFindings output:** `{reviewers_run, findings, errors, counts_by_severity}`. `findings` is a flat list where each finding has `reviewer` attached (overwriting any existing field), sorted ascending by `line` then by `reviewer` id. Findings with non-numeric `line` sort to the end. `counts_by_severity` covers exactly `{violation, warning, note}`. `errors` collects per-reviewer `{reviewer, error}` entries pulled from any input output whose `error` field is truthy.

**Reviewer output contract (single reviewer):** `{reviewer, findings: [{line, severity, rule, quote, message, suggested}], error?}`. Both agent and lib reviewers produce this shape.

**/prose-review orchestration:** the meta-command resolves the voice profile, intersects applicable reviewers against the chosen preset (or a custom multiselect), partitions by type, dispatches agents in a single parallel Task-tool batch and libs in a single `bin/mech-review.mjs` Bash call, then merges results via `aggregateFindings` and renders a line-sorted report. Agent Task dispatches MUST go out as one batch per message — serializing them inflates runtime ~4x.

## Structural Invariants (enforced by tests)

These are not soft rules. Each is asserted by a test file that will fail CI if violated.

- **The plugin NEVER mutates CLAUDE.md.** `tests/claude-md-invariant.test.mjs` greps every agent/command/lib file for CLAUDE.md writes and fails on any match. Voice Discovery reads CLAUDE.md for migration but only writes to the user profile path; users are told to edit their own CLAUDE.md.
- **Every `type: "agent"` reviewer's `tools` field is exactly the string `Read, Grep, Glob`.** `tests/voice-reviewer-wiring.test.mjs` is parameterized over every agent-type entry in `reviewers.json` and compares literally. Do not reorder, add Write/Edit/Bash, or change spacing. Reviewers are read-only critics by construction, enforced at the Claude Code permission layer.
- **Every judgment agent is Sonnet-pinned.** `cliche-hunter`, `opener-check`, `cuttability`, and `concrete-vs-abstract` all declare `model: sonnet` in their frontmatter (AC8.1). `voice-reviewer` is unpinned.
- **Adding a new reviewer touches zero existing files — for BOTH agent and lib types.** `tests/reviewer-extensibility.test.mjs` hashes every existing file, injects a stub reviewer (the agent case adds an agent md + command md + registry entry; the lib case adds a lib mjs + command md + registry entry), re-hashes, and fails if any pre-existing file's hash changed. The two three-file procedures are in README.md under "How to add a reviewer" as two H3 subsections (Agent procedure, Lib procedure).
- **Reference and rubric existence.** `tests/reference-integrity.test.mjs` asserts that every reference named by the drafter SKILL.md exists on disk AND that the four judgment rubrics (`rubric-cliche.md`, `rubric-opener.md`, `rubric-cuttability.md`, `rubric-concrete.md`) exist and are each referenced by exactly one judgment agent.
- **`plugin.json` is authoritative for version.** `marketplace.json` deliberately omits `version` on the plugin entry — Claude Code reads the version from the plugin manifest itself. `tests/version-bump.test.mjs` enforces this. Do not add a `version` key to the `plugins[]` entry in `marketplace.json`.
- **`package.json` version is NOT the plugin version.** At v0.2.0 release, `plugin.json` is `0.2.0` and `package.json` is still `0.0.1`. That is intentional — `package.json` exists only to pin runtime deps (`js-yaml`, `flesch-kincaid`, `syllable`, `sbd`) and the engines floor. If you need the plugin version, read `plugin.json`.
- **Registry shape is validated at load time.** `tests/registry-shape.test.mjs` + `loadRegistry` assert: `reviewers` is an array, `presets` (if present) is a plain object (not null, not array), every reviewer has a `type` of `agent` or `lib`, the four named presets (`quick`, `voice`, `mechanical`, `full`) exist with valid reviewer ids, and `presets.full` is exactly `['*']`. `partitionByType` over the real registry is asserted to return 5 agents and 4 libs. Note: registry-agent-file existence is enforced separately by `tests/reference-integrity.test.mjs` ("every reviewers.json agent entry points to an existing file").

## Key Decisions

- **Three-layer cascade over flag-based selection:** the resolver is silent and path-based, so users can override voice per-repo without editing any config. First match wins; no merging.
- **`parser.mjs` adapted from Anvil's `principles.mjs`** (MIT, attributed in the file header). Changes: returns `VoiceProfile` shape instead of Anvil's flat principle shape, and allows missing frontmatter.
- **Reviewer extensibility as a file-level contract, not a plugin API:** reviewers are just agents + commands + a JSON entry. No programmatic registration, no lifecycle hooks. The test suite is what holds this shape stable.
- **Fail-open resolver CLI:** the CLI exits 0 with `null` on any error, so callers shelling out never see a crash. Errors go to stderr for debugging.

## Boundaries

- Safe to edit: `plugins/counterbalance/`, `tests/`, `README.md`, `CHANGELOG.md`
- Bump version: `plugins/counterbalance/.claude-plugin/plugin.json` only
- Never add: `version` key to `marketplace.json` plugin entries
- Never write: to any CLAUDE.md from plugin code (enforced by test)
- Never declare: Write/Edit/Bash tools on any reviewer agent

## Gotchas

- `path.matchesGlob` is used for reviewer applicability — requires forward-slash paths. Windows paths must be normalized via `lib/windows-path.mjs` first.
- The `parser.mjs` ENOENT branch is intentionally silent. Other fs errors (EACCES, EIO, ELOOP) warn and return null — don't collapse them.
- Voice Discovery's CLAUDE.md migration flow is in `agents/counterbalance.md`, not in a lib file. The match heuristic is a regex on headings matching `/voice|writing|tone|style|register|sentence/i`.
- The skill at `plugins/counterbalance/skills/counterbalance/` has 13 reference files: 6 genre overlays (`genre-*.md`), 3 benchmarks (`benchmark-*.md`), and 4 rubrics (`rubric-*.md`). There is no `fallback-voice.md` — it was removed when the resolver grew a four-layer cascade with `$HOME/.claude/CLAUDE.md` as layer 4, and the `/ghost` and `/voice-check` commands learned to bounce on null instead of using a generic fallback. `tests/reference-integrity.test.mjs` still enforces that every reference the SKILL.md names actually exists (the drafter SKILL.md now names zero such files; the check is vacuously true).
