# MD_Libs – Plan

**Ziel:** Dopplungen zwischen MD_Manager und MD_Calendar beseitigen und einen getesteten Applikationskern als Bibliothek bereitstellen. Was keine Dopplung beseitigt und den Kern nicht stärkt, gehört nicht nach MD_Libs.

Versionen und Arbeitspakete: [Roadmap](Roadmap.md).

---

## 1. Leitregeln

1. **MD_Manager ist die Referenz.** Für seine Nutzer ändert sich nichts: Aussehen, Texte, Bedienung, Zeitpunkte, Tastatur, Drag and Drop, Suchergebnisse, Dateiinhalt und Dateibehandlung. Interna, Schnittstellen und DOM-Struktur dürfen sich ändern, solange das gilt.
2. **Module entstehen aus dem MD_Manager-Code** und werden dabei verallgemeinert. Zusätzliche Fähigkeiten von MD_Calendar kommen als Optionen hinzu; der Standardwert ist das MD_Manager-Verhalten.
3. **Was sich nicht verhaltensgleich herauslösen lässt, bleibt in MD_Manager.** Derzeit: der Parser `io/markdown.js`.
4. **Abnahme in MD_Manager:** E2E-Assertions und visuelle Baselines bleiben unverändert grün; Baselines werden nie neu erzeugt. Wo eine Verallgemeinerung nutzerrelevante Ergebnisse berühren kann (Ranking, Serialisierung, Speicherentscheidungen, Index-Rechnung beim Ziehen), sichert ein Differenztest gegen den bisherigen MD_Manager-Code ab.
5. **Bleibt in den Apps:** Domänenmodelle, Dateiformate und Golden Files, Wiederholungsregeln, ICS/vCard, Rendering der Ansichten, CSS, Texte, Fehlercodes (`MDM-`, `MDC-`).

---

## 2. Laufzeit und Einbindung

- Beide Apps bündeln mit esbuild `app.js` und alle Imports zu `dist/app.js`, einem klassischen Skript mit Source Map; es läuft unter `file://`. `dist/` ist nicht eingecheckt.
- Produktionsdateien der Apps sind ES-Module mit gemeinsamem Namespace (`window.MDManager`, `window.MDCalendar`). Nur `app.js` importiert Produktionsmodule, einmal und in der Reihenfolge domain, io, ui. Library-Module werden explizit importiert.
- MD_Libs ist ein ESM-Paket ohne eigenen Build; Harness-Module sind CommonJS (`.cjs`). Die Apps beziehen den aktuellen `master` als Git-Abhängigkeit `github:Zang3th/MD_Libs#master`; `package-lock.json` hält den Commit fest, `npm update @zang3th/md-libs` holt den neuesten. Lokal `npm link ../MD_Libs`.
- SortableJS: UMD-Build `sortablejs/Sortable.min.js`, von `app.js` zuerst importiert. Keine Datumsbibliothek: Datumsrechnung und -anzeige liefert `core/dates`.
- Fehlt `dist/app.js`, zeigt die HTML-Datei über `onerror` am Skript-Tag nur den Hinweis, `npm ci` und `npm run build` auszuführen.
- Typen: JSDoc mit `tsc --checkJs` strict. Produktion `moduleResolution: Bundler`, `maxNodeModuleJsDepth: 0`; Harness `NodeNext`, `maxNodeModuleJsDepth: 1`.

| Befehl | Wirkung |
|---|---|
| `npm run build` | baut `dist/`; nach jedem `git pull` nötig |
| `npm run verify` | baut, dann Typen, Lint, Architektur, Unit-Tests, E2E gegen den Build |

Release von MD_Manager: `release.yml` baut und packt HTML, `styles.css`, `res/`, `data/templates/`, README, LICENSE und `dist/`.

**Schichtregeln der Apps** (Architektur-Checker, anhand der `import`-Pfade):

| App-Schicht | darf importieren |
|---|---|
| `domain/` | `@zang3th/md-libs/core` |
| `io/` | `core`, `platform` |
| `ui/` | `core`, `ui`; SortableJS |
| `app.js` | alles |

Exporte und dynamische Importe in Produktionsdateien sind verboten; die HTML-Datei lädt nur `dist/app.js`.

