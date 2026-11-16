import assert from "node:assert/strict";
import test from "node:test";
import { device } from "../../src/platform/index.js";

test("the device ID is created once and then read from storage", () => {
  /** @type {Map<string, string>} */
  const stored = new Map();
  const storage = {
    getItem: (/** @type {string} */ key) => stored.get(key) ?? null,
    setItem: (/** @type {string} */ key, /** @type {string} */ value) => { stored.set(key, value); }
  };
  let next = 0;
  const randomUUID = () => `id-${++next}`;
  assert.equal(device.id({ storage, key: "device", randomUUID }), "id-1");
  assert.equal(device.id({ storage, key: "device", randomUUID }), "id-1");
  assert.equal(stored.get("device"), "id-1");
});

test("blocked or missing storage yields a fresh ID without throwing", () => {
  const blocked = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } };
  assert.equal(device.id({ storage: blocked, key: "device", randomUUID: () => "fresh" }), "fresh");
  assert.equal(device.id({ storage: null, key: "device", randomUUID: () => "other" }), "other");
});
