import assert from "node:assert/strict";
import test from "node:test";
import { history as historyModule } from "../../src/core/index.js";
import { session, storage } from "../../src/platform/index.js";
import fakes from "../../src/harness/testing.cjs";

const { flush, gate } = fakes;

/**
 * A model per file whose content is its text, as an app's parsed model would serialize.
 * @param {Record<string, string | null>} texts
 */
function models(texts) {
  /** @type {Record<string, string>} */
  const current = {};
  for (const [name, text] of Object.entries(texts)) current[name] = text ?? `# ${name}\n`;
  /** @type {string[]} */
  const loads = [];
  return {
    current,
    loads,
    /** @param {string} name @param {{ writable?: boolean, fail?: () => boolean }} [options] */
    file(name, { writable = true, fail = () => false } = {}) {
      return {
        writable,
        serialize: () => current[name],
        /** @param {string | null} text */
        load(text) {
          if (fail()) throw new Error("invalid format");
          loads.push(`${name}=${text}`);
          current[name] = text ?? `# ${name}\n`;
        }
      };
    }
  };
}

/** Records every session event in order. @param {import("../../src/platform/session.js").MDLSession} s */
function record(s) {
  /** @type {string[]} */
  const events = [];
  s.on("change", () => events.push("change"));
  s.on("conflict", detail => events.push(`conflict:${detail.files}`));
  s.on("blocked", () => events.push("blocked"));
  s.on("saved", detail => events.push(`saved:${detail.files}`));
  s.on("reloaded", detail => events.push(`reloaded:${detail.file}`));
  s.on("checkError", detail => events.push(`checkError:${detail.file}:${detail.deleted ? "deleted" : /** @type {Error} */ (detail.error).message}`));
  return events;
}

/** One project file behind a file handle, as MD_Manager opens it. */
async function project(text = "local") {
  const disk = fakes.fileSystem({ "P.md": text });
  const handle = disk.fileHandle("P.md");
  const adapter = storage.file(handle);
  const model = models({ "P.md": text });
  const clock = fakes.clock(100000);
  const s = session.create({ adapter, files: { "P.md": model.file("P.md") }, initial: { "P.md": await adapter.read("P.md") }, now: clock.now });
  return { disk, adapter, model, clock, s, events: record(s) };
}

test("save writes changed content once, verifies it and reports it; unchanged content is not written", async () => {
  const { disk, model, s, events } = await project();
  assert.equal(s.unsaved, 0);
  await s.save();
  assert.deepEqual(events, ["saved:"]);
  model.current["P.md"] = "edited";
  assert.equal(s.unsaved, 1);
  await s.save();
  assert.equal(disk.text("P.md"), "edited");
  assert.deepEqual(events.slice(1), ["change", "saved:P.md"]);
  assert.equal(s.unsaved, 0);
});

test("a save against an external change reports the conflict without writing; overwrite resolves it", async () => {
  const { disk, model, s, events } = await project();
  model.current["P.md"] = "edited";
  disk.change("P.md", "external");
  await s.save();
  assert.equal(disk.text("P.md"), "external");
  assert.deepEqual(events, ["change", "conflict:P.md"]);
  assert.deepEqual(s.conflicts.map(conflict => [conflict.file, conflict.text]), [["P.md", "external"]]);
  await s.save();
  assert.equal(events.at(-1), "blocked");
  assert.equal(await s.overwrite(), true);
  assert.equal(disk.text("P.md"), "edited");
  assert.equal(s.hasConflict, false);
  assert.equal(await s.overwrite(), false);
});

test("a check finds external changes; the same change is reported once and disappears when the disk matches again", async () => {
  const { disk, s, events, clock } = await project();
  disk.change("P.md", "external");
  await s.check();
  await s.check();
  assert.deepEqual(events, ["change", "conflict:P.md"]);
  disk.change("P.md", "local");
  clock.advance(30000);
  await s.check();
  assert.deepEqual(events.slice(2), ["change"]);
  assert.equal(s.hasConflict, false);
});

