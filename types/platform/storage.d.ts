/**
 * Adapter over the files of a directory. Only names in `files` are visible; missing files read as `null`
 * and are created by an unconditional or `expected: null` write.
 * @param {MDLDirectoryHandle} directory
 * @param {{ files: string[] }} options
 * @returns {MDLStorageAdapter}
 */
export function folder(directory: MDLDirectoryHandle, { files }: {
    files: string[];
}): MDLStorageAdapter;
/**
 * Adapter over one file handle; the file is addressed by the handle's name. A deleted file cannot be
 * represented, so reading it rejects with the browser's `NotFoundError`. A handle without `getFile` can only be
 * written: reads return `null`, writes are unconditional and return `""`, and `canCheck` is false.
 * @param {{ name: string, getFile?: MDLWritableFileHandle["getFile"], createWritable: MDLWritableFileHandle["createWritable"] }} handle
 * @returns {MDLStorageAdapter}
 */
export function file(handle: {
    name: string;
    getFile?: MDLWritableFileHandle["getFile"];
    createWritable: MDLWritableFileHandle["createWritable"];
}): MDLStorageAdapter;
/**
 * In-memory adapter; stamps count writes. For tests and as a reference implementation:
 * `files` exposes the stored versions, `failNextRead(error)` and `failNextWrite(error)` make the next read or write fail.
 * @param {Record<string, string>} [files]
 * @returns {MDLStorageAdapter & { files: Map<string, MDLStoredFile>, failNextRead(error: Error): void, failNextWrite(error: Error): void }}
 */
export function memory(files?: Record<string, string>): MDLStorageAdapter & {
    files: Map<string, MDLStoredFile>;
    failNextRead(error: Error): void;
    failNextWrite(error: Error): void;
};
/**
 * Ensures `mode` permission for a handle: granted permissions are kept; otherwise the user is asked
 * when `prompt` is set. Resolves to whether permission is granted. A query the browser does not answer within
 * five seconds rejects with a `TimeoutError`: a remembered handle can break, for example after a browser update.
 * @param {{ name?: string, queryPermission?(options: { mode: "read" | "readwrite" }): Promise<PermissionState>, requestPermission(options: { mode: "read" | "readwrite" }): Promise<PermissionState> }} handle
 * @param {"read" | "readwrite"} mode
 * @param {{ window: Pick<Window, "setTimeout" | "clearTimeout">, prompt?: boolean }} options `window` times the query.
 */
export function ensurePermission(handle: {
    name?: string;
    queryPermission?(options: {
        mode: "read" | "readwrite";
    }): Promise<PermissionState>;
    requestPermission(options: {
        mode: "read" | "readwrite";
    }): Promise<PermissionState>;
}, mode: "read" | "readwrite", { window, prompt }: {
    window: Pick<Window, "setTimeout" | "clearTimeout">;
    prompt?: boolean;
}): Promise<boolean>;
/**
 * Whether a remembered handle can be used now: `granted`; `denied` without permission; `missing` when its folder or
 * file was deleted, moved or renamed since. A handle outlives its entry, so only reading from it tells.
 * @param {Parameters<typeof ensurePermission>[0] & ({ entries(): AsyncIterable<unknown> } | { getFile(): Promise<unknown> })} handle
 * @param {"read" | "readwrite"} mode
 * @param {{ window: Pick<Window, "setTimeout" | "clearTimeout">, prompt?: boolean }} options `prompt: false` never asks the user;
 *   `window` times the permission query as in `ensurePermission`.
 * @returns {Promise<"granted" | "denied" | "missing">}
 */
export function probe(handle: Parameters<typeof ensurePermission>[0] & ({
    entries(): AsyncIterable<unknown>;
} | {
    getFile(): Promise<unknown>;
}), mode: "read" | "readwrite", { window, prompt }: {
    window: Pick<Window, "setTimeout" | "clearTimeout">;
    prompt?: boolean;
}): Promise<"granted" | "denied" | "missing">;
/**
 * SHA-256 of a text as `sha256-<hex>`: identifies stored content independently of file times and clocks.
 * @param {string} text
 * @param {{ subtle: Pick<SubtleCrypto, "digest"> }} options `crypto.subtle` of the page.
 */
