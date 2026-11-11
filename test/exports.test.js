import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import * as core from "../src/core/index.js";
import * as platform from "../src/platform/index.js";

const require = createRequire(import.meta.url);

/** @param {Record<string, object>} entry */
function shape(entry) {
  return Object.fromEntries(Object.entries(entry).map(([name, module]) => [name, Object.keys(module).sort()]));
}

// A change here changes the public API: update both applications in the same piece of work (AGENTS.md).
test("core exports", () => {
  assert.deepEqual(shape(core), {
    controls: ["state"],
    dates: ["addDays", "dayNumber", "diff", "format", "formatPattern", "fromTime", "isoWeek", "monthStart", "parse", "toTime", "today", "weekStart"],
    history: ["create"],
    inline: ["parse", "plainText"],
    markdown: ["keyBlocks", "trailingTag"],
    search: ["createIndex", "prepare", "score"],
    text: ["escapeHtml", "join", "split"]
  });
});

test("platform exports", () => {
  assert.deepEqual(shape(platform), {
    handles: ["create"],
    session: ["create"],
    startup: ["missingResources"],
    storage: ["MDLStorageConflictError", "ensurePermission", "file", "folder", "memory", "missingApis", "stampOf"]
  });
});

test("harness exports", () => {
  const packageJson = require("../package.json");
  assert.deepEqual(Object.keys(packageJson.exports), ["./core", "./platform", "./harness/build", "./harness/fakes", "./harness/storage-contract", "./package.json"]);
  assert.deepEqual(Object.keys(require("../src/harness/build.cjs")).sort(), ["build", "bundleForTests", "bundleOptions"]);
  assert.deepEqual(Object.keys(require("../src/harness/fakes.cjs")).sort(), ["clock", "fileSystem", "flush", "gate", "indexedDB"]);
  assert.deepEqual(Object.keys(require("../src/harness/storage-contract.cjs")), ["storageContract"]);
});
