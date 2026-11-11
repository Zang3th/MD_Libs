# AGENTS.md

Rules for every agent working in this repository. MD_Libs is the shared, tested application core of MD_Manager (`../MD_Manager`) and MD_Calendar (`../MD_Calendar`). Its purpose is to remove duplication between them; code that removes no duplication and does not strengthen the core does not belong here.

## Principles

- Implement only what is explicitly requested, using the smallest localized solution.
- [docs/Plan.md](docs/Plan.md) is the plan of record (German). [docs/Roadmap.md](docs/Roadmap.md) is owned by the user and changes only on explicit request; it uses the MD_Manager Markdown layout.
- MD_Manager is the reference. Code moves out of MD_Manager and may be generalized, but nothing an MD_Manager user sees or experiences may change: appearance, texts, interaction, timing, search results, and the content and handling of files. MD_Calendar adapts or sets options.
- Everything except the plan and the roadmap is English: code, identifiers, comments, documentation.

## Architecture

- `src/core/` is pure: no DOM, no browser APIs, no Node APIs. `src/platform/` uses browser APIs without rendering. `src/ui/` renders DOM. `src/harness/` holds Node tooling for the applications and is never bundled into them.
- Library modules are ES modules with named exports and no side effects on import. Anything that registers listeners, timers, or observers does so in a `create…()` call and returns `destroy()`.
- Every decision is a pure function over plain data. Code that touches the DOM, layout, Web Audio, IndexedDB, or the File System Access API contains no branching logic of its own; browser objects are passed in, never taken from globals.
- SortableJS is the only runtime dependency and may be imported only by `src/ui/sortable`. Harness modules receive tools such as esbuild from the caller.
- Harness modules are CommonJS (`.cjs`) so that the applications' CommonJS tooling can require them.

## Tests

- `npm run verify` is the Definition of Done: type checking, linting with zero warnings, and the unit tests with coverage thresholds.
- Tests use `node:test` only. No Playwright, no browser tests, no visual tests; real-browser behavior is covered by the applications' end-to-end tests.
- A behavior is tested once, in the repository that owns the code. Logic moved here brings its tests along, and the applications drop theirs; edge cases and race interleavings are covered here with fakes, the applications keep one end-to-end path per wiring.
- Fakes (storage, scheduler, File System Access handles, IndexedDB, AudioContext) live in `src/harness/fakes` and are shared with the applications' unit tests.
- Differential tests against frozen MD_Manager code are migration aids and are deleted once the module is integrated in MD_Manager.
- Tests are deterministic, isolated, and order-independent. Timers, clocks, and browser objects are fakes passed in by the test.
- Never lower a coverage threshold or weaken a check to make a change pass. Do not commit focused or skipped tests.

## Changes

- There are no releases. The applications depend on `master`, so `master` must pass `npm run verify` at all times.
- A change to a public export updates MD_Manager and MD_Calendar in the same piece of work.
