"use strict";

// Size of an application: source lines without blank and comment-only lines, and the number of tests.

const fs = require("node:fs");
const path = require("node:path");

/**
 * @typedef {object} MDLStatsOptions
 * @property {string} root The application folder.
 * @property {Record<string, string[]>} sources Files per language, relative to `root`. A path ending in `/` stands for
 *   the `.js` files directly in that folder. The language `HTML` skips `<!-- -->` comments, every other one `/* *\/`;
 *   `JS` also skips `//` lines.
 * @property {string} [tests] Folder searched recursively for `*.test.js` and `*.spec.js`; default `tests`.
 */

/** @typedef {{ lines: Record<string, number>, total: number, tests: number }} MDLStats */

/** @param {string} directory @returns {string[]} */
function javascriptFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith(".js"))
    .map(entry => path.join(directory, entry.name))
    .sort();
}

/** @param {string} directory @returns {string[]} */
function testFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return testFiles(target);
    return entry.isFile() && /\.(?:test|spec)\.js$/.test(entry.name) ? [target] : [];
  });
}

/**
 * Lines that hold code: block comments and blank lines are skipped, in JS also `//` lines.
 * @param {string} source @param {string} language
 */
function sourceLines(source, language) {
  const blockStart = language === "HTML" ? "<!--" : "/*";
  const blockEnd = language === "HTML" ? "-->" : "*/";
  let inBlockComment = false;
  return source.split(/\r?\n/).filter(line => {
    let remainder = line;
    while (remainder.length > 0) {
      if (inBlockComment) {
        const end = remainder.indexOf(blockEnd);
        if (end === -1) return false;
        remainder = remainder.slice(end + blockEnd.length);
        inBlockComment = false;
        continue;
      }
      const start = remainder.indexOf(blockStart);
      if (start === -1) break;
      const end = remainder.indexOf(blockEnd, start + blockStart.length);
      if (end === -1) {
        remainder = remainder.slice(0, start);
        inBlockComment = true;
        break;
      }
      remainder = remainder.slice(0, start) + remainder.slice(end + blockEnd.length);
    }
    const trimmed = remainder.trim();
    return trimmed !== "" && !(language === "JS" && trimmed.startsWith("//"));
  }).length;
}

/** Number of `test(` calls in a test file. @param {string} source */
function testCount(source) {
  return (source.match(/^\s*test(?:\.(?:only|skip|fixme|fail|slow))?\s*\(/gm) || []).length;
}

/**
 * Counts the source lines per language and the tests of an application.
 * @param {MDLStatsOptions} options
 * @returns {MDLStats}
 */
function projectStats({ root, sources, tests = "tests" }) {
  /** @type {Record<string, number>} */
  const lines = {};
  for (const [language, entries] of Object.entries(sources)) {
    const files = entries.flatMap(entry => entry.endsWith("/") ? javascriptFiles(path.join(root, entry)) : [path.join(root, entry)]);
    lines[language] = files.reduce((sum, file) => sum + sourceLines(fs.readFileSync(file, "utf8"), language), 0);
  }
  const total = Object.values(lines).reduce((sum, count) => sum + count, 0);
  const count = testFiles(path.join(root, tests)).reduce((sum, file) => sum + testCount(fs.readFileSync(file, "utf8")), 0);
  return { lines, total, tests: count };
}

/** The report the applications print. @param {MDLStats} stats @returns {string} */
function formatStats({ lines, total, tests }) {
  return [
    "Application LoC (without blank and comment-only lines)",
    ...Object.entries(lines).map(([language, count]) => `${language.padEnd(5)} ${count}`),
    `${"Total".padEnd(5)} ${total}`,
    `Tests ${tests}`
  ].join("\n");
}

module.exports = { projectStats, formatStats };
