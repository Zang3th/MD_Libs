import assert from "node:assert/strict";
import test from "node:test";
import { linkfield } from "../../src/ui/index.js";
import { createWindow, size } from "../helpers/dom.js";

/** @param {any} window */
const frames = window => new Promise(resolve => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)));

test("the mirror repeats the field's text with its links marked; scrollbar and scrolling are followed once per frame", async () => {
  const window = createWindow("<div></div><textarea></textarea>");
  const mirror = window.document.querySelector("div");
  const field = window.document.querySelector("textarea");
  field.value = "See <www.e.de>.\n";
  size(field, { offsetWidth: 120, clientWidth: 108 });
  linkfield.attach({ window, field, mirror, linkClass: "link" });
  assert.equal(mirror.innerHTML, "See &lt;<span class=\"link\">www.e.de</span>&gt;.\n ");
  assert.equal(mirror.style.right, "");
  await frames(window);
  assert.equal(mirror.style.right, "12px");

  field.value = "a [b](https://x.de)";
  field.dispatchEvent(new window.Event("input"));
  assert.equal(mirror.innerHTML, "a <span class=\"link\">[b](https://x.de)</span>");

  size(field, { scrollTop: 30 });
  field.dispatchEvent(new window.Event("scroll"));
  await frames(window);
  assert.equal(mirror.scrollTop, 30);
});

test("the view shows links as anchors, a Markdown link by its label; a click on its text edits at that place", () => {
  const window = createWindow("<div></div><textarea></textarea><p></p>");
  const [mirror, view] = [window.document.querySelector("div"), window.document.querySelector("p")];
  const field = window.document.querySelector("textarea");
  field.value = "See [docs](https://e.de) and\nwww.x.de";
  window.document.body.focus();
  linkfield.attach({ window, field, mirror, linkClass: "mark", view, viewLinkClass: "link" });
  assert.equal(view.innerHTML, "See <a class=\"link\" href=\"https://e.de\" target=\"_blank\" rel=\"noopener noreferrer\" tabindex=\"-1\">docs</a> and\n" +
    "<a class=\"link\" href=\"https://www.x.de\" target=\"_blank\" rel=\"noopener noreferrer\" tabindex=\"-1\">www.x.de</a>");

  /** @type {{ offsetNode: Node, offset: number } | null} */
  let caret = null;
  window.document.caretPositionFromPoint = () => caret;
  const click = (/** @type {Element} */ target) => target.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  // A link opens by itself and leaves the field alone; a press on it takes no focus.
  const press = (/** @type {Element} */ target) => target.dispatchEvent(new window.MouseEvent("mousedown", { bubbles: true, cancelable: true }));
  assert.equal(press(view.querySelector("a")), false);
  assert.equal(press(view), true);
  click(view.querySelector("a"));
  assert.notEqual(window.document.activeElement, field);
  // After the label, the caret lands after the whole Markdown link; inside it, at its place in the label.
  caret = { offsetNode: view.childNodes[2], offset: 4 };
  click(view);
  assert.equal(window.document.activeElement, field);
  assert.equal(field.selectionStart, 28);
  caret = { offsetNode: view.querySelector("a").firstChild, offset: 2 };
  click(view);
  assert.equal(field.selectionStart, 7);
  // Without a place on the text, at the end.
  caret = null;
  click(view);
  assert.equal(field.selectionStart, field.value.length);
  caret = { offsetNode: mirror, offset: 0 };
  field.setSelectionRange(0, 0);
  click(view);
  assert.equal(field.selectionStart, field.value.length);

  // A dragged selection stays a selection.
  window.getSelection().selectAllChildren(view);
  field.setSelectionRange(0, 0);
  click(view);
  assert.equal(field.selectionStart, 0);

  // Leaving the field shows the text again; a blank text shows nothing.
  field.value = " \n";
  field.dispatchEvent(new window.Event("blur"));
  assert.equal(view.innerHTML, "");
});
