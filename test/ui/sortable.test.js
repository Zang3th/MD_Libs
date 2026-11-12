import assert from "node:assert/strict";
import test from "node:test";
import { sortable } from "../../src/ui/index.js";
import { createWindow } from "../helpers/dom.js";

/** @param {boolean} reduced */
function fakeWindow(reduced) {
  return /** @type {any} */ ({ matchMedia: (/** @type {string} */ query) => ({ matches: reduced && query === "(prefers-reduced-motion: reduce)" }) });
}

test("lists get the shared defaults, which their own options override", () => {
  /** @type {Array<[unknown, Record<string, unknown>]>} */
  const created = [];
  const Sortable = { create: (/** @type {HTMLElement} */ element, /** @type {Record<string, unknown>} */ options) => { created.push([element, options]); return { destroy() {} }; } };
  const element = /** @type {HTMLElement} */ (/** @type {unknown} */ ({}));
  sortable.create({ Sortable, window: fakeWindow(false), element, options: { group: "tasks", ghostClass: "ev--ghost" } });
  sortable.create({ Sortable, window: fakeWindow(true), element });
  assert.deepEqual(created[0], [element, {
    animation: 150, easing: "cubic-bezier(.2,0,0,1)", preventOnFilter: false,
    ghostClass: "ev--ghost", chosenClass: "sortable-chosen", dragClass: "sortable-drag", group: "tasks"
  }]);
  assert.equal(created[1][1].animation, 0, "reduced motion turns the animation off");
});

test("the drop index follows the new neighbours and accounts for the removed item", () => {
  assert.equal(sortable.dropIndex({ fromIndex: 0, next: 3, previous: 2, fallback: 0, sameList: true }), 2, "moving down within a list");
  assert.equal(sortable.dropIndex({ fromIndex: 3, next: 1, previous: 0, fallback: 0, sameList: true }), 1, "moving up within a list");
  assert.equal(sortable.dropIndex({ fromIndex: 0, next: null, previous: 4, fallback: 0, sameList: true }), 4, "moving to the end");
  assert.equal(sortable.dropIndex({ fromIndex: 0, next: 2, previous: 1, fallback: 0, sameList: false }), 2, "into another list nothing shifts");
  assert.equal(sortable.dropIndex({ fromIndex: 5, next: null, previous: null, fallback: 3, sameList: false }), 3, "into an empty list");
});

test("the position counts only the siblings that count", () => {
  const window = createWindow('<ul><li class="ev"></li><li class="fixed"></li><li class="ev"></li><li id="item" class="ev"></li></ul>');
  const item = /** @type {Element} */ (window.document.getElementById("item"));
  assert.equal(sortable.position(item, sibling => sibling.classList.contains("ev")), 2);
  assert.equal(sortable.position(/** @type {Element} */ (window.document.querySelector("li")), () => true), 0);
});
