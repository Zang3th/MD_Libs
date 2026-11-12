import { frame, writeClipboard } from "./internal.js";

/** @typedef {"info" | "warning" | "error"} MDLSeverity */
/** @typedef {string | Array<string | { value: string }>} MDLNotificationBody Parts as `{ value }` are highlighted. */

/**
 * @typedef {object} MDLNotificationStrings
 * @property {(severity: MDLSeverity, code: string) => string} tag Text of the tag in the header; `""` shows none.
 * @property {string} close
 * @property {string} copy
 * @property {string} copied Accessible name after copying.
 * @property {string} copiedTooltip
 * @property {string} copyFailed
 * @property {string} copyNote Shown below the text of errors; `""` shows none.
 * @property {(code: string, title: string, details: string) => string} copyText What the copy button puts on the clipboard.
 */

/**
 * @typedef {object} MDLNotificationOptions
 * @property {string} [symbol] Key of `symbols` shown before the title.
 * @property {MDLNotificationBody} [details] Copied instead of the body for errors.
 * @property {string} [code] Error code; default `defaultCode`.
 * @property {boolean} [persistent] Stays until closed; errors always stay.
 * @property {Array<{ label: string, run(): void, primary?: boolean }>} [actions] Buttons that close the notification and run.
 */

/** @typedef {{ dismiss(): void, isOpen(): boolean }} MDLNotificationHandle */

/** @type {MDLNotificationStrings} */
const defaultStrings = {
  tag: severity => severity[0].toUpperCase() + severity.slice(1),
  close: "Close error",
  copy: "Copy error",
  copied: "Error copied",
  copiedTooltip: "Copied",
  copyFailed: "Copy failed",
  copyNote: "Extended details can be copied with the clipboard button.",
  copyText: (code, title, details) => `Error: Code ${code} ${title}\nDetails: ${details}`
};

/**
 * Collapses whitespace runs to one space, keeps one leading and trailing space when present
 * and shortens to `maxLength` with an ellipsis.
 * @param {string} value @param {number} maxLength
 */
export function readableText(value, maxLength) {
  const leading = /^\s/.test(value) ? " " : "";
  const trailing = /\s$/.test(value) ? " " : "";
  const compact = `${leading}${value.trim().replace(/\s+/g, " ")}${trailing}`;
  return compact.length <= maxLength ? compact : `${compact.slice(0, maxLength - 1).trimEnd()}…`;
}

/** @param {MDLNotificationBody} body */
export function fullText(body) {
  return typeof body === "string" ? body : body.map(part => typeof part === "string" ? part : part.value).join("");
}

/**
 * Which notifications to drop, oldest first, so that the stack fits `capacity`. Persistent ones are kept.
 * @param {Array<{ height: number, persistent: boolean }>} stack Oldest first.
 * @param {number} gap @param {number} capacity
 * @returns {number[]} Indices into `stack`.
 */
export function planTrim(stack, gap, capacity) {
  let used = stack.reduce((height, item) => height + item.height, Math.max(0, stack.length - 1) * gap);
  let remaining = stack.length;
  /** @type {number[]} */
  const removed = [];
  for (let index = 0; index < stack.length && used > capacity; index++) {
    if (stack[index].persistent) continue;
    used -= stack[index].height;
    if (remaining > 1) used -= gap;
    remaining--;
    removed.push(index);
  }
  return removed;
}

/**
 * @typedef {object} MDLNotificationsOptions
 * @property {Window} window
 * @property {HTMLElement} container
 * @property {Partial<MDLNotificationStrings>} [strings] English defaults.
 * @property {(name: string) => string} [icon] Markup of an icon: `close`, `clipboard`, `check`.
 * @property {Record<string, string>} [symbols] Markup per symbol name.
 * @property {number} [duration] ms until info and warnings close themselves.
 * @property {number} [maxTextLength]
 * @property {string} [defaultCode]
 * @property {() => void} [block] Disables the application for `fatal`.
 * @property {{ title: string, body: string, codes: { error: string, rejection: string }, details(kind: "error" | "rejection", value: unknown): string }} [globalErrors]
 *   Reports uncaught errors and unhandled rejections as errors.
 */

