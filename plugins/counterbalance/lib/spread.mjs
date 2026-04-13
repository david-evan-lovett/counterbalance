import { readFile } from 'node:fs/promises';
import { resolve as resolvePath } from 'node:path';
import sbd from 'sbd';
import { stripMarkdown } from './md-preprocess.mjs';

const REVIEWER_ID = 'spread';
const RUN_THRESHOLD = 4;

function bucketOf(wordCount) {
    if (wordCount <= 8) return 'short';
    if (wordCount <= 18) return 'medium';
    return 'long';
}

function findLineOfSnippet(originalDraft, snippet) {
    if (!snippet) return 1;
    const needle = snippet.slice(0, Math.min(snippet.length, 40)).toLowerCase();
    const idx = originalDraft.toLowerCase().indexOf(needle);
    if (idx < 0) return 1;
    return (originalDraft.slice(0, idx).match(/\n/g) ?? []).length + 1;
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
    if (sentences.length < RUN_THRESHOLD) {
        return { reviewer: REVIEWER_ID, findings: [] };
    }
    const buckets = sentences.map(s => {
        const words = s.split(/\s+/).filter(w => w.length > 0 && /[a-zA-Z]/.test(w));
        return bucketOf(words.length);
    });
    const findings = [];
    let i = 0;
    while (i < buckets.length) {
        let j = i + 1;
        while (j < buckets.length && buckets[j] === buckets[i]) j++;
        const runLength = j - i;
        if (runLength >= RUN_THRESHOLD) {
            const firstSentence = sentences[i];
            findings.push({
                line: findLineOfSnippet(draft, firstSentence),
                severity: 'note',
                rule: 'spread-monotone-cadence',
                quote: firstSentence.slice(0, 40) + (firstSentence.length > 40 ? '...' : ''),
                message: `${runLength} consecutive ${buckets[i]} sentences (starting at sentence ${i + 1})`,
                suggested: 'vary sentence length — mix short and long'
            });
        }
        i = j;
    }
    return { reviewer: REVIEWER_ID, findings };
}

// CLI entry — same pattern as readability.mjs
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