test("an unchanged stamp skips reading the content until the content check interval passed", async () => {
  const { disk, s, events, clock, adapter } = await project();
  let reads = 0;
  const read = adapter.read;
  adapter.read = name => { reads++; return read(name); };
  await s.check();
  assert.equal(reads, 1, "the opened stamp is trusted only after one content check");
  await s.check();
  assert.equal(reads, 1);
  clock.advance(30000);
  await s.check();
  assert.equal(reads, 2);
  disk.touch("P.md");
  await s.check();
  assert.equal(reads, 3);
  assert.deepEqual(events, [], "a changed stamp with the same content is no conflict");
});

test("a deleted project file is reported once and is no conflict", async () => {
  const { disk, s, events } = await project();
  disk.change("P.md", "external");
  await s.check();
  disk.change("P.md", null);
  await s.check();
  await s.check();
  assert.deepEqual(events, ["change", "conflict:P.md", "change", "checkError:P.md:deleted"]);
  assert.equal(s.hasConflict, false);
});

test("check errors are reported once per message and a successful check resets that", async () => {
  const { disk, s, events } = await project();
  disk.hooks.failRead = new Error("device lost");
  await s.check();
  await s.check();
  disk.hooks.failRead = undefined;
  await s.check();
  disk.hooks.failRead = new Error("device lost");
  await s.check();
  assert.deepEqual(events, ["checkError:P.md:device lost", "checkError:P.md:device lost"]);
});

test("edits during a save stay unsaved and repeated save requests write the latest content once more", async () => {
  const { disk, model, s, events } = await project();
  const held = gate();
  let writes = 0;
  disk.hooks.beforeWrite = () => { writes++; return writes === 1 ? held.promise : undefined; };
  model.current["P.md"] = "first";
  const saving = s.save();
  await flush();
  model.current["P.md"] = "second";
  const again = s.save();
  const third = s.save();
  assert.equal(again, saving);
  assert.equal(third, saving);
  held.release();
  await saving;
  assert.deepEqual([writes, disk.text("P.md"), s.unsaved], [2, "second", 0]);
  assert.deepEqual(events, ["change", "saved:P.md", "change", "saved:P.md"]);
});

test("an edit during a single save stays unsaved", async () => {
  const { disk, model, s } = await project();
  const held = gate();
  disk.hooks.beforeWrite = () => held.promise;
  model.current["P.md"] = "first";
  const saving = s.save();
  await flush();
  model.current["P.md"] = "second";
  held.release();
  await saving;
  assert.deepEqual([disk.text("P.md"), s.unsaved], ["first", 1]);
});

test("an external edit right after the write is found by the verification and can be reloaded", async () => {
  const { disk, model, s, events, adapter } = await project();
  const write = adapter.write;
  adapter.write = async (name, text, expected) => {
    const stamp = await write(name, text, expected);
    disk.change("P.md", "external");
    return stamp;
  };
  model.current["P.md"] = "edited";
  await s.save();
  assert.deepEqual(events, ["change", "conflict:P.md", "change", "saved:P.md"]);
  assert.equal(s.reload(), true);
  assert.deepEqual([model.current["P.md"], s.unsaved, s.hasConflict], ["external", 0, false]);
  assert.equal(s.reload(), false);
});

test("a failed verification after a completed write reports a check error and keeps the write saved", async () => {
  const { disk, model, s, events, adapter } = await project();
  adapter.read = async () => { throw new Error("verification unavailable"); };
  model.current["P.md"] = "edited";
  await s.save();
  assert.equal(disk.text("P.md"), "edited");
  assert.deepEqual(events, ["checkError:P.md:verification unavailable", "change", "saved:P.md"]);
  assert.equal(s.unsaved, 0);
});

test("a failed write rejects the save, stays unsaved and does not block a later save", async () => {
  const { disk, model, s } = await project();
  model.current["P.md"] = "edited";
  disk.hooks.failNextWrite = new Error("disk full");
  await assert.rejects(s.save(), /disk full/);
  assert.equal(s.unsaved, 1);
  await s.save();
  assert.equal(disk.text("P.md"), "edited");
});

