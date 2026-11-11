/**
 * Inline formatting of the shared Markdown dialect: `code`, [label](https://…), **strong**, ~strike~ and *em*.
 * Markers do not nest; a line break ends every marker.
 *
 * @typedef {{ type: "text" | "code" | "strong" | "strike" | "em", text: string } | { type: "link", text: string, href: string }} MDLInlineToken
 */

const tokenPattern = /(`([^`\n]+)`|\[([^\]\n]+)]\((https?:\/\/[^\s)]+)\)|\*\*([^*\n]+)\*\*|~([^~\n]+)~|\*([^*\n]+)\*)/g;

/**
 * @param {string} text
 * @returns {MDLInlineToken[]}
 */
export function parse(text) {
  /** @type {MDLInlineToken[]} */
  const tokens = [];
  let offset = 0;
  for (const match of text.matchAll(tokenPattern)) {
    const index = match.index || 0;
    if (index > offset) tokens.push({ type: "text", text: text.slice(offset, index) });
    if (match[2] !== undefined) tokens.push({ type: "code", text: match[2] });
    else if (match[3] !== undefined) tokens.push({ type: "link", text: match[3], href: match[4] });
    else if (match[5] !== undefined) tokens.push({ type: "strong", text: match[5] });
    else if (match[6] !== undefined) tokens.push({ type: "strike", text: match[6] });
    else tokens.push({ type: "em", text: match[7] });
    offset = index + match[0].length;
  }
  if (offset < text.length) tokens.push({ type: "text", text: text.slice(offset) });
  return tokens;
}

// The backtick is escaped so that tools scanning the source do not read a template literal.
const anyMarker = /[`*_~[]/;

/**
 * Text without inline markers, trimmed, for searching and plain display. Also strips the common Markdown
 * variants `__strong__`, `_em_`, `~~strike~~` and images. Text without any marker character is only trimmed.
 * @param {string} text
 */
export function plainText(text) {
  if (!anyMarker.test(text)) return text.trim();
  return text
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/(^|\s)_([^_]+)_(?=\s|$)/g, "$1$2")
    .replace(/~~([^~]+)~~/g, "$1")
    .replace(/~([^~]+)~/g, "$1")
    .trim();
}
