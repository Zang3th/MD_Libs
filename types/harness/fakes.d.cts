export type FakeEntry = {
    text: string;
    lastModified: number;
};
/** @typedef {{ text: string, lastModified: number }} FakeEntry */
/**
 * A file system in memory: `files` maps names to contents. Every write advances the modification time.
 * `hooks.beforeWrite(name)` may return a promise to hold a write; `hooks.failRead` rejects every read, `hooks.failNextRead` the next one,
 * `hooks.failNextWrite` the next write.
 * @param {Record<string, string>} [files]
 */
export function fileSystem(files?: Record<string, string>): {
    directory: {
        kind: "directory";
        name: string;
        /** @param {string} name @param {{ create?: boolean }} [options] */
        getFileHandle(name: string, options?: {
            create?: boolean;
        }): Promise<{
            kind: "file";
            name: string;
            getFile(): Promise<{
                lastModified: number;
                size: number;
                text: () => Promise<string>;
            }>;
            createWritable(): Promise<{
                write(value: string): Promise<void>;
                close(): Promise<void>;
            }>;
            isSameEntry(other: {
                name?: string;
                kind?: string;
            }): Promise<boolean>;
            queryPermission(): Promise<PermissionState>;
            requestPermission(): Promise<PermissionState>;
        }>;
        entries(): AsyncGenerator<[string, {
            kind: "file";
            name: string;
            getFile(): Promise<{
                lastModified: number;
                size: number;
                text: () => Promise<string>;
            }>;
            createWritable(): Promise<{
                write(value: string): Promise<void>;
                close(): Promise<void>;
            }>;
            isSameEntry(other: {
                name?: string;
                kind?: string;
            }): Promise<boolean>;
            queryPermission(): Promise<PermissionState>;
            requestPermission(): Promise<PermissionState>;
        }] | [string, {
            kind: "directory";
        }], void, unknown>;
        isSameEntry(other: {
            kind?: string;
        }): Promise<boolean>;
        queryPermission(): Promise<PermissionState>;
        requestPermission(): Promise<PermissionState>;
    };
    fileHandle: (name: string) => {
        kind: "file";
        name: string;
        getFile(): Promise<{
            lastModified: number;
            size: number;
            text: () => Promise<string>;
        }>;
        createWritable(): Promise<{
            write(value: string): Promise<void>;
            close(): Promise<void>;
        }>;
        isSameEntry(other: {
            name?: string;
            kind?: string;
        }): Promise<boolean>;
        queryPermission(): Promise<PermissionState>;
        requestPermission(): Promise<PermissionState>;
    };
    hooks: {
        beforeWrite?: (name: string) => Promise<void> | void;
        failRead?: Error;
        failNextRead?: Error;
        failNextWrite?: Error;
        permission: PermissionState;
        requests: number;
    };
    /** @param {string} name */
    text(name: string): string;
    /** Changes a file as another program would. @param {string} name @param {string | null} text */
    change(name: string, text: string | null): void;
    /** Changes the modification time only, as a sync client may. @param {string} name */
    touch(name: string): void;
};
/**
 * IndexedDB with object stores keyed by `keyPath`. Callbacks run as microtasks, as in browsers.
 * Values are stored by reference, so handles survive like structured clones of handles do.
 */
export function indexedDB(): {
    failures: {
        open: Error | null;
    };
    databases: Map<string, {
        version: number;
        stores: Map<string, {
            keyPath: string;
            records: Map<string, any>;
        }>;
    }>;
    /** @param {string} name @param {number} version */
    open(name: string, version: number): any;
};
/**
 * A Web Audio API double that records the graph: every created node, its connections, scheduled
 * parameter values and whether it was started, stopped or disconnected. `finish()` on an oscillator
 * fires its "ended" event. `AudioContext.instances` lists the created contexts.
 */
