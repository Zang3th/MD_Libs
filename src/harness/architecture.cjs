"use strict";

// Rule engine for the architecture checkers of the applications. The apps add their own layer rules
// with `forbid`; the checks every app shares are methods of the checker.

const fs = require("node:fs");
const path = require("node:path");

/** @param {string} value */
function slash(value) {
  return value.replaceAll("\\", "/");
}

/**
 * Blanks comments and the contents of strings and templates without substitutions, keeping line breaks,
 * so that examples and user-facing texts do not look like code. The scanner runs without parsing, so a
 * regular expression literal is read as code; a backtick inside one is best written as \u0060.
 * @param {{ ts: typeof import("typescript"), source: string }} options
 */
function executableSource({ ts, source }) {
  const scanner = ts.createScanner(ts.ScriptTarget.ES2022, false, ts.LanguageVariant.Standard, source);
  const literals = new Set([ts.SyntaxKind.StringLiteral, ts.SyntaxKind.NoSubstitutionTemplateLiteral, ts.SyntaxKind.RegularExpressionLiteral,
    ts.SyntaxKind.SingleLineCommentTrivia, ts.SyntaxKind.MultiLineCommentTrivia]);
  let result = "";
  let cursor = 0;
  for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan()) {
    const start = scanner.getTokenPos();
    const end = scanner.getTextPos();
    result += source.slice(cursor, start);
    result += literals.has(token) ? source.slice(start, end).replace(/[^\r\n]/g, " ") : source.slice(start, end);
    cursor = end;
  }
  return result + source.slice(cursor);
}

/**
 * Whether a relative path exists with exactly this casing, also on case-insensitive file systems.
 * @param {string} root @param {string} relativePath
 */
function exactFileExists(root, relativePath) {
  const normalized = path.posix.normalize(slash(relativePath));
  if (normalized !== slash(relativePath) || normalized === "." || normalized.startsWith("../") || path.posix.isAbsolute(normalized)) return false;
  let current = root;
  for (const part of normalized.split("/")) {
    if (!fs.existsSync(current) || !fs.statSync(current).isDirectory() || !fs.readdirSync(current).includes(part)) return false;
    current = path.join(current, part);
  }
  return fs.existsSync(current);
}

