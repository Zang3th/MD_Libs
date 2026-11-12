/**
 * Keyboard shortcuts as data. A combination such as `"mod+shift+z"` names the key and the modifiers:
 * `mod` is Ctrl or ⌘, `ctrl`, `meta`, `alt` and `shift` must be pressed; a trailing `?` (`shift?`) allows
 * a modifier either way, and `any` allows every modifier. Modifiers that are not named must not be pressed.
 * Keys are `event.key` in lower case; the space bar is `space`.
 *
 * @typedef {{ key: string, mod: boolean, ctrl: boolean, meta: boolean, alt: boolean, shift: boolean, optional: Set<string>, any: boolean }} MDLCombo
 */

/** @param {string} combo @returns {MDLCombo} */
export function parse(combo) {
  const parts = combo.toLowerCase().split("+");
  const key = /** @type {string} */ (parts.pop());
  /** @type {MDLCombo} */
  const parsed = { key, mod: false, ctrl: false, meta: false, alt: false, shift: false, optional: new Set(), any: false };
  for (const part of parts) {
    if (part === "any") parsed.any = true;
    else if (part.endsWith("?")) parsed.optional.add(part.slice(0, -1));
    else if (part === "mod" || part === "ctrl" || part === "meta" || part === "alt" || part === "shift") parsed[part] = true;
    else throw new Error(`Unknown modifier "${part}" in "${combo}".`);
  }
  return parsed;
}

/** @param {{ key: string }} event */
function keyOf(event) {
  const key = event.key.toLowerCase();
  return key === " " ? "space" : key;
}

/**
 * Whether a keyboard event is the combination.
 * @param {{ key: string, ctrlKey: boolean, metaKey: boolean, altKey: boolean, shiftKey: boolean }} event
 * @param {string | MDLCombo} combo
 */
export function matches(event, combo) {
  const wanted = typeof combo === "string" ? parse(combo) : combo;
  if (keyOf(event) !== wanted.key) return false;
  if (wanted.any) return true;
  const optional = (/** @type {string} */ name) => wanted.optional.has(name);
  if (wanted.mod || optional("mod")) {
    if (!optional("mod") && !event.ctrlKey && !event.metaKey) return false;
  } else {
    if (event.ctrlKey !== wanted.ctrl && !optional("ctrl")) return false;
    if (event.metaKey !== wanted.meta && !optional("meta")) return false;
  }
  if (event.altKey !== wanted.alt && !optional("alt")) return false;
  return event.shiftKey === wanted.shift || optional("shift");
}

/**
 * Whether keys typed at the target edit text, so that letter shortcuts must not act.
 * @param {EventTarget | null} target
 * @param {{ selector?: string, ignoreClosedDialogs?: boolean }} [options]
 *   `ignoreClosedDialogs`: a control that kept focus inside a closed dialog does not count.
 */
export function isEditable(target, { selector = "input, textarea, select, [contenteditable]:not([contenteditable='false'])", ignoreClosedDialogs = false } = {}) {
  const element = /** @type {Element | null} */ (target);
  if (typeof element?.matches !== "function" || !element.matches(selector)) return false;
  return !(ignoreClosedDialogs && element.closest("dialog:not([open])"));
}

/**
 * @typedef {object} MDLBindingOptions
 * @property {(event: KeyboardEvent) => boolean} [when] The binding acts only while this holds.
 * @property {boolean} [inEditable] Also while text is edited; default false.
 * @property {boolean} [repeat] Also for repeated keydown events; default true.
 * @property {boolean} [prevent] Prevent the default action when it acts; default true.
 */

/**
 * One keydown listener for all bindings. Every matching binding runs, in the order bound; a binding whose
 * handler returns `false` did not act and leaves the default action alone.
 * @param {{ target: EventTarget, guard?: (event: KeyboardEvent) => boolean, editable?: (target: EventTarget | null) => boolean, capture?: boolean }} options
 *   `guard` returning false skips every binding for this event.
 */
export function create({ target, guard = () => true, editable = isEditable, capture = false }) {
  /** @type {Array<{ combos: MDLCombo[], run: (event: KeyboardEvent) => unknown, options: MDLBindingOptions }>} */
  const bindings = [];

  /** @param {Event} event */
  const onKeydown = event => {
    const keyboard = /** @type {KeyboardEvent} */ (event);
    if (!guard(keyboard)) return;
    const editing = editable(keyboard.target);
    for (const binding of [...bindings]) {
      const { when, inEditable = false, repeat = true, prevent = true } = binding.options;
      if (!binding.combos.some(combo => matches(keyboard, combo))) continue;
      if ((editing && !inEditable) || (keyboard.repeat && !repeat) || (when && !when(keyboard))) continue;
      if (binding.run(keyboard) !== false && prevent) keyboard.preventDefault();
    }
  };
  target.addEventListener("keydown", onKeydown, capture);

  return {
    /**
     * @param {string | string[]} combos @param {(event: KeyboardEvent) => unknown} run @param {MDLBindingOptions} [options]
     * @returns {() => void} Removes the binding.
     */
    bind(combos, run, options = {}) {
      const binding = { combos: (Array.isArray(combos) ? combos : [combos]).map(parse), run, options };
      bindings.push(binding);
      return () => {
        const index = bindings.indexOf(binding);
        if (index >= 0) bindings.splice(index, 1);
      };
    },
    destroy() {
      target.removeEventListener("keydown", onKeydown, capture);
      bindings.length = 0;
    }
  };
}
