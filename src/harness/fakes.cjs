"use strict";

// Fakes for unit tests of MD_Libs and of the applications. They model only the API surface the
// library uses; real-browser behavior is covered by the applications' end-to-end tests.

/** @typedef {{ text: string, lastModified: number }} FakeEntry */

/**
 * A file system in memory: `files` maps names to contents. Every write advances the modification time.
 * `hooks.beforeWrite(name)` may return a promise to hold a write; `hooks.failRead` rejects every read, `hooks.failNextRead` the next one,
 * `hooks.failNextWrite` the next write.
 * @param {Record<string, string>} [files]
 */
function fileSystem(files = {}) {
  let time = 0;
  /** @type {Map<string, FakeEntry>} */
  const entries = new Map(Object.entries(files).map(([name, text]) => [name, { text, lastModified: ++time }]));
  /** @type {{ beforeWrite?: (name: string) => Promise<void> | void, failRead?: Error, failNextRead?: Error, failNextWrite?: Error, permission: PermissionState, requests: number }} */
  const hooks = { permission: "granted", requests: 0 };

  /** @param {string} name */
  function notFound(name) {
    return Object.assign(new Error(`${name} not found`), { name: "NotFoundError" });
  }

  /** @param {string} name */
  function fileHandle(name) {
    const handle = {
      kind: /** @type {const} */ ("file"),
      name,
      async getFile() {
        if (hooks.failRead) throw hooks.failRead;
        const failure = hooks.failNextRead;
        hooks.failNextRead = undefined;
        if (failure) throw failure;
        const entry = entries.get(name);
        if (!entry) throw notFound(name);
        const { text, lastModified } = entry;
        return { lastModified, size: text.length, text: async () => text };
      },
      async createWritable() {
        let next = "";
        return {
          async write(/** @type {string} */ value) { next = value; },
          async close() {
            await hooks.beforeWrite?.(name);
            const failure = hooks.failNextWrite;
            hooks.failNextWrite = undefined;
            if (failure) throw failure;
            entries.set(name, { text: next, lastModified: ++time });
          }
        };
      },
      async isSameEntry(/** @type {{ name?: string, kind?: string }} */ other) { return other?.kind === "file" && other.name === name; },
      async queryPermission() { return hooks.permission; },
      async requestPermission() { hooks.requests++; return hooks.permission; }
    };
    return handle;
  }

  const directory = {
    kind: /** @type {const} */ ("directory"),
    name: "folder",
    /** @param {string} name @param {{ create?: boolean }} [options] */
    async getFileHandle(name, options = {}) {
      if (!entries.has(name)) {
        if (!options.create) throw notFound(name);
        entries.set(name, { text: "", lastModified: ++time });
      }
      return fileHandle(name);
    },
    async *entries() {
      for (const name of entries.keys()) yield /** @type {[string, ReturnType<typeof fileHandle>]} */ ([name, fileHandle(name)]);
      yield /** @type {[string, { kind: "directory" }]} */ (["nested", { kind: "directory" }]);
    },
    async isSameEntry(/** @type {{ kind?: string }} */ other) { return other?.kind === "directory"; },
    async queryPermission() { return hooks.permission; },
    async requestPermission() { hooks.requests++; return hooks.permission; }
  };

  return {
    directory,
    fileHandle,
    hooks,
    /** @param {string} name */
    text(name) { return entries.get(name)?.text ?? null; },
    /** Changes a file as another program would. @param {string} name @param {string | null} text */
    change(name, text) {
      if (text === null) entries.delete(name);
      else entries.set(name, { text, lastModified: ++time });
    },
    /** Changes the modification time only, as a sync client may. @param {string} name */
    touch(name) {
      const entry = entries.get(name);
      if (entry) entry.lastModified = ++time;
    }
  };
}

/**
 * IndexedDB with object stores keyed by `keyPath`. Callbacks run as microtasks, as in browsers.
 * Values are stored by reference, so handles survive like structured clones of handles do.
 */
function indexedDB() {
  /** @type {Map<string, { version: number, stores: Map<string, { keyPath: string, records: Map<string, any> }> }>} */
  const databases = new Map();
  const failures = { open: /** @type {Error | null} */ (null) };

  /** @param {string} name */
  function connection(name) {
    const database = /** @type {NonNullable<ReturnType<typeof databases.get>>} */ (databases.get(name));
    return {
      objectStoreNames: { contains: (/** @type {string} */ store) => database.stores.has(store) },
      /** @param {string} store @param {{ keyPath: string }} options */
      createObjectStore(store, options) { database.stores.set(store, { keyPath: options.keyPath, records: new Map() }); },
      close() {},
      /** @param {string} store */
      transaction(store) {
        const records = /** @type {NonNullable<ReturnType<typeof database.stores.get>>} */ (database.stores.get(store));
        /** @type {any} */
        const transaction = { error: null };
        const complete = () => queueMicrotask(() => transaction.oncomplete?.());
        transaction.objectStore = () => ({
          getAll() {
            /** @type {any} */
            const request = {};
            queueMicrotask(() => { request.result = [...records.records.values()]; request.onsuccess(); });
            return request;
          },
          put(/** @type {any} */ record) { records.records.set(record[records.keyPath], record); complete(); },
          delete(/** @type {string} */ key) { records.records.delete(key); complete(); }
        });
        return transaction;
      }
    };
  }

  return {
    failures,
    databases,
    /** @param {string} name @param {number} version */
    open(name, version) {
      /** @type {any} */
      const request = {};
      queueMicrotask(() => {
        if (failures.open) {
          request.error = failures.open;
          request.onerror();
          return;
        }
        const existing = databases.get(name);
        if (!existing) databases.set(name, { version: 0, stores: new Map() });
        const database = /** @type {NonNullable<typeof existing>} */ (databases.get(name));
        request.result = connection(name);
        if (database.version < version) {
          database.version = version;
          request.onupgradeneeded?.();
        }
        request.onsuccess();
      });
      return request;
    }
  };
}

