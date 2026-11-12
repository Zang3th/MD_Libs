"use strict";

// Bundling for the applications: their ES modules and npm dependencies become one classic
// script that runs from file:// without a server. esbuild is passed in by the application.

const path = require("node:path");

/**
 * @typedef {{ esbuild: MDLEsbuild, root: string, entry?: string, outfile?: string }} MDLBuildOptions
 * @typedef {{ esbuild: MDLEsbuild, root: string, files: string[], prelude?: string }} MDLTestBundleOptions
 * @typedef {{
 *   build(options: object): Promise<unknown>,
 *   buildSync(options: object): { outputFiles?: Array<{ text: string }> }
 * }} MDLEsbuild
 */

const shared = {
  bundle: true,
  format: /** @type {const} */ ("iife"),
  platform: /** @type {const} */ ("browser"),
  target: "es2022",
  charset: /** @type {const} */ ("utf8"),
  legalComments: /** @type {const} */ ("eof")
};

/**
 * esbuild options for the application bundle.
 * @param {Omit<MDLBuildOptions, "esbuild">} options
 */
function bundleOptions({ root, entry = "app.js", outfile = "dist/app.js" }) {
  return {
    ...shared,
    absWorkingDir: root,
    entryPoints: [entry],
    outfile,
    sourcemap: /** @type {const} */ ("linked"),
    logLevel: /** @type {const} */ ("warning")
  };
}

/**
 * Builds the application bundle and returns the absolute path of the written script.
 * @param {MDLBuildOptions} options
 */
async function build({ esbuild, ...options }) {
  const resolved = bundleOptions(options);
  await esbuild.build(resolved);
  return path.join(options.root, resolved.outfile);
}

/**
 * Bundles the given production files in order for a vm context, so that unit tests can load
 * single modules with their imports. `prelude` is module code placed before the imports.
 * @param {MDLTestBundleOptions} options
 * @returns {string}
 */
function bundleForTests({ esbuild, root, files, prelude = "" }) {
  const imports = files.map(file => `import ${JSON.stringify(`./${file.replaceAll("\\", "/")}`)};`).join("\n");
  const result = esbuild.buildSync({
    ...shared,
    stdin: { contents: `${prelude}\n${imports}\n`, resolveDir: root, sourcefile: "test-entry.js" },
    write: false,
    logLevel: "silent"
  });
  const output = result.outputFiles?.[0];
  if (!output) throw new Error("esbuild produced no output.");
  return output.text;
}

module.exports = { bundleOptions, build, bundleForTests };
