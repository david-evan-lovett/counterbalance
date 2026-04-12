# Counterbalance Phase 6: Reference Library — Genres and Benchmarks

**Goal:** Every reference file declared in SKILL.md exists on disk. Genre overlays are fleshed for the three high-traffic cases (PRD/RFC/design, PR/code review/changelog, Slack/email/retro) and scaffolded for the remaining three. Benchmark fixtures contain paired in-voice and AI-slop examples for each constrained form (story, poem, limerick).

**Architecture:** Nine new reference files under `plugins/counterbalance/skills/counterbalance/references/`. No code. One test upgrade: `tests/reference-integrity.test.mjs` that scans SKILL.md (and in Phase 7, other config files) for references and asserts every referenced file exists on disk.

**Tech Stack:** Pure markdown. No dependencies.

**Scope:** 6 of 8 phases.

**Codebase verified:** 2026-04-12. Phase 3 installed `plugins/counterbalance/skills/counterbalance/references/fallback-voice.md`. The `references/` directory exists but contains only that one file. Phase 6 adds the other nine and the integrity test.

---

## Acceptance Criteria Coverage

This phase implements and tests:

### counterbalance.AC7: Reference library
- **counterbalance.AC7.1 Success:** All six genre reference files exist: `genre-prd.md`, `genre-pr.md`, `genre-slack.md`, `genre-adr.md`, `genre-summary.md`, `genre-feedback.md`
- **counterbalance.AC7.2 Success:** All three benchmark reference files exist: `benchmark-story.md`, `benchmark-poem.md`, `benchmark-limerick.md`
- **counterbalance.AC7.3 Success:** Each benchmark file contains both an in-voice example and a known-bad AI-slop example of the same constrained form
- **counterbalance.AC7.4 Failure:** Reference integrity test fails if any file referenced from SKILL.md body is missing from `references/`

Note: `counterbalance.AC6.4 Documented` is explicitly carried over from Phase 5 into Phase 8 (README work). Not verified here.

---

## External Dependency Findings

N/A — this phase is content authoring + a file-existence test. No external research required.

---

## Task Checklist

<!-- START_SUBCOMPONENT_A (tasks 1-3) -->
Fleshed genre overlays (the three high-traffic ones).

<!-- START_TASK_1 -->
### Task 1: `references/genre-prd.md` — fleshed overlay for PRD/RFC/design doc

**Verifies:** counterbalance.AC7.1

**Files:**
- Create: `c:\Users\david\Repos\counterbalance\plugins\counterbalance\skills\counterbalance\references\genre-prd.md`

**Implementation:**

Write a ~200-300 word overlay that sits on top of the user's voice profile when drafting PRDs, RFCs, or design docs. The overlay is **not** a voice replacement — it adds work-surface conventions without contradicting the user's base voice.

**Required sections:**

1. **Header block** with YAML frontmatter: `kind: genre-overlay`, `applies_to: ["PRD", "RFC", "design doc"]`.
2. **Cadence rules specific to the genre** — what a good PRD/RFC opening paragraph looks like in terms of information density and ordering (context → problem → proposed direction). Explicit that the "What" sits under named section headers but the prose itself is DO-first.
3. **Structural conventions** — standard section headings (Summary, Problem, Proposed Solution, Alternatives Considered, Open Questions, Acceptance Criteria / Done-When). Note that PRDs lean on bulleted acceptance criteria; design docs lean on diagrams.
4. **Anti-patterns specific to the genre** — the things PRDs get wrong most often:
   - Leading with "We need to" instead of stating the problem
   - Solution description before problem description
   - Passive voice in the proposed-solution section
   - Hedging the Definition of Done with "roughly" or "ideally"
   - Stacking adjectives ("robust, scalable, maintainable") without grounding them
5. **Interaction with the base voice** — one paragraph explaining that when the user's voice conflicts with genre norms, the user's voice wins. The overlay is advice for tone adjustments, not a hard override.

**Style of the overlay itself:** Write it in plain, dense prose. No fluff. No generic "effective communication" advice. Every line should be actionable when drafting.

**Verification:**

```bash
ls -la plugins/counterbalance/skills/counterbalance/references/genre-prd.md
```

