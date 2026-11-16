/**
 * Marks the selected button of a segmented control (view switcher, tabs) and moves its sliding indicator.
 * The indicator is as wide as one button; it moves by whole button widths.
 * @param {object} options
 * @param {HTMLElement[]} options.buttons In visual order.
 * @param {number} options.selected Index of the selected button.
 * @param {HTMLElement | null} [options.thumb] The sliding indicator.
 * @param {"aria-pressed" | "aria-selected"} [options.attribute] `aria-selected` for tabs.
 */
export function select({ buttons, selected, thumb, attribute }: {
    buttons: HTMLElement[];
    selected: number;
    thumb?: HTMLElement | null;
    attribute?: "aria-pressed" | "aria-selected";
}): void;
