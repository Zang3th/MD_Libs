# MD_Libs

<a href="https://github.com/Zang3th/MD_Libs/actions/workflows/verify.yml"><img src="https://img.shields.io/github/actions/workflow/status/Zang3th/MD_Libs/verify.yml?branch=master&amp;label=Build&amp;logo=github" alt="Build status"></a>

Shared application core of my Markdown apps [MD_Manager](https://github.com/Zang3th/MD_Manager) and [MD_Calendar](https://github.com/Zang3th/MD_Calendar).<br>
ES modules, no build, tested with `node:test` only.

## Modules

| Layer        | Module          | Purpose                                              |
| ------------ | --------------- | ---------------------------------------------------- |
| **core**     | `history`       | Undo/redo, saved-state distance, button states       |
|              | `markdown`      | Lines, `#Key` blocks, tags, inline, invalid chars    |
|              | `search`        | Fuzzy search with ranking and match positions        |
|              | `dates`         | Day keys, arithmetic, periods, ISO weeks, formatting |
| **platform** | `storage`       | Folder, file and memory adapters with version check  |
|              | `handles`       | Remembered handles in IndexedDB                      |
|              | `session`       | Opening, saving, external changes, conflicts         |
|              | `startup`       | Checks for browser APIs, styles, fonts, images       |
|              | `audio`         | Synthesized UI sounds                                |
| **ui**       | `notifications` | Messages with codes, details and actions             |
|              | `tooltips`      | Tooltips for `data-tooltip`                          |
|              | `keymap`        | Shortcuts as data, text-field detection              |
|              | `sortable`      | Defaults and drop index for SortableJS               |
|              | `popover`       | Placement and closing of floating elements           |
| **harness**  | `build`         | Bundles an app into `dist/app.js`                    |
|              | `testing`       | Fakes, storage contract, module loader for unit tests |
|              | `checks`        | Architecture rules, icons, ESLint config, LoC report |

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
let model;

const undo = history.create();
const files = await session.open({
  adapter,
  files: {
    "Calendar.md": {
      serialize: () => toMarkdown(model),
      load: text => { model = parse(text ?? ""); }
    }
  },
  history: () => undo,
  window
});

undo.execute({ label: "Move entry", redo: move, undo: moveBack });
files.on("conflict", showReloadOrOverwrite);
await files.save();
```

## Conventions

- Every module is a namespace export of its entry point: `@zang3th/md-libs/core`, `/platform`, `/ui`. Harness entry points are CommonJS: `/harness/build`, `/harness/testing`, `/harness/checks`.
- `core` is pure and runs in Node.js. `platform` and `ui` receive browser objects such as `window`, `indexedDB` or file handles from the app.
- Anything with state is made by `create(options)` with one options object. Functions that need tools from the app (esbuild, TypeScript, SortableJS) take them in their options object too.
- Texts, names, codes and sounds come from the app. MD_Libs has no runtime dependency.

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

`history.controls` derives the state of the save, undo and redo buttons; the app supplies the texts.

```js
history.controls({
  history: undo,
  unsaved: 2,
  strings: {
    undo: label => `Undo ${label}`,
    redo: label => `Redo ${label}`,
    save: (status, count) => `${count} unsaved`
  }
});
// → { undo: { disabled, label },
//     redo: { disabled, label },
//     save: { status: "unsaved", count: 2, label } }
```

#### `markdown`

Helpers for the shared Markdown dialect; parsers and serializers stay in the apps.

```js
markdown.split(source);   // → { lines, newline, bom, finalNewline }
markdown.join(document);  // writes it back unchanged

markdown.trailingTag("Dentist #health");
// → { text: "Dentist", tag: "health" }
markdown.keyBlocks(lines, { keys: ["Start", "Note"], prose: ["Note"] });
// → key, item, prose and unknown lines

markdown.inline("**bold** and `code`");
// → tokens: text, code, link, strong, strike, em
markdown.plainText("**bold**");   // → "bold"
markdown.escapeHtml("<b>");       // → "&lt;b&gt;"
markdown.invalidCharacter("a\nb\u0000");
// → { index: 3, line: 2, column: 2 }; control characters, DEL, U+FFFD
```

#### `search`

Fuzzy search: the letters must appear in order. Contiguous runs, word starts and short texts rank first.

```js
const index = search.create({
  items: entries,
  fields: [
    { get: entry => entry.title, weight: 24 },
    { get: entry => entry.note }
  ],
  fold: "diacritics",   // default "case": smart case
  words: true           // every word must match
});

index.query("zahnarzt", { limit: 10 });
// → { results: [{ item, score, field, positions }], total }
```

#### `dates`

Days as keys `YYYY-MM-DD`, without time zones.

```js
dates.parse("10.11.2026")?.key;   // → "2026-11-10"
dates.addDays("2026-11-10", 7);   // → "2026-11-17"
dates.isoWeek("2026-11-10");      // → 46

dates.periodStart("2026-11-12", "quarter");   // → "2026-10-01"
dates.periodStart("2026-11-12", "year", 5);   // → "2025-01-01"
dates.addPeriod("2026-01-31", "month", 1);    // → "2026-03-03"
// Both also take a UTC time and return one.

dates.formatPattern("2026-11-10", "dddd, D. MMMM", germanNames);
// → "Dienstag, 10. November"
```

Also `format`, `today`, `diff`, `weekStart`, `monthStart`, `toTime`, `fromTime`, `dayNumber`.

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

await storage.ensurePermission(directoryHandle, "readwrite");  // → true
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
With `window`, it checks for external changes every 2 s, on focus and when the page becomes visible.

```js
const files = session.create({
  adapter, files, initial, history: () => undo, reloadWhenClean: true,
  window, shouldCheck: () => !dialogOpen(), confirmLeave: true
});
// or: await session.open({ adapter, files, ... }) reads and loads the files first

await files.save();       // writes changed files; calls during a save coalesce
await files.check();      // also on demand
files.reload();           // conflict: discard local changes
await files.overwrite();  // conflict: keep local changes
files.destroy();

files.on("conflict", ({ files }) => {});
// also change, blocked, saved, reloaded, checkError
```

#### `startup`

What the app needs before it starts; a non-empty result is the app's startup error.

```js
startup.missingApis({ window, apis: ["showDirectoryPicker()", "indexedDB"] });
// → ["window.showDirectoryPicker()"] if the browser lacks it

await startup.missingResources({
  document,
  styles: { token: "--bg", file: "styles.css" },
  fonts: [{ font: '400 14px "Inter"', file: "fonts/Inter.woff2" }],
  images: [{ image: document.querySelector(".logo"), file: "logo.svg" }]
});
// → ["fonts/Inter.woff2"] if it did not load
```

#### `audio`

Synthesized UI sounds: sine voices with pitch glides, an envelope and a short plate reverb. No audio files; the app defines its sounds.

```js
const synth = audio.create({ window, AudioContext });
await synth.play({
  gain: .1, dry: .7, wet: .3,
  voices: [{
    start: 0, points: [{ time: 0, frequency: 880 }],
    attack: .004, hold: .02, release: .3, gain: .7
  }]
});
synth.setMuted(true);
```

### ui

#### `notifications`

A stack of messages: info and warnings close themselves, errors stay and copy their details.

```js
const messages = notifications.create({
  window,
  container: document.getElementById("notifications"),
  strings: { close: "Close" },  // English defaults
  defaultCode: "APP-000"
});

messages.show("info", "File saved", [{ value: "Project.md" }, " saved."]);
messages.show("warning", "File changed", "", {
  persistent: true,
  actions: [{ label: "Reload", run: reload }]
});
messages.fatal("Startup failed", "Reload the page.", { code: "APP-004" });
```

#### `tooltips`

Tooltips for every element with `data-tooltip`, on hover after a delay and on focus.

```js
tooltips.create({ window, element: document.getElementById("tooltip") });
```

#### `keymap`

Shortcuts as data: `mod` is Ctrl or ⌘, `shift?` allows Shift either way. Every matching binding acts, in order.

```js
const keys = keymap.create({ target: document });
keys.bind("mod+s", save, { inEditable: true });
keys.bind(["mod+shift+z", "ctrl+y"], redo);
keys.bind("shift?+f", openSearch, { when: () => !dialogOpen() });
```

#### `sortable`

Shared defaults for SortableJS and the index of a dropped item. The app passes SortableJS in.

```js
sortable.create({
  Sortable, window, element: list,
  options: { group: "tasks", handle: ".card-header" }
});

sortable.dropIndex({
  fromIndex: 0, next: 3, previous: 2, fallback: 0, sameList: true
});
// → 2
```

#### `popover`

Places a floating element next to an anchor or a point, inside bounds; flips to the other side when needed.
`create` shows and hides it, keeps `aria-expanded` of its button in step and closes it on an outside click and on Escape.

```js
const { left, top } = popover.place(
  button.getBoundingClientRect(), size, popover.viewport(window),
  { side: "below", align: "end", gap: 8, flip: true }
);

const menu = popover.create({
  window, element: panel, button,
  dismiss: "pointerdown",   // default "click"
  onClose: reason => { if (reason === "escape") button.focus(); }
});
button.addEventListener("click", () => menu.toggle());
```

### harness

```js
const { build } = require("@zang3th/md-libs/harness/build");
await build({ esbuild, root });  // app.js → dist/app.js

const testing = require("@zang3th/md-libs/harness/testing");
testing.fileSystem({ "a.md": "text" });
// also indexedDB, audioContext, clock, gate, flush
testing.loadClassic({
  esbuild, root, namespace: "MyApp", files: ["domain/a.js"]
});
// → window of a vm context that ran the modules
testing.storageContract({ name: "my adapter", setup });
// registers the adapter contract as node:test tests

const checks = require("@zang3th/md-libs/harness/checks");
const checker = checks.createChecker({ ts, root });
// forbid(), checkModules(), checkPage(), checkStyles(), checkDependencies()
checks.compareIcons({ html, directory: "res/icons", prefix: "icon-" });
// → [] when files and symbols match
console.log(checks.formatStats(checks.projectStats({
  root, sources: { HTML: ["App.html"], CSS: ["styles.css"], JS: ["app.js", "ui/"] }
})));  // source lines and tests
module.exports = checks.eslintConfig({ js, globals });  // eslint.config.js
```

The applications' `jsconfig.json` and `jsconfig.harness.json` extend the shared compiler options:

```json
{ "extends": "./node_modules/@zang3th/md-libs/config/jsconfig.app.json" }
```

## Development

Requires Node.js ≥ 22.12.

```sh
npm ci
npm run verify
```

### Stats

<table>
  <thead>
    <tr>
      <th>Release</th>
      <th>Date</th>
      <th>JS</th>
      <th>Tests</th>
    </tr>
  </thead>
  <tbody>
    <tr><td>master</td><td>12.11.2026</td><td>2,134</td><td>131</td></tr>
    <tr><td>v0.4.0</td><td>12.11.2026</td><td>2,134</td><td>130</td></tr>
  </tbody>
</table>

## License

MD_Libs is licensed under the [MIT License](https://github.com/Zang3th/MD_Libs/blob/master/LICENSE).
