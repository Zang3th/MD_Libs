import assert from "node:assert/strict";
import test from "node:test";
import { notifications } from "../../src/ui/index.js";
import { createWindow, size } from "../helpers/dom.js";

/** @param {Partial<import("../../src/ui/notifications.js").MDLNotificationsOptions>} [options] */
function setup(options = {}) {
  const window = createWindow('<div id="notifications"></div>');
  const container = /** @type {HTMLElement} */ (window.document.getElementById("notifications"));
  size(container, { clientHeight: 1000 });
  const stack = notifications.create({ window, container, defaultCode: "APP-000", ...options });
  return { window, container, stack };
}

/** @param {any} window */
function settle(window) {
  return new Promise(resolve => window.setTimeout(resolve, 0));
}

test("text is compacted and shortened; bodies with values flatten for copying", () => {
  assert.equal(notifications.readableText("  a \n b  ", 20), " a b ");
  assert.equal(notifications.readableText("abcdefghij", 5), "abcd…");
  assert.equal(notifications.fullText(["File ", { value: "A.md" }, " saved."]), "File A.md saved.");
  assert.equal(notifications.fullText("plain"), "plain");
});

test("trimming drops the oldest dismissible notifications until the stack fits", () => {
  const stack = [{ height: 40, persistent: true }, { height: 40, persistent: false }, { height: 40, persistent: false }, { height: 40, persistent: false }];
  assert.deepEqual(notifications.planTrim(stack, 10, 1000), []);
  assert.deepEqual(notifications.planTrim(stack, 10, 100), [1, 2]);
  assert.deepEqual(notifications.planTrim(stack.slice(0, 1), 10, 10), [], "persistent notifications stay");
});

test("info closes itself; the structure carries title, tag and highlighted values", () => {
  const { window, container, stack } = setup({ duration: 0 });
  const handle = stack.show("info", "File saved", [{ value: "A.md" }, " saved."]);
  const element = /** @type {HTMLElement} */ (container.firstElementChild);
  assert.equal(element.className, "notification notification-info");
  assert.equal(element.getAttribute("role"), "status");
  assert.equal(element.querySelector(".notification-title")?.textContent, "File saved");
  assert.equal(element.querySelector(".notification-tag")?.textContent, "Info");
  assert.equal(element.querySelector(".notification-value")?.textContent, "A.md");
  assert.equal(element.querySelector(".notification-copy-action"), null);
  assert.equal(handle.isOpen(), true);
  return settle(window).then(() => {
    assert.equal(handle.isOpen(), false);
    element.dispatchEvent(new window.Event("animationend"));
    assert.equal(container.children.length, 0);
  });
});

test("errors stay, can be closed and copy their code, title and details", async () => {
  const { window, container, stack } = setup({ duration: 0 });
  /** @type {string[]} */
  const copied = [];
  Object.defineProperty(window.navigator, "clipboard", { configurable: true, value: { writeText: async (/** @type {string} */ text) => { copied.push(text); } } });
  const handle = stack.show("error", "File check", "Could not check.", { code: "APP-103", details: "Disk gone" });
  const element = /** @type {HTMLElement} */ (container.firstElementChild);
  assert.equal(element.getAttribute("role"), "alert");
  assert.equal(element.querySelector(".notification-copy-note")?.textContent, "Extended details can be copied with the clipboard button.");
  await settle(window);
  assert.equal(handle.isOpen(), true, "errors do not close themselves");

  const copy = /** @type {HTMLButtonElement} */ (element.querySelector(".notification-copy-action"));
  copy.click();
  copy.click();
  await settle(window);
  assert.deepEqual(copied, ["Error: Code APP-103 File check\nDetails: Disk gone", "Error: Code APP-103 File check\nDetails: Disk gone"]);
  assert.equal(copy.getAttribute("aria-label"), "Error copied");
  assert.equal(copy.dataset.tooltip, "Copied");

  /** @type {HTMLButtonElement} */ (element.querySelector(".notification-actions .notification-action")).click();
  assert.equal(handle.isOpen(), false);
  handle.dismiss();
  element.dispatchEvent(new window.Event("animationend"));
  assert.equal(container.children.length, 0);
});

test("the copy button returns to its normal state after two seconds", async () => {
  const { window, container, stack } = setup();
  Object.defineProperty(window.navigator, "clipboard", { configurable: true, value: { writeText: async () => {} } });
  /** @type {Array<() => void>} */
  const timers = [];
  const setTimeout = window.setTimeout.bind(window);
  window.setTimeout = /** @type {any} */ ((/** @type {() => void} */ callback, /** @type {number} */ delay) => delay === 2000 ? (timers.push(callback), timers.length) : setTimeout(callback, delay));
  stack.show("error", "Broken", "Body");
  const copy = /** @type {HTMLButtonElement} */ (container.querySelector(".notification-copy-action"));
  copy.click();
  await settle(window);
  timers[0]();
  assert.equal(copy.getAttribute("aria-label"), "Copy error");
  assert.equal(copy.dataset.tooltip, "Copy error");
  copy.remove();
  timers[0]();
});

