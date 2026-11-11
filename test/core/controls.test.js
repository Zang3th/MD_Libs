import assert from "node:assert/strict";
import test from "node:test";
import { controls, history } from "../../src/core/index.js";

/** @type {import("../../src/core/controls.js").MDLControlStrings} */
const strings = {
  undo: label => label ? `Undo: ${label}` : "Undo",
  redo: label => label ? `Redo: ${label}` : "Redo",
  save: (status, count) => `${status} ${count}`
};

test("without a history every control is disabled and saved", () => {
  assert.deepEqual(controls.state({ history: null, unsaved: 3 }, strings), {
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
  const state = controls.state({ history: h, unsaved: 1 }, strings);
  assert.deepEqual([state.undo, state.redo, state.save], [
    { disabled: false, label: "Undo: Move" },
    { disabled: false, label: "Redo: Delete" },
    { status: "unsaved", count: 1, label: "unsaved 1" }
  ]);
  assert.equal(controls.state({ history: h, unsaved: 0, conflict: true }, strings).save.status, "conflict");
  assert.equal(controls.state({ history: h, unsaved: 0 }, strings).save.status, "saved");
});
