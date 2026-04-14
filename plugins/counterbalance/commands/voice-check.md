---
description: Review a draft against the active voice profile. Returns line-referenced findings. Does not rewrite.
allowed-tools: Task, Read, Bash, Glob
argument-hint: "[draft-file-or-inline-text]"
---

You are dispatching the counterbalance voice-reviewer subagent. Follow these steps exactly.

## Step 1: Resolve the active voice profile

```bash
node "${CLAUDE_PLUGIN_ROOT}/lib/resolver.mjs" --cwd="$PWD" --json
```

Capture the JSON output. The resolver walks four layers: `./.counterbalance.md`, `./.claude/counterbalance.md`, `$HOME/.claude/plugins/data/counterbalance/profiles/default.md`, and finally a voice-section extraction from `$HOME/.claude/CLAUDE.md`. If all four miss, the resolver prints the literal string `null`.

## Step 2: Bounce if no profile resolved

If the resolver printed `null`, **stop here and do not dispatch the subagent**. Tell the user verbatim:

> No voice profile resolved. Voice check needs a voice guide to review against.
>
> Run `/voice-refresh` to set one up. It will walk you through Voice Discovery and either import an existing voice section from your `~/.claude/CLAUDE.md` or build a new profile from your samples.

Then exit without running any further steps.

## Step 3: Load the draft

The draft is in `$ARGUMENTS`. Interpret as one of:

- A file path → use Read to get the contents, keep the path for `filePath`
- Inline text → use the argument text directly as `draft`, leave `filePath` undefined
- Empty → ask the user via AskUserQuestion for a draft file or abort

## Step 4: Dispatch the voice-reviewer subagent

Use the Task tool to dispatch the `voice-reviewer` subagent with:

- `draft`: the draft text from Step 3
- `filePath`: the source file path, or undefined
- `voiceProfile`: the resolved profile JSON from Step 1 (guaranteed non-null at this point)

The subagent will return a structured JSON output and a markdown-rendered view.

## Step 5: Relay output

Print the rendered markdown view to the user. If the findings list is empty, make sure the user sees the "No violations found" message — don't swallow it.
