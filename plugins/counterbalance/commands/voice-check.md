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

Capture the JSON output. If the resolver prints `null`, the voice-reviewer will fall back to `references/fallback-voice.md`. Note this for the user in Step 4.

## Step 2: Load the draft

The draft is in `$ARGUMENTS`. Interpret as one of:

- A file path → use Read to get the contents, keep the path for `filePath`
- Inline text → use the argument text directly as `draft`, leave `filePath` undefined
- Empty → ask the user via AskUserQuestion for a draft file or abort

## Step 3: Dispatch the voice-reviewer subagent

Use the Task tool to dispatch the `voice-reviewer` subagent with:

- `draft`: the draft text from Step 2
- `filePath`: the source file path, or undefined
- `voiceProfile`: the resolved profile JSON from Step 1, or `null`

The subagent will return a structured JSON output and a markdown-rendered view.

## Step 4: Relay output

Print the rendered markdown view to the user. If the active profile was null and the subagent fell back, append a note: "No voice profile resolved for this directory. Reviewed against `references/fallback-voice.md`. Run `/voice-refresh` to set up a real profile."

If the findings list is empty, make sure the user sees the "No violations found" message — don't swallow it.
