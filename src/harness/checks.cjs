"use strict";

// Checks shared by the applications: the architecture rule engine, the icon comparison, the ESLint configuration
// and the size report.

module.exports = {
  ...require("./architecture.cjs"),
  ...require("./icons.cjs"),
  ...require("./eslint.cjs"),
  ...require("./stats.cjs")
};
