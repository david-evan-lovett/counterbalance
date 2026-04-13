import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve as resolvePath } from 'node:path';
import sbd from 'sbd';
import { stripMarkdown } from './md-preprocess.mjs';
import { STOPWORDS } from './stopwords.mjs';

const REVIEWER_ID = 'repetition';
const WINDOW_SIZE = 5;
const THRESHOLD = 3;

function normalizeWord(token) {
    return token.toLowerCase().replace(/^[^a-z]+|[^a-z]+$/g, '');
}

function findLineOfSnippet(originalDraft, snippet) {
    if (!snippet) return 1;
    const needle = snippet.slice(0, Math.min(snippet.length, 40)).toLowerCase();
    const hay = originalDraft.toLowerCase();
    const idx = hay.indexOf(needle);
    if (idx < 0) return 1;
    const prefix = originalDraft.slice(0, idx);
    return (prefix.match(/\n/g) ?? []).length + 1;
}

export async function review({ draft, filePath, voiceProfile } = {}) {
    if (typeof draft !== 'string' || draft.trim().length === 0) {
        return { reviewer: REVIEWER_ID, findings: [] };
    }
    const stripped = stripMarkdown(draft);
    if (stripped.trim().length === 0) {
        return { reviewer: REVIEWER_ID, findings: [] };
    }

    const sentences = sbd.sentences(stripped, {
        newline_boundaries: false,
        sanitize: false
    });
    if (sentences.length === 0) return { reviewer: REVIEWER_ID, findings: [] };

    const sentenceWords = sentences.map(s =>
        s.split(/\s+/)
            .map(normalizeWord)
            .filter(w => w.length > 0 && !STOPWORDS.has(w))
    );

    const findings = [];
    const wasOverThreshold = new Map(); // word -> was count > THRESHOLD in previous window?

    const windowCount = sentenceWords.length < WINDOW_SIZE
        ? 1
        : sentenceWords.length - WINDOW_SIZE + 1;

    for (let i = 0; i < windowCount; i++) {
        const end = Math.min(i + WINDOW_SIZE, sentenceWords.length);
        const counts = new Map();
        for (let j = i; j < end; j++) {
            for (const word of sentenceWords[j]) {
                counts.set(word, (counts.get(word) ?? 0) + 1);
            }
        }
        for (const [word, count] of counts) {
            if (count > THRESHOLD) {
                const wasOver = wasOverThreshold.get(word) ?? false;
                if (!wasOver) {
                    findings.push({
                        line: findLineOfSnippet(draft, sentences[i]),
                        severity: 'note',
                        rule: 'repetition-within-window',
                        quote: word,
                        message: `"${word}" appears ${count} times in sentences ${i + 1}–${end}`,
                        suggested: 'vary the word choice or restructure'
                    });
                }
                wasOverThreshold.set(word, true);
            } else {
                wasOverThreshold.set(word, false);
            }
        }
    }

    return { reviewer: REVIEWER_ID, findings };
}

// CLI entry (same pattern as readability.mjs — copy verbatim)
if (import.meta.url === `file://${resolvePath(process.argv[1] ?? '')}`) {
    const args = process.argv.slice(2);
    const getFlag = (name) => {
        const pair = args.find(a => a.startsWith(`--${name}=`));
        return pair ? pair.slice(name.length + 3) : undefined;
    };
    try {
        let draft = '';
        const filePath = getFlag('file');
        const draftArg = getFlag('draft');
        if (filePath) draft = await readFile(filePath, 'utf8');
        else if (draftArg !== undefined) draft = draftArg;
        const voiceProfileFile = getFlag('voice-profile-file');
        let voiceProfile = null;
        if (voiceProfileFile) {
            try { voiceProfile = JSON.parse(await readFile(voiceProfileFile, 'utf8')); }
            catch { voiceProfile = null; }
        }
        const result = await review({ draft, filePath, voiceProfile });
        process.stdout.write(JSON.stringify(result) + '\n');
        process.exit(0);
    } catch (err) {
        process.stderr.write(`[counterbalance:${REVIEWER_ID}] ${err.message}\n`);
        process.exit(1);
    }
}