---

## 3. Bibliothek

### 3.1 Grundsätze

1. Einzige Laufzeitabhängigkeit ist `sortablejs`, nur in `ui/sortable`.
2. Keine Seiteneffekte beim Import (`"sideEffects": false`). Listener, Timer und Observer entstehen in `create…()`, jedes Objekt hat `destroy()`.
3. Jede Entscheidung ist eine pure Funktion über Plain Data. Code mit DOM, Layout, Web Audio, IndexedDB oder File System Access enthält keine eigene Verzweigungslogik; Browser-Objekte werden übergeben.
4. Texte, Icons, Uhr/Timer und Speicher-Adapter werden injiziert. Standardtexte Englisch.
5. Öffentliche Typen mit Präfix `MDL`; Fehlerklassen mit `name` und `code` (`MDL_STORAGE_CONFLICT`). App-Fehlercodes vergibt die App.
6. Kein CSS. UI-Module erzeugen die DOM-Struktur und Klassen von MD_Manager; MD_Calendar passt sein CSS an.
7. Keine Releases: `master` ist der Stand, den die Apps beziehen, und muss jederzeit grün sein. Eine Änderung an einer öffentlichen Schnittstelle passt beide Apps im selben Zug an.

### 3.2 Struktur

```text
src/core/        pur: kein DOM, keine Browser- oder Node-APIs
src/platform/    Browser-APIs ohne Rendering (File System Access, IndexedDB, Web Audio)
src/ui/          DOM-Komponenten
src/harness/     Node-Werkzeuge für die Apps (.cjs), nie gebündelt
test/            node:test; reference/ = eingefrorener MD_Manager-Code für Differenztests
docs/            Plan.md, Roadmap.md
```

Einstiegspunkte: `@zang3th/md-libs/core`, `/platform`, `/ui`, `/harness/<name>`.

### 3.3 Module

#### core/history

Basis MD_Manager: `execute` (No-op bei `redo() === false`, Rollback bei Fehler), `commit`, `replaceCurrent`, `clear`, View-State vor/nach, Grenzen 100 Einträge / 8 MiB. Zusätzlich der Gespeichert-Abstand aus MD_Calendar; er übersteht Trim, verworfene Redo-Zweige und `replaceCurrent`.

```js
const h = history.create({ maxEntries, maxBytes });
h.execute(action)  h.commit(action)  h.replaceCurrent(action)  h.clear()
h.undo() / h.redo()               // → { label, viewState, action } | null
h.canUndo  h.canRedo  h.undoLabel  h.redoLabel  h.position
h.markSaved(position?)  h.unsaved
```

#### core/controls

Zustand der Knöpfe Speichern, Undo, Redo; Texte liefert die App.

```js
controls.state({ history, unsaved, conflict }, { undo: label => …, redo: label => …, save: (status, count) => … })
// → { undo: { disabled, label }, redo: { disabled, label }, save: { status: "saved" | "unsaved" | "conflict", count, label } }
```

#### core/text

```js
text.split(source)    // → { lines, newline, bom, finalNewline }
text.join(document)   // exakte Umkehrung von split
text.escapeHtml(value)
```

#### core/markdown

Zeilenhilfen für den gemeinsamen Dialekt; Parser und Serializer bleiben in den Apps.

```js
markdown.trailingTag("Arzt #health")                       // → { text: "Arzt", tag: "health" }
markdown.keyBlocks(lines, { keys, prose: ["Note"] })       // → key | item | prose | unknown, je mit Index
```

#### core/inline

Grammatik des MD_Manager-Renderings; die Apps erzeugen daraus ihr HTML.

```js
inline.parse(text)      // → text | code | link (nur http/https) | strong | strike | em
inline.plainText(text)  // ohne Markierungen; schneller Pfad ohne Marker
```

#### core/search

Scorer von MD_Manager (Teilfolge, Wortgrenzen, Smart Case, Positionen, Top-K mit Schwelle, Narrowing). Optionen für MD_Calendar: Diakritika, Mehrwortsuche, Feldgewichte. Die App liefert Felder und Tiebreak.

