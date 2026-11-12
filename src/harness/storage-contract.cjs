"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

/**
 * @typedef {object} ContractSubject
 * @property {import("../platform/storage.js").MDLStorageAdapter} adapter
 * @property {(name: string, text: string | null) => void} change Changes a file outside the adapter.
 * @property {(error: Error | null) => void} failNextWrite Makes the next write fail with `error` before anything is written.
 * @property {(error: Error) => void} failNextRead Makes the next read fail with `error`.
 */

/**
 * Registers the storage adapter contract as `node:test` tests. Every adapter must pass it.
 * @param {{ name: string, setup: (files: Record<string, string>) => ContractSubject | Promise<ContractSubject>, missing?: "null" | "reject" }} options
 *   `setup` creates an adapter whose storage holds `files`; `"a.md"` is the file under test.
 *   `missing`: how reading a missing file behaves; a single-file adapter rejects.
 */
function storageContract({ name, setup, missing = "null" }) {
  test(`${name}: read returns content and stamp, stat the same stamp`, async () => {
    const { adapter } = await setup({ "a.md": "one" });
    const read = await adapter.read("a.md");
    assert.equal(read?.text, "one");
    assert.equal(await adapter.stat("a.md"), read?.stamp);
    assert.deepEqual(await adapter.list(), ["a.md"]);
  });

  test(`${name}: a missing file ${missing === "null" ? "reads as null" : "rejects with NotFoundError"}`, async () => {
    const { adapter, change } = await setup({ "a.md": "one" });
    change("a.md", null);
    if (missing === "null") {
      assert.equal(await adapter.read("a.md"), null);
      assert.equal(await adapter.stat("a.md"), null);
    } else {
      await assert.rejects(adapter.read("a.md"), { name: "NotFoundError" });
    }
  });

  test(`${name}: a write with the expected content succeeds and changes the stamp`, async () => {
    const { adapter } = await setup({ "a.md": "one" });
    const before = await adapter.stat("a.md");
    const stamp = await adapter.write("a.md", "two", "one");
    assert.notEqual(stamp, before);
    assert.deepEqual(await adapter.read("a.md"), { text: "two", stamp });
  });

  test(`${name}: a write against changed content rejects with the stored version and writes nothing`, async () => {
    const { adapter, change } = await setup({ "a.md": "one" });
    change("a.md", "external");
    const stored = await adapter.read("a.md");
    await assert.rejects(adapter.write("a.md", "two", "one"), error => {
      assert.equal(/** @type {any} */ (error).name, "MDLStorageConflictError");
      assert.equal(/** @type {any} */ (error).code, "MDL_STORAGE_CONFLICT");
      assert.deepEqual([/** @type {any} */ (error).file, /** @type {any} */ (error).text, /** @type {any} */ (error).stamp], ["a.md", "external", stored?.stamp]);
      return true;
    });
    assert.equal((await adapter.read("a.md"))?.text, "external");
  });

  test(`${name}: a failing version check writes nothing`, async () => {
    const { adapter, failNextRead } = await setup({ "a.md": "one" });
    failNextRead(new Error("device lost"));
    await assert.rejects(adapter.write("a.md", "two", "one"), /device lost/);
    assert.equal((await adapter.read("a.md"))?.text, "one");
  });

  test(`${name}: an unconditional write overwrites any content`, async () => {
    const { adapter, change } = await setup({ "a.md": "one" });
    change("a.md", "external");
    await adapter.write("a.md", "mine");
    assert.equal((await adapter.read("a.md"))?.text, "mine");
  });

  if (missing === "null") {
    test(`${name}: expected null creates a missing file and conflicts with an existing one`, async () => {
      const { adapter, change } = await setup({ "a.md": "one" });
      await assert.rejects(adapter.write("a.md", "two", null), { name: "MDLStorageConflictError", text: "one" });
      change("a.md", null);
      await adapter.write("a.md", "new", null);
      assert.equal((await adapter.read("a.md"))?.text, "new");
    });
  }

  test(`${name}: writes run in call order and a failed write does not block the next`, async () => {
    const { adapter, failNextWrite } = await setup({ "a.md": "0" });
    const first = adapter.write("a.md", "1", "0");
    const second = adapter.write("a.md", "2", "1");
    await Promise.all([first, second]);
    assert.equal((await adapter.read("a.md"))?.text, "2");
    failNextWrite(new Error("disk full"));
    await assert.rejects(adapter.write("a.md", "3", "2"), /disk full/);
    await adapter.write("a.md", "4", "2");
    assert.equal((await adapter.read("a.md"))?.text, "4");
  });
}

module.exports = { storageContract };
