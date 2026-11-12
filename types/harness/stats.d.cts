export type MDLStatsOptions = {
    /**
     * The application folder.
     */
    root: string;
    /**
     * Files per language, relative to `root`. A path ending in `/` stands for
     * the `.js` files directly in that folder. The language `HTML` skips `<!-- -->` comments, every other one `/* *\/`;
     * `JS` also skips `//` lines.
     */
    sources: Record<string, string[]>;
    /**
     * Folder searched recursively for `*.test.js` and `*.spec.js`; default `tests`.
     */
    tests?: string;
};
export type MDLStats = {
    lines: Record<string, number>;
    total: number;
    tests: number;
};
/**
 * Counts the source lines per language and the tests of an application.
 * @param {MDLStatsOptions} options
 * @returns {MDLStats}
 */
export function projectStats({ root, sources, tests }: MDLStatsOptions): MDLStats;
/** The report the applications print. @param {MDLStats} stats @returns {string} */
export function formatStats({ lines, total, tests }: MDLStats): string;
