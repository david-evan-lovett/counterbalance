---
kind: genre-overlay
applies_to:
  - PR
  - code review
  - changelog
---

# Genre overlay: Pull Request / Code Review / Changelog

PR descriptions live in three places: the title line (one sentence, imperative), the body (what changed, why, how to verify), and the changelog entry (one line per change, formal format). Each has different constraints, but they share one rule: no detours.

## PR description cadence

First line is the delta: "Fix race condition in cache expiry" or "Add retry logic to blob uploads." Present tense, imperative mood. Not "This PR fixes" — just the fix. The body answers three questions in order: *what changed*, *why it needed to change*, *how to verify it works*. Skip the "I also took the opportunity to refactor X" tangent — that's a separate PR.

Describe the *change*, not the process. Not "I added logging at three points to help with debugging." Say "Logging added at sync, retry, and expiry points to surface transient failures." The reader doesn't need your methodology, they need to know what the code does now.

## Code review comment norms

Tone is neutral and technical. Not "Great idea here, but have you considered...?" — say "This doesn't handle the case where X. Can we add a check?" Specific feedback anchors to specific lines. "Line 47: the buffer could overflow on strings > 64KB" is better than "Consider bounds checking."

When uncertain, say "I don't know whether X, can you confirm?" instead of "Maybe consider...?" Uncertainty stated as a question shows you've thought through the gap. Maybe-statements sound like hedging.

## Changelog entry conventions

Keep-a-Changelog format: `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`. One entry per semantic change. Imperative verbs. "Fix race condition in cache expiry" goes under `Fixed`. "Add retry logic to blob uploads" goes under `Added`. Link the PR at the end: "(#123)". Concrete nouns, not vague ones — "blob uploads" not "blob handling."

## Anti-patterns specific to PR

"This PR adds..." — redundant subject. The title already says what it does. Start with the verb.

"Should be good to merge" invites bike-shedding. Either it's ready or it's not. If it's not, say what's blocking it.

Apology padding: "Sorry for the huge diff" or "This is a lot of changes." Fills space without substance. If the diff is large, explain why — "Refactored X to support Y, which required moving Z and updating three call sites." The reader sees the size; tell them why it matters.

Emoji in changelog entries ("Fixed 🐛 race condition") muddies the semantic signal. Keep it plain.

Passive voice in bug-fix descriptions: "an issue was fixed where X" hides the agent. "Fixed X" lands harder.

## Interaction with the base voice

Your voice conventions around density and specificity align tightly with PR norms. This overlay mostly catches places where procedural courtesy ("thanks for your time reviewing this") or over-explanation ("we realized that we should") dilutes signal. Lean into DO-first verbs and concrete nouns. That's both your voice and good PR practice.
