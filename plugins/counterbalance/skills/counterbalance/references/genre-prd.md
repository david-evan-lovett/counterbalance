---
kind: genre-overlay
applies_to:
  - PRD
  - RFC
  - design doc
---

# Genre overlay: Product Requirements Document (PRD)

A PRD sits between vision and execution. Your opening moves hard on the problem, then the proposed direction. The prose itself stays DO-first, even when organized under section headers — "Summary" doesn't mean abandon concrete action verbs. Headers name the *structure*, not the style.

## Cadence rules for PRD opening

Lead with context and the specific problem in the opening paragraph. Not "We need to improve X" but "Users lose data on network drop because we're not persisting state." Name the condition, the outcome, the gap. Follow with proposed direction — the shape of the solution, not yet the details. "We're adding a local queue that syncs on reconnect" moves faster than "We should consider potentially exploring options around persistence."

PRDs lean on bulleted acceptance criteria, but prose stays dense. "The system handles network drops without data loss" is better as "Reconnection on network recovery completes without user-visible data loss" — sharper, testable, specific.

## Structural conventions

Standard sections: **Summary** (one tight paragraph stating outcome and scope), **Problem** (what's broken, who feels it, when), **Proposed Solution** (the shape of the thing), **Alternatives Considered** (briefly why you didn't pick those), **Open Questions** (what you don't know yet), **Acceptance Criteria** (testable done-when statements). Design docs add diagrams under Proposed Solution, usually one architecture diagram and one interaction flow.

## Anti-patterns specific to PRD

Lead with "We need to" or "We should" and the reader's eyes glaze. State the problem hard. "Passive voice in the proposed-solution section creates distance between the reader and the work. Write "The API rejects duplicate requests" not "Duplicate requests will be rejected by the API." The agent does the action.

Stack adjectives without grounding them: "We need a robust, scalable, maintainable solution." Robust *how*? Scalable to *what load*? Maintainable means *what* — low coupling, high cohesion? Every quality descriptor needs a concrete target or measurement.

Hedge the Definition of Done with "roughly" or "ideally" or "ideally we'll support." Done is done. "The system handles 10k req/s without exceeding 200ms latency" is testable. "It should be roughly responsive" is not.

Describe the solution before describing the problem. Readers lose context. Problem first. Then why this solution solves it, then the shape of the implementation.

## Interaction with the base voice

When your voice conventions conflict with genre norms — like a PRD that leans on narrative register instead of bullet points — your voice wins. This overlay is tuning, not override. It catches the common snares (passive voice, hedging, stacked adjectives without grounding) and reminds you to ground specificity. If you want a PRD that reads like prose narrative rather than a specification, write that PRD. The overlay doesn't forbid it.
