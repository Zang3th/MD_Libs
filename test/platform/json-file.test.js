import assert from "node:assert/strict";
import test from "node:test";
import { jsonFile, storage } from "../../src/platform/index.js";

/** @param {Record<string, string>} [files] */
function setup(files = {}) {
  const adapter = storage.memory(files);
  let unreadable = 0;
  const file = jsonFile.create({
    adapter, name: "state.json", format: 1, initial: () => ({ format: 1, count: 0 }),
    order: { "": ["format", "count"] }, unreadable: () => { unreadable++; }
  });
  const text = () => adapter.files.get("state.json")?.text;
  /** @param {any} document */
  const increment = document => ({ ...document, count: document.count + 1 });
  return { adapter, file, text, increment, unreadable: () => unreadable };
}

test("a missing file is created; updates run one after another and keep unknown fields", async () => {
  const { file, text, increment } = setup();
  await Promise.all([file.update(increment), file.update(async document => increment(document))]);
  assert.equal(text(), '{\n  "format": 1,\n  "count": 2\n}\n');
  const other = setup({ "state.json": '{"extra": "kept", "count": 5, "format": 1}' });
  assert.equal(await other.file.update(other.increment), true);
  assert.equal(other.text(), '{\n  "format": 1,\n  "count": 6,\n  "extra": "kept"\n}\n');
});

test("an unreadable file is replaced after the callback; a newer format stays untouched", async () => {
  const broken = setup({ "state.json": "{ broken" });
  await broken.file.update(broken.increment);
  assert.equal(broken.unreadable(), 1);
  assert.equal(JSON.parse(broken.text() || "").count, 1);
  const newer = setup({ "state.json": '{"format": 2, "count": 9}' });
  assert.equal(await newer.file.update(newer.increment), false);
  assert.equal(newer.text(), '{"format": 2, "count": 9}');
});

test("a failed update rejects without blocking the next one", async () => {
  const { adapter, file, text, increment } = setup();
  adapter.failNextWrite(new Error("disk full"));
  await assert.rejects(file.update(increment), /disk full/);
  await file.update(increment);
  assert.equal(JSON.parse(text() || "").count, 1);
});
