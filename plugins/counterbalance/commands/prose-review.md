---
description: Review a draft against multiple lenses in parallel (voice, cliche, opener, cut, concrete, readability, repetition, spread, passive). Returns a merged line-sorted report.
allowed-tools: Task, Read, Bash, Glob, AskUserQuestion
argument-hint: "[draft-file]"
---

You are the counterbalance prose-review meta-command. Orchestrate multiple reviewers in parallel and produce a merged report. Follow these steps exactly.

## Step 1: Interpret the draft path

`$ARGUMENTS` should be a path to a Markdown draft file. If it's empty, ask the user:

Use AskUserQuestion with question `"Which draft file should I review?"` and a free-text response option.

If the path is provided but does not exist, abort with `Draft file not found: <path>`.

## Step 2: Resolve the active voice profile

```bash
node "${CLAUDE_PLUGIN_ROOT}/lib/resolver.mjs" --cwd="$PWD" --json
```

Capture the JSON or `null`. If non-null, write to a temp file:

```bash
PROFILE_FILE=$(mktemp -t cbal-profile-XXXXXX.json 2>/dev/null || mktemp)
printf '%s' '<captured-json>' > "$PROFILE_FILE"
```

Use a `trap 'rm -f "$PROFILE_FILE"' EXIT` handler so the file is cleaned up on any exit path.

## Step 3: Load the registry and compute applicable reviewers

Use the registry-query helper (`bin/registry-query.mjs`):

```bash
node "${CLAUDE_PLUGIN_ROOT}/bin/registry-query.mjs" applicable "$DRAFT_PATH"
```

Parse the JSON output. The `applicable` field is the array of reviewer entries matching the draft path's `applies_to` globs.

Also capture the full applicable ids list to a temp file for use in Step 6:

```bash
APPLICABLE_FILE=$(mktemp -t cbal-applicable-XXXXXX.json 2>/dev/null || mktemp)
# write a JSON array of applicable ids to $APPLICABLE_FILE
```

## Step 4: Handle no-applicable-reviewers case

If `applicable.length === 0`, print:

```
No applicable reviewers for `<path>`. The file type isn't covered by any reviewer's `applies_to` glob.
```

Exit without dispatching anything. This satisfies AC1.5.

## Step 5: First-stage picker (mode)

AskUserQuestion has a 4-option-per-question cap. Use TWO sequential questions to stay within it.

**Question 5a — mode selection (2 options):**

Use AskUserQuestion with question `"How would you like to pick reviewers?"` and options:

1. **preset** — pick one of the four named bundles (quick, voice, mechanical, full)
2. **custom** — choose reviewers individually

## Step 5b: Preset selection (if mode = preset)

If the user chose `preset`, ask a second question `"Which preset?"` with exactly these 4 options:

1. **quick** — readability, opener-check, cliche-check (3 reviewers, fast signal)
2. **voice** — voice-check, cliche-check, opener-check, cut-check, concrete-check (judgment-heavy)
3. **mechanical** — readability, repetition-check, spread-check, passive-check (no LLM cost)
4. **full** — all applicable reviewers (wildcard)

Exactly 4 options — no "Other" needed, within the cap.

## Step 6: Resolve preset or prompt custom selection

If user picked a named preset, intersect it with the applicable list via the registry-query helper:

```bash
node "${CLAUDE_PLUGIN_ROOT}/bin/registry-query.mjs" intersect <preset-id> "$APPLICABLE_FILE"
```

This prints `{"ids":[...]}` — the intersection of the preset's expanded ids and the applicable ids from Step 3. Use this list as `$SELECTED_IDS`.

If user picked `custom` in Step 5a, run multiselect AskUserQuestion prompts to collect per-reviewer choices. Reviewer counts after Phases 1–5: 5 agent-type (voice-check, cliche-check, opener-check, cut-check, concrete-check) and 4 lib-type. The 4-option cap means the agent side MUST be split into two pages (3+2 or 4+1). Suggested split:

- **Question 6a (agent page 1, 4 options):** voice-check, cliche-check, opener-check, cut-check
- **Question 6b (agent page 2, 1 option):** concrete-check
- **Question 6c (lib, 4 options):** readability, repetition-check, spread-check, passive-check