/** A manual clock: `now()` returns the current time, `advance(ms)` moves it. */
function clock(start = 0) {
  let time = start;
  return {
    now: () => time,
    /** @param {number} ms */
    advance(ms) { time += ms; }
  };
}

/**
 * A promise to hold an operation until the test releases or rejects it.
 * @template [T=void]
 */
function gate() {
  /** @type {(value: T) => void} */
  let release = () => {};
  /** @type {(error: Error) => void} */
  let reject = () => {};
  /** @type {Promise<T>} */
  const promise = new Promise((resolve, fail) => { release = resolve; reject = fail; });
  return { promise, release, reject };
}

/**
 * A Web Audio API double that records the graph: every created node, its connections, scheduled
 * parameter values and whether it was started, stopped or disconnected. `finish()` on an oscillator
 * fires its "ended" event. `AudioContext.instances` lists the created contexts.
 */
function audioContext() {
  class Param {
    constructor() {
      this.value = 0;
      /** @type {Array<[string, number, number]>} */
      this.events = [];
    }
    /** @param {number} time */
    cancelScheduledValues(time) { this.events.push(["cancel", 0, time]); }
    /** @param {number} value @param {number} time */
    setValueAtTime(value, time) { this.events.push(["set", value, time]); }
    /** @param {number} value @param {number} time */
    exponentialRampToValueAtTime(value, time) { this.events.push(["ramp", value, time]); }
  }
  class Node {
    constructor() {
      /** @type {unknown[]} */
      this.connections = [];
      this.disconnected = false;
    }
    /** @template T @param {T} node @returns {T} */
    connect(node) { this.connections.push(node); return node; }
    disconnect() { this.disconnected = true; }
  }
  class Gain extends Node {
    constructor() { super(); this.gain = new Param(); }
  }
  class Convolver extends Node {
    constructor() { super(); /** @type {unknown} */ this.buffer = null; }
  }
  class Oscillator extends Node {
    constructor() {
      super();
      this.type = "";
      this.frequency = new Param();
      /** @type {Map<string, () => void>} */
      this.listeners = new Map();
      /** @type {number | null} */
      this.startedAt = null;
      /** @type {number | null} */
      this.stoppedAt = null;
    }
    /** @param {string} name @param {() => void} listener */
    addEventListener(name, listener) { this.listeners.set(name, listener); }
    /** @param {number} time */
    start(time) { this.startedAt = time; }
    /** @param {number} [time] */
    stop(time) {
      if (this.stoppedAt !== null && time === undefined) throw new Error("already stopped");
      this.stoppedAt = time ?? -1;
    }
    finish() { this.listeners.get("ended")?.(); }
  }
  class FakeAudioContext {
    /** @type {FakeAudioContext[]} */
    static instances = [];
    constructor() {
      this.currentTime = 0;
      this.sampleRate = 8;
      this.destination = new Node();
      this.resumed = 0;
      /** @type {Array<{ numberOfChannels: number, getChannelData(channel: number): Float32Array }>} */
      this.buffers = [];
      /** @type {Gain[]} */
      this.gains = [];
      /** @type {Oscillator[]} */
      this.oscillators = [];
      FakeAudioContext.instances.push(this);
    }
    async resume() { this.resumed++; }
    /** @param {number} channels @param {number} frames */
    createBuffer(channels, frames) {
      const data = Array.from({ length: channels }, () => new Float32Array(frames));
      const buffer = { numberOfChannels: channels, getChannelData: (/** @type {number} */ channel) => data[channel] };
      this.buffers.push(buffer);
      return buffer;
    }
    createConvolver() { return new Convolver(); }
    createGain() { const gain = new Gain(); this.gains.push(gain); return gain; }
    createOscillator() { const oscillator = new Oscillator(); this.oscillators.push(oscillator); return oscillator; }
  }
  return FakeAudioContext;
}

/** Lets pending microtasks and promise chains run. */
function flush() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

module.exports = { fileSystem, indexedDB, audioContext, clock, gate, flush };