/**
 * Notification stack: info and warnings close themselves, errors stay and offer copyable details.
 * The DOM structure and classes are those of MD_Manager; styling is the app's.
 * @param {MDLNotificationsOptions} options
 */
export function create({
  window, container, strings: overrides = {}, symbols = {}, duration = 4000, maxTextLength = 180, defaultCode = "",
  icon = name => `<svg class="ui-icon" aria-hidden="true" viewBox="0 0 32 32"><use href="#icon-${name}"></use></svg>`,
  block = () => {}, globalErrors
}) {
  const strings = { ...defaultStrings, ...overrides };
  const { document } = window;
  /** @type {WeakMap<HTMLElement, number>} */
  const dismissTimers = new WeakMap();
  /** @type {WeakMap<HTMLElement, number>} */
  const copyTimers = new WeakMap();

  /** @param {HTMLElement} notification */
  function remove(notification) {
    window.clearTimeout(dismissTimers.get(notification));
    dismissTimers.delete(notification);
    window.clearTimeout(copyTimers.get(notification));
    copyTimers.delete(notification);
    notification.remove();
  }

  /** @param {HTMLElement} notification */
  function dismiss(notification) {
    if (!notification.isConnected || notification.classList.contains("notification-leaving")) return;
    window.clearTimeout(dismissTimers.get(notification));
    dismissTimers.delete(notification);
    notification.classList.add("notification-leaving");
    notification.addEventListener("animationend", () => remove(notification), { once: true });
  }

  function trim() {
    const stack = /** @type {HTMLElement[]} */ ([...container.children]);
    const gap = Number.parseFloat(window.getComputedStyle(container).rowGap) || 0;
    const plan = planTrim(stack.map(item => ({ height: item.offsetHeight, persistent: Boolean(item.dataset.persistent) })), gap, container.clientHeight);
    for (const index of plan) remove(stack[index]);
  }

  /** Hides the tag of an error when the title would be cut. @param {HTMLElement} notification */
  function fitTag(notification) {
    const tag = /** @type {HTMLElement | null} */ (notification.querySelector(".notification-tag"));
    const title = /** @type {HTMLElement} */ (notification.querySelector(".notification-title"));
    if (!tag) return;
    tag.hidden = false;
    if (title.scrollWidth > title.clientWidth) tag.hidden = true;
  }

  /** @param {string} name @param {string} label @param {string} [extraClass] */
  function iconButton(name, label, extraClass = "") {
    const button = document.createElement("button");
    button.className = `notification-action${extraClass}`;
    button.type = "button";
    button.setAttribute("aria-label", label);
    button.dataset.tooltip = label;
    button.innerHTML = icon(name);
    return button;
  }

  /** @param {HTMLElement} notification @param {HTMLButtonElement} button @param {string} value */
  async function copy(notification, button, value) {
    try {
      await writeClipboard(window, value);
      button.innerHTML = icon("check");
      button.setAttribute("aria-label", strings.copied);
      button.dataset.tooltip = strings.copiedTooltip;
      window.clearTimeout(copyTimers.get(notification));
      copyTimers.set(notification, window.setTimeout(() => {
        copyTimers.delete(notification);
        if (!button.isConnected) return;
        button.innerHTML = icon("clipboard");
        button.setAttribute("aria-label", strings.copy);
        button.dataset.tooltip = strings.copy;
      }, 2000));
    } catch {
      button.dataset.tooltip = strings.copyFailed;
    }
  }

  /** @param {MDLNotificationBody} body */
  function bodyText(body) {
    const text = document.createElement("div");
    text.className = "notification-text";
    for (const part of typeof body === "string" ? [body] : body) {
      if (typeof part === "string") text.append(readableText(part, maxTextLength));
      else {
        const value = document.createElement("span");
        value.className = "notification-value";
        value.textContent = readableText(part.value, maxTextLength);
        text.append(value);
      }
    }
    return text;
  }

  /**
   * @param {MDLSeverity} severity @param {string} title @param {MDLNotificationBody} body
   * @param {MDLNotificationOptions} [options]
   * @returns {MDLNotificationHandle}
   */
  function show(severity, title, body, options = {}) {
    const error = severity === "error";
    const persistent = error || Boolean(options.persistent);
    const code = options.code || defaultCode;
    const notification = document.createElement("article");
    notification.className = `notification notification-${severity}`;
    notification.setAttribute("role", error ? "alert" : "status");
    notification.setAttribute("aria-atomic", "true");
    if (persistent) notification.dataset.persistent = "true";

    const header = document.createElement("header");
    header.className = "notification-header";
    const heading = document.createElement("span");
    heading.className = "notification-heading";
    if (options.symbol && symbols[options.symbol]) {
      const symbol = document.createElement("span");
      symbol.className = `notification-symbol notification-symbol-${options.symbol}`;
      symbol.innerHTML = symbols[options.symbol];
      heading.append(symbol);
    }
    const titleElement = document.createElement("span");
    titleElement.className = "notification-title";
    titleElement.textContent = title;
    heading.append(titleElement);
    const controls = document.createElement("div");
    controls.className = "notification-controls";
    const tagText = strings.tag(severity, code);
    if (tagText) {
      const tag = document.createElement("span");
      tag.className = "notification-tag";
      tag.textContent = tagText;
      controls.append(tag);
    }
    const text = bodyText(body);
    /** @type {HTMLButtonElement | null} */
    let copyButton = null;
    if (error) {
      const button = iconButton("clipboard", strings.copy, " notification-copy-action");
      button.addEventListener("click", () => { void copy(notification, button, strings.copyText(code, title, fullText(options.details ?? body))); });
      copyButton = button;
    }
    if (persistent) {
      const actions = document.createElement("div");
      actions.className = "notification-actions";
      // Without text the copy button joins the header instead of standing alone in the body.
      if (copyButton && !text.textContent) actions.append(copyButton);
      const close = iconButton("close", strings.close);
      close.addEventListener("click", () => dismiss(notification));
      actions.append(close);
      controls.append(actions);
    }
    header.append(heading, controls);
    notification.append(header);

    if (text.textContent) {
      const bodyElement = document.createElement("div");
      bodyElement.className = "notification-body";
      const message = document.createElement("div");
      message.className = "notification-message";
      message.append(text);
      bodyElement.append(message);
      if (copyButton) {
        bodyElement.append(copyButton);
        if (strings.copyNote) {
          const note = document.createElement("span");
          note.className = "notification-copy-note";
          note.textContent = strings.copyNote;
          bodyElement.append(note);
        }
      }
      notification.append(bodyElement);
    }

    if (options.actions?.length) {
      const buttons = document.createElement("div");
      buttons.className = "notification-buttons";
      for (const action of options.actions) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `notification-button${action.primary ? " notification-button-primary" : ""}`;
        button.textContent = action.label;
        button.addEventListener("click", () => {
          dismiss(notification);
          action.run();
        });
        buttons.append(button);
      }
      notification.append(buttons);
    }

    container.append(notification);
    if (error) fitTag(notification);
    trim();
    container.scrollTop = container.scrollHeight;
    if (!persistent && notification.isConnected) dismissTimers.set(notification, window.setTimeout(() => dismiss(notification), duration));
    return {
      dismiss: () => dismiss(notification),
      isOpen: () => notification.isConnected && !notification.classList.contains("notification-leaving")
    };
  }

  /**
   * Blocks the application and shows why.
   * @param {string} title @param {MDLNotificationBody} body @param {{ details?: MDLNotificationBody, code?: string }} [options]
   */
  function fatal(title, body, options = {}) {
    block();
    return show("error", title, body, options);
  }

  const layout = frame(window, () => {
    container.querySelectorAll(".notification-error").forEach(notification => fitTag(/** @type {HTMLElement} */ (notification)));
    trim();
  });
  const onResize = () => layout.schedule();
  /** @param {ErrorEvent} event */
  const onError = event => {
    if (globalErrors) show("error", globalErrors.title, globalErrors.body, { code: globalErrors.codes.error, details: globalErrors.details("error", event.error || event.message) });
  };
  /** @param {PromiseRejectionEvent} event */
  const onRejection = event => {
    if (globalErrors) show("error", globalErrors.title, globalErrors.body, { code: globalErrors.codes.rejection, details: globalErrors.details("rejection", event.reason) });
  };
  window.addEventListener("resize", onResize);
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);

  return {
    show,
    fatal,
    destroy() {
      layout.cancel();
      window.removeEventListener("resize", onResize);
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    }
  };
}
