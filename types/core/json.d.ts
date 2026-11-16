/**
 * Reads a document. `unreadable`: no JSON object with an integer `format`. `newer`: a later version of the app
 * wrote it, so this version may read but must not write it.
 * @param {string} text
 * @param {{ format: number }} options The format this app writes.
 * @returns {{ value: MDLJsonDocument | null, error: "unreadable" | "newer" | null }}
 */
export function read(text: string, { format }: {
    format: number;
}): {
    value: MDLJsonDocument | null;
    error: "unreadable" | "newer" | null;
};
/**
 * Two-space indentation, keys in `order`, and a final line break.
 * @param {unknown} value
 * @param {{ order?: MDLJsonOrder }} [options]
 */
export function stringify(value: unknown, { order }?: {
    order?: MDLJsonOrder;
}): string;
export type MDLJsonDocument = Record<string, unknown> & {
    format: number;
};
/**
 * Key order of a document, by path. A path names an object: `""` is the document, `"devices"` its field,
 * `"devices.*"` every value of that field. The value lists the keys that come first, in that order (other keys
 * follow as found), or is `"sorted"` to order all keys alphabetically.
 */
export type MDLJsonOrder = Record<string, string[] | "sorted">;
