/**
 * Thin layer over SortableJS: shared defaults and the index arithmetic after a drop.
 * SortableJS itself is passed in by the app, so MD_Libs has no runtime dependency.
 */

/**
 * @typedef {{ create(element: Element, options: object): { destroy(): void } }} MDLSortableLibrary
 */

/**
 * Defaults: 150 ms animation (none with reduced motion), a gentle easing, the class names of MD_Manager,
 * and filtered elements keep their own clicks.
 * @param {Window} window
 */
function defaults(window) {
  return {
    animation: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 150,
    easing: "cubic-bezier(.2,0,0,1)",
    preventOnFilter: false,
    ghostClass: "sortable-ghost",
    chosenClass: "sortable-chosen",
    dragClass: "sortable-drag"
  };
}

/**
 * Creates a sortable list; `options` are SortableJS options and override the defaults.
 * @param {{ Sortable: MDLSortableLibrary, window: Window, element: Element, options?: object }} options
 */
export function create({ Sortable, window, element, options = {} }) {
  return Sortable.create(element, { ...defaults(window), ...options });
}

/**
 * Model index of a dropped item from its new DOM neighbours. `next` and `previous` are the model indices of
 * the neighbouring items or `null`; without neighbours the item lands at `fallback`. Within the same list,
 * removing the item first shifts later indices down by one.
 * @param {{ fromIndex: number, next: number | null, previous: number | null, fallback: number, sameList: boolean }} drop
 */
export function dropIndex({ fromIndex, next, previous, fallback, sameList }) {
  const insertion = next !== null ? next : previous !== null ? previous + 1 : fallback;
  return insertion - (sameList && fromIndex < insertion ? 1 : 0);
}

/**
 * Position of an item among the siblings before it that count, for lists that mix movable entries with
 * fixed or moving elements.
 * @param {Element} item @param {(sibling: Element) => boolean} counts
 */
export function position(item, counts) {
  let index = 0;
  for (let sibling = item.previousElementSibling; sibling; sibling = sibling.previousElementSibling) {
    if (counts(sibling)) index += 1;
  }
  return index;
}
