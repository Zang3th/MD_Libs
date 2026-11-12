import assert from "node:assert/strict";
import test from "node:test";
import { history } from "../../src/core/index.js";

/** @param {number[]} log @param {number} value @param {number} [size] */
function push(log, value, size) {
  return { label: `#${value}`, size, redo() { log.push(value); }, undo() { log.splice(log.lastIndexOf(value), 1); } };
}

test("undo and redo replay actions in both directions with labels and view states", () => {
  /** @type {number[]} */
  const log = [];
  const h = history.create();
  assert.equal(h.execute({ ...push(log, 1), beforeViewState: "a", afterViewState: "b" }), true);
  assert.deepEqual([h.canUndo, h.canRedo, h.undoLabel, h.redoLabel], [true, false, "#1", ""]);

  const undone = h.undo();
  assert.deepEqual([undone?.label, undone?.viewState, log], ["#1", "a", []]);
  assert.equal(h.undo(), null);
  assert.deepEqual([h.canUndo, h.canRedo, h.redoLabel], [false, true, "#1"]);

  const redone = h.redo();
  assert.deepEqual([redone?.label, redone?.viewState, redone?.action.afterViewState, log], ["#1", "b", "b", [1]]);
  assert.equal(h.redo(), null);
});

test("a no-op keeps the redo branch; a real action discards it", () => {
  /** @type {number[]} */
  const log = [];
  const h = history.create();
  h.execute(push(log, 1));
  h.undo();
  assert.equal(h.execute({ label: "No-op", redo: () => false, undo() {} }), false);
  assert.equal(h.canRedo, true);
  h.execute(push(log, 2));
  assert.deepEqual([h.canRedo, h.undoLabel, log], [false, "#2", [2]]);
});

test("a failing action is rolled back, rethrown and not recorded", () => {
  let value = 0;
  const h = history.create();
  assert.throws(() => h.execute({ label: "Broken", redo() { value = 1; throw new Error("broken"); }, undo() { value = 0; } }), /broken/);
  assert.throws(() => h.execute({ label: "Broken twice", redo() { throw new Error("first"); }, undo() { throw new Error("second"); } }), /first/);
  assert.deepEqual([value, h.canUndo], [0, false]);
});

test("the history is bounded by entry count and by bytes, oldest first", () => {
  /** @type {number[]} */
  const log = [];
  const h = history.create({ maxEntries: 100 });
  for (let value = 1; value <= 120; value += 1) h.execute(push(log, value, 1));
  let undos = 0;
  while (h.undo()) undos += 1;
  assert.deepEqual([undos, log.length], [100, 20]);

  const small = history.create({ maxBytes: 10 });
  small.execute(push(log, 1, 6));
  small.execute(push(log, 2, 6));
  assert.equal(small.undoLabel, "#2");
  small.undo();
  assert.equal(small.canUndo, false, "#1 was dropped to stay within maxBytes");
  small.execute(push(log, 3, 50));
  assert.equal(small.undoLabel, "#3", "the newest entry is kept even when it alone exceeds the limit");
});

test("commit records an applied action; clear forgets every entry", () => {
  const h = history.create();
  let value = 1;
  h.commit({ label: "Set", redo() { value = 1; }, undo() { value = 0; } });
  h.undo();
  assert.equal(value, 0);
  h.redo();
  h.clear();
  assert.deepEqual([h.canUndo, h.canRedo, value], [false, false, 1]);
});

test("replaceCurrent coalesces into the newest entry and keeps its undo and before state", () => {
  let value = "";
  const h = history.create({ maxBytes: 10 });
  h.replaceCurrent({ label: "Ignored", redo() {}, undo() {} });
  assert.equal(h.canUndo, false);
  h.commit({ label: "Type", beforeViewState: "before", redo() { value = "a"; }, undo() { value = ""; }, size: 1 });
  value = "ab";
  h.replaceCurrent({ label: "Type more", afterViewState: "after", redo() { value = "ab"; }, undo() {}, size: 2 });
  assert.equal(h.undoLabel, "Type more");
  const step = h.undo();
  assert.deepEqual([step?.label, step?.viewState, value], ["Type more", "before", ""]);
  assert.equal(h.redo()?.viewState, "after");
  assert.equal(value, "ab");

  h.undo();
  h.replaceCurrent({ label: "Not current", redo() {}, undo() {} });
  assert.equal(h.redoLabel, "Type more", "only the newest entry can be replaced");
});

test("the unsaved count is the distance to the saved state across branches and trimming", () => {
  /** @type {number[]} */
  const log = [];
  const h = history.create({ maxEntries: 100 });
  h.execute(push(log, 1));
  h.execute(push(log, 2));
  h.markSaved();
  assert.equal(h.unsaved, 0);
  h.undo();
  h.undo();
  assert.equal(h.unsaved, 2);
  h.redo();
  h.execute(push(log, 3));
  assert.equal(h.unsaved, 2, "undoing #3 and redoing the discarded #2 would reach the saved state");
  h.undo();
  assert.equal(h.unsaved, 1);

  const saved = h.position;
  h.execute(push(log, 4));
  h.markSaved(saved);
  assert.equal(h.unsaved, 1, "markSaved accepts the position a save started at");

  const trimmed = history.create({ maxEntries: 100 });
  for (let value = 0; value < 120; value += 1) trimmed.execute(push(log, value));
  assert.equal(trimmed.unsaved, 120);
});

test("replacing the saved entry leaves the saved state on a branch", () => {
  const h = history.create();
  h.commit({ label: "Type", redo() {}, undo() {} });
  h.markSaved();
  h.replaceCurrent({ label: "Type more", redo() {}, undo() {} });
  assert.equal(h.unsaved, 2);
  h.undo();
  assert.equal(h.unsaved, 1);
});

/** @type {import("../../src/core/history.js").MDLControlStrings} */
const strings = {
  undo: label => label ? `Undo: ${label}` : "Undo",
  redo: label => label ? `Redo: ${label}` : "Redo",
  save: (status, count) => `${status} ${count}`
};

test("without a history every control is disabled and saved", () => {
  assert.deepEqual(history.controls({ history: null, unsaved: 3, strings }), {
    undo: { disabled: true, label: "Undo" },
    redo: { disabled: true, label: "Redo" },
    save: { status: "saved", count: 0, label: "saved 0" }
  });
});

test("undo and redo follow the history; the save status follows unsaved changes and conflicts", () => {
  const h = history.create();
  h.commit({ label: "Move", redo() {}, undo() {} });
  h.commit({ label: "Delete", redo() {}, undo() {} });
  h.undo();
  const state = history.controls({ history: h, unsaved: 1, strings });
  assert.deepEqual([state.undo, state.redo, state.save], [
    { disabled: false, label: "Undo: Move" },
    { disabled: false, label: "Redo: Delete" },
    { status: "unsaved", count: 1, label: "unsaved 1" }
  ]);
  assert.equal(history.controls({ history: h, unsaved: 0, conflict: true, strings }).save.status, "conflict");
  assert.equal(history.controls({ history: h, unsaved: 0, strings }).save.status, "saved");
});
