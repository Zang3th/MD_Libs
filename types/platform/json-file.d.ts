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
export function create({ adapter, name, format, initial, order, unreadable }: MDLJsonFileOptions): {
    update: (change: (document: MDLJsonDocument) => MDLJsonDocument | Promise<MDLJsonDocument>) => Promise<boolean>;
};
export type MDLJsonDocument = import("../core/json.js").MDLJsonDocument;
export type MDLJsonOrder = import("../core/json.js").MDLJsonOrder;
export type MDLStorageAdapter = import("./storage.js").MDLStorageAdapter;
export type MDLJsonFileOptions = {
    adapter: MDLStorageAdapter;
    /**
     * File name within the adapter.
     */
    name: string;
    /**
     * The format this app writes (see core/json).
     */
    format: number;
    /**
     * The document when the file is missing or unreadable.
     */
    initial: () => MDLJsonDocument;
    order?: MDLJsonOrder;
    /**
     * Called before an unreadable file is replaced.
     */
    unreadable?: () => void;
};
