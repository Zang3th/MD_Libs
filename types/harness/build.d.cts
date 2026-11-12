export type MDLBuildOptions = {
    esbuild: MDLEsbuild;
    root: string;
    entry?: string;
    outfile?: string;
};
export type MDLTestBundleOptions = {
    esbuild: MDLEsbuild;
    root: string;
    files: string[];
    prelude?: string;
};
export type MDLEsbuild = {
    build(options: object): Promise<unknown>;
    buildSync(options: object): {
        outputFiles?: Array<{
            text: string;
        }>;
    };
};
/**
 * esbuild options for the application bundle.
 * @param {Omit<MDLBuildOptions, "esbuild">} options
 */
export function bundleOptions({ root, entry, outfile }: Omit<MDLBuildOptions, "esbuild">): {
    absWorkingDir: string;
    entryPoints: string[];
    outfile: string;
    sourcemap: "linked";
    logLevel: "warning";
    bundle: boolean;
    format: "iife";
    platform: "browser";
    target: string;
    charset: "utf8";
    legalComments: "eof";
};
/**
 * Builds the application bundle and returns the absolute path of the written script.
 * @param {MDLBuildOptions} options
 */
export function build({ esbuild, ...options }: MDLBuildOptions): Promise<string>;
/**
 * Bundles the given production files in order for a vm context, so that unit tests can load
 * single modules with their imports. `prelude` is module code placed before the imports.
 * @param {MDLTestBundleOptions} options
 * @returns {string}
 */
export function bundleForTests({ esbuild, root, files, prelude }: MDLTestBundleOptions): string;
