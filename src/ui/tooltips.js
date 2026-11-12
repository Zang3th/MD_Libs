import { frame } from "./internal.js";
import { place, viewport } from "./popover.js";

/**
 * @typedef {object} MDLTooltipOptions
 * @property {Window} window
 * @property {HTMLElement} element The tooltip element; it needs an `id`.
 * @property {number} [delay] ms before a hovered target shows its tooltip; focus shows it at once.
 * @property {number} [margin]
 * @property {boolean} [touch] Touch pointers show tooltips too.
 * @property {boolean} [focusVisibleOnly] Only keyboard focus (`:focus-visible`) shows tooltips.
 * @property {boolean} [hideEmpty] A target whose `data-tooltip` is empty shows nothing.
 */

/**
 * Tooltips for every element with `data-tooltip`, shown on hover after a delay and on focus.
 * @param {MDLTooltipOptions} options
 * @returns {{ hide(): void, destroy(): void }}
 */
export function create({ window, element, delay = 350, margin = 8, touch = true, focusVisibleOnly = false, hideEmpty = false }) {
  const { document } = window;
  let showTimer = 0;
  /** @type {HTMLElement | null} */
  let target = null;

  const layout = frame(window, () => {
    if (!target || element.hidden) return;
    // Centered below the target, above it when there is no room below, inside the window.
    const position = place(target.getBoundingClientRect(), element.getBoundingClientRect(), viewport(window), { side: "below", align: "center", gap: margin, flip: true, margin });
    element.style.left = `${Math.round(position.left)}px`;
    element.style.top = `${Math.round(position.top)}px`;
  });

  function hide() {
    window.clearTimeout(showTimer);
    layout.cancel();
    showTimer = 0;
    if (target?.getAttribute("aria-describedby") === element.id) target.removeAttribute("aria-describedby");
    target = null;
    element.hidden = true;
  }

  /** @param {HTMLElement} next @param {boolean} immediate */
  function schedule(next, immediate) {
    hide();
    target = next;
    target.setAttribute("aria-describedby", element.id);
    showTimer = window.setTimeout(() => {
      if (!target || (hideEmpty && !target.dataset.tooltip)) return;
      element.textContent = target.dataset.tooltip || "";
      element.hidden = false;
      layout.schedule();
    }, immediate ? 0 : delay);
  }

  /** @param {EventTarget | null} eventTarget */
  function tooltipTarget(eventTarget) {
    const candidate = /** @type {Element | null} */ (eventTarget);
    return typeof candidate?.closest === "function" ? /** @type {HTMLElement | null} */ (candidate.closest("[data-tooltip]")) : null;
  }

  /** @param {PointerEvent} event */
  const onOver = event => {
    if (!touch && event.pointerType === "touch") return;
    const next = tooltipTarget(event.target);
    if (next && next !== target) schedule(next, false);
  };
  /** @param {PointerEvent} event */
  const onOut = event => {
    if (target && !target.contains(/** @type {Node | null} */ (event.relatedTarget))) hide();
  };
  /** @param {FocusEvent} event */
  const onFocus = event => {
    const next = tooltipTarget(event.target);
    if (next && (!focusVisibleOnly || next.matches(":focus-visible"))) schedule(next, true);
  };

  /** @type {Array<[EventTarget, string, (event: any) => void, boolean]>} */
  const listeners = [
    [document, "pointerover", onOver, false],
    [document, "pointerout", onOut, false],
    [document, "focusin", onFocus, false],
    [document, "focusout", hide, false],
    [document, "pointerdown", hide, false],
    [window, "resize", hide, false],
    [window, "scroll", hide, true]
  ];
  for (const [source, type, listener, capture] of listeners) source.addEventListener(type, listener, capture);

  return {
    hide,
    destroy() {
      hide();
      for (const [source, type, listener, capture] of listeners) source.removeEventListener(type, listener, capture);
    }
  };
}
