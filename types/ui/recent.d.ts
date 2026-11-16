/**
 * @typedef {object} MDLRecentItem
 * @property {string} id
 * @property {string} name
 * @property {number} openedAt Milliseconds since the epoch.
 * @property {string} [detail] A second, smaller line below the name, e.g. a path or a summary.
 */
/**
 * @typedef {object} MDLRecentOptions
 * @property {HTMLElement} list The `<ul>` that receives the rows.
 * @property {MDLRecentItem[]} items Most recently opened first.
 * @property {(openedAt: number) => string | { date: string, time: string }} format Text of the time; with `date` and
 *   `time` both are shown as separate lines, e.g. `Today` above `09:30`.
 * @property {(name: string) => string} icon Markup of an icon: `item`, `remove`.
 * @property {{ empty: string, remove(name: string): string }} strings Text of the empty list; accessible name of a remove button.
 */
/**
 * Renders a list of recently opened documents or folders, as on a start page. Each row is a button with icon, name,
 * optional detail line and time (`data-recent` = id) and a remove button (`data-forget` = id); the app handles their clicks.
 * Classes: `recent-item`, `recent-open`, `recent-icon`, `recent-label`, `recent-name`, `recent-detail`, `recent-time`
 * (with `recent-date` and `recent-clock`), `recent-remove`, `recent-empty`.
 * @param {MDLRecentOptions} options
 */
export function render({ list, items, format, icon, strings }: MDLRecentOptions): void;
export type MDLRecentItem = {
    id: string;
    name: string;
    /**
     * Milliseconds since the epoch.
     */
    openedAt: number;
    /**
     * A second, smaller line below the name, e.g. a path or a summary.
     */
    detail?: string;
};
export type MDLRecentOptions = {
    /**
     * The `<ul>` that receives the rows.
     */
    list: HTMLElement;
    /**
     * Most recently opened first.
     */
    items: MDLRecentItem[];
    /**
     * Text of the time; with `date` and
     * `time` both are shown as separate lines, e.g. `Today` above `09:30`.
     */
    format: (openedAt: number) => string | {
        date: string;
        time: string;
    };
    /**
     * Markup of an icon: `item`, `remove`.
     */
    icon: (name: string) => string;
    /**
     * Text of the empty list; accessible name of a remove button.
     */
    strings: {
        empty: string;
        remove(name: string): string;
    };
};
