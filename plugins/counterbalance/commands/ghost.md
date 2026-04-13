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

Capture the JSON output. The resolver walks four layers: `./.counterbalance.md`, `./.claude/counterbalance.md`, `$HOME/.claude/plugins/data/counterbalance/profiles/default.md`, and finally a voice-section extraction from `$HOME/.claude/CLAUDE.md`. If all four miss, the resolver prints the literal string `null`.

## Step 2: Bounce if no profile resolved

If the resolver printed `null`, **stop here and do not dispatch the subagent**. Tell the user verbatim:

> No voice profile resolved. Counterbalance needs a voice guide before it can draft in your voice.
>
> Run `/voice-refresh` to set one up. It will walk you through Voice Discovery and either import an existing voice section from your `~/.claude/CLAUDE.md` or build a new profile from your samples.

Then exit without running any further steps.

## Step 3: Load the input notes

If Step 2 did not bounce, load the input. The user's notes are in `$ARGUMENTS`. Interpret them as one of:

- A file path → read the file contents with Read
- Inline text → treat the argument itself as the notes
- Empty → ask the user via AskUserQuestion what to draft (or abort cleanly)

## Step 4: Dispatch the counterbalance subagent

Use the Task tool to dispatch the `counterbalance` subagent in **Drafting Loop** mode. Pass these fields in the Task prompt:

- `mode`: `"drafting"`
- `notes`: the text from Step 3
- `resolved_profile`: the JSON from Step 1 (guaranteed non-null at this point)
- `cwd`: `$PWD`

Relay the subagent's output back to the user unchanged.

## Step 5: Surface the profile source

After the subagent finishes, tell the user which layer its voice guide came from by reading the `source` field on the profile JSON:

- `local` → "Drafted using your local override (`.counterbalance.md`)."
- `project` → "Drafted using the project voice guide (`.claude/counterbalance.md`)."
- `user` → "Drafted using your user-layer voice profile."
- `claude-md` → "Drafted using the voice section from your `~/.claude/CLAUDE.md`. Run `/voice-refresh` to migrate it into a dedicated profile."
