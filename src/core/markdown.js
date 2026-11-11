/**
 * Line helpers for the shared Markdown dialect. Parsers and serializers stay in the applications;
 * these helpers only classify lines and never drop one.
 */

const tagPattern = /^(.*\S) #([^\s#]+)$/;
const keyPattern = /^#([A-Za-z]+)$/;
const itemPattern = /^- (.*)$/;

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
 * Reads `#Key` blocks: a line `#Key` starts a block (a `key` line), `- value` lines are its items. Keys in `prose` take
 * every following line as text, blank lines included, until the next `#Key`. A key that is not in `keys` or
 * repeats, every line outside a known block and every non-item line in an item block is `unknown`.
 * Blank lines outside prose blocks are skipped. `index` is the position in `lines`.
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