export function fingerprint(text: string, { subtle }: {
    subtle: Pick<SubtleCrypto, "digest">;
}): Promise<string>;
/**
 * Version-checked text storage. Every adapter implements the same contract
 * (`harness/storage-contract`), so sessions work unchanged on a folder, a single file or memory.
 *
 * @typedef {{ text: string, stamp: string }} MDLStoredFile
 * @typedef {object} MDLStorageAdapter
 * @property {string} name
 * @property {() => Promise<string[]>} list Names of the files the adapter can read, sorted.
 * @property {(file: string) => Promise<MDLStoredFile | null>} read `null` when the file does not exist
 *   (a single-file adapter rejects with `NotFoundError` instead).
 * @property {(file: string) => Promise<string | null>} stat Version stamp without reading the content; `null` when missing.
 * @property {(file: string, text: string, expected?: string | null) => Promise<string>} write
 *   Writes `text` and returns the new stamp. `expected` is the content the caller believes is stored:
 *   a differing file, or an existing one for `null`, rejects with `MDLStorageConflictError` without writing.
 *   `undefined` writes unconditionally. Writes of one adapter run one after another.
 * @property {boolean} [canCheck] `false` when the adapter cannot read back what it wrote; sessions then skip version checks.
 */
/** Raised when the stored file differs from the expected content. Carries the stored version (`null` text and stamp when missing). */
export class MDLStorageConflictError extends Error {
    /** @param {string} file @param {MDLStoredFile | null} current */
    constructor(file: string, current: MDLStoredFile | null);
    code: string;
    file: string;
    /** @type {string | null} */
    text: string | null;
    /** @type {string | null} */
    stamp: string | null;
}
export type MDLWritableFileHandle = {
    getFile(): Promise<{
        text(): Promise<string>;
        lastModified?: number;
        size?: number;
    }>;
    createWritable(): Promise<{
        write(text: string): Promise<void>;
        close(): Promise<void>;
    }>;
};
/**
 * The part of `FileSystemDirectoryHandle` the folder adapter uses.
 */
export type MDLDirectoryHandle = {
    name: string;
    getFileHandle(name: string, options?: {
        create?: boolean;
    }): Promise<MDLWritableFileHandle>;
    entries(): AsyncIterable<[string, {
        kind: string;
    }]>;
};
/**
 * Version-checked text storage. Every adapter implements the same contract
 * (`harness/storage-contract`), so sessions work unchanged on a folder, a single file or memory.
 */
export type MDLStoredFile = {
    text: string;
    stamp: string;
};
/**
 * Version-checked text storage. Every adapter implements the same contract
 * (`harness/storage-contract`), so sessions work unchanged on a folder, a single file or memory.
 */
export type MDLStorageAdapter = {
    name: string;
    /**
     * Names of the files the adapter can read, sorted.
     */
    list: () => Promise<string[]>;
    /**
     * `null` when the file does not exist
     * (a single-file adapter rejects with `NotFoundError` instead).
     */
    read: (file: string) => Promise<MDLStoredFile | null>;
    /**
     * Version stamp without reading the content; `null` when missing.
     */
    stat: (file: string) => Promise<string | null>;
    /**
     *  Writes `text` and returns the new stamp. `expected` is the content the caller believes is stored:
     *  a differing file, or an existing one for `null`, rejects with `MDLStorageConflictError` without writing.
     *  `undefined` writes unconditionally. Writes of one adapter run one after another.
     */
    write: (file: string, text: string, expected?: string | null) => Promise<string>;
    /**
     * `false` when the adapter cannot read back what it wrote; sessions then skip version checks.
     */
    canCheck?: boolean;
};
