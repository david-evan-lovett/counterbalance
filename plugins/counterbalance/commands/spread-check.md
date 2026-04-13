---
description: Flag runs of 4+ consecutive sentences in the same length bucket. Mechanical check, no LLM cost.
allowed-tools: Read, Bash, Glob, AskUserQuestion
argument-hint: "[draft-file-or-inline-text]"
---

You are dispatching the counterbalance spread reviewer (a pure Node function, no LLM). Follow these steps exactly.

## Step 1: Resolve the active voice profile

```bash
node "${CLAUDE_PLUGIN_ROOT}/lib/resolver.mjs" --cwd="$PWD" --json
```

Capture the JSON output. If the output is the literal string `null`, skip the temp-file step and pass no profile to the reviewer. Otherwise, write the JSON to a temp file:

```bash
PROFILE_FILE=$(mktemp -t cbal-profile-XXXXXX.json 2>/dev/null || mktemp)
echo '<captured-json>' > "$PROFILE_FILE"
```

(Substitute the captured JSON for `<captured-json>`. Quote carefully — the profile can contain single quotes and newlines.)

## Step 2: Interpret the draft argument

`$ARGUMENTS` is either a file path or inline text. If it's a file path (ends in `.md`, `.mdx`, or `.txt`, and the file exists), use it directly as `--file=<path>`. If it's inline text, pass it via `--draft=<text>` after escaping any literal quotes.

If `$ARGUMENTS` is empty, use AskUserQuestion to request a draft file or abort with a clear error.

## Step 3: Invoke the spread CLI

With profile:
```bash
node "${CLAUDE_PLUGIN_ROOT}/lib/spread.mjs" --file="$DRAFT_PATH" --voice-profile-file="$PROFILE_FILE"
```

Without profile:
```bash
node "${CLAUDE_PLUGIN_ROOT}/lib/spread.mjs" --file="$DRAFT_PATH"
```

The CLI prints one JSON blob to stdout: `{reviewer, findings}`.

## Step 4: Render the output to the user

Parse the JSON. If `findings` is empty, print:

```markdown
### Spread — no monotone runs

Sentence lengths vary well. No findings.
```

If `findings` is non-empty, print:

```markdown
### Spread — N findings
```

Iterate findings and render each as:

```markdown
**Line <line>** — `note` — _repetition-within-window_

> <quote>

<message>

→ Suggested: <suggested>
```

Substitute `<message>` and `<suggested>` from the finding.

## Step 5: Clean up

Delete the temp file if you created one:

```bash
[ -n "$PROFILE_FILE" ] && rm -f "$PROFILE_FILE"
```
