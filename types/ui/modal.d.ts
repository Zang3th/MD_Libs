/**
 * Closing a modal dialog by a press on its backdrop.
 *
 * @typedef {object} MDLBackdropOptions
 * @property {HTMLDialogElement} dialog A modal dialog without padding, so that only its backdrop is the dialog element itself.
 * @property {() => void} close Called for a press on the backdrop; the app closes the dialog.
 * @property {"pointerdown" | "click"} [dismiss] The event that counts as the press; default `pointerdown`. With it, a press
 *   that begins inside the dialog never closes it, also when it ends on the backdrop. With `click`, the browser reports a
 *   press that begins inside and ends on the backdrop as a click on the dialog element, and that closes it.
 * @property {() => boolean} [when] Asked on each press; `false` keeps the dialog open, for example while it works.
 */
/**
 * Calls `close` when the backdrop of `dialog` is pressed.
 * @param {MDLBackdropOptions} options
 * @returns {{ destroy(): void }}
 */
export function closeOnBackdrop({ dialog, close, dismiss, when }: MDLBackdropOptions): {
    destroy(): void;
};
/**
 * Closing a modal dialog by a press on its backdrop.
 */
export type MDLBackdropOptions = {
    /**
     * A modal dialog without padding, so that only its backdrop is the dialog element itself.
     */
    dialog: HTMLDialogElement;
    /**
     * Called for a press on the backdrop; the app closes the dialog.
     */
    close: () => void;
    /**
     * The event that counts as the press; default `pointerdown`. With it, a press
     * that begins inside the dialog never closes it, also when it ends on the backdrop. With `click`, the browser reports a
     * press that begins inside and ends on the backdrop as a click on the dialog element, and that closes it.
     */
    dismiss?: "pointerdown" | "click";
    /**
     * Asked on each press; `false` keeps the dialog open, for example while it works.
     */
    when?: () => boolean;
};
