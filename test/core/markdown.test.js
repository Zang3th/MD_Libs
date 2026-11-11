import assert from "node:assert/strict";
import test from "node:test";
import { markdown, text } from "../../src/core/index.js";

test("split and join keep byte order mark, line endings and the final newline", () => {
  for (const source of ["", "a", "a\n", "﻿a\r\nb\r\n", "a\r\nb", "a\n\n", "\n"]) {
    assert.equal(text.join(text.split(source)), source, JSON.stringify(source));
  }
  assert.deepEqual(text.split("﻿# A\r\n- x\r\n"), { lines: ["# A", "- x"], newline: "\r\n", bom: true, finalNewline: true });
  assert.deepEqual(text.split("a\nb\r\nc").newline, "\r\n", "CRLF anywhere means CRLF");
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