Expected: file exists, size > 2 KB (rough floor for a useful overlay).

**Commit:** `docs: add genre-prd overlay`
<!-- END_TASK_1 -->

<!-- START_TASK_2 -->
### Task 2: `references/genre-pr.md` — fleshed overlay for PR/code review/changelog

**Verifies:** counterbalance.AC7.1

**Files:**
- Create: `c:\Users\david\Repos\counterbalance\plugins\counterbalance\skills\counterbalance\references\genre-pr.md`

**Implementation:**

Same structure as Task 1, adapted for PR descriptions, code-review comments, and changelog entries.

**Required sections:**

1. Frontmatter: `kind: genre-overlay`, `applies_to: ["PR", "code review", "changelog"]`.
2. **PR description cadence** — the first line is a sentence (imperative mood, present tense). The body answers: what changed, why, and how to verify. Skip "I also took the opportunity to refactor X" detours.
3. **Code review comment norms** — tone is neutral and technical, not friendly-and-apologetic. Specific feedback anchored to specific lines. When uncertain, say "I don't know whether X, can you confirm?" instead of "Maybe consider X?"
4. **Changelog entry conventions** — Keep-a-Changelog format (`Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`). One-line entries. Imperative verbs. Link to the PR with `(#123)` at the end.
5. **Anti-patterns:**
   - "This PR adds..." (redundant subject — start with the verb)
   - "Should be good to merge" (confidence theater)
   - Apology padding: "Sorry for the huge diff" → just write the diff
   - Emoji in changelog entries
   - Passive voice in bug-fix descriptions ("an issue was fixed where X" → "fix X")

**Verification:** same as Task 1.

**Commit:** `docs: add genre-pr overlay`
<!-- END_TASK_2 -->

<!-- START_TASK_3 -->
### Task 3: `references/genre-slack.md` — fleshed overlay for Slack/email/retro

**Verifies:** counterbalance.AC7.1

**Files:**
- Create: `c:\Users\david\Repos\counterbalance\plugins\counterbalance\skills\counterbalance\references\genre-slack.md`

**Implementation:**

Same structure as Tasks 1-2, for async team updates in Slack-style channels, email, and retro docs.

**Required sections:**

1. Frontmatter: `kind: genre-overlay`, `applies_to: ["Slack", "email", "async update", "retro"]`.
2. **Async-update cadence** — lead with the change or ask, then context. Messages are scanned, not read. First line earns the rest.
3. **Email conventions** — subject line is a sentence. No "Hey team!" opener. Close with a concrete next step or ask, not "Let me know your thoughts."
4. **Retro doc norms** — "What happened" facts first, "What worked / didn't work" as bullets, "Action items" with owners. No "I feel like" preambles — make the observation, then name the feeling if it matters.
5. **Anti-patterns:**
   - "Quick update:" preamble (the update should speak for itself)
   - "Circling back" emails
   - Retro action items without an owner
   - Emoji-laden Slack threads in channels where one clear message would suffice
   - "LGTM" in a thread where a concrete yes/no was asked

**Verification:** same as Task 1.

**Commit:** `docs: add genre-slack overlay`
<!-- END_TASK_3 -->
<!-- END_SUBCOMPONENT_A -->

<!-- START_SUBCOMPONENT_B (task 4) -->
Scaffolds for the three lower-traffic genres. These land as placeholders with frontmatter + minimal structure so the reference-integrity test passes and future work has a clear target.

<!-- START_TASK_4 -->
### Task 4: Three scaffold genre overlays

**Verifies:** counterbalance.AC7.1

**Files:**
- Create: `c:\Users\david\Repos\counterbalance\plugins\counterbalance\skills\counterbalance\references\genre-adr.md`
- Create: `c:\Users\david\Repos\counterbalance\plugins\counterbalance\skills\counterbalance\references\genre-summary.md`
- Create: `c:\Users\david\Repos\counterbalance\plugins\counterbalance\skills\counterbalance\references\genre-feedback.md`

**Implementation:**

Each of these gets a ~10-line placeholder with frontmatter and a "This overlay is a scaffold — flesh out in a future release" note. Enough to satisfy AC7.1 (file exists) without pretending to have content that isn't there.

**`genre-adr.md`:**

