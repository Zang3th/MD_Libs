# AGENTS.md

MD_Libs is the shared, tested application core of several Markdown apps like MD_Manager (`../MD_Manager`) and MD_Calendar (`../MD_Calendar`). Its purpose is to remove duplication between them and to build a usable library on top of that; code that removes no duplication, cannot be abstracted easily and does not strengthen the core does not belong here.

## Principles

- Implement only what is explicitly requested, using the smallest localized solution.
- [docs/Plan.md](docs/Plan.md) is the plan of this project. [docs/Roadmap.md](docs/Roadmap.md) is owned by the user and changes only on explicit request; it uses the MD_Manager Markdown layout.
- Everything except the roadmap is English: code, identifiers, comments, documentation.

## Architecture

- `src/core/` is pure: no DOM, no browser APIs, no Node APIs. `src/platform/` uses browser APIs without rendering. `src/ui/` renders DOM. `src/harness/` holds Node tooling for the applications and is never bundled into them.
- Library modules are ES modules with named exports and no side effects on import. Anything with state is made by `create(options)` with exactly one options object; what registers listeners, timers, or observers returns `destroy()`. Functions that need tools or browser objects from the app take them in their options object; pure functions take their data as arguments.
- A module covers one topic. Helpers without a topic of their own stay internal (`src/ui/internal.js`) and are not exported.
- Every decision is a pure function over plain data. Code that touches the DOM, layout, Web Audio, IndexedDB, or the File System Access API contains no branching logic of its own; browser objects are passed in, never taken from globals.
- MD_Libs has no runtime dependency. Tools such as SortableJS, esbuild, TypeScript or `AudioContext` are passed in by the caller.
- Harness modules are CommonJS (`.cjs`) so that the applications' CommonJS tooling can require them. They are published as three entry points: `harness/build`, `harness/testing`, `harness/checks`.
- `config/` holds the compiler options the applications' jsconfig files extend. `types/` holds the generated declarations of the entry points; regenerate them with `node tools/declarations.js` after changing a module's JSDoc. `test/consumer/` type-checks an app and a harness consumer against an installed copy of the package; keep it in step with the public API.

## Tests

- `npm run verify` is the Definition of Done: type checking, linting with zero warnings, and the unit tests with coverage thresholds.
- Tests use `node:test` only. No Playwright, no browser tests, no visual tests; DOM glue runs against happy-dom (`test/helpers/dom.js`), real-browser behavior is covered by the applications' end-to-end tests.
- A behavior is tested once, in the repository that owns the code. Logic moved here brings its tests along, and the applications drop theirs; edge cases and race interleavings are covered here with fakes, the applications keep one end-to-end path per wiring.
- Fakes (storage, scheduler, File System Access handles, IndexedDB, AudioContext) live in `src/harness/fakes.cjs`, are exported through `harness/testing` and are shared with the applications' unit tests.
- Differential tests against the previous MD_Manager code ([plan](docs/Plan.md), section 1) are temporary; delete them once MD_Manager uses the module.
- Tests are deterministic, isolated, and order-independent. Timers, clocks, and browser objects are fakes passed in by the test.
- Never lower a coverage threshold or weaken a check to make a change pass. Do not commit focused or skipped tests.

## Changes

- There are no releases. The applications depend on `master`, so `master` must pass `npm run verify` at all times.
- A change to a public export updates MD_Manager and MD_Calendar in the same piece of work.
