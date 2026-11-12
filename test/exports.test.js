import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import * as core from "../src/core/index.js";
import * as platform from "../src/platform/index.js";
import * as ui from "../src/ui/index.js";

const require = createRequire(import.meta.url);

/** @param {Record<string, object>} entry */
function shape(entry) {
  return Object.fromEntries(Object.entries(entry).map(([name, module]) => [name, Object.keys(module).sort()]));
}

// A change here changes the public API: update both applications in the same piece of work (AGENTS.md).
test("core exports", () => {
  assert.deepEqual(shape(core), {
    dates: ["addDays", "addPeriod", "dayNumber", "diff", "format", "formatPattern", "fromTime", "isoWeek", "monthStart", "parse", "periodStart", "toTime", "today", "weekStart"],
    history: ["controls", "create"],
    markdown: ["escapeHtml", "inline", "invalidCharacter", "join", "keyBlocks", "plainText", "split", "trailingTag"],
    search: ["create"]
  });
});

test("platform exports", () => {
  assert.deepEqual(shape(platform), {
    audio: ["create", "fillPlate", "voiceTiming"],
    handles: ["create"],
    session: ["create", "open"],
    startup: ["missingApis", "missingResources"],
    storage: ["MDLStorageConflictError", "ensurePermission", "file", "folder", "memory"]
  });
});

test("ui exports", () => {
  assert.deepEqual(shape(ui), {
    keymap: ["create", "isEditable", "matches", "parse"],
    notifications: ["create", "fullText", "planTrim", "readableText"],
    popover: ["create", "place", "point", "viewport"],
    sortable: ["create", "dropIndex", "position"],
    tooltips: ["create"]
  });
});

test("harness exports", () => {
  const packageJson = require("../package.json");
  assert.deepEqual(Object.keys(packageJson.exports), ["./core", "./platform", "./ui", "./harness/build", "./harness/testing", "./harness/checks", "./package.json"]);
  assert.deepEqual(Object.keys(require("../src/harness/build.cjs")).sort(), ["build", "bundleForTests", "bundleOptions"]);
  assert.deepEqual(Object.keys(require("../src/harness/testing.cjs")).sort(), ["audioContext", "clock", "fileSystem", "flush", "gate", "indexedDB", "loadClassic", "storageContract"]);
  assert.deepEqual(Object.keys(require("../src/harness/checks.cjs")).sort(), ["compareIcons", "createChecker", "eslintConfig", "exactFileExists", "executableSource", "formatStats", "noFocusedTests", "printResult", "projectStats"]);
});
