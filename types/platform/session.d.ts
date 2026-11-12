/**
 * Saving and external-change handling for the files of one opened project or folder.
 * Create one session per opened location and destroy it before opening the next.
 * @param {MDLSessionOptions} options
 * @returns {MDLSession}
 */
export function create({ adapter, files, initial, history, order, reloadWhenClean, contentCheckInterval, now, window, checkInterval, shouldCheck, confirmLeave }: MDLSessionOptions): MDLSession;
/**
 * Reads every file through the adapter, applies it with `load` and creates the session over what was read.
 * Rejects without a session when a read or a `load` fails.
 * @param {MDLSessionOpenOptions} options
 * @returns {Promise<MDLSession>}
 */
export function open(options: MDLSessionOpenOptions): Promise<MDLSession>;
export type MDLStorageAdapter = import("./storage.js").MDLStorageAdapter;
export type MDLStoredFile = import("./storage.js").MDLStoredFile;
/**
 * A version found on disk; `null` text when deleted.
 */
export type MDLExternalVersion = {
    text: string | null;
    stamp: string | null;
};
export type MDLSessionFile = {
    /**
     * Default `true`. Read-only files are never written and always reloaded when they change.
     */
    writable?: boolean;
    /**
     * Current content of a writable file; called often, so it should be cheap or cached.
     */
    serialize?: () => string;
    /**
     * Applies a version from disk (`null`: missing) to the app's model.
     * Must throw before changing anything when the text cannot be used.
     */
    load: (text: string | null) => void;
};
export type MDLSessionOptions = {
    adapter: MDLStorageAdapter;
    files: Record<string, MDLSessionFile>;
    /**
     * What the app loaded, per file; missing names count as missing files.
     */
    initial: Record<string, MDLStoredFile | null>;
    /**
     * With a history, the unsaved count is the history's distance to the saved state; without, it is 1 while any
     * writable file differs from its saved content. The getter may return a new history after a reload.
     */
    history?: () => {
        unsaved: number;
        markSaved(position?: number): void;
        position: number;
    };
    /**
     * Writable files in the order a save writes them. Default: declaration order.
     */
    order?: () => string[];
    /**
     * Reload a changed writable file without asking when nothing is unsaved.
     */
    reloadWhenClean?: boolean;
    /**
     * While the stamp is unchanged, the content is read again only after this many ms.
     */
    contentCheckInterval?: number;
    now?: () => number;
    /**
     * Checks for external changes every `checkInterval` ms, on window focus and when the
     * page becomes visible; never while the page is hidden. Without a window the app calls `check()` itself.
     */
    window?: Window;
    /**
     * Default 2000.
     */
    checkInterval?: number;
    /**
     * Skips an automatic check when it returns `false`.
     */
    shouldCheck?: () => boolean;
    /**
     * Asks before the page is left while something is unsaved or in conflict. Needs `window`.
     */
    confirmLeave?: boolean;
};
export type MDLSessionOpenOptions = Omit<MDLSessionOptions, "initial">;
export type MDLSessionEvents = {
    change: undefined;
    conflict: {
        files: string[];
    };
    blocked: undefined;
    saved: {
        files: string[];
    };
    reloaded: {
        file: string;
    };
    checkError: {
        file: string;
        error: unknown;
        deleted: boolean;
    };
};
export type MDLSession = {
    /**
     * Writes changed files with a version check. Calls during a save
     * coalesce into one more pass. Rejects when a write fails for a reason other than a conflict.
     */
    save: (force?: boolean) => Promise<void>;
    /**
     * Looks for external changes; skipped while a check or save is running.
     */
    check: () => Promise<void>;
    /**
     * Discards local changes of writable files and applies the external versions.
     * `false` without a conflict. Rethrows a failing `load` before anything changed.
     */
    reload: () => boolean;
    /**
     * Saves over the external versions; `false` without a conflict.
     */
    overwrite: () => Promise<boolean>;
    /**
     * Ignores every result still in flight and removes all listeners.
     */
    destroy: () => void;
    on: <E extends keyof MDLSessionEvents>(event: E, listener: (detail: MDLSessionEvents[E]) => void) => () => void;
    unsaved: number;
    hasConflict: boolean;
    conflicts: Array<{
        file: string;
    } & MDLExternalVersion>;
};
