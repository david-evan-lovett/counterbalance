import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve as resolvePath } from 'node:path';

export const REVIEWER_MAP = {
    'readability':       'readability.mjs',
    'repetition-check':  'repetition.mjs',
    'spread-check':      'spread.mjs',
    'passive-check':     'passive.mjs'
};

export async function runMechReview({ reviewerIds = [], draft = '', filePath, voiceProfile = null } = {}) {
    const tasks = reviewerIds.map(async (id) => {
        const moduleFile = REVIEWER_MAP[id];
        if (!moduleFile) {
            return { reviewer: id, findings: [], error: 'unknown reviewer id' };
        }
        try {
            const mod = await import(new URL('../lib/' + moduleFile, import.meta.url));
            if (typeof mod.review !== 'function') {
                return { reviewer: id, findings: [], error: 'module does not export review()' };
            }
            const result = await mod.review({ draft, filePath, voiceProfile });
            if (!result || typeof result !== 'object' || !('reviewer' in result) || !('findings' in result)) {
                return { reviewer: id, findings: [], error: 'invalid reviewer output shape' };
            }
            return result;
        } catch (err) {
            return { reviewer: id, findings: [], error: err?.message ?? String(err) };
        }
    });

    const settled = await Promise.allSettled(tasks);
    const outputs = settled.map((s, i) => {
        if (s.status === 'fulfilled') return s.value;
        return { reviewer: reviewerIds[i], findings: [], error: s.reason?.message ?? String(s.reason) };
    });
    return { outputs };
}

// CLI entry
if (fileURLToPath(import.meta.url) === resolvePath(process.argv[1] ?? '')) {
    const args = process.argv.slice(2);
    const getFlag = (name) => {
        const pair = args.find(a => a.startsWith(`--${name}=`));
        return pair ? pair.slice(name.length + 3) : undefined;
    };
    try {
        const reviewersCsv = getFlag('reviewers');
        if (!reviewersCsv) {
            process.stderr.write('[counterbalance:mech-review] missing --reviewers=<csv>\n');
            process.exit(1);
        }
        const reviewerIds = reviewersCsv.split(',').map(s => s.trim()).filter(Boolean);

        const filePath = getFlag('file');
        let draft = '';
        if (filePath) {
            try {
                draft = await readFile(filePath, 'utf8');
            } catch (err) {
                process.stderr.write(`[counterbalance:mech-review] cannot read --file: ${err.message}\n`);
                process.exit(1);
            }
        } else {
            const draftArg = getFlag('draft');
            if (draftArg !== undefined) draft = draftArg;
        }

        const voiceProfileFile = getFlag('voice-profile-file');
        let voiceProfile = null;
        if (voiceProfileFile) {
            try {
                voiceProfile = JSON.parse(await readFile(voiceProfileFile, 'utf8'));
            } catch (err) {
                process.stderr.write(`[counterbalance:mech-review] unparseable --voice-profile-file: ${err.message}\n`);
                process.exit(1);
            }
        }

        const result = await runMechReview({ reviewerIds, draft, filePath, voiceProfile });
        process.stdout.write(JSON.stringify(result) + '\n');
        process.exit(0);
    } catch (err) {
        process.stderr.write(`[counterbalance:mech-review] ${err?.stack ?? err?.message ?? err}\n`);
        process.exit(1);
    }
}
