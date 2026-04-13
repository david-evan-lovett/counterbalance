/**
 * Strip Markdown syntax from a string, preserving sentence and paragraph structure
 * as plain text. Used by mechanical reviewers (readability, repetition, spread,
 * passive) that compute prose metrics and would produce garbage scores on raw
 * Markdown.
 *
 * This is a pragmatic, regex-driven preprocessor — not a full CommonMark parser.
 * It handles the constructs that appear in typical prose drafts: frontmatter,
 * fenced code, inline code, headings, lists, block quotes, links, images,
 * emphasis, and horizontal rules. Table syntax, footnotes, and HTML comments are
 * intentionally not handled (out of scope; documents that use them should pass
 * anyway because the mechanical reviewers are statistical in nature).
 */
export function stripMarkdown(text) {
    if (typeof text !== 'string' || text.length === 0) return '';

    let out = text;

    // 1. YAML frontmatter (must be first)
    out = out.replace(/^---\n[\s\S]*?\n---\n/, '');

    // 2. Fenced code blocks (must come before anything that touches backticks)
    out = out.replace(/^```[^\n]*\n[\s\S]*?\n```\s*$/gm, '');

    // 3. Images (must come before links so we don't capture the ! as text)
    out = out.replace(/!\[[^\]]*\]\([^)]+\)/g, '');

    // 4. Links
    out = out.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

    // 5. Inline code
    out = out.replace(/`([^`]+)`/g, '$1');

    // 6. HTML tags
    out = out.replace(/<[^>]+>/g, '');

    // 7. Line-level transforms
    const lines = out.split('\n');
    const transformed = [];
    for (const rawLine of lines) {
        // Reference link definitions — drop entire line
        if (/^\[[^\]]+\]:\s*\S+/.test(rawLine)) continue;
        // Horizontal rules — drop entire line
        if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(rawLine)) continue;
        let line = rawLine;
        // Heading hashes
        line = line.replace(/^(#{1,6})\s+/, '');
        // Block quotes
        line = line.replace(/^(\s*)>\s?/, '$1');
        // List markers
        line = line.replace(/^(\s*)([-*+]|\d+\.)\s+/, '$1');
        transformed.push(line);
    }
    out = transformed.join('\n');

    // 8. Strong (double) emphasis first, then single
    out = out.replace(/(\*\*|__)(.+?)\1/g, '$2');
    out = out.replace(/([*_])(.+?)\1/g, '$2');

    return out;
}
