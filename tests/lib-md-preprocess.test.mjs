import { test } from 'node:test';
import assert from 'node:assert';
import { stripMarkdown } from '../plugins/counterbalance/lib/md-preprocess.mjs';

// Test fixture cases for stripMarkdown function
const fixtures = [
    {
        name: 'empty string',
        input: '',
        expected: ''
    },
    {
        name: 'plain prose',
        input: 'This is a simple sentence.',
        expected: 'This is a simple sentence.'
    },
    {
        name: 'YAML frontmatter stripped',
        input: '---\ntitle: Foo\n---\nHello.',
        expected: 'Hello.'
    },
    {
        name: 'fenced code block removed',
        input: 'Before code.\n\n```js\nconst x = 1;\n```\n\nAfter code.',
        expected: 'Before code.\n\n\nAfter code.'
    },
    {
        name: 'inline code unwrapped',
        input: 'Run `npm install` first.',
        expected: 'Run npm install first.'
    },
    {
        name: 'HTML tags removed',
        input: '<strong>Hello</strong> world.',
        expected: 'Hello world.'
    },
    {
        name: 'heading hashes stripped',
        input: '# Title\n## Sub\nText.',
        expected: 'Title\nSub\nText.'
    },
    {
        name: 'list markers stripped',
        input: '- one\n- two',
        expected: 'one\ntwo'
    },
    {
        name: 'numbered list markers stripped',
        input: '1. one\n2. two',
        expected: 'one\ntwo'
    },
    {
        name: 'block quote prefix stripped',
        input: '> Quoted text.',
        expected: 'Quoted text.'
    },
    {
        name: 'link syntax unwrapped',
        input: 'See [the docs](https://example.com).',
        expected: 'See the docs.'
    },
    {
        name: 'image syntax removed',
        input: '![alt](url)',
        expected: ''
    },
    {
        name: 'reference-style link definition dropped',
        input: '[foo]: https://example.com',
        expected: ''
    },
    {
        name: 'strong emphasis stripped',
        input: '**bold**',
        expected: 'bold'
    },
    {
        name: 'italic emphasis stripped',
        input: '*italic*',
        expected: 'italic'
    },
    {
        name: 'underscore strong stripped',
        input: '__bold__',
        expected: 'bold'
    },
    {
        name: 'underscore italic stripped',
        input: '_italic_',
        expected: 'italic'
    },
    {
        name: 'horizontal rule dropped',
        input: '---\n',
        expected: ''
    },
    {
        name: 'paragraph breaks preserved',
        input: 'First paragraph.\n\nSecond paragraph.',
        expected: 'First paragraph.\n\nSecond paragraph.'
    },
    {
        name: 'combined: mixed markdown paragraph',
        input: '# Title\n\nSome **bold** text with a `code` span and [a link](url).\n\n## Section\n\nMore text.',
        expected: 'Title\n\nSome bold text with a code span and a link.\n\nSection\n\nMore text.'
    }
];

// Run each fixture as its own test
for (const fixture of fixtures) {
    test(fixture.name, () => {
        const result = stripMarkdown(fixture.input);
        assert.strictEqual(result, fixture.expected, `stripMarkdown("${fixture.input.slice(0, 30).replace(/\n/g, '\\n')}...") should return "${fixture.expected.slice(0, 30).replace(/\n/g, '\\n')}..."`);
    });
}
