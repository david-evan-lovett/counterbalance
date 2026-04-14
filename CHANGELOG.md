# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **CLAUDE.md as voice profile layer 4.** The resolver cascade now walks four layers: local override, project, user, and finally a voice-section extraction from `~/.claude/CLAUDE.md`. Any of the first three layers overrides it. New `lib/claude-md-parser.mjs` handles the extraction via heading regex (`/voice|writing|tone|style|register|sentence/i`), capturing the matched heading through to the next heading of equal-or-higher level.
- **Bounce-on-null for `/ghost` and `/voice-check`.** If the resolver returns `null` after all four layers, both commands refuse to dispatch and tell the user to run `/voice-refresh`. There is no longer a generic fallback voice — `references/fallback-voice.md` has been deleted. The voice-reviewer agent returns a structured `{findings: [], error: ...}` payload when `voiceProfile` is null so `/prose-review` can still run and surface the error in its errors section.
- **File-based drafts.** `/ghost` now resolves a drafts directory via the new `lib/drafts-dir.mjs` (two-layer cascade: explicit `--out=` → `<cwd>/drafts/`, auto-created if missing), then persists the subagent's output to a file with a sidecar `.meta.json` capturing voice profile source, input path, cwd, and timestamp. Draft filenames mirror the input (`IDEAS.md` → `IDEAS.draft.md`) or use a compact ISO timestamp for inline text. Collisions append a numeric suffix. Drafts default to project-local because drafts belong next to the work they're about — if the user wants them somewhere else, `--out=<path>` is the escape hatch.
- **`/ghost-correct` command.** Closes the drafting loop. Edit your draft file in place, add `<-` markers on lines you want changed, then run `/ghost-correct <draft-file>`. The command parses markers via the new `lib/correction-parser.mjs` (which strips fenced code blocks and inline backtick spans to avoid false positives), confirms the parsed list via `AskUserQuestion`, re-resolves the voice profile fresh, saves the pre-correction draft as a `.bak` (single-level undo — deeper history requires git), and dispatches the drafter with a correction-pass context to rewrite the file. The corrected draft is written back to the same path.

### Changed

- **Voice profile resolver cascade grew a fourth layer** (`~/.claude/CLAUDE.md` voice section). Documented in the drafter `SKILL.md`, the drafter agent md, and the README voice-profile table.

### Removed

- **`references/fallback-voice.md`** and all references to it. The four-layer resolver plus the bounce-on-null behavior replaced the generic fallback pattern.

## [0.2.0] - 2026-04-12

### Added

- **Prose review suite:** eight new reviewers covering judgment (cliche, opener, cut, concrete) and mechanical (readability, repetition, spread, passive) angles. Each is individually user-invocable via its own slash command and collectively orchestrated via `/counterbalance:prose-review`.
- **Hybrid reviewer registry:** `reviewers.json` gains a `type` field (`"agent" | "lib"`) and a top-level `presets` object with four named bundles (`quick`, `voice`, `mechanical`, `full`). Agent-type reviewers follow the existing three-file procedure; lib-type reviewers are pure Node functions callable as modules or CLI tools. Both preserve the read-only invariant.
- **Meta-command `/counterbalance:prose-review`:** dispatches multiple reviewers in parallel (agents via Task, libs via one Bash call to `bin/mech-review.mjs`) and merges results into a single flat, line-sorted report with severity counts and in-band error handling.
- **`prose-review` skill** at `plugins/counterbalance/skills/prose-review/SKILL.md`: lets Claude trigger the orchestration flow conversationally when the user asks to review prose without naming the slash command.
- **Sonnet pinning** on every new judgment agent (`model: sonnet`). Running `/prose-review "full"` on a draft is roughly 4x cheaper than it would be with inherited-Opus subagents.
- **Zero-touch extensibility** enforced for both reviewer kinds. `tests/reviewer-extensibility.test.mjs` now covers both the agent procedure (unchanged from v0.1) and the lib procedure (new case). Adding a reviewer of either kind touches zero pre-existing files.
- **New shared primitives:** `lib/md-preprocess.mjs` (strip Markdown before prose metrics), `lib/stopwords.mjs` (English stopword set), `lib/reviewers.mjs` gains `expandPreset`, `partitionByType`, and a real `aggregateFindings` implementation (replacing the v1 stub).
- **Four new rubric files** under `skills/counterbalance/references/`: `rubric-cliche.md`, `rubric-opener.md`, `rubric-cuttability.md`, `rubric-concrete.md`.

### Dependencies

- Added `flesch-kincaid ^2.0.1`, `syllable ^5.0.1`, `sbd ^1.0.19` (all MIT, all pure-JS, Node ≥22.14.0 compatible). Used by the mechanical reviewers for grade-level computation and sentence tokenization that respects abbreviations like `e.g.`, `Dr.`, `U.S.`

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
- Node ≥ 22.14.0

## Prior

- Repo scaffolded.
