/**
 * Collapses whitespace runs to one space, keeps one leading and trailing space when present
 * and shortens to `maxLength` with an ellipsis.
 * @param {string} value @param {number} maxLength
 */
export function readableText(value: string, maxLength: number): string;
/** @param {MDLNotificationBody} body */
export function fullText(body: MDLNotificationBody): string;
/**
 * Which notifications to drop, oldest first, so that the stack fits `capacity`. Persistent ones are kept.
 * @param {Array<{ height: number, persistent: boolean }>} stack Oldest first.
 * @param {number} gap @param {number} capacity
 * @returns {number[]} Indices into `stack`.
 */
export function planTrim(stack: Array<{
    height: number;
    persistent: boolean;
}>, gap: number, capacity: number): number[];
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
export function create({ window, container, strings: overrides, symbols, duration, maxTextLength, defaultCode, icon, block, globalErrors }: MDLNotificationsOptions): {
    show: (severity: MDLSeverity, title: string, body: MDLNotificationBody, options?: MDLNotificationOptions) => MDLNotificationHandle;
    fatal: (title: string, body: MDLNotificationBody, options?: {
        details?: MDLNotificationBody;
        code?: string;
    }) => MDLNotificationHandle;
    destroy(): void;
};
export type MDLNotificationsOptions = {
    window: Window;
    container: HTMLElement;
    /**
     * English defaults.
     */
    strings?: Partial<MDLNotificationStrings>;
    /**
     * Markup of an icon: `close`, `clipboard`, `check`.
     */
    icon?: (name: string) => string;
    /**
     * Markup per symbol name.
     */
    symbols?: Record<string, string>;
    /**
     * ms until info and warnings close themselves.
     */
    duration?: number;
    maxTextLength?: number;
    defaultCode?: string;
    /**
     * Disables the application for `fatal`.
     */
    block?: () => void;
    /**
     * Reports uncaught errors and unhandled rejections as errors.
     */
    globalErrors?: {
        title: string;
        body: string;
        codes: {
            error: string;
            rejection: string;
        };
        details(kind: "error" | "rejection", value: unknown): string;
    };
};
export type MDLSeverity = "info" | "warning" | "error";
/**
 * Parts as `{ value }` are highlighted.
 */
export type MDLNotificationBody = string | Array<string | {
    value: string;
}>;
export type MDLNotificationStrings = {
    /**
     * Text of the tag in the header; `""` shows none.
     */
    tag: (severity: MDLSeverity, code: string) => string;
    close: string;
    copy: string;
    /**
     * Accessible name after copying.
     */
    copied: string;
    copiedTooltip: string;
    copyFailed: string;
    /**
     * Shown below the text of errors; `""` shows none.
     */
    copyNote: string;
    /**
     * What the copy button puts on the clipboard.
     */
    copyText: (code: string, title: string, details: string) => string;
};
export type MDLNotificationOptions = {
    /**
     * Key of `symbols` shown before the title.
     */
    symbol?: string;
    /**
     * Copied instead of the body for errors.
     */
    details?: MDLNotificationBody;
    /**
     * Error code; default `defaultCode`.
     */
    code?: string;
    /**
     * Stays until closed; errors always stay.
     */
    persistent?: boolean;
    /**
     * Buttons that close the notification and run.
     */
    actions?: Array<{
        label: string;
        run(): void;
        primary?: boolean;
    }>;
};
export type MDLNotificationHandle = {
    dismiss(): void;
    isOpen(): boolean;
};
