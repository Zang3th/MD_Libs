import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import * as esbuild from "esbuild";
import buildHarness from "../../src/harness/build.cjs";

const { bundleOptions, build, bundleForTests } = buildHarness;

/** A tiny application in the shape of MD_Manager and MD_Calendar: a namespace, a module with an import, an entry. */
function project() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "md-libs-build-"));
  const files = {
    "domain/twice.js": "export function twice(value) { return value * 2; }\n",
    "domain/numbers.js": [
      "import { twice } from \"./twice.js\";",
      "window.App = window.App || {};",
      "(function (app) { app.numbers = { four: () => twice(2) }; })(window.App);",
      ""
    ].join("\n"),
    "app.js": "import \"./domain/numbers.js\";\nwindow.App.started = window.App.numbers.four();\n"
  };
  for (const [name, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    fs.writeFileSync(path.join(root, name), text);
  }
  return root;
}

test("bundle options produce one classic script with a linked source map", () => {
  const options = bundleOptions({ root: "/app" });
  assert.equal(options.format, "iife");
  assert.equal(options.bundle, true);
  assert.deepEqual(options.entryPoints, ["app.js"]);
  assert.equal(options.outfile, "dist/app.js");
  assert.equal(options.sourcemap, "linked");
  assert.equal(options.absWorkingDir, "/app");
  assert.deepEqual(bundleOptions({ root: "/app", entry: "main.js", outfile: "out/main.js" }).entryPoints, ["main.js"]);
});

test("build writes a bundle that runs as a classic script without modules", async () => {
  const root = project();
  const file = await build(esbuild, { root });
  assert.equal(file, path.join(root, "dist/app.js"));
  assert.ok(fs.existsSync(`${file}.map`));
  const code = fs.readFileSync(file, "utf8");
  assert.doesNotMatch(code, /^\s*(?:import|export)\s/m);
  const context = vm.createContext({ window: {} });
  vm.runInContext(code, context);
  assert.equal(context.window.App.started, 4);
});

test("test bundles load only the requested files, in order, after the prelude", () => {
  const root = project();
  const code = bundleForTests(esbuild, { root, files: ["domain/numbers.js"], prelude: "window.order = ['prelude'];" });
  const context = vm.createContext({ window: {} });
  vm.runInContext(code, context);
  assert.equal(context.window.App.numbers.four(), 4);
  assert.equal(context.window.App.started, undefined);
  assert.deepEqual([...context.window.order], ["prelude"]);
  assert.match(bundleForTests(esbuild, { root, files: ["domain\\numbers.js"] }), /app\.numbers/);
});

test("test bundles report missing output", () => {
  assert.throws(() => bundleForTests({ build: async () => ({}), buildSync: () => ({ outputFiles: [] }) }, { root: "/", files: [] }), /no output/);
});
