---
description: "Draft prose in your voice from notes, dictation, or rough bullets via the counterbalance drafting subagent."
allowed-tools: Task, Read, Bash, Glob
argument-hint: "[notes-file-or-inline-notes]"
---

You are dispatching the counterbalance drafting subagent. Follow these steps exactly.

## Step 1: Resolve the active voice profile

Run the counterbalance resolver to find the active voice profile:

```bash
node "${CLAUDE_PLUGIN_ROOT}/lib/resolver.mjs" --cwd="$PWD" --json
```

Capture the JSON output. If the resolver prints the literal string `null`, there is no resolved profile — note this and pass it along in Step 3.

## Step 2: Load the input notes

The user's notes are in `$ARGUMENTS`. Interpret them as one of:

- A file path → read the file contents with Read
- Inline text → treat the argument itself as the notes
- Empty → ask the user via AskUserQuestion what to draft (or abort cleanly)

## Step 3: Dispatch the counterbalance subagent

Use the Task tool to dispatch the `counterbalance` subagent in **Drafting Loop** mode. Pass these fields in the Task prompt:

- `mode`: `"drafting"`
- `notes`: the text from Step 2
- `resolved_profile`: the JSON from Step 1 (or `null`)
- `cwd`: `$PWD`

Relay the subagent's output back to the user unchanged.

## Step 4: If the subagent reports it fell back to `references/fallback-voice.md`

Surface this to the user: "No voice profile resolved. Drafted using the fallback voice guide at `references/fallback-voice.md`. Run `/voice-refresh` to set up a real profile."
