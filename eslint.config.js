import js from "@eslint/js";
import globals from "globals";

const noFocusedTests = {
  selector: "CallExpression[callee.type='MemberExpression'][callee.property.name=/^(only|skip|todo)$/]",
  message: "Focused, skipped and todo tests are forbidden because they silently weaken verification."
};

export default [
  {
    ignores: ["node_modules/**", "coverage/**"]
  },
  {
    linterOptions: { reportUnusedDisableDirectives: "error" }
  },
  js.configs.recommended,
  {
    // core is pure: only ECMAScript globals, so any DOM, browser or Node API is an undefined name.
    files: ["src/core/**/*.js"],
    languageOptions: { ecmaVersion: 2022, sourceType: "module", globals: {} }
  },
  {
    files: ["src/platform/**/*.js", "src/ui/**/*.js"],
    languageOptions: { ecmaVersion: 2022, sourceType: "module", globals: globals.browser }
  },
  {
    files: ["src/harness/**/*.cjs"],
    languageOptions: { ecmaVersion: 2022, sourceType: "commonjs", globals: globals.node }
  },
  {
    files: ["src/harness/**/*.js"],
    languageOptions: { ecmaVersion: 2022, sourceType: "module", globals: globals.node }
  },
  {
    files: ["test/**/*.js", "tools/**/*.js", "eslint.config.js"],
    languageOptions: { ecmaVersion: 2022, sourceType: "module", globals: globals.node },
    rules: { "no-restricted-syntax": ["error", noFocusedTests] }
  },
  {
    files: ["test/consumer/**/*.js"],
    languageOptions: { globals: globals.browser }
  }
];
