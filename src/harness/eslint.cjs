"use strict";

// Flat ESLint configuration shared by the applications. ESLint's recommended rules and the globals
// package come from the app, so MD_Libs adds no dependency to it.

/** Focused, skipped, fixme and todo tests silently weaken verification. */
const noFocusedTests = {
  selector: "CallExpression[callee.type='MemberExpression'][callee.property.name=/^(only|skip|fixme|todo)$/]",
  message: "Focused, skipped, fixme and todo tests are forbidden because they silently weaken verification."
};

/**
 * Production modules in app.js, domain/, io/ and ui/ are browser ES modules; tests and tools are CommonJS
 * for Node.js; end-to-end tests also see browser globals for code they run in the page.
 * @param {{ js: { configs: { recommended: object } }, globals: { browser: object, node: object }, ignores?: string[] }} tools
 *   `ignores` adds app-specific paths to the generated and installed ones.
 */
function eslintConfig({ js, globals, ignores = [] }) {
  return [
    { ignores: ["dist/**", "node_modules/**", "playwright-report/**", "test-results/**", "vendor/**", ...ignores] },
    { linterOptions: { reportUnusedDisableDirectives: "error" } },
    js.configs.recommended,
    {
      files: ["app.js", "domain/**/*.js", "io/**/*.js", "ui/**/*.js"],
      languageOptions: { ecmaVersion: 2022, sourceType: "module", globals: globals.browser }
    },
    {
      files: ["tests/**/*.js", "tools/**/*.js", "playwright.config.js", "eslint.config.js"],
      languageOptions: { ecmaVersion: 2022, sourceType: "commonjs", globals: globals.node },
      rules: { "no-restricted-syntax": ["error", noFocusedTests] }
    },
    {
      files: ["tests/e2e/**/*.js"],
      languageOptions: { globals: globals.browser }
    }
  ];
}

module.exports = { eslintConfig, noFocusedTests };
