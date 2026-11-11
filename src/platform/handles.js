/**
 * @template {object} [D=object]
 * @typedef {{ id: string, name: string, openedAt: number, handle: MDLRememberedHandle } & D} MDLHandleRecord
 */

/** @typedef {{ name: string, isSameEntry(other: any): Promise<boolean> }} MDLRememberedHandle */

/**
 * @template {object} [D=object]
 * @typedef {object} MDLHandleStore
 * @property {() => Promise<Array<MDLHandleRecord<D>>>} list Newest first, at most `limit`.
 * @property {(handle: MDLRememberedHandle) => Promise<MDLHandleRecord<D> | undefined>} find The record of the same file or folder.
 * @property {(handle: MDLRememberedHandle, data?: (existing: MDLHandleRecord<D> | undefined) => D) => Promise<MDLHandleRecord<D>>} remember
 *   Stores the handle as most recently opened, merged with an earlier record of the same entry, and drops records beyond `limit`.
 * @property {(id: string) => Promise<void>} forget
 */

/**
 * Remembered file or folder handles in IndexedDB. One object store with `keyPath: "id"`; records keep
 * the app's own data next to `id`, `name`, `openedAt` and `handle`. Calls to `remember` run one after another.
 * @template {object} [D=object]
 * @param {{ indexedDB: IDBFactory, database: string, store: string, version?: number, limit: number, now?: () => number, random?: () => number }} options
 * @returns {MDLHandleStore<D>}
 */
export function create({ indexedDB, database, store, version = 1, limit, now = Date.now, random = Math.random }) {
  /** @type {Promise<unknown>} */
  let rememberQueue = Promise.resolve();

  /** @returns {Promise<IDBDatabase>} */
  function open() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(database, version);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(store)) request.result.createObjectStore(store, { keyPath: "id" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /** @param {(objectStore: IDBObjectStore) => void} change */
  async function write(change) {
    const connection = await open();
    try {
      await new Promise((resolve, reject) => {
        const transaction = connection.transaction(store, "readwrite");
        change(transaction.objectStore(store));
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
      });
    } finally {
      connection.close();
    }
  }

  /** @param {Array<MDLHandleRecord<D>>} records */
  function newestFirst(records) {
    return records.sort((left, right) => right.openedAt - left.openedAt);
  }

  /** @returns {Promise<Array<MDLHandleRecord<D>>>} */
  async function list() {
    const connection = await open();
    try {
      const records = await new Promise((resolve, reject) => {
        const request = connection.transaction(store).objectStore(store).getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      return newestFirst(/** @type {Array<MDLHandleRecord<D>>} */ (records)).slice(0, limit);
    } finally {
      connection.close();
    }
  }

  /** @param {MDLHandleRecord<D>[]} records @param {MDLRememberedHandle} handle */
  async function same(records, handle) {
    for (const record of records) {
      if (await record.handle.isSameEntry(handle)) return record;
    }
    return undefined;
  }

  /** @param {MDLRememberedHandle} handle @param {(existing: MDLHandleRecord<D> | undefined) => D} data */
  async function rememberNow(handle, data) {
    const records = await list();
    const existing = await same(records, handle);
    const record = /** @type {MDLHandleRecord<D>} */ ({
      ...data(existing),
      id: existing?.id || `${now()}-${random()}`,
      name: handle.name,
      openedAt: now(),
      handle
    });
    await write(objectStore => {
      objectStore.put(record);
      newestFirst(records.filter(entry => entry.id !== record.id).concat(record))
        .slice(limit).forEach(entry => objectStore.delete(entry.id));
    });
    return record;
  }

  return {
    list,
    async find(handle) { return same(await list(), handle); },
    remember(handle, data = () => /** @type {D} */ ({})) {
      const operation = rememberQueue.catch(() => {}).then(() => rememberNow(handle, data));
      rememberQueue = operation.catch(() => {});
      return operation;
    },
    forget(id) { return write(objectStore => { objectStore.delete(id); }); }
  };
}
