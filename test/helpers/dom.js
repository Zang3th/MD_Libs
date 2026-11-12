import { Window } from "happy-dom";

/**
 * A DOM in Node.js for testing the browser glue of ui modules. Layout is not computed:
 * sizes are 0 unless a test defines them.
 * @param {string} [html]
 */
export function createWindow(html = "") {
  const window = new Window({ url: "file:///app.html" });
  window.document.body.innerHTML = html;
  return /** @type {any} */ (window);
}

/**
 * Gives an element fixed layout sizes.
 * @param {Element} element @param {Record<string, number>} sizes e.g. `{ offsetHeight: 40 }`
 */
export function size(element, sizes) {
  for (const [name, value] of Object.entries(sizes)) Object.defineProperty(element, name, { configurable: true, value });
}
