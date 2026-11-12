// Helpers shared by the ui modules; not part of the public API.

/**
 * Coalesces repeated requests into one animation frame.
 * @param {Window} window @param {() => void} callback
 * @returns {{ schedule(): void, cancel(): void }}
 */
export function frame(window, callback) {
  let pending = 0;
  return {
    schedule() {
      if (pending) return;
      pending = window.requestAnimationFrame(() => {
        pending = 0;
        callback();
      });
    },
    cancel() {
      if (pending) window.cancelAnimationFrame(pending);
      pending = 0;
    }
  };
}

/**
 * Writes text to the clipboard; without the async Clipboard API through a hidden, selected textarea.
 * Rejects when neither works.
 * @param {Window} window @param {string} value
 */
export async function writeClipboard(window, value) {
  const { document, navigator } = window;
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("Clipboard copy is unavailable.");
}
