/**
 * The ID of this browser profile, created once and kept in `storage` (usually `localStorage`), for example to record
 * which device wrote a file. Without usable storage the ID lasts only as long as the caller keeps it.
 * @param {{ storage: Pick<Storage, "getItem" | "setItem"> | null, key: string, randomUUID: () => string }} options
 * @returns {string}
 */
export function id({ storage, key, randomUUID }: {
    storage: Pick<Storage, "getItem" | "setItem"> | null;
    key: string;
    randomUUID: () => string;
}): string;
