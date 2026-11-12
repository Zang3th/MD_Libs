import assert from "node:assert/strict";
import test from "node:test";
import { keymap } from "../../src/ui/index.js";
import { createWindow } from "../helpers/dom.js";

/** @param {string} key @param {Partial<{ ctrlKey: boolean, metaKey: boolean, altKey: boolean, shiftKey: boolean }>} [modifiers] */
const press = (key, modifiers = {}) => ({ key, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...modifiers });

test("combinations name the key and exactly the modifiers that must be pressed", () => {
  assert.equal(keymap.matches(press("s", { ctrlKey: true }), "mod+s"), true);
  assert.equal(keymap.matches(press("S", { metaKey: true }), "mod+s"), true);
  assert.equal(keymap.matches(press("s", { ctrlKey: true, shiftKey: true }), "mod+s"), false);
  assert.equal(keymap.matches(press("s", { ctrlKey: true, altKey: true }), "mod+s"), false);
  assert.equal(keymap.matches(press("s"), "mod+s"), false);
  assert.equal(keymap.matches(press("z", { metaKey: true, shiftKey: true }), "mod+shift+z"), true);
  assert.equal(keymap.matches(press("y", { ctrlKey: true }), "ctrl+y"), true);
  assert.equal(keymap.matches(press("y", { metaKey: true }), "ctrl+y"), false);
  assert.equal(keymap.matches(press("y", { ctrlKey: true, metaKey: true }), "ctrl+y"), false);
  assert.equal(keymap.matches(press("a"), "a"), true);
  assert.equal(keymap.matches(press("A", { shiftKey: true }), "a"), false);
  assert.equal(keymap.matches(press("A", { shiftKey: true }), "shift?+a"), true);
  assert.equal(keymap.matches(press("a", { ctrlKey: true }), "shift?+a"), false);
  assert.equal(keymap.matches(press(" "), "space"), true);
  assert.equal(keymap.matches(press("Escape", { ctrlKey: true, altKey: true }), "any+escape"), true);
  assert.equal(keymap.matches(press("v", { ctrlKey: true }), "mod?+v"), true);
  assert.equal(keymap.matches(press("v"), "mod?+v"), true);
  assert.equal(keymap.matches(press("x", { altKey: true, ctrlKey: true }), "alt+ctrl?+x"), true);
  assert.equal(keymap.matches(press("x", { altKey: true, metaKey: true }), keymap.parse("alt+meta?+x")), true);
  assert.throws(() => keymap.parse("hyper+x"), /Unknown modifier "hyper"/);
});

test("editable targets are text controls, optionally not inside a closed dialog", () => {
  const window = createWindow('<input id="field"><select id="choice"></select><div id="text" contenteditable="true"></div><div id="off" contenteditable="false"></div><dialog><input id="stale"></dialog><button id="button"></button>');
  /** @param {string} id */
  const byId = id => window.document.getElementById(id);
  assert.deepEqual(["field", "choice", "text", "off", "stale", "button"].map(id => keymap.isEditable(byId(id))), [true, true, true, false, true, false]);
  assert.equal(keymap.isEditable(byId("stale"), { ignoreClosedDialogs: true }), false);
  assert.equal(keymap.isEditable(byId("choice"), { selector: "input, textarea" }), false);
  assert.equal(keymap.isEditable(window.document), false);
  assert.equal(keymap.isEditable(null), false);
});

test("every matching binding acts in order; conditions, editing, repeats and declined handlers are respected", () => {
  const window = createWindow('<input id="field"><button id="button"></button>');
  /** @type {string[]} */
  const log = [];
  let allowed = true;
  const keys = keymap.create({ target: window.document, guard: () => allowed });
  keys.bind("any+escape", () => { log.push("close menus"); }, { prevent: false });
  keys.bind("any+escape", () => { log.push("close help"); }, { prevent: false });
  keys.bind("mod+s", () => { log.push("save"); }, { inEditable: true });
  keys.bind("shift?+a", () => { log.push("archive"); }, { repeat: false });
  keys.bind("mod+c", () => false);
  const unbind = keys.bind(["mod+shift+z", "ctrl+y"], () => { log.push("redo"); }, { when: () => log.length < 100 });

  /** @param {string} id @param {string} key @param {object} [init] */
  const fire = (id, key, init = {}) => {
    const event = new window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init });
    /** @type {HTMLElement} */ (window.document.getElementById(id)).dispatchEvent(event);
    return event.defaultPrevented;
  };
  assert.equal(fire("button", "Escape"), false);
  assert.equal(fire("field", "s", { ctrlKey: true }), true);
  assert.equal(fire("field", "a"), false, "letters do not act while text is edited");
  assert.equal(fire("button", "A", { shiftKey: true }), true);
  assert.equal(fire("button", "a", { repeat: true }), false);
  assert.equal(fire("button", "c", { ctrlKey: true }), false, "a declined handler keeps the default action");
  assert.equal(fire("button", "y", { ctrlKey: true }), true);
  unbind();
  unbind();
  assert.equal(fire("button", "y", { ctrlKey: true }), false);
  allowed = false;
  assert.equal(fire("button", "s", { ctrlKey: true }), false);
  allowed = true;
  keys.destroy();
  assert.equal(fire("button", "s", { ctrlKey: true }), false);
  assert.deepEqual(log, ["close menus", "close help", "save", "archive", "redo"]);
});
