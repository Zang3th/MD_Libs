import assert from "node:assert/strict";
import test from "node:test";
import { inline, text } from "../../src/core/index.js";

test("inline formatting parses into tokens and keeps the text between them", () => {
  assert.deepEqual(inline.parse("a `x*y` [site](https://e.de/a) **b** ~c~ *d* e"), [
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
  assert.deepEqual(inline.parse("plain"), [{ type: "text", text: "plain" }]);
  assert.deepEqual(inline.parse(""), []);
});

test("only http and https links are links; unclosed markers stay text", () => {
  assert.deepEqual(inline.parse("[x](javascript:alert(1)) **open"), [{ type: "text", text: "[x](javascript:alert(1)) **open" }]);
  assert.deepEqual(inline.parse("*a\nb*"), [{ type: "text", text: "*a\nb*" }]);
});

test("plain text strips markers of the dialect and common Markdown variants", () => {
  assert.equal(inline.plainText("  Apply **bold** and `code`  "), "Apply bold and code");
  assert.equal(inline.plainText("[label](x) ![img](y) __s__ *e* _u_ ~~d~~ ~t~"), "label img s e u d t");
  assert.equal(inline.plainText("snake_case_name stays"), "snake_case_name stays");
  assert.equal(inline.plainText("  no markers "), "no markers");
});

test("HTML escaping covers content and attribute values", () => {
  assert.equal(text.escapeHtml(`<a href="x">Tom & 'Jerry'</a>`), "&lt;a href=&quot;x&quot;&gt;Tom &amp; &#039;Jerry&#039;&lt;/a&gt;");
});
