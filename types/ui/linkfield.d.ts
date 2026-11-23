/**
 * Shows the links of a text field, which cannot style parts of its text itself (see `markdown.links`).
 *
 * A mirror element behind the field repeats its text in the same place and wraps each link in a span of `linkClass`;
 * the field keeps its own text, caret and selection on top. The app stacks the mirror behind the field with the same
 * font, padding and wrapping, keeps its text transparent and styles the span. The field has no border, since the mirror
 * leaves room only for the field's scrollbar; scrollbar and scroll position are read at most once per frame.
 *
 * An optional `view` shows the text as read while the field is not being edited: each link as an anchor of
 * `viewLinkClass` that opens in a new tab, a Markdown link by its label. The app places it over the field with the
 * same font, padding and wrapping and shows it only while the field has no focus; it is empty for a blank text, so
 * that the field's placeholder can show. A click on its text focuses the field with the caret at the clicked place
 * (at the end where the browser cannot tell the place); a dragged selection stays a selection.
 * @param {object} options
 * @param {Window} options.window
 * @param {HTMLTextAreaElement} options.field
 * @param {HTMLElement} options.mirror
 * @param {string} options.linkClass
 * @param {HTMLElement} [options.view]
 * @param {string} [options.viewLinkClass] defaults to `linkClass`
 */
export function attach({ window, field, mirror, linkClass, view, viewLinkClass }: {
    window: Window;
    field: HTMLTextAreaElement;
    mirror: HTMLElement;
    linkClass: string;
    view?: HTMLElement;
    viewLinkClass?: string;
}): void;
