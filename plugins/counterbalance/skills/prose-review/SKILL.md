---
name: prose-review
description: Use when reviewing prose against multiple lenses — voice, cliches, openers, cuttability, concreteness, readability, repetition, sentence spread, passive voice. Orchestrates the counterbalance reviewer suite in parallel and produces a merged line-sorted report. Works on Markdown drafts.
user-invocable: false
---

# Prose Review Suite

## When to use this skill

Use this skill when the user asks any of:
- "Review this draft"
- "Check my prose"
- "What's wrong with this essay"
- "Run the full review suite"
- Any request for multi-dimensional prose feedback on a Markdown draft

If the user names a specific reviewer (e.g., "check for cliches", "run readability"), prefer that reviewer's standalone slash command instead of the orchestration flow.

## What it does

Runs multiple prose reviewers in parallel against a single draft and produces one merged, line-sorted report. Reviewers split into two kinds:

**Judgment reviewers** (Claude subagents, Sonnet-pinned):
- voice-check — draft vs. active voice profile
- cliche-check — AI-slop phrases, stock metaphors, oily cadence, extended metaphors
- opener-check — hedge-first, "but it was", "not X but Y", filler-first openers
- cut-check — filler adverbs, redundant clauses, cuttable sentences
- concrete-check — evaluations without evidence, abstract scenes

**Mechanical reviewers** (pure Node functions, no LLM cost):
- readability — Flesch-Kincaid grade 9–13 band check
- repetition-check — non-stopword overuse within 5-sentence windows
- spread-check — 4+ consecutive sentences in the same length bucket
- passive-check — to-be + past participle heuristic

## Orchestration policy

The prose-review meta-command orchestrates the full fan-out in seven stages:

1. Resolve the active voice profile via `lib/resolver.mjs`. Write to temp file for passthrough.
2. Filter reviewers by `applies_to` glob against the input file path. Only applicable reviewers proceed.
3. Present a first-stage picker: four named presets (`quick`, `voice`, `mechanical`, `full`) plus a `custom` drop-through.
4. If `custom`, present multiselect UIs split by type (agents + libs) to stay within the 4-option AskUserQuestion cap.
5. Partition the selection via `partitionByType`. Agents dispatch via Task in parallel; libs dispatch via a single Bash call to `bin/mech-review.mjs`.
6. Merge via `aggregateFindings`. Render the result as a line-sorted markdown report.
7. Fail-open: one reviewer crashing surfaces as an in-band error entry and does not abort the rest.

## Report format

Header line with reviewer list and severity counts. Then one block per finding:

```
**Line N** — [reviewer] — severity — rule
> quoted offending text
message text
→ Suggested: suggestion hint (if present)
```

Sorted by line ascending, then by reviewer id. Empty result renders a "clean" message rather than an empty block.

## Presets

- **quick** — readability + opener-check + cliche-check (3 reviewers; fast signal on the obvious tells)
- **voice** — voice-check + cliche-check + opener-check + cut-check + concrete-check (judgment-heavy)
- **mechanical** — readability + repetition-check + spread-check + passive-check (no LLM cost)
- **full** — all applicable reviewers (`["*"]` wildcard expands to everything that applies to the file)

Presets are curated, not derived. Adding a new reviewer does NOT automatically include it in any preset — the person adding the reviewer decides.

## Boundaries

- Read-only. No reviewer rewrites the draft. Agent reviewers declare `tools: Read, Grep, Glob`. Lib reviewers have no Claude tools at all.
- Does not touch CLAUDE.md. Does not modify the drafter or voice profile.
- Windows bash quoting: voice profiles are passed to child processes via a temp file, never inlined.
