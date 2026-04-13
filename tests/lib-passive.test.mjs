import { test } from 'node:test';
import assert from 'node:assert/strict';
import { review } from '../plugins/counterbalance/lib/passive.mjs';

test('prose-review-suite.AC3.5: empty draft returns empty findings', async () => {
    const result = await review({ draft: '' });
    assert.equal(result.findings.length, 0);
    assert.equal(result.reviewer, 'passive');
});

test('prose-review-suite.AC3.5: whitespace-only returns empty findings', async () => {
    const result = await review({ draft: '   \n\n  \t  ' });
    assert.equal(result.findings.length, 0);
});

test('prose-review-suite.AC3.4: true positive — "The cake was eaten by him." is flagged', async () => {
    const draft = 'The cake was eaten by him.';
    const result = await review({ draft });
    assert.equal(result.findings.length, 1);
    assert.equal(result.findings[0].rule, 'passive-voice');
    assert(result.findings[0].quote.toLowerCase().includes('was eaten'));
});

test('prose-review-suite.AC3.4: multiple passives on separate lines produce separate findings with correct line numbers', async () => {
    const draft = 'The bug was found.\nThe fix was written.';
    const result = await review({ draft });
    assert.equal(result.findings.length, 2);
    assert.equal(result.findings[0].line, 1);
    assert.equal(result.findings[1].line, 2);
});

test('prose-review-suite.AC3.4: excluded technical participle "configured" is NOT flagged', async () => {
    const draft = 'The value was configured.';
    const result = await review({ draft });
    assert.equal(result.findings.length, 0);
});

test('prose-review-suite.AC3.4: excluded technical participle "deployed" is NOT flagged', async () => {
    const draft = 'The service was deployed.';
    const result = await review({ draft });
    assert.equal(result.findings.length, 0);
});

test('prose-review-suite.AC3.4: "being seen" is flagged', async () => {
    const draft = 'He hated being seen.';
    const result = await review({ draft });
    assert.equal(result.findings.length, 1);
    assert.equal(result.findings[0].rule, 'passive-voice');
});

test('prose-review-suite.AC3.4: non-participle after to-be is NOT flagged', async () => {
    const draft = 'She is happy.';
    const result = await review({ draft });
    assert.equal(result.findings.length, 0);
});

test('prose-review-suite.AC3.4: case-insensitive matching', async () => {
    const draft = 'The cake WAS eaten.';
    const result = await review({ draft });
    assert.equal(result.findings.length, 1);
});

test('multiple findings on the same line', async () => {
    const draft = 'The cake was eaten and the cookies were taken.';
    const result = await review({ draft });
    assert.equal(result.findings.length, 2);
    assert.equal(result.findings[0].line, 1);
    assert.equal(result.findings[1].line, 1);
});
