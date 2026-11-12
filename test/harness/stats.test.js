import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import checks from "../../src/harness/checks.cjs";

/** @param {import("node:test").TestContext} t @param {Record<string, string>} files */
function project(t, files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mdl-stats-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const [name, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    fs.writeFileSync(path.join(root, name), content);
  }
  return root;
}

test("source lines skip blank and comment-only lines per language; tests are counted recursively", t => {
  const root = project(t, {
    "App.html": "<!doctype html>\n<!-- a\ncomment -->\n\n<p>a</p> <!-- b -->\n",
    "styles.css": "/* c */\nbody {\r\n  color: red; /* d\n  e */\n}\n",
    "app.js": "// f\nconst a = 1;\n/* g */ const b = 2;\n/**\n * h\n */\n\n",
    "ui/one.js": "export {};\n",
    "ui/notes.txt": "ignored\n",
    "ui/nested/two.js": "ignored();\n",
    "tests/unit/a.test.js": "test(\"a\", () => {});\ntest.skip(\"b\", () => {});\n  test (\"c\", () => {});\nnotATest(\"d\");\n",
    "tests/e2e/b.spec.js": "test(\"e\", async () => {});\n",
    "tests/helper.js": "test(\"not counted\");\n"
  });
  const stats = checks.projectStats({ root, sources: { HTML: ["App.html"], CSS: ["styles.css"], JS: ["app.js", "ui/"] } });
  assert.deepEqual(stats, { lines: { HTML: 2, CSS: 3, JS: 3 }, total: 8, tests: 4 });
  assert.equal(checks.formatStats(stats), "Application LoC (without blank and comment-only lines)\nHTML  2\nCSS   3\nJS    3\nTotal 8\nTests 4");
});

test("a custom test folder", t => {
  const root = project(t, { "app.js": "a();\n", "spec/x.test.js": "test(\"x\", () => {});\n" });
  assert.deepEqual(checks.projectStats({ root, sources: { JS: ["app.js"] }, tests: "spec" }), { lines: { JS: 1 }, total: 1, tests: 1 });
});
