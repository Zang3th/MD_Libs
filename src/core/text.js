/** @type {Record<string, string>} */
const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" };

/**
 * Escapes text for HTML content and attribute values.
 * @param {string} value
 */
export function escapeHtml(value) {
  return value.replace(/[&<>"']/g, character => entities[character]);
}

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
