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
 * @param {{ history: { canUndo: boolean, canRedo: boolean, undoLabel: string, redoLabel: string } | null, unsaved: number, conflict?: boolean }} input
 *   `unsaved` counts unsaved changes; any positive number means unsaved.
 * @param {MDLControlStrings} strings
 * @returns {MDLControlState}
 */
export function state({ history, unsaved, conflict = false }, strings) {
  const canUndo = Boolean(history?.canUndo);
  const canRedo = Boolean(history?.canRedo);
  const count = history ? Math.max(0, unsaved) : 0;
  /** @type {MDLSaveStatus} */
  const status = conflict ? "conflict" : count > 0 ? "unsaved" : "saved";
  return {
    undo: { disabled: !canUndo, label: strings.undo(canUndo ? history?.undoLabel || "" : "") },
    redo: { disabled: !canRedo, label: strings.redo(canRedo ? history?.redoLabel || "" : "") },
    save: { status, count, label: strings.save(status, count) }
  };
}
