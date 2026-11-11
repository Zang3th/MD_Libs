# MD_Libs

Shared application core of my markdown apps [MD_Manager](https://github.com/Zang3th/MD_Manager) and [MD_Calendar](https://github.com/Zang3th/MD_Calendar).<br>
ES modules, no build, tested with `node:test` only.

## Modules

| Layer | Module | Purpose |
|---|---|---|
| **core** | `history` | Undo/redo with view states and saved-state distance |
| | `controls` | State of save, undo and redo buttons |
| | `text` | Lines with BOM and line endings preserved |
| | `markdown` | Line scanner: headings, checkboxes, `#Key` blocks, tags |
| | `inline` | Inline formatting to tokens, plain text or DOM |
| | `search` | Fuzzy search with ranking and match positions |
| | `dates` | `DD.MM.YYYY`, day arithmetic, ISO weeks |
| **platform** | `storage` | Folder, file and memory adapters with version check |
| | `handles` | Remembered handles in IndexedDB |
| | `session` | Saving, external changes, conflicts |
| | `startup` | Checks for APIs, styles, fonts, images |
| | `audio` | Synthesized UI sounds |
| **ui** | `notifications` | Messages with codes, details and actions |
| | `tooltips` | Tooltips for `data-tooltip` |
| | `keymap` | Shortcuts, Escape stack, help |
| | `dom` | Frame batching, placement, clipboard |
| | `sortable` | Thin layer over SortableJS |
| | `drag` | Pointer dragging outside lists |
| | `menu` | Context menu |
| **harness** | `build` | Bundles an app into `dist/app.js` |
| | `fakes`, `storage-contract`, `load-classic` | Shared test tooling |
| | `architecture`, `icons`, `eslint` | Shared checks |


## Install

```json
"dependencies": { "@zang3th/md-libs": "github:Zang3th/MD_Libs#master" }
```

Applications bundle their code and MD_Libs with esbuild into one classic script that runs from `file://`.

## Available API

| Export | API |
|---|---|
| `harness/build` | `build(esbuild, { root, entry = "app.js", outfile = "dist/app.js" })` → path of the bundle<br>`bundleForTests(esbuild, { root, files, prelude? })` → bundle source for a `vm` context |

## Development

Node.js ≥ 22.12.

```sh
npm ci
npm run verify
```

## License

MD_Libs is licensed under the [MIT License](https://github.com/Zang3th/MD_Libs/blob/master/LICENSE).
