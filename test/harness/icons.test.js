import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import icons from "../../src/harness/checks.cjs";

/** @param {import("node:test").TestContext} t @param {Record<string, string>} files */
function folder(t, files) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "mdl-icons-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  for (const [name, content] of Object.entries(files)) fs.writeFileSync(path.join(directory, name), content);
  return directory;
}

/** @param {string} body @param {string} [attributes] @param {string} [viewBox] */
const file = (body, attributes = ' fill="none"', viewBox = "0 0 32 32") => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}"${attributes}>\n  ${body}\n</svg>\n`;

const html = '<svg><symbol id="icon-check" viewBox="0 0 32 32" fill="none"><path d="M1 1"/></symbol><symbol id="icon-strike" viewBox="0 0 32 32" fill="none"><path d="M2 2"/></symbol><symbol id="tag-x" viewBox="0 0 32 32"><path/></symbol></svg>';

test("matching files and symbols report nothing, also with renamed files", t => {
  const directory = folder(t, { "check.svg": file('<path d="M1 1"/>'), "strikethrough.svg": file('<path d="M2 2"/>') });
  assert.deepEqual(icons.compareIcons({ html, directory, prefix: "icon-", names: new Map([["strikethrough", "strike"]]) }), []);
});

test("every difference is listed", t => {
  const directory = folder(t, {
    "check.svg": file('<path d="M9 9"/>', ' fill="red"', "0 0 24 24"),
    "extra.svg": file("<path/>"),
    "strike.svg": "<svg><path/></svg>",
    "notes.txt": "ignored"
  });
  assert.deepEqual(icons.compareIcons({ html, directory, prefix: "icon-" }), [
    "check.svg: viewBox 0 0 24 24 instead of 0 0 32 32",
    "check.svg: viewBox differs from the symbol",
    "check.svg: root attributes differ from the symbol",
    "check.svg: geometry differs from the symbol",
    "extra.svg: no symbol icon-extra",
    "strike.svg: not a standalone SVG"
  ]);
  assert.deepEqual(icons.compareIcons({ html, directory: path.join(directory, "missing"), prefix: "tag-" }), ["tag-x: no file"]);
});
