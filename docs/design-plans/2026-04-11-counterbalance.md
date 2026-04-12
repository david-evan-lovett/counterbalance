# Counterbalance Plugin Design

## Summary

Counterbalance is a Claude Code plugin that gives writers two things: a drafting engine that turns raw notes into prose in their own voice, and a structured reviewer pipeline that flags violations in any draft without rewriting it. The plugin ships as an installable marketplace package — one command installs it, three slash commands expose it, and it lives entirely outside the user's existing Claude configuration.

The two workflows exist because drafting and reviewing are opposite operations with incompatible permission requirements. The drafter (`/ghost`) runs a full write-capable subagent that ingests notes, resolves the user's voice profile, and produces a ghost-draft through an iterative loop. The reviewer (`/voice-check`) runs a read-only subagent — structurally incapable of rewriting — that walks a draft against that same voice profile and returns line-referenced findings. The key architectural idea tying both together is the reviewer extension point: reviewer is a formal slot with a typed contract, a JSON registry, and a verified extensibility fixture, so adding a second reviewer (reading level, AI-slop detection, grammar) in v2 means a new agent file plus a new command file plus a registry entry — no changes to anything that already exists.

## Definition of Done

**Primary deliverable:** An installable, MIT-licensed Claude Code plugin named `counterbalance`, published from a public GitHub repo, installable on personal and day-job machines. It provides a writing drafting engine and an extensible reviewer pipeline, with a voice-aware drafter and a voice-aware reviewer as the first implementations of each.

### Two distinct workflows

#### 1. Drafting workflow (voice-aware drafter)

```text
raw notes / dictation / rough bullets
      │
      ▼
  /ghost  (drafting engine: Voice Discovery + Drafting Loop)
      │
      ▼
  ghost-draft  (readable prose in your voice)
```

Implemented by the counterbalance subagent and the extracted ghost-writer skill. Cleans, organizes, structures — doesn't invent. Preserves exact phrasings from the user's notes.

#### 2. Review workflow (reviewer pipeline)

```text
any draft (user-written, Claude-written, ghost-draft, AI slop)
      │
      ▼
  /voice-check  (one reviewer among many)
      │
      ▼
  analyzed draft (line-referenced findings, no rewrite)
```

`/voice-check` is **one invocable reviewer**. The architecture treats "reviewer" as a slot that future reviewers can fill — reading level, AI-slop detection, grammar, genre conformance, structural flow, fact/citation check. In v1, only voice-check ships, but the plugin is organized so adding the next reviewer is a new file in a known location, not a rewrite.

### Core contents

1. **Ghost-writer skill extracted from the zip** and installed as `skills/counterbalance/SKILL.md` with reference files intact. Voice Discovery + Drafting Loop modes preserved. The `.skill` zip becomes obsolete.

2. **Cascaded voice profile resolver** — checks in order, first match wins:
   - `./.counterbalance.md` (local override, gitignored)
   - `./.claude/counterbalance.md` (project voice, committed, team-shareable)
   - `~/.claude/plugins/data/counterbalance/profiles/default.md` (user voice, plugin-owned)

   One active profile at v1. Named profiles land in v2 as siblings under `profiles/` with zero migration cost. Existing voice content in `~/.claude/CLAUDE.md` is imported via a one-shot Voice Discovery pre-flight, not scraped every invocation — the plugin never mutates CLAUDE.md.

3. **Slash commands:**
   - `/ghost` — drafting engine (notes → ghost-draft)
   - `/voice-refresh` — re-runs Voice Discovery against the active profile
   - `/voice-check` — first reviewer (draft → analyzed draft), line-referenced violations, no rewrite

4. **A dedicated counterbalance subagent** — owns the drafting loop end-to-end. Can be dispatched mid-engineering session without polluting the main loop's context. Also serves as the pattern future reviewer subagents follow.

5. **Reference library** — thin overlays (not voice replacements):
   - **Work genres:** PRD/RFC/design doc, PR/review/changelog, Slack/email/retro, summary, ADR, feedback
   - **Benchmark fixtures:** story, poem, limerick (constrained forms that expose whether a voice profile produces distinct output)

6. **Reviewer extension point** — plugin layout, schema, and conventions make "add a new reviewer" a well-defined operation. Documented in the design doc so the next reviewer (v2) has a clear target.

7. **Personal marketplace setup** — counterbalance is installable via a marketplace manifest, MIT licensed, setup patterns borrowed from other MIT-licensed Claude Code plugin marketplaces (not ed3d-plugins, which has an incompatible license).

8. **Primitive CI (safety gate before publish)** — GitHub Actions workflow that runs on every PR and before publishing a new version, asserting:
   - Structural validity: `plugin.json`, `marketplace.json`, `hooks.json` parse and match expected schemas
   - Reference integrity: every skill, agent, hook, and reference file mentioned in config exists on disk
   - Markdown well-formedness: all `SKILL.md`, reference files, commands parse; YAML frontmatter valid
   - Slash command wiring: each declared command points at a real skill/agent
   - No secrets / no personal data: basic secret scan + check that personal voice content isn't accidentally checked in
   - License and README present and minimally correct
   - **Stretch:** install smoke test — CI job that installs the plugin into a scratch Claude Code config and verifies nothing throws. May slip to v1.1 if too complex.

   Pass → safe to merge, tag, publish. Fail → block.

### Explicit exclusions (v1)