test("copying falls back to a selected textarea and reports failure in the tooltip", async () => {
  const { window, container, stack } = setup();
  Object.defineProperty(window.navigator, "clipboard", { configurable: true, value: undefined });
  let result = true;
  /** @type {string[]} */
  const copied = [];
  window.document.execCommand = () => { copied.push(/** @type {HTMLTextAreaElement} */ (window.document.querySelector("textarea")).value); return result; };
  stack.show("error", "Broken", "Body");
  const copy = /** @type {HTMLButtonElement} */ (container.querySelector(".notification-copy-action"));
  copy.click();
  await settle(window);
  assert.deepEqual(copied, ["Error: Code APP-000 Broken\nDetails: Body"]);
  result = false;
  copy.click();
  await settle(window);
  assert.equal(copy.dataset.tooltip, "Copy failed");
  assert.equal(window.document.querySelector("textarea"), null);
});

test("app texts, symbols, persistent notices with actions and empty bodies", () => {
  /** @type {string[]} */
  const ran = [];
  const { container, stack } = setup({
    strings: { tag: (severity, code) => severity === "error" ? code : "", close: "Schließen", copyNote: "" },
    symbols: { rocket: "<svg></svg>" }
  });
  stack.show("info", "Launched", "", { symbol: "rocket" });
  const info = /** @type {HTMLElement} */ (container.lastElementChild);
  assert.notEqual(info.querySelector(".notification-symbol-rocket svg"), null);
  assert.equal(info.querySelector(".notification-tag"), null);
  assert.equal(info.querySelector(".notification-body"), null, "an empty body is left out");

  const notice = stack.show("warning", "Changed", "", { persistent: true, actions: [{ label: "Reload", run: () => ran.push("reload") }, { label: "Overwrite", primary: true, run: () => ran.push("overwrite") }] });
  const warning = /** @type {HTMLElement} */ (container.lastElementChild);
  assert.equal(warning.dataset.persistent, "true");
  assert.equal(warning.querySelector(".notification-action")?.getAttribute("aria-label"), "Schließen");
  const buttons = /** @type {HTMLButtonElement[]} */ ([...warning.querySelectorAll(".notification-button")]);
  assert.deepEqual(buttons.map(button => button.className), ["notification-button", "notification-button notification-button-primary"]);
  buttons[1].click();
  assert.deepEqual([ran, notice.isOpen()], [["overwrite"], false]);

  stack.show("error", "Failed", "x", { code: "APP-201" });
  const error = /** @type {HTMLElement} */ (container.lastElementChild);
  assert.equal(error.querySelector(".notification-tag")?.textContent, "APP-201");
  assert.equal(error.querySelector(".notification-copy-note"), null);

  stack.show("error", "Failed without text", "");
  const bare = /** @type {HTMLElement} */ (container.lastElementChild);
  assert.equal(bare.querySelector(".notification-body"), null);
  assert.notEqual(bare.querySelector(".notification-actions .notification-copy-action"), null, "the copy button moves to the header");
});

test("a full stack drops old dismissible notifications and hides a cut error tag on resize", async () => {
  const { window, container, stack } = setup();
  size(container, { clientHeight: 100 });
  for (let index = 0; index < 3; index++) {
    stack.show("info", `#${index}`, "x");
    size(/** @type {Element} */ (container.lastElementChild), { offsetHeight: 40 });
  }
  stack.show("info", "#3", "x");
  assert.deepEqual([...container.querySelectorAll(".notification-title")].map(title => title.textContent), ["#1", "#2", "#3"]);

  stack.show("error", "A long error title", "x");
  const title = /** @type {Element} */ (container.lastElementChild?.querySelector(".notification-title"));
  size(title, { scrollWidth: 200, clientWidth: 100 });
  window.dispatchEvent(new window.Event("resize"));
  window.dispatchEvent(new window.Event("resize"));
  await new Promise(resolve => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)));
  assert.equal(/** @type {HTMLElement} */ (/** @type {Element} */ (container.lastElementChild).querySelector(".notification-tag")).hidden, true);
  window.dispatchEvent(new window.Event("resize"));
  stack.destroy();
});

test("fatal blocks the application; uncaught errors and rejections are reported until destroyed", () => {
  let blocked = 0;
  const { window, container, stack } = setup({
    block: () => { blocked++; },
    globalErrors: { title: "Application", body: "Unexpected error.", codes: { error: "APP-900", rejection: "APP-901" }, details: (kind, value) => `${kind}: ${value instanceof Error ? value.message : String(value)}` }
  });
  stack.fatal("Start failed", "Reload.", { code: "APP-004" });
  assert.equal(blocked, 1);
  window.dispatchEvent(new window.ErrorEvent("error", { error: new Error("boom"), message: "boom" }));
  const rejection = new window.Event("unhandledrejection");
  Object.defineProperty(rejection, "reason", { value: "late" });
  window.dispatchEvent(rejection);
  assert.equal(container.querySelectorAll(".notification-error").length, 3);
  stack.destroy();
  window.dispatchEvent(new window.ErrorEvent("error", { message: "after" }));
  assert.equal(container.children.length, 3);

  const quiet = setup();
  quiet.stack.fatal("Start failed", "Reload.");
  quiet.window.dispatchEvent(new quiet.window.ErrorEvent("error", { message: "ignored without globalErrors" }));
  quiet.window.dispatchEvent(new quiet.window.Event("unhandledrejection"));
  assert.equal(quiet.container.children.length, 1);
});
