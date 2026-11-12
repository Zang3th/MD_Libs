export type ContractSubject = {
    adapter: import("../platform/storage.js").MDLStorageAdapter;
    /**
     * Changes a file outside the adapter.
     */
    change: (name: string, text: string | null) => void;
    /**
     * Makes the next write fail with `error` before anything is written.
     */
    failNextWrite: (error: Error | null) => void;
    /**
     * Makes the next read fail with `error`.
     */
    failNextRead: (error: Error) => void;
};
/**
 * @typedef {object} ContractSubject
 * @property {import("../platform/storage.js").MDLStorageAdapter} adapter
 * @property {(name: string, text: string | null) => void} change Changes a file outside the adapter.
 * @property {(error: Error | null) => void} failNextWrite Makes the next write fail with `error` before anything is written.
 * @property {(error: Error) => void} failNextRead Makes the next read fail with `error`.
 */
/**
 * Registers the storage adapter contract as `node:test` tests. Every adapter must pass it.
 * @param {{ name: string, setup: (files: Record<string, string>) => ContractSubject | Promise<ContractSubject>, missing?: "null" | "reject" }} options
 *   `setup` creates an adapter whose storage holds `files`; `"a.md"` is the file under test.
 *   `missing`: how reading a missing file behaves; a single-file adapter rejects.
 */
export function storageContract({ name, setup, missing }: {
    name: string;
    setup: (files: Record<string, string>) => ContractSubject | Promise<ContractSubject>;
    missing?: "null" | "reject";
}): void;
