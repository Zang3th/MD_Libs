"use strict";

// A consumer of the harness entry points as the applications' Node tooling is: CommonJS checked with
// checkJs. Every @ts-expect-error fails the check when the types degrade to `any`.
const { build } = require("@zang3th/md-libs/harness/build");
const { createChecker, projectStats } = require("@zang3th/md-libs/harness/checks");
const { clock, storageContract } = require("@zang3th/md-libs/harness/testing");

// @ts-expect-error: build takes one options object
build();

// @ts-expect-error: the checker needs TypeScript and a root
createChecker({ root: "." });

/** @type {number} */
const lines = projectStats({ root: ".", sources: { JS: ["src/"] } }).total;

// @ts-expect-error: the clock starts at a number
clock("now");

// @ts-expect-error: the contract needs a setup
storageContract({ name: "adapter" });

module.exports = { lines };
