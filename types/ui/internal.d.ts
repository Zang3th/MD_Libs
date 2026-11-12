/**
 * Coalesces repeated requests into one animation frame.
 * @param {Window} window @param {() => void} callback
 * @returns {{ schedule(): void, cancel(): void }}
 */
export function frame(window: Window, callback: () => void): {
    schedule(): void;
    cancel(): void;
};
/**
 * Writes text to the clipboard; without the async Clipboard API through a hidden, selected textarea.
 * Rejects when neither works.
 * @param {Window} window @param {string} value
 */
export function writeClipboard(window: Window, value: string): Promise<void>;