```markdown
---
kind: genre-overlay
applies_to:
    - ADR
    - architectural decision record
status: scaffold
---

# Genre overlay: Architecture Decision Record (ADR)

**Status:** scaffold. Flesh out in a future release.

## Structural scaffolding

ADRs conventionally use Michael Nygard's template: Title, Status, Context, Decision, Consequences. Status is one of `proposed | accepted | deprecated | superseded by ADR-NNN`.

## What this overlay will cover when fleshed

- Cadence norms for the Context section (past tense, specific dates, named stakeholders)
- Decision statement as a single declarative sentence (no hedging)
- Consequences split into positive and negative — counterbalance's voice demands both sides be concrete
- Anti-patterns: "We agreed that…" (passive consensus language)
```

**`genre-summary.md`:**

```markdown
---
kind: genre-overlay
applies_to:
    - summary
    - TL;DR
    - executive summary
status: scaffold
---

# Genre overlay: Summary

**Status:** scaffold. Flesh out in a future release.

## Structural scaffolding

Summaries sit at the top of a longer document and compress the full content into 3-5 sentences. The DO-first rule applies doubly: the first sentence must state the outcome, not the approach.

## What this overlay will cover when fleshed

- How long a summary should be per genre (PRD summary vs retro summary)
- The "first sentence is the whole document in miniature" rule
- When to use bullet summaries vs prose summaries
- Anti-patterns: summary as introduction, summary as marketing copy
```

**`genre-feedback.md`:**

```markdown
---
kind: genre-overlay
applies_to:
    - feedback
    - 1:1 notes
    - performance review
status: scaffold
---

# Genre overlay: Feedback

**Status:** scaffold. Flesh out in a future release.

## Structural scaffolding

Feedback writing is anchored to specific observations, not general impressions. "In the March design review, you pushed back on X by proposing Y" beats "You're good at advocating for your ideas."

## What this overlay will cover when fleshed

- Observation → impact → suggestion structure
- Neutral description (avoid positive/negative loading)
- How to name a pattern vs a single incident
- Anti-patterns: sandwich feedback, performative positivity, "I feel" framing for technical critique
```

**Verification:**

```bash
ls plugins/counterbalance/skills/counterbalance/references/genre-*.md | wc -l
```

Expected: `6` — all six genre files now present (3 fleshed from prior tasks + 3 scaffold from this task).

**Commit:** `docs: add ADR, summary, and feedback genre overlay scaffolds`
<!-- END_TASK_4 -->
<!-- END_SUBCOMPONENT_B -->

<!-- START_SUBCOMPONENT_C (tasks 5-7) -->
Benchmark fixtures — paired in-voice + AI-slop per constrained form.

<!-- START_TASK_5 -->
### Task 5: `references/benchmark-story.md` — short story benchmark pair

**Verifies:** counterbalance.AC7.2, counterbalance.AC7.3

**Files:**
- Create: `c:\Users\david\Repos\counterbalance\plugins\counterbalance\skills\counterbalance\references\benchmark-story.md`

**Implementation:**

Write a benchmark fixture file that contains two short stories of the same constrained form (e.g., 100-200 word flash fiction about a specific prompt). One is **in the user's voice** — concrete, DO-first sentences, narrative register, specific details, subtle wordplay. The other is **AI slop** — abstract, hedged, emotionally generic, em-dash-heavy, "it wasn't just X, it was Y" framing, vague universals.

**Frontmatter:**

```yaml
---
kind: benchmark-fixture
form: short-story
constraint: "100-200 words, single scene, no dialog"
---
```

**Body structure:**