```js
const index = search.createIndex(items, { fields: [{ get, weight }], fold: "case" | "diacritics", words, tieBreak });
index.query(text, { limit })   // → { results: [{ item, score, field, positions }], total }
```

#### core/dates

Tagesschlüssel `YYYY-MM-DD`, keine Zeitzonen, keine Abhängigkeit.

```js
dates.parse("10.11.2026")   // auch YYYY-MM-DD und DD.MM.YY → { key, year, month, day, time } | null
dates.format(key)  dates.today(now)  dates.toTime(key)  dates.fromTime(time)  dates.dayNumber(key)
dates.addDays(key, n)  dates.diff(a, b)  dates.monthStart(key, n)  dates.weekStart(key)  dates.isoWeek(key)
dates.formatPattern(key, "dddd, D. MMMM YYYY", { days, daysShort, months, monthsShort })   // Namen liefert die App; plattformunabhängig, kein Intl
```

#### platform/storage

```js
/** MDLStorageAdapter: { name, list(), read(file) → { text, stamp } | null, stat(file) → stamp | null,
 *                       write(file, text, expected) → stamp, canCheck? } */
storage.folder(directoryHandle, { files })
storage.file(fileHandle)          // Einzeldatei (MD_Manager); eine gelöschte Datei wirft NotFoundError
storage.memory(files)             // Tests und Referenz
storage.missingApis(window, names)  storage.ensurePermission(handle, mode, { query, prompt })
class MDLStorageConflictError { file, text, stamp }
```

`expected` ist der Inhalt, den der Aufrufer auf der Platte erwartet (`null`: Datei darf nicht existieren, `undefined`: ohne Prüfung). Schreibvorgänge eines Adapters laufen über eine serialisierte Schlange. Stempel sind opake Strings (`lastModified:size`); später `drive()`, `webdav()`.

#### platform/handles

Gemerkte Handles in IndexedDB; gleiches Handle per `isSameEntry` zusammengeführt.

```js
const store = handles.create({ indexedDB, database, store, version, limit });   // MD_Manager 5, MD_Calendar 1
store.list()  store.find(handle)  store.remember(handle, existing => data)  store.forget(id)
```

#### platform/session

Speichern, externe Änderungen, Konflikte für die Dateien eines geöffneten Orts. Eine Sitzung pro Datei bzw. Ordner; `destroy()` beim Wechsel. Reine Logik mit injiziertem Adapter und Uhr; wann geprüft wird (Intervall, Fokus, Sichtbarkeit, offener Dialog), entscheidet die App.

```js
const s = session.create({
  adapter, initial,
  files: { "Calendar.md": { serialize, load }, "Holidays.md": { writable: false, load } },
  history: () => history,          // MD_Calendar: Zähler aus dem Verlauf; ohne: 1 bei geändertem Inhalt (MD_Manager)
  order: () => [...], reloadWhenClean: true, contentCheckInterval: 30000, now
});
s.save(force)  s.check()  s.reload()  s.overwrite()  s.destroy()
s.unsaved  s.hasConflict  s.conflicts
s.on("change" | "conflict" | "blocked" | "saved" | "reloaded" | "checkError", listener)
```

Regeln: Konflikt nur bei geändertem Inhalt (ein reiner Stempelwechsel nicht); gelöschte Datei im Ordner ist ein Konflikt, eine gelöschte Einzeldatei eine einmalige Fehlermeldung; nur lesbare Dateien werden immer neu geladen; geschriebene Dateien werden nachgeprüft; Speicheraufrufe während eines Speicherns bündeln sich; Sitzungs-Token und Revision verwerfen veraltete Antworten; unveränderter Inhalt gilt als gespeichert. Später: `rebase()` für Mehrgeräte-Konflikte.

#### platform/startup

```js
startup.missingResources({ document, styles: { token, file }, fonts: [{ font, text, file }], images: [{ image, file }] })
// → fehlende Dateien; fehlende APIs liefert storage.missingApis
```

Die App ordnet das Ergebnis ihren Fehlercodes zu und blockiert den Start.

#### platform/audio

