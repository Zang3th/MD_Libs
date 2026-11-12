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
export function create({ window, element, delay, margin, touch, focusVisibleOnly, hideEmpty }: MDLTooltipOptions): {
    hide(): void;
    destroy(): void;
};
export type MDLTooltipOptions = {
    window: Window;
    /**
     * The tooltip element; it needs an `id`.
     */
    element: HTMLElement;
    /**
     * ms before a hovered target shows its tooltip; focus shows it at once.
     */
    delay?: number;
    margin?: number;
    /**
     * Touch pointers show tooltips too.
     */
    touch?: boolean;
    /**
     * Only keyboard focus (`:focus-visible`) shows tooltips.
     */
    focusVisibleOnly?: boolean;
    /**
     * A target whose `data-tooltip` is empty shows nothing.
     */
    hideEmpty?: boolean;
};
