/**
 * Lists every difference between the `<symbol id="{prefix}{name}">` elements of `html` and the SVG files in
 * `directory`: missing files or symbols, a missing standalone wrapper, another canvas, other root attributes
 * or other geometry. An empty list means they match.
 * @param {{ html: string, directory: string, prefix: string, names?: Map<string, string>, viewBox?: string }} options
 *   `names` maps file names (without `.svg`) to symbol names where they differ.
 * @returns {string[]}
 */
export function compareIcons({ html, directory, prefix, names, viewBox }: {
    html: string;
    directory: string;
    prefix: string;
    names?: Map<string, string>;
    viewBox?: string;
}): string[];
