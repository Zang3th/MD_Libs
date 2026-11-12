declare const _exports: {
    projectStats: typeof import("./stats.cjs").projectStats;
    formatStats: typeof import("./stats.cjs").formatStats;
    eslintConfig: typeof import("./eslint.cjs").eslintConfig;
    noFocusedTests: {
        selector: string;
        message: string;
    };
    compareIcons: typeof import("./icons.cjs").compareIcons;
    createChecker: typeof import("./architecture.cjs").createChecker;
    executableSource: typeof import("./architecture.cjs").executableSource;
    exactFileExists: typeof import("./architecture.cjs").exactFileExists;
    printResult: typeof import("./architecture.cjs").printResult;
};
export = _exports;
