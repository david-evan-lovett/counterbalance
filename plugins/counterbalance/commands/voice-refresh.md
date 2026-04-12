---
description: "Re-run Voice Discovery against the active voice profile. Includes the CLAUDE.md pre-flight migration on first run."
allowed-tools: Task, Read, Bash
argument-hint: "(no arguments)"
---

You are dispatching the counterbalance subagent in Voice Discovery mode.

## Step 1: Resolve the current active profile (for context, not gating)

```bash
node "${CLAUDE_PLUGIN_ROOT}/lib/resolver.mjs" --cwd="$PWD" --json
```

Capture the JSON output. Voice Discovery runs regardless — this step is purely informational (so the subagent can show the user what's currently active).

## Step 2: Dispatch the counterbalance subagent

Use the Task tool to dispatch the `counterbalance` subagent in **Voice Discovery** mode:

- `mode`: `"voice-discovery"`
- `current_profile`: the JSON from Step 1 (or `null`)
- `cwd`: `$PWD`

The subagent will run the CLAUDE.md pre-flight migration as its first step, then proceed to sample gathering (or skip sample gathering if the user accepted the CLAUDE.md import and the synthesized profile is sufficient).
