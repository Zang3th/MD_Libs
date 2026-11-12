/**
 * Helpers for the shared Markdown dialect: text files as lines, `#Key` blocks, trailing tags and inline
 * formatting. Parsers and serializers stay in the applications; these helpers never drop a line.
 */

/** @typedef {{ lines: string[], newline: "\n" | "\r\n", bom: boolean, finalNewline: boolean }} MDLTextDocument */

const byteOrderMark = "﻿";

/**
 * Splits a text file into lines. The byte order mark, the line ending (CRLF when any line uses it) and a
 * final newline are recorded, so that `join` writes the same conventions back.
 * @param {string} source
 * @returns {MDLTextDocument}
 */
export function split(source) {
  const bom = source.startsWith(byteOrderMark);
  const text = bom ? source.slice(1) : source;
  const lines = text.split(/\r?\n/);
  const finalNewline = lines.length > 1 && lines.at(-1) === "";
  if (finalNewline) lines.pop();
  return { lines, newline: text.includes("\r\n") ? "\r\n" : "\n", bom, finalNewline };
}

/**
 * Inverse of `split`.
 * @param {MDLTextDocument} document
 */
export function join({ lines, newline, bom, finalNewline }) {
  return (bom ? byteOrderMark : "") + lines.join(newline) + (finalNewline ? newline : "");
}

const tagPattern = /^(.*\S) #([^\s#]+)$/;
const keyPattern = /^#([A-Za-z]+)$/;
const itemPattern = /^- (.*)$/;

/**
 * The first character a text file must not contain: control characters other than tab, line feed and carriage
 * return, DEL, and U+FFFD, which marks bytes that were not valid UTF-8. `line` and `column` count from 1;
 * CR, LF and CRLF each end a line.
 * @param {string} source
 * @returns {{ index: number, line: number, column: number } | null}
 */
export function invalidCharacter(source) {
  let index = 0;
  for (; index < source.length; index++) {
    const code = source.charCodeAt(index);
    if (code <= 8 || code === 11 || code === 12 || (code >= 14 && code <= 31) || code === 127 || code === 0xFFFD) break;
  }
  if (index === source.length) return null;
  const before = source.slice(0, index).replace(/\r\n?/g, "\n");
  return { index, line: before.split("\n").length, column: before.length - before.lastIndexOf("\n") };
}

/**
 * Splits a trailing `#tag` off a title: `"Arzt #health"` → `{ text: "Arzt", tag: "health" }`.
 * @param {string} text
 */
export function trailingTag(text) {
  const tagged = tagPattern.exec(text);
  return tagged ? { text: tagged[1], tag: tagged[2] } : { text, tag: "" };
}

/**
 * @typedef {{ type: "key", key: string, index: number }
 *   | { type: "item", key: string, value: string, index: number }
 *   | { type: "prose", key: string, text: string, index: number }
 *   | { type: "unknown", text: string, index: number }} MDLKeyBlockLine
 */

/**
 * Reads `#Key` blocks: a line `#Key` starts a block (a `key` line), `- value` lines are its items. Keys in
 * `prose` take every following line as text, blank lines included, until the next `#Key`. A key that is not
 * in `keys` or repeats, every line outside a known block and every non-item line in an item block is
 * `unknown`. Blank lines outside prose blocks are skipped. `index` is the position in `lines`.
 * @param {string[]} lines
 * @param {{ keys: string[], prose?: string[] }} schema
 * @returns {MDLKeyBlockLine[]}
 */
export function keyBlocks(lines, { keys, prose = [] }) {
  /** @type {MDLKeyBlockLine[]} */
  const result = [];
  const seen = new Set();
  /** @type {string | null} */
  let key = null;
  lines.forEach((line, index) => {
    const header = keyPattern.exec(line);
    if (header) {
      key = keys.includes(header[1]) && !seen.has(header[1]) ? header[1] : null;
      if (key) {
        seen.add(key);
        result.push({ type: "key", key, index });
      } else result.push({ type: "unknown", text: line, index });
      return;
    }
    if (key && prose.includes(key)) {
      result.push({ type: "prose", key, text: line, index });
      return;
    }
    if (line.trim() === "") return;
    const item = itemPattern.exec(line);
    if (item && key) result.push({ type: "item", key, value: item[1].trim(), index });
    else result.push({ type: "unknown", text: line, index });
  });
  return result;
}

/**
 * Inline formatting: `code`, [label](https://…), **strong**, ~strike~ and *em*.
 * Markers do not nest; a line break ends every marker.
 * @typedef {{ type: "text" | "code" | "strong" | "strike" | "em", text: string } | { type: "link", text: string, href: string }} MDLInlineToken
 */

const tokenPattern = /(`([^`\n]+)`|\[([^\]\n]+)]\((https?:\/\/[^\s)]+)\)|\*\*([^*\n]+)\*\*|~([^~\n]+)~|\*([^*\n]+)\*)/g;

/**
 * Inline formatting of a text as tokens; the app renders them.
 * @param {string} text
 * @returns {MDLInlineToken[]}
 */
export function inline(text) {
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

/** @type {Record<string, string>} */
const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" };

/**
 * Escapes text for HTML content and attribute values, for apps that render tokens as markup.
 * @param {string} value
 */
export function escapeHtml(value) {
  return value.replace(/[&<>"']/g, character => entities[character]);
}
