"use strict";

// Compares the inline SVG symbols of an application page with the standalone SVG files they come from.

const fs = require("node:fs");
const path = require("node:path");

/** @param {string} value */
function normalize(value) {
  return value.replace(/\s+/g, " ").replace(/> </g, "><").trim();
}

/**
 * Lists every difference between the `<symbol id="{prefix}{name}">` elements of `html` and the SVG files in
 * `directory`: missing files or symbols, a missing standalone wrapper, another canvas, other root attributes
 * or other geometry. An empty list means they match.
 * @param {{ html: string, directory: string, prefix: string, names?: Map<string, string>, viewBox?: string }} options
 *   `names` maps file names (without `.svg`) to symbol names where they differ.
 * @returns {string[]}
 */
function compareIcons({ html, directory, prefix, names = new Map(), viewBox = "0 0 32 32" }) {
  /** @type {string[]} */
  const problems = [];
  const symbols = new Map(Array.from(html.matchAll(/<symbol id="([^"]+)" viewBox="([^"]+)"([^>]*)>([\s\S]*?)<\/symbol>/g))
    .filter(match => match[1].startsWith(prefix))
    .map(match => [match[1].slice(prefix.length), { viewBox: match[2], attributes: normalize(match[3]), content: normalize(match[4]) }]));
  const files = fs.existsSync(directory) ? fs.readdirSync(directory).filter(name => name.endsWith(".svg")).sort() : [];
  const fileSymbols = new Set();

  for (const file of files) {
    const base = file.slice(0, -4);
    const name = names.get(base) || base;
    fileSymbols.add(name);
    const symbol = symbols.get(name);
    if (!symbol) {
      problems.push(`${file}: no symbol ${prefix}${name}`);
      continue;
    }
    const match = fs.readFileSync(path.join(directory, file), "utf8").trim().match(/^<svg\s+xmlns="http:\/\/www\.w3\.org\/2000\/svg"\s+viewBox="([^"]+)"([^>]*)>([\s\S]*?)<\/svg>$/);
    if (!match) {
      problems.push(`${file}: not a standalone SVG`);
      continue;
    }
    if (match[1] !== viewBox) problems.push(`${file}: viewBox ${match[1]} instead of ${viewBox}`);
    if (symbol.viewBox !== match[1]) problems.push(`${file}: viewBox differs from the symbol`);
    if (symbol.attributes !== normalize(match[2])) problems.push(`${file}: root attributes differ from the symbol`);
    if (symbol.content !== normalize(match[3])) problems.push(`${file}: geometry differs from the symbol`);
  }
  for (const name of symbols.keys()) {
    if (!fileSymbols.has(name)) problems.push(`${prefix}${name}: no file`);
  }
  return problems;
}

module.exports = { compareIcons };
