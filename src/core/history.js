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
export function create({ maxEntries = 100, maxBytes = 8 * 1024 * 1024 } = {}) {
  /** @type {Array<A & { size: number }>} */
  let entries = [];
  let index = -1;
  let totalSize = 0;
  let position = 0;
  let savedPosition = 0;
  let savedDetour = 0;

  /** Drops entries after the current one; a saved state on that branch stays reachable only through the branch point. */
  function discardRedo() {
    const discarded = entries.splice(index + 1);
    totalSize -= discarded.reduce((size, entry) => size + entry.size, 0);
    if (discarded.length && savedPosition > position) leaveSavedBranch();
  }

  function leaveSavedBranch() {
    savedDetour += savedPosition - position;
    savedPosition = position;
  }

  function trim() {
    while (entries.length > 1 && (entries.length > maxEntries || totalSize > maxBytes)) {
      totalSize -= /** @type {{ size: number }} */ (entries.shift()).size;
      index -= 1;
    }
  }

  /** @param {A} action */
  function sized(action) {
    return { ...action, size: Math.max(0, action.size || 0) };
  }

  /** @param {A} action */
  function commit(action) {
    discardRedo();
    const entry = sized(action);
    entries.push(entry);
    index += 1;
    position += 1;
    totalSize += entry.size;
    trim();
  }

  return {
    execute(action) {
      let changed = false;
      try { changed = action.redo() !== false; }
      catch (error) {
        try { action.undo(); } catch { /* Preserve the original failure. */ }
        throw error;
      }
      if (changed) commit(action);
      return changed;
    },
    commit,
    replaceCurrent(action) {
      if (index < 0 || index !== entries.length - 1) return;
      // Equivalent to undoing the current entry and recording the replacement on a new branch.
      position -= 1;
      if (savedPosition > position) leaveSavedBranch();
      position += 1;
      const entry = sized(action);
      totalSize += entry.size - entries[index].size;
      entries[index] = { ...entries[index], label: action.label, redo: action.redo, afterViewState: action.afterViewState, size: entry.size };
      trim();
    },
    clear() {
      entries = [];
      index = -1;
      totalSize = 0;
    },
    undo() {
      if (index < 0) return null;
      const entry = entries[index];
      entry.undo();
      index -= 1;
      position -= 1;
      return { label: entry.label, viewState: entry.beforeViewState, action: entry };
    },
    redo() {
      if (index >= entries.length - 1) return null;
      const entry = entries[index + 1];
      entry.redo();
      index += 1;
      position += 1;
      return { label: entry.label, viewState: entry.afterViewState, action: entry };
    },
    markSaved(at = position) {
      savedPosition = at;
      savedDetour = 0;
    },
    get canUndo() { return index >= 0; },
    get canRedo() { return index < entries.length - 1; },
    get undoLabel() { return entries[index]?.label || ""; },
    get redoLabel() { return entries[index + 1]?.label || ""; },
    get position() { return position; },
    get unsaved() { return Math.abs(position - savedPosition) + savedDetour; }
  };
}
