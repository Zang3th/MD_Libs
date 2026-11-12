/**
 * Placement of floating elements (popovers, menus, tooltips, details) next to an anchor, kept inside bounds,
 * and closing them on an outside event or Escape.
 *
 * @typedef {{ left: number, top: number, right: number, bottom: number }} MDLRect
 * @typedef {{ top: number, right: number, bottom: number, left: number }} MDLMargins
 *
 * @typedef {object} MDLPlacement
 * @property {"below" | "right"} [side] Where the element goes; default below.
 * @property {"start" | "center" | "end"} [align] Alignment along the anchor: below → left edge, center, right edge;
 *   right → top edge, center, bottom edge. Default start.
 * @property {number} [gap] Distance to the anchor.
 * @property {boolean} [flip] Use the opposite side (above, left) when the element does not fit.
 * @property {number | Partial<MDLMargins>} [margin] Distance to the bounds; per edge as an object.
 */

/** @param {number | Partial<MDLMargins>} margin @returns {MDLMargins} */
function margins(margin) {
  return typeof margin === "number" ? { top: margin, right: margin, bottom: margin, left: margin } : { top: 0, right: 0, bottom: 0, left: 0, ...margin };
}

/**
 * Top-left corner of an element of `size` next to `anchor` inside `bounds`. Clamping keeps the element inside
 * the bounds minus the margins; when it is larger than that, its top-left edge wins.
 * A point is an anchor of zero size.
 * @param {MDLRect} anchor @param {{ width: number, height: number }} size @param {MDLRect} bounds @param {MDLPlacement} [placement]
 * @returns {{ left: number, top: number }}
 */
export function place(anchor, size, bounds, { side = "below", align = "start", gap = 0, flip = false, margin = 0 } = {}) {
  const edge = margins(margin);
  const minLeft = bounds.left + edge.left;
  const maxLeft = bounds.right - size.width - edge.right;
  const minTop = bounds.top + edge.top;
  const maxTop = bounds.bottom - size.height - edge.bottom;
  /** @param {number} start @param {number} end @param {number} length */
  const aligned = (start, end, length) => align === "center" ? start + (end - start - length) / 2 : align === "end" ? end - length : start;
  let left;
  let top;
  if (side === "right") {
    left = anchor.right + gap;
    if (flip && left + size.width > bounds.right - edge.right) left = anchor.left - size.width - gap;
    top = aligned(anchor.top, anchor.bottom, size.height);
  } else {
    top = anchor.bottom + gap;
    if (flip && top + size.height > bounds.bottom - edge.bottom) top = anchor.top - size.height - gap;
    left = aligned(anchor.left, anchor.right, size.width);
  }
  return { left: Math.max(minLeft, Math.min(left, maxLeft)), top: Math.max(minTop, Math.min(top, maxTop)) };
}

/** The viewport of a window as bounds. @param {{ innerWidth: number, innerHeight: number }} window @returns {MDLRect} */
export function viewport(window) {
  return { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };
}

/** A point as an anchor of zero size. @param {number} x @param {number} y @returns {MDLRect} */
export function point(x, y) {
  return { left: x, right: x, top: y, bottom: y };
}

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
export function create({ window, element, button, inside = [], dismiss = "click", escape = true, onClose }) {
  const { document } = window;
  const within = [element, ...(button ? [button] : []), ...inside];

  /** @param {boolean} open */
  function show(open) {
    element.hidden = !open;
    button?.setAttribute("aria-expanded", String(open));
  }

  /** @param {MDLPopoverCloseReason} reason */
  function close(reason = "close") {
    if (element.hidden) return;
    show(false);
    onClose?.(reason);
  }

  /** @param {Event} event */
  function onOutside(event) {
    // Pointer and click events on the document always target a node.
    const target = /** @type {Node} */ (event.target);
    if (element.hidden || within.some(item => item.contains(target))) return;
    close("outside");
  }

  /** @param {KeyboardEvent} event */
  function onKey(event) {
    if (event.key === "Escape") close("escape");
  }

  document.addEventListener(dismiss, onOutside);
  if (escape) document.addEventListener("keydown", onKey);

  return {
    open: () => show(true),
    close,
    toggle() {
      if (element.hidden) show(true);
      else close("toggle");
      return !element.hidden;
    },
    get isOpen() { return !element.hidden; },
    destroy() {
      document.removeEventListener(dismiss, onOutside);
      document.removeEventListener("keydown", onKey);
    }
  };
}
