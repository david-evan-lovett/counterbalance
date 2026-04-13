import { readFile } from 'node:fs/promises';
import { resolve as resolvePath } from 'node:path';

const REVIEWER_ID = 'passive';

const BE_VERBS = /\b(am|is|are|was|were|be|been|being)\s+(\w+)\b/gi;

const PARTICIPLES = new Set([
    // (full list from spec — paste here)
    'abandoned','accepted','achieved','added','adjusted','affected','answered',
    'applied','approved','argued','arrived','asked','attached','avoided','based',
    'believed','broken','brought','built','called','carried','caught','caused',
    'changed','chosen','claimed','closed','collected','combined','completed',
    'considered','covered','created','decided','described','designed','determined',
    'developed','discovered','discussed','done','driven','earned','eaten','edited',
    'established','expected','experienced','explained','explored','expressed',
    'faced','felt','finished','followed','formed','found','given','handled',
    'happened','helped','hidden','identified','imagined','implemented','included',
    'increased','influenced','informed','introduced','involved','joined','kept',
    'known','learned','led','left','lived','looked','lost','loved','made','managed',
    'mentioned','missed','moved','named','noted','noticed','observed','offered',
    'opened','ordered','organized','owned','paid','passed','performed','picked',
    'placed','planned','played','preferred','prepared','presented','pressed',
    'produced','protected','provided','published','pulled','pushed','questioned',
    'raised','reached','read','received','reduced','referred','rejected','related',
    'released','remembered','removed','reported','represented','required','reserved',
    'resolved','returned','revealed','reviewed','said','saved','scheduled','seen',
    'sent','shared','shown','signed','solved','sorted','spent','started','stopped',
    'stored','suggested','supported','taken','taught','thrown','told','touched',
    'tracked','tried','turned','understood','updated','used','viewed','visited',
    'waited','wanted','warned','watched','welcomed','worked','written'
]);

// Technical participles that commonly appear in non-passive noun-phrase usage
// and produce false positives in tech prose. This list is intentionally short;
// grow it on evidence, not anticipation.
const EXCLUSIONS = new Set([
    'configured','deployed','installed','returned','used','created'
]);

export async function review({ draft, filePath, voiceProfile } = {}) {
    if (typeof draft !== 'string' || draft.trim().length === 0) {
        return { reviewer: REVIEWER_ID, findings: [] };
    }
    const lines = draft.split('\n');
    const findings = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        BE_VERBS.lastIndex = 0;
        let match;
        while ((match = BE_VERBS.exec(line)) !== null) {
            const participle = match[2].toLowerCase();
            if (!PARTICIPLES.has(participle)) continue;
            if (EXCLUSIONS.has(participle)) continue;
            findings.push({
                line: i + 1,
                severity: 'note',
                rule: 'passive-voice',
                quote: match[0],
                message: `passive construction: "${match[0]}"`,
                suggested: 'consider active voice'
            });
        }
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