for (const outcome of ["release", "reject"]) {
  test(`a check still running when the session is destroyed has no effect (${outcome})`, async () => {
    const { disk, s, events, adapter } = await project();
    disk.change("P.md", "external");
    const held = gate();
    const read = adapter.read;
    adapter.read = async name => { await held.promise; return read(name); };
    const checking = s.check();
    await flush();
    s.destroy();
    if (outcome === "release") held.release();
    else held.reject(new Error("stale check failed"));
    await checking;
    assert.deepEqual(events, []);
    assert.equal(s.hasConflict, false);
    await s.save();
    await s.check();
    assert.equal(s.reload(), false);
  });

  test(`a save still running when the session is destroyed has no effect (${outcome})`, async () => {
    const { disk, model, s, events } = await project();
    const held = gate();
    disk.hooks.beforeWrite = () => held.promise;
    model.current["P.md"] = "edited";
    const saving = s.save();
    await flush();
    s.destroy();
    if (outcome === "release") held.release();
    else held.reject(new Error("held write failed"));
    await saving;
    assert.deepEqual(events, []);
  });

  test(`a verification still running when the session is destroyed has no effect (${outcome})`, async () => {
    const { model, s, events, adapter } = await project();
    const held = gate();
    adapter.read = async () => { await held.promise; return { text: "edited", stamp: "1:6" }; };
    model.current["P.md"] = "edited";
    const saving = s.save();
    await flush();
    s.destroy();
    if (outcome === "release") held.release();
    else held.reject(new Error("verification failed"));
    await saving;
    assert.deepEqual(events, []);
  });
}

test("a check started before a save cannot restore an obsolete conflict", async () => {
  const { disk, model, s, events, adapter } = await project();
  const held = gate();
  const read = adapter.read;
  let holdNext = true;
  adapter.read = async name => {
    const found = await read(name);
    if (!holdNext) return found;
    holdNext = false;
    await held.promise;
    return found;
  };
  model.current["P.md"] = "edited";
  disk.touch("P.md");
  const checking = s.check();
  await flush();
  await s.save();
  held.release();
  await checking;
  assert.deepEqual(events, ["change", "saved:P.md"]);
});

test("a check during a save is skipped", async () => {
  const { disk, model, s, adapter } = await project();
  const held = gate();
  disk.hooks.beforeWrite = () => held.promise;
  let stats = 0;
  adapter.stat = async () => { stats++; return null; };
  model.current["P.md"] = "edited";
  const saving = s.save();
  await flush();
  await s.check();
  held.release();
  await saving;
  assert.equal(stats, 0);
});

test("reload invalidates a check that read the previous version", async () => {
  const { disk, model, s, events, adapter } = await project();
  disk.change("P.md", "external");
  await s.check();
  const held = gate();
  const read = adapter.read;
  adapter.read = async name => { await held.promise; return read(name); };
  disk.touch("P.md");
  const checking = s.check();
  await flush();
  assert.equal(s.reload(), true);
  held.reject(new Error("stale"));
  await checking;
  assert.deepEqual(events, ["change", "conflict:P.md", "change"]);
  assert.equal(model.current["P.md"], "external");
});

test("a reload whose load fails changes nothing", async () => {
  const disk = fakes.fileSystem({ "P.md": "local" });
  const adapter = storage.file(disk.fileHandle("P.md"));
  const model = models({ "P.md": "local" });
  let fail = false;
  const s = session.create({ adapter, files: { "P.md": model.file("P.md", { fail: () => fail }) }, initial: { "P.md": await adapter.read("P.md") } });
  disk.change("P.md", "broken");
  await s.check();
  fail = true;
  assert.throws(() => s.reload(), /invalid format/);
  assert.equal(s.hasConflict, true);
});

