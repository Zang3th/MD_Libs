import assert from "node:assert/strict";
import test from "node:test";
import { tooltips } from "../../src/ui/index.js";
import { createWindow } from "../helpers/dom.js";

/** @param {Partial<import("../../src/ui/tooltips.js").MDLTooltipOptions>} [options] */
function setup(options = {}) {
  const window = createWindow('<button id="save" data-tooltip="Save">S</button><button id="plain">P</button><span id="empty" data-tooltip=""></span><div id="tip" hidden></div>');
  const element = /** @type {HTMLElement} */ (window.document.getElementById("tip"));
  const tips = tooltips.create({ window, element, delay: 0, ...options });
  /** @param {string} id */
  const byId = id => /** @type {HTMLElement} */ (window.document.getElementById(id));
  /** @param {string} type @param {Element} target @param {object} [init] */
  const fire = (type, target, init = {}) => target.dispatchEvent(new window.PointerEvent(type, { bubbles: true, ...init }));
  const frames = () => new Promise(resolve => window.setTimeout(() => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)), 0));
  return { window, element, tips, byId, fire, frames };
}

test("hover shows the text of the target and leaving hides it", async () => {
  const { element, byId, fire, frames, window } = setup();
  fire("pointerover", byId("save"));
  await frames();
  assert.deepEqual([element.hidden, element.textContent, byId("save").getAttribute("aria-describedby")], [false, "Save", "tip"]);
  assert.match(element.style.left, /px$/);
  fire("pointerover", byId("save"));
  fire("pointerout", byId("save"), { relatedTarget: byId("save") });
  assert.equal(element.hidden, false, "moving inside the target keeps it");
  fire("pointerout", byId("save"), { relatedTarget: window.document.body });
  assert.deepEqual([element.hidden, byId("save").hasAttribute("aria-describedby")], [true, false]);
  fire("pointerover", byId("plain"));
  fire("pointerout", byId("plain"));
  assert.equal(element.hidden, true);
});

test("pressing, scrolling and resizing hide the tooltip before it shows", async () => {
  const { element, byId, fire, frames, window } = setup();
  for (const hide of [() => fire("pointerdown", byId("save")), () => window.dispatchEvent(new window.Event("resize")), () => window.document.dispatchEvent(new window.Event("scroll"))]) {
    fire("pointerover", byId("save"));
    hide();
    await frames();
    assert.equal(element.hidden, true);
  }
  fire("pointerover", byId("save"));
  await new Promise(resolve => window.setTimeout(resolve, 0));
  element.hidden = true;
  await frames();
  assert.equal(element.style.left, "", "a tooltip hidden before its frame is not positioned");
});

test("focus shows at once and blur hides; options limit touch and focus and skip empty texts", async () => {
  const plain = setup();
  plain.byId("save").focus();
  await plain.frames();
  assert.equal(plain.element.hidden, false);
  plain.byId("save").blur();
  assert.equal(plain.element.hidden, true);
  plain.fire("pointerover", plain.byId("empty"));
  await plain.frames();
  assert.deepEqual([plain.element.hidden, plain.element.textContent], [false, ""], "an empty tooltip shows by default");
  plain.tips.destroy();
  plain.fire("pointerover", plain.byId("save"));
  await plain.frames();
  assert.equal(plain.element.hidden, true, "destroyed tooltips stay hidden");

  const limited = setup({ touch: false, focusVisibleOnly: true, hideEmpty: true });
  limited.fire("pointerover", limited.byId("save"), { pointerType: "touch" });
  await limited.frames();
  assert.equal(limited.element.hidden, true);
  limited.byId("save").matches = () => false;
  limited.byId("save").focus();
  await limited.frames();
  assert.equal(limited.element.hidden, true, "focus that is not visible shows nothing");
  limited.fire("pointerover", limited.byId("empty"));
  await limited.frames();
  assert.equal(limited.element.hidden, true);
  limited.window.document.body.dispatchEvent(new limited.window.FocusEvent("focusin", { bubbles: true }));
});
