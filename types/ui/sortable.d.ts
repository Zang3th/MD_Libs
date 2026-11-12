/**
 * Creates a sortable list; `options` are SortableJS options and override the defaults.
 * @param {{ Sortable: MDLSortableLibrary, window: Window, element: Element, options?: object }} options
 */
export function create({ Sortable, window, element, options }: {
    Sortable: MDLSortableLibrary;
    window: Window;
    element: Element;
    options?: object;
}): {
    destroy(): void;
};
/**
 * Model index of a dropped item from its new DOM neighbours. `next` and `previous` are the model indices of
 * the neighbouring items or `null`; without neighbours the item lands at `fallback`. Within the same list,
 * removing the item first shifts later indices down by one.
 * @param {{ fromIndex: number, next: number | null, previous: number | null, fallback: number, sameList: boolean }} drop
 */
export function dropIndex({ fromIndex, next, previous, fallback, sameList }: {
    fromIndex: number;
    next: number | null;
    previous: number | null;
    fallback: number;
    sameList: boolean;
}): number;
/**
 * Position of an item among the siblings before it that count, for lists that mix movable entries with
 * fixed or moving elements.
 * @param {Element} item @param {(sibling: Element) => boolean} counts
 */
export function position(item: Element, counts: (sibling: Element) => boolean): number;
export type MDLSortableLibrary = {
    create(element: Element, options: object): {
        destroy(): void;
    };
};
