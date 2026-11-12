import assert from "node:assert/strict";
import test from "node:test";
import { popover } from "../../src/ui/index.js";
import { createWindow } from "../helpers/dom.js";

const screen = popover.viewport({ innerWidth: 300, innerHeight: 200 });
const size = { width: 60, height: 20 };

test("below: centered, inside the bounds, above the anchor when there is no room", () => {
  const options = /** @type {const} */ ({ align: "center", gap: 8, flip: true, margin: 8 });
  assert.deepEqual(popover.place({ left: 100, right: 140, top: 50, bottom: 70 }, size, screen, options), { left: 90, top: 78 });
  assert.deepEqual(popover.place({ left: 0, right: 20, top: 50, bottom: 70 }, size, screen, options), { left: 8, top: 78 });
  assert.deepEqual(popover.place({ left: 280, right: 300, top: 170, bottom: 190 }, size, screen, options), { left: 232, top: 142 });
  assert.deepEqual(popover.place({ left: 100, right: 120, top: 2, bottom: 195 }, size, screen, options), { left: 80, top: 8 });
  assert.deepEqual(popover.place({ left: 100, right: 160, top: 50, bottom: 70 }, size, screen, { align: "end" }), { left: 100, top: 70 });
});

test("right: beside the anchor, on the left when there is no room, clamped per edge", () => {
  const anchor = { left: 200, right: 250, top: 150, bottom: 170 };
  assert.deepEqual(popover.place(anchor, size, screen, { side: "right", gap: 10, flip: true, margin: 12 }), { left: 130, top: 150 });
  assert.deepEqual(popover.place(anchor, size, screen, { side: "right", gap: 10, margin: 12 }), { left: 228, top: 150 });
  assert.deepEqual(popover.place(anchor, { width: 60, height: 80 }, screen, { side: "right", margin: { top: 40, bottom: 12 } }), { left: 240, top: 108 });
  assert.deepEqual(popover.place({ left: 10, right: 30, top: 10, bottom: 50 }, size, screen, { side: "right", align: "center" }), { left: 30, top: 20 });
  assert.deepEqual(popover.place({ left: 10, right: 30, top: 10, bottom: 50 }, size, screen, { side: "right", align: "end" }), { left: 30, top: 30 });
});

test("a point anchor places the corner at the point; an oversized element keeps its top-left edge", () => {
  assert.deepEqual(popover.place(popover.point(290, 195), size, screen, { margin: 8 }), { left: 232, top: 172 });
  assert.deepEqual(popover.place(popover.point(5, 5), { width: 500, height: 500 }, screen, { margin: 8 }), { left: 8, top: 8 });
});

/** @param {Partial<import("../../src/ui/popover.js").MDLPopoverOptions>} [options] */
function setup(options = {}) {
  const window = createWindow('<div id="menu"><button id="toggle">T</button><div id="panel" hidden><button id="item">I</button></div></div><button id="other">O</button>');
  /** @param {string} id */
  const byId = id => /** @type {HTMLElement} */ (window.document.getElementById(id));
  /** @type {string[]} */
  const closed = [];
  const menu = popover.create({ window, element: byId("panel"), button: byId("toggle"), onClose: reason => closed.push(reason), ...options });
  /** @param {string} type @param {Element} target */
  const fire = (type, target) => target.dispatchEvent(new window.MouseEvent(type, { bubbles: true }));
  /** @param {string} key */
  const key = key => window.document.body.dispatchEvent(new window.KeyboardEvent("keydown", { key, bubbles: true }));
  return { window, byId, menu, closed, fire, key };
}

test("create: open, toggle and close keep hidden and aria-expanded in step", () => {
  const { byId, menu, closed } = setup();
  menu.open();
  assert.equal(byId("panel").hidden, false);
  assert.equal(byId("toggle").getAttribute("aria-expanded"), "true");
  assert.equal(menu.isOpen, true);
  assert.equal(menu.toggle(), false);
  assert.equal(byId("toggle").getAttribute("aria-expanded"), "false");
  assert.equal(menu.toggle(), true);
  menu.close();
  menu.close();
  assert.deepEqual(closed, ["toggle", "close"]);
});

test("create: an outside click and Escape close it; clicks inside do not", () => {
  const { byId, menu, closed, fire, key } = setup();
  menu.open();
  fire("click", byId("item"));
  fire("click", byId("toggle"));
  assert.equal(menu.isOpen, true);
  fire("click", byId("other"));
  assert.equal(menu.isOpen, false);
  menu.open();
  key("a");
  assert.equal(menu.isOpen, true);
  key("Escape");
  assert.deepEqual(closed, ["outside", "escape"]);
});

test("create: inside elements, pointerdown, no Escape, destroy", () => {
  const { byId, menu, closed, fire, key, window } = setup({ inside: [], dismiss: "pointerdown", escape: false });
  const extra = popover.create({ window, element: byId("panel"), inside: [byId("menu")] });
  menu.open();
  fire("click", byId("other"));
  key("Escape");
  assert.equal(menu.isOpen, false, "the second popover closes on Escape");
  assert.deepEqual(closed, []);
  extra.destroy();
  menu.open();
  fire("pointerdown", byId("item"));
  assert.equal(menu.isOpen, true);
  fire("pointerdown", byId("other"));
  assert.deepEqual(closed, ["outside"]);
  menu.open();
  menu.destroy();
  fire("pointerdown", byId("other"));
  key("Escape");
  assert.equal(menu.isOpen, true);
});
