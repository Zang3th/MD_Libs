"use strict";

// Loads production modules of an application for unit tests: bundles them with their imports and
// runs the bundle in an isolated vm context, as the browser would run dist/app.js.

const vm = require("node:vm");
const { bundleForTests } = require("./build.cjs");

/**
 * @param {{ esbuild: import("./build.cjs").MDLEsbuild, root: string, namespace: string, files: string[], globals?: Record<string, unknown>, prelude?: string }} options
 *   `globals` become globals of the context and properties of its `window`; `namespace` is created empty on `window`.
 * @returns {any} The context's window.
 */
function loadClassic({ esbuild, root, namespace, files, globals = {}, prelude = "" }) {
  const window = { [namespace]: {}, ...globals };
  const context = vm.createContext({ queueMicrotask, ...globals, window });
  vm.runInContext(bundleForTests({ esbuild, root, files, prelude }), context, { filename: "bundle.js" });
  return window;
}

module.exports = { loadClassic };
