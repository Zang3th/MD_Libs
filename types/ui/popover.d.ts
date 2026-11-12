/**
 * Top-left corner of an element of `size` next to `anchor` inside `bounds`. Clamping keeps the element inside
 * the bounds minus the margins; when it is larger than that, its top-left edge wins.
 * A point is an anchor of zero size.
 * @param {MDLRect} anchor @param {{ width: number, height: number }} size @param {MDLRect} bounds @param {MDLPlacement} [placement]
 * @returns {{ left: number, top: number }}
 */
export function place(anchor: MDLRect, size: {
    width: number;
    height: number;
}, bounds: MDLRect, { side, align, gap, flip, margin }?: MDLPlacement): {
    left: number;
    top: number;
};
/** The viewport of a window as bounds. @param {{ innerWidth: number, innerHeight: number }} window @returns {MDLRect} */
export function viewport(window: {
    innerWidth: number;
    innerHeight: number;
}): MDLRect;
/** A point as an anchor of zero size. @param {number} x @param {number} y @returns {MDLRect} */
export function point(x: number, y: number): MDLRect;
/** @typedef {"outside" | "escape" | "toggle" | "close"} MDLPopoverCloseReason */
/**
 * @typedef {object} MDLPopoverOptions
 * @property {Window} window
 * @property {HTMLElement} element The floating element, shown and hidden through `hidden`.
 * @property {HTMLElement} [button] Opens and closes the element; carries `aria-expanded`. The app wires its click.
 * @property {Element[]} [inside] Further elements whose events count as inside; the element and the button always do.
 * @property {"click" | "pointerdown"} [dismiss] The outside event that closes it; default click.
 * @property {boolean} [escape] Escape anywhere closes it; default true.
 * @property {(reason: MDLPopoverCloseReason) => void} [onClose] Called after it closed; not when it was closed already.
 */
/**
 * @typedef {object} MDLPopover
 * @property {() => void} open
 * @property {(reason?: MDLPopoverCloseReason) => void} close Default reason `close`.
 * @property {() => boolean} toggle Opens or closes it; returns whether it is open now.
 * @property {boolean} isOpen
 * @property {() => void} destroy Removes the listeners; the element stays as it is.
 */
/**
 * A floating element that closes on an event outside of it and on Escape, and keeps `aria-expanded` of its button
 * in step. Placement stays with the app: open it, then `place()` it.
 * @param {MDLPopoverOptions} options
 * @returns {MDLPopover}
 */
export function create({ window, element, button, inside, dismiss, escape, onClose }: MDLPopoverOptions): MDLPopover;
/**
 * Placement of floating elements (popovers, menus, tooltips, details) next to an anchor, kept inside bounds,
 * and closing them on an outside event or Escape.
 */
export type MDLRect = {
    left: number;
    top: number;
    right: number;
    bottom: number;
};
/**
 * Placement of floating elements (popovers, menus, tooltips, details) next to an anchor, kept inside bounds,
 * and closing them on an outside event or Escape.
 */
export type MDLMargins = {
    top: number;
    right: number;
    bottom: number;
    left: number;
};
/**
 * Placement of floating elements (popovers, menus, tooltips, details) next to an anchor, kept inside bounds,
 * and closing them on an outside event or Escape.
 */
export type MDLPlacement = {
    /**
     * Where the element goes; default below.
     */
    side?: "below" | "right";
    /**
     * Alignment along the anchor: below → left edge, center, right edge;
     * right → top edge, center, bottom edge. Default start.
     */
    align?: "start" | "center" | "end";
    /**
     * Distance to the anchor.
     */
    gap?: number;
    /**
     * Use the opposite side (above, left) when the element does not fit.
     */
    flip?: boolean;
    /**
     * Distance to the bounds; per edge as an object.
     */
    margin?: number | Partial<MDLMargins>;
};
export type MDLPopoverCloseReason = "outside" | "escape" | "toggle" | "close";
export type MDLPopoverOptions = {
    window: Window;
    /**
     * The floating element, shown and hidden through `hidden`.
     */
    element: HTMLElement;
    /**
     * Opens and closes the element; carries `aria-expanded`. The app wires its click.
     */
    button?: HTMLElement;
    /**
     * Further elements whose events count as inside; the element and the button always do.
     */
    inside?: Element[];
    /**
     * The outside event that closes it; default click.
     */
    dismiss?: "click" | "pointerdown";
    /**
     * Escape anywhere closes it; default true.
     */
    escape?: boolean;
    /**
     * Called after it closed; not when it was closed already.
     */
    onClose?: (reason: MDLPopoverCloseReason) => void;
};
export type MDLPopover = {
    open: () => void;
    /**
     * Default reason `close`.
     */
    close: (reason?: MDLPopoverCloseReason) => void;
    /**
     * Opens or closes it; returns whether it is open now.
     */
    toggle: () => boolean;
    isOpen: boolean;
    /**
     * Removes the listeners; the element stays as it is.
     */
    destroy: () => void;
};
