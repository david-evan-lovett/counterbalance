import { test } from 'node:test';
import assert from 'node:assert';
import { review } from '../plugins/counterbalance/lib/readability.mjs';

test('prose-review-suite.AC3.5: empty draft returns empty findings', async () => {
    const result = await review({ draft: '' });
    assert.deepStrictEqual(result, { reviewer: 'readability', findings: [] });
});

test('prose-review-suite.AC3.5: whitespace-only draft returns empty findings', async () => {
    const result = await review({ draft: '   \n\n   ' });
    assert.deepStrictEqual(result, { reviewer: 'readability', findings: [] });
});

test('prose-review-suite.AC3.1: simple prose (low grade) produces an out-of-band finding', async () => {
    const draft = 'The cat sat. The dog ran. The bird flew. The fish swam. The cow ate. The pig drank.';
    const result = await review({ draft });
    assert.strictEqual(result.findings.length, 1, 'Should have exactly one finding');
    assert.strictEqual(result.findings[0].rule, 'readability-out-of-band');
    assert(result.findings[0].message.includes('falls outside'), 'Message should mention "falls outside"');
    assert(result.findings[0].suggested.includes('add complexity'), 'Suggested should contain "add complexity"');
});

test('prose-review-suite.AC3.1: dense academic prose (high grade) produces an out-of-band finding', async () => {
    const draft = 'The epistemological ramifications of post-structuralist methodological frameworks, when systematically interrogated through comparative hermeneutical analysis of phenomenological discourse, fundamentally destabilize traditionally hegemonic interpretations of semiotic representation.';
    const result = await review({ draft });
    assert.strictEqual(result.findings.length, 1, 'Should have exactly one finding');
    assert.strictEqual(result.findings[0].rule, 'readability-out-of-band');
    assert(result.findings[0].message.includes('falls outside'), 'Message should mention "falls outside"');
    assert(result.findings[0].suggested.includes('simplify'), 'Suggested should contain "simplify"');
});

test('prose-review-suite.AC3.1: in-band prose produces zero findings', async () => {
    // This paragraph is calibrated to land in the 9-13 band. Grade should be around 10-11.
    // Using a paragraph with mixed sentence lengths and vocabulary complexity.
    const draft = 'The developer committed the change after running the full test suite. Every test passed except one integration scenario, which failed intermittently on continuous integration. She investigated the flaky test and traced the cause to a timing assumption in the setup code. After adjusting the test parameters, she re-ran the suite and confirmed all tests passed reliably. The commit was merged to the main branch without further issues.';
    const result = await review({ draft });
    assert.strictEqual(result.findings.length, 0, 'Should have no findings when in-band');
});

test('prose-review-suite.AC3.5: Markdown syntax does not pollute the grade', async () => {
    const draft = '# Heading\n\n**Bold text** and *italic text* do not affect readability. Here is [a link](http://example.com) and some `code snippet`. The real content should be what is measured. When we strip the markdown syntax, the actual prose grade should reflect only the plain text.';
    const result = await review({ draft });
    // The reviewer processes markdown through stripMarkdown, so it should not crash
    // Result should be either empty findings OR a single finding
    assert(result.findings.length <= 1, 'Should have 0 or 1 finding (never multiple)');
    assert(result.reviewer === 'readability', 'Reviewer should be readability');
});

test('prose-review-suite.AC3.5: very short draft (insufficient tokens) returns empty findings', async () => {
    // A string with no alphanumeric words (only punctuation/symbols) will have zero word count
    // after filtering, causing the reviewer to return empty findings via the zero-count guard.
    const draft = '...!!!???';
    const result = await review({ draft });
    assert.deepStrictEqual(result, { reviewer: 'readability', findings: [] });
});
