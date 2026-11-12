export type ModuleRules = {
    /**
     * Global namespace every production module assigns, e.g. "MDManager".
     */
    namespace: string;
    /**
     *   Packages or entry points a file may import; a specifier matches an entry or a path below it.
     */
    packages: (file: string, layer: "domain" | "io" | "ui" | "app") => string[];
};
/**
 * @typedef {object} ModuleRules
 * @property {string} namespace Global namespace every production module assigns, e.g. "MDManager".
 * @property {(file: string, layer: "domain" | "io" | "ui" | "app") => string[]} packages
 *   Packages or entry points a file may import; a specifier matches an entry or a path below it.
 */
/**
 * Creates a checker for an application in `root`. Violations read `file: RULE — detail`.
 * @param {{ ts: typeof import("typescript"), root: string }} options
 */
export function createChecker({ ts, root }: {
    ts: typeof import("typescript");
    root: string;
}): {
    root: string;
    report: (file: string, rule: string, detail: string) => void;
    source: (file: string) => string;
    code: (file: string) => string;
    forbid: (files: string[], rule: string, patterns: Array<[RegExp, string]>) => void;
    importsOf: (file: string) => string[];
    javascriptFiles: (directory: string) => string[];
    exists: (relative: string) => boolean;
    checkModules: (layers: {
        domain: string[];
        io: string[];
        ui: string[];
    }, rules: ModuleRules) => void;
    checkPage: (html: string, bundle: string, required?: boolean) => void;
    checkStyles: (stylesheet: string) => void;
    checkDependencies: (allowed: string[], required?: string[]) => void;
    violations: () => string[];
};
/**
 * Blanks comments and the contents of strings and templates without substitutions, keeping line breaks,
 * so that examples and user-facing texts do not look like code. The scanner runs without parsing, so a
 * regular expression literal is read as code; a backtick inside one is best written as \u0060.
 * @param {{ ts: typeof import("typescript"), source: string }} options
 */
export function executableSource({ ts, source }: {
    ts: typeof import("typescript");
    source: string;
}): string;
/**
 * Whether a relative path exists with exactly this casing, also on case-insensitive file systems.
 * @param {string} root @param {string} relativePath
 */
export function exactFileExists(root: string, relativePath: string): boolean;
/**
 * Runs a checker from the command line: prints the violations and sets the exit code.
 * @param {string[]} violations
 */
export function printResult(violations: string[]): void;
