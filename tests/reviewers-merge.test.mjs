import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { aggregateFindings, expandPreset, partitionByType } from '../plugins/counterbalance/lib/reviewers.mjs';

// Helper for capturing console.warn calls
function captureWarns(fn) {
    const warnings = [];
    const originalWarn = console.warn;
    console.warn = (msg) => warnings.push(msg);
    try {
        return { result: fn(), warnings };
    } finally {
        console.warn = originalWarn;
    }
}

test('prose-review-suite.AC6.1: aggregateFindings empty input returns empty skeleton', () => {
    const result = aggregateFindings([]);
    assert.deepStrictEqual(result, {
        reviewers_run: [],
        findings: [],
        errors: [],
        counts_by_severity: { violation: 0, warning: 0, note: 0 }
    });
});

test('prose-review-suite.AC6.1: aggregateFindings merges findings from multiple outputs, flat', () => {
    const outputs = [
        {
            reviewer: 'reviewer-a',
            findings: [
                { line: 1, severity: 'warning', rule: 'rule1', quote: 'q1', message: 'm1' },
                { line: 2, severity: 'violation', rule: 'rule2', quote: 'q2', message: 'm2' }
            ]
        },
        {
            reviewer: 'reviewer-b',
            findings: [
                { line: 3, severity: 'note', rule: 'rule3', quote: 'q3', message: 'm3' },
                { line: 4, severity: 'warning', rule: 'rule4', quote: 'q4', message: 'm4' }
            ]
        }
    ];
    const result = aggregateFindings(outputs);
    assert.equal(result.findings.length, 4);
    assert.equal(result.reviewers_run.length, 2);
});

test('prose-review-suite.AC6.1: aggregateFindings sorts by line ascending, then by reviewer id', () => {
    const outputs = [
        {
            reviewer: 'beta',
            findings: [{ line: 10, severity: 'warning', rule: 'r', quote: 'q', message: 'm' }]
        },
        {
            reviewer: 'alpha',
            findings: [{ line: 5, severity: 'warning', rule: 'r', quote: 'q', message: 'm' }]
        }
    ];
    const result = aggregateFindings(outputs);
    assert.equal(result.findings[0].line, 5, 'first finding should have line 5');
    assert.equal(result.findings[1].line, 10, 'second finding should have line 10');
});

test('prose-review-suite.AC6.1: aggregateFindings ties on line sort by reviewer id ascending', () => {
    const outputs = [
        {
            reviewer: 'beta',
            findings: [{ line: 10, severity: 'warning', rule: 'r', quote: 'q', message: 'm' }]
        },
        {
            reviewer: 'alpha',
            findings: [{ line: 10, severity: 'warning', rule: 'r', quote: 'q', message: 'm' }]
        }
    ];
    const result = aggregateFindings(outputs);
    assert.equal(result.findings[0].reviewer, 'alpha', 'alpha should come first (alphabetically earlier)');
    assert.equal(result.findings[1].reviewer, 'beta', 'beta should come second');
});

test('prose-review-suite.AC6.1: aggregateFindings counts_by_severity tallies violation/warning/note', () => {
    const outputs = [
        {
            reviewer: 'r1',
            findings: [
                { line: 1, severity: 'violation', rule: 'r', quote: 'q', message: 'm' },
                { line: 2, severity: 'violation', rule: 'r', quote: 'q', message: 'm' },
                { line: 3, severity: 'warning', rule: 'r', quote: 'q', message: 'm' },
                { line: 4, severity: 'note', rule: 'r', quote: 'q', message: 'm' }
            ]
        }
    ];
    const result = aggregateFindings(outputs);
    assert.deepStrictEqual(result.counts_by_severity, {
        violation: 2,
        warning: 1,
        note: 1
    });
});

test('prose-review-suite.AC6.1: aggregateFindings unknown severity is preserved but not counted', () => {
    const outputs = [
        {
            reviewer: 'r1',
            findings: [
                { line: 1, severity: 'info', rule: 'r', quote: 'q', message: 'm' },
                { line: 2, severity: 'warning', rule: 'r', quote: 'q', message: 'm' }
            ]
        }
    ];
    const result = aggregateFindings(outputs);
    assert.equal(result.findings.length, 2, 'both findings should be present');
    assert.equal(result.findings[0].severity, 'info', 'info severity should be preserved');
    assert.deepStrictEqual(result.counts_by_severity, {
        violation: 0,
        warning: 1,
        note: 0
    });
    assert.ok(!('info' in result.counts_by_severity), 'info key should not be in counts_by_severity');
});

test('prose-review-suite.AC6.1: aggregateFindings attaches reviewer id to every finding', () => {
    const outputs = [
        {
            reviewer: 'foo',
            findings: [
                { line: 1, severity: 'warning', rule: 'r', quote: 'q', message: 'm' }
            ]
        }
    ];
    const result = aggregateFindings(outputs);
    assert.equal(result.findings[0].reviewer, 'foo');
});