All three are multi-select. Collect selected ids into a single array. Skip questions for empty applicable subsets (e.g., if the file has no applicable libs, skip 6c).

## Step 7: Partition selected reviewers by type

Write the selected ids list to a temp file, then call the helper:

```bash
SELECTED_FILE=$(mktemp -t cbal-selected-XXXXXX.json 2>/dev/null || mktemp)
# write a JSON array of selected ids to $SELECTED_FILE
node "${CLAUDE_PLUGIN_ROOT}/bin/registry-query.mjs" partition "$SELECTED_FILE"
```

The output is `{"agents":[{id,agent,command},...],"libs":["id1","id2",...]}`. Use `agents` for Task dispatches (the `agent` field holds the dotted name like `counterbalance:cliche-hunter`) and `libs` for the mech-review Bash call.

Clean up the temp files via trap: `trap 'rm -f "$PROFILE_FILE" "$APPLICABLE_FILE" "$SELECTED_FILE"' EXIT`.

## Step 8: Dispatch agents in parallel via Task

For each agent in `agents`, call the Task tool with the subagent name (e.g., `cliche-hunter`, `opener-check`) and input:

```json
{
    "draft": "<file contents>",
    "filePath": "<path>",
    "voiceProfile": <json or null>
}
```

Collect the subagent response text for each. Parse the JSON block from each response to extract the `{reviewer, findings}` object. If parsing fails for one, wrap as `{reviewer: '<id>', findings: [], error: 'response parsing failed'}`.

**CRITICAL:** All agent Task dispatches should go out as a single batch (multiple Task tool calls in one message) so they run in parallel. If you serialize them, runtime inflates ~4x.

## Step 9: Dispatch all libs in one Bash call

```bash
node "${CLAUDE_PLUGIN_ROOT}/bin/mech-review.mjs" \
    --reviewers="$LIBS_CSV" \
    --file="$DRAFT_PATH" \
    --voice-profile-file="$PROFILE_FILE"
```

(Omit `--voice-profile-file` if the profile was null and no temp file was created.)

The runner prints `{"outputs": [...]}` to stdout. Parse it.

## Step 10: Merge via aggregateFindings

Concatenate the agent outputs and the lib outputs into a single JSON array (agent-first then lib order), write to a temp file, and call a small merge helper. The cleanest path is to do the merge inline in the command body since Claude is assembling the arrays from Task results and the mech-review JSON anyway — no need to shell out. Pseudocode:

```
all_outputs = agent_outputs.concat(lib_outputs)
// Claude computes aggregateFindings logic directly:
merged = {
    reviewers_run: all_outputs.map(o => o.reviewer),
    findings: sorted_flat_list_of_findings_with_reviewer_attached,
    errors: outputs_that_had_error,
    counts_by_severity: {violation, warning, note counts}
}
```

The sort order is line ascending then reviewer id. Findings with undefined `line` sort to the end. The aggregator is documented fully in Phase 1 Task 3; match that contract exactly.

Capture the merged result: `{reviewers_run, findings, errors, counts_by_severity}`.

## Step 11: Render the report

Print to the user:

```markdown
### Prose review — <N> findings

Reviewers run: <reviewers_run.join(", ")>
Severity counts: violation=<n> warning=<n> note=<n>

---

**Line 3** — [cliche-check] — warning — _cliche-ai-slop_
> In today's fast-paced world
Opening phrase flagged by rubric as AI-slop.
→ Suggested: cut the opener

**Line 7** — [readability] — note — _readability-out-of-band_

Flesch-Kincaid grade 5.2 falls outside the 9–13 target band.
→ Suggested: add complexity (longer sentences, more technical terms)

...
```

If `findings.length === 0`:

```markdown
### Prose review — clean

Reviewers run: <reviewers_run.join(", ")>

No findings across any reviewer. Nice.
```

## Step 12: Render errors section (if any)

If `errors.length > 0`, append a trailing section:

```markdown
---

### Reviewer errors

- **<reviewer-id>**: <error-message>
```

This satisfies AC6.3 — errors are surfaced but don't block the rest of the report.
