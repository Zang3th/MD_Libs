import assert from "node:assert/strict";
import test from "node:test";
import { modal } from "../../src/ui/index.js";
import { createWindow } from "../helpers/dom.js";

/** @param {any} window @param {Element} target @param {string} type */
const press = (window, target, type) => target.dispatchEvent(new window.Event(type, { bubbles: true }));

test("a press on the backdrop closes the dialog; a press inside does not", () => {
  const window = createWindow("<dialog><p>Text</p></dialog>");
  const dialog = window.document.querySelector("dialog");
  let closed = 0;
  const backdrop = modal.closeOnBackdrop({ dialog, close: () => { closed += 1; } });
  press(window, dialog.querySelector("p"), "pointerdown");
  assert.equal(closed, 0);
  press(window, dialog, "click");
  assert.equal(closed, 0, "only the chosen event counts");
  press(window, dialog, "pointerdown");
  assert.equal(closed, 1);
  backdrop.destroy();
  press(window, dialog, "pointerdown");
  assert.equal(closed, 1);
});

test("the event is chosen, and `when` keeps the dialog open while it says no", () => {
  const window = createWindow("<dialog></dialog>");
  const dialog = window.document.querySelector("dialog");
  let closed = 0;
  let allowed = false;
  const backdrop = modal.closeOnBackdrop({ dialog, close: () => { closed += 1; }, dismiss: "click", when: () => allowed });
  press(window, dialog, "click");
  assert.equal(closed, 0);
  allowed = true;
  press(window, dialog, "pointerdown");
  press(window, dialog, "click");
  assert.equal(closed, 1);
  backdrop.destroy();
});
