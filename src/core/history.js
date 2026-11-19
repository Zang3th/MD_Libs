/**
 * @typedef {object} MDLAction
 * @property {string} label
 * @property {() => unknown} redo Applies the change; returning `false` from `execute` marks it as a no-op.
 * @property {() => unknown} undo
 * @property {unknown} [beforeViewState]
 * @property {unknown} [afterViewState]
 * @property {number} [size] Approximate retained bytes, counted against `maxBytes`.
 * @property {string} [coalesce] Actions with the same key that follow each other directly become one step.
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
 *
 * Two options keep the history to real changes. With `fingerprint`, a function that identifies the current data (see
 * `fingerprint` below), an action that returns the data to a state reached earlier on the current path drops the steps in
 * between, so that changes and their reversal (checking off and on, moving and moving back) leave no steps. Actions with
 * the same `coalesce` key that follow each other directly become one step, unless the state between them was saved.
 * @template {MDLAction} [A=MDLAction]
 * @param {{ maxEntries?: number, maxBytes?: number, fingerprint?: () => string }} [options]
 * @returns {MDLHistory<A>}
 */
export function create({ maxEntries = 100, maxBytes = 8 * 1024 * 1024, fingerprint } = {}) {
  /** @type {Array<A & { size: number, mark?: string }>} */
  let entries = [];
  /** Fingerprint of the state before the first entry, when known. @type {string | undefined} */
  let baseMark;
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
      const dropped = /** @type {{ size: number, mark?: string }} */ (entries.shift());
      totalSize -= dropped.size;
      baseMark = dropped.mark;
      index -= 1;
    }
  }

  /** The fingerprint of the state after entry `at`; -1 is the state before the first entry. @param {number} at */
  function markAt(at) {
    return at < 0 ? baseMark : entries[at].mark;
  }

  /**
   * Records the fingerprint of the current state and drops the steps back to an earlier equal state on the current path.
   * A saved state among the dropped ones is left like a discarded branch.
   */
  function settle() {
    if (!fingerprint || index < 0) return;
    const mark = fingerprint();
    entries[index].mark = mark;
    for (let at = index - 1; at >= -1; at--) {
      if (markAt(at) !== mark) continue;
      const dropped = entries.splice(at + 1);
      totalSize -= dropped.reduce((size, entry) => size + entry.size, 0);
      position -= dropped.length;
      index = at;
      if (savedPosition > position) leaveSavedBranch();
      return;
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
      // The state before the first action of a fresh history is the base the fingerprints compare with.
      if (fingerprint && index === entries.length - 1 && markAt(index) === undefined) {
        if (index < 0) baseMark = fingerprint();
        else entries[index].mark = fingerprint();
      }
      let changed = false;
      try { changed = action.redo() !== false; }
      catch (error) {
        try { action.undo(); } catch { /* Preserve the original failure. */ }
        throw error;
      }
      if (!changed) return false;
      const last = entries[index];
      if (action.coalesce && last && last.coalesce === action.coalesce && index === entries.length - 1 && savedPosition !== position) {
        // One step for both: undo reverts the new action, then the previous one.
        entries[index] = {
          ...action,
          size: last.size + Math.max(0, action.size || 0),
          beforeViewState: last.beforeViewState,
          redo() { last.redo(); return action.redo(); },
          undo() { action.undo(); last.undo(); }
        };
        totalSize += Math.max(0, action.size || 0);
        trim();
      } else commit(action);
      settle();
      return true;
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
      // The replacement changed the state after this entry: its fingerprint is taken anew, and an equal earlier state
      // drops the steps in between as after `execute`.
      delete entries[index].mark;
      trim();
      settle();
    },
    clear() {
      entries = [];
      index = -1;
      totalSize = 0;
      baseMark = undefined;
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
export function controls({ history, unsaved, conflict = false, strings }) {
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

/**
 * A short fingerprint of texts for `create({ fingerprint })`: a 53-bit hash (cyrb53) of the texts and their lengths, as
 * hexadecimal. Equal texts give equal fingerprints; different texts collide with negligible probability.
 * @param {readonly string[]} texts
 */
export function fingerprint(texts) {
  let first = 0xdeadbeef;
  let second = 0x41c6ce57;
  /** @param {number} code */
  const mix = code => {
    first = Math.imul(first ^ code, 2654435761);
    second = Math.imul(second ^ code, 1597334677);
  };
  // Each text with its length before it, so that the boundaries count; no copy of the texts is made.
  for (const text of texts) {
    mix(text.length);
    for (let at = 0; at < text.length; at++) mix(text.charCodeAt(at));
  }
  first = Math.imul(first ^ (first >>> 16), 2246822507) ^ Math.imul(second ^ (second >>> 13), 3266489909);
  second = Math.imul(second ^ (second >>> 16), 2246822507) ^ Math.imul(first ^ (first >>> 13), 3266489909);
  return (4294967296 * (2097151 & second) + (first >>> 0)).toString(16);
}
