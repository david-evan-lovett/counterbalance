# Concrete vs Abstract Rubric

Concrete writing anchors claims in specific detail. Abstract writing generalizes without grounding. These sections flag the most common concrete violations: assertions of judgment without supporting evidence, and scenes described at the level of abstraction when specifics would land harder.

## Evaluations without evidence

Sentences that assert a judgment without supporting detail. The reader is expected to trust the claim without seeing the work:

- The tool is great.
- The feature is well-designed.
- This approach is powerful.
- The implementation is elegant.
- This pattern is effective.
- The solution is clever.
- The API is intuitive.
- The design is thoughtful.
- The code is maintainable.
- The system is robust.

Each of these claims needs evidence: a concrete example, a specific result, a side-by-side comparison. "The tool is great" → "The tool compiled every test in 40 milliseconds, versus the old system's 6 seconds." Assertion becomes fact.

## Abstract scenes that should be concrete

Descriptions that stay at the level of generalization when a specific example would land harder. The reader understands the point but doesn't *see* it:

- "The user interacts with the product" → "The user taps the scan button, waits 0.8 seconds, sees a green checkmark."
- "The system handles errors gracefully" → "When the API times out, the UI shows 'Connection lost' and queues the request for retry."
- "The developer experience improved" → "Setting up the dev environment dropped from 45 minutes to `npm install` and 30 seconds."
- "The code is simpler" → Show a before-and-after diff.
- "The architecture is modular" → Name the modules and what each one owns.
- "The team adopted the new process" → "By week three, the team had filed 47 tickets with the new rubric, and merge times dropped to under an hour."

In every case, swap the abstraction for a specific moment, measurement, or example. Let the reader see the thing, not just understand that it happened.