```markdown
# Benchmark: short story

Two drafts of the same constraint. Use these to verify that a voice profile produces distinct output — if the generated draft reads like the AI-slop example rather than the in-voice example, the profile isn't working.

## The constraint

Write 100-200 words of flash fiction. Single scene. No dialog. Subject: **the first coffee of the morning on a day you're dreading.**

## In-voice draft (good)

[Write a 100-200 word flash fiction piece in the narrative register from `C:\Users\david\.claude\CLAUDE.md`'s voice section. Concrete. DO-first sentences. Specific details — not "the coffee" but a specific coffee. No abstractions. Subtle, not performative. The scene should have one action that lands, one detail that resonates, and a final line that stays on the table.]

## AI-slop draft (bad)

[Write a 100-200 word flash fiction piece on the same prompt in deliberate AI slop. Em-dashes stacked. "It wasn't just coffee — it was a ritual." Vague universals. Generic emotional beats. The word "profound" or "quiet" or "somehow" appearing unearned. Passive construction. "In that moment..." framing. Do not caricature — write it the way a default LLM would write it when asked "write a short story about a dreaded morning."]

## What to look for

The in-voice draft has specific nouns (brand, color, texture). The AI-slop draft has abstract ones. The in-voice draft lets one thing happen. The AI-slop draft narrates feelings about things that didn't happen. A voice profile that generates output resembling the second draft is a profile not doing its job.
```

**Note to the implementor:** The two drafts must be authored at implementation time by reading the user's voice guidance in `C:\Users\david\.claude\CLAUDE.md` and producing drafts that genuinely differ in the ways the voice guidance specifies. Do NOT write placeholder drafts — the benchmark is only useful if the pair actually demonstrates the distinction. If you can't confidently produce an in-voice draft, ask the user via AskUserQuestion for a 2-3 sentence seed and draft from that.

**Verification:**

```bash
grep -c "## In-voice draft" plugins/counterbalance/skills/counterbalance/references/benchmark-story.md
grep -c "## AI-slop draft" plugins/counterbalance/skills/counterbalance/references/benchmark-story.md
```

Expected: both print `1`. The reference-integrity test in Task 8 also asserts the presence of both sections.

**Commit:** `docs: add short-story benchmark fixture with voice/slop pair`
<!-- END_TASK_5 -->

<!-- START_TASK_6 -->
### Task 6: `references/benchmark-poem.md` — poem benchmark pair

**Verifies:** counterbalance.AC7.2, counterbalance.AC7.3

**Files:**
- Create: `c:\Users\david\Repos\counterbalance\plugins\counterbalance\skills\counterbalance\references\benchmark-poem.md`

**Implementation:**

Same structure as Task 5, for a constrained poetic form.

**Frontmatter:**

```yaml
---
kind: benchmark-fixture
form: poem
constraint: "8-16 lines, free verse, concrete imagery"
---
```

**The constraint:** 8-16 lines of free verse. Subject: **the moment you realize something you've been avoiding is actually load-bearing.**

Required sections: `## In-voice draft (good)`, `## AI-slop draft (bad)`, `## What to look for`.

Same instructor note: the pair must actually differ. The in-voice poem should have specific nouns, a DO-first structure, and a final line that earns itself. The AI-slop poem should be performative ("the weight of absence," "in the silence between," etc.).

**Verification:** same grep pattern as Task 5.

**Commit:** `docs: add poem benchmark fixture with voice/slop pair`
<!-- END_TASK_6 -->

<!-- START_TASK_7 -->
### Task 7: `references/benchmark-limerick.md` — limerick benchmark pair

**Verifies:** counterbalance.AC7.2, counterbalance.AC7.3

**Files:**
- Create: `c:\Users\david\Repos\counterbalance\plugins\counterbalance\skills\counterbalance\references\benchmark-limerick.md`

**Implementation:**

Same pattern, tighter constraint. Limericks are rigidly formal (AABBA rhyme, 8-8-5-5-8 meter) which exposes AI slop faster than free verse does.

**Frontmatter:**

```yaml
---
kind: benchmark-fixture
form: limerick
constraint: "strict AABBA rhyme, 8-8-5-5-8 meter, must actually be funny"
---
```

**The constraint:** A clean five-line limerick about writing with an AI that keeps rewriting your voice. The in-voice draft should be genuinely funny. The AI-slop draft should be the limerick-shaped-but-not-funny thing an LLM produces when asked — slant rhymes, meter off by a syllable, joke explained in the last line.

Required sections: same three as Task 5.

Include a `## What to look for` note: "Formal constraints like limericks are the sharpest test of voice. A voice profile that produces a limerick with a weak A rhyme or a flat punchline is a profile that doesn't know its user's sense of humor."

**Verification:** same grep pattern as Task 5.