test("without read access a session writes unconditionally and never checks", async () => {
  /** @type {string[]} */
  const written = [];
  const adapter = storage.file({ name: "P.md", async createWritable() { return { async write(/** @type {string} */ text) { written.push(text); }, async close() {} }; } });
  const model = models({ "P.md": "local" });
  const s = session.create({ adapter, files: { "P.md": model.file("P.md") }, initial: { "P.md": { text: "local", stamp: "" } } });
  await s.check();
  model.current["P.md"] = "edited";
  await s.save();
  assert.deepEqual(written, ["edited"]);
});

test("listeners can unsubscribe", async () => {
  const { model, s } = await project();
  let calls = 0;
  const off = s.on("saved", () => { calls++; });
  await s.save();
  off();
  model.current["P.md"] = "edited";
  await s.save();
  assert.equal(calls, 1);
});

/** Several files in a folder with a history, as MD_Calendar opens it. */
async function calendarFolder() {
  const disk = fakes.fileSystem({ "Calendar.md": "cal", "Backlog.md": "back", "Holidays.md": "hol" });
  const adapter = storage.folder(/** @type {any} */ (disk.directory), { files: ["Calendar.md", "Backlog.md", "Contacts.md", "Holidays.md"] });
  const model = models({ "Calendar.md": "cal", "Backlog.md": "back", "Contacts.md": null, "Holidays.md": "hol" });
  let undo = historyModule.create();
  /** @type {string[]} */
  let order = ["Calendar.md", "Backlog.md", "Contacts.md"];
  const files = {
    "Calendar.md": model.file("Calendar.md"),
    "Backlog.md": model.file("Backlog.md"),
    "Contacts.md": model.file("Contacts.md"),
    "Holidays.md": model.file("Holidays.md", { writable: false })
  };
  /** @type {Record<string, import("../../src/platform/storage.js").MDLStoredFile | null>} */
  const initial = {};
  for (const name of Object.keys(files)) initial[name] = await adapter.read(name);
  const s = session.create({ adapter, files, initial, history: () => undo, order: () => order, reloadWhenClean: true });
  /** @param {string} name @param {string} text */
  const edit = (name, text) => {
    const before = model.current[name];
    undo.execute({ label: "edit", redo() { model.current[name] = text; }, undo() { model.current[name] = before; } });
  };
  return { disk, adapter, model, s, events: record(s), edit, setOrder: (/** @type {string[]} */ next) => { order = next; }, resetHistory() { undo = historyModule.create(); } };
}

test("read-only files and clean writable files reload automatically; unsaved ones conflict", async () => {
  const { disk, model, s, events, edit } = await calendarFolder();
  disk.change("Holidays.md", "hol2");
  disk.change("Calendar.md", "cal2");
  await s.check();
  assert.deepEqual(events, ["reloaded:Calendar.md", "change", "reloaded:Holidays.md", "change"]);
  assert.deepEqual([model.current["Calendar.md"], model.current["Holidays.md"]], ["cal2", "hol2"]);

  edit("Backlog.md", "back-local");
  disk.change("Backlog.md", "back2");
  disk.change("Holidays.md", null);
  await s.check();
  assert.deepEqual(events.slice(4), ["change", "conflict:Backlog.md", "reloaded:Holidays.md", "change"]);
  assert.equal(model.current["Holidays.md"], "# Holidays.md\n", "a deleted read-only file loads as missing");
});

test("a deleted writable file is a conflict even when nothing is unsaved; reload loads it as missing and save creates it", async () => {
  const { disk, model, s, events, edit } = await calendarFolder();
  disk.change("Calendar.md", null);
  await s.check();
  assert.deepEqual(events, ["change", "conflict:Calendar.md"]);
  assert.deepEqual(s.conflicts, [{ file: "Calendar.md", text: null, stamp: null }]);
  assert.equal(s.reload(), true);
  assert.equal(model.current["Calendar.md"], "# Calendar.md\n");
  edit("Calendar.md", "new");
  await s.save();
  assert.equal(disk.text("Calendar.md"), "new");
});

