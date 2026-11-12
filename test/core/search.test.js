import assert from "node:assert/strict";
import test from "node:test";
import { search } from "../../src/core/index.js";

/** @param {string[]} texts @param {Partial<import("../../src/core/search.js").MDLSearchOptions<string>>} [options] */
function indexOf(texts, options = {}) {
  return search.create({ items: texts, fields: [{ get: text => text }], ...options });
}

/** @param {import("../../src/core/search.js").MDLSearchIndex<string>} index @param {string} query @param {number} [limit] */
function found(index, query, limit) {
  return index.query(query, { limit }).results.map(result => result.item);
}

test("matching is a subsequence, so abbreviations find their target", () => {
  const index = indexOf(["Editor Experience", "Archive"]);
  assert.deepEqual(found(index, "edex"), ["Editor Experience"]);
  assert.equal(index.query("zzz").total, 0);
});

test("contiguous and word-boundary matches outrank scattered ones", () => {
  assert.deepEqual(found(indexOf(["f o r m a t", "the format label", "format"]), "format"), ["format", "the format label", "f o r m a t"]);
  assert.deepEqual(found(indexOf(["a-x-b", "a-x-ab"]), "ab"), ["a-x-ab", "a-x-b"], "the backward pass finds the adjacent pair");
});

test("smart case ignores case until the query contains an uppercase character", () => {
  const index = indexOf(["parse markdown", "Parse Markdown"]);
  assert.equal(index.query("parse").total, 2);
  assert.deepEqual(found(index, "Parse"), ["Parse Markdown"]);
  assert.deepEqual(found(indexOf(["XİX"]), "xi"), [], "text whose lowercase changes length matches only case-sensitively");
});

test("equal scores prefer the shorter text, then the tie-break", () => {
  const items = ["Alpha 2", "Alpha 1", "Alpha"];
  const index = indexOf(items, { tieBreak: (left, right) => left.localeCompare(right) });
  assert.deepEqual(found(index, "alpha"), ["Alpha", "Alpha 1", "Alpha 2"]);
  assert.deepEqual(found(indexOf(items), "alpha"), ["Alpha", "Alpha 2", "Alpha 1"], "without a tie-break the order of the items stays");
});

test("match positions address the displayed text", () => {
  const [result] = indexOf(["Apply bold formatting"]).query("bold").results;
  assert.deepEqual([result.positions, result.field], [[6, 7, 8, 9], 0]);
});

test("results are capped while the total counts every match", () => {
  const index = indexOf(Array.from({ length: 40 }, (_, count) => `alpha item ${count}`));
  const limited = index.query("alpha", { limit: 10 });
  assert.deepEqual([limited.results.length, limited.total], [10, 40]);
  assert.equal(index.query("alpha", { limit: 100 }).results.length, 40);
  assert.equal(index.query("alpha").results.length, 40);
});

test("a capped query returns the prefix of the full ranking, also for ties and after narrowing", () => {
  const texts = [...Array.from({ length: 50 }, (_, count) => `Match ${String(count).padStart(2, "0")}`), "Ma tch", "match", "M a t c h"];
  const options = { tieBreak: (/** @type {string} */ left, /** @type {string} */ right) => right.localeCompare(left) };
  const full = indexOf(texts, options).query("match", { limit: 100 });
  for (const limit of [1, 2, 50, 51, 52]) {
    const narrowed = indexOf(texts, options);
    narrowed.query("mat", { limit });
    const limited = narrowed.query("match", { limit });
    assert.equal(limited.total, full.total);
    assert.deepEqual(limited.results, full.results.slice(0, limit), String(limit));
  }
});

test("narrowing extended queries and resetting on other or empty queries keep full-scan results", () => {
  const texts = ["format", "form", "for", "bold", "warning", "forward"];
  const narrowed = indexOf(texts);
  for (const query of ["for", "form", "forma", "bold", "warning", "  ", "w"]) {
    assert.deepEqual(narrowed.query(query), indexOf(texts).query(query), query);
  }
  assert.deepEqual(narrowed.query(" "), { results: [], total: 0 });
});

test("diacritics folding ignores case, accents and ß", () => {
  const index = indexOf(["Müller", "Straße", "ARZT"], { fold: "diacritics" });
  assert.deepEqual(found(index, "muller"), ["Müller"]);
  assert.deepEqual(found(index, "MÜLLER"), ["Müller"]);
  assert.deepEqual(found(index, "strasse"), ["Straße"]);
  assert.deepEqual(found(index, "arzt"), ["ARZT"]);
});

test("with words, every word must match some field and field weights rank the result", () => {
  /** @type {Array<{ title: string, note: string }>} */
  const items = [{ title: "Zahnarzt", note: "Kontrolle" }, { title: "Kontrolle", note: "beim Zahnarzt" }, { title: "Arzt", note: "" }];
  const index = search.create({ items, fields: [{ get: item => item.title, weight: 20 }, { get: item => item.note }], fold: "diacritics", words: true });
  assert.deepEqual(index.query("zahnarzt kontrolle").results.map(result => result.item.title), ["Zahnarzt", "Kontrolle"]);
  assert.deepEqual(index.query("arzt").results.map(result => [result.item.title, result.field]), [["Arzt", 0], ["Zahnarzt", 0], ["Kontrolle", 1]]);
  assert.equal(index.query("zahnarzt röntgen").total, 0);
});
