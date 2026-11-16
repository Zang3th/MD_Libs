/**
 * @typedef {object} MDLRecentItem
 * @property {string} id
 * @property {string} name
 * @property {number} openedAt Milliseconds since the epoch.
 */

/**
 * @typedef {object} MDLRecentOptions
 * @property {HTMLElement} list The `<ul>` that receives the rows.
 * @property {MDLRecentItem[]} items Most recently opened first.
 * @property {(openedAt: number) => string} format Text of the time, e.g. `16.11.2026 09:30`.
 * @property {(name: string) => string} icon Markup of an icon: `item`, `remove`.
 * @property {{ empty: string, remove(name: string): string }} strings Text of the empty list; accessible name of a remove button.
 */

/**
 * Renders a list of recently opened documents or folders, as on a start page. Each row is a button with icon, name
 * and time (`data-recent` = id) and a remove button (`data-forget` = id); the app handles their clicks.
 * Classes: `recent-item`, `recent-open`, `recent-icon`, `recent-name`, `recent-time`, `recent-remove`, `recent-empty`.
 * @param {MDLRecentOptions} options
 */
export function render({ list, items, format, icon, strings }) {
  const document = list.ownerDocument;
  /** @param {string} tag @param {string} className */
  function element(tag, className) {
    const created = document.createElement(tag);
    created.className = className;
    return created;
  }
  /** @param {MDLRecentItem} item */
  function row(item) {
    const open = /** @type {HTMLButtonElement} */ (element("button", "recent-open"));
    open.type = "button";
    open.dataset.recent = item.id;
    const symbol = element("span", "recent-icon");
    symbol.innerHTML = icon("item");
    const name = element("span", "recent-name");
    name.textContent = item.name;
    const time = /** @type {HTMLTimeElement} */ (element("time", "recent-time"));
    time.dateTime = new Date(item.openedAt).toISOString();
    time.textContent = format(item.openedAt);
    open.append(symbol, name, time);
    const remove = /** @type {HTMLButtonElement} */ (element("button", "recent-remove"));
    remove.type = "button";
    remove.dataset.forget = item.id;
    remove.setAttribute("aria-label", strings.remove(item.name));
    remove.innerHTML = icon("remove");
    const entry = element("li", "recent-item");
    entry.append(open, remove);
    return entry;
  }
  const rows = items.map(row);
  if (!items.length) {
    const empty = element("li", "recent-empty");
    empty.textContent = strings.empty;
    rows.push(empty);
  }
  list.replaceChildren(...rows);
}