test("a file created outside while missing is loaded; a missing file that stays missing is ignored", async () => {
  const { disk, model, s, events } = await calendarFolder();
  await s.check();
  assert.deepEqual(events, []);
  disk.change("Contacts.md", "contacts");
  await s.check();
  assert.deepEqual(events, ["reloaded:Contacts.md", "change"]);
  assert.equal(model.current["Contacts.md"], "contacts");
});

test("saving writes changed files in order, creates missing ones and marks the history saved", async () => {
  const { disk, s, events, edit, setOrder, adapter } = await calendarFolder();
  /** @type {string[]} */
  const writes = [];
  const write = adapter.write;
  adapter.write = (name, text, expected) => { writes.push(name); return write(name, text, expected); };
  edit("Calendar.md", "cal2");
  edit("Contacts.md", "contacts");
  edit("Backlog.md", "back2");
  setOrder(["Backlog.md", "Calendar.md", "Contacts.md"]);
  assert.equal(s.unsaved, 3);
  await s.save();
  assert.deepEqual(writes, ["Backlog.md", "Calendar.md", "Contacts.md"]);
  assert.deepEqual([disk.text("Contacts.md"), s.unsaved], ["contacts", 0]);
  assert.deepEqual(events, ["change", "saved:Backlog.md,Calendar.md,Contacts.md"]);
});

test("a conflict in one file keeps the others written and the history unsaved", async () => {
  const { disk, s, events, edit } = await calendarFolder();
  edit("Calendar.md", "cal2");
  edit("Backlog.md", "back2");
  disk.change("Calendar.md", "external");
  await s.save();
  assert.deepEqual([disk.text("Calendar.md"), disk.text("Backlog.md")], ["external", "back2"]);
  assert.deepEqual(events, ["change", "conflict:Calendar.md"]);
  assert.equal(s.unsaved, 2);
  assert.equal(s.reload(), true);
});

test("data that serializes to the saved files again counts as saved", async () => {
  const { s, edit } = await calendarFolder();
  edit("Calendar.md", "cal2");
  edit("Calendar.md", "cal");
  assert.equal(s.unsaved, 0);
});

test("a stamp-only change is no conflict for the next save", async () => {
  const { disk, s, edit, events } = await calendarFolder();
  edit("Calendar.md", "cal2");
  disk.touch("Calendar.md");
  await s.save();
  assert.equal(disk.text("Calendar.md"), "cal2");
  assert.deepEqual(events, ["change", "saved:Calendar.md"]);
});

test("forced saves write only conflicted or changed files", async () => {
  const { disk, s } = await calendarFolder();
  disk.change("Calendar.md", null);
  await s.check();
  assert.equal(await s.overwrite(), true);
  assert.equal(disk.text("Calendar.md"), "cal");
  assert.equal(disk.text("Contacts.md"), null);
});

/** A window with a manual interval, focus, visibility and beforeunload. */
function pageWindow() {
  const target = new EventTarget();
  const documentTarget = Object.assign(new EventTarget(), { hidden: false });
  /** @type {Map<number, () => void>} */
  const timers = new Map();
  let next = 0;
  const window = Object.assign(target, {
    document: documentTarget,
    /** @param {() => void} callback @param {number} ms */
    setInterval(callback, ms) {
      timers.set(++next, callback);
      window.intervals.push(ms);
      return next;
    },
    /** @param {number} id */
    clearInterval(id) { timers.delete(id); },
    /** @type {number[]} */
    intervals: [],
    tick() { for (const callback of [...timers.values()]) callback(); },
    timers
  });
  /** @param {string} type */
  const fire = type => (type === "visibilitychange" ? documentTarget : target).dispatchEvent(new Event(type));
  const leave = () => {
    const event = /** @type {Event & { returnValue?: unknown }} */ (new Event("beforeunload", { cancelable: true }));
    target.dispatchEvent(event);
    return event.defaultPrevented;
  };
  return { window: /** @type {any} */ (window), raw: window, fire, leave };
}

