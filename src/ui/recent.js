/**
 * @typedef {object} MDLRecentItem
 * @property {string} id
 * @property {string} name
 * @property {number} openedAt Milliseconds since the epoch.
 * @property {string} [detail] A second, smaller line below the name, e.g. a path or a summary.
 */

/**
 * @typedef {object} MDLRecentOptions
 * @property {HTMLElement} list The `<ul>` that receives the rows.
 * @property {MDLRecentItem[]} items Most recently opened first.
 * @property {(openedAt: number) => string | { date: string, time: string }} format Text of the time; with `date` and
 *   `time` both are shown as separate lines, e.g. `Today` above `09:30`.
 * @property {(name: string) => string} icon Markup of an icon: `item`, `remove`.
 * @property {{ empty: string, remove(name: string): string }} strings Text of the empty list; accessible name of a remove button.
 */

/**
 * Renders a list of recently opened documents or folders, as on a start page. Each row is a button with icon, name,
 * optional detail line and time (`data-recent` = id) and a remove button (`data-forget` = id); the app handles their clicks.
 * Classes: `recent-item`, `recent-open`, `recent-icon`, `recent-label`, `recent-name`, `recent-detail`, `recent-time`
 * (with `recent-date` and `recent-clock`), `recent-remove`, `recent-empty`.
 * @param {MDLRecentOptions} options
 */
export function render({ list, items, format, icon, strings }) {
  const document = list.ownerDocument;
  /** @param {string} tag @param {string} className @param {string} [text] */
  function element(tag, className, text) {
    const created = document.createElement(tag);
    created.className = className;
    if (text !== undefined) created.textContent = text;
    return created;
  }
  /** @param {MDLRecentItem} item */
  function row(item) {
    const open = /** @type {HTMLButtonElement} */ (element("button", "recent-open"));
    open.type = "button";
    open.dataset.recent = item.id;
    const symbol = element("span", "recent-icon");
    symbol.innerHTML = icon("item");
    const label = element("span", "recent-label");
    label.append(element("span", "recent-name", item.name));
    if (item.detail) label.append(element("span", "recent-detail", item.detail));
    const time = /** @type {HTMLTimeElement} */ (element("time", "recent-time"));
    time.dateTime = new Date(item.openedAt).toISOString();
    const shown = format(item.openedAt);
    if (typeof shown === "string") time.textContent = shown;
    else time.append(element("span", "recent-date", shown.date), element("span", "recent-clock", shown.time));
    open.append(symbol, label, time);
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
  if (!items.length) rows.push(element("li", "recent-empty", strings.empty));
  list.replaceChildren(...rows);
}
