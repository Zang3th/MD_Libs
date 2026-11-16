import assert from "node:assert/strict";
import test from "node:test";
import { startup } from "../../src/platform/index.js";

/** @param {{ token?: string, fonts?: Record<string, boolean | Error> }} options */
function fakeDocument({ token = "", fonts = {} }) {
  return /** @type {any} */ ({
    documentElement: {},
    defaultView: { getComputedStyle: () => ({ getPropertyValue: () => token }) },
    fonts: {
      async load(/** @type {string} */ font) {
        const result = fonts[font];
        if (result instanceof Error) throw result;
        return result ? [{}] : [];
      }
    }
  });
}

/** @param {"loaded" | "broken" | "pending-load" | "pending-error"} state */
function image(state) {
  /** @type {Record<string, () => void>} */
  const listeners = {};
  const element = {
    complete: state === "loaded" || state === "broken",
    naturalWidth: state === "loaded" ? 10 : 0,
    addEventListener(/** @type {string} */ type, /** @type {() => void} */ listener) { listeners[type] = listener; }
  };
  if (state.startsWith("pending")) queueMicrotask(() => listeners[state === "pending-load" ? "load" : "error"]());
  return /** @type {any} */ (element);
}

test("all resources present report nothing", async () => {
  const document = fakeDocument({ token: " #fff ", fonts: { "400 14px A": true } });
  assert.deepEqual(await startup.missingResources({
    document,
    styles: { token: "--bg", file: "styles.css" },
    fonts: [{ font: "400 14px A", file: "a.woff2" }],
    images: [{ image: image("loaded"), file: "logo.svg" }, { image: image("pending-load"), file: "late.svg" }]
  }), []);
  assert.deepEqual(await startup.missingResources({ document }), []);
});

test("missing resources are listed as styles, fonts, then images", async () => {
  const document = fakeDocument({ fonts: { "400 14px A": false, "400 14px B": new Error("blocked"), "400 14px C": true } });
  assert.deepEqual(await startup.missingResources({
    document,
    styles: { token: "--bg", file: "styles.css" },
    fonts: [{ font: "400 14px A", file: "a.woff2" }, { font: "400 14px B", text: "Äb", file: "b.woff2" }, { font: "400 14px C", file: "c.woff2" }],
    images: [{ image: null, file: "none.svg" }, { image: image("broken"), file: "broken.svg" }, { image: image("pending-error"), file: "late.svg" }, { image: /** @type {any} */ ({}), file: "div.svg" }]
  }), ["styles.css", "a.woff2", "b.woff2", "none.svg", "broken.svg", "late.svg", "div.svg"]);
});

test("missing APIs are reported as expressions; names ending in () must be functions", () => {
  const window = { showOpenFilePicker() {}, showSaveFilePicker: "not a function", indexedDB: {} };
  assert.deepEqual(startup.missingApis({ window, apis: ["showOpenFilePicker()", "showSaveFilePicker()", "showDirectoryPicker()", "indexedDB", "caches"] }),
    ["window.showSaveFilePicker()", "window.showDirectoryPicker()", "caches"]);
});

test("a reload flag is taken once and expires when the reload does not happen", () => {
  /** @type {Map<string, string>} */
  const stored = new Map();
  const storage = {
    getItem: (/** @type {string} */ key) => stored.get(key) ?? null,
    setItem: (/** @type {string} */ key, /** @type {string} */ value) => { stored.set(key, value); },
    removeItem: (/** @type {string} */ key) => { stored.delete(key); }
  };
  /** @type {Array<{ run: () => void, delay: number }>} */
  const timers = [];
  const window = { setTimeout: (/** @type {() => void} */ run, /** @type {number} */ delay) => { timers.push({ run, delay }); return timers.length; } };
  const flag = startup.reloadFlag({ storage, key: "skip", window: /** @type {any} */ (window) });
  assert.equal(flag.take(), false);
  flag.set();
  assert.equal(timers[0].delay, 2000);
  assert.equal(flag.take(), true);
  assert.equal(flag.take(), false);
  flag.set();
  timers[1].run();
  assert.equal(flag.take(), false);
});

test("a reload flag without usable storage is never set", () => {
  const broken = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); }, removeItem() { throw new Error("blocked"); } };
  let timers = 0;
  const flag = startup.reloadFlag({ storage: broken, key: "skip", window: /** @type {any} */ ({ setTimeout: () => ++timers }), expire: 10 });
  flag.set();
  assert.equal(timers, 0);
  assert.equal(flag.take(), false);
  const missing = startup.reloadFlag({ storage: null, key: "skip", window: /** @type {any} */ ({ setTimeout: () => ++timers }) });
  missing.set();
  assert.deepEqual([missing.take(), timers], [false, 0]);
  const readOnly = { getItem: () => "1", setItem() {}, removeItem() { throw new Error("blocked"); } };
  assert.equal(startup.reloadFlag({ storage: readOnly, key: "skip", window: /** @type {any} */ ({ setTimeout: () => 0 }) }).take(), true);
});
