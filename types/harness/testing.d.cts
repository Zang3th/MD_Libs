declare const _exports: {
    loadClassic: typeof import("./load-classic.cjs").loadClassic;
    storageContract: typeof import("./storage-contract.cjs").storageContract;
    fileSystem: typeof import("./fakes.cjs").fileSystem;
    indexedDB: typeof import("./fakes.cjs").indexedDB;
    audioContext: typeof import("./fakes.cjs").audioContext;
    clock: typeof import("./fakes.cjs").clock;
    gate: typeof import("./fakes.cjs").gate;
    flush: typeof import("./fakes.cjs").flush;
};
export = _exports;
