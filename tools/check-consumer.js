// Type-checks test/consumer as the applications see MD_Libs: a copy of the published files in
// node_modules, where TypeScript reads JavaScript only up to maxNodeModuleJsDepth, and the jsconfig
// files extending config/ through node_modules. A self-reference from this repository would bypass both.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "md-libs-consumer-"));
try {
  const installed = path.join(temp, "node_modules/@zang3th/md-libs");
  for (const entry of ["package.json", ...packageJson.files]) fs.cpSync(path.join(root, entry), path.join(installed, entry), { recursive: true });
  fs.cpSync(path.join(root, "test/consumer"), temp, { recursive: true });
  // The applications install these themselves; the harness types refer to TypeScript.
  for (const dependency of ["@types", "typescript"]) {
    fs.symlinkSync(path.join(root, "node_modules", dependency), path.join(temp, "node_modules", dependency), "junction");
  }
  const tsc = path.join(root, "node_modules/typescript/bin/tsc");
  for (const config of ["jsconfig.json", "jsconfig.harness.json"]) {
    execFileSync(process.execPath, [tsc, "-p", path.join(temp, config)], { cwd: temp, stdio: "inherit" });
  }
} catch (error) {
  // tsc has already printed its diagnostics; anything else is reported here.
  if (!(error instanceof Error && "status" in error)) console.error(error);
  process.exitCode = 1;
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
