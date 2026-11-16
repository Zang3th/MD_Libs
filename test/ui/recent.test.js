import assert from "node:assert/strict";
import test from "node:test";
import { recent } from "../../src/ui/index.js";
import { createWindow } from "../helpers/dom.js";

const options = {
  format: (/** @type {number} */ time) => `t${time}`,
  icon: (/** @type {string} */ name) => `<svg class="${name}"></svg>`,
  strings: { empty: "No recent folders", remove: (/** @type {string} */ name) => `Remove ${name}` }
};

test("rows show icon, name and time and carry the ids for opening and removing", () => {
  const window = createWindow('<ul id="list"><li>old</li></ul>');
  const list = window.document.getElementById("list");
  recent.render({ ...options, list, items: [{ id: "a", name: "Work", openedAt: 0 }, { id: "b", name: "<Private>", openedAt: 60000 }] });
  assert.equal(list.querySelectorAll(".recent-item").length, 2);
  assert.equal(list.querySelector(".recent-open").dataset.recent, "a");
  assert.deepEqual([...list.querySelectorAll(".recent-name")].map(name => name.textContent), ["Work", "<Private>"]);
  const time = list.querySelectorAll(".recent-time")[1];
  assert.deepEqual([time.textContent, time.getAttribute("datetime")], ["t60000", "1970-01-01T00:01:00.000Z"]);
  assert.equal(list.querySelector(".recent-icon svg").getAttribute("class"), "item");
  const remove = list.querySelectorAll(".recent-remove")[1];
  assert.deepEqual([remove.dataset.forget, remove.getAttribute("aria-label"), remove.querySelector("svg").getAttribute("class")], ["b", "Remove <Private>", "remove"]);
});

test("an empty list says so", () => {
  const window = createWindow('<ul id="list"></ul>');
  const list = window.document.getElementById("list");
  recent.render({ ...options, list, items: [] });
  assert.equal(list.textContent, "No recent folders");
  assert.equal(list.querySelector(".recent-empty").tagName, "LI");
});
