import assert from "node:assert/strict";
import test from "node:test";
import { handles } from "../../src/platform/index.js";
import fakes from "../../src/harness/fakes.cjs";

/** @param {number} limit */
function setup(limit) {
  const indexedDB = fakes.indexedDB();
  const clock = fakes.clock();
  const disk = fakes.fileSystem();
  /** @type {import("../../src/platform/handles.js").MDLHandleStore<{ title?: string, width?: number }>} */
  const store = handles.create({ indexedDB: /** @type {any} */ (indexedDB), database: "App", store: "recent", limit, now: () => { clock.advance(1); return clock.now(); }, random: () => 0.5 });
  return { store, disk, indexedDB };
}

test("remembered handles are listed newest first, merged by entry and limited", async () => {
  const { store, disk } = setup(2);
  assert.deepEqual(await store.list(), []);
  const first = await store.remember(disk.fileHandle("a.md"), () => ({ title: "A" }));
  assert.deepEqual([first.id, first.name, first.title, first.openedAt], ["1-0.5", "a.md", "A", 2]);
  await store.remember(disk.fileHandle("b.md"));
  const again = await store.remember(disk.fileHandle("a.md"), existing => ({ title: `${existing?.title}!` }));
  assert.equal(again.id, first.id);
  assert.deepEqual((await store.list()).map(record => [record.name, record.title]), [["a.md", "A!"], ["b.md", undefined]]);
  await store.remember(disk.fileHandle("c.md"));
  assert.deepEqual((await store.list()).map(record => record.name), ["c.md", "a.md"]);
  assert.equal((await store.find(disk.fileHandle("a.md")))?.title, "A!");
  assert.equal(await store.find(disk.fileHandle("b.md")), undefined);
  await store.forget(first.id);
  assert.deepEqual((await store.list()).map(record => record.name), ["c.md"]);
});

test("concurrent remember calls run one after another and a failure does not block the next", async () => {
  const { store, disk, indexedDB } = setup(5);
  await Promise.all([store.remember(disk.fileHandle("a.md")), store.remember(disk.fileHandle("b.md"))]);
  assert.equal((await store.list()).length, 2);
  indexedDB.failures.open = new Error("storage blocked");
  await assert.rejects(store.remember(disk.fileHandle("c.md")), /storage blocked/);
  await assert.rejects(store.list(), /storage blocked/);
  indexedDB.failures.open = null;
  await store.remember(disk.fileHandle("c.md"));
  assert.equal((await store.list()).length, 3);
});

test("an existing database gets the store through a version upgrade", async () => {
  const indexedDB = fakes.indexedDB();
  const disk = fakes.fileSystem();
  const v1 = handles.create({ indexedDB: /** @type {any} */ (indexedDB), database: "App", store: "old", limit: 1 });
  await v1.remember(disk.directory);
  const v2 = handles.create({ indexedDB: /** @type {any} */ (indexedDB), database: "App", store: "folders", version: 2, limit: 1 });
  assert.deepEqual(await v2.list(), []);
  await v2.remember(disk.directory);
  assert.equal((await v2.list())[0].name, "folder");
  assert.equal((await v1.list()).length, 1, "other stores keep their records");
});