- Additional reviewers beyond voice-check (the slot exists; only one occupant ships)
- Multiple named voice profiles active simultaneously
- Auto-detection of writing surface / genre (user picks overlay explicitly)
- Ambient plugin hook (deferred to v2 as a `Stop`-event hook with per-turn debouncing — v1 is manual-invocation only via `/voice-check`)
- Git pre-commit hooks
- Team voice discovery workflow
- The `.skill` zip format — plugin replaces it

### Success test

Day-job laptop runs `claude plugin install` against the counterbalance marketplace. `/ghost` turns a dictated PRD into a ghost-draft in your voice. `/voice-check` on an AI-slop draft surfaces line-referenced violations without rewriting. A project-level `.claude/counterbalance.md` overrides your user-level voice inside that repo. CI pass-fail accurately reflects whether the plugin is safe to install. Adding a second reviewer as a thought experiment has an obvious home in the plugin layout.

## Acceptance Criteria

### counterbalance.AC1: Skill extraction

- **counterbalance.AC1.1 Success:** Counterbalance skill exists at `plugins/counterbalance/skills/counterbalance/SKILL.md` with valid YAML frontmatter (`name`, `description`, `user-invocable: false`)
- **counterbalance.AC1.2 Success:** SKILL.md body contains both Voice Discovery and Drafting Loop modes, plus `<-` correction operator instructions
- **counterbalance.AC1.3 Success:** `references/fallback-voice.md` exists and is referenced from SKILL.md

### counterbalance.AC2: Voice profile resolver

- **counterbalance.AC2.1 Success:** When `./.counterbalance.md` exists, resolver returns local-layer profile with `source: "local"`
- **counterbalance.AC2.2 Success:** When only `./.claude/counterbalance.md` exists, resolver returns project-layer profile
- **counterbalance.AC2.3 Success:** When only `~/.claude/plugins/data/counterbalance/profiles/default.md` exists, resolver returns user-layer profile
- **counterbalance.AC2.4 Success:** When multiple layers exist simultaneously, local wins over project wins over user (first-match-wins)
- **counterbalance.AC2.5 Failure:** When no layer has a profile, resolver returns `null` and the drafter falls back to `references/fallback-voice.md`
- **counterbalance.AC2.6 Edge:** Windows paths with backslashes resolve correctly (normalization applied before glob matching)
- **counterbalance.AC2.7 Edge:** Malformed YAML frontmatter produces a clear error, not a silent misread

### counterbalance.AC3: Drafting workflow

- **counterbalance.AC3.1 Success:** `commands/ghost.md` exists with `description`, `allowed-tools`, and `argument-hint` frontmatter and dispatches the counterbalance subagent via Task
- **counterbalance.AC3.2 Success:** `/ghost` resolves the active voice profile via `lib/resolver.mjs` and passes the resolved profile to the subagent as context
- **counterbalance.AC3.3 Success:** `commands/voice-refresh.md` exists and dispatches the counterbalance subagent in Voice Discovery mode
- **counterbalance.AC3.4 Success:** `agents/counterbalance.md` body embeds the full Drafting Loop including the `<-` correction operator parsing rules
- **counterbalance.AC3.5 Success:** Subagent frontmatter declares tools explicitly as `Read, Write, Edit, Glob, Grep, Bash, AskUserQuestion, Task` — no over-broad permissions
- **counterbalance.AC3.6 Failure:** When no voice profile resolves and the user declines the CLAUDE.md import, the subagent uses `references/fallback-voice.md`

### counterbalance.AC4: Voice Discovery CLAUDE.md pre-flight migration

- **counterbalance.AC4.1 Success:** Voice Discovery scans `~/.claude/CLAUDE.md` for voice/writing/tone guidance before asking for samples (heading-agnostic detection)
- **counterbalance.AC4.2 Success:** When guidance is found, user is shown extracted content verbatim and the destination path before any write
- **counterbalance.AC4.3 Success:** On user acceptance, content is written to `~/.claude/plugins/data/counterbalance/profiles/default.md`
- **counterbalance.AC4.4 Success:** After import, user is instructed to remove the redundant section from CLAUDE.md themselves — plugin never mutates CLAUDE.md (verified by a grep test against agent/command/lib files)
- **counterbalance.AC4.5 Failure:** When user declines, normal sample-based Voice Discovery proceeds
- **counterbalance.AC4.6 Edge:** When CLAUDE.md has no voice guidance at all, pre-flight is a silent no-op

### counterbalance.AC5: Reviewer pipeline (/voice-check)

- **counterbalance.AC5.1 Success:** `commands/voice-check.md` exists and dispatches the voice-reviewer subagent via Task
- **counterbalance.AC5.2 Success:** `agents/voice-reviewer.md` frontmatter scopes tools to `Read, Grep, Glob` only — no Write, no Edit, no Bash
- **counterbalance.AC5.3 Success:** voice-reviewer returns findings matching the structured contract: `{reviewer, findings: [{line, severity, rule, quote, message, suggested}]}`
- **counterbalance.AC5.4 Success:** Findings are rendered to the caller as an annotated markdown block with line references and quoted offending text
- **counterbalance.AC5.5 Edge:** Empty draft produces an empty findings list, not an error

### counterbalance.AC6: Reviewer extension point

