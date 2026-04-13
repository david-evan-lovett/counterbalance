import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve as resolvePath } from 'node:path';
import sbd from 'sbd';
import { syllable } from 'syllable';
import { fleschKincaid } from 'flesch-kincaid';
import { stripMarkdown } from './md-preprocess.mjs';

const REVIEWER_ID = 'readability';
const BAND = { min: 9, max: 13 };

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
    const words = stripped
        .split(/\s+/)
        .filter(tok => tok.length > 0 && /[a-zA-Z]/.test(tok));
    const syllables = words.reduce((n, w) => n + syllable(w), 0);

    if (sentences.length === 0 || words.length === 0 || syllables === 0) {
        return { reviewer: REVIEWER_ID, findings: [] };
    }

    const grade = fleschKincaid({
        sentence: sentences.length,
        word: words.length,
        syllable: syllables
    });

    if (!Number.isFinite(grade)) {
        return { reviewer: REVIEWER_ID, findings: [] };
    }

    if (grade >= BAND.min && grade <= BAND.max) {
        return { reviewer: REVIEWER_ID, findings: [] };
    }

    return {
        reviewer: REVIEWER_ID,
        findings: [
            {
                line: 1,
                severity: 'note',
                rule: 'readability-out-of-band',
                quote: '',
                message: `Flesch-Kincaid grade ${grade.toFixed(1)} falls outside the ${BAND.min}–${BAND.max} target band.`,
                suggested: grade < BAND.min
                    ? 'add complexity (longer sentences, more technical terms)'
                    : 'simplify (shorter sentences, plainer words)'
            }
        ]
    };
}

// CLI entry
if (import.meta.url === `file://${resolvePath(process.argv[1] ?? '')}`) {
    const args = process.argv.slice(2);
    const getFlag = (name) => {
        const pair = args.find(a => a.startsWith(`--${name}=`));
        return pair ? pair.slice(name.length + 3) : undefined;
    };
    try {
        let draft;
        const filePath = getFlag('file');
        const draftArg = getFlag('draft');
        if (filePath) {
            draft = await readFile(filePath, 'utf8');
        } else if (draftArg !== undefined) {
            draft = draftArg;
        } else {
            draft = '';
        }
        const voiceProfileFile = getFlag('voice-profile-file');
        let voiceProfile = null;
        if (voiceProfileFile) {
            try {
                voiceProfile = JSON.parse(await readFile(voiceProfileFile, 'utf8'));
            } catch {
                voiceProfile = null;
            }
        }
        const result = await review({ draft, filePath, voiceProfile });
        process.stdout.write(JSON.stringify(result) + '\n');
        process.exit(0);
    } catch (err) {
        process.stderr.write(`[counterbalance:readability] ${err.message}\n`);
        process.exit(1);
    }
}