/** @param {string} resource */
function isRemote(resource) {
  return /^(?:[a-z]+:)?\/\//i.test(resource) || /^data:/i.test(resource);
}

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
function createChecker({ ts, root }) {
  /** @type {string[]} */
  const violations = [];
  /** @type {Map<string, string>} */
  const raw = new Map();
  /** @type {Map<string, string>} */
  const executable = new Map();

  /** @param {string} file @param {string} rule @param {string} detail */
  function report(file, rule, detail) {
    violations.push(`${slash(file)}: ${rule} — ${detail}`);
  }

  /** @param {string} file */
  function source(file) {
    if (!raw.has(file)) raw.set(file, fs.readFileSync(path.join(root, file), "utf8"));
    return /** @type {string} */ (raw.get(file));
  }

  /** @param {string} file */
  function code(file) {
    if (!executable.has(file)) executable.set(file, executableSource({ ts, source: source(file) }));
    return /** @type {string} */ (executable.get(file));
  }

  /** @param {string[]} files @param {string} rule @param {Array<[RegExp, string]>} patterns */
  function forbid(files, rule, patterns) {
    for (const file of files) {
      for (const [pattern, detail] of patterns) {
        if (pattern.test(code(file))) report(file, rule, detail);
      }
    }
  }

  /** Static import specifiers in source order. @param {string} file */
  function importsOf(file) {
    return ts.preProcessFile(source(file), true, true).importedFiles.map(imported => imported.fileName);
  }

  /** JavaScript files below a directory, sorted; anything else and symbolic links are violations. @param {string} directory */
  function javascriptFiles(directory) {
    /** @type {string[]} */
    const files = [];
    /** @param {string} relative */
    function visit(relative) {
      for (const entry of fs.readdirSync(path.join(root, relative), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        const target = slash(path.join(relative, entry.name));
        if (fs.lstatSync(path.join(root, target)).isSymbolicLink()) report(target, "ARCH-FILES-001", "symbolic links are forbidden in production layers");
        else if (entry.isDirectory()) visit(target);
        else if (entry.name.endsWith(".js")) files.push(target);
        else report(target, "ARCH-FILES-002", "only JavaScript files are allowed in production layer directories");
      }
    }
    if (fs.existsSync(path.join(root, directory))) visit(directory);
    return files.sort();
  }

  /**
   * Production modules: no exports, dynamic imports, CommonJS or network APIs; one shared namespace;
   * imports per layer; app.js imports every module once in the order domain, io, ui.
   * @param {{ domain: string[], io: string[], ui: string[] }} layers @param {ModuleRules} rules
   */
  function checkModules(layers, rules) {
    const app = exactFileExists(root, "app.js") ? ["app.js"] : [];
    const modules = [...layers.domain, ...layers.io, ...layers.ui];
    const production = [...modules, ...app];

    forbid(production, "ARCH-SCRIPTS-001", [
      [/(?:^|\n)\s*export\s/, `production modules share the window.${rules.namespace} namespace instead of exports`],
      [/\bimport\s*\(/, "dynamic imports are forbidden in production code"],
      [/\brequire\s*\(/, "CommonJS is forbidden in production code"],
      [/\b(?:fetch|XMLHttpRequest|WebSocket|EventSource)\b/, "network APIs are forbidden in production code"]
    ]);
    const namespace = new RegExp(`window\\.${rules.namespace}\\s*=\\s*window\\.${rules.namespace}\\s*\\|\\|`);
    for (const file of production) {
      if (!namespace.test(code(file))) report(file, "ARCH-NAMESPACE-001", `production modules must use the single window.${rules.namespace} namespace`);
    }

    /** @type {Array<["domain" | "io" | "ui" | "app", string[]]>} */
    const groups = [["domain", layers.domain], ["io", layers.io], ["ui", layers.ui], ["app", app]];
    for (const [layer, files] of groups) {
      for (const file of files) {
        const allowed = rules.packages(file, layer);
        for (const specifier of importsOf(file)) {
          if (specifier.startsWith(".")) {
            if (layer !== "app") report(file, "ARCH-IMPORTS-001", `'${specifier}': layers communicate through the namespace; only app.js imports production modules`);
          } else if (!allowed.some(entry => specifier === entry || specifier.startsWith(`${entry}/`))) {
            report(file, "ARCH-IMPORTS-001", `package '${specifier}' is not allowed in ${layer === "app" ? "app.js" : file}`);
          }
        }
      }
    }

    if (!app.length) {
      if (modules.length) report("app.js", "ARCH-WIRING-001", "production modules exist but the bundle entry app.js is missing");
      return;
    }
    const order = importsOf("app.js").filter(specifier => specifier.startsWith(".")).map(specifier => path.posix.normalize(slash(specifier)));
    for (const file of modules) {
      const count = order.filter(value => value === file).length;
      if (count !== 1) report("app.js", "ARCH-WIRING-001", `'${file}' must be imported exactly once, found ${count}`);
    }
    for (const specifier of order) {
      if (!modules.includes(specifier)) report("app.js", "ARCH-WIRING-001", `import '${specifier}' is not a production module`);
    }
    const ordered = [layers.domain, layers.io, layers.ui].filter(group => group.length);
    for (let index = 1; index < ordered.length; index += 1) {
      if (Math.max(...ordered[index - 1].map(file => order.indexOf(file))) >= Math.min(...ordered[index].map(file => order.indexOf(file)))) {
        report("app.js", "ARCH-WIRING-002", "modules must be imported in the order domain, io, ui");
        break;
      }
    }
  }

  /**
   * The page loads only the deferred classic bundle; every local resource exists with exact casing.
   * @param {string} html @param {string} bundle @param {boolean} [required] The page must load the bundle.
   */
  function checkPage(html, bundle, required = true) {
    const page = source(html);
    const scripts = [...page.matchAll(/<script\b([^>]*)\bsrc=["']([^"']+)["']([^>]*)><\/script>/gi)].map(match => ({ attributes: `${match[1]} ${match[3]}`, src: slash(match[2]) }));
    for (const script of scripts) {
      if (!/\bdefer\b/i.test(script.attributes)) report(html, "ARCH-SCRIPTS-002", `script '${script.src}' must be deferred`);
      if (/\btype\s*=\s*["']module["']/i.test(script.attributes)) report(html, "ARCH-SCRIPTS-002", `script '${script.src}' must not be an ES module`);
      if (script.src !== bundle) report(html, "ARCH-WIRING-001", `script '${script.src}' is not the bundle ${bundle}; modules are imported by app.js`);
    }
    if (required && scripts.filter(script => script.src === bundle).length !== 1) report(html, "ARCH-WIRING-001", `the page must load ${bundle} exactly once`);
    for (const match of page.matchAll(/<(?:script|link|img|use|image)\b[^>]*\b(?:src|href)=["']([^"'#][^"']*)["'][^>]*>/gi)) {
      const resource = match[1];
      if (isRemote(resource)) report(html, "ARCH-RESOURCES-001", `resource '${resource}' must be stored locally`);
      else if (resource.split(/[?#]/, 1)[0] !== bundle && !exactFileExists(root, resource.split(/[?#]/, 1)[0])) {
        report(html, "ARCH-RESOURCES-002", `resource '${resource}' does not exist with exact path casing`);
      }
    }
  }

  /** No CSS imports; every `url()` is local and exists with exact casing. @param {string} stylesheet */
  function checkStyles(stylesheet) {
    const css = source(stylesheet);
    if (/@import\b/i.test(css)) report(stylesheet, "ARCH-RESOURCES-001", "CSS imports are forbidden");
    for (const match of css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) {
      const resource = match[1].trim();
      if (resource.startsWith("#")) continue;
      if (isRemote(resource)) report(stylesheet, "ARCH-RESOURCES-001", `resource '${resource}' must be stored locally`);
      else if (!exactFileExists(root, resource.split(/[?#]/, 1)[0])) report(stylesheet, "ARCH-RESOURCES-002", `resource '${resource}' does not exist with exact path casing`);
    }
  }

  /** Production dependencies are only the allowed ones; required ones are present. @param {string[]} allowed @param {string[]} [required] */
  function checkDependencies(allowed, required = []) {
    const dependencies = Object.keys(JSON.parse(source("package.json")).dependencies || {});
    for (const dependency of dependencies) {
      if (!allowed.includes(dependency)) report("package.json", "ARCH-DEPENDENCIES-001", `production dependency '${dependency}' is not allowed`);
    }
    for (const dependency of required) {
      if (!dependencies.includes(dependency)) report("package.json", "ARCH-DEPENDENCIES-001", `the dependency '${dependency}' is required`);
    }
  }

  return {
    root,
    report,
    source,
    code,
    forbid,
    importsOf,
    javascriptFiles,
    exists: (/** @type {string} */ relative) => exactFileExists(root, relative),
    checkModules,
    checkPage,
    checkStyles,
    checkDependencies,
    violations: () => [...violations].sort()
  };
}

/**
 * Runs a checker from the command line: prints the violations and sets the exit code.
 * @param {string[]} violations
 */
function printResult(violations) {
  if (violations.length) {
    console.error("Architecture verification failed:\n");
    for (const violation of violations) console.error(`- ${violation}`);
    process.exitCode = 1;
  } else {
    console.log("Architecture verification passed.");
  }
}

module.exports = { createChecker, executableSource, exactFileExists, printResult };