test('prose-review-suite.AC6.1: aggregateFindings captures errors and still processes findings', () => {
    const outputs = [
        {
            reviewer: 'r1',
            error: 'Something went wrong',
            findings: [
                { line: 1, severity: 'warning', rule: 'r', quote: 'q', message: 'm' }
            ]
        }
    ];
    const result = aggregateFindings(outputs);
    assert.equal(result.errors.length, 1);
    assert.equal(result.errors[0].reviewer, 'r1');
    assert.equal(result.errors[0].error, 'Something went wrong');
    assert.equal(result.findings.length, 1, 'finding should still be present');
});

test('prose-review-suite.AC6.1: aggregateFindings findings with missing line sort to the end', () => {
    const outputs = [
        {
            reviewer: 'r1',
            findings: [
                { line: 10, severity: 'warning', rule: 'r', quote: 'q', message: 'm' },
                { line: undefined, severity: 'warning', rule: 'r', quote: 'q', message: 'm' },
                { line: 5, severity: 'warning', rule: 'r', quote: 'q', message: 'm' }
            ]
        }
    ];
    const result = aggregateFindings(outputs);
    assert.equal(result.findings[0].line, 5, 'line 5 should be first');
    assert.equal(result.findings[1].line, 10, 'line 10 should be second');
    assert.equal(result.findings[2].line, undefined, 'undefined line should be last');
});

test('prose-review-suite.AC6.1: expandPreset resolves named preset to reviewer entries in order', () => {
    const registry = {
        presets: {
            quick: ['b', 'a']
        },
        reviewers: [
            { id: 'a', type: 'agent' },
            { id: 'b', type: 'agent' }
        ]
    };
    const result = expandPreset(registry, 'quick');
    assert.equal(result.length, 2);
    assert.equal(result[0].id, 'b', 'b should be first (preset order)');
    assert.equal(result[1].id, 'a', 'a should be second (preset order)');
});

test('prose-review-suite.AC6.1: expandPreset wildcard * returns all reviewers in registry order', () => {
    const registry = {
        presets: {
            full: ['*']
        },
        reviewers: [
            { id: 'a', type: 'agent' },
            { id: 'b', type: 'agent' },
            { id: 'c', type: 'lib' }
        ]
    };
    const result = expandPreset(registry, 'full');
    assert.equal(result.length, 3);
    assert.equal(result[0].id, 'a');
    assert.equal(result[1].id, 'b');
    assert.equal(result[2].id, 'c');
});

test('prose-review-suite.AC6.1: expandPreset unknown preset id throws', () => {
    const registry = {
        presets: { known: ['a'] },
        reviewers: [{ id: 'a', type: 'agent' }]
    };
    assert.throws(
        () => expandPreset(registry, 'nonexistent'),
        (err) => err.message.includes('unknown preset id')
    );
});

test('prose-review-suite.AC6.1: expandPreset unknown reviewer id inside preset is skipped with warning', () => {
    const registry = {
        presets: {
            p: ['a', 'ghost']
        },
        reviewers: [
            { id: 'a', type: 'agent' }
        ]
    };
    const { result, warnings } = captureWarns(() => expandPreset(registry, 'p'));
    assert.equal(result.length, 1, 'only "a" should be returned');
    assert.equal(result[0].id, 'a');
    assert.equal(warnings.length, 1, 'should warn once');
    assert.ok(warnings[0].includes('ghost'), 'warning should mention the unknown id');
});

test('prose-review-suite.AC6.1: partitionByType splits reviewers into agents and libs', () => {
    const reviewers = [
        { id: 'a', type: 'agent' },
        { id: 'b', type: 'lib' },
        { id: 'c', type: 'agent' }
    ];
    const result = partitionByType(reviewers);
    assert.equal(result.agents.length, 2);
    assert.equal(result.libs.length, 1);
    assert.equal(result.agents[0].id, 'a');
    assert.equal(result.agents[1].id, 'c');
    assert.equal(result.libs[0].id, 'b');
});

test('prose-review-suite.AC6.1: partitionByType reviewers with unknown type are dropped with warning', () => {
    const reviewers = [
        { id: 'a', type: 'agent' },
        { id: 'weird', type: 'weird' }
    ];
    const { result, warnings } = captureWarns(() => partitionByType(reviewers));
    assert.equal(result.agents.length, 1, 'only a should be in agents');
    assert.equal(result.libs.length, 0);
    assert.equal(warnings.length, 1, 'should warn once');
    assert.ok(warnings[0].includes('weird'), 'warning should mention the unknown reviewer id');
});
