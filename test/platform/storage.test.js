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
  const { window } = timers();
  assert.equal(await storage.ensurePermission(handle("granted", "denied"), "readwrite", { window }), true);
  assert.equal(await storage.ensurePermission(handle("prompt", "granted"), "readwrite", { window }), true);
  assert.equal(await storage.ensurePermission(handle("prompt", "granted"), "readwrite", { window, prompt: false }), false);
  assert.deepEqual(calls, ["query", "query", "request", "query"]);
});

test("a permission query the browser never answers rejects after five seconds without asking", async () => {
  const { window, pending, fire } = timers();
  let requests = 0;
  const broken = { name: "Roadmap.md", queryPermission: () => new Promise(() => {}), async requestPermission() { requests++; return "granted"; } };
  const result = storage.ensurePermission(/** @type {any} */ (broken), "readwrite", { window });
  assert.deepEqual(pending(), [5000]);
  fire();
  await assert.rejects(result, { name: "TimeoutError", message: 'The browser did not respond when checking access to "Roadmap.md". Remove it from the recent list and open it again.' });
  assert.equal(requests, 0);
  const disk = fakes.fileSystem({ "a.md": "A" });
  await storage.ensurePermission(disk.fileHandle("a.md"), "read", { window });
  assert.deepEqual(pending(), [], "an answered query clears its timer");
});

/** Timers that run only when the test fires them. */
function timers() {
  /** @type {Map<number, { run: () => void, delay: number }>} */
  const scheduled = new Map();
  let next = 0;
  const window = /** @type {any} */ ({
    setTimeout: (/** @type {() => void} */ run, /** @type {number} */ delay) => { scheduled.set(++next, { run, delay }); return next; },
    clearTimeout: (/** @type {number} */ id) => { scheduled.delete(id); }
  });
  return {
    window,
    pending: () => [...scheduled.values()].map(timer => timer.delay),
    fire() { for (const [id, timer] of scheduled) { scheduled.delete(id); timer.run(); } }
  };
}

test("probe reports a usable, a forbidden and a vanished handle", async () => {
  const { window } = timers();
  const disk = fakes.fileSystem({ "a.md": "A" });
  assert.equal(await storage.probe(/** @type {any} */ (disk.directory), "readwrite", { window }), "granted");
  assert.equal(await storage.probe(/** @type {any} */ (disk.fileHandle("a.md")), "read", { window }), "granted");
  disk.change("a.md", null);
  assert.equal(await storage.probe(/** @type {any} */ (disk.fileHandle("a.md")), "read", { window }), "missing");
  const gone = Object.assign(new Error("gone"), { name: "NotFoundError" });
  const vanished = { ...disk.directory, entries: () => ({ [Symbol.asyncIterator]: () => ({ next: () => Promise.reject(gone) }) }) };
  assert.equal(await storage.probe(/** @type {any} */ (vanished), "readwrite", { window }), "missing");
  disk.hooks.permission = "prompt";
  assert.equal(await storage.probe(/** @type {any} */ (disk.directory), "readwrite", { window, prompt: false }), "denied");
  assert.equal(disk.hooks.requests, 0);
  const broken = { ...disk.directory, queryPermission: async () => { throw new Error("broken"); } };
  await assert.rejects(storage.probe(/** @type {any} */ (broken), "read", { window }), /broken/);
});

test("fingerprints are SHA-256 of the UTF-8 text", async () => {
  const { subtle } = globalThis.crypto;
  assert.equal(await storage.fingerprint("abc", { subtle }), "sha256-ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  assert.notEqual(await storage.fingerprint("Grüße", { subtle }), await storage.fingerprint("Grusse", { subtle }));
});