- **counterbalance.AC6.1 Success:** `reviewers.json` registry lists voice-check with applicability rules (`**/*.md`, `**/*.mdx`)
- **counterbalance.AC6.2 Success:** `lib/reviewers.mjs` enumerates applicable reviewers for a given file path
- **counterbalance.AC6.3 Success:** Fixture test verifies that adding a stub second reviewer (new agent file + new command file + new registry entry) requires zero changes to existing files
- **counterbalance.AC6.4 Documented:** README has a "how to add a reviewer" section that walks through the three-file procedure

### counterbalance.AC7: Reference library

- **counterbalance.AC7.1 Success:** All six genre reference files exist: `genre-prd.md`, `genre-pr.md`, `genre-slack.md`, `genre-adr.md`, `genre-summary.md`, `genre-feedback.md`
- **counterbalance.AC7.2 Success:** All three benchmark reference files exist: `benchmark-story.md`, `benchmark-poem.md`, `benchmark-limerick.md`
- **counterbalance.AC7.3 Success:** Each benchmark file contains both an in-voice example and a known-bad AI-slop example of the same constrained form
- **counterbalance.AC7.4 Failure:** Reference integrity test fails if any file referenced from SKILL.md body is missing from `references/`

### counterbalance.AC8: CI safety gate

- **counterbalance.AC8.1 Success:** GitHub Actions workflow runs `claude plugin validate` on both the plugin and the marketplace
- **counterbalance.AC8.2 Success:** CI runs `node --test tests/` and blocks merge on any failure
- **counterbalance.AC8.3 Success:** CI enforces a version bump when `plugin.json` or `marketplace.json` body changed vs base branch
- **counterbalance.AC8.4 Success:** CI scans for personal data leaks against a configurable deny list and blocks on match
- **counterbalance.AC8.5 Success:** CI asserts `LICENSE` exists and contains "MIT", and both manifests declare `"license": "MIT"`
- **counterbalance.AC8.6 Success:** CI runs markdownlint-cli2 against `SKILL.md`, `README.md`, and reference files
- **counterbalance.AC8.7 Failure:** A deliberately malformed `plugin.json` produces a clear, line-referenced CI failure

### counterbalance.AC9: Publishing and install

- **counterbalance.AC9.1 Success:** `v0.1.0` is tagged from a green-CI `main` branch
- **counterbalance.AC9.2 Success:** `claude plugin marketplace add <user>/counterbalance` succeeds against the public repo
- **counterbalance.AC9.3 Success:** `claude plugin install counterbalance@counterbalance` succeeds and makes `/ghost`, `/voice-refresh`, and `/voice-check` available
- **counterbalance.AC9.4 Documented:** README explains that auto-update is disabled by default for third-party marketplaces
- **counterbalance.AC9.5 Documented:** README explains the version-bump requirement for users to see updates

## Glossary

- **ghost-draft**: The output of the `/ghost` drafting workflow — readable prose assembled from the user's raw notes, written in their voice. Named for the ghost-writer skill it builds on.
- **Voice Discovery**: An interactive mode in which the counterbalance subagent collects writing samples from the user (or imports existing guidance from `CLAUDE.md`) and produces a structured voice profile. One of two modes the drafting subagent operates in; the other is the Drafting Loop.
- **Drafting Loop**: The multi-step drafting sequence run by the counterbalance subagent: intake → silent analysis → draft → correction handling → supporting structure → grammar check. Named in the skill body as a distinct mode from Voice Discovery.
- **`<-` correction operator**: A lightweight in-session syntax the user types to redirect the drafter mid-loop (e.g., `<- make it shorter`). The subagent parses and applies it without restarting the loop.
- **voice profile**: A markdown file containing writing style guidance for a specific user or project. Resolved by the cascaded resolver at runtime and passed to both the drafter and reviewer as context.
- **voice profile resolver**: The `lib/resolver.mjs` module that implements the three-layer cascade and returns the first matching `VoiceProfile` (or null). Invocable as a Node subprocess: `node lib/resolver.mjs --cwd=$PWD --json`.
- **cascade / cascaded resolver**: The precedence logic that checks three file locations in order (local override → project-level → user-level) and returns the first match. Lifted from Anvil's `cascade.mjs` and parameterized for a `voices` kind.
- **reviewer extension point**: The combination of a typed `ReviewerInput`/`ReviewerOutput` contract, a `reviewers.json` registry, and a fixture test that verifies adding a stub reviewer requires zero changes to existing files. Makes "reviewer" a real slot rather than a convention.
- **`reviewers.json`**: The registry file that lists available reviewers with their agent names, command bindings, and file-pattern applicability rules. The single source of truth for which reviewers exist and when they apply.
- **Anvil**: A sibling MIT-licensed Claude Code plugin by the same author, used as the structural source for several modules (`cascade.mjs`, the markdown/YAML parser, Windows path normalization, the fail-open hook pattern). Described in the document as "dead code but you can steal agents etc."
- **PostToolUse / Stop event hooks**: Claude Code plugin hook types that fire after a tool call completes or at the end of a session turn. The document defers an ambient `Stop`-event hook to v2; v1 is manual-invocation only.
- **SKILL.md**: The primary file for a Claude Code skill — contains YAML frontmatter (name, description, invocability) and the skill body. In counterbalance, this is the always-loaded core of the ghost-writer skill; on-demand reference detail lives in the `references/` subdirectory.
- **fallback-voice**: The file `references/fallback-voice.md`, used as a default style guide when no voice profile resolves for the current context. Prevents the drafter from operating with no voice guidance at all.
- **genre overlay**: A thin reference file (e.g., `genre-prd.md`, `genre-slack.md`) that layers work-surface-specific conventions on top of the user's voice profile. Not a voice replacement — a supplement.
- **benchmark fixture**: Paired reference files (story, poem, limerick) each containing one in-voice example and one known-bad AI-slop example of the same constrained form. Used to verify a voice profile produces distinct output rather than generic prose.
- **`user-invocable`**: A SKILL.md frontmatter flag controlling whether users can invoke a skill directly by name. Counterbalance sets this to `false` — all entry points go through the command layer (`/ghost`, `/voice-refresh`, `/voice-check`).
- **fail-open hook pattern**: An error-handling convention from Anvil where any internal error exits with `process.exit(0)` and a stderr warning, rather than blocking the Claude session. Adopted for counterbalance's CLI utility scripts.
- **`pluginRoot` shorthand**: A `marketplace.json` convention that lets the marketplace catalog point to a directory of plugins rather than listing each plugin's full path. Used here so the repo root is the marketplace and `./plugins` contains plugin subdirectories.

