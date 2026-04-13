import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { review } from '../plugins/counterbalance/lib/repetition.mjs';

test('prose-review-suite.AC3.5: empty draft returns empty findings', async () => {
    const result = await review({ draft: '' });
    assert.equal(result.reviewer, 'repetition');
    assert.equal(result.findings.length, 0);
});

test('prose-review-suite.AC3.5: whitespace-only draft returns empty findings', async () => {
    const result = await review({ draft: '   \n  \t  ' });
    assert.equal(result.reviewer, 'repetition');
    assert.equal(result.findings.length, 0);
});

test('prose-review-suite.AC3.2: non-stopword appearing 4+ times in 5-sentence window is flagged', async () => {
    const draft = 'The database is reliable. The database is fast. The database is scalable. The database is proven. The database is trusted.';
    const result = await review({ draft });
    assert.equal(result.findings.length, 1);
    assert.equal(result.findings[0].rule, 'repetition-within-window');
    assert.equal(result.findings[0].quote, 'database');
    assert(result.findings[0].message.includes('database'));
    assert(result.findings[0].message.includes('5'));
});

test('prose-review-suite.AC3.2: stopwords are NOT flagged', async () => {
    const draft = 'The the the the the the the the the the the the the the the the the the the the.';
    const result = await review({ draft });
    assert.equal(result.findings.length, 0);
});

test('prose-review-suite.AC3.2: non-stopword appearing exactly 3 times is NOT flagged', async () => {
    const draft = 'The database is good. The database is fast. The database is reliable. Something else here. Another sentence.';
    const result = await review({ draft });
    assert.equal(result.findings.length, 0);
});

test('prose-review-suite.AC3.2: sliding window catches overuse in a middle window', async () => {
    const draft = `
        First sentence. Second sentence. Third sentence. Fourth sentence. Fifth sentence.
        Sixth sentence. Alpha appears here. Alpha appears again. Alpha appears more. Alpha appears once more.
        Eleventh sentence. Twelfth sentence. Thirteenth sentence. Fourteenth sentence. Fifteenth sentence.
    `.trim();
    const result = await review({ draft });
    const alphaFindings = result.findings.filter(f => f.quote === 'alpha');
    assert.equal(alphaFindings.length, 1);
});

test('prose-review-suite.AC3.2: the same word overused in two non-overlapping windows is flagged twice', async () => {
    const sentences = [];
    // First window (sentences 0-4): "alpha" appears 4 times
    for (let i = 0; i < 5; i++) {
        if (i < 4) {
            sentences.push('Alpha appears here.');
        } else {
            sentences.push('Other words now.');
        }
    }
    // Gap (sentences 5-9): no "alpha"
    for (let i = 0; i < 5; i++) {
        sentences.push('Filler sentence without that word.');
    }
    // Second window (sentences 10-14): "alpha" appears 4 times
    for (let i = 0; i < 5; i++) {
        if (i < 4) {
            sentences.push('Alpha appears again.');
        } else {
            sentences.push('Final other words.');
        }
    }
    const draft = sentences.join(' ');
    const result = await review({ draft });
    const alphaFindings = result.findings.filter(f => f.quote === 'alpha');
    assert.equal(alphaFindings.length, 2);
});

test('prose-review-suite.AC3.2: short draft (<5 sentences) still checks as a single window', async () => {
    const draft = 'Chocolate is delicious. Chocolate is smooth. Chocolate is rich. Chocolate is wonderful.';
    const result = await review({ draft });
    assert.equal(result.findings.length, 1);
    assert.equal(result.findings[0].quote, 'chocolate');
});

test('markdown syntax does not create false positives', async () => {
    const draft = '**alpha** is here. **alpha** is there. **alpha** is everywhere. **alpha** is on the wall. **alpha** is all around.';
    const result = await review({ draft });
    assert.equal(result.findings.length, 1);
    assert.equal(result.findings[0].quote, 'alpha');
});

test('finding carries line number pointing at the window\'s first sentence', async () => {
    const draft = 'First line.\nSecond line.\nThird line.\nDatabase works well. Database works well. Database works well. Database works well. Database is great.';
    const result = await review({ draft });
    assert(result.findings.length > 0);
    assert(result.findings[0].line >= 1);
    assert(typeof result.findings[0].line === 'number');
});

test('prose-review-suite.AC3.2: sparse clusters (word concentrated in separated single sentences) produce two findings', async () => {
    const draft = 'Alpha alpha alpha alpha here. Boring one. Boring two. Boring three. Boring four. Boring five. Boring six. Boring seven. Boring eight. Boring nine. Alpha alpha alpha alpha here. Extra one. Extra two. Extra three. Extra four.';
    const result = await review({ draft });
    const alphaFindings = result.findings.filter(f => f.quote === 'alpha');
    assert.strictEqual(alphaFindings.length, 2, 'expected two separate alpha clusters to be flagged');
});

test('CLI entry: repetition prints JSON and exits 0', () => {
    const draft = 'Hello world.';
    const res = spawnSync('node', ['plugins/counterbalance/lib/repetition.mjs', `--draft=${draft}`], { encoding: 'utf8' });
    assert.strictEqual(res.status, 0, `stderr: ${res.stderr}`);
    const parsed = JSON.parse(res.stdout);
    assert.strictEqual(parsed.reviewer, 'repetition');
    assert.ok(Array.isArray(parsed.findings));
});
