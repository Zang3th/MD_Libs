/**
 * Marks the selected button of a segmented control (view switcher, tabs) and moves its sliding indicator.
 * The indicator is as wide as one button; it moves by whole button widths.
 * @param {object} options
 * @param {HTMLElement[]} options.buttons In visual order.
 * @param {number} options.selected Index of the selected button.
 * @param {HTMLElement | null} [options.thumb] The sliding indicator.
 * @param {"aria-pressed" | "aria-selected"} [options.attribute] `aria-selected` for tabs.
 */
export function select({ buttons, selected, thumb = null, attribute = "aria-pressed" }) {
  buttons.forEach((button, index) => button.setAttribute(attribute, String(index === selected)));
  if (thumb && buttons[selected]) thumb.style.transform = `translateX(${selected * 100}%)`;
}