export function audioContext(): {
    new (): {
        currentTime: number;
        sampleRate: number;
        destination: {
            /** @type {unknown[]} */
            connections: unknown[];
            disconnected: boolean;
            /** @template T @param {T} node @returns {T} */
            connect<T>(node: T): T;
            disconnect(): void;
        };
        resumed: number;
        /** @type {Array<{ numberOfChannels: number, getChannelData(channel: number): Float32Array }>} */
        buffers: {
            numberOfChannels: number;
            getChannelData(channel: number): Float32Array;
        }[];
        /** @type {Gain[]} */
        gains: {
            gain: {
                value: number;
                /** @type {Array<[string, number, number]>} */
                events: Array<[string, number, number]>;
                /** @param {number} time */
                cancelScheduledValues(time: number): void;
                /** @param {number} value @param {number} time */
                setValueAtTime(value: number, time: number): void;
                /** @param {number} value @param {number} time */
                exponentialRampToValueAtTime(value: number, time: number): void;
            };
            /** @type {unknown[]} */
            connections: unknown[];
            disconnected: boolean;
            /** @template T @param {T} node @returns {T} */
            connect<T>(node: T): T;
            disconnect(): void;
        }[];
        /** @type {Oscillator[]} */
        oscillators: {
            type: string;
            frequency: {
                value: number;
                /** @type {Array<[string, number, number]>} */
                events: Array<[string, number, number]>;
                /** @param {number} time */
                cancelScheduledValues(time: number): void;
                /** @param {number} value @param {number} time */
                setValueAtTime(value: number, time: number): void;
                /** @param {number} value @param {number} time */
                exponentialRampToValueAtTime(value: number, time: number): void;
            };
            /** @type {Map<string, () => void>} */
            listeners: Map<string, () => void>;
            /** @type {number | null} */
            startedAt: number | null;
            /** @type {number | null} */
            stoppedAt: number | null;
            /** @param {string} name @param {() => void} listener */
            addEventListener(name: string, listener: () => void): void;
            /** @param {number} time */
            start(time: number): void;
            /** @param {number} [time] */
            stop(time?: number): void;
            finish(): void;
            /** @type {unknown[]} */
            connections: unknown[];
            disconnected: boolean;
            /** @template T @param {T} node @returns {T} */
            connect<T>(node: T): T;
            disconnect(): void;
        }[];
        resume(): Promise<void>;
        /** @param {number} channels @param {number} frames */
        createBuffer(channels: number, frames: number): {
            numberOfChannels: number;
            getChannelData: (channel: number) => Float32Array<ArrayBuffer>;
        };
        createConvolver(): {
            buffer: any;
            /** @type {unknown[]} */
            connections: unknown[];
            disconnected: boolean;
            /** @template T @param {T} node @returns {T} */
            connect<T>(node: T): T;
            disconnect(): void;
        };
        createGain(): {
            gain: {
                value: number;
                /** @type {Array<[string, number, number]>} */
                events: Array<[string, number, number]>;
                /** @param {number} time */
                cancelScheduledValues(time: number): void;
                /** @param {number} value @param {number} time */
                setValueAtTime(value: number, time: number): void;
                /** @param {number} value @param {number} time */
                exponentialRampToValueAtTime(value: number, time: number): void;
            };
            /** @type {unknown[]} */
            connections: unknown[];
            disconnected: boolean;
            /** @template T @param {T} node @returns {T} */
            connect<T>(node: T): T;
            disconnect(): void;
        };
        createOscillator(): {
            type: string;
            frequency: {
                value: number;
                /** @type {Array<[string, number, number]>} */
                events: Array<[string, number, number]>;
                /** @param {number} time */
                cancelScheduledValues(time: number): void;
                /** @param {number} value @param {number} time */
                setValueAtTime(value: number, time: number): void;
                /** @param {number} value @param {number} time */
                exponentialRampToValueAtTime(value: number, time: number): void;
            };
            /** @type {Map<string, () => void>} */
            listeners: Map<string, () => void>;
            /** @type {number | null} */
            startedAt: number | null;
            /** @type {number | null} */
            stoppedAt: number | null;
            /** @param {string} name @param {() => void} listener */
            addEventListener(name: string, listener: () => void): void;
            /** @param {number} time */
            start(time: number): void;
            /** @param {number} [time] */
            stop(time?: number): void;
            finish(): void;
            /** @type {unknown[]} */
            connections: unknown[];
            disconnected: boolean;
            /** @template T @param {T} node @returns {T} */
            connect<T>(node: T): T;
            disconnect(): void;
        };
    };
    /** @type {FakeAudioContext[]} */
    instances: {
        currentTime: number;
        sampleRate: number;
        destination: {
            /** @type {unknown[]} */
            connections: unknown[];
            disconnected: boolean;
            /** @template T @param {T} node @returns {T} */
            connect<T>(node: T): T;
            disconnect(): void;
        };
        resumed: number;
        /** @type {Array<{ numberOfChannels: number, getChannelData(channel: number): Float32Array }>} */
        buffers: {
            numberOfChannels: number;
            getChannelData(channel: number): Float32Array;
        }[];
        /** @type {Gain[]} */
        gains: {
            gain: {
                value: number;
                /** @type {Array<[string, number, number]>} */
                events: Array<[string, number, number]>;
                /** @param {number} time */
                cancelScheduledValues(time: number): void;
                /** @param {number} value @param {number} time */
                setValueAtTime(value: number, time: number): void;
                /** @param {number} value @param {number} time */
                exponentialRampToValueAtTime(value: number, time: number): void;
            };
            /** @type {unknown[]} */
            connections: unknown[];
            disconnected: boolean;
            /** @template T @param {T} node @returns {T} */
            connect<T>(node: T): T;
            disconnect(): void;
        }[];
        /** @type {Oscillator[]} */
        oscillators: {
            type: string;
            frequency: {
                value: number;
                /** @type {Array<[string, number, number]>} */
                events: Array<[string, number, number]>;
                /** @param {number} time */
                cancelScheduledValues(time: number): void;
                /** @param {number} value @param {number} time */
                setValueAtTime(value: number, time: number): void;
                /** @param {number} value @param {number} time */
                exponentialRampToValueAtTime(value: number, time: number): void;
            };
            /** @type {Map<string, () => void>} */
            listeners: Map<string, () => void>;
            /** @type {number | null} */
            startedAt: number | null;
            /** @type {number | null} */
            stoppedAt: number | null;
            /** @param {string} name @param {() => void} listener */
            addEventListener(name: string, listener: () => void): void;
            /** @param {number} time */
            start(time: number): void;
            /** @param {number} [time] */
            stop(time?: number): void;
            finish(): void;
            /** @type {unknown[]} */
            connections: unknown[];
            disconnected: boolean;
            /** @template T @param {T} node @returns {T} */
            connect<T>(node: T): T;
            disconnect(): void;
        }[];
        resume(): Promise<void>;
        /** @param {number} channels @param {number} frames */
        createBuffer(channels: number, frames: number): {
            numberOfChannels: number;
            getChannelData: (channel: number) => Float32Array<ArrayBuffer>;
        };
        createConvolver(): {
            buffer: any;
            /** @type {unknown[]} */
            connections: unknown[];
            disconnected: boolean;
            /** @template T @param {T} node @returns {T} */
            connect<T>(node: T): T;
            disconnect(): void;
        };
        createGain(): {
            gain: {
                value: number;
                /** @type {Array<[string, number, number]>} */
                events: Array<[string, number, number]>;
                /** @param {number} time */
                cancelScheduledValues(time: number): void;
                /** @param {number} value @param {number} time */
                setValueAtTime(value: number, time: number): void;
                /** @param {number} value @param {number} time */
                exponentialRampToValueAtTime(value: number, time: number): void;
            };
            /** @type {unknown[]} */
            connections: unknown[];
            disconnected: boolean;
            /** @template T @param {T} node @returns {T} */
            connect<T>(node: T): T;
            disconnect(): void;
        };
        createOscillator(): {
            type: string;
            frequency: {
                value: number;
                /** @type {Array<[string, number, number]>} */
                events: Array<[string, number, number]>;
                /** @param {number} time */
                cancelScheduledValues(time: number): void;
                /** @param {number} value @param {number} time */
                setValueAtTime(value: number, time: number): void;
                /** @param {number} value @param {number} time */
                exponentialRampToValueAtTime(value: number, time: number): void;
            };
            /** @type {Map<string, () => void>} */
            listeners: Map<string, () => void>;
            /** @type {number | null} */
            startedAt: number | null;
            /** @type {number | null} */
            stoppedAt: number | null;
            /** @param {string} name @param {() => void} listener */
            addEventListener(name: string, listener: () => void): void;
            /** @param {number} time */
            start(time: number): void;
            /** @param {number} [time] */
            stop(time?: number): void;
            finish(): void;
            /** @type {unknown[]} */
            connections: unknown[];
            disconnected: boolean;
            /** @template T @param {T} node @returns {T} */
            connect<T>(node: T): T;
            disconnect(): void;
        };
    }[];
};
/** A manual clock: `now()` returns the current time, `advance(ms)` moves it. */
export function clock(start?: number): {
    now: () => number;
    /** @param {number} ms */
    advance(ms: number): void;
};
/**
 * A promise to hold an operation until the test releases or rejects it.
 * @template [T=void]
 */
export function gate<T = void>(): {
    promise: Promise<T>;
    release: (value: T) => void;
    reject: (error: Error) => void;
};
/** Lets pending microtasks and promise chains run. */
export function flush(): Promise<any>;