**Commit:** `docs: add limerick benchmark fixture with voice/slop pair`
<!-- END_TASK_7 -->
<!-- END_SUBCOMPONENT_C -->

<!-- START_TASK_8 -->
### Task 8: `tests/reference-integrity.test.mjs` — SKILL.md references exist

**Verifies:** counterbalance.AC7.4, and a smoke check for AC7.1, AC7.2, AC7.3

**Files:**
- Create: `c:\Users\david\Repos\counterbalance\tests\reference-integrity.test.mjs` (unit — fs-only)

**Implementation:**

Scan `plugins/counterbalance/skills/counterbalance/SKILL.md` for reference file mentions and assert each referenced file exists. Also assert the full expected set of nine reference files is present.

**What "reference file mention" means in SKILL.md:** a markdown link or code-span that matches the pattern `references/<filename>.md`. Use a regex like `/references\/([a-z0-9-]+\.md)/g` and collect every captured filename.

**Test blocks:**

- `counterbalance.AC7.4: every references/*.md mentioned in SKILL.md exists on disk` — extract mentioned filenames from SKILL.md, assert each one exists at `plugins/counterbalance/skills/counterbalance/references/<name>`.
- `counterbalance.AC7.1: all six genre reference files exist` — explicit list: `genre-prd.md`, `genre-pr.md`, `genre-slack.md`, `genre-adr.md`, `genre-summary.md`, `genre-feedback.md`. Loop with `fs.stat`.
- `counterbalance.AC7.2: all three benchmark reference files exist` — explicit list: `benchmark-story.md`, `benchmark-poem.md`, `benchmark-limerick.md`.
- `counterbalance.AC7.3: each benchmark file contains both an in-voice and an AI-slop section` — for each benchmark file, read the body and assert it contains both `## In-voice draft` and `## AI-slop draft` (or equivalent headings — use a looser regex if those exact strings aren't guaranteed).

**Path resolution:** absolute paths from `import.meta.url` as in prior test files.

**Failure-injection guarantee (AC7.4 specifically says the test should FAIL on missing files):**

The test must fail loudly if any file is missing. Use `assert.ok(existsSync(p), `missing reference file: ${p}`)` so the failure message names the missing path.

**Verification:**

```bash
node --test tests/reference-integrity.test.mjs
```

Expected: all test blocks pass, exit 0.

**Intentional negative test (manual, run once, don't commit):**

1. `mv plugins/counterbalance/skills/counterbalance/references/fallback-voice.md /tmp/`
2. `node --test tests/reference-integrity.test.mjs`
3. Expected: failure, error message naming `fallback-voice.md`. Exit non-zero.
4. `mv /tmp/fallback-voice.md plugins/counterbalance/skills/counterbalance/references/`
5. Re-run, expected: passes.

This negative test is one-time verification — do not commit the mv, just confirm the test fails the right way.

**Commit:** `test: assert reference integrity for SKILL.md references and benchmark pairs`
<!-- END_TASK_8 -->

<!-- START_TASK_9 -->
### Task 9: Phase verification

**Step 1: Full suite**

```bash
node --test tests/
```

Expected: all tests from Phases 1-6 pass.

**Step 2: Directory check**

```bash
ls plugins/counterbalance/skills/counterbalance/references/ | sort
```

Expected (alphabetical):

```text
benchmark-limerick.md
benchmark-poem.md
benchmark-story.md
fallback-voice.md
genre-adr.md
genre-feedback.md
genre-pr.md
genre-prd.md
genre-slack.md
genre-summary.md
```

Ten files total (9 added in Phase 6 + the `fallback-voice.md` from Phase 3).

**Step 3: `claude plugin validate .`**

```bash
claude plugin validate .
```

Expected: no errors. Reference files with YAML frontmatter must parse — if any fail, check for unescaped colons or backticks in the frontmatter.

**No commit for this task — verification only.**
<!-- END_TASK_9 -->

---

## Phase 6 Done When

- Six genre files exist (3 fleshed, 3 scaffold) under `plugins/counterbalance/skills/counterbalance/references/`
- Three benchmark files exist with paired in-voice + AI-slop drafts
- `tests/reference-integrity.test.mjs` passes and would fail loudly on any missing reference file
- `claude plugin validate .` passes
