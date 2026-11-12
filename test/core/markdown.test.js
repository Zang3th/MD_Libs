import assert from "node:assert/strict";
import test from "node:test";
import { markdown } from "../../src/core/index.js";

test("split and join keep byte order mark, line endings and the final newline", () => {
  for (const source of ["", "a", "a\n", "﻿a\r\nb\r\n", "a\r\nb", "a\n\n", "\n"]) {
    assert.equal(markdown.join(markdown.split(source)), source, JSON.stringify(source));
  }
  assert.deepEqual(markdown.split("﻿# A\r\n- x\r\n"), { lines: ["# A", "- x"], newline: "\r\n", bom: true, finalNewline: true });
  assert.deepEqual(markdown.split("a\nb\r\nc").newline, "\r\n", "CRLF anywhere means CRLF");
});

test("a trailing tag is split off a title", () => {
  assert.deepEqual(markdown.trailingTag("Arzt #health"), { text: "Arzt", tag: "health" });
  assert.deepEqual(markdown.trailingTag("C# #dev"), { text: "C#", tag: "dev" });
  assert.deepEqual(markdown.trailingTag("#tag only"), { text: "#tag only", tag: "" });
  assert.deepEqual(markdown.trailingTag("Arzt #"), { text: "Arzt #", tag: "" });
});

test("key blocks report keys, items, prose and every line they do not understand", () => {
  const lines = ["#Start", "- 01.01.2026 ", "", "text", "#Note", "first", "", "  - indented", "#Start", "- again", "#Other", "- x", "#Repeat", "- FREQ=DAILY"];
  assert.deepEqual(markdown.keyBlocks(lines, { keys: ["Start", "Repeat", "Note"], prose: ["Note"] }), [
    { type: "key", key: "Start", index: 0 },
    { type: "item", key: "Start", value: "01.01.2026", index: 1 },
    { type: "unknown", text: "text", index: 3 },
    { type: "key", key: "Note", index: 4 },
    { type: "prose", key: "Note", text: "first", index: 5 },
    { type: "prose", key: "Note", text: "", index: 6 },
    { type: "prose", key: "Note", text: "  - indented", index: 7 },
    { type: "unknown", text: "#Start", index: 8 },
    { type: "unknown", text: "- again", index: 9 },
    { type: "unknown", text: "#Other", index: 10 },
    { type: "unknown", text: "- x", index: 11 },
    { type: "key", key: "Repeat", index: 12 },
    { type: "item", key: "Repeat", value: "FREQ=DAILY", index: 13 }
  ]);
  assert.deepEqual(markdown.keyBlocks(["- before any key"], { keys: ["Start"] }), [{ type: "unknown", text: "- before any key", index: 0 }]);
});

test("inline formatting parses into tokens and keeps the text between them", () => {
  assert.deepEqual(markdown.inline("a `x*y` [site](https://e.de/a) **b** ~c~ *d* e"), [
    { type: "text", text: "a " },
    { type: "code", text: "x*y" },
    { type: "text", text: " " },
    { type: "link", text: "site", href: "https://e.de/a" },
    { type: "text", text: " " },
    { type: "strong", text: "b" },
    { type: "text", text: " " },
    { type: "strike", text: "c" },
    { type: "text", text: " " },
    { type: "em", text: "d" },
    { type: "text", text: " e" }
  ]);
  assert.deepEqual(markdown.inline("plain"), [{ type: "text", text: "plain" }]);
  assert.deepEqual(markdown.inline(""), []);
});

test("only http and https links are links; unclosed markers stay text", () => {
  assert.deepEqual(markdown.inline("[x](javascript:alert(1)) **open"), [{ type: "text", text: "[x](javascript:alert(1)) **open" }]);
  assert.deepEqual(markdown.inline("*a\nb*"), [{ type: "text", text: "*a\nb*" }]);
});

test("plain text strips markers of the dialect and common Markdown variants", () => {
  assert.equal(markdown.plainText("  Apply **bold** and `code`  "), "Apply bold and code");
  assert.equal(markdown.plainText("[label](x) ![img](y) __s__ *e* _u_ ~~d~~ ~t~"), "label img s e u d t");
  assert.equal(markdown.plainText("snake_case_name stays"), "snake_case_name stays");
  assert.equal(markdown.plainText("  no markers "), "no markers");
});

test("HTML escaping covers content and attribute values", () => {
  assert.equal(markdown.escapeHtml(`<a href="x">Tom & 'Jerry'</a>`), "&lt;a href=&quot;x&quot;&gt;Tom &amp; &#039;Jerry&#039;&lt;/a&gt;");
});

test("the first invalid character is found with line and column; tab, CR and LF are valid", () => {
  assert.equal(markdown.invalidCharacter("# A\r\n\tb\n"), null);
  assert.deepEqual(markdown.invalidCharacter("ab\u0000c"), { index: 2, line: 1, column: 3 });
  assert.deepEqual(markdown.invalidCharacter("a\r\nb\rc\nd\u007F\u0001"), { index: 8, line: 4, column: 2 });
  assert.deepEqual(markdown.invalidCharacter("\n\n�"), { index: 2, line: 3, column: 1 });
  for (const code of [8, 11, 12, 14, 31]) assert.equal(markdown.invalidCharacter(String.fromCharCode(code))?.index, 0, String(code));
  for (const code of [9, 10, 13, 32, 128, 0xFFFE]) assert.equal(markdown.invalidCharacter(String.fromCharCode(code)), null, String(code));
});
