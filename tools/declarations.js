// Generates the type declarations of all entry points into types/ (see package.json exports).
// An installed package lies in node_modules, where TypeScript reads JavaScript only up to
// maxNodeModuleJsDepth, and a jsconfig.json always sets it to 2 regardless of `extends`; the modules
// import each other deeper than that, so consumers read these declarations instead.
// `--check` fails when the committed declarations are not current.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "types");
const entries = ["core/index.js", "platform/index.js", "ui/index.js", "harness/build.cjs", "harness/testing.cjs", "harness/checks.cjs"].map(name => path.join(root, "src", name));

/** @returns {Map<string, string>} generated files by path relative to types/, with LF line ends */
function generate() {
  const program = ts.createProgram(entries, {
    allowJs: true,
    declaration: true,
    emitDeclarationOnly: true,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    target: ts.ScriptTarget.ES2022,
    lib: ["lib.es2023.d.ts", "lib.dom.d.ts", "lib.dom.iterable.d.ts", "lib.dom.asynciterable.d.ts"],
    types: ["node"],
    skipLibCheck: true,
    rootDir: path.join(root, "src"),
    outDir: output,
    newLine: ts.NewLineKind.LineFeed
  });
  /** @type {Map<string, string>} */
  const files = new Map();
  const result = program.emit(undefined, (fileName, text) => {
    files.set(path.relative(output, fileName).replaceAll("\\", "/"), text);
  });
  const errors = ts.getPreEmitDiagnostics(program).concat(result.diagnostics).filter(diagnostic => diagnostic.category === ts.DiagnosticCategory.Error);
  if (errors.length) throw new Error(ts.formatDiagnostics(errors, { getCanonicalFileName: name => name, getCurrentDirectory: () => root, getNewLine: () => "\n" }));
  return files;
}

/** @param {string} directory @returns {string[]} files below directory, relative to it */
function existing(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile())
    .map(entry => path.relative(directory, path.join(entry.parentPath, entry.name)).replaceAll("\\", "/"));
}

const files = generate();
if (process.argv.includes("--check")) {
  const stale = [...files].filter(([name, text]) => !fs.existsSync(path.join(output, name)) || fs.readFileSync(path.join(output, name), "utf8").replaceAll("\r\n", "\n") !== text).map(([name]) => name);
  const extra = existing(output).filter(name => !files.has(name));
  if (stale.length || extra.length) {
    console.error(`types/ is not current (${[...stale, ...extra].join(", ")}). Run: node tools/declarations.js`);
    process.exitCode = 1;
  }
} else {
  fs.rmSync(output, { recursive: true, force: true });
  for (const [name, text] of files) {
    fs.mkdirSync(path.dirname(path.join(output, name)), { recursive: true });
    fs.writeFileSync(path.join(output, name), text);
  }
}
