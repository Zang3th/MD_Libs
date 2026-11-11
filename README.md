# MD_Libs

<a href="https://github.com/Zang3th/MD_Libs/actions/workflows/verify.yml"><img src="https://img.shields.io/github/actions/workflow/status/Zang3th/MD_Libs/verify.yml?branch=master&amp;label=Build&amp;logo=github" alt="Build status"></a>

Shared application core of my Markdown apps [MD_Manager](https://github.com/Zang3th/MD_Manager) and [MD_Calendar](https://github.com/Zang3th/MD_Calendar).<br>
ES modules, no build, tested with `node:test` only.

## Modules

| Layer        | Module                                      | Purpose                                             |
| ------------ | ------------------------------------------- | --------------------------------------------------- |
| **core**     | `history`                                   | Undo/redo with view states and saved-state distance |
|              | `controls`                                  | State of save, undo and redo buttons                |
|              | `text`                                      | Lines with BOM and line endings, escaping           |
|              | `markdown`                                  | Line helpers: `#Key` blocks, trailing tags          |
|              | `inline`                                    | Inline formatting to tokens or plain text           |
|              | `search`                                    | Fuzzy search with ranking and match positions       |
|              | `dates`                                     | Day keys, arithmetic, ISO weeks, formatting         |
| **platform** | `storage`                                   | Folder, file and memory adapters with version check |
|              | `handles`                                   | Remembered handles in IndexedDB                     |
|              | `session`                                   | Saving, external changes, conflicts                 |
|              | `startup`                                   | Checks for styles, fonts, images                    |
|              | `audio`                                     | Synthesized UI sounds                               |
| **ui**       | `notifications`                             | Messages with codes, details and actions            |
|              | `tooltips`                                  | Tooltips for `data-tooltip`                         |
|              | `keymap`                                    | Shortcuts, Escape stack, help                       |
|              | `dom`                                       | Frame batching, placement, clipboard                |
|              | `sortable`                                  | Thin layer over SortableJS                          |
|              | `drag`                                      | Pointer dragging outside lists                      |
|              | `menu`                                      | Context menu                                        |
| **harness**  | `build`                                     | Bundles an app into `dist/app.js`                   |
|              | `fakes`, `storage-contract`, `load-classic` | Shared test tooling                                 |
|              | `architecture`, `icons`, `eslint`           | Shared checks                                       |

## Install

```json
"dependencies": {
  "@zang3th/md-libs": "github:Zang3th/MD_Libs#master"
}
```

Applications bundle their code and MD_Libs with esbuild into one classic script that runs from `file://`.

## Quick start

```js
import { history } from "@zang3th/md-libs/core";
import { session, storage } from "@zang3th/md-libs/platform";

const adapter = storage.folder(directoryHandle, { files: ["Calendar.md"] });
const initial = { "Calendar.md": await adapter.read("Calendar.md") };
let model = parse(initial["Calendar.md"]?.text ?? "");

const undo = history.create();
const files = session.create({
  adapter,
  initial,
  files: {
    "Calendar.md": {
      serialize: () => toMarkdown(model),
      load: text => { model = parse(text ?? ""); }
    }
  },
  history: () => undo
});

undo.execute({ label: "Move entry", redo: move, undo: moveBack });
files.on("conflict", showReloadOrOverwrite);
await files.save();
```

Every module is a namespace export of its entry point. `core` is pure and runs in Node.js; `platform` receives browser objects such as `indexedDB` or file handles from the app.

## API

### core

#### `history`

Bounded undo/redo (100 entries, 8 MiB) with view states and the number of changes since the last save.

```js
const undo = history.create();
undo.execute({ label: "Rename", redo, undo, beforeViewState, afterViewState });
undo.undo();          // → { label, viewState, action } | null
undo.canUndo;         // also canRedo, undoLabel, redoLabel
undo.markSaved();
undo.unsaved;         // → 0
```

#### `controls`

State of the save, undo and redo buttons. The app supplies the texts.

```js
controls.state({ history: undo, unsaved: 2 }, {
  undo: label => `Undo ${label}`,
  redo: label => `Redo ${label}`,
  save: (status, count) => `${count} unsaved`
});
// → { undo: { disabled, label },
//     redo: { disabled, label },
//     save: { status: "unsaved", count: 2, label } }
```

#### `search`

Fuzzy search: the letters must appear in order. Contiguous runs, word starts and short texts rank first.

```js
const index = search.createIndex(entries, {
  fields: [
    { get: entry => entry.title, weight: 24 },
    { get: entry => entry.note }
  ],
  fold: "diacritics",   // default "case": smart case
  words: true           // every word must match
});

index.query("zahnarzt", { limit: 10 });
// → { results: [{ item, score, positions }], total }
```

#### `dates`

Days as keys `YYYY-MM-DD`, without time zones.

```js
dates.parse("10.11.2026")?.key;   // → "2026-11-10"
dates.addDays("2026-11-10", 7);   // → "2026-11-17"
dates.isoWeek("2026-11-10");      // → 46

dates.formatPattern("2026-11-10", "dddd, D. MMMM", germanNames);
// → "Dienstag, 10. November"
```

Also `format`, `today`, `diff`, `weekStart`, `monthStart`, `toTime`, `fromTime`, `dayNumber`.

#### `text`, `markdown`, `inline`

Helpers for the shared Markdown dialect; parsers and serializers stay in the apps.

```js
text.split(source);   // → { lines, newline, bom, finalNewline }
text.join(document);  // writes it back unchanged
text.escapeHtml("<b>");                   // → "&lt;b&gt;"

markdown.trailingTag("Dentist #health");
// → { text: "Dentist", tag: "health" }
markdown.keyBlocks(lines, { keys: ["Start", "Note"], prose: ["Note"] });
// → key, item, prose and unknown lines

inline.parse("**bold** and `code`");
// → tokens: text, code, link, strong, strike, em
inline.plainText("**bold**");             // → "bold"
```

### platform

#### `storage`

Adapters for a folder, a single file or memory. A write succeeds only if the file still has the expected content.

```js
const folder = storage.folder(directoryHandle, {
  files: ["Calendar.md", "Backlog.md"]
});
const { text } = await folder.read("Calendar.md");

// Rejects with MDLStorageConflictError if the file changed meanwhile.
await folder.write("Calendar.md", updated, text);

storage.missingApis(window, ["showDirectoryPicker", "indexedDB"]);
// → names of missing browser APIs
```

#### `handles`

Remembered file or folder handles in IndexedDB, newest first.

```js
const recent = handles.create({
  indexedDB, database: "MyApp", store: "recent", limit: 5
});
await recent.remember(handle, existing => ({ title: "Project" }));
await recent.list();  // → [{ id, name, openedAt, handle, title }]
```

#### `session`

Saving, external changes and conflicts for the files of one opened location. Create one per opened file or folder.

```js
const files = session.create({
  adapter, files, initial, history: () => undo, reloadWhenClean: true
});

await files.save();       // writes changed files; calls during a save coalesce
await files.check();      // call on an interval, on focus and on visibility
files.reload();           // conflict: discard local changes
await files.overwrite();  // conflict: keep local changes
files.destroy();

files.on("conflict", ({ files }) => {});
// also change, blocked, saved, reloaded, checkError
```

#### `startup`

```js
await startup.missingResources({
  document,
  styles: { token: "--bg", file: "styles.css" },
  fonts: [{ font: '400 14px "Inter"', file: "fonts/Inter.woff2" }],
  images: [{ image: document.querySelector(".logo"), file: "logo.svg" }]
});
// → ["fonts/Inter.woff2"] if it did not load
```

### harness

```js
const { build, bundleForTests } = require("@zang3th/md-libs/harness/build");

await build(esbuild, { root });  // app.js → dist/app.js
bundleForTests(esbuild, { root, files: ["domain/calendar.js"] });
// → source to run in a vm context

// fileSystem, indexedDB, clock, gate, flush
const fakes = require("@zang3th/md-libs/harness/fakes");

const { storageContract } =
  require("@zang3th/md-libs/harness/storage-contract");
storageContract("my adapter", files => ({
  adapter, change, failNextRead, failNextWrite
}));
```

## Development

Requires Node.js ≥ 22.12.

```sh
npm ci
npm run verify
```

## License

MD_Libs is licensed under the [MIT License](https://github.com/Zang3th/MD_Libs/blob/master/LICENSE).
