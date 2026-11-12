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
  constructor(file, current) {
    super(`${file} changed before it could be saved.`);
    this.name = "MDLStorageConflictError";
    this.code = "MDL_STORAGE_CONFLICT";
    this.file = file;
    /** @type {string | null} */
    this.text = current?.text ?? null;
    /** @type {string | null} */
    this.stamp = current?.stamp ?? null;
  }
}

/**
 * Version stamp of a `File`: modification time and size. `"0:0"` means the platform reported neither.
 * @param {{ lastModified?: number, size?: number }} file
 */
function stampOf(file) {
  return `${file.lastModified || 0}:${file.size || 0}`;
}

/** @param {unknown} error */
function isMissing(error) {
  const name = /** @type {{ name?: unknown }} */ (error)?.name;
  return name === "NotFoundError" || name === "TypeMismatchError";
}

/**
 * Runs operations one after another; a failed operation does not block the next one.
 * @returns {<T>(operation: () => Promise<T>) => Promise<T>}
 */
function queue() {
  /** @type {Promise<unknown>} */
  let tail = Promise.resolve();
  return operation => {
    const run = tail.then(operation);
    tail = run.catch(() => {});
    return run;
  };
}

/**
 * Wraps file access with the shared write rules.
 * @param {string} name
 * @param {{ list(): Promise<string[]>, read(file: string): Promise<MDLStoredFile | null>, writeRaw(file: string, text: string, create: boolean): Promise<string>, canCheck?: boolean }} access
 * @returns {MDLStorageAdapter}
 */
function adapter(name, access) {
  const serial = queue();
  return {
    name,
    list: access.list,
    read: access.read,
    async stat(file) { return (await access.read(file))?.stamp ?? null; },
    write(file, text, expected) {
      return serial(async () => {
        if (expected !== undefined) {
          const current = await access.read(file);
          if ((current?.text ?? null) !== expected) throw new MDLStorageConflictError(file, current);
        }
        return access.writeRaw(file, text, expected === null || expected === undefined);
      });
    },
    ...(access.canCheck === false ? { canCheck: false } : {})
  };
}

/**
 * @typedef {{ getFile(): Promise<{ text(): Promise<string>, lastModified?: number, size?: number }>,
 *   createWritable(): Promise<{ write(text: string): Promise<void>, close(): Promise<void> }> }} MDLWritableFileHandle
 */

/**
 * The part of `FileSystemDirectoryHandle` the folder adapter uses.
 * @typedef {{ name: string, getFileHandle(name: string, options?: { create?: boolean }): Promise<MDLWritableFileHandle>,
 *   entries(): AsyncIterable<[string, { kind: string }]> }} MDLDirectoryHandle
 */

/**
 * @param {MDLWritableFileHandle} handle
 * @param {string} text
 */
async function writeHandle(handle, text) {
  const writable = await handle.createWritable();
  await writable.write(text);
  await writable.close();
}

/**
 * @param {{ getFile(): Promise<{ text(): Promise<string>, lastModified?: number, size?: number }> }} handle
 * @returns {Promise<MDLStoredFile>}
 */
async function readHandle(handle) {
  const file = await handle.getFile();
  return { text: await file.text(), stamp: stampOf(file) };
}

/**
 * Adapter over the files of a directory. Only names in `files` are visible; missing files read as `null`
 * and are created by an unconditional or `expected: null` write.
 * @param {MDLDirectoryHandle} directory
 * @param {{ files: string[] }} options
 * @returns {MDLStorageAdapter}
 */
export function folder(directory, { files }) {
  /** @param {string} file */
  async function read(file) {
    try {
      return await readHandle(await directory.getFileHandle(file));
    } catch (error) {
      if (isMissing(error)) return null;
      throw error;
    }
  }
  return adapter(directory.name, {
    async list() {
      /** @type {string[]} */
      const names = [];
      for await (const [name, handle] of directory.entries()) {
        if (handle.kind === "file" && files.includes(name)) names.push(name);
      }
      return names.sort();
    },
    read,
    async writeRaw(file, text, create) {
      const handle = await directory.getFileHandle(file, { create });
      await writeHandle(handle, text);
      return stampOf(await handle.getFile());
    }
  });
}

/**
 * Adapter over one file handle; the file is addressed by the handle's name. A deleted file cannot be
 * represented, so reading it rejects with the browser's `NotFoundError`. A handle without `getFile` can only be
 * written: reads return `null`, writes are unconditional and return `""`, and `canCheck` is false.
 * @param {{ name: string, getFile?: MDLWritableFileHandle["getFile"], createWritable: MDLWritableFileHandle["createWritable"] }} handle
 * @returns {MDLStorageAdapter}
 */
export function file(handle) {
  const readable = typeof handle.getFile === "function";
  /** @param {string} name */
  async function read(name) {
    if (name !== handle.name || !readable) return null;
    return readHandle(/** @type {MDLWritableFileHandle} */ (handle));
  }
  return adapter(handle.name, {
    async list() { return [handle.name]; },
    read,
    async writeRaw(name, text) {
      if (name !== handle.name) throw new Error(`${name} is not ${handle.name}.`);
      await writeHandle(/** @type {MDLWritableFileHandle} */ (handle), text);
      return readable ? stampOf(await /** @type {MDLWritableFileHandle} */ (handle).getFile()) : "";
    },
    canCheck: readable
  });
}

/**
 * In-memory adapter; stamps count writes. For tests and as a reference implementation:
 * `files` exposes the stored versions, `failNextRead(error)` and `failNextWrite(error)` make the next read or write fail.
 * @param {Record<string, string>} [files]
 * @returns {MDLStorageAdapter & { files: Map<string, MDLStoredFile>, failNextRead(error: Error): void, failNextWrite(error: Error): void }}
 */
export function memory(files = {}) {
  let revision = 0;
  /** @type {Error | null} */
  let failure = null;
  /** @type {Error | null} */
  let readFailure = null;
  /** @type {Map<string, MDLStoredFile>} */
  const stored = new Map(Object.entries(files).map(([name, text]) => [name, { text, stamp: `m${++revision}` }]));
  return Object.assign(adapter("memory", {
    async list() { return [...stored.keys()].sort(); },
    async read(name) {
      if (readFailure) {
        const error = readFailure;
        readFailure = null;
        throw error;
      }
      const current = stored.get(name);
      return current ? { ...current } : null;
    },
    async writeRaw(name, text) {
      if (failure) {
        const error = failure;
        failure = null;
        throw error;
      }
      const stamp = `m${++revision}`;
      stored.set(name, { text, stamp });
      return stamp;
    }
  }), {
    files: stored,
    failNextRead(/** @type {Error} */ error) { readFailure = error; },
    failNextWrite(/** @type {Error} */ error) { failure = error; }
  });
}

/**
 * Ensures `mode` permission for a handle: granted permissions are kept; otherwise the user is asked
 * when `prompt` is set. Resolves to whether permission is granted.
 * @param {{ queryPermission?(options: { mode: "read" | "readwrite" }): Promise<PermissionState>, requestPermission(options: { mode: "read" | "readwrite" }): Promise<PermissionState> }} handle
 * @param {"read" | "readwrite"} mode
 * @param {{ query?: boolean, prompt?: boolean }} [options] `query: false` asks directly without querying first.
 */
export async function ensurePermission(handle, mode, { query = true, prompt = true } = {}) {
  if (query && handle.queryPermission && await handle.queryPermission({ mode }) === "granted") return true;
  return prompt ? await handle.requestPermission({ mode }) === "granted" : false;
}
