/**
 * Versioned JSON documents: files an app writes for itself next to the user's Markdown. Each document is an
 * object with an integer `format`; fields the reader does not know are kept, and a stable layout keeps
 * a rewrite from touching lines whose values did not change.
 */

/** @typedef {Record<string, unknown> & { format: number }} MDLJsonDocument */

/**
 * Key order of a document, by path. A path names an object: `""` is the document, `"devices"` its field,
 * `"devices.*"` every value of that field. The value lists the keys that come first, in that order (other keys
 * follow as found), or is `"sorted"` to order all keys alphabetically.
 * @typedef {Record<string, string[] | "sorted">} MDLJsonOrder
 */

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Reads a document. `unreadable`: no JSON object with an integer `format`. `newer`: a later version of the app
 * wrote it, so this version may read but must not write it.
 * @param {string} text
 * @param {{ format: number }} options The format this app writes.
 * @returns {{ value: MDLJsonDocument | null, error: "unreadable" | "newer" | null }}
 */
export function read(text, { format }) {
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    return { value: null, error: "unreadable" };
  }
  if (!isObject(value) || !Number.isInteger(value.format)) return { value: null, error: "unreadable" };
  const document = /** @type {MDLJsonDocument} */ (value);
  return { value: document, error: document.format > format ? "newer" : null };
}

/** @param {string} pattern @param {string[]} path */
function matches(pattern, path) {
  const parts = pattern === "" ? [] : pattern.split(".");
  return parts.length === path.length && parts.every((part, index) => part === "*" || part === path[index]);
}

/** @param {unknown} value @param {string[]} path @param {MDLJsonOrder} order @returns {unknown} */
function arrange(value, path, order) {
  if (Array.isArray(value)) return value.map(item => arrange(item, path, order));
  if (!isObject(value)) return value;
  const rule = Object.entries(order).find(([pattern]) => matches(pattern, path))?.[1];
  const keys = Object.keys(value);
  const sorted = rule === "sorted" ? [...keys].sort()
    : rule ? [...rule.filter(key => key in value), ...keys.filter(key => !rule.includes(key))] : keys;
  return Object.fromEntries(sorted.map(key => [key, arrange(value[key], [...path, key], order)]));
}

/**
 * Two-space indentation, keys in `order`, and a final line break.
 * @param {unknown} value
 * @param {{ order?: MDLJsonOrder }} [options]
 */
export function stringify(value, { order = {} } = {}) {
  return `${JSON.stringify(arrange(value, [], order), null, 2)}\n`;
}
