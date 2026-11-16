import { read, stringify } from "../core/json.js";

/** @typedef {import("../core/json.js").MDLJsonDocument} MDLJsonDocument */
/** @typedef {import("../core/json.js").MDLJsonOrder} MDLJsonOrder */
/** @typedef {import("./storage.js").MDLStorageAdapter} MDLStorageAdapter */

/**
 * @typedef {object} MDLJsonFileOptions
 * @property {MDLStorageAdapter} adapter
 * @property {string} name File name within the adapter.
 * @property {number} format The format this app writes (see core/json).
 * @property {() => MDLJsonDocument} initial The document when the file is missing or unreadable.
 * @property {MDLJsonOrder} [order]
 * @property {() => void} [unreadable] Called before an unreadable file is replaced.
 */

/**
 * A versioned JSON document in a storage adapter, changed by read-modify-write steps that run one after another.
 * A missing file is created from `initial`; an unreadable one is replaced; a newer format is never written.
 * @param {MDLJsonFileOptions} options
 */
export function create({ adapter, name, format, initial, order, unreadable }) {
  /** @type {Promise<unknown>} */
  let tail = Promise.resolve();

  /**
   * Applies `change` to the stored document. Resolves to `false` when the file has a newer format and stays untouched;
   * rejects when reading or writing fails, or with `MDLStorageConflictError` when the file changed in between.
   * @param {(document: MDLJsonDocument) => MDLJsonDocument | Promise<MDLJsonDocument>} change
   * @returns {Promise<boolean>}
   */
  function update(change) {
    const run = tail.then(async () => {
      const stored = await adapter.read(name);
      const parsed = stored ? read(stored.text, { format }) : { value: null, error: null };
      if (parsed.error === "newer") return false;
      if (parsed.error === "unreadable") unreadable?.();
      const next = await change(parsed.value ?? initial());
      await adapter.write(name, stringify(next, { order }), stored ? stored.text : null);
      return true;
    });
    tail = run.catch(() => {});
    return run;
  }

  return { update };
}
