/**
 * @typedef {object} MDLRecentItem
 * @property {string} id
 * @property {string} name
 * @property {number} openedAt Milliseconds since the epoch.
 */
/**
 * @typedef {object} MDLRecentOptions
 * @property {HTMLElement} list The `<ul>` that receives the rows.
 * @property {MDLRecentItem[]} items Most recently opened first.
 * @property {(openedAt: number) => string} format Text of the time, e.g. `16.11.2026 09:30`.
 * @property {(name: string) => string} icon Markup of an icon: `item`, `remove`.
 * @property {{ empty: string, remove(name: string): string }} strings Text of the empty list; accessible name of a remove button.
 */
/**
 * Renders a list of recently opened documents or folders, as on a start page. Each row is a button with icon, name
 * and time (`data-recent` = id) and a remove button (`data-forget` = id); the app handles their clicks.
 * Classes: `recent-item`, `recent-open`, `recent-icon`, `recent-name`, `recent-time`, `recent-remove`, `recent-empty`.
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
     * Text of the time, e.g. `16.11.2026 09:30`.
     */
    format: (openedAt: number) => string;
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
