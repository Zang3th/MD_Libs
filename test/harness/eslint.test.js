import assert from "node:assert/strict";
import test from "node:test";
import { ESLint } from "eslint";
import js from "@eslint/js";
import globals from "globals";
import eslint from "../../src/harness/checks.cjs";

const config = eslint.eslintConfig({ js, globals, ignores: ["prototypes/**"] });

/** @param {string} filePath @param {string} code */
async function lint(filePath, code) {
  const linter = new ESLint({ overrideConfigFile: true, overrideConfig: config, cwd: process.cwd() });
  const [result] = await linter.lintText(code, { filePath });
  return result.messages.map(message => message.ruleId);
}

test("production modules are browser ES modules", async () => {
  assert.deepEqual(await lint("ui/a.js", 'import x from "y";\ndocument.title = String(x);\n'), []);
  assert.deepEqual(await lint("domain/a.js", "require('x');\n"), ["no-undef"]);
});

test("tests and tools are CommonJS for Node.js and must not be focused or skipped", async () => {
  assert.deepEqual(await lint("tests/unit/a.test.js", 'const test = require("node:test");\ntest("a", () => {});\n'), []);
  assert.deepEqual(await lint("tests/unit/b.test.js", 'const test = require("node:test");\ntest.only("a", () => {});\n'), ["no-restricted-syntax"]);
  assert.deepEqual(await lint("tests/e2e/c.spec.js", 'module.exports = () => document.title;\n'), []);
});

test("generated, installed and app-specific paths are ignored", async () => {
  const linter = new ESLint({ overrideConfigFile: true, overrideConfig: config, cwd: process.cwd() });
  for (const file of ["dist/app.js", "vendor/x.js", "prototypes/x.js"]) assert.equal(await linter.isPathIgnored(file), true, file);
  assert.equal(await linter.isPathIgnored("ui/a.js"), false);
});