```js
const synth = audio.createSynth({ masterGain, dry, wet, plate: { seconds, seed } });
synth.play(voices)   synth.muted = true   synth.destroy()
audio.presets.sweepDuo   audio.presets.arpeggio
```

#### ui/notifications

```js
const n = notifications.create({ container, codePrefix, duration, maxTextLength, strings, icons, symbols });
n.show(severity, title, body, { code, details, persistent, actions, symbol })   // → { dismiss(), isOpen() }
n.fatal(title, body, { details, code, block })
n.installGlobalErrorReporting({ codes, title, body })
```

#### ui/tooltips

```js
tooltips.create({ element, attribute: "data-tooltip", delay: 350, touch: true, focusVisibleOnly: false })   // MD_Calendar: touch false, focusVisibleOnly true
```

#### ui/keymap

Eine Quelle für Kürzel und Hilfe; Escape als Stapel.

```js
const k = keymap.create({ target: document });
k.bind("mod+s", save, { group, label, whenEditable })
k.pushEscape(close)   // → release
k.helpModel()
keymap.isEditableTarget(target)
```

#### ui/dom

```js
dom.frame(callback)                          // → { schedule(), cancel() }, ein rAF
dom.place(element, point | { anchor, side }, { margin })
dom.dismissable(element, { onDismiss })
dom.writeClipboard(text)                     // mit Fallback
```

#### ui/sortable

Dünne Schicht über SortableJS mit den Optionen beider Apps. Standardwerte wie MD_Manager.

```js
const list = sortable.create(element, {
  group, items, handle, ignore, fixed, animation, easing, emptyInsertThreshold, fallback,
  touch: { delay, tolerance }, classes: { ghost, chosen, drag },
  accept, onStart, onHover, onDrop: ({ item, fromList, fromIndex, toList, toIndex, revert }) => {}
});
```

Purer Kern: `insertionIndex(…)` (Rechnung von MD_Manager) und `entryPosition(siblings, skip)` (MD_Calendar).

#### ui/drag

Ziehen ohne Liste (Mehrtagesbalken, Lasso).

```js
drag.create(element, { threshold, hold, capture, onStart, onMove, onEnd, onCancel })
// state: { startX, startY, x, y, dx, dy, pointerType, target }
```

Purer Kern: Zustandsmaschine `idle → pressed → dragging → ended | cancelled`.

#### ui/menu

Kontextmenü mit `menu`/`menuitem`, Pfeiltasten, Fokusrückgabe, Long-Press.

#### Pure Kerne mit Browser-Anteil

| Modul | Kern | Kleber |
|---|---|---|
| notifications | `planTrim`, `compactText`, `copyText`, Zustandsmaschine | Elemente bauen, Höhen messen |
| tooltips | Zustandsmaschine, `placeTooltip` | Listener, Rects lesen, Position schreiben |
| dom, menu | `clampToViewport`, `placeBelow`, Fokuslogik | Rect lesen, Style schreiben, `focus()` |
| keymap | `parseCombo`, `match`, Escape-Stapel, `helpModel` | ein `keydown`-Listener |
| audio | `schedule`, `plateImpulse` | Knoten erzeugen und trennen |
| storage, session | Konfliktentscheidung, Schreibschlange, Sitzungsablauf | Handles, `createWritable` |
| handles | Recent-Liste | IndexedDB-Transaktion |
| startup | Liste fehlender Dateien | `getComputedStyle`, Fonts, Bilder |

#### harness

| Modul | Inhalt | Status |
|---|---|---|
| `build` | `build(esbuild, { root })`, `bundleForTests(esbuild, { root, files, prelude })` | vorhanden |
| `load-classic` | lädt Produktionsmodule für Unit-Tests in einen `vm`-Kontext | geplant |
| `fakes` | Dateisystem (Ordner- und Datei-Handles), IndexedDB, Uhr, Gate, `flush`; AudioContext folgt mit `platform/audio` | vorhanden |
| `storage-contract` | Vertragssuite für jeden Speicher-Adapter | vorhanden |
| `architecture` | Regel-Engine des Architektur-Checkers; Apps liefern ihre Regeln | geplant |
| `icons` | Abgleich Icon-Sprite ↔ SVG-Dateien | geplant |
| `eslint` | Flat-Config-Fabrik inkl. Verbot von `.only`/`.skip` | geplant |

