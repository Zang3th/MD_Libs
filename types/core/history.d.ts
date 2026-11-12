/**
 * @typedef {object} MDLAction
 * @property {string} label
 * @property {() => unknown} redo Applies the change; returning `false` from `execute` marks it as a no-op.
 * @property {() => unknown} undo
 * @property {unknown} [beforeViewState]
 * @property {unknown} [afterViewState]
 * @property {number} [size] Approximate retained bytes, counted against `maxBytes`.
 */
/**
 * @template {MDLAction} [A=MDLAction]
 * @typedef {{ label: string, viewState: A["beforeViewState"] | A["afterViewState"], action: A }} MDLStep
 */
/**
 * @template {MDLAction} [A=MDLAction]
 * @typedef {object} MDLHistory
 * @property {(action: A) => boolean} execute Runs `redo()` and records it unless it returned `false`; rolls back and rethrows on failure.
 * @property {(action: A) => void} commit Records an action that has already been applied.
 * @property {(action: A) => void} replaceCurrent Replaces the newest entry, for coalescing typing; no-op unless it is current.
 * @property {() => void} clear
 * @property {() => MDLStep<A> | null} undo
 * @property {() => MDLStep<A> | null} redo
 * @property {(position?: number) => void} markSaved Marks the state at `position` (default: current) as saved.
 * @property {boolean} canUndo
 * @property {boolean} canRedo
 * @property {string} undoLabel
 * @property {string} redoLabel
 * @property {number} position Increases with every recorded or redone action, decreases with every undo.
 * @property {number} unsaved Steps between the current state and the saved state.
 */
/**
 * Bounded undo history. Entries are dropped from the front when `maxEntries` or `maxBytes` is exceeded;
 * the distance to the saved state survives trimming and discarded redo branches.
 * @template {MDLAction} [A=MDLAction]
 * @param {{ maxEntries?: number, maxBytes?: number }} [options]
 * @returns {MDLHistory<A>}
 */
export function create<A extends MDLAction = MDLAction>({ maxEntries, maxBytes }?: {
    maxEntries?: number;
    maxBytes?: number;
}): MDLHistory<A>;
/** @typedef {"saved" | "unsaved" | "conflict"} MDLSaveStatus */
/**
 * @typedef {object} MDLControlStrings
 * @property {(label: string) => string} undo Receives the label of the next undo step, or `""`.
 * @property {(label: string) => string} redo Receives the label of the next redo step, or `""`.
 * @property {(status: MDLSaveStatus, count: number) => string} save
 */
/**
 * @typedef {object} MDLControlState
 * @property {{ disabled: boolean, label: string }} undo
 * @property {{ disabled: boolean, label: string }} redo
 * @property {{ status: MDLSaveStatus, count: number, label: string }} save
 */
/**
 * State of the save, undo and redo controls. Without a history (no file open) everything is disabled and saved.
 * @param {{ history: { canUndo: boolean, canRedo: boolean, undoLabel: string, redoLabel: string } | null, unsaved: number, conflict?: boolean, strings: MDLControlStrings }} options
 *   `unsaved` counts unsaved changes; any positive number means unsaved.
 * @returns {MDLControlState}
 */
export function controls({ history, unsaved, conflict, strings }: {
    history: {
        canUndo: boolean;
        canRedo: boolean;
        undoLabel: string;
        redoLabel: string;
    } | null;
    unsaved: number;
    conflict?: boolean;
    strings: MDLControlStrings;
}): MDLControlState;
export type MDLAction = {
    label: string;
    /**
     * Applies the change; returning `false` from `execute` marks it as a no-op.
     */
    redo: () => unknown;
    undo: () => unknown;
    beforeViewState?: unknown;
    afterViewState?: unknown;
    /**
     * Approximate retained bytes, counted against `maxBytes`.
     */
    size?: number;
};
export type MDLStep<A extends MDLAction = MDLAction> = {
    label: string;
    viewState: A["beforeViewState"] | A["afterViewState"];
    action: A;
};
export type MDLHistory<A extends MDLAction = MDLAction> = {
    /**
     * Runs `redo()` and records it unless it returned `false`; rolls back and rethrows on failure.
     */
    execute: (action: A) => boolean;
    /**
     * Records an action that has already been applied.
     */
    commit: (action: A) => void;
    /**
     * Replaces the newest entry, for coalescing typing; no-op unless it is current.
     */
    replaceCurrent: (action: A) => void;
    clear: () => void;
    undo: () => MDLStep<A> | null;
    redo: () => MDLStep<A> | null;
    /**
     * Marks the state at `position` (default: current) as saved.
     */
    markSaved: (position?: number) => void;
    canUndo: boolean;
    canRedo: boolean;
    undoLabel: string;
    redoLabel: string;
    /**
     * Increases with every recorded or redone action, decreases with every undo.
     */
    position: number;
    /**
     * Steps between the current state and the saved state.
     */
    unsaved: number;
};
export type MDLSaveStatus = "saved" | "unsaved" | "conflict";
export type MDLControlStrings = {
    /**
     * Receives the label of the next undo step, or `""`.
     */
    undo: (label: string) => string;
    /**
     * Receives the label of the next redo step, or `""`.
     */
    redo: (label: string) => string;
    save: (status: MDLSaveStatus, count: number) => string;
};
export type MDLControlState = {
    undo: {
        disabled: boolean;
        label: string;
    };
    redo: {
        disabled: boolean;
        label: string;
    };
    save: {
        status: MDLSaveStatus;
        count: number;
        label: string;
    };
};
