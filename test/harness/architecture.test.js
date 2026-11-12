import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import ts from "typescript";
import architecture from "../../src/harness/checks.cjs";

const header = "window.App = window.App || {};\n";

/** @param {import("node:test").TestContext} t @param {Record<string, string>} files */
function fixture(t, files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mdl-architecture-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const [file, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), content);
  }
  return root;
}

/** @param {string[]} modules */
const entry = modules => `import "lib/core";\n${modules.map(file => `import "./${file}";\n`).join("")}${header}`;

const valid = {
  "domain/a.js": `import "lib/core";\n${header}// fetch("x") and document in a comment and "require(x) document" in a string are no code\n`,
  "io/b.js": header,
  "ui/c.js": `import "lib/ui/x";\n${header}`,
  "app.js": entry(["domain/a.js", "io/b.js", "ui/c.js"]),
  "App.html": '<link rel="stylesheet" href="styles.css"><svg><use href="#icon"></use></svg><script defer src="dist/app.js"></script>',
  "styles.css": "body { background: url(\"#paint\"); } .logo { background: url(logo.svg); }",
  "logo.svg": "<svg></svg>",
  "package.json": JSON.stringify({ dependencies: { lib: "1" } })
};

/** @type {import("../../src/harness/architecture.cjs").ModuleRules} */
const rules = { namespace: "App", packages: (_file, layer) => layer === "domain" ? ["lib/core"] : layer === "ui" ? ["lib/core", "lib/ui"] : layer === "app" ? ["lib"] : [] };

/** @param {string} root */
function run(root) {
  const checker = architecture.createChecker({ ts, root });
  const layers = { domain: checker.javascriptFiles("domain"), io: checker.javascriptFiles("io"), ui: checker.javascriptFiles("ui") };
  checker.forbid(layers.domain, "APP-DOMAIN-001", [[/\bdocument\b/, "no DOM in domain/"]]);
  checker.checkModules(layers, rules);
  if (checker.exists("App.html")) checker.checkPage("App.html", "dist/app.js");
  if (checker.exists("styles.css")) checker.checkStyles("styles.css");
  checker.checkDependencies(["lib"], ["lib"]);
  return checker.violations();
}

/** @param {Record<string, string>} files @param {string[]} names */
const without = (files, names) => Object.fromEntries(Object.entries(files).filter(([name]) => !names.includes(name)));

/** @param {string[]} violations @param {string} text */
const has = (violations, text) => violations.some(violation => violation.includes(text));

test("a correctly layered application passes; comments and strings are no code", t => {
  assert.deepEqual(run(fixture(t, valid)), []);
});

test("module rules: exports, dynamic imports, CommonJS, network, namespace and imports per layer", t => {
  const violations = run(fixture(t, {
    ...valid,
    "domain/a.js": `${header}export const x = 1; import("./y.js"); require("z"); fetch("u"); document.title;\n`,
    "io/b.js": `import "./a.js";\nimport "lib/core";\nwindow.Other = {};\n`,
    "ui/c.js": `import "lib/core/deep";\nimport "libx";\n${header}`
  }));
  for (const text of ["domain/a.js: ARCH-SCRIPTS-001 — production modules share", "dynamic imports", "CommonJS", "network APIs",
    "domain/a.js: APP-DOMAIN-001", "io/b.js: ARCH-NAMESPACE-001", "io/b.js: ARCH-IMPORTS-001 — './a.js'", "package 'lib/core' is not allowed in io/b.js", "package 'libx' is not allowed in ui/c.js"]) {
    assert.ok(has(violations, text), text);
  }
  assert.ok(!has(violations, "lib/core/deep"), "paths below an allowed entry point are allowed");
});

test("wiring: every module once, only modules, layer order, app.js required", t => {
  const wrong = run(fixture(t, { ...valid, "app.js": `import "./ui/c.js";\nimport "./domain/a.js";\nimport "./domain/a.js";\nimport "./missing.js";\nimport "./app.js";\nimport "app-only";\n${header}` }));
  for (const text of ["'domain/a.js' must be imported exactly once, found 2", "'io/b.js' must be imported exactly once, found 0", "import 'missing.js' is not a production module",
    "import 'app.js' is not a production module", "app.js: ARCH-WIRING-002", "package 'app-only' is not allowed in app.js"]) {
    assert.ok(has(wrong, text), text);
  }
  assert.ok(has(run(fixture(t, without(valid, ["app.js"]))), "the bundle entry app.js is missing"));
  assert.deepEqual(run(fixture(t, without(valid, ["domain/a.js", "io/b.js", "ui/c.js", "app.js"]))), []);
});

