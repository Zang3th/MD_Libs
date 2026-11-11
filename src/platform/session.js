/** @typedef {import("./storage.js").MDLStorageAdapter} MDLStorageAdapter */
/** @typedef {import("./storage.js").MDLStoredFile} MDLStoredFile */
/** @typedef {{ text: string | null, stamp: string | null }} MDLExternalVersion A version found on disk; `null` text when deleted. */

/**
 * @typedef {object} MDLSessionFile
 * @property {boolean} [writable] Default `true`. Read-only files are never written and always reloaded when they change.
 * @property {() => string} [serialize] Current content of a writable file; called often, so it should be cheap or cached.
 * @property {(text: string | null) => void} load Applies a version from disk (`null`: missing) to the app's model.
 *   Must throw before changing anything when the text cannot be used.
 */

/**
 * @typedef {object} MDLSessionOptions
 * @property {MDLStorageAdapter} adapter
 * @property {Record<string, MDLSessionFile>} files
 * @property {Record<string, MDLStoredFile | null>} initial What the app loaded, per file; missing names count as missing files.
 * @property {() => { unsaved: number, markSaved(position?: number): void, position: number }} [history]
 *   With a history, the unsaved count is the history's distance to the saved state; without, it is 1 while any
 *   writable file differs from its saved content. The getter may return a new history after a reload.
 * @property {() => string[]} [order] Writable files in the order a save writes them. Default: declaration order.
 * @property {boolean} [reloadWhenClean] Reload a changed writable file without asking when nothing is unsaved.
 * @property {number} [contentCheckInterval] While the stamp is unchanged, the content is read again only after this many ms.
 * @property {() => number} [now]
 */

/**
 * @typedef {{
 *   change: undefined,
 *   conflict: { files: string[] },
 *   blocked: undefined,
 *   saved: { files: string[] },
 *   reloaded: { file: string },
 *   checkError: { file: string, error: unknown, deleted: boolean }
 * }} MDLSessionEvents
 */

/**
 * @typedef {object} MDLSession
 * @property {(force?: boolean) => Promise<void>} save Writes changed files with a version check. Calls during a save
 *   coalesce into one more pass. Rejects when a write fails for a reason other than a conflict.
 * @property {() => Promise<void>} check Looks for external changes; skipped while a check or save is running.
 * @property {() => boolean} reload Discards local changes of writable files and applies the external versions.
 *   `false` without a conflict. Rethrows a failing `load` before anything changed.
 * @property {() => Promise<boolean>} overwrite Saves over the external versions; `false` without a conflict.
 * @property {() => void} destroy Ignores every result still in flight and removes all listeners.
 * @property {<E extends keyof MDLSessionEvents>(event: E, listener: (detail: MDLSessionEvents[E]) => void) => () => void} on
 * @property {number} unsaved
 * @property {boolean} hasConflict
 * @property {Array<{ file: string } & MDLExternalVersion>} conflicts
 */

/**
 * A stamp that identifies a version; `"0:0"` means the platform reported no metadata.
 * @param {string | null} stamp
 */
function reliable(stamp) {
  return Boolean(stamp) && stamp !== "0:0";
}

/** @param {unknown} error */
function isMissing(error) {
  return /** @type {{ name?: unknown }} */ (error)?.name === "NotFoundError";
}

/** @param {unknown} error */
function isConflict(error) {
  return /** @type {{ name?: unknown }} */ (error)?.name === "MDLStorageConflictError";
}

/**
 * Saving and external-change handling for the files of one opened project or folder.
 * Create one session per opened location and destroy it before opening the next.
 * @param {MDLSessionOptions} options
 * @returns {MDLSession}
 */
