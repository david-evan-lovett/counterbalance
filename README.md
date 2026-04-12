# counterbalance

Counterbalance is a Claude Code plugin that drafts prose in your voice and reviews prose against your voice. The drafter walks from notes to finished draft through an intake-analysis-correction loop; the reviewer is a read-only critic that returns line-referenced findings. The reviewer slot is an extension point — adding a second reviewer takes three files and touches nothing that already exists.

## Install

```text
claude plugin marketplace add david-evan-lovett/counterbalance
claude plugin install counterbalance@counterbalance
```

Counterbalance is a third-party marketplace. Auto-update is disabled by default — run `claude plugin marketplace update counterbalance` to refresh the catalog, then `claude plugin update counterbalance@counterbalance` to pull a new version. If you'd rather have automatic updates, turn them on in the `/plugin` UI under the Marketplaces tab.

When the plugin manifest changes but the version stays the same, your installed copy stays cached — Claude Code only sees a new release when the `plugin.json` version increments. Maintainers bump the version on every user-visible change. If you refreshed the marketplace and still don't see an update, check that the version number actually changed.

## Commands

- `/ghost [notes-file-or-text]` — draft prose in your voice from notes, dictation, or rough bullets. Dispatches the counterbalance subagent in Drafting Loop mode.
- `/voice-refresh` — run Voice Discovery against the active profile. First-run does the CLAUDE.md pre-flight migration; subsequent runs gather fresh samples and synthesize a new profile.
- `/voice-check [draft-file-or-text]` — review a draft against the active voice profile. Read-only. Returns a line-referenced findings list.

## Voice profiles

The resolver walks three layers in descending precedence and returns the first one that parses cleanly.

| You want… | Edit this file |
|---|---|
| A one-off voice for a specific repo | `./.counterbalance.md` (gitignored by default) |
| A shared voice for a project your team works on | `./.claude/counterbalance.md` (committed) |
| Your personal default voice | `~/.claude/plugins/data/counterbalance/profiles/default.md` |

The file is plain markdown. Frontmatter is optional — if you don't have any, the whole file is the voice guide. If you do, the parser loads it and the body below becomes the guide text.

The resolver also ships as a CLI you can shell out to from your own scripts:

```bash
node "${CLAUDE_PLUGIN_ROOT}/plugins/counterbalance/lib/resolver.mjs" --cwd="$PWD" --json
```

Prints the matched profile as JSON, or the literal string `null` if no layer resolves.

## CLAUDE.md migration

Voice Discovery opens by looking for voice guidance in `~/.claude/CLAUDE.md`. If it finds any — headings that match `/voice|writing|tone|style|register|sentence/i`, or section bodies that talk about cadence, analogies, or what to avoid — it shows you the extracted content verbatim alongside the destination path and asks whether to import. On yes, it writes to `~/.claude/plugins/data/counterbalance/profiles/default.md` and tells you to remove the imported section from CLAUDE.md yourself.

The plugin never mutates CLAUDE.md. That's a structural invariant, not a soft rule — `tests/claude-md-invariant.test.mjs` greps every agent, command, and lib file in the repo for CLAUDE.md writes and fails CI on any match. If you want to audit the behavior directly, the drafter subagent lives at `plugins/counterbalance/agents/counterbalance.md` and the invariant is declared verbatim inside it.

## How to add a reviewer

Counterbalance is designed so that adding a second reviewer (reading-level, AI-slop, grammar, whatever you want to check) requires zero changes to any existing file. The procedure is three files.

### 1. Add an agent

Create `plugins/counterbalance/agents/my-reviewer.md` with frontmatter:

```yaml
---
name: my-reviewer
description: Use when reviewing a draft for [whatever you check].
model: sonnet
tools: Read, Grep, Glob
---
```

The body must document the input shape (`draft`, `filePath`, `voiceProfile`) and emit the output contract `{reviewer, findings: [{line, severity, rule, quote, message, suggested}]}`. Use `agents/voice-reviewer.md` as a template.

**Tools must be scoped to read-only.** Do not declare Write, Edit, or Bash. Reviewers are critics, not drafters. This is enforced at the Claude Code permission layer, not a soft rule — a reviewer that declares Write literally cannot call Write at runtime.

### 2. Add a command

Create `plugins/counterbalance/commands/my-check.md` that dispatches the new agent via the Task tool. Use `commands/voice-check.md` as a template.

### 3. Register the reviewer

Append an entry to `plugins/counterbalance/reviewers.json`:

```json
{
    "id": "my-check",
    "agent": "counterbalance:my-reviewer",
    "command": "/counterbalance:my-check",
    "applies_to": ["**/*.md", "**/*.mdx"],
    "description": "Short human summary of what this reviewer checks."
}
```

That's it. Run `node --test tests/reviewer-extensibility.test.mjs` to confirm the new reviewer is picked up — the fixture test hashes every existing file, adds a stub reviewer, re-hashes, and fails if any existing file's hash changed. If that test fires, it means the extension point is broken, not your reviewer.

## Development

```bash
npm install                                # pulls js-yaml, the sole runtime dep
claude plugin validate .                   # validates the marketplace + plugin manifests
node --test tests/*.test.mjs               # runs the full suite (~90 tests)
npx markdownlint-cli2@0.18.0               # lints README, CHANGELOG, SKILL.md, references
```

## License

MIT — see [LICENSE](LICENSE).
