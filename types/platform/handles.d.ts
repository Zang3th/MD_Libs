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
export function create<D extends unknown = any>({ indexedDB, database, store, version, limit, now, random }: {
    indexedDB: IDBFactory;
    database: string;
    store: string;
    version?: number;
    limit: number;
    now?: () => number;
    random?: () => number;
}): MDLHandleStore<D>;
export type MDLHandleRecord<D extends unknown = any> = {
    id: string;
    name: string;
    openedAt: number;
    handle: MDLRememberedHandle;
} & D;
export type MDLRememberedHandle = {
    name: string;
    isSameEntry(other: any): Promise<boolean>;
};
export type MDLHandleStore<D extends unknown = any> = {
    /**
     * Newest first, at most `limit`.
     */
    list: () => Promise<Array<MDLHandleRecord<D>>>;
    /**
     * The record of the same file or folder.
     */
    find: (handle: MDLRememberedHandle) => Promise<MDLHandleRecord<D> | undefined>;
    /**
     *   Stores the handle as most recently opened, merged with an earlier record of the same entry, and drops records beyond `limit`.
     */
    remember: (handle: MDLRememberedHandle, data?: (existing: MDLHandleRecord<D> | undefined) => D) => Promise<MDLHandleRecord<D>>;
    forget: (id: string) => Promise<void>;
};