export function create({ adapter, files, initial, history, order, reloadWhenClean = false, contentCheckInterval = 30000, now = Date.now }) {
  const names = Object.keys(files);
  const writable = names.filter(name => files[name].writable !== false);
  /** @type {Record<string, { disk: MDLStoredFile | null, external: MDLExternalVersion | null, saved: string, contentCheck: number }>} */
  const state = {};
  for (const name of names) {
    state[name] = { disk: initial[name] ?? null, external: null, saved: "", contentCheck: 0 };
    if (files[name].writable !== false) state[name].saved = serialize(name);
  }
  /** @type {{ [E in keyof MDLSessionEvents]?: Set<(detail: MDLSessionEvents[E]) => void> }} */
  const listeners = {};
  let token = 0;
  let revision = 0;
  let destroyed = false;
  /** @type {{ token: number, revision: number } | null} */
  let checking = null;
  /** @type {{ token: number, promise: Promise<void>, again: boolean, force: boolean } | null} */
  let pending = null;
  let lastCheckError = "";

  /** @param {string} name */
  function serialize(name) {
    return /** @type {() => string} */ (files[name].serialize)();
  }

  /** @param {string} name */
  function changed(name) {
    return serialize(name) !== state[name].saved;
  }

  /**
   * @template {keyof MDLSessionEvents} E
   * @param {E} event @param {MDLSessionEvents[E]} [detail]
   */
  function emit(event, detail) {
    for (const listener of [...(listeners[event] || [])]) listener(/** @type {MDLSessionEvents[E]} */ (detail));
  }

  const hasConflict = () => writable.some(name => state[name].external);

  function unsaved() {
    if (!history) return writable.some(changed) ? 1 : 0;
    const current = history();
    // Data that serializes to the saved files again (an entry moved and moved back) counts as saved.
    if (current.unsaved > 0 && !hasConflict() && !writable.some(changed)) current.markSaved();
    return current.unsaved;
  }

  /** @param {string} name @param {string | null} text @param {MDLStoredFile | null} version */
  function useVersion(name, text, version) {
    files[name].load(text);
    state[name].disk = version;
    state[name].external = null;
    if (files[name].writable !== false) state[name].saved = serialize(name);
  }

  /** Compares a version read from disk with the known one and records, reloads or reports it. @param {string} name @param {MDLStoredFile | null} found */
  function inspect(name, found) {
    const file = state[name];
    const text = found?.text ?? null;
    if (text === (file.disk?.text ?? null)) {
      if (found) file.disk = found;
      if (file.external) {
        file.external = null;
        emit("change");
      }
      return;
    }
    if (file.external && file.external.text === text) return;
    if (files[name].writable === false || (reloadWhenClean && text !== null && unsaved() === 0 && !hasConflict())) {
      useVersion(name, text, found);
      emit("reloaded", { file: name });
      emit("change");
      return;
    }
    file.external = { text, stamp: found?.stamp ?? null };
    emit("change");
    emit("conflict", { files: [name] });
  }

  /** @param {unknown} error @param {string} name */
  function reportCheckError(error, name) {
    if (isMissing(error)) {
      const key = `deleted:${name}`;
      if (key === lastCheckError) return;
      lastCheckError = key;
      state[name].external = null;
      emit("change");
      emit("checkError", { file: name, error, deleted: true });
    } else if (error instanceof Error && error.message !== lastCheckError) {
      lastCheckError = error.message;
      emit("checkError", { file: name, error, deleted: false });
    }
  }

  /** @param {number} started @param {boolean} force */
  async function saveOnce(started, force) {
    if (started !== token) return;
    if (hasConflict() && !force) {
      emit("blocked");
      return;
    }
    const position = history?.().position;
    const targets = (order ? order() : writable).filter(name => changed(name) || (force && state[name].external));
    if (!targets.length && !force) {
      emit("saved", { files: [] });
      return;
    }
    revision++;
    /** @type {string[]} */
    const written = [];
    let complete = true;
    for (const name of targets) {
      const text = serialize(name);
      const file = state[name];
      const expected = force || adapter.canCheck === false ? undefined : file.disk?.text ?? null;
      try {
        const stamp = await adapter.write(name, text, expected);
        if (started !== token) return;
        file.disk = { text, stamp };
        file.external = null;
        file.saved = text;
        written.push(name);
      } catch (error) {
        if (started !== token) return;
        if (!isConflict(error)) throw error;
        const conflict = /** @type {{ text: string | null, stamp: string | null }} */ (error);
        inspect(name, conflict.text === null ? null : { text: conflict.text, stamp: conflict.stamp || "" });
        complete = false;
      }
    }
    revision++;
    if (adapter.canCheck !== false) {
      for (const name of written) {
        try {
          const found = await adapter.read(name);
          if (started !== token) return;
          state[name].contentCheck = now();
          lastCheckError = "";
          inspect(name, found);
        } catch (error) {
          if (started !== token) return;
          reportCheckError(error, name);
        }
      }
    }
    if (!complete) return;
    if (position !== undefined) history?.().markSaved(position);
    emit("change");
    emit("saved", { files: written });
  }

  /** @param {boolean} [force] */
  function save(force = false) {
    if (destroyed) return Promise.resolve();
    if (pending?.token === token) {
      pending.again = true;
      pending.force ||= force;
      return pending.promise;
    }
    const request = { token, promise: Promise.resolve(), again: false, force };
    pending = request;
    request.promise = (async () => {
      do {
        request.again = false;
        const overwrite = request.force;
        request.force = false;
        await saveOnce(request.token, overwrite);
      } while (request.again && request.token === token);
    })().finally(() => {
      if (pending === request) pending = null;
    });
    return request.promise;
  }

  async function check() {
    if (destroyed || adapter.canCheck === false || checking?.token === token || pending?.token === token) return;
    const captured = { token, revision };
    checking = captured;
    const current = () => captured.token === token && captured.revision === revision;
    let name = names[0];
    try {
      for (name of names) {
        const file = state[name];
        const stamp = await adapter.stat(name);
        if (!current()) return;
        lastCheckError = "";
        if (stamp === null && file.disk === null) continue;
        const time = now();
        if (reliable(file.disk?.stamp ?? null) && reliable(stamp) && stamp === file.disk?.stamp && time - file.contentCheck < contentCheckInterval) continue;
        const found = await adapter.read(name);
        if (!current()) return;
        file.contentCheck = time;
        inspect(name, found);
      }
    } catch (error) {
      if (current()) reportCheckError(error, name);
    } finally {
      if (checking === captured) checking = null;
    }
  }

  function reload() {
    if (destroyed || !hasConflict()) return false;
    const versions = writable.map(name => state[name].external ?? state[name].disk);
    writable.forEach((name, index) => files[name].load(versions[index]?.text ?? null));
    token++;
    revision++;
    checking = null;
    lastCheckError = "";
    writable.forEach((name, index) => {
      const version = versions[index];
      state[name].disk = version?.text === null || !version ? null : /** @type {MDLStoredFile} */ (version);
      state[name].external = null;
      state[name].saved = serialize(name);
    });
    emit("change");
    return true;
  }

  return {
    save,
    check,
    reload,
    async overwrite() {
      if (destroyed || !hasConflict()) return false;
      await save(true);
      return true;
    },
    destroy() {
      destroyed = true;
      token++;
      for (const event of /** @type {Array<keyof MDLSessionEvents>} */ (Object.keys(listeners))) delete listeners[event];
    },
    on(event, listener) {
      const set = /** @type {Set<typeof listener>} */ (listeners[event] ||= /** @type {any} */ (new Set()));
      set.add(listener);
      return () => { set.delete(listener); };
    },
    get unsaved() { return unsaved(); },
    get hasConflict() { return hasConflict(); },
    get conflicts() {
      return writable.filter(name => state[name].external).map(name => ({ file: name, .../** @type {MDLExternalVersion} */ (state[name].external) }));
    }
  };
}
