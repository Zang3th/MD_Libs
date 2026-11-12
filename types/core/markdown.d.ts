/**
 * Splits a text file into lines. The byte order mark, the line ending (CRLF when any line uses it) and a
 * final newline are recorded, so that `join` writes the same conventions back.
 * @param {string} source
 * @returns {MDLTextDocument}
 */
export function split(source: string): MDLTextDocument;
/**
 * Inverse of `split`.
 * @param {MDLTextDocument} document
 */
export function join({ lines, newline, bom, finalNewline }: MDLTextDocument): string;
/**
 * The first character a text file must not contain: control characters other than tab, line feed and carriage
 * return, DEL, and U+FFFD, which marks bytes that were not valid UTF-8. `line` and `column` count from 1;
 * CR, LF and CRLF each end a line.
 * @param {string} source
 * @returns {{ index: number, line: number, column: number } | null}
 */
export function invalidCharacter(source: string): {
    index: number;
    line: number;
    column: number;
} | null;
/**
 * Splits a trailing `#tag` off a title: `"Arzt #health"` → `{ text: "Arzt", tag: "health" }`.
 * @param {string} text
 */
export function trailingTag(text: string): {
    text: string;
    tag: string;
};
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
export function keyBlocks(lines: string[], { keys, prose }: {
    keys: string[];
    prose?: string[];
}): MDLKeyBlockLine[];
/**
 * Inline formatting of a text as tokens; the app renders them.
 * @param {string} text
 * @returns {MDLInlineToken[]}
 */
export function inline(text: string): MDLInlineToken[];
/**
 * Text without inline markers, trimmed, for searching and plain display. Also strips the common Markdown
 * variants `__strong__`, `_em_`, `~~strike~~` and images. Text without any marker character is only trimmed.
 * @param {string} text
 */
export function plainText(text: string): string;
/**
 * Escapes text for HTML content and attribute values, for apps that render tokens as markup.
 * @param {string} value
 */
export function escapeHtml(value: string): string;
export type MDLKeyBlockLine = {
    type: "key";
    key: string;
    index: number;
} | {
    type: "item";
    key: string;
    value: string;
    index: number;
} | {
    type: "prose";
    key: string;
    text: string;
    index: number;
} | {
    type: "unknown";
    text: string;
    index: number;
};
export type MDLTextDocument = {
    lines: string[];
    newline: "\n" | "\r\n";
    bom: boolean;
    finalNewline: boolean;
};
/**
 * Inline formatting: `code`, [label](https://…), **strong**, ~strike~ and *em*.
 * Markers do not nest; a line break ends every marker.
 */
export type MDLInlineToken = {
    type: "text" | "code" | "strong" | "strike" | "em";
    text: string;
} | {
    type: "link";
    text: string;
    href: string;
};
