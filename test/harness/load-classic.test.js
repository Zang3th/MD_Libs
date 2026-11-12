import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import esbuild from "esbuild";
import loader from "../../src/harness/testing.cjs";

test("modules run in an isolated window with the given globals and share the namespace", t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mdl-load-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, "a.js"), "window.App.value = greeting + \"!\";\n");
  fs.writeFileSync(path.join(root, "b.js"), "window.App.twice = window.App.value.repeat(2);\n");
  const window = loader.loadClassic({ esbuild, root, namespace: "App", files: ["a.js", "b.js"], globals: { greeting: "hi" } });
  assert.deepEqual({ ...window.App }, { value: "hi!", twice: "hi!hi!" });
  assert.equal(window.greeting, "hi");
  assert.equal(loader.loadClassic({ esbuild, root, namespace: "App", files: ["a.js"], globals: { greeting: "" }, prelude: "window.App.prelude = true;" }).App.prelude, true);
});