## Architecture

Counterbalance is a single-plugin marketplace repo. The repo root is the marketplace catalog; the plugin itself lives at `plugins/counterbalance/`. A future second plugin slots in as a sibling without restructure.

```text
counterbalance/                          # repo root (marketplace + plugin container)
├── .claude-plugin/
│   └── marketplace.json                 # one-plugin catalog with pluginRoot shorthand
├── plugins/
│   └── counterbalance/                  # the plugin
│       ├── .claude-plugin/
│       │   └── plugin.json              # bare metadata, MIT, semver
│       ├── skills/
│       │   └── counterbalance/
│       │       ├── SKILL.md             # Voice Discovery + Drafting Loop
│       │       └── references/
│       │           ├── fallback-voice.md
│       │           ├── genre-*.md       # overlays per work genre
│       │           └── benchmark-*.md   # constrained-form fixtures
│       ├── agents/
│       │   ├── counterbalance.md        # drafting subagent
│       │   └── voice-reviewer.md        # first reviewer subagent
│       ├── commands/
│       │   ├── ghost.md                 # /ghost → counterbalance agent
│       │   ├── voice-refresh.md         # /voice-refresh → counterbalance agent
│       │   └── voice-check.md           # /voice-check → voice-reviewer agent
│       ├── lib/
│       │   ├── cascade.mjs              # voice-layer resolver, lifted from Anvil
│       │   ├── parser.mjs               # markdown + YAML frontmatter parser
│       │   ├── resolver.mjs             # resolveVoice(cwd) entry point
│       │   ├── reviewers.mjs            # registry + applicability
│       │   └── windows-path.mjs         # path normalization helper
│       ├── reviewers.json               # reviewer registry (v1: one entry)
│       └── package.json                 # js-yaml sole dep, Node ≥22
├── tests/
│   └── *.test.mjs                       # node --test coverage
├── .github/
│   └── workflows/
│       └── validate.yml                 # CI safety gate
├── LICENSE                              # MIT
├── README.md                            # install, usage, publishing gotchas
├── CHANGELOG.md
└── docs/
    └── design-plans/
        └── 2026-04-11-counterbalance.md  # this document
```

### Workflow contracts

**Drafting.** `/ghost` is a ~10-line command that resolves the active voice profile via `lib/resolver.mjs` and dispatches the `counterbalance` subagent via the Task tool with notes + resolved profile as context. The subagent owns the full Drafting Loop (intake → silent analysis → draft → correction → supporting structure → grammar check), including the `<-` correction operator parsing. It returns a ghost-draft to the main conversation.

**Voice Discovery.** `/voice-refresh` dispatches the same subagent in Voice Discovery mode. First step of Voice Discovery is the CLAUDE.md pre-flight: the subagent scans `~/.claude/CLAUDE.md` for any voice/writing/tone guidance (heading-agnostic pattern detection), shows extracted content verbatim to the user with the destination path, and asks for import approval. On accept, writes to `~/.claude/plugins/data/counterbalance/profiles/default.md` and instructs the user to remove the redundant section from CLAUDE.md themselves. On decline (or if no guidance is found), normal sample-based Voice Discovery proceeds.

**Reviewing.** `/voice-check` dispatches the `voice-reviewer` subagent with the target draft. The subagent's frontmatter scopes tools to `Read, Grep, Glob` — critic-only is enforced structurally, not just in prose. Review output follows a structured contract that any future reviewer honors.

### Reviewer contract

Every reviewer subagent accepts and returns a fixed shape, making the reviewer slot a real extension point rather than a convention:

```typescript
// input
interface ReviewerInput {
  draft: string;
  filePath?: string;
  voiceProfile?: VoiceProfile;
}

// output
interface ReviewerOutput {
  reviewer: string;              // reviewer id from reviewers.json
  findings: Finding[];
}

interface Finding {
  line: number;
  severity: "violation" | "warning" | "note";
  rule: string;                  // machine-readable rule id
  quote: string;                 // the offending text
  message: string;               // human-readable explanation
  suggested?: string;            // optional rewrite hint
}
```

`reviewers.json` is the registry:

```json
{
  "reviewers": [
    {
      "id": "voice-check",
      "agent": "counterbalance:voice-reviewer",
      "command": "/counterbalance:voice-check",
      "applies_to": ["**/*.md", "**/*.mdx"],
      "description": "Checks draft against active voice profile"
    }
  ]
}
```

