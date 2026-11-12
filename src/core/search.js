/**
 * Fuzzy search: every query character must appear in order (a subsequence). Contiguous runs, word starts and
 * uppercase letters score higher; earlier and shorter matches win ties.
 */

/** @typedef {"case" | "diacritics"} MDLFold */

/**
 * @template T
 * @typedef {object} MDLSearchOptions
 * @property {T[]} items
 * @property {Array<{ get: (item: T) => string, weight?: number }>} fields Searched texts per item; `weight` is added to a match in that field.
 * @property {MDLFold} [fold] `"case"` (default): smart case, an all-lowercase query ignores case and any uppercase
 *   character makes it case-sensitive. `"diacritics"`: always ignores case and diacritics; `ß` matches `ss`.
 * @property {boolean} [words] Split the query at whitespace; every word must match some field, scores add up.
 * @property {(left: T, right: T) => number} [tieBreak] Orders equal scores after the shorter matched text.
 */

/**
 * @template T
 * @typedef {{ item: T, score: number, field: number, positions: number[] }} MDLSearchResult
 * `field` and `positions` describe the match of the first query word; with `fold: "case"` positions index the field text.
 */

/**
 * @template T
 * @typedef {object} MDLSearchIndex
 * @property {T[]} items
 * @property {(query: string, options?: { limit?: number }) => { results: Array<MDLSearchResult<T>>, total: number }} query
 *   At most `limit` (default 50) results, best first; `total` counts every match.
 */

const wordBoundary = new Set([" ", "-", "_", "/", ".", ",", "(", "[", ":"].map(character => character.charCodeAt(0)));

/**
 * Lowercases for case-insensitive matching. Where lowercasing changes the length, positions would no longer
 * address the text, so that text keeps its casing.
 * @param {string} text
 */
function foldCase(text) {
  const lower = text.toLowerCase();
  return lower.length === text.length ? lower : text;
}

/** @param {string} text */
function foldDiacritics(text) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ß/g, "ss").toLowerCase();
}

/**
 * Text prepared for matching: `lower` is searched case-insensitively, `original` provides the uppercase bonus.
 * @param {string} text @param {MDLFold} fold
 */
function prepare(text, fold = "case") {
  if (fold === "case") return { text, lower: foldCase(text), original: text };
  const lower = foldDiacritics(text);
  return { text, lower, original: lower.length === text.length ? text : lower };
}

/**
 * Scores `needle` as a subsequence of `haystack`: a greedy left-to-right match, then a backward pass that pulls
 * every position as late as the window allows, so "ab" in "a-x-ab" counts as the adjacent pair it is.
 * @param {string} haystack @param {string} needle @param {string} original Same length as `haystack`; supplies the uppercase bonus.
 * @returns {{ score: number, positions: number[] } | null}
 */
function score(haystack, needle, original) {
  const positions = new Array(needle.length);
  let cursor = 0;
  for (let index = 0; index < needle.length; index++) {
    const code = needle.charCodeAt(index);
    while (cursor < haystack.length && haystack.charCodeAt(cursor) !== code) cursor++;
    if (cursor === haystack.length) return null;
    positions[index] = cursor;
    cursor++;
  }
  let tail = positions[needle.length - 1];
  for (let index = needle.length - 1; index >= 0; index--) {
    const code = needle.charCodeAt(index);
    while (haystack.charCodeAt(tail) !== code) tail--;
    positions[index] = tail;
    tail--;
  }

  let total = 0;
  let previous = -2;
  for (let index = 0; index < needle.length; index++) {
    const position = positions[index];
    total += 16;
    // A solid run must outrank the same letters spread across word starts; with equal bonuses
    // "f o r m a t" would tie "the format label".
    if (position === previous + 1) total += 16;
    if (position === 0 || wordBoundary.has(haystack.charCodeAt(position - 1))) total += 8;
    const character = original.charCodeAt(position);
    if (character >= 65 && character <= 90) total += 4;
    previous = position;
  }
  return { score: total - positions[0] - (haystack.length - needle.length) * 0.05, positions };
}

/**
 * Builds a search index. Field texts are prepared once; extending the previous query only rescores its
 * matches, which is exact because extending a subsequence query can only remove matches.
 * @template T
 * @param {MDLSearchOptions<T>} options
 * @returns {MDLSearchIndex<T>}
 */
export function create({ items, fields, fold = "case", words = false, tieBreak = () => 0 }) {
  const entries = items.map(item => ({
    item,
    fields: fields.map(field => ({ ...prepare(field.get(item), fold), weight: field.weight || 0 }))
  }));
  /** @type {{ query: string, entries: typeof entries } | null} */
  let narrow = null;

  /** @param {MDLSearchResult<T> & { length: number }} left @param {MDLSearchResult<T> & { length: number }} right */
  function compare(left, right) {
    if (left.score !== right.score) return right.score - left.score;
    if (left.length !== right.length) return left.length - right.length;
    return tieBreak(left.item, right.item);
  }

  /**
   * Best field for one query word.
   * @param {typeof entries[number]} entry @param {string} needle @param {boolean} sensitive
   */
  function best(entry, needle, sensitive) {
    /** @type {{ score: number, positions: number[], field: number, length: number } | null} */
    let found = null;
    for (let index = 0; index < entry.fields.length; index++) {
      const field = entry.fields[index];
      const scored = score(sensitive ? field.text : field.lower, needle, field.original);
      if (scored && (!found || scored.score + field.weight > found.score)) found = { score: scored.score + field.weight, positions: scored.positions, field: index, length: field.text.length };
    }
    return found;
  }

  return {
    items,
    query(text, { limit = 50 } = {}) {
      const raw = text.trim();
      if (!raw) {
        narrow = null;
        return { results: [], total: 0 };
      }
      const sensitive = fold === "case" && raw !== raw.toLowerCase();
      const folded = sensitive ? raw : prepare(raw, fold).lower;
      const needles = words ? folded.split(/\s+/) : [folded];
      const pool = narrow && raw.startsWith(narrow.query) ? narrow.entries : entries;

      /** @type {typeof entries} */
      const matched = [];
      /** @type {Array<MDLSearchResult<T> & { length: number }>} */
      const results = [];
      let floor = Number.NEGATIVE_INFINITY;
      for (const entry of pool) {
        let total = 0;
        /** @type {ReturnType<typeof best>} */
        let first = null;
        for (const needle of needles) {
          const found = best(entry, needle, sensitive);
          if (!found) {
            first = null;
            break;
          }
          first ||= found;
          total += found.score;
        }
        if (!first) continue;
        matched.push(entry);
        if (results.length === limit && total < floor) continue;
        const result = { item: entry.item, score: total, field: first.field, positions: first.positions, length: first.length };
        let position = results.length;
        while (position > 0 && compare(results[position - 1], result) > 0) position--;
        results.splice(position, 0, result);
        if (results.length > limit) results.pop();
        if (results.length === limit) floor = results[limit - 1].score;
      }

      narrow = { query: raw, entries: matched };
      return { results: results.map(({ item, score, field, positions }) => ({ item, score, field, positions })), total: matched.length };
    }
  };
}
