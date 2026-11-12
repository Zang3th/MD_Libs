"use strict";

// Test tooling for MD_Libs and the applications: fakes of browser APIs, the storage adapter contract
// and the loader that runs production modules in a vm context.

module.exports = {
  ...require("./fakes.cjs"),
  ...require("./storage-contract.cjs"),
  ...require("./load-classic.cjs")
};