Adding a v2 reviewer is a new `agents/<name>-reviewer.md` + new `commands/<name>.md` + new entry in `reviewers.json`. No changes to existing files. This property is verified by a fixture test.

### Voice profile resolver

Three-layer cascade, first match wins. Call signature: `resolveVoice(cwd) → VoiceProfile | null`.

```text
1. $PWD/.counterbalance.md                              (local override, gitignored)
2. $PWD/.claude/counterbalance.md                       (project voice, committed)
3. $HOME/.claude/plugins/data/counterbalance/profiles/default.md  (user voice, plugin-owned)
```

`VoiceProfile` shape:

```typescript
interface VoiceProfile {
  id: string;                    // v1: always "default"
  path: string;                  // absolute path to the matched file
  frontmatter: Record<string, unknown>;  // YAML, may be empty
  body: string;                  // markdown body — the voice guide itself
  source: "local" | "project" | "user";
}
```

Invoked from commands and subagents as a Node subprocess: `node lib/resolver.mjs --cwd=$PWD --json`. Returns JSON on stdout, or null when nothing resolves. When null, the drafter falls back to `references/fallback-voice.md`.

The internal layering uses Anvil's `cascade.mjs` parameterized by `kind: "voices"`. The parser is Anvil's `principles.mjs` adapted — reads markdown + optional YAML frontmatter into a structured record. Windows paths are normalized (`\` → `/`) before any glob matching, using a helper lifted from Anvil's hook code.

### Data flow summary

```text
/ghost         → resolver → counterbalance agent (Drafting Loop)     → ghost-draft
/voice-refresh → resolver → counterbalance agent (Voice Discovery)   → updated profile file
/voice-check   → resolver → reviewer registry → voice-reviewer agent → annotated draft
```

## Existing Patterns

Counterbalance is a greenfield repo — no prior code to follow inside it. The design instead draws from **Anvil** (`C:\Users\david\Repos\old_anvil\`), a sibling MIT-licensed Claude Code plugin built by the same author. Anvil is described as "dead code but you can steal agents etc." — the structural patterns below are lifted directly, with attribution in headers and in `README.md`.

**Patterns adopted from Anvil:**

- **Bare-metadata `plugin.json`** with convention-over-configuration auto-discovery. Anvil's `.claude-plugin/plugin.json` is 18 lines of pure metadata — no `skills`, `agents`, `hooks`, or `commands` arrays. Claude Code auto-discovers from the default directories. Counterbalance follows this.
- **`SKILL.md` + `references/` two-tier loading.** Always-loaded body in `SKILL.md`, on-demand detail in `references/*.md`. Matches how Anvil's main `anvil` skill is structured.
- **Layered cascade resolver** (`lib/cascade.mjs` from Anvil). Already parameterized by "kind" — adding a `voices` kind is a one-line change. Already handles global → project → subtree precedence with id-based dedup. Perfect drop-in fit for the voice profile resolver.
- **Markdown + YAML frontmatter parser** (`lib/principles.mjs` from Anvil, renamed to `parser.mjs` in counterbalance). Returns structured records (`{id, path, frontmatter, body, source}`). Almost exactly the shape a voice profile needs.
- **Windows path normalization** (from `hooks/principle-inject.mjs` lines 69-75 in Anvil). Converts `\` to `/` before glob matching. Load-bearing for Windows development; counterbalance has the same concern.
- **Native Node testing.** Anvil uses `node --test` (built-in runner) with no devDeps. No bundler, no TypeScript, no test runner package, ESM `.mjs` throughout. Counterbalance stays equally lean.
- **`js-yaml` as sole runtime dependency.** Anvil's only runtime dep; counterbalance matches.
- **Fail-open hook pattern** (from Anvil's `hooks/*.mjs`). Every internal error ends `process.exit(0)` with a stderr warning. No ambient hook ships in counterbalance v1, but the CLI utility scripts in `scripts/` will follow the same pattern when they land.
- **Design plan naming convention.** `docs/design-plans/YYYY-MM-DD-<slug>.md` with ISO-date prefix. Implementation plans become directories of the same name with one file per phase.

**Divergences from Anvil (deliberate):**

- **Slash commands.** Anvil ships none — its `anvil` skill is `user-invocable: true` and users type "anvil" or ask for it. Counterbalance ships three commands (`/ghost`, `/voice-refresh`, `/voice-check`) because the drafting/reviewing entry points need to be explicit and composable.
- **CI infrastructure.** Anvil has no `.github/workflows/` directory. Counterbalance ships a full validation workflow from day one — the DoD's "safety gate" requirement demands it and the ecosystem makes it cheap (`claude plugin validate` is a built-in CLI).
- **Agent role indirection.** Anvil uses `.anvil/config.json` to map logical roles to fully-qualified agent names (`lib/agents.mjs` → `resolveAgentRole(role, config)`). Counterbalance dispatches agents directly by name. The pluggability is elegant but overkill for a smaller plugin with two agents.
- **Default-off `user-invocable` on the core skill.** The counterbalance skill is dispatched through commands, not typed. The skill's frontmatter won't set `user-invocable: true` — invocation goes through the command layer.

**Licensing:** Anvil's `package.json` declares `"license": "MIT"`, `js-yaml` is MIT, all stolen modules are MIT. Every file lifted from Anvil gets a header comment citing the source module + SPDX identifier.

## Implementation Phases

<!-- START_PHASE_1 -->
### Phase 1: Repo Scaffold and Manifests

**Goal:** A valid, installable-but-empty plugin + marketplace. `claude plugin validate` passes on both.

**Components:**

- `LICENSE` — MIT license text, David Lovett as copyright holder
- `README.md` — skeleton only in this phase; filled in Phase 8
- `CHANGELOG.md` — skeleton with Unreleased section
- `package.json` — `js-yaml ^4.1.0` as sole dependency, `"engines": { "node": ">=22.20.0" }`, type: module
- `.gitignore` — `node_modules/`, scratch files, local override `.counterbalance.md`
- `.claude-plugin/marketplace.json` — marketplace catalog with one plugin entry (`"source": "counterbalance"` via `metadata.pluginRoot: "./plugins"` shorthand), `$schema` set, MIT license declared
- `plugins/counterbalance/.claude-plugin/plugin.json` — bare metadata: `name: "counterbalance"`, `version: "0.0.1"`, `description`, `author: { name: "David Lovett" }`, `license: "MIT"`, `keywords`
- `tests/manifests.test.mjs` — asserts both manifests parse and have required fields

**Dependencies:** None (first phase)

**Done when:** `claude plugin validate .` passes at repo root, `claude plugin validate ./plugins/counterbalance` passes, `npm install` succeeds, `node --test tests/` passes. Infrastructure phase — no ACs mapped.
<!-- END_PHASE_1 -->

<!-- START_PHASE_2 -->
### Phase 2: Voice Profile Resolver

**Goal:** `resolveVoice(cwd)` works across all three layers with first-match-wins precedence. Testable via `node --test` against real filesystem fixtures.

**Components:**

- `plugins/counterbalance/lib/cascade.mjs` — lifted from Anvil `lib/cascade.mjs`, parameterized to accept a `voices` kind. Attribution header comment citing source module + MIT SPDX.
- `plugins/counterbalance/lib/parser.mjs` — lifted from Anvil `lib/principles.mjs`, renamed, reads markdown + optional YAML frontmatter into `{id, path, frontmatter, body, source}` records.
- `plugins/counterbalance/lib/windows-path.mjs` — path normalization helper lifted from Anvil's `hooks/principle-inject.mjs` lines 69-75.
- `plugins/counterbalance/lib/resolver.mjs` — exports `resolveVoice(cwd)` and provides a CLI entry point (`node lib/resolver.mjs --cwd=$PWD --json`). Returns `VoiceProfile | null`.
- `plugins/counterbalance/tests/resolver.test.mjs` — uses `node:fs/promises.mkdtemp` to spin up temp directories with combinations of the three file locations, asserts correct layer wins. Covers fallback-to-null case and malformed-YAML error case.
- `plugins/counterbalance/tests/cascade.test.mjs` — exercises cascade.mjs directly with synthetic layer inputs.
- `plugins/counterbalance/tests/parser.test.mjs` — valid frontmatter, no frontmatter, malformed frontmatter.

**Dependencies:** Phase 1 (needs `plugin.json` scaffold and `package.json` for `js-yaml`)

**Covers ACs:** counterbalance.AC2.1, AC2.2, AC2.3, AC2.4, AC2.5, AC2.6, AC2.7

**Done when:** All tests in AC2 pass. Resolver can be invoked from the command line and returns deterministic JSON for each fixture scenario.
<!-- END_PHASE_2 -->

<!-- START_PHASE_3 -->
### Phase 3: Skill Extraction

**Goal:** The ghost-writer skill lives in the plugin at the canonical path, with references intact and content adapted for plugin context.

**Components:**

- `plugins/counterbalance/skills/counterbalance/SKILL.md` — body extracted from `C:\Users\david\Repos\old_anvil\ghost-writer.skill` zip. Frontmatter updated: `name: counterbalance`, new `description` reflecting drafter + reviewer model, `user-invocable: false` (dispatched via commands). Body rewritten minimally to reference the counterbalance plugin name, the resolver CLI, and the Voice Discovery pre-flight CLAUDE.md migration step.
- `plugins/counterbalance/skills/counterbalance/references/fallback-voice.md` — copied from zip with no content changes.
- `plugins/counterbalance/tests/skill-structure.test.mjs` — asserts SKILL.md frontmatter parses, required sections exist (Voice Discovery, Drafting Loop, `<-` operator), fallback reference is reachable.

**Dependencies:** Phase 2 (SKILL.md references the resolver CLI)

**Covers ACs:** counterbalance.AC1.1, AC1.2, AC1.3

**Done when:** Tests in AC1 pass. `claude plugin validate ./plugins/counterbalance` still passes. The `.skill` zip at `C:\Users\david\Repos\old_anvil\ghost-writer.skill` is no longer referenced.
<!-- END_PHASE_3 -->

<!-- START_PHASE_4 -->
### Phase 4: Drafting Workflow — Subagent and Commands

**Goal:** `/ghost` and `/voice-refresh` dispatch the counterbalance subagent end-to-end, including the Voice Discovery CLAUDE.md pre-flight migration flow.

**Components:**

- `plugins/counterbalance/agents/counterbalance.md` — drafting subagent. Frontmatter: `name: counterbalance`, `description` (third-person, "Use when drafting prose from notes in the user's voice…"), `model: opus`, `tools: Read, Write, Edit, Glob, Grep, Bash, AskUserQuestion, Task`. Body embeds the full Drafting Loop + Voice Discovery mode, with the CLAUDE.md pre-flight as the first step of Voice Discovery.
- `plugins/counterbalance/commands/ghost.md` — `/ghost` command. Frontmatter: `description`, `allowed-tools: Task, Read, Glob`, `argument-hint: "[notes-file-or-inline-notes]"`. Body: resolve profile via `lib/resolver.mjs`, dispatch counterbalance subagent via Task with input + resolved profile.
- `plugins/counterbalance/commands/voice-refresh.md` — `/voice-refresh` command. Dispatches counterbalance subagent in Voice Discovery mode.
- `plugins/counterbalance/tests/agent-wiring.test.mjs` — structural tests: command files parse, reference the correct agent name, agent frontmatter is valid, tool list matches the contract, Voice Discovery migration block is present and textually asserts the "never mutate CLAUDE.md" invariant.

**Dependencies:** Phases 2 (resolver) and 3 (skill)

**Covers ACs:** counterbalance.AC3.1, AC3.2, AC3.3, AC3.4, AC3.5, AC3.6, AC4.1, AC4.2, AC4.3, AC4.4, AC4.5, AC4.6

**Done when:** Tests cover every `AC3.*` and `AC4.*` case. `claude plugin validate` passes with the new agent and commands.
<!-- END_PHASE_4 -->

<!-- START_PHASE_5 -->
### Phase 5: Reviewer Pipeline

**Goal:** `/voice-check` dispatches the voice-reviewer subagent. The reviewer slot is a verified extension point — a fixture test adds a stub second reviewer with zero changes to existing files.

**Components:**

- `plugins/counterbalance/lib/reviewers.mjs` — registry loader + applicability logic. Applicability lifted from Anvil `lib/applicability.mjs` with MIT attribution. Exports `loadRegistry()`, `applicableReviewers(filePath)`, and a minimal `aggregateFindings()` for future multi-reviewer use.
- `plugins/counterbalance/reviewers.json` — registry config with the voice-check entry (id, agent, command, applies_to, description).
- `plugins/counterbalance/agents/voice-reviewer.md` — review-only subagent. Frontmatter: `name: voice-reviewer`, `description` (third-person, "Use when reviewing a draft…"), `model: sonnet`, `tools: Read, Grep, Glob`. Explicit — no Write, no Edit, no Bash. Body: load resolved voice profile, walk draft for violations, emit structured findings JSON.
- `plugins/counterbalance/commands/voice-check.md` — `/voice-check` command. Thin dispatcher to voice-reviewer via Task.
- `plugins/counterbalance/tests/reviewers.test.mjs` — asserts registry parses, applicability matches expected file paths, findings contract shape is enforced, voice-reviewer frontmatter tool list excludes Write/Edit.
- `plugins/counterbalance/tests/reviewer-extensibility.test.mjs` — fixture test that drops a stub `agents/stub-reviewer.md` + `commands/stub-check.md` + registry entry into a temp copy of the plugin, asserts the stub is picked up without any other file changes.

**Dependencies:** Phases 2 (resolver) and 3 (skill)

**Covers ACs:** counterbalance.AC5.1, AC5.2, AC5.3, AC5.4, AC5.5, AC6.1, AC6.2, AC6.3

**Done when:** Tests cover every `AC5.*` and `AC6.1-3` case. Extensibility fixture test passes.
<!-- END_PHASE_5 -->

<!-- START_PHASE_6 -->
### Phase 6: Reference Library — Genres and Benchmarks

**Goal:** All declared reference files exist with usable content. Genre overlays are fleshed out where it matters; benchmark fixtures contain paired in-voice and AI-slop examples for each constrained form.

**Components:**

- `plugins/counterbalance/skills/counterbalance/references/genre-prd.md` — fleshed overlay (cadence, anti-patterns, structure rules for PRDs/RFCs/design docs)
- `plugins/counterbalance/skills/counterbalance/references/genre-pr.md` — fleshed overlay (PR descriptions, code review, changelogs)
- `plugins/counterbalance/skills/counterbalance/references/genre-slack.md` — fleshed overlay (Slack, email, async updates, retros)
- `plugins/counterbalance/skills/counterbalance/references/genre-adr.md` — placeholder overlay with structural scaffolding
- `plugins/counterbalance/skills/counterbalance/references/genre-summary.md` — placeholder
- `plugins/counterbalance/skills/counterbalance/references/genre-feedback.md` — placeholder
- `plugins/counterbalance/skills/counterbalance/references/benchmark-story.md` — in-voice example + known-bad AI-slop example of the same short story form
- `plugins/counterbalance/skills/counterbalance/references/benchmark-poem.md` — in-voice + AI-slop poem pair
- `plugins/counterbalance/skills/counterbalance/references/benchmark-limerick.md` — in-voice + AI-slop limerick pair
- `plugins/counterbalance/tests/reference-integrity.test.mjs` — asserts every reference file declared in SKILL.md exists on disk

**Dependencies:** Phase 3 (skill structure must exist)

**Covers ACs:** counterbalance.AC6.4 (reviewer docs updated), counterbalance.AC7.1, AC7.2, AC7.3, AC7.4

**Done when:** All reference files exist, integrity test passes, benchmark files contain both paired examples per form.
<!-- END_PHASE_6 -->

<!-- START_PHASE_7 -->
### Phase 7: CI Safety Gate

**Goal:** `.github/workflows/validate.yml` runs on every PR and on tag push. It is the enforcement point for all `AC8.*` criteria.

**Components:**

- `.github/workflows/validate.yml` — GitHub Actions workflow. Steps: checkout, install Node 22+, install Claude Code CLI (pinned version), `claude plugin validate ./plugins/counterbalance`, `claude plugin validate .`, `node --test tests/`, markdownlint, license check.
- `tests/reference-integrity.test.mjs` — upgraded from Phase 6 to also scan command files, agent files, `reviewers.json` entries, and hooks (none in v1) for file references that must resolve on disk.
- `tests/personal-data-scan.test.mjs` — grep-style scanner with a configurable deny list (content known to live only in the user's personal CLAUDE.md) that fails if any match appears in committed plugin files.
- `tests/version-bump.test.mjs` — reads base branch manifests via `git show`, compares versions, fails if `plugin.json` or `marketplace.json` body changed without a version increment.
- `tests/license-check.test.mjs` — asserts `LICENSE` file exists, contains "MIT", and both manifests declare `"license": "MIT"`.
- `.markdownlint.jsonc` — markdownlint-cli2 config. Rules tuned to allow fenced code blocks with `text` language (for the diagrams in this file).
- `plugins/counterbalance/tests/reviewer-extensibility.test.mjs` — kept from Phase 5; CI runs it.

**Dependencies:** Phases 1-6 (CI needs something to validate)

**Covers ACs:** counterbalance.AC8.1, AC8.2, AC8.3, AC8.4, AC8.5, AC8.6, AC8.7

**Done when:** CI workflow runs green on a scratch PR against the skeleton repo. A deliberately broken manifest (malformed JSON) produces a clear CI failure. A deliberately missing reference file produces a clear CI failure.
<!-- END_PHASE_7 -->

<!-- START_PHASE_8 -->
### Phase 8: Publishing Prep and v0.1.0 Release

**Goal:** Plugin is installable from a public GitHub repo. First-time publishing gotchas are documented.

**Components:**

- `README.md` — filled-in content: what counterbalance is, install instructions, command reference (`/ghost`, `/voice-refresh`, `/voice-check`), voice profile layer precedence, the CLAUDE.md migration flow, auto-update-off-by-default warning for third-party marketplaces, version-bump note for users to see updates, "how to add a reviewer" section linking to this design doc
- `CHANGELOG.md` — v0.1.0 entry listing drafter, reviewer, resolver, reference library, CI gate
- `plugins/counterbalance/.claude-plugin/plugin.json` — version bumped to `0.1.0`
- `.claude-plugin/marketplace.json` — plugin entry version bumped to `0.1.0`
- git tag `v0.1.0` applied to the commit that bumps the versions

**Dependencies:** Phase 7 (CI must be green on main first)

**Covers ACs:** counterbalance.AC9.1, AC9.2, AC9.3, AC9.4, AC9.5

**Done when:** Tag pushed, CI green on the tag, smoke test confirms `claude plugin marketplace add <user>/counterbalance` and `claude plugin install counterbalance@counterbalance` succeed on a machine other than the dev machine. README documents both install-time gotchas.
<!-- END_PHASE_8 -->

## Additional Considerations

**Windows path handling.** Resolver glob matching runs after `\` → `/` normalization. The helper is lifted from Anvil's `hooks/principle-inject.mjs` with a comment noting the specific Windows bug the normalization fixes.

**Third-party marketplace auto-update.** Claude Code disables auto-update by default for marketplaces outside `anthropics/claude-plugins-official`. The README documents this so users know to run `claude plugin update counterbalance@counterbalance` or toggle auto-update on manually. Not a bug — a known ecosystem default.

**Version-bump cache invalidation.** Claude Code's install cache only re-runs `claude plugin validate` when the `version` field increments. If the manifest body changes without a version bump, users hit the cached copy. Enforced by `tests/version-bump.test.mjs` in CI.

**CLAUDE.md is read-only from the plugin's perspective.** The Voice Discovery pre-flight reads CLAUDE.md, shows the user what was found, writes to the plugin data directory, and asks the user to remove the stale section themselves. No code path in the plugin ever mutates CLAUDE.md — verified structurally by a test that greps agent/command/lib files for write operations against CLAUDE.md paths.

**v2 roadmap (explicitly out of scope for v1, but the v1 design accommodates without rewrite):**

- **Named voice profiles.** `profiles/work.md`, `profiles/personal.md` as siblings of `profiles/default.md`. Resolver reads an active-profile setting (env var or CLI flag) and looks up `profiles/<active>.md` with fallback to `profiles/default.md`. Zero migration, additive only.
- **Stop-event plugin hook.** Ambient voice-check on turn boundary. Tracks which `.md` files were modified during the turn via per-session state in `$CLAUDE_PLUGIN_DATA/session/<id>.json`. Debounces naturally — one review pass per turn, not per edit. Marker file still gates it per repo.
- **Additional reviewers.** Reading level (Flesch-Kincaid), AI-slop detection, grammar, genre-conformance, structural flow, fact/citation check. Each is one new agent + command + registry entry.
- **Genre auto-detection.** Infer the right overlay from file path or content instead of requiring explicit `--genre=prd` selection.
- **Team voice discovery.** Workflow for multiple teammates to contribute to the same project-level voice profile without stepping on each other.
- **Install smoke test in CI.** Stretch goal from the DoD — runs `claude plugin marketplace add` and `claude plugin install` against a scratch Claude config inside GitHub Actions. Deferred to v1.1 if too complex to stand up.