test("with a window, interval, focus and visibility check for external changes while visible and allowed", async () => {
  const disk = fakes.fileSystem({ "P.md": "local" });
  const adapter = storage.file(disk.fileHandle("P.md"));
  const model = models({ "P.md": "local" });
  const page = pageWindow();
  let allowed = true;
  const s = session.create({
    adapter, files: { "P.md": model.file("P.md") }, initial: { "P.md": await adapter.read("P.md") },
    window: page.window, shouldCheck: () => allowed, reloadWhenClean: true
  });
  const events = record(s);
  assert.deepEqual(page.raw.intervals, [2000]);
  disk.change("P.md", "a");
  page.raw.document.hidden = true;
  page.raw.tick();
  page.fire("focus");
  await flush();
  assert.deepEqual(events, [], "hidden pages are not checked");
  page.raw.document.hidden = false;
  allowed = false;
  page.fire("visibilitychange");
  await flush();
  assert.deepEqual(events, [], "shouldCheck can hold the checks");
  allowed = true;
  page.fire("visibilitychange");
  await flush();
  assert.deepEqual(events, ["reloaded:P.md", "change"]);
  disk.change("P.md", "b");
  page.fire("focus");
  await flush();
  disk.change("P.md", "c");
  page.raw.tick();
  await flush();
  assert.equal(model.current["P.md"], "c");
  s.destroy();
  assert.equal(page.raw.timers.size, 0);
  disk.change("P.md", "d");
  page.fire("focus");
  await flush();
  assert.equal(model.current["P.md"], "c");
});

test("confirmLeave asks before leaving while unsaved or in conflict, not after destroy", async () => {
  const disk = fakes.fileSystem({ "P.md": "local" });
  const adapter = storage.file(disk.fileHandle("P.md"));
  const model = models({ "P.md": "local" });
  const page = pageWindow();
  const s = session.create({
    adapter, files: { "P.md": model.file("P.md") }, initial: { "P.md": await adapter.read("P.md") },
    window: page.window, checkInterval: 500, confirmLeave: true
  });
  assert.deepEqual(page.raw.intervals, [500]);
  assert.equal(page.leave(), false);
  model.current["P.md"] = "edited";
  assert.equal(page.leave(), true);
  await s.save();
  assert.equal(page.leave(), false);
  disk.change("P.md", "external");
  await s.check();
  assert.equal(s.hasConflict, true);
  assert.equal(page.leave(), true);
  s.destroy();
  assert.equal(page.leave(), false);

  const quiet = pageWindow();
  const plain = session.create({ adapter, files: { "P.md": models({ "P.md": "x" }).file("P.md") }, initial: {}, window: quiet.window });
  assert.equal(quiet.leave(), false, "without confirmLeave nothing is asked");
  plain.destroy();
});

test("open reads and loads every file, then creates the session; a failing load rejects", async () => {
  const disk = fakes.fileSystem({ "Calendar.md": "cal", "Holidays.md": "hol" });
  const adapter = storage.folder(/** @type {any} */ (disk.directory), { files: ["Calendar.md", "Backlog.md", "Holidays.md"] });
  const model = models({ "Calendar.md": "", "Backlog.md": "", "Holidays.md": "" });
  const files = {
    "Calendar.md": model.file("Calendar.md"),
    "Backlog.md": model.file("Backlog.md"),
    "Holidays.md": model.file("Holidays.md", { writable: false })
  };
  const s = await session.open({ adapter, files });
  assert.deepEqual(model.loads, ["Calendar.md=cal", "Backlog.md=null", "Holidays.md=hol"]);
  assert.equal(s.unsaved, 0);
  disk.change("Calendar.md", "cal2");
  await s.check();
  assert.equal(s.hasConflict, true, "the session knows what was read");

  await assert.rejects(session.open({ adapter, files: { "Calendar.md": model.file("Calendar.md", { fail: () => true }) } }), /invalid format/);
});
