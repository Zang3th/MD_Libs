import assert from "node:assert/strict";
import test from "node:test";
import { json } from "../../src/core/index.js";

test("documents are read with their format; broken, formatless and newer documents are reported", () => {
  assert.deepEqual(json.read('{"format": 1, "extra": [1]}', { format: 1 }), { value: { format: 1, extra: [1] }, error: null });
  assert.equal(json.read('{"format": 2}', { format: 1 }).error, "newer");
  assert.deepEqual(json.read('{"format": 2}', { format: 1 }).value, { format: 2 });
  for (const text of ["{ broken", "[]", "null", '{"format": "1"}', '{"format": 1.5}']) {
    assert.deepEqual(json.read(text, { format: 1 }), { value: null, error: "unreadable" }, text);
  }
});

test("stringify orders keys by path, keeps unknown keys after the known ones and ends with a line break", () => {
  const value = { files: { "b.md": { at: 2, hash: "h" }, "a.md": { hash: "g" } }, extra: true, format: 1, list: [{ z: 1, a: 2 }] };
  const order = { "": ["format", "files"], files: /** @type {"sorted"} */ ("sorted"), "files.*": ["hash"], list: ["a"] };
  const text = json.stringify(value, { order });
  const parsed = JSON.parse(text);
  assert.deepEqual(Object.keys(parsed), ["format", "files", "extra", "list"]);
  assert.deepEqual(Object.keys(parsed.files), ["a.md", "b.md"]);
  assert.deepEqual(Object.keys(parsed.files["b.md"]), ["hash", "at"]);
  assert.deepEqual(Object.keys(parsed.list[0]), ["a", "z"]);
  assert.match(text, /^\{\n {2}"format": 1,\n/);
  assert.ok(text.endsWith("}\n"));
  assert.equal(json.stringify({ b: 1, a: 2 }), '{\n  "b": 1,\n  "a": 2\n}\n');
});
