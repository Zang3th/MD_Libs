# MD_Libs – Plan

Rules for working here: [AGENTS.md](../AGENTS.md). API: [README](../README.md). Versions: [Roadmap](Roadmap.md).

## 1. Moving code into MD_Libs

1. **MD_Manager is the reference.** Nothing its users see or experience changes: appearance, texts, interaction, timing, keyboard, drag and drop, search results, file content and file handling. Internals, interfaces and DOM structure may change.
2. Modules start from MD_Manager's code and are generalized. MD_Calendar's extra needs become options whose defaults are MD_Manager's behavior.
3. What cannot move without a behavior change stays in the app, such as MD_Manager's parser `io/markdown.js`.
4. Acceptance: MD_Manager's end-to-end assertions and visual baselines stay green unchanged. Where a generalization can touch user-visible results (ranking, serialization, save decisions, drop indices, dates), a differential test against the previous MD_Manager code proves equality.
5. The apps keep domain models, file formats and golden files, recurrence rules, ICS and vCard, view rendering, CSS, texts and error codes (`MDM-`, `MDC-`).

## 2. Integration in the applications

- esbuild bundles `app.js` and its imports into `dist/app.js`, a classic script with source map that runs from `file://`. `dist/` is not checked in; without it the page only shows how to build.
- The apps depend on `github:Zang3th/MD_Libs#master`; `package-lock.json` pins the commit, `npm update @zang3th/md-libs` moves it. Locally `npm link ../MD_Libs`.
- Production files are ES modules on a shared namespace (`window.MDManager`, `window.MDCalendar`) without exports or dynamic imports. Only `app.js` imports them, in the order domain, io, ui; library modules are imported where used.
- Layers, enforced by each app's architecture checker:

  | App layer | May import |
  |---|---|
  | `domain/` | `core` |
  | `io/` | `core`, `platform` |
  | `ui/` | `core`, `ui`, SortableJS |
  | `app.js` | everything |

- Both jsconfig files extend `config/` through the path `./node_modules/@zang3th/md-libs/config/…`; Playwright does not resolve package exports in `extends`. The apps keep `paths` (their SortableJS declaration), `include` and `exclude`.
- `tools/build.js`, `tools/check-architecture.js` and `tools/project-stats.js` in the apps are thin calls into the harness.

## 3. Library conventions

- Public types carry the prefix `MDL`. Error classes have `name` and `code` (`MDL_STORAGE_CONFLICT`); application error codes belong to the apps.
- Texts, icons, clocks, timers and storage adapters are passed in; default texts are English.
- No CSS. ui modules render MD_Manager's DOM structure and classes; MD_Calendar adapts its stylesheet.
- No build step. The package publishes `src/` and `config/`.

## 4. Module behavior

What the README does not state:

- **history:** `execute` is a no-op when `redo()` returns `false` and rolls back on an error. The saved-state distance survives trimming, discarded redo branches and `replaceCurrent`.
- **markdown:** helpers for the shared dialect only; parsers and serializers stay in the apps. A file with an invalid character is rejected by MD_Manager and opened with a warning by MD_Calendar.
- **search:** MD_Manager's scorer (subsequence, word starts, smart case, top-K with threshold, narrowing). Results also carry the index of the matched field.
- **dates:** no `Intl`; names come from the app, so output is identical on every platform. `periodStart` and `addPeriod` take a day key or a UTC time and return the same kind; times reach years a key cannot write, which MD_Manager's archive needs.
- **storage:** `expected` is the content the caller expects on disk (`null`: must not exist, `undefined`: unchecked). Writes of one adapter are queued. Stamps are opaque (`lastModified:size`); `"0:0"` means no metadata.
- **handles:** the same file or folder is merged through `isSameEntry`.
- **session:** one per opened file or folder. A conflict needs changed content, not just a new stamp. A deleted file in a folder is a conflict; a deleted single file is one error message. Read-only files always reload. Written files are read back. Saves during a save coalesce. A session token and a revision drop stale results. Content equal to the saved one counts as saved. MD_Calendar uses `open`, `shouldCheck` (no reload while its dialog is open) and `confirmLeave`; MD_Manager uses none of them.
- **keymap:** every matching binding runs in binding order; modifiers not named must not be pressed.
- **popover:** MD_Manager closes its header menus on `click` outside their container and keeps Escape in its keymap, so the statistics guard applies. MD_Calendar closes on `pointerdown` and Escape and refocuses the button.
- MD_Calendar keeps dragging without lists (multi-day bars, lasso) and its date and time pickers.

## 5. Tests

- Coverage thresholds: 95 % lines and functions, 90 % branches.
- Every storage adapter passes `storageContract`. The line scanner has its own corpus (BOM, CRLF, no final newline, unknown lines); golden-file round trips stay in the apps.
- Fixed checks: an export snapshot per entry point, `test/consumer` in `check:types`, CI on Linux, Windows and macOS.

## 6. Risks

| Risk | Countermeasure |
|---|---|
| MD_Manager's behavior changes | Section 1: its code as the base, its behavior as defaults, differential tests, unchanged end-to-end assertions and baselines. |
| Fakes differ from the browser | Fakes cover only the API surface in use; the apps' end-to-end paths run against real APIs. |
| Stale build after `git pull` | `npm run build` after every pull. |
| Visual baselines differ between machines | Baselines come from the CI runners (`visual-baselines.yml`); local differences are checked in the diff images. |

## 7. Open

- `session.rebase()` for conflicts across devices; storage adapters `drive()` and `webdav()`.
