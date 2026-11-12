// Prints the library's source lines and test count with its own harness/checks, as the applications do.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import checks from "../src/harness/checks.cjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const harness = fs.readdirSync(path.join(root, "src/harness")).filter(name => name.endsWith(".cjs")).sort().map(name => `src/harness/${name}`);
console.log(checks.formatStats(checks.projectStats({
  root,
  sources: { JS: ["src/core/", "src/platform/", "src/ui/", ...harness] },
  tests: "test"
})));
