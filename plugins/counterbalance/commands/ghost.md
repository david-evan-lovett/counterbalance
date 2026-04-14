---
description: "Draft prose in your voice from notes, dictation, or rough bullets via the counterbalance drafting subagent. Persists the draft to a file for iteration via /ghost-correct."
allowed-tools: Task, Read, Write, Bash, Glob
argument-hint: "[notes-file-or-inline-notes]"
---

You are dispatching the counterbalance drafting subagent. Follow these steps exactly.

## Step 1: Resolve the active voice profile

Run the counterbalance resolver to find the active voice profile:

```bash
node "${CLAUDE_PLUGIN_ROOT}/lib/resolver.mjs" --cwd="$PWD" --json
```

Capture the JSON output. The resolver walks four layers: a local override, a project voice guide, a user-layer profile, and finally a voice-section extraction from the user's global CLAUDE.md. If all four miss, the resolver prints the literal string `null`.

## Step 2: Bounce if no profile resolved

If the resolver printed `null`, **stop here and do not dispatch the subagent**. Tell the user verbatim:

> No voice profile resolved. Counterbalance needs a voice guide before it can draft in your voice.
>
> Run `/voice-refresh` to set one up. It will walk you through Voice Discovery and either import an existing voice section from your `~/.claude/CLAUDE.md` or build a new profile from your samples.

Then exit without running any further steps.

## Step 3: Resolve the drafts directory

Run the drafts directory resolver to find where the draft file should be written:

```bash
node "${CLAUDE_PLUGIN_ROOT}/lib/drafts-dir.mjs" --cwd="$PWD"
```

Capture the stdout — it is the absolute path of the drafts directory to use. If the command exits non-zero, relay the stderr to the user and stop. The resolver walks three layers: explicit `--out=` (not used by this command), a local drafts directory in the working directory if present, and a user-level default under the plugin data dir keyed on the working directory basename.

## Step 4: Load the input notes

The user's notes are in `$ARGUMENTS`. Interpret them as one of:

- A file path → read the file contents with Read. Record the absolute path as `input_path` for the sidecar.
- Inline text → treat the argument itself as the notes. Record `input_path` as `null`.
- Empty → ask the user via AskUserQuestion what to draft (or abort cleanly).

## Step 5: Dispatch the counterbalance subagent

Use the Task tool to dispatch the `counterbalance` subagent in **Drafting Loop** mode. Pass these fields in the Task prompt:

- `mode`: `"drafting"`
- `notes`: the text from Step 4
- `resolved_profile`: the JSON from Step 1 (guaranteed non-null at this point)
- `cwd`: `$PWD`

Capture the subagent's full response text for use in Step 6.

## Step 6: Compute the draft filename and write both files

Compute the draft filename:

- **Input was a file:** `<basename-without-extension>.draft.md`. Example: `IDEAS.md` → `IDEAS.draft.md`. Case-preserving.
- **Input was inline text:** `draft-<compact-iso>.md` where the timestamp is ISO in compact form with no punctuation. Example: `draft-20260412T1630.md`.

Check the drafts directory for a collision. If a file with the computed name already exists, append a numeric suffix before `.md` and increment until free: `IDEAS.draft.md` → `IDEAS.draft.2.md` → `IDEAS.draft.3.md`. This preserves history instead of overwriting.

Write the subagent's full response from Step 5 to `<drafts-dir>/<draft-filename>` using the Write tool.

Write a sidecar metadata file next to the draft at `<drafts-dir>/<draft-filename-without-.md>.meta.json` using the Write tool. The sidecar contents are JSON with this shape (pretty-printed, two-space indent):

```json
{
    "created_at": "<ISO 8601 timestamp in UTC>",
    "voice_profile_source": "<source field from Step 1 profile>",
    "voice_profile_path": "<path field from Step 1 profile>",
    "input_path": "<absolute path from Step 4 or null>",
    "cwd": "<PWD>"
}
```

The sidecar exists so `/ghost-correct` can reconstruct context on a future run. Do not include the full profile body or the draft text — they live in their own files.

## Step 7: Report back to the user

Print three things to the user, in this order:

1. **The subagent's response text**, unchanged, so the user sees the draft inline without having to open the file.
2. **A one-line "Draft written" footer** with the absolute draft path: "Draft written to `<absolute path>`. To correct: edit the file in place, add `<-` markers on lines you want changed, then run `/ghost-correct <path>`."
3. **A one-line profile source footer** derived from the `source` field on the Step 1 profile JSON:
    - `local` → "Drafted using your local override (`.counterbalance.md`)."
    - `project` → "Drafted using the project voice guide (`.claude/counterbalance.md`)."
    - `user` → "Drafted using your user-layer voice profile."
    - `claude-md` → "Drafted using the voice section from your `~/.claude/CLAUDE.md`. Run `/voice-refresh` to migrate it into a dedicated profile."
