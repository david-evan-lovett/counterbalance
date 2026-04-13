import { test } from 'node:test';
import assert from 'node:assert';
import { review } from '../plugins/counterbalance/lib/spread.mjs';

test('prose-review-suite.AC3.5: empty draft returns empty findings', async () => {
    const result = await review({ draft: '' });
    assert.deepStrictEqual(result, { reviewer: 'spread', findings: [] });
});

test('prose-review-suite.AC3.5: draft with <4 sentences returns empty findings', async () => {
    const draft = 'Hi. Yes. No.';
    const result = await review({ draft });
    assert.deepStrictEqual(result, { reviewer: 'spread', findings: [] });
});

test('prose-review-suite.AC3.3: 4 consecutive short sentences flagged', async () => {
    const draft = 'He ran. She walked. It worked. That passed.';
    const result = await review({ draft });
    assert.strictEqual(result.findings.length, 1, 'Should have exactly one finding');
    assert.strictEqual(result.findings[0].rule, 'spread-monotone-cadence');
    assert(result.findings[0].message.includes('4 consecutive short'), 'Message should mention 4 consecutive short');
});

test('prose-review-suite.AC3.3: 4 consecutive long sentences flagged', async () => {
    const draft = 'The development team decided that the implementation would definitely be completed by the end of the quarter without fail. The architects studied the requirements quite thoroughly and created a comprehensive detailed technical specification for the entire system design. The engineers began writing code immediately after approval and committed changes to the repository every single day without missing anything. The reviewers examined each pull request meticulously and provided detailed feedback on the quality and design of the implementation.';
    const result = await review({ draft });
    assert.strictEqual(result.findings.length, 1, 'Should have exactly one finding');
    assert.strictEqual(result.findings[0].rule, 'spread-monotone-cadence');
    assert(result.findings[0].message.includes('4 consecutive long'), 'Message should mention 4 consecutive long');
});

test('prose-review-suite.AC3.3: 4 consecutive medium sentences flagged', async () => {
    const draft = 'The implementation strategy is solid and well thought out. We reviewed all the requirements and discussed them carefully. The testing process was thorough and complete and rigorous. Everyone on the team ultimately approved the plan and agreed.';
    const result = await review({ draft });
    assert.strictEqual(result.findings.length, 1, 'Should have exactly one finding');
    assert.strictEqual(result.findings[0].rule, 'spread-monotone-cadence');
    assert(result.findings[0].message.includes('4 consecutive medium'), 'Message should mention 4 consecutive medium');
});

test('prose-review-suite.AC3.3: 3 short + 1 medium NOT flagged', async () => {
    const draft = 'He ran. She walked. It worked. And that is perfectly fine and acceptable right now.';
    const result = await review({ draft });
    assert.strictEqual(result.findings.length, 0, 'Should have no findings');
});

test('prose-review-suite.AC3.3: 5-sentence run flagged with length 5 in message', async () => {
    const draft = 'First one. Second one. Third one. Fourth one. Fifth one. This is a long sentence here with many more words.';
    const result = await review({ draft });
    assert.strictEqual(result.findings.length, 1, 'Should have exactly one finding');
    assert(result.findings[0].message.includes('5 consecutive'), 'Message should contain 5 consecutive');
});

test('prose-review-suite.AC3.3: two separate runs produce two findings', async () => {
    const draft = 'He went. She came. It worked. That passed. This is a much longer sentence with many more words in it. Run here. Moved fast. Stayed still. Left now.';
    const result = await review({ draft });
    assert.strictEqual(result.findings.length, 2, 'Should have exactly two findings');
    assert.strictEqual(result.findings[0].rule, 'spread-monotone-cadence');
    assert.strictEqual(result.findings[1].rule, 'spread-monotone-cadence');
});

test('prose-review-suite.AC3.3: sbd handles abbreviations correctly', async () => {
    // This should be parsed as 2 sentences, not 3, because sbd understands abbreviations
    const draft = 'Dr. Smith saw him. U.S. policy changed. Another sentence here.';
    const result = await review({ draft });
    // With 3 sentences, no run of 4, so no findings expected
    assert.strictEqual(result.findings.length, 0, 'Should have no findings (sbd parsed 3 sentences correctly)');
});
