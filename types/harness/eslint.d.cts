/**
 * Production modules in app.js, domain/, io/ and ui/ are browser ES modules; tests and tools are CommonJS
 * for Node.js; end-to-end tests also see browser globals for code they run in the page.
 * @param {{ js: { configs: { recommended: object } }, globals: { browser: object, node: object }, ignores?: string[] }} tools
 *   `ignores` adds app-specific paths to the generated and installed ones.
 */
export function eslintConfig({ js, globals, ignores }: {
    js: {
        configs: {
            recommended: object;
        };
    };
    globals: {
        browser: object;
        node: object;
    };
    ignores?: string[];
}): any[];
export namespace noFocusedTests {
    let selector: string;
    let message: string;
}