test("files in layers: found in nested folders, only JavaScript, no symbolic links", t => {
  const root = fixture(t, { ...valid, "ui/notes.txt": "x", "domain/nested/d.js": `${header}document.title;\n` });
  try {
    fs.symlinkSync(path.join(root, "io/b.js"), path.join(root, "ui/link.js"));
  } catch {
    t.diagnostic("symbolic links unavailable; only the file type rule is checked");
  }
  const violations = run(root);
  assert.ok(has(violations, "ui/notes.txt: ARCH-FILES-002"));
  assert.ok(has(violations, "domain/nested/d.js: APP-DOMAIN-001"));
  if (fs.existsSync(path.join(root, "ui/link.js"))) assert.ok(has(violations, "ui/link.js: ARCH-FILES-001"));
});

test("page and styles: deferred classic bundle only, local resources with exact casing, no CSS imports", t => {
  const violations = run(fixture(t, {
    ...valid,
    "App.html": '<script src="other.js"></script><script defer type="module" src="dist/app.js"></script><img src="https://e.de/x.png"><img src="Logo.svg"><link href="data:text/css,x">',
    "styles.css": "@import url(x.css); a { background: url(http://e.de/a.png); } b { background: url(missing.png); }"
  }));
  for (const text of ["script 'other.js' must be deferred", "script 'dist/app.js' must not be an ES module", "script 'other.js' is not the bundle",
    "App.html: ARCH-RESOURCES-001 — resource 'https://e.de/x.png'", "resource 'Logo.svg' does not exist with exact path casing", "resource 'data:text/css,x' must be stored locally",
    "styles.css: ARCH-RESOURCES-001 — CSS imports are forbidden", "resource 'http://e.de/a.png' must be stored locally", "resource 'missing.png' does not exist"]) {
    assert.ok(has(violations, text), text);
  }
  assert.ok(has(run(fixture(t, { ...valid, "App.html": "<p>no script</p>" })), "the page must load dist/app.js exactly once"));
});

test("dependencies: only allowed ones, required ones present", t => {
  const violations = run(fixture(t, { ...valid, "package.json": JSON.stringify({ dependencies: { other: "1" } }) }));
  assert.ok(has(violations, "production dependency 'other' is not allowed"));
  assert.ok(has(violations, "the dependency 'lib' is required"));
  assert.ok(has(run(fixture(t, { ...valid, "package.json": "{}" })), "the dependency 'lib' is required"));
});

test("exact paths reject other casing, parent paths and absolute paths", t => {
  const root = fixture(t, { "a/B.txt": "" });
  assert.equal(architecture.exactFileExists(root, "a/B.txt"), true);
  for (const wrong of ["a/b.txt", "../a/B.txt", "/a/B.txt", "a//B.txt", ".", "a/B.txt/c"]) assert.equal(architecture.exactFileExists(root, wrong), false, wrong);
});

test("executable source blanks comments and strings but keeps lines", () => {
  const source = 'const a = "fetch"; // fetch\n/* fetch */ `fetch`;\nfetch();';
  const code = architecture.executableSource({ ts, source });
  assert.equal(code.split("\n").length, 3);
  assert.equal((code.match(/fetch/g) || []).length, 1);
});

test("results are printed and failures set the exit code", t => {
  /** @type {string[]} */
  const output = [];
  t.mock.method(console, "log", (/** @type {string} */ line) => output.push(line));
  t.mock.method(console, "error", (/** @type {string} */ line) => output.push(line));
  const exitCode = process.exitCode;
  architecture.printResult([]);
  architecture.printResult(["a: B — c"]);
  assert.equal(process.exitCode, 1);
  process.exitCode = exitCode;
  assert.deepEqual(output, ["Architecture verification passed.", "Architecture verification failed:\n", "- a: B — c"]);
});
