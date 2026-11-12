/**
 * Keyboard shortcuts as data. A combination such as `"mod+shift+z"` names the key and the modifiers:
 * `mod` is Ctrl or ⌘, `ctrl`, `meta`, `alt` and `shift` must be pressed; a trailing `?` (`shift?`) allows
 * a modifier either way, and `any` allows every modifier. Modifiers that are not named must not be pressed.
 * Keys are `event.key` in lower case; the space bar is `space`.
 *
 * @typedef {{ key: string, mod: boolean, ctrl: boolean, meta: boolean, alt: boolean, shift: boolean, optional: Set<string>, any: boolean }} MDLCombo
 */
/** @param {string} combo @returns {MDLCombo} */
export function parse(combo: string): MDLCombo;
/**
 * Whether a keyboard event is the combination.
 * @param {{ key: string, ctrlKey: boolean, metaKey: boolean, altKey: boolean, shiftKey: boolean }} event
 * @param {string | MDLCombo} combo
 */
export function matches(event: {
    key: string;
    ctrlKey: boolean;
    metaKey: boolean;
    altKey: boolean;
    shiftKey: boolean;
}, combo: string | MDLCombo): boolean;
/**
 * Whether keys typed at the target edit text, so that letter shortcuts must not act.
 * @param {EventTarget | null} target
 * @param {{ selector?: string, ignoreClosedDialogs?: boolean }} [options]
 *   `ignoreClosedDialogs`: a control that kept focus inside a closed dialog does not count.
 */
export function isEditable(target: EventTarget | null, { selector, ignoreClosedDialogs }?: {
    selector?: string;
    ignoreClosedDialogs?: boolean;
}): boolean;
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
export function create({ target, guard, editable, capture }: {
    target: EventTarget;
    guard?: (event: KeyboardEvent) => boolean;
    editable?: (target: EventTarget | null) => boolean;
    capture?: boolean;
}): {
    /**
     * @param {string | string[]} combos @param {(event: KeyboardEvent) => unknown} run @param {MDLBindingOptions} [options]
     * @returns {() => void} Removes the binding.
     */
    bind(combos: string | string[], run: (event: KeyboardEvent) => unknown, options?: MDLBindingOptions): () => void;
    destroy(): void;
};
/**
 * Keyboard shortcuts as data. A combination such as `"mod+shift+z"` names the key and the modifiers:
 * `mod` is Ctrl or ⌘, `ctrl`, `meta`, `alt` and `shift` must be pressed; a trailing `?` (`shift?`) allows
 * a modifier either way, and `any` allows every modifier. Modifiers that are not named must not be pressed.
 * Keys are `event.key` in lower case; the space bar is `space`.
 */
export type MDLCombo = {
    key: string;
    mod: boolean;
    ctrl: boolean;
    meta: boolean;
    alt: boolean;
    shift: boolean;
    optional: Set<string>;
    any: boolean;
};
export type MDLBindingOptions = {
    /**
     * The binding acts only while this holds.
     */
    when?: (event: KeyboardEvent) => boolean;
    /**
     * Also while text is edited; default false.
     */
    inEditable?: boolean;
    /**
     * Also for repeated keydown events; default true.
     */
    repeat?: boolean;
    /**
     * Prevent the default action when it acts; default true.
     */
    prevent?: boolean;
};
