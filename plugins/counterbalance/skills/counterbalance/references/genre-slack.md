---
kind: genre-overlay
applies_to:
  - Slack
  - email
  - async update
  - retro
---

# Genre overlay: Slack / Email / Async Update / Retro

Async communication in channels and retro docs trades the luxury of real-time clarification for the responsibility of being scannable. The first line earns the rest. Readers skim; the opener has to land on its own.

## Async-update cadence

Lead with the change or the ask. Not "Hey team, quick update on the database migration." Say "Database migration moved to next Wednesday due to vendor delay." The reader sees whether they need to keep reading before scrolling past. Context follows the announcement, not before.

Messages are scanned, not read. Stack the most important fact first, then supporting details. "Request for review on auth redesign — doc link in reply thread" is better than "We've been working on the auth redesign and would love your thoughts — check the doc in the thread below."

## Email conventions

Subject line is a sentence, not a label. "Deployment on Thursday 4pm" is better than "FYI — deployment coming up." The subject tells the reader the time, the event, the scope. They can decide whether to open the message based on the subject alone.

No "Hey team!" opener. Get to the point. Close with a concrete next step or ask, not "Let me know your thoughts." "By Friday, can you confirm whether your team can support the new schema?" is an ask with a deadline. That lands.

## Retro doc norms

"What happened" first — facts, dates, named people, observed outcomes. Not "I feel like the deploy went well." Say "The deploy at 3pm completed in 12 minutes. Three minor rollbacks on services A and B. No P1s."

"What worked / What didn't" as bullets grounded in the facts. "Communication was good — Slack posts went out 15 min after each rollback" is better than "I felt like we communicated well." Observation first, *then* the assessment.

"Action items" with owners and due dates. Not "We should improve X." Say "Improve X by adding monitoring at Y — owner Jane, due April 18." Owner and deadline make it real.

## Anti-patterns specific to async

"Quick update:" preamble — the update should speak for itself. Either say "Database migration moved to next Wednesday" or don't announce it.

"Circling back" emails. If something's been left unresolved and you're returning to it, say *why* you're returning: "Circling back on auth redesign — we need a decision before starting implementation." Not just the return, but the reason.

Retro action items without an owner. "We should improve X" is a wish, not a plan. Add a name.

Emoji-laden Slack threads where one clear message would suffice. Three emoji reactions and six tangents can be replaced by: "I don't think this blocks the release. Let me confirm with ops by EOD."

"LGTM" in a thread where a concrete yes/no was asked. If someone asks "Can you support this change?" and you reply with an emoji, you've made them guess whether you said yes. Say "Yes, we can support it" or "No, this conflicts with X."

## Interaction with the base voice

Your voice likes density and specificity. Async communication *demands* both — the reader doesn't have the option to ask you to clarify. This overlay mostly amplifies what you already do: lead with the action, ground observations in fact, skip the cushioning language. The friction is real (async removes real-time repair) but the solution is just saying what you mean.
