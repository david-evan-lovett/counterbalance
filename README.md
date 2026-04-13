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

- `/ghost [notes-file-or-text]` — draft prose in your voice from notes, dictation, or rough bullets. Writes the draft to a file (with a sidecar metadata record) so you can iterate on it with `/ghost-correct`. Dispatches the counterbalance subagent in Drafting Loop mode.
- `/ghost-correct <draft-file>` — apply user corrections back through the drafter. Edit your draft file in place, add `<-` markers on lines you want changed (syntax: `original text <- replacement text`), then run this command. It parses the markers, confirms the list with you, dispatches the subagent to rewrite the draft, and saves the prior version as a single-level `.bak` undo. Deeper history requires committing drafts to git.
- `/voice-refresh` — run Voice Discovery against the active profile. First-run does the CLAUDE.md pre-flight migration; subsequent runs gather fresh samples and synthesize a new profile.
- `/voice-check [draft-file-or-text]` — review a draft against the active voice profile. Read-only. Returns a line-referenced findings list.

## Voice profiles

The resolver walks four layers in descending precedence and returns the first one that parses cleanly.

| You want… | Edit this file |
|---|---|
| A one-off voice for a specific repo | `./.counterbalance.md` (gitignored by default) |
| A shared voice for a project your team works on | `./.claude/counterbalance.md` (committed) |
| Your personal default voice | `~/.claude/plugins/data/counterbalance/profiles/default.md` |
| _Last-ditch_ — a voice section inside `~/.claude/CLAUDE.md` | Heading matching `/voice\|writing\|tone\|style\|register\|sentence/i` |

The first three are plain markdown. Frontmatter is optional — if you don't have any, the whole file is the voice guide. If you do, the parser loads it and the body below becomes the guide text.

The fourth layer is a convenience: if you already keep a voice section in your global CLAUDE.md, the resolver will extract it so `/ghost` works out of the box. Any of the first three layers overrides it, and running `/voice-refresh` walks you through migrating that section into a real profile file.

If all four layers miss, `/ghost` and `/voice-check` bounce you toward `/voice-refresh`. There is no generic fallback voice — a tool that drafts without a voice guide is producing the exact AI slop this plugin exists to prevent.

The resolver also ships as a CLI you can shell out to from your own scripts:

```bash
node "${CLAUDE_PLUGIN_ROOT}/plugins/counterbalance/lib/resolver.mjs" --cwd="$PWD" --json
```

Prints the matched profile as JSON, or the literal string `null` if no layer resolves.

## CLAUDE.md migration

Voice Discovery opens by looking for voice guidance in `~/.claude/CLAUDE.md`. If it finds any — headings that match `/voice|writing|tone|style|register|sentence/i`, or section bodies that talk about cadence, analogies, or what to avoid — it shows you the extracted content verbatim alongside the destination path and asks whether to import. On yes, it writes to `~/.claude/plugins/data/counterbalance/profiles/default.md` and tells you to remove the imported section from CLAUDE.md yourself.

The plugin never mutates CLAUDE.md. That's a structural invariant, not a soft rule — `tests/claude-md-invariant.test.mjs` greps every agent, command, and lib file in the repo for CLAUDE.md writes and fails CI on any match. If you want to audit the behavior directly, the drafter subagent lives at `plugins/counterbalance/agents/counterbalance.md` and the invariant is declared verbatim inside it.

## How to add a reviewer

Counterbalance supports two reviewer types — agent-type (Claude subagents) and lib-type (pure Node functions). Adding a reviewer of either kind touches zero existing files and is enforced by `tests/reviewer-extensibility.test.mjs`.

### Agent procedure

Use when the reviewer needs Claude's judgment (cliche detection, style comparison, etc.).

1. **Create the agent file** at `plugins/counterbalance/agents/<name>.md`. Frontmatter must include:

   ```yaml
   ---
   name: <agent-name>
   description: <one-line purpose>
   model: sonnet
   tools: Read, Grep, Glob
   ---
   ```

   The `tools` field is a literal string, not an array. Agent-type reviewers are read-only by construction — Write, Edit, and Bash are forbidden.

2. **Create the command file** at `plugins/counterbalance/commands/<name>.md`. Frontmatter:

   ```yaml
   ---
   description: <one-line purpose>
   allowed-tools: Task, Read, Bash, Glob
   argument-hint: "[draft-file-or-inline-text]"
   ---
   ```

   Body follows the template in `commands/voice-check.md`: resolve profile → load draft → dispatch subagent via Task → relay output.

3. **Append to `plugins/counterbalance/reviewers.json`**:

   ```json
   {
       "id": "<id>",
       "type": "agent",
       "agent": "counterbalance:<agent-name>",
       "command": "/counterbalance:<command-name>",
       "applies_to": ["**/*.md", "**/*.mdx"],
       "description": "..."
   }
   ```

### Lib procedure

Use when the reviewer is a deterministic computation (readability metrics, regex matching, etc.). No LLM cost.

1. **Create the lib module** at `plugins/counterbalance/lib/<name>.mjs`. Export:

   ```javascript
   export async function review({ draft, filePath, voiceProfile }) {
       return { reviewer: '<id>', findings: [] };
   }
   ```

   Also include a CLI entry at the bottom of the file following the pattern in `lib/readability.mjs` — it lets the reviewer be invoked as `node lib/<name>.mjs --file=<path>` for direct testing.

2. **Create the command file** at `plugins/counterbalance/commands/<name>.md`. It's a thin Bash wrapper that resolves the voice profile, writes it to a temp file, and invokes the lib via `node ${CLAUDE_PLUGIN_ROOT}/lib/<name>.mjs --file=<arg> --voice-profile-file=<tmp>`. See `commands/readability.md` as the template.

3. **Append to `plugins/counterbalance/reviewers.json`**:

   ```json
   {
       "id": "<id>",
       "type": "lib",
       "lib": "<name>.mjs",
       "command": "/counterbalance:<command-name>",
       "applies_to": ["**/*.md", "**/*.mdx"],
       "description": "..."
   }
   ```

### Optional: add to a preset

Presets in `reviewers.json` are curated — adding a reviewer does NOT automatically include it. To bundle a new reviewer into an existing preset, add its id to the preset's array. Example:

```json
"presets": {
    "quick": ["readability", "opener-check", "cliche-check", "<new-id>"]
}
```

The `full` preset uses the `"*"` wildcard and automatically includes every reviewer.

## Development

```bash
npm install                                # pulls js-yaml, the sole runtime dep
claude plugin validate .                   # validates the marketplace + plugin manifests
node --test tests/*.test.mjs               # runs the full suite (~90 tests)
npx markdownlint-cli2@0.18.0               # lints README, CHANGELOG, SKILL.md, references
```

## License

MIT — see [LICENSE](LICENSE).
