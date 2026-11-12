/**
 * @param {{ esbuild: import("./build.cjs").MDLEsbuild, root: string, namespace: string, files: string[], globals?: Record<string, unknown>, prelude?: string }} options
 *   `globals` become globals of the context and properties of its `window`; `namespace` is created empty on `window`.
 * @returns {any} The context's window.
 */
export function loadClassic({ esbuild, root, namespace, files, globals, prelude }: {
    esbuild: import("./build.cjs").MDLEsbuild;
    root: string;
    namespace: string;
    files: string[];
    globals?: Record<string, unknown>;
    prelude?: string;
}): any;
