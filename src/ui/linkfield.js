import { escapeHtml, links } from "../core/markdown.js";
import { frame } from "./internal.js";

/**
 * The text as HTML with each link (see `markdown.links`) rendered by `render`.
 * @param {string} text @param {(link: import("../core/markdown.js").MDLTextLink) => string} render
 */
function markup(text, render) {
  let html = "";
  let offset = 0;
  for (const link of links(text)) {
    html += escapeHtml(text.slice(offset, link.start)) + render(link);
    offset = link.end;
  }
  return html + escapeHtml(text.slice(offset));
}

/**
 * Maps an offset in the shown text, where a Markdown link shows only its label, to the offset in the text. Inside a
 * label the offset keeps its place in the label, after the “[”.
 * @param {string} text @param {number} shown
 */
function textOffset(text, shown) {
  let raw = 0;
  let display = 0;
  for (const link of links(text)) {
    if (shown <= display + link.start - raw) break;
    display += link.start - raw;
    raw = link.start;
    if (shown <= display + link.text.length) return raw + (link.end - link.start === link.text.length ? 0 : 1) + shown - display;
    display += link.text.length;
    raw = link.end;
  }
  return raw + shown - display;
}

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
export function attach({ window, field, mirror, linkClass, view, viewLinkClass = linkClass }) {
  const follow = frame(window, () => {
    const scrollbar = field.offsetWidth - field.clientWidth;
    const top = field.scrollTop;
    mirror.style.right = `${scrollbar}px`;
    mirror.scrollTop = top;
  });

  function update() {
    const text = field.value;
    // A final line break takes a line in the field, but in an element only with something after it.
    mirror.innerHTML = markup(text, link => `<span class="${linkClass}">${escapeHtml(text.slice(link.start, link.end))}</span>`) + (text.endsWith("\n") ? " " : "");
    follow.schedule();
  }

  field.addEventListener("input", update);
  field.addEventListener("scroll", follow.schedule);
  update();
  if (view) attachView(window, field, view, viewLinkClass);
}

/** @param {Window} window @param {HTMLTextAreaElement} field @param {HTMLElement} view @param {string} linkClass */
function attachView(window, field, view, linkClass) {
  const { document } = window;

  function render() {
    const text = field.value;
    view.innerHTML = text.trim() ? markup(text, link =>
      `<a class="${linkClass}" href="${escapeHtml(link.href)}" target="_blank" rel="noopener noreferrer" tabindex="-1">${escapeHtml(link.text)}</a>`) : "";
    view.scrollTop = field.scrollTop;
  }

  /** The offset in the shown text at a point; its end when the point is not on it. @param {number} x @param {number} y */
  function shownOffset(x, y) {
    const position = document.caretPositionFromPoint?.(x, y);
    if (!position || !view.contains(position.offsetNode)) return String(view.textContent).length;
    const range = document.createRange();
    range.setStart(view, 0);
    range.setEnd(position.offsetNode, position.offset);
    return range.toString().length;
  }

  // The view is no focus stop: a press on a link keeps the focus where it is, so that the view stays until the click.
  view.addEventListener("mousedown", event => {
    if (/** @type {Element} */ (event.target).closest("a")) event.preventDefault();
  });
  view.addEventListener("click", event => {
    if (/** @type {Element} */ (event.target).closest("a") || !window.getSelection()?.isCollapsed) return;
    const at = textOffset(field.value, shownOffset(event.clientX, event.clientY));
    field.scrollTop = view.scrollTop;
    field.focus({ preventScroll: true });
    field.setSelectionRange(at, at);
  });
  field.addEventListener("blur", render);
  render();
}
