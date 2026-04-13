# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
