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
- Node ≥ 22.14.0

## Prior

- Repo scaffolded; see the design plan at `docs/design-plans/2026-04-11-counterbalance.md` for architectural intent.
