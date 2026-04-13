---
description: "Apply <- corrections from a draft file back through the counterbalance drafting subagent, updating the draft in place. Single-level undo via a .bak file."
allowed-tools: Task, Read, Write, Bash, AskUserQuestion
argument-hint: "<draft-file>"
---

You are applying user corrections to a draft via the counterbalance drafting subagent. Follow these steps exactly.

## Step 1: Validate the draft file argument

`$ARGUMENTS` must be a path to a draft file. If it is empty, ask the user via AskUserQuestion which draft file to correct (free-text response). If the path does not exist, abort with `Draft file not found: <path>`.

Resolve the path to absolute. This absolute path is referenced as `<draft-path>` throughout.

## Step 2: Locate and read the sidecar

The sidecar metadata file lives next to the draft with the `.md` extension replaced by `.meta.json`. Example: `drafts/IDEAS.draft.md` has sidecar `drafts/IDEAS.draft.meta.json`.

If the sidecar does not exist, abort with: "No sidecar metadata for this draft at `<sidecar-path>`. Was this draft created by `/ghost`? `/ghost-correct` requires a sidecar to reconstruct context."

Read the sidecar with Read and parse the JSON. Keep it available as `<sidecar>`.

## Step 3: Parse corrections via the correction-parser CLI

```bash
node "${CLAUDE_PLUGIN_ROOT}/lib/correction-parser.mjs" --file="<draft-path>"
```

Capture stdout as JSON and parse it as an array of `{line, original, replacement}` objects. The parser strips fenced code blocks and inline backtick spans before matching, so `<-` occurrences inside code examples are not treated as corrections. If the parser exits non-zero, relay the stderr and stop.

## Step 4: Bounce if no corrections were found

If the parsed corrections array is empty, print:

> No `<-` markers found in `<draft-path>`. Did you save the file after editing? Add `<-` markers on the lines you want corrected, then re-run `/ghost-correct <draft-path>`.

Exit without dispatching.

## Step 5: Confirm the corrections with the user

Print the parsed corrections in a readable format:

```text
Found <N> corrections in <draft-path>:

Line 3:
  - old: <original>
  + new: <replacement>

Line 7:
  - old: <original>
  + new: <replacement>
```

Then use AskUserQuestion: `"Apply these <N> corrections to the draft?"` with exactly two options — `"Yes, apply"` and `"No, abort"`. This is the safety net for stray `<-` markers the parser could not detect (for example, prose mentions of the correction operator outside code spans).

If the user picks `"No, abort"`, exit without dispatching.

## Step 6: Re-resolve the active voice profile

The voice profile may have changed since the draft was originally written. Re-resolve it fresh:

```bash
node "${CLAUDE_PLUGIN_ROOT}/lib/resolver.mjs" --cwd="$PWD" --json
```

Capture the JSON. If the resolver prints `null`, bounce with the same pattern as `/ghost`:

> No voice profile resolved. `/ghost-correct` needs a voice guide to apply corrections.
>
> Run `/voice-refresh` to set one up.

Then exit.

## Step 7: Save the current draft as a .bak (single-level undo)

Compute the backup path by replacing `.md` with `.bak.md` on the draft filename. Example: `drafts/IDEAS.draft.md` → `drafts/IDEAS.draft.bak.md`.

Read the current draft file contents (the pre-correction state) and Write them to the backup path. **This overwrites any existing .bak file.** `/ghost-correct` is explicitly a single-level undo — only the immediately-prior version is preserved. If the user needs deeper history, they should commit drafts to git and let real version control handle it. Document this in the final user-facing output (Step 9).

## Step 8: Dispatch the counterbalance subagent in correction mode

Use the Task tool to dispatch the `counterbalance` subagent with an explicit correction-pass prompt:

- `mode`: `"drafting"`
- `phase`: `"correction"`
- `original_draft`: the full current draft text (with `<-` markers still in it, so the subagent sees the user's markup in context)
- `corrections`: the parsed corrections array from Step 3
- `resolved_profile`: the JSON from Step 6
- `sidecar`: the parsed sidecar from Step 2

In the Task prompt body, make the correction-pass intent explicit:

> You are receiving a correction pass, not a fresh draft. The user edited a draft you previously produced, adding `<-` markers on lines they want changed. Apply each correction in the `corrections` field to the `original_draft`, returning the full corrected draft as your primary output. For each correction, analyze the delta between `original` and `replacement` — if a pattern emerges that should become a voice-guide rule, surface it as a proposal at the end of your response. Do not write to any file; the `/ghost-correct` command handles persistence.

Capture the subagent's full response text.

## Step 9: Split the response, write only the corrected draft, relay the full response

The subagent's response has two parts: the corrected draft (always present) and a `### Voice guide proposals` section (optional — emitted only when correction deltas surface a pattern worth adding to the voice guide). Only the draft portion belongs in the draft file. The proposals are conversational feedback for the user and must stay out of the persisted draft.

Split the response on the literal heading `### Voice guide proposals`:

- **Everything before the heading** (or the full response, if the heading is absent) is the corrected draft. Trim trailing whitespace and write it to `<draft-path>` using the Write tool — this overwrites the pre-correction draft. The `.bak` file from Step 7 remains available as the single-level undo.
- **The heading and everything after it** stays in the relay only. Do not write it to the draft file.

Then print three things to the user in this order:

1. **The subagent's full response**, unchanged — both the corrected draft and the proposals section if any. The user should see the voice-guide proposals in chat so they can decide whether to fold them into the profile themselves.
2. **The "corrected draft written" footer**: "Corrected draft written to `<draft-path>`. Previous version saved to `<bak-path>` — this is a single-level undo. For deeper history, commit your drafts to git."
3. **The profile source footer** based on the `source` field of the Step 6 profile JSON:
    - `local` → "Applied using your local override (`.counterbalance.md`)."
    - `project` → "Applied using the project voice guide (`.claude/counterbalance.md`)."
    - `user` → "Applied using your user-layer voice profile."
    - `claude-md` → "Applied using the voice section from your `~/.claude/CLAUDE.md`. Run `/voice-refresh` to migrate it into a dedicated profile."