Kein Playwright in MD_Libs. E2E-Fixtures (Konsolenfehler-Wächter, statischer Server, OPFS-Ordnerauswahl) bleiben in den Apps.

---

## 4. Umbauten in den Apps

Verhaltensneutral, jeweils direkt vor dem Herauslösen des betroffenen Moduls.

| Umbau | App | Ziel |
|---|---|---|
| Kürzel, Escape-Handler, Hilfe-Liste | beide | `ui/keymap` |
| Platzierung schwebender Elemente | MD_Calendar | `ui/dom` |
| rAF-Bündelung | beide | `dom.frame` |
| `Sortable.create` + Index-Rechnung | beide | `ui/sortable` |
| Balken-Ziehen, Lasso | MD_Calendar | `ui/drag` |
| Zwischenablage | beide | `dom.writeClipboard` |

---

## 5. Tests

### 5.1 Regeln

1. Ein Verhalten wird genau einmal getestet: im Repo, dem der Code gehört, auf der billigsten Ebene.
2. MD_Libs testet nur mit `node:test`, mit Coverage-Schwellen (95 % Zeilen und Funktionen, 90 % Zweige). Kein Playwright, keine Browser-, keine visuellen Tests.
3. Randfälle und Wettläufe (Speichern während einer Prüfung, veraltete Prüfung nach Reload, viele Meldungen, Gleichstände) laufen in MD_Libs vollständig mit Fakes.
4. Die Apps testen MD_Libs nicht nach. Pro gemeinsamem System bleibt ein E2E-Pfad, der Verdrahtung und Browser-Kleber beweist.
5. App-Unit-Tests nutzen `harness/fakes` statt eigener Fakes.
6. Jeder Speicher-Adapter besteht `harness/storage-contract`.
7. Differenztests (`test/reference/`) werden gelöscht, sobald das Modul in MD_Manager integriert und dort grün ist.
8. Golden-File-Round-Trips bleiben in den Apps. MD_Libs testet den Scanner mit eigenem Korpus (BOM, CRLF, ohne Endzeilenumbruch, unbekannte Zeilen).
9. In MD_Libs zusätzlich: Export-Snapshot je Einstiegspunkt, `core` ohne DOM-Zugriff beim Import, Typprüfung eines `checkJs`-Konsumenten, CI auf Linux, Windows und macOS.

### 5.2 Konsolidierung

| Heute | Tests | Künftig | Version |
|---|---|---|---|
| MD_Manager `sounds.test.js` | 1 | `platform/audio` | 0.3.0 |
| Notification-Logik aus MD_Manager-E2E | – | `ui/notifications`; die E2E-Tests bleiben als Verdrahtungsnachweis | 0.3.0 |
| `architecture-checker.test.js` beider Apps | 7 + 5 | `harness/architecture` | 0.3.0 |
| `icons.test.js` beider Apps | 3 + 2 | `harness/icons`; je App ein Aufruf | 0.3.0 |
| `load-classic.js` beider Apps | – | `harness/load-classic` | 0.3.0 |
| Index-Rechnung der Drag-Tests in MD_Manager | – | Unit-Test von `ui/sortable`; die E2E-Tests ziehen mit der echten Maus | 0.3.0 |

---

## 6. Risiken

| Risiko | Gegenmaßnahme |
|---|---|
| Nutzerverhalten von MD_Manager ändert sich | Leitregeln 1–4: MD_Manager-Code als Basis, Standardwerte = MD_Manager, Differenztests, unveränderte E2E-Assertions und Baselines. |
| Fakes weichen vom Browser ab | Fakes bilden nur die genutzte API-Fläche nach; die E2E-Pfade der Apps laufen gegen echte APIs. |
| Veralteter Build nach `git pull` | `npm run build` nach jedem Pull; der Hinweis auf der Seite erscheint nur, wenn `dist/app.js` ganz fehlt. |
| Golden Files ändern sich durch den Scanner | Bitgleicher Round-Trip ist Abnahmekriterium. |
| Mehraufwand durch zwei Repos | `npm link` beim gemeinsamen Entwickeln. |
