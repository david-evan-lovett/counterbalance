/**
 * English stopword set used by the repetition reviewer to filter common words
 * before flagging overuse. ~150 words — covers the standard NLTK-style short
 * list plus common contractions. Lowercase canonical form; callers must
 * lowercase before lookup (or use `isStopword` helper).
 */
export const STOPWORDS = new Set([
    'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and',
    'any', 'are', 'aren', 'as', 'at', 'be', 'because', 'been', 'before', 'being',
    'below', 'between', 'both', 'but', 'by', 'can', 'cannot', 'could', 'couldn',
    'did', 'didn', 'do', 'does', 'doesn', 'doing', 'don', 'down', 'during', 'each',
    'few', 'for', 'from', 'further', 'had', 'hadn', 'has', 'hasn', 'have', 'haven',
    'having', 'he', 'her', 'here', 'hers', 'herself', 'him', 'himself', 'his',
    'how', 'i', 'if', 'in', 'into', 'is', 'isn', 'it', 'its', 'itself', 'just',
    'me', 'mightn', 'more', 'most', 'mustn', 'my', 'myself', 'no', 'nor', 'not',
    'now', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'our', 'ours',
    'ourselves', 'out', 'over', 'own', 're', 'same', 'shan', 'she', 'should',
    'shouldn', 'so', 'some', 'such', 't', 'than', 'that', 'the', 'their', 'theirs',
    'them', 'themselves', 'then', 'there', 'these', 'they', 'this', 'those',
    'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'wasn', 'we',
    'were', 'weren', 'what', 'when', 'where', 'which', 'while', 'who', 'whom',
    'why', 'will', 'with', 'won', 'would', 'wouldn', 'you', 'your', 'yours',
    'yourself', 'yourselves'
]);

export function isStopword(word) {
    if (typeof word !== 'string') return false;
    return STOPWORDS.has(word.toLowerCase());
}
