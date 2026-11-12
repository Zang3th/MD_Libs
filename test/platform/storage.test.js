import assert from "node:assert/strict";
import test from "node:test";
import { storage } from "../../src/platform/index.js";
import testing from "../../src/harness/testing.cjs";

const { storageContract } = testing;
const fakes = testing;

storageContract({ name: "memory", setup: files => {
  const adapter = storage.memory(files);
  return {
    adapter,
    change(name, text) {
      if (text === null) adapter.files.delete(name);
      else adapter.files.set(name, { text, stamp: `external-${text}` });
    },
    failNextWrite(error) { if (error) adapter.failNextWrite(error); },
    failNextRead: adapter.failNextRead
  };
} });

storageContract({ name: "folder", setup: files => {
  const disk = fakes.fileSystem(files);
  return {
    adapter: storage.folder(/** @type {any} */ (disk.directory), { files: ["a.md", "b.md"] }),
    change: disk.change,
    failNextWrite(error) { disk.hooks.failNextWrite = error ?? undefined; },
    failNextRead(error) { disk.hooks.failNextRead = error; }
  };
} });

storageContract({ name: "file", missing: "reject", setup: files => {
  const disk = fakes.fileSystem(files);
  return {
    adapter: storage.file(disk.fileHandle("a.md")),
    change: disk.change,
    failNextWrite(error) { disk.hooks.failNextWrite = error ?? undefined; },
    failNextRead(error) { disk.hooks.failNextRead = error; }
  };
} });

test("a folder lists only the configured files, sorted, and rethrows unexpected read errors", async () => {
  const disk = fakes.fileSystem({ "b.md": "", "a.md": "", "other.txt": "" });
  const adapter = storage.folder(/** @type {any} */ (disk.directory), { files: ["a.md", "b.md"] });
  assert.equal(adapter.name, "folder");
  assert.deepEqual(await adapter.list(), ["a.md", "b.md"]);
  disk.hooks.failRead = new Error("device lost");
  await assert.rejects(adapter.read("a.md"), /device lost/);
});

test("a file adapter addresses only its own file", async () => {
  const disk = fakes.fileSystem({ "a.md": "one" });
  const adapter = storage.file(disk.fileHandle("a.md"));
  assert.equal(await adapter.read("b.md"), null);
  await assert.rejects(adapter.write("b.md", "x"), /b\.md is not a\.md/);
  assert.deepEqual(await adapter.list(), ["a.md"]);
});

test("a file adapter without getFile can only write unconditionally", async () => {
  /** @type {string[]} */
  const written = [];
  const adapter = storage.file({ name: "a.md", async createWritable() { return { async write(/** @type {string} */ text) { written.push(text); }, async close() {} }; } });
  assert.equal(adapter.canCheck, false);
  assert.equal(await adapter.read("a.md"), null);
  assert.equal(await adapter.write("a.md", "one"), "");
  assert.deepEqual(written, ["one"]);
  assert.equal(storage.memory().canCheck, undefined);
});

test("permission is kept when granted and requested only when prompting is allowed", async () => {
  /** @type {string[]} */
  const calls = [];
  /** @param {PermissionState} query @param {PermissionState} request */
  const handle = (query, request) => ({
    async queryPermission() { calls.push("query"); return query; },
    async requestPermission() { calls.push("request"); return request; }
  });
  assert.equal(await storage.ensurePermission(handle("granted", "denied"), "readwrite"), true);
  assert.equal(await storage.ensurePermission(handle("prompt", "granted"), "readwrite"), true);
  assert.equal(await storage.ensurePermission(handle("prompt", "granted"), "readwrite", { prompt: false }), false);
  assert.deepEqual(calls, ["query", "query", "request", "query"]);
  calls.length = 0;
  assert.equal(await storage.ensurePermission(handle("granted", "denied"), "readwrite", { query: false }), false);
  assert.deepEqual(calls, ["request"]);
});
