import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: ["node_modules/**", "coverage/**"]
  },
  {
    linterOptions: { reportUnusedDisableDirectives: "error" }
  },
  js.configs.recommended,
  {
    files: ["src/harness/**/*.cjs"],
    languageOptions: { ecmaVersion: 2022, sourceType: "commonjs", globals: globals.node }
  },
  {
    files: ["test/**/*.js", "eslint.config.js"],
    languageOptions: { ecmaVersion: 2022, sourceType: "module", globals: globals.node },
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.type='MemberExpression'][callee.property.name=/^(only|skip|todo)$/]",
          message: "Focused, skipped and todo tests are forbidden because they silently weaken verification."
        }
      ]
    }
  }
];
